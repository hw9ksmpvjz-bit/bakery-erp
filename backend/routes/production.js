/**
 * 生產管理路由
 * 支援：生產計劃審批、自由領料、損耗記錄
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');
const { generateOrderNo } = require('../utils/helpers');

const router = express.Router();

router.use(authenticateToken);

/**
 * FIFO 出庫輔助函數
 * 從最早入庫的批次開始扣減
 */
function fifoWithdraw(db, materialId, storeId, requiredQuantity) {
  const batches = db.prepare(`
    SELECT * FROM material_batches 
    WHERE product_id = ? AND store_id = ? AND status = 'active' AND remaining_quantity > 0
    ORDER BY received_at ASC
  `).all(materialId, storeId);

  let remainingToWithdraw = requiredQuantity;
  const withdrawals = [];

  for (const batch of batches) {
    if (remainingToWithdraw <= 0) break;

    const withdrawQuantity = Math.min(remainingToWithdraw, batch.remaining_quantity);
    remainingToWithdraw -= withdrawQuantity;

    // 扣減批次庫存
    db.prepare('UPDATE material_batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?')
      .run(withdrawQuantity, batch.id);

    // 如果批次用完，更新狀態
    if (batch.remaining_quantity - withdrawQuantity <= 0) {
      db.prepare("UPDATE material_batches SET status = 'empty' WHERE id = ?").run(batch.id);
    }

    withdrawals.push({
      batch_id: batch.id,
      batch_no: batch.batch_no,
      quantity: withdrawQuantity,
      unit_cost: batch.unit_cost,
      total_cost: withdrawQuantity * batch.unit_cost
    });
  }

  if (remainingToWithdraw > 0) {
    throw new Error(`原料庫存不足，還差 ${remainingToWithdraw}`);
  }

  return withdrawals;
}

/**
 * @GET /api/production/orders
 * 獲取生產計劃列表
 */
router.get('/orders', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['draft', 'pending', 'approved', 'processing', 'completed']),
  query('store_id').optional().isInt()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const status = req.query.status;
    const storeId = req.query.store_id;

    const conditions = ['1=1'];
    const params = [];

    if (!req.isSuperAdmin) {
      conditions.push('po.store_id = ?');
      params.push(req.storeId);
    } else if (storeId) {
      conditions.push('po.store_id = ?');
      params.push(storeId);
    }

    if (status) {
      conditions.push('po.status = ?');
      params.push(status);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM production_orders po WHERE ${conditions.join(' AND ')}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const orders = db.prepare(`
      SELECT po.*, 
             p.sku, p.name as product_name, p.unit,
             s.name as store_name,
             creator.real_name as creator_name
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      JOIN stores s ON po.store_id = s.id
      LEFT JOIN users creator ON po.created_by = creator.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: orders,
        pagination: {
          page, pageSize, total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取生產計劃列表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/production/orders
 * 創建生產計劃
 */
router.post('/orders', [
  body('product_id').isInt().withMessage('請選擇生產商品'),
  body('plan_quantity').isInt({ min: 1 }).withMessage('計劃數量必須大於0'),
  body('plan_date').isDate().withMessage('請選擇計劃日期'),
  body('store_id').isInt().withMessage('請選擇生產地點'),
  body('recipe_id').optional().isInt()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const { product_id, recipe_id, plan_quantity, plan_date, store_id, remark } = req.body;
    const db = getDatabase();

    // 數據隔離
    if (!req.isSuperAdmin && store_id !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權在其他分店創建生產計劃' });
    }

    // 檢查商品是否可生產
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_producible = 1').get(product_id);
    if (!product) {
      return res.status(400).json({ success: false, message: '該商品不可生產' });
    }

    const orderNo = generateOrderNo('PR');

    const result = db.prepare(`
      INSERT INTO production_orders (order_no, product_id, recipe_id, plan_quantity, plan_date, store_id, status, created_by, remark)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `).run(orderNo, product_id, recipe_id, plan_quantity, plan_date, store_id, req.userId, remark);

    logOperation(req.userId, req.username, 'production', 'create', 'production_orders', result.lastInsertRowid, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '生產計劃創建成功',
      data: { id: result.lastInsertRowid, order_no: orderNo }
    });

  } catch (error) {
    console.error('創建生產計劃錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

/**
 * @POST /api/production/orders/:id/approve
 * 審批生產計劃
 */
router.post('/orders/:id/approve', [
  param('id').isInt(),
  body('action').isIn(['approve', 'reject']),
  body('approval_remark').optional().trim()
], (req, res) => {
  try {
    const orderId = req.params.id;
    const { action, approval_remark } = req.body;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '生產計劃不存在' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只有草稿狀態可審批' });
    }

    // 數據隔離
    if (!req.isSuperAdmin && order.store_id !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權審批' });
    }

    if (action === 'approve') {
      db.prepare(`
        UPDATE production_orders SET status = 'approved', approved_by = ?, approved_at = datetime('now'), approval_remark = ?
        WHERE id = ?
      `).run(req.userId, approval_remark, orderId);

      logOperation(req.userId, req.username, 'production', 'approve', 'production_orders', orderId, null, null, req.ip, req.headers['user-agent'], 1);
      res.json({ success: true, message: '生產計劃已審批通過' });
    } else {
      db.prepare('UPDATE production_orders SET status = "cancelled" WHERE id = ?').run(orderId);
      logOperation(req.userId, req.username, 'production', 'reject', 'production_orders', orderId, null, null, req.ip, req.headers['user-agent'], 1);
      res.json({ success: true, message: '生產計劃已駁回' });
    }

  } catch (error) {
    console.error('審批生產計劃錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/production/orders/:id/start
 * 開始生產
 */
router.post('/orders/:id/start', (req, res) => {
  try {
    const orderId = req.params.id;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '生產計劃不存在' });
    }

    if (order.status !== 'approved') {
      return res.status(400).json({ success: false, message: '只有已審批狀態可開始生產' });
    }

    db.prepare('UPDATE production_orders SET status = "processing", start_time = datetime("now") WHERE id = ?').run(orderId);

    logOperation(req.userId, req.username, 'production', 'start', 'production_orders', orderId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({ success: true, message: '生產已開始' });

  } catch (error) {
    console.error('開始生產錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/production/orders/:id/requisitions
 * 創建原料領料單（自由領料）
 */
router.post('/orders/:id/requisitions', [
  param('id').isInt(),
  body('store_id').isInt().withMessage('請選擇領料倉庫'),
  body('items').isArray({ min: 1 }).withMessage('至少需要一個原料'),
  body('items.*.material_id').isInt(),
  body('items.*.quantity').isFloat({ min: 0.01 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const orderId = req.params.id;
    const { store_id, items, remark } = req.body;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '生產計劃不存在' });
    }

    if (!['approved', 'processing'].includes(order.status)) {
      return res.status(400).json({ success: false, message: '只有已審批或生產中狀態可領料' });
    }

    const result = db.transaction(() => {
      const requisitionNo = generateOrderNo('MR');

      // 創建領料單
      const reqResult = db.prepare(`
        INSERT INTO material_requisitions (requisition_no, production_order_id, requisition_date, store_id, created_by, remark)
        VALUES (?, ?, date('now'), ?, ?, ?)
      `).run(requisitionNo, orderId, store_id, req.userId, remark);

      const requisitionId = reqResult.lastInsertRowid;

      let totalQuantity = 0;
      let totalCost = 0;

      // 處理每個領料項目（FIFO出庫）
      for (const item of items) {
        const material = db.prepare('SELECT * FROM products WHERE id = ? AND type = "material"').get(item.material_id);
        if (!material) {
          throw new Error(`原料 ${item.material_id} 不存在`);
        }

        // FIFO出庫
        const withdrawals = fifoWithdraw(db, item.material_id, store_id, item.quantity);

        for (const withdraw of withdrawals) {
          totalQuantity += withdraw.quantity;
          totalCost += withdraw.total_cost;

          db.prepare(`
            INSERT INTO material_requisition_items 
            (requisition_id, material_id, batch_id, batch_no, quantity, unit, unit_cost, total_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(requisitionId, item.material_id, withdraw.batch_id, withdraw.batch_no,
            withdraw.quantity, material.unit, withdraw.unit_cost, withdraw.total_cost);

          // 記錄庫存變動
          db.prepare(`
            INSERT INTO inventory_logs 
            (product_id, store_id, type, quantity, before_quantity, after_quantity, 
             unit_cost, total_cost, reference_type, reference_id, operator_id)
            VALUES (?, ?, 'production_out', ?, 
                    (SELECT stock_quantity + ? FROM products WHERE id = ?),
                    (SELECT stock_quantity FROM products WHERE id = ?),
                    ?, ?, 'material_requisition', ?, ?)
          `).run(item.material_id, store_id, -withdraw.quantity, withdraw.quantity,
            item.material_id, item.material_id, withdraw.unit_cost, withdraw.total_cost,
            requisitionId, req.userId);
        }

        // 更新商品總庫存
        db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
          .run(item.quantity, item.material_id);
      }

      // 更新領料單總額
      db.prepare(`
        UPDATE material_requisitions 
        SET total_items = ?, total_quantity = ?, total_cost = ?, status = 'completed', 
            completed_by = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(items.length, totalQuantity, totalCost, req.userId, requisitionId);

      return { requisitionId, requisitionNo };
    })();

    logOperation(req.userId, req.username, 'production', 'requisition', 'material_requisitions', result.requisitionId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '原料領料成功',
      data: { id: result.requisitionId, requisition_no: result.requisitionNo }
    });

  } catch (error) {
    console.error('原料領料錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

/**
 * @POST /api/production/orders/:id/losses
 * 記錄生產損耗
 */
router.post('/orders/:id/losses', [
  param('id').isInt(),
  body('loss_type').isIn(['原料損耗', '生產損耗', '包裝損耗', '其他']).withMessage('請選擇損耗類型'),
  body('product_id').optional().isInt(),
  body('quantity').isFloat({ min: 0.01 }),
  body('unit_cost').isFloat({ min: 0 }),
  body('reason').optional().trim()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const orderId = req.params.id;
    const { loss_type, product_id, quantity, unit_cost, reason } = req.body;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '生產計劃不存在' });
    }

    if (order.status !== 'processing') {
      return res.status(400).json({ success: false, message: '只有生產中狀態可記錄損耗' });
    }

    const totalCost = quantity * unit_cost;
    const unit = product_id ? db.prepare('SELECT unit FROM products WHERE id = ?').get(product_id)?.unit : '個';

    const result = db.prepare(`
      INSERT INTO production_losses 
      (production_order_id, loss_type, product_id, quantity, unit, unit_cost, total_cost, reason, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, loss_type, product_id, quantity, unit, unit_cost, totalCost, reason, req.userId);

    // 更新生產計劃損耗數量
    db.prepare('UPDATE production_orders SET loss_quantity = loss_quantity + ? WHERE id = ?')
      .run(quantity, orderId);

    logOperation(req.userId, req.username, 'production', 'record_loss', 'production_losses', result.lastInsertRowid, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '損耗記錄成功',
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('記錄損耗錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/production/orders/:id/complete
 * 完成生產並入庫
 */
router.post('/orders/:id/complete', [
  param('id').isInt(),
  body('actual_quantity').isInt({ min: 0 }),
  body('batch_no').trim().notEmpty(),
  body('production_date').isDate(),
  body('expiry_date').isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const orderId = req.params.id;
    const { actual_quantity, batch_no, production_date, expiry_date, remark } = req.body;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: '生產計劃不存在' });
    }

    if (order.status !== 'processing') {
      return res.status(400).json({ success: false, message: '只有生產中狀態可完成' });
    }

    const result = db.transaction(() => {
      // 計算成本
      const materialCost = db.prepare(`
        SELECT COALESCE(SUM(total_cost), 0) as cost FROM material_requisitions mr
        JOIN material_requisition_items mri ON mr.id = mri.requisition_id
        WHERE mr.production_order_id = ? AND mr.status = 'completed'
      `).get(orderId).cost;

      const lossCost = db.prepare('SELECT COALESCE(SUM(total_cost), 0) as cost FROM production_losses WHERE production_order_id = ?').get(orderId).cost;

      const totalCost = materialCost + lossCost;
      const unitCost = actual_quantity > 0 ? totalCost / actual_quantity : 0;
      const shelfLifeDays = Math.ceil((new Date(expiry_date) - new Date(production_date)) / (1000 * 60 * 60 * 24));

      // 創建生產入庫
      const receiptNo = generateOrderNo('PRR');
      db.prepare(`
        INSERT INTO production_receipts 
        (receipt_no, production_order_id, product_id, quantity, unit, batch_no, 
         production_date, expiry_date, shelf_life_days, unit_cost, total_cost, store_id, received_by, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(receiptNo, orderId, order.product_id, actual_quantity, '個', batch_no,
        production_date, expiry_date, shelfLifeDays, unitCost, totalCost, order.store_id, req.userId, remark);

      // 創建成品批次
      db.prepare(`
        INSERT INTO product_batches 
        (batch_no, product_id, recipe_id, production_order_id, production_date, expiry_date, shelf_life_days,
         initial_quantity, remaining_quantity, unit, unit_cost, total_cost, store_id, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(batch_no, order.product_id, order.recipe_id, orderId, production_date, expiry_date, shelfLifeDays,
        actual_quantity, actual_quantity, '個', unitCost, totalCost, order.store_id, req.userId);

      // 更新商品總庫存
      db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?')
        .run(actual_quantity, order.product_id);

      // 更新生產計劃
      db.prepare(`
        UPDATE production_orders 
        SET status = 'completed', actual_quantity = ?, end_time = datetime('now'), completed_by = ?
        WHERE id = ?
      `).run(actual_quantity, req.userId, orderId);

      return { receiptNo, unitCost, totalCost };
    })();

    logOperation(req.userId, req.username, 'production', 'complete', 'production_orders', orderId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '生產完成並入庫',
      data: {
        unit_cost: result.unitCost,
        total_cost: result.totalCost
      }
    });

  } catch (error) {
    console.error('完成生產錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

module.exports = router;

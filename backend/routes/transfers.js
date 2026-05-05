/**
 * 調撥管理路由
 * 烘焙專屬：批次號綁定、效期檢查、調撥軌跡追溯、在途庫存關聯批次
 * 嚴格遵守規則四
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
 * 檢查批次效期並返回警告級別
 * 嚴格遵守規則四第2點
 */
function checkBatchExpiry(expiryDate, productType) {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  
  let thresholds;
  switch (productType) {
    case 'finished':
      thresholds = { warning: 3, critical: 1 };
      break;
    case 'semi':
      thresholds = { warning: 2, critical: 1 };
      break;
    case 'material':
      thresholds = { warning: 7, critical: 3 };
      break;
    default:
      thresholds = { warning: 3, critical: 1 };
  }
  
  if (diffDays < 0) return { level: 'expired', days: diffDays };
  if (diffDays <= thresholds.critical) return { level: 'critical', days: diffDays };
  if (diffDays <= thresholds.warning) return { level: 'warning', days: diffDays };
  return { level: 'normal', days: diffDays };
}

/**
 * 記錄調撥軌跡
 * 嚴格遵守規則四第3點
 */
function recordTransferTrace(db, transferId, batchId, batchType, batchNo, action, actionName, fromStoreId, toStoreId, operatorId, operatorName, remark) {
  db.prepare(`
    INSERT INTO transfer_traces 
    (transfer_id, batch_id, batch_type, batch_no, action, action_name, from_store_id, to_store_id, operator_id, operator_name, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(transferId, batchId, batchType, batchNo, action, actionName, fromStoreId, toStoreId, operatorId, operatorName, remark);
}

/**
 * @GET /api/transfers
 * 獲取調撥單列表
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['created', 'pending_approval', 'approved', 'shipped', 'in_transit', 'received', 'completed']),
  query('from_store_id').optional().isInt(),
  query('to_store_id').optional().isInt()
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
    const fromStoreId = req.query.from_store_id;
    const toStoreId = req.query.to_store_id;

    // 構建查詢條件
    const conditions = ['1=1'];
    const params = [];

    // 數據隔離：非超級管理員只能查看相關分店的調撥單
    if (!req.isSuperAdmin) {
      conditions.push('(to2.from_store_id = ? OR to2.to_store_id = ?)');
      params.push(req.storeId, req.storeId);
    }

    if (status) {
      conditions.push('to2.status = ?');
      params.push(status);
    }

    if (fromStoreId) {
      conditions.push('to2.from_store_id = ?');
      params.push(fromStoreId);
    }

    if (toStoreId) {
      conditions.push('to2.to_store_id = ?');
      params.push(toStoreId);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM transfer_orders to2
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const transfers = db.prepare(`
      SELECT 
        to2.*,
        fs.name as from_store_name,
        ts.name as to_store_name,
        creator.real_name as creator_name,
        CASE WHEN to2.has_expiry_warning = 1 THEN '⚠️ ' ELSE '' END as warning_icon
      FROM transfer_orders to2
      JOIN stores fs ON to2.from_store_id = fs.id
      JOIN stores ts ON to2.to_store_id = ts.id
      LEFT JOIN users creator ON to2.created_by = creator.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY to2.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: transfers,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取調撥單列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/transfers/:id
 * 獲取調撥單詳情（含批次詳情和效期信息）
 * 嚴格遵守規則四第1點
 */
router.get('/:id', [
  param('id').isInt()
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

    const transferId = req.params.id;
    const db = getDatabase();

    // 調撥單基本信息
    const transfer = db.prepare(`
      SELECT 
        to2.*,
        fs.name as from_store_name,
        ts.name as to_store_name,
        creator.real_name as creator_name,
        shipper.real_name as shipper_name,
        receiver.real_name as receiver_name,
        approver.real_name as approver_name
      FROM transfer_orders to2
      JOIN stores fs ON to2.from_store_id = fs.id
      JOIN stores ts ON to2.to_store_id = ts.id
      LEFT JOIN users creator ON to2.created_by = creator.id
      LEFT JOIN users shipper ON to2.shipped_by = shipper.id
      LEFT JOIN users receiver ON to2.received_by = receiver.id
      LEFT JOIN users approver ON to2.approved_by = approver.id
      WHERE to2.id = ?
    `).get(transferId);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: '調撥單不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && transfer.from_store_id !== req.storeId && transfer.to_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權查看此調撥單'
      });
    }

    // 調撥明細（含批次詳情和效期信息）
    const items = db.prepare(`
      SELECT 
        ti.*,
        p.sku,
        p.name as product_name,
        p.type as product_type,
        CASE 
          WHEN ti.expiry_warning_level = 'expired' THEN '🔴 已過期'
          WHEN ti.expiry_warning_level = 'critical' THEN '🟠 緊急（1天內）'
          WHEN ti.expiry_warning_level = 'warning' THEN '🟡 臨期'
          ELSE '🟢 正常'
        END as warning_display
      FROM transfer_order_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transfer_id = ?
      ORDER BY ti.expiry_warning_level DESC, ti.expiry_date ASC
    `).all(transferId);

    transfer.items = items;

    // 調撥軌跡（全流程追溯）
    const traces = db.prepare(`
      SELECT 
        tt.*,
        fs.name as from_store_name,
        ts.name as to_store_name
      FROM transfer_traces tt
      LEFT JOIN stores fs ON tt.from_store_id = fs.id
      LEFT JOIN stores ts ON tt.to_store_id = ts.id
      WHERE tt.transfer_id = ?
      ORDER BY tt.action_time ASC
    `).all(transferId);

    transfer.traces = traces;

    res.json({
      success: true,
      data: transfer
    });

  } catch (error) {
    console.error('獲取調撥單詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/transfers
 * 創建調撥單（強制綁定批次號，自動檢查效期）
 * 嚴格遵守規則四第1、2點
 */
router.post('/', [
  body('from_store_id').isInt().withMessage('請選擇發貨店'),
  body('to_store_id').isInt().withMessage('請選擇收貨店'),
  body('items').isArray({ min: 1 }).withMessage('至少需要一個商品'),
  body('items.*.product_id').isInt(),
  body('items.*.batch_id').isInt(),
  body('items.*.batch_type').isIn(['product', 'material']),
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

    const { from_store_id, to_store_id, items, remark } = req.body;
    const db = getDatabase();

    // 數據隔離：非超級管理員只能從本店發貨
    if (!req.isSuperAdmin && from_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權從其他分店發貨'
      });
    }

    // 檢查發貨店和收貨店不能相同
    if (from_store_id === to_store_id) {
      return res.status(400).json({
        success: false,
        message: '發貨店和收貨店不能相同'
      });
    }

    const result = db.transaction(() => {
      const transferNo = generateOrderNo('TF');
      
      // 檢查效期警告
      let hasExpiryWarning = 0;
      const expiryWarnings = [];

      // 驗證並收集批次信息
      const processedItems = [];
      for (const item of items) {
        let batch, product;
        
        if (item.batch_type === 'product') {
          batch = db.prepare('SELECT * FROM product_batches WHERE id = ? AND store_id = ?').get(item.batch_id, from_store_id);
        } else {
          batch = db.prepare('SELECT * FROM material_batches WHERE id = ? AND store_id = ?').get(item.batch_id, from_store_id);
        }

        if (!batch) {
          throw new Error(`批次 ${item.batch_id} 不存在或不屬於發貨店`);
        }

        if (batch.remaining_quantity < item.quantity) {
          throw new Error(`批次 ${batch.batch_no} 庫存不足`);
        }

        product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) {
          throw new Error(`商品 ${item.product_id} 不存在`);
        }

        // 檢查效期
        const expiryCheck = checkBatchExpiry(batch.expiry_date, product.type);
        
        if (expiryCheck.level !== 'normal') {
          hasExpiryWarning = 1;
          expiryWarnings.push({
            batch_no: batch.batch_no,
            product_name: product.name,
            warning_level: expiryCheck.level,
            days_remaining: expiryCheck.days,
            expiry_date: batch.expiry_date
          });
        }

        processedItems.push({
          ...item,
          batch_no: batch.batch_no,
          production_date: batch.production_date,
          expiry_date: batch.expiry_date,
          remaining_shelf_life_days: expiryCheck.days,
          unit_cost: batch.unit_cost,
          expiry_warning_level: expiryCheck.level,
          product
        });
      }

      // 創建調撥單
      const orderResult = db.prepare(`
        INSERT INTO transfer_orders (
          transfer_no, from_store_id, to_store_id, 
          has_expiry_warning, expiry_warning_details, 
          status, created_by
        ) VALUES (?, ?, ?, ?, ?, 'created', ?)
      `).run(
        transferNo, from_store_id, to_store_id,
        hasExpiryWarning,
        hasExpiryWarning ? JSON.stringify(expiryWarnings) : null,
        req.userId
      );

      const transferId = orderResult.lastInsertRowid;

      // 創建調撥明細
      let totalQuantity = 0;
      let totalCost = 0;
      
      for (const item of processedItems) {
        const totalItemCost = item.quantity * item.unit_cost;
        totalQuantity += item.quantity;
        totalCost += totalItemCost;

        db.prepare(`
          INSERT INTO transfer_order_items (
            transfer_id, product_id, batch_id, batch_type, batch_no,
            quantity, unit, production_date, expiry_date, remaining_shelf_life_days,
            unit_cost, total_cost, expiry_warning_level, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          transferId, item.product_id, item.batch_id, item.batch_type, item.batch_no,
          item.quantity, item.product.unit, item.production_date, item.expiry_date, item.remaining_shelf_life_days,
          item.unit_cost, totalItemCost, item.expiry_warning_level, remark
        );
      }

      // 更新總額
      db.prepare(`
        UPDATE transfer_orders SET total_items = ?, total_quantity = ?, total_cost = ? WHERE id = ?
      `).run(processedItems.length, totalQuantity, totalCost, transferId);

      // 記錄創建軌跡
      for (const item of processedItems) {
        recordTransferTrace(db, transferId, item.batch_id, item.batch_type, item.batch_no, 
          'create', '創建調撥單', from_store_id, to_store_id, req.userId, req.username, 
          hasExpiryWarning ? `包含${item.expiry_warning_level}級效期警告` : null);
      }

      return { transferId, transferNo, hasExpiryWarning, expiryWarnings };
    })();

    logOperation(req.userId, req.username, 'transfers', 'create', 'transfer_orders', result.transferId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: result.hasExpiryWarning ? '調撥單創建成功（⚠️ 包含臨期/過期商品，需審批確認）' : '調撥單創建成功',
      data: {
        id: result.transferId,
        transfer_no: result.transferNo,
        has_expiry_warning: result.hasExpiryWarning,
        expiry_warnings: result.expiryWarnings
      }
    });

  } catch (error) {
    console.error('創建調撥單錯誤:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服務器錯誤'
    });
  }
});

/**
 * @POST /api/transfers/:id/approve
 * 發貨店主管審批（效期警告需確認）
 * 嚴格遵守規則四第2點
 */
router.post('/:id/approve', [
  param('id').isInt(),
  body('action').isIn(['approve', 'reject']).withMessage('請選擇審批動作'),
  body('expiry_confirm').optional().isBoolean(), // 效期警告確認
  body('approval_remark').optional().trim()
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

    const transferId = req.params.id;
    const { action, expiry_confirm, approval_remark } = req.body;
    const db = getDatabase();

    const transfer = db.prepare('SELECT * FROM transfer_orders WHERE id = ?').get(transferId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: '調撥單不存在'
      });
    }

    // 檢查狀態
    if (transfer.status !== 'created') {
      return res.status(400).json({
        success: false,
        message: '只有創建狀態的調撥單可以審批'
      });
    }

    // 數據隔離：只有發貨店可以審批
    if (!req.isSuperAdmin && transfer.from_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '只有發貨店可以審批調撥單'
      });
    }

    // 效期警告檢查
    if (transfer.has_expiry_warning === 1 && action === 'approve' && !expiry_confirm) {
      return res.status(400).json({
        success: false,
        message: '該調撥單包含臨期/過期商品，必須確認後方可審批通過',
        data: {
          expiry_warnings: JSON.parse(transfer.expiry_warning_details),
          requires_confirm: true
        }
      });
    }

    if (action === 'approve') {
      db.prepare(`
        UPDATE transfer_orders 
        SET status = 'approved', approved_by = ?, approved_at = datetime('now'), approval_remark = ?
        WHERE id = ?
      `).run(req.userId, approval_remark, transferId);

      // 記錄審批軌跡
      const items = db.prepare('SELECT * FROM transfer_order_items WHERE transfer_id = ?').all(transferId);
      for (const item of items) {
        recordTransferTrace(db, transferId, item.batch_id, item.batch_type, item.batch_no,
          'approve', '發貨店主管審批通過', transfer.from_store_id, transfer.to_store_id, 
          req.userId, req.username, approval_remark);
      }

      logOperation(req.userId, req.username, 'transfers', 'approve', 'transfer_orders', transferId, null, null, req.ip, req.headers['user-agent'], 1);
      
      res.json({
        success: true,
        message: transfer.has_expiry_warning ? '調撥單已審批通過（臨期/過期商品已確認）' : '調撥單已審批通過'
      });
    } else {
      db.prepare('UPDATE transfer_orders SET status = "cancelled" WHERE id = ?').run(transferId);
      
      logOperation(req.userId, req.username, 'transfers', 'reject', 'transfer_orders', transferId, null, null, req.ip, req.headers['user-agent'], 1);
      
      res.json({
        success: true,
        message: '調撥單已駁回'
      });
    }

  } catch (error) {
    console.error('審批調撥單錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/transfers/:id/ship
 * 發貨（創建在途庫存，關聯批次號）
 * 嚴格遵守規則四第3、4點
 */
router.post('/:id/ship', [
  param('id').isInt(),
  body('ship_remark').optional().trim()
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

    const transferId = req.params.id;
    const { ship_remark } = req.body;
    const db = getDatabase();

    const transfer = db.prepare('SELECT * FROM transfer_orders WHERE id = ?').get(transferId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: '調撥單不存在'
      });
    }

    if (transfer.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: '只有已審批狀態的調撥單可以發貨'
      });
    }

    // 數據隔離
    if (!req.isSuperAdmin && transfer.from_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '只有發貨店可以執行發貨'
      });
    }

    db.transaction(() => {
      // 更新調撥單狀態
      db.prepare(`
        UPDATE transfer_orders 
        SET status = 'shipped', shipped_by = ?, shipped_at = datetime('now'), ship_remark = ?
        WHERE id = ?
      `).run(req.userId, ship_remark, transferId);

      // 獲取調撥明細
      const items = db.prepare('SELECT * FROM transfer_order_items WHERE transfer_id = ?').all(transferId);

      for (const item of items) {
        // 扣減發貨店庫存
        if (item.batch_type === 'product') {
          db.prepare('UPDATE product_batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?')
            .run(item.quantity, item.batch_id);
        } else {
          db.prepare('UPDATE material_batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?')
            .run(item.quantity, item.batch_id);
        }

        db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
          .run(item.quantity, item.product_id);

        // 創建在途庫存（關聯批次號）
        db.prepare(`
          INSERT INTO in_transit_inventory (
            transfer_id, transfer_no, product_id, batch_id, batch_type, batch_no,
            from_store_id, to_store_id, quantity, unit, unit_cost, total_cost,
            production_date, expiry_date, shipped_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'in_transit')
        `).run(
          transferId, transfer.transfer_no, item.product_id, item.batch_id, item.batch_type, item.batch_no,
          transfer.from_store_id, transfer.to_store_id, item.quantity, item.unit, item.unit_cost, item.total_cost,
          item.production_date, item.expiry_date
        );

        // 記錄發貨軌跡
        recordTransferTrace(db, transferId, item.batch_id, item.batch_type, item.batch_no,
          'ship', '發貨', transfer.from_store_id, transfer.to_store_id,
          req.userId, req.username, ship_remark);
      }
    })();

    logOperation(req.userId, req.username, 'transfers', 'ship', 'transfer_orders', transferId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '發貨成功，貨物已在途'
    });

  } catch (error) {
    console.error('發貨錯誤:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服務器錯誤'
    });
  }
});

/**
 * @POST /api/transfers/:id/receive
 * 收貨（更新在途庫存，增加收貨店批次庫存）
 * 嚴格遵守規則四第4點
 */
router.post('/:id/receive', [
  param('id').isInt(),
  body('receive_remark').optional().trim()
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

    const transferId = req.params.id;
    const { receive_remark } = req.body;
    const db = getDatabase();

    const transfer = db.prepare('SELECT * FROM transfer_orders WHERE id = ?').get(transferId);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: '調撥單不存在'
      });
    }

    if (transfer.status !== 'shipped') {
      return res.status(400).json({
        success: false,
        message: '只有已發貨狀態的調撥單可以收貨'
      });
    }

    // 數據隔離
    if (!req.isSuperAdmin && transfer.to_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '只有收貨店可以執行收貨'
      });
    }

    db.transaction(() => {
      // 更新調撥單狀態
      db.prepare(`
        UPDATE transfer_orders 
        SET status = 'completed', received_by = ?, received_at = datetime('now'), receive_remark = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(req.userId, receive_remark, transferId);

      // 獲取在途庫存
      const inTransitItems = db.prepare('SELECT * FROM in_transit_inventory WHERE transfer_id = ? AND status = "in_transit"').all(transferId);

      for (const item of inTransitItems) {
        // 更新在途庫存狀態
        db.prepare('UPDATE in_transit_inventory SET status = "received", received_at = datetime("now") WHERE id = ?')
          .run(item.id);

        // 增加收貨店庫存
        if (item.batch_type === 'product') {
          // 檢查收貨店是否已有該批次
          const existingBatch = db.prepare('SELECT id FROM product_batches WHERE batch_no = ? AND store_id = ?').get(item.batch_no, item.to_store_id);
          
          if (existingBatch) {
            // 更新現有批次
            db.prepare('UPDATE product_batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?')
              .run(item.quantity, existingBatch.id);
          } else {
            // 創建新批次（保留原批次號和效期信息）
            db.prepare(`
              INSERT INTO product_batches (
                batch_no, product_id, production_date, expiry_date, shelf_life_days,
                initial_quantity, remaining_quantity, unit, unit_cost, total_cost, store_id, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `).run(
              item.batch_no, item.product_id, item.production_date, item.expiry_date,
              Math.ceil((new Date(item.expiry_date) - new Date(item.production_date)) / (1000 * 60 * 60 * 24)),
              item.quantity, item.quantity, item.unit, item.unit_cost, item.total_cost, item.to_store_id
            );
          }
        } else {
          // 原料批次處理
          const existingBatch = db.prepare('SELECT id FROM material_batches WHERE batch_no = ? AND store_id = ?').get(item.batch_no, item.to_store_id);
          
          if (existingBatch) {
            db.prepare('UPDATE material_batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?')
              .run(item.quantity, existingBatch.id);
          } else {
            db.prepare(`
              INSERT INTO material_batches (
                batch_no, product_id, production_date, expiry_date,
                initial_quantity, remaining_quantity, unit, unit_cost, total_cost, store_id, received_at, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'active')
            `).run(
              item.batch_no, item.product_id, item.production_date, item.expiry_date,
              item.quantity, item.quantity, item.unit, item.unit_cost, item.total_cost, item.to_store_id
            );
          }
        }

        // 更新商品總庫存
        db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?')
          .run(item.quantity, item.product_id);

        // 記錄收貨軌跡
        recordTransferTrace(db, transferId, item.batch_id, item.batch_type, item.batch_no,
          'receive', '收貨完成', transfer.from_store_id, transfer.to_store_id,
          req.userId, req.username, receive_remark);

        // 記錄完成軌跡
        recordTransferTrace(db, transferId, item.batch_id, item.batch_type, item.batch_no,
          'complete', '調撥完成', transfer.from_store_id, transfer.to_store_id,
          req.userId, req.username, null);
      }
    })();

    logOperation(req.userId, req.username, 'transfers', 'receive', 'transfer_orders', transferId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '收貨成功，調撥完成'
    });

  } catch (error) {
    console.error('收貨錯誤:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服務器錯誤'
    });
  }
});

/**
 * @GET /api/transfers/in-transit
 * 獲取在途庫存列表
 */
router.get('/in-transit', [
  query('from_store_id').optional().isInt(),
  query('to_store_id').optional().isInt()
], (req, res) => {
  try {
    const db = getDatabase();
    const fromStoreId = req.query.from_store_id;
    const toStoreId = req.query.to_store_id;

    let conditions = ['iti.status = "in_transit"'];
    let params = [];

    // 數據隔離
    if (!req.isSuperAdmin) {
      conditions.push('(iti.from_store_id = ? OR iti.to_store_id = ?)');
      params.push(req.storeId, req.storeId);
    }

    if (fromStoreId) {
      conditions.push('iti.from_store_id = ?');
      params.push(fromStoreId);
    }

    if (toStoreId) {
      conditions.push('iti.to_store_id = ?');
      params.push(toStoreId);
    }

    const items = db.prepare(`
      SELECT 
        iti.*,
        p.sku, p.name as product_name, p.type as product_type,
        fs.name as from_store_name,
        ts.name as to_store_name,
        CASE 
          WHEN iti.expiry_date < date('now') THEN 'expired'
          WHEN iti.expiry_date <= date('now', '+1 day') AND p.type = 'finished' THEN 'critical'
          ELSE 'normal'
        END as expiry_status
      FROM in_transit_inventory iti
      JOIN products p ON iti.product_id = p.id
      JOIN stores fs ON iti.from_store_id = fs.id
      JOIN stores ts ON iti.to_store_id = ts.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY iti.shipped_at DESC
    `).all(...params);

    res.json({
      success: true,
      data: items
    });

  } catch (error) {
    console.error('獲取在途庫存錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;

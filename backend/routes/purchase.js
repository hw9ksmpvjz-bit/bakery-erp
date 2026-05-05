/**
 * 採購管理路由
 * 支援多級審批、分批入庫、獨立退貨
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase, transaction } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');
const { generateOrderNo } = require('../utils/helpers');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/purchase/orders
 * 獲取採購訂單列表
 */
router.get('/orders', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['draft', 'pending', 'approved', 'partial', 'completed', 'cancelled']),
  query('supplier_id').optional().isInt(),
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
    const supplierId = req.query.supplier_id;
    const storeId = req.query.store_id;

    // 構建查詢條件
    const conditions = ['1=1'];
    const params = [];

    // 數據隔離
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

    if (supplierId) {
      conditions.push('po.supplier_id = ?');
      params.push(supplierId);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM purchase_orders po
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const orders = db.prepare(`
      SELECT po.*,
             s.name as supplier_name, s.code as supplier_code,
             st.name as store_name,
             creator.real_name as creator_name,
             approver.real_name as approver_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN stores st ON po.store_id = st.id
      LEFT JOIN users creator ON po.created_by = creator.id
      LEFT JOIN users approver ON po.approved_by = approver.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: orders,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取採購訂單列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/purchase/orders/:id
 * 獲取採購訂單詳情
 */
router.get('/orders/:id', [
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

    const orderId = req.params.id;
    const db = getDatabase();

    // 訂單基本信息
    const order = db.prepare(`
      SELECT po.*,
             s.name as supplier_name, s.code as supplier_code, s.contact_person, s.phone,
             st.name as store_name,
             creator.real_name as creator_name,
             approver.real_name as approver_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN stores st ON po.store_id = st.id
      LEFT JOIN users creator ON po.created_by = creator.id
      LEFT JOIN users approver ON po.approved_by = approver.id
      WHERE po.id = ?
    `).get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && order.store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權查看此訂單'
      });
    }

    // 訂單明細
    const items = db.prepare(`
      SELECT poi.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.order_id = ?
    `).all(orderId);

    order.items = items;

    // 入庫記錄
    const receipts = db.prepare(`
      SELECT * FROM purchase_receipts
      WHERE order_id = ?
      ORDER BY created_at DESC
    `).all(orderId);

    order.receipts = receipts;

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('獲取採購訂單詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/purchase/orders
 * 創建採購訂單
 */
router.post('/orders', [
  body('supplier_id').isInt().withMessage('請選擇供應商'),
  body('store_id').isInt().withMessage('請選擇收貨分店'),
  body('order_date').isDate().withMessage('請選擇訂單日期'),
  body('items').isArray({ min: 1 }).withMessage('至少需要一個商品'),
  body('items.*.product_id').isInt(),
  body('items.*.quantity').isFloat({ min: 0.01 }),
  body('items.*.unit_price').isFloat({ min: 0 })
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

    const { supplier_id, store_id, order_date, delivery_date, remark, items } = req.body;
    const db = getDatabase();

    // 數據隔離檢查
    if (!req.isSuperAdmin && store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權為其他分店創建訂單'
      });
    }

    // 檢查供應商是否存在
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ? AND status = 1').get(supplier_id);
    if (!supplier) {
      return res.status(400).json({
        success: false,
        message: '供應商不存在'
      });
    }

    // 生成訂單編號
    const orderNo = generateOrderNo('PO');

    // 計算總額
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unit_price;
    }

    // 開始事務
    const result = db.transaction(() => {
      // 創建訂單
      const orderResult = db.prepare(`
        INSERT INTO purchase_orders (
          order_no, supplier_id, store_id, total_amount, order_date, delivery_date, remark, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)
      `).run(orderNo, supplier_id, store_id, totalAmount, order_date, delivery_date, remark, req.userId);

      const orderId = orderResult.lastInsertRowid;

      // 創建訂單明細
      const insertItem = db.prepare(`
        INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const totalPrice = item.quantity * item.unit_price;
        insertItem.run(orderId, item.product_id, item.quantity, item.unit_price, totalPrice);
      }

      return orderId;
    })();

    // 記錄操作日志
    logOperation(req.userId, req.username, 'purchase', 'create', 'purchase_orders', result, null, JSON.stringify({ order_no: orderNo, supplier_id, total_amount: totalAmount }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '採購訂單創建成功',
      data: { id: result, order_no: orderNo }
    });

  } catch (error) {
    console.error('創建採購訂單錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/purchase/orders/:id/submit
 * 提交審批
 */
router.post('/orders/:id/submit', [
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

    const orderId = req.params.id;
    const db = getDatabase();

    // 檢查訂單
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && order.store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權操作此訂單'
      });
    }

    // 檢查狀態
    if (order.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: '只有草稿狀態的訂單可以提交審批'
      });
    }

    // 更新狀態為待審批
    db.prepare("UPDATE purchase_orders SET status = 'pending' WHERE id = ?").run(orderId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'purchase', 'submit', 'purchase_orders', orderId, JSON.stringify({ status: order.status }), JSON.stringify({ status: 'pending' }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '訂單已提交審批'
    });

  } catch (error) {
    console.error('提交審批錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/purchase/orders/:id/approve
 * 審批訂單
 */
router.post('/orders/:id/approve', [
  param('id').isInt(),
  body('action').isIn(['approve', 'reject']).withMessage('請選擇審批動作'),
  body('comment').optional().trim()
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
    const { action, comment } = req.body;
    const db = getDatabase();

    // 檢查訂單
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在'
      });
    }

    // 檢查狀態
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '只有待審批狀態的訂單可以審批'
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'draft';

    db.prepare(`
      UPDATE purchase_orders 
      SET status = ?, approved_by = ?, approved_at = datetime('now'), remark = COALESCE(?, remark)
      WHERE id = ?
    `).run(newStatus, req.userId, comment, orderId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'purchase', action, 'purchase_orders', orderId, JSON.stringify({ status: order.status }), JSON.stringify({ status: newStatus }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: action === 'approve' ? '訂單已審批通過' : '訂單已駁回'
    });

  } catch (error) {
    console.error('審批訂單錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/purchase/orders/:id/receive
 * 入庫（支援分批入庫）
 */
router.post('/orders/:id/receive', [
  param('id').isInt(),
  body('items').isArray({ min: 1 }).withMessage('至少需要一個入庫商品'),
  body('items.*.item_id').isInt(),
  body('items.*.quantity').isFloat({ min: 0.01 }),
  body('items.*.actual_price').optional().isFloat({ min: 0 }),
  body('batch_no').optional().trim()
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
    const { items, batch_no, production_date, expiry_date, remark } = req.body;
    const db = getDatabase();

    // 檢查訂單
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '訂單不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && order.store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權操作此訂單'
      });
    }

    // 檢查狀態
    if (!['approved', 'partial'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: '只有已審批或部分入庫狀態的訂單可以入庫'
      });
    }

    // 開始事務
    const result = db.transaction(() => {
      // 創建入庫記錄
      const receiptNo = generateOrderNo('RC');
      const receiptResult = db.prepare(`
        INSERT INTO purchase_receipts (receipt_no, order_id, batch_no, received_by, remark)
        VALUES (?, ?, ?, ?, ?)
      `).run(receiptNo, orderId, batch_no, req.userId, remark);

      const receiptId = receiptResult.lastInsertRowid;

      let totalReceivedAmount = 0;

      // 處理每個入庫商品
      for (const item of items) {
        // 獲取訂單明細
        const orderItem = db.prepare('SELECT * FROM purchase_order_items WHERE id = ? AND order_id = ?').get(item.item_id, orderId);
        if (!orderItem) {
          throw new Error(`訂單明細 ${item.item_id} 不存在`);
        }

        // 檢查是否超量
        const wouldExceed = orderItem.received_quantity + item.quantity > orderItem.quantity;
        if (wouldExceed) {
          throw new Error(`商品 ${orderItem.product_id} 入庫數量超過訂單數量`);
        }

        // 使用實際入庫價格（如果提供）
        const actualPrice = item.actual_price || orderItem.unit_price;
        const itemTotal = item.quantity * actualPrice;
        totalReceivedAmount += itemTotal;

        // 更新訂單明細的已收數量
        db.prepare(`
          UPDATE purchase_order_items 
          SET received_quantity = received_quantity + ?, 
              unit_price = ?,
              total_price = quantity * ?
          WHERE id = ?
        `).run(item.quantity, actualPrice, actualPrice, item.item_id);

        // 創建原料批次（FIFO）
        const materialBatchNo = batch_no || `${receiptNo}-${item.item_id}`;
        db.prepare(`
          INSERT INTO material_batches (
            batch_no, product_id, supplier_id, purchase_order_id,
            initial_quantity, remaining_quantity, unit,
            unit_cost, total_cost, production_date, expiry_date, received_at, store_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).run(
          materialBatchNo,
          orderItem.product_id,
          order.supplier_id,
          orderId,
          item.quantity,
          item.quantity,
          'kg', // 需要根據實際單位調整
          actualPrice,
          itemTotal,
          production_date,
          expiry_date,
          order.store_id
        );

        // 更新商品庫存
        db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, orderItem.product_id);

        // 記錄庫存變動
        db.prepare(`
          INSERT INTO inventory_logs (
            product_id, store_id, batch_no, type, quantity,
            before_quantity, after_quantity, unit_cost, total_cost,
            reference_type, reference_id, reference_no, operator_id, remark
          ) VALUES (?, ?, ?, 'purchase_in', ?, 
                    (SELECT stock_quantity - ? FROM products WHERE id = ?),
                    (SELECT stock_quantity FROM products WHERE id = ?),
                    ?, ?, 'purchase_order', ?, ?, ?, ?)
        `).run(
          orderItem.product_id, order.store_id, materialBatchNo, item.quantity,
          item.quantity, orderItem.product_id, orderItem.product_id,
          actualPrice, itemTotal, orderId, order.order_no, req.userId, remark
        );
      }

      // 更新訂單狀態
      const allItems = db.prepare('SELECT quantity, received_quantity FROM purchase_order_items WHERE order_id = ?').all(orderId);
      const allReceived = allItems.every(item => item.received_quantity >= item.quantity);
      const anyReceived = allItems.some(item => item.received_quantity > 0);

      let newStatus = order.status;
      if (allReceived) {
        newStatus = 'completed';
      } else if (anyReceived) {
        newStatus = 'partial';
      }

      if (newStatus !== order.status) {
        db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(newStatus, orderId);
      }

      return { receiptId, receiptNo, newStatus };
    })();

    // 記錄操作日志
    logOperation(req.userId, req.username, 'purchase', 'receive', 'purchase_orders', orderId, JSON.stringify({ status: order.status }), JSON.stringify({ status: result.newStatus }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '入庫成功',
      data: {
        receipt_id: result.receiptId,
        receipt_no: result.receiptNo,
        new_status: result.newStatus
      }
    });

  } catch (error) {
    console.error('入庫錯誤:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服務器錯誤'
    });
  }
});

module.exports = router;

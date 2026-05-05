/**
 * 銷售管理路由
 * 支援：多支付、會員積分、退貨審批、反結帳
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
 * FIFO 出庫輔助函數（成品）
 */
function fifoWithdrawProduct(db, productId, storeId, requiredQuantity) {
  const batches = db.prepare(`
    SELECT * FROM product_batches 
    WHERE product_id = ? AND store_id = ? AND status = 'active' AND remaining_quantity > 0
    ORDER BY production_date ASC
  `).all(productId, storeId);

  let remainingToWithdraw = requiredQuantity;
  const withdrawals = [];

  for (const batch of batches) {
    if (remainingToWithdraw <= 0) break;

    const withdrawQuantity = Math.min(remainingToWithdraw, batch.remaining_quantity);
    remainingToWithdraw -= withdrawQuantity;

    db.prepare('UPDATE product_batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?')
      .run(withdrawQuantity, batch.id);

    if (batch.remaining_quantity - withdrawQuantity <= 0) {
      db.prepare("UPDATE product_batches SET status = 'sold_out' WHERE id = ?").run(batch.id);
    }

    withdrawals.push({
      batch_id: batch.id,
      batch_no: batch.batch_no,
      quantity: withdrawQuantity,
      unit_cost: batch.unit_cost,
      production_date: batch.production_date,
      expiry_date: batch.expiry_date
    });
  }

  if (remainingToWithdraw > 0) {
    throw new Error(`商品庫存不足，還差 ${remainingToWithdraw}`);
  }

  return withdrawals;
}

/**
 * 獲取當前積分規則
 */
function getPointsRule(db) {
  return db.prepare('SELECT * FROM points_rules WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
}

/**
 * 計算積分
 */
function calculatePoints(rule, amount, memberLevel = 1) {
  if (!rule) return 0;
  
  const basePoints = Math.floor(amount / rule.consume_amount) * rule.points_earned;
  const multiplier = rule[`level_${memberLevel}_multiplier`] || 1;
  return Math.floor(basePoints * multiplier);
}

/**
 * @GET /api/sales/orders
 * 獲取銷售訂單列表
 */
router.get('/orders', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('store_id').optional().isInt(),
  query('member_id').optional().isInt(),
  query('date').optional().isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const storeId = req.query.store_id;
    const memberId = req.query.member_id;
    const date = req.query.date;

    const conditions = ['1=1'];
    const params = [];

    if (!req.isSuperAdmin) {
      conditions.push('so.store_id = ?');
      params.push(req.storeId);
    } else if (storeId) {
      conditions.push('so.store_id = ?');
      params.push(storeId);
    }

    if (memberId) {
      conditions.push('so.member_id = ?');
      params.push(memberId);
    }

    if (date) {
      conditions.push('DATE(so.created_at) = ?');
      params.push(date);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM sales_orders so WHERE ${conditions.join(' AND ')}`).get(...params);

    const offset = (page - 1) * pageSize;
    const orders = db.prepare(`
      SELECT so.*, 
             s.name as store_name,
             m.card_no as member_card_no,
             m.name as member_name,
             creator.real_name as creator_name
      FROM sales_orders so
      JOIN stores s ON so.store_id = s.id
      LEFT JOIN members m ON so.member_id = m.id
      LEFT JOIN users creator ON so.created_by = creator.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY so.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    // 獲取每個訂單的支付方式
    for (const order of orders) {
      const payments = db.prepare('SELECT * FROM sales_payments WHERE order_id = ?').all(order.id);
      order.payments = payments;
    }

    res.json({
      success: true,
      data: {
        list: orders,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });

  } catch (error) {
    console.error('獲取銷售訂單列表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/sales/orders
 * 創建銷售訂單（POS開單）
 */
router.post('/orders', [
  body('store_id').isInt(),
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt(),
  body('items.*.quantity').isFloat({ min: 0.01 }),
  body('payments').isArray({ min: 1 }),
  body('payments.*.method').notEmpty(),
  body('payments.*.amount').isFloat({ min: 0 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { store_id, member_id, items, payments, points_to_use = 0, remark } = req.body;
    const db = getDatabase();

    // 數據隔離
    if (!req.isSuperAdmin && store_id !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權在其他分店開單' });
    }

    const result = db.transaction(() => {
      // 計算商品總額
      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) throw new Error(`商品 ${item.product_id} 不存在`);

        const unitPrice = item.unit_price || product.retail_price;
        const itemTotal = unitPrice * item.quantity;
        totalAmount += itemTotal;

        // FIFO出庫
        const withdrawals = fifoWithdrawProduct(db, item.product_id, store_id, item.quantity);

        processedItems.push({
          ...item,
          product,
          unit_price: unitPrice,
          total_price: itemTotal,
          unit_cost: withdrawals[0]?.unit_cost || 0,
          withdrawals
        });
      }

      // 處理會員積分
      let pointsEarned = 0;
      let pointsDeduction = 0;
      let memberDiscount = 0;

      if (member_id) {
        const member = db.prepare('SELECT * FROM members WHERE id = ?').get(member_id);
        if (member) {
          const pointsRule = getPointsRule(db);
          pointsEarned = calculatePoints(pointsRule, totalAmount, member.level);

          // 積分抵扣
          if (points_to_use > 0) {
            if (member.points < points_to_use) {
              throw new Error('會員積分不足');
            }
            const pointsRule = getPointsRule(db);
            pointsDeduction = (points_to_use / pointsRule.points_needed) * pointsRule.deduct_amount;
            
            // 扣減會員積分
            db.prepare('UPDATE members SET points = points - ?, balance = balance - ? WHERE id = ?')
              .run(points_to_use, pointsDeduction, member_id);
          }

          // 會員價折扣
          memberDiscount = processedItems.reduce((sum, item) => {
            const memberPrice = item.product.member_price || item.product.retail_price;
            return sum + (item.product.retail_price - memberPrice) * item.quantity;
          }, 0);

          // 增加會員積分
          db.prepare('UPDATE members SET points = points + ?, total_consumption = total_consumption + ?, order_count = order_count + 1, last_consumption_at = datetime("now") WHERE id = ?')
            .run(pointsEarned, totalAmount, member_id);
        }
      }

      // 計算實收金額
      const actualAmount = totalAmount - memberDiscount - pointsDeduction;

      // 驗證支付金額
      const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(totalPayment - actualAmount) > 0.01) {
        throw new Error('支付金額與訂單金額不符');
      }

      // 創建訂單
      const orderNo = generateOrderNo('SO');
      const orderResult = db.prepare(`
        INSERT INTO sales_orders (
          order_no, store_id, member_id, total_amount, discount_amount, member_discount, points_deduction,
          actual_amount, points_earned, points_used, status, order_date, completed_at, created_by, remark
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'completed', date('now'), datetime('now'), ?, ?)
      `).run(orderNo, store_id, member_id, totalAmount, memberDiscount, pointsDeduction,
        actualAmount, pointsEarned, points_to_use, req.userId, remark);

      const orderId = orderResult.lastInsertRowid;

      // 創建訂單明細
      for (const item of processedItems) {
        for (const withdraw of item.withdrawals) {
          db.prepare(`
            INSERT INTO sales_order_items (
              order_id, product_id, batch_id, batch_no, quantity, unit_price, original_price, total_price, unit_cost
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(orderId, item.product_id, withdraw.batch_id, withdraw.batch_no,
            withdraw.quantity, item.unit_price, item.product.retail_price, 
            item.unit_price * withdraw.quantity, withdraw.unit_cost);

          // 更新商品總庫存
          db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
            .run(withdraw.quantity, item.product_id);
        }
      }

      // 創建支付明細
      for (const payment of payments) {
        const method = db.prepare('SELECT * FROM payment_methods WHERE code = ? AND is_active = 1').get(payment.method);
        db.prepare(`
          INSERT INTO sales_payments (order_id, payment_method, payment_method_name, amount, transaction_no)
          VALUES (?, ?, ?, ?, ?)
        `).run(orderId, payment.method, method?.name || payment.method, payment.amount, payment.transaction_no);
      }

      return { orderId, orderNo, totalAmount, actualAmount, pointsEarned };
    })();

    logOperation(req.userId, req.username, 'sales', 'create', 'sales_orders', result.orderId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '銷售訂單創建成功',
      data: {
        order_no: result.orderNo,
        total_amount: result.totalAmount,
        actual_amount: result.actualAmount,
        points_earned: result.pointsEarned
      }
    });

  } catch (error) {
    console.error('創建銷售訂單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

/**
 * @POST /api/sales/returns
 * 創建退貨單
 */
router.post('/returns', [
  body('order_id').isInt(),
  body('items').isArray({ min: 1 }),
  body('items.*.order_item_id').isInt(),
  body('items.*.quantity').isFloat({ min: 0.01 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { order_id, items, reason } = req.body;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: '訂單不存在' });
    }

    // 判斷退貨類型
    const orderDate = new Date(order.order_date);
    const today = new Date();
    const diffDays = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

    let returnType = 'same_day';
    let requiresApproval = false;
    let requiresUnsettlement = false;

    if (diffDays === 0 && !order.is_settled) {
      returnType = 'same_day';
    } else if (diffDays === 1 && !order.is_settled) {
      returnType = 'next_day';
      requiresApproval = true;
    } else {
      returnType = 'after_settlement';
      requiresApproval = true;
      requiresUnsettlement = order.is_settled ? 1 : 0;
    }

    const result = db.transaction(() => {
      const returnNo = generateOrderNo('SR');

      // 計算退貨金額
      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const orderItem = db.prepare('SELECT * FROM sales_order_items WHERE id = ? AND order_id = ?').get(item.order_item_id, order_id);
        if (!orderItem) throw new Error('訂單明細不存在');

        const canRefund = orderItem.quantity - orderItem.refunded_quantity;
        if (item.quantity > canRefund) {
          throw new Error(`退貨數量超過可退數量，最多可退 ${canRefund}`);
        }

        const itemAmount = orderItem.unit_price * item.quantity;
        totalAmount += itemAmount;

        processedItems.push({ ...item, orderItem, itemAmount });
      }

      // 創建退貨單
      const status = requiresApproval ? 'pending' : 'completed';
      const returnResult = db.prepare(`
        INSERT INTO sales_returns (
          return_no, order_id, total_amount, status, return_type, 
          requires_unsettlement, created_by, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(returnNo, order_id, totalAmount, status, returnType, requiresUnsettlement, req.userId, reason);

      const returnId = returnResult.lastInsertRowid;

      // 創建退貨明細
      for (const item of processedItems) {
        db.prepare(`
          INSERT INTO sales_return_items (return_id, order_item_id, product_id, quantity, unit_price, total_amount, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(returnId, item.order_item_id, item.orderItem.product_id, item.quantity, item.orderItem.unit_price, item.itemAmount, reason);
      }

      // 如果是當日退貨，立即處理
      if (returnType === 'same_day') {
        processReturn(db, returnId, order, processedItems, req.userId);
      }

      return { returnId, returnNo, returnType, requiresApproval, totalAmount };
    })();

    logOperation(req.userId, req.username, 'sales', 'create_return', 'sales_returns', result.returnId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: result.requiresApproval ? '退貨單創建成功，等待審批' : '退貨單創建成功，已處理',
      data: {
        return_no: result.returnNo,
        return_type: result.returnType,
        requires_approval: result.requiresApproval,
        total_amount: result.totalAmount
      }
    });

  } catch (error) {
    console.error('創建退貨單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

/**
 * 處理退貨（退庫存、退款、退積分）
 */
function processReturn(db, returnId, order, items, operatorId) {
  const returnRecord = db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(returnId);

  // 更新退貨單狀態
  db.prepare('UPDATE sales_returns SET status = "completed", completed_at = datetime("now") WHERE id = ?').run(returnId);

  // 處理每個退貨項目
  for (const item of items) {
    // 更新訂單明細退貨數量
    db.prepare('UPDATE sales_order_items SET refunded_quantity = refunded_quantity + ?, is_refunded = 1 WHERE id = ?')
      .run(item.quantity, item.order_item_id);

    // 退庫存（這裡簡化處理，實際應創建新的批次）
    db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?')
      .run(item.quantity, item.orderItem.product_id);
  }

  // 更新訂單狀態
  const allItems = db.prepare('SELECT quantity, refunded_quantity FROM sales_order_items WHERE order_id = ?').all(order.id);
  const allRefunded = allItems.every(i => i.refunded_quantity >= i.quantity);
  const partialRefunded = allItems.some(i => i.refunded_quantity > 0);

  let newStatus = order.status;
  if (allRefunded) {
    newStatus = 'refunded';
  } else if (partialRefunded) {
    newStatus = 'partial_refunded';
  }

  if (newStatus !== order.status) {
    db.prepare('UPDATE sales_orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  }

  // 退還會員積分
  if (order.member_id && order.points_earned > 0) {
    const refundPoints = Math.floor(order.points_earned * (returnRecord.total_amount / order.total_amount));
    db.prepare('UPDATE members SET points = points - ? WHERE id = ?').run(refundPoints, order.member_id);
  }
}

/**
 * @POST /api/sales/returns/:id/approve
 * 審批退貨單（次日退貨）
 */
router.post('/returns/:id/approve', [
  param('id').isInt(),
  body('action').isIn(['approve', 'reject'])
], (req, res) => {
  try {
    const returnId = req.params.id;
    const { action } = req.body;
    const db = getDatabase();

    const returnRecord = db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(returnId);
    if (!returnRecord) {
      return res.status(404).json({ success: false, message: '退貨單不存在' });
    }

    if (returnRecord.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只有待審批狀態可審批' });
    }

    const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(returnRecord.order_id);

    if (action === 'approve') {
      // 檢查是否需要反結帳審批
      if (returnRecord.requires_unsettlement && !returnRecord.unsettlement_approved) {
        return res.status(400).json({ 
          success: false, 
          message: '該退貨需要反結帳，請先申請反結帳審批',
          requires_unsettlement: true
        });
      }

      const items = db.prepare('SELECT * FROM sales_return_items WHERE return_id = ?').all(returnId);
      const processedItems = items.map(item => ({
        ...item,
        orderItem: db.prepare('SELECT * FROM sales_order_items WHERE id = ?').get(item.order_item_id)
      }));

      processReturn(db, returnId, order, processedItems, req.userId);

      db.prepare('UPDATE sales_returns SET approved_by = ?, approved_at = datetime("now") WHERE id = ?')
        .run(req.userId, returnId);

      res.json({ success: true, message: '退貨單已審批通過，退貨處理完成' });
    } else {
      db.prepare('UPDATE sales_returns SET status = "cancelled" WHERE id = ?').run(returnId);
      res.json({ success: true, message: '退貨單已駁回' });
    }

  } catch (error) {
    console.error('審批退貨單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

module.exports = router;

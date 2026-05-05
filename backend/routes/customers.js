/**
 * 客戶/會員管理路由
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken, requireStoreAccess } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/customers
 * 獲取客戶/會員列表
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('keyword').optional().trim(),
  query('type').optional().isIn(['wholesale', 'retail', 'vip']),
  query('status').optional().isIn(['0', '1']),
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
    const keyword = req.query.keyword;
    const type = req.query.type;
    const status = req.query.status;
    const storeId = req.query.store_id;

    // 構建查詢條件
    const conditions = ['1=1'];
    const params = [];

    // 數據隔離：非超級管理員只能查看本店客戶
    if (!req.isSuperAdmin) {
      conditions.push('(source_store_id = ? OR ? IS NULL)');
      params.push(req.storeId, req.storeId);
    } else if (storeId) {
      conditions.push('source_store_id = ?');
      params.push(storeId);
    }

    if (keyword) {
      conditions.push('(code LIKE ? OR name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (status !== undefined) {
      conditions.push('status = ?');
      params.push(status);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM customers
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const customers = db.prepare(`
      SELECT c.*, s.name as source_store_name
      FROM customers c
      LEFT JOIN stores s ON c.source_store_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: customers,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取客戶列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/customers/:id
 * 獲取客戶詳情
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

    const customerId = req.params.id;
    const db = getDatabase();

    const customer = db.prepare(`
      SELECT c.*, s.name as source_store_name
      FROM customers c
      LEFT JOIN stores s ON c.source_store_id = s.id
      WHERE c.id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: '客戶不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && customer.source_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權查看此客戶'
      });
    }

    // 獲取交易統計
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN actual_amount ELSE 0 END), 0) as total_amount,
        COALESCE(SUM(CASE WHEN payment_status != 'paid' THEN actual_amount - paid_amount ELSE 0 END), 0) as unpaid_amount,
        MAX(order_date) as last_order_date
      FROM sales_orders
      WHERE customer_id = ?
    `).get(customerId);

    customer.statistics = stats;

    // 獲取最近訂單
    const recentOrders = db.prepare(`
      SELECT id, order_no, order_date, actual_amount, payment_status, status
      FROM sales_orders
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(customerId);

    customer.recent_orders = recentOrders;

    res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('獲取客戶詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/customers
 * 創建客戶
 */
router.post('/', [
  body('code').trim().notEmpty().withMessage('客戶編號不能為空'),
  body('name').trim().notEmpty().withMessage('客戶名稱不能為空'),
  body('type').isIn(['wholesale', 'retail', 'vip']).withMessage('請選擇客戶類型'),
  body('phone').optional().trim(),
  body('credit_limit').optional().isFloat({ min: 0 }),
  body('source_store_id').optional().isInt()
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

    const {
      code, name, type, contact_person, phone, email, address,
      credit_limit, remark, source_store_id
    } = req.body;

    const db = getDatabase();

    // 檢查編號是否已存在
    const existing = db.prepare('SELECT id FROM customers WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '客戶編號已存在'
      });
    }

    // 數據隔離：非超級管理員只能為本店創建
    const finalStoreId = req.isSuperAdmin ? (source_store_id || req.storeId) : req.storeId;

    const result = db.prepare(`
      INSERT INTO customers (
        code, name, type, contact_person, phone, email, address,
        credit_limit, remark, source_store_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code, name, type, contact_person, phone, email, address,
      credit_limit || 0, remark, finalStoreId
    );

    // 記錄操作日志
    logOperation(req.userId, req.username, 'customers', 'create', 'customers', result.lastInsertRowid, null, JSON.stringify({ code, name, type }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '客戶創建成功',
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('創建客戶錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @PUT /api/customers/:id
 * 更新客戶
 */
router.put('/:id', [
  param('id').isInt(),
  body('name').optional().trim(),
  body('type').optional().isIn(['wholesale', 'retail', 'vip']),
  body('credit_limit').optional().isFloat({ min: 0 }),
  body('status').optional().isIn([0, 1])
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

    const customerId = req.params.id;
    const updateData = req.body;
    const db = getDatabase();

    // 檢查客戶是否存在
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '客戶不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && existing.source_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權更新此客戶'
      });
    }

    // 構建更新字段
    const allowedFields = [
      'name', 'type', 'contact_person', 'phone', 'email', 'address',
      'credit_limit', 'remark', 'status'
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的字段'
      });
    }

    params.push(customerId);

    db.prepare(`
      UPDATE customers SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'customers', 'update', 'customers', customerId, JSON.stringify(existing), JSON.stringify(updateData), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '客戶更新成功'
    });

  } catch (error) {
    console.error('更新客戶錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @DELETE /api/customers/:id
 * 刪除客戶（軟刪除）
 */
router.delete('/:id', [
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

    const customerId = req.params.id;
    const db = getDatabase();

    // 檢查客戶是否存在
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '客戶不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && existing.source_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權刪除此客戶'
      });
    }

    // 檢查是否有未完成的訂單
    const hasPendingOrders = db.prepare(
      "SELECT COUNT(*) as count FROM sales_orders WHERE customer_id = ? AND status IN ('draft', 'pending', 'approved')"
    ).get(customerId);

    if (hasPendingOrders.count > 0) {
      return res.status(400).json({
        success: false,
        message: '該客戶還有未完成的訂單，不能刪除'
      });
    }

    // 檢查是否有欠款
    if (existing.balance < 0) {
      return res.status(400).json({
        success: false,
        message: '該客戶還有欠款，不能刪除'
      });
    }

    // 軟刪除
    db.prepare('UPDATE customers SET status = 0 WHERE id = ?').run(customerId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'customers', 'delete', 'customers', customerId, JSON.stringify(existing), null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '客戶已禁用'
    });

  } catch (error) {
    console.error('刪除客戶錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

// ============================================
// 會員管理路由
// ============================================

/**
 * @GET /api/members
 * 獲取會員列表
 */
router.get('/members', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('keyword').optional().trim(),
  query('level').optional().isInt(),
  query('store_id').optional().isInt()
], (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const keyword = req.query.keyword;
    const level = req.query.level;
    const storeId = req.query.store_id;

    // 構建查詢條件
    const conditions = ['1=1'];
    const params = [];

    // 數據隔離
    if (!req.isSuperAdmin) {
      conditions.push('(m.source_store_id = ? OR ? IS NULL)');
      params.push(req.storeId, req.storeId);
    } else if (storeId) {
      conditions.push('m.source_store_id = ?');
      params.push(storeId);
    }

    if (keyword) {
      conditions.push('(m.card_no LIKE ? OR m.name LIKE ? OR m.phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (level) {
      conditions.push('m.level = ?');
      params.push(level);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM members m
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const members = db.prepare(`
      SELECT m.*, s.name as source_store_name
      FROM members m
      LEFT JOIN stores s ON m.source_store_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: members,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取會員列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/members
 * 創建會員
 */
router.post('/members', [
  body('card_no').trim().notEmpty().withMessage('會員卡號不能為空'),
  body('name').trim().notEmpty().withMessage('會員名稱不能為空'),
  body('phone').trim().notEmpty().withMessage('手機號不能為空'),
  body('level').optional().isInt({ min: 1 }),
  body('source_store_id').optional().isInt()
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

    const {
      card_no, name, phone, email, birthday, gender,
      level, referrer_id, remark, source_store_id
    } = req.body;

    const db = getDatabase();

    // 檢查卡號是否已存在
    const existing = db.prepare('SELECT id FROM members WHERE card_no = ?').get(card_no);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '會員卡號已存在'
      });
    }

    // 檢查手機號是否已存在
    const existingPhone = db.prepare('SELECT id FROM members WHERE phone = ?').get(phone);
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: '手機號已註冊'
      });
    }

    // 數據隔離
    const finalStoreId = req.isSuperAdmin ? (source_store_id || req.storeId) : req.storeId;

    const result = db.prepare(`
      INSERT INTO members (
        card_no, name, phone, email, birthday, gender,
        level, referrer_id, remark, source_store_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      card_no, name, phone, email, birthday, gender,
      level || 1, referrer_id, remark, finalStoreId
    );

    // 記錄操作日志
    logOperation(req.userId, req.username, 'members', 'create', 'members', result.lastInsertRowid, null, JSON.stringify({ card_no, name, phone }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '會員創建成功',
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('創建會員錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/members/:id/recharge
 * 會員儲值
 */
router.post('/members/:id/recharge', [
  param('id').isInt(),
  body('amount').isFloat({ min: 0.01 }).withMessage('儲值金額必須大於0'),
  body('payment_method').isIn(['cash', 'wechat', 'alipay', 'card']).withMessage('請選擇支付方式')
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

    const memberId = req.params.id;
    const { amount, payment_method, remark } = req.body;
    const db = getDatabase();

    // 檢查會員是否存在
    const member = db.prepare('SELECT * FROM members WHERE id = ? AND status = 1').get(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: '會員不存在'
      });
    }

    // 數據隔離檢查
    if (!req.isSuperAdmin && member.source_store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權操作此會員'
      });
    }

    // 更新餘額
    const newBalance = member.balance + amount;
    db.prepare('UPDATE members SET balance = ? WHERE id = ?').run(newBalance, memberId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'members', 'recharge', 'members', memberId, JSON.stringify({ balance: member.balance }), JSON.stringify({ balance: newBalance, amount }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '儲值成功',
      data: {
        member_id: memberId,
        amount: amount,
        balance_before: member.balance,
        balance_after: newBalance
      }
    });

  } catch (error) {
    console.error('會員儲值錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;

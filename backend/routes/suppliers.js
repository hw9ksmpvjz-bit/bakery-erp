/**
 * 供應商管理路由
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/suppliers
 * 獲取供應商列表
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('keyword').optional().trim(),
  query('status').optional().isIn(['0', '1']),
  query('credit_level').optional().isInt({ min: 1, max: 5 })
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
    const status = req.query.status;
    const creditLevel = req.query.credit_level;

    // 構建查詢條件
    const conditions = ['1=1'];
    const params = [];

    if (keyword) {
      conditions.push('(code LIKE ? OR name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (status !== undefined) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (creditLevel) {
      conditions.push('credit_level = ?');
      params.push(creditLevel);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM suppliers
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const suppliers = db.prepare(`
      SELECT s.*,
             (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = s.id) as order_count,
             (SELECT COALESCE(SUM(actual_amount), 0) FROM purchase_orders WHERE supplier_id = s.id AND status = 'completed') as total_purchase_amount
      FROM suppliers s
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: suppliers,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取供應商列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/suppliers/:id
 * 獲取供應商詳情
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

    const supplierId = req.params.id;
    const db = getDatabase();

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: '供應商不存在'
      });
    }

    // 獲取交易統計
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN actual_amount ELSE 0 END), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as original_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders
      FROM purchase_orders
      WHERE supplier_id = ?
    `).get(supplierId);

    supplier.statistics = stats;

    // 獲取最近交易
    const recentOrders = db.prepare(`
      SELECT id, order_no, order_date, actual_amount, status
      FROM purchase_orders
      WHERE supplier_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(supplierId);

    supplier.recent_orders = recentOrders;

    res.json({
      success: true,
      data: supplier
    });

  } catch (error) {
    console.error('獲取供應商詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/suppliers
 * 創建供應商
 */
router.post('/', [
  body('code').trim().notEmpty().withMessage('供應商編號不能為空'),
  body('name').trim().notEmpty().withMessage('供應商名稱不能為空'),
  body('contact_person').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail(),
  body('credit_level').optional().isInt({ min: 1, max: 5 })
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
      code, name, contact_person, phone, email, address,
      tax_no, bank_name, bank_account, credit_level, remark
    } = req.body;

    const db = getDatabase();

    // 檢查編號是否已存在
    const existing = db.prepare('SELECT id FROM suppliers WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '供應商編號已存在'
      });
    }

    const result = db.prepare(`
      INSERT INTO suppliers (
        code, name, contact_person, phone, email, address,
        tax_no, bank_name, bank_account, credit_level, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code, name, contact_person, phone, email, address,
      tax_no, bank_name, bank_account, credit_level || 3, remark
    );

    // 記錄操作日志
    logOperation(req.userId, req.username, 'suppliers', 'create', 'suppliers', result.lastInsertRowid, null, JSON.stringify({ code, name }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '供應商創建成功',
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('創建供應商錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @PUT /api/suppliers/:id
 * 更新供應商
 */
router.put('/:id', [
  param('id').isInt(),
  body('name').optional().trim(),
  body('email').optional().isEmail(),
  body('credit_level').optional().isInt({ min: 1, max: 5 }),
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

    const supplierId = req.params.id;
    const updateData = req.body;
    const db = getDatabase();

    // 檢查供應商是否存在
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '供應商不存在'
      });
    }

    // 構建更新字段
    const allowedFields = [
      'name', 'contact_person', 'phone', 'email', 'address',
      'tax_no', 'bank_name', 'bank_account', 'credit_level', 'remark', 'status'
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

    params.push(supplierId);

    db.prepare(`
      UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'suppliers', 'update', 'suppliers', supplierId, JSON.stringify(existing), JSON.stringify(updateData), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '供應商更新成功'
    });

  } catch (error) {
    console.error('更新供應商錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @DELETE /api/suppliers/:id
 * 刪除供應商（軟刪除）
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

    const supplierId = req.params.id;
    const db = getDatabase();

    // 檢查供應商是否存在
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '供應商不存在'
      });
    }

    // 檢查是否有未完成的採購訂單
    const hasPendingOrders = db.prepare(
      "SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ? AND status IN ('draft', 'pending', 'approved')"
    ).get(supplierId);

    if (hasPendingOrders.count > 0) {
      return res.status(400).json({
        success: false,
        message: '該供應商還有未完成的採購訂單，不能刪除'
      });
    }

    // 軟刪除
    db.prepare('UPDATE suppliers SET status = 0 WHERE id = ?').run(supplierId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'suppliers', 'delete', 'suppliers', supplierId, JSON.stringify(existing), null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '供應商已禁用'
    });

  } catch (error) {
    console.error('刪除供應商錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;

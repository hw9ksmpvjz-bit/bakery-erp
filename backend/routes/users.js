/**
 * 用戶管理路由
 * 僅超級管理員和總部管理員可訪問
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken, requirePermission, requireStoreAccess } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

// 所有路由需要認證
router.use(authenticateToken);

/**
 * @GET /api/users
 * 獲取用戶列表
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('keyword').optional().trim(),
  query('role_id').optional().isInt(),
  query('store_id').optional().isInt(),
  query('status').optional().isIn(['0', '1', '2'])
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
    const roleId = req.query.role_id;
    const storeId = req.query.store_id;
    const status = req.query.status;

    // 構建查詢條件
    const conditions = ['1=1'];
    const params = [];

    // 非超級管理員只能查看本店用戶
    if (!req.isSuperAdmin && req.storeId) {
      conditions.push('u.store_id = ?');
      params.push(req.storeId);
    }

    if (keyword) {
      conditions.push('(u.username LIKE ? OR u.real_name LIKE ? OR u.phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (roleId) {
      conditions.push('u.role_id = ?');
      params.push(roleId);
    }

    if (storeId) {
      conditions.push('u.store_id = ?');
      params.push(storeId);
    }

    if (status !== undefined) {
      conditions.push('u.status = ?');
      params.push(status);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM users u
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const users = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.phone, u.email, u.avatar,
             u.status, u.last_login_at, u.last_login_ip, u.created_at,
             r.id as role_id, r.name as role_name, r.code as role_code,
             s.id as store_id, s.name as store_name, s.type as store_type
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN stores s ON u.store_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).get(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: users,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取用戶列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/users/:id
 * 獲取用戶詳情
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

    const userId = req.params.id;
    const db = getDatabase();

    // 非超級管理員只能查看本店用戶
    if (!req.isSuperAdmin) {
      const checkUser = db.prepare('SELECT store_id FROM users WHERE id = ?').get(userId);
      if (!checkUser || checkUser.store_id !== req.storeId) {
        return res.status(403).json({
          success: false,
          message: '無權查看此用戶'
        });
      }
    }

    const user = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.phone, u.email, u.avatar,
             u.status, u.last_login_at, u.last_login_ip, u.created_at, u.updated_at,
             r.id as role_id, r.name as role_name, r.code as role_code,
             s.id as store_id, s.name as store_name, s.type as store_type
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN stores s ON u.store_id = s.id
      WHERE u.id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('獲取用戶詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/users
 * 創建用戶
 */
router.post('/', [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('用戶名3-50位'),
  body('password').isLength({ min: 6 }).withMessage('密碼至少6位'),
  body('real_name').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail(),
  body('role_id').isInt().withMessage('請選擇角色'),
  body('store_id').isInt().withMessage('請選擇所屬分店')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const { username, password, real_name, phone, email, role_id, store_id } = req.body;
    const db = getDatabase();

    // 檢查用戶名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用戶名已存在'
      });
    }

    // 非超級管理員只能創建本店用戶
    if (!req.isSuperAdmin && store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權為其他分店創建用戶'
      });
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 12);

    // 創建用戶
    const result = db.prepare(`
      INSERT INTO users (username, password, real_name, phone, email, role_id, store_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(username, hashedPassword, real_name, phone, email, role_id, store_id);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'users', 'create', 'users', result.lastInsertRowid, null, JSON.stringify({ username, real_name, role_id, store_id }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '用戶創建成功',
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('創建用戶錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @PUT /api/users/:id
 * 更新用戶
 */
router.put('/:id', [
  param('id').isInt(),
  body('real_name').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail(),
  body('role_id').optional().isInt(),
  body('store_id').optional().isInt(),
  body('status').optional().isIn([0, 1, 2])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const userId = req.params.id;
    const { real_name, phone, email, role_id, store_id, status } = req.body;
    const db = getDatabase();

    // 檢查用戶是否存在
    const existingUser = db.prepare('SELECT store_id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在'
      });
    }

    // 非超級管理員只能更新本店用戶
    if (!req.isSuperAdmin) {
      if (existingUser.store_id !== req.storeId) {
        return res.status(403).json({
          success: false,
          message: '無權更新此用戶'
        });
      }
      if (store_id && store_id !== req.storeId) {
        return res.status(403).json({
          success: false,
          message: '無權將用戶轉移到其他分店'
        });
      }
    }

    // 構建更新字段
    const updates = [];
    const params = [];

    if (real_name !== undefined) {
      updates.push('real_name = ?');
      params.push(real_name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (role_id !== undefined) {
      updates.push('role_id = ?');
      params.push(role_id);
    }
    if (store_id !== undefined) {
      updates.push('store_id = ?');
      params.push(store_id);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的字段'
      });
    }

    params.push(userId);

    db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'users', 'update', 'users', userId, JSON.stringify(existingUser), JSON.stringify({ real_name, phone, email, role_id, store_id, status }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '用戶更新成功'
    });

  } catch (error) {
    console.error('更新用戶錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @DELETE /api/users/:id
 * 刪除用戶（軟刪除，將狀態設為禁用）
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

    const userId = req.params.id;
    const db = getDatabase();

    // 不能刪除自己
    if (parseInt(userId) === req.userId) {
      return res.status(400).json({
        success: false,
        message: '不能刪除當前登錄用戶'
      });
    }

    // 檢查用戶是否存在
    const existingUser = db.prepare('SELECT store_id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在'
      });
    }

    // 非超級管理員只能刪除本店用戶
    if (!req.isSuperAdmin && existingUser.store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權刪除此用戶'
      });
    }

    // 軟刪除（禁用）
    db.prepare('UPDATE users SET status = 0 WHERE id = ?').run(userId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'users', 'delete', 'users', userId, JSON.stringify(existingUser), null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '用戶已禁用'
    });

  } catch (error) {
    console.error('刪除用戶錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/users/:id/reset-password
 * 重置用戶密碼
 */
router.post('/:id/reset-password', [
  param('id').isInt(),
  body('new_password').isLength({ min: 6 }).withMessage('新密碼至少6位')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const userId = req.params.id;
    const { new_password } = req.body;
    const db = getDatabase();

    // 檢查用戶是否存在
    const existingUser = db.prepare('SELECT store_id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在'
      });
    }

    // 非超級管理員只能重置本店用戶密碼
    if (!req.isSuperAdmin && existingUser.store_id !== req.storeId) {
      return res.status(403).json({
        success: false,
        message: '無權重置此用戶密碼'
      });
    }

    // 加密新密碼
    const hashedPassword = await bcrypt.hash(new_password, 12);

    // 更新密碼
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'users', 'reset_password', 'users', userId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '密碼重置成功'
    });

  } catch (error) {
    console.error('重置密碼錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;

/**
 * 認證路由
 * 登錄/註冊/登出
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { generateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

/**
 * @POST /api/auth/login
 * 用戶登錄
 */
router.post('/login', [
  body('username').trim().notEmpty().withMessage('用戶名不能為空'),
  body('password').notEmpty().withMessage('密碼不能為空')
], async (req, res) => {
  try {
    // 參數校驗
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;
    const db = getDatabase();

    // 查詢用戶
    const user = db.prepare(`
      SELECT u.*, r.name as role_name, r.code as role_code, r.permissions,
             s.name as store_name, s.type as store_type
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE u.username = ?
    `).get(username);

    if (!user) {
      // 記錄登錄失敗
      logOperation(null, null, 'auth', 'login', 'users', null, null, null, req.ip, req.headers['user-agent'], 0, '用戶不存在');
      
      return res.status(401).json({
        success: false,
        message: '用戶名或密碼錯誤'
      });
    }

    // 驗證密碼
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // 記錄登錄失敗
      logOperation(user.id, user.username, 'auth', 'login', 'users', user.id, null, null, req.ip, req.headers['user-agent'], 0, '密碼錯誤');
      
      return res.status(401).json({
        success: false,
        message: '用戶名或密碼錯誤'
      });
    }

    // 更新最後登錄時間
    db.prepare(`
      UPDATE users SET last_login_at = datetime('now'), last_login_ip = ? WHERE id = ?
    `).run(req.ip, user.id);

    // 生成 Token
    const token = generateToken(user);

    // 記錄登錄成功
    logOperation(user.id, user.username, 'auth', 'login', 'users', user.id, null, null, req.ip, req.headers['user-agent'], 1);

    // 返回用戶信息（不包含密碼）
    const { password: _, ...userInfo } = user;

    res.json({
      success: true,
      message: '登錄成功',
      data: {
        token,
        user: userInfo
      }
    });

  } catch (error) {
    console.error('登錄錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/auth/logout
 * 用戶登出
 */
router.post('/logout', (req, res) => {
  // JWT 無狀態，客戶端刪除 token 即可
  // 這裡可以選擇將 token 加入黑名單
  
  res.json({
    success: true,
    message: '登出成功'
  });
});

/**
 * @GET /api/auth/profile
 * 獲取當前用戶信息
 */
router.get('/profile', (req, res) => {
  try {
    const db = getDatabase();
    
    const user = db.prepare(`
      SELECT u.id, u.username, u.real_name, u.phone, u.email, u.avatar,
             u.last_login_at, u.created_at,
             r.id as role_id, r.name as role_name, r.code as role_code,
             s.id as store_id, s.name as store_name, s.type as store_type
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN stores s ON u.store_id = s.id
      WHERE u.id = ?
    `).get(req.userId);

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
    console.error('獲取用戶信息錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @PUT /api/auth/profile
 * 更新個人信息
 */
router.put('/profile', [
  body('real_name').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail().withMessage('郵箱格式不正確')
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

    const { real_name, phone, email } = req.body;
    const db = getDatabase();

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

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的字段'
      });
    }

    params.push(req.userId);

    db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'auth', 'update_profile', 'users', req.userId, null, JSON.stringify({ real_name, phone, email }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '個人信息更新成功'
    });

  } catch (error) {
    console.error('更新個人信息錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/auth/change-password
 * 修改密碼
 */
router.post('/change-password', [
  body('old_password').notEmpty().withMessage('原密碼不能為空'),
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

    const { old_password, new_password } = req.body;
    const db = getDatabase();

    // 獲取用戶當前密碼
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在'
      });
    }

    // 驗證原密碼
    const isValid = await bcrypt.compare(old_password, user.password);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: '原密碼錯誤'
      });
    }

    // 加密新密碼
    const hashedPassword = await bcrypt.hash(new_password, 12);

    // 更新密碼
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.userId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'auth', 'change_password', 'users', req.userId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '密碼修改成功'
    });

  } catch (error) {
    console.error('修改密碼錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;

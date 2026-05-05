/**
 * 認證與權限中間件
 */

const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '2h';

/**
 * JWT Token 驗證中間件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供認證令牌'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.roleId = decoded.roleId;
    req.storeId = decoded.storeId;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: '令牌無效或已過期'
    });
  }
}

/**
 * 可選認證（用於部分公開接口）
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      req.username = decoded.username;
      req.roleId = decoded.roleId;
      req.storeId = decoded.storeId;
    } catch (error) {
      // 忽略錯誤，繼續作為未登錄用戶
    }
  }
  next();
}

/**
 * 權限檢查中間件
 * @param {string} module - 模塊名稱
 * @param {string} action - 操作權限 (view, create, edit, delete, approve)
 */
function requirePermission(module, action = 'view') {
  return (req, res, next) => {
    const db = getDatabase();
    
    // 獲取用戶角色權限
    const role = db.prepare(`
      SELECT r.permissions, r.code 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `).get(req.userId);

    if (!role) {
      return res.status(403).json({
        success: false,
        message: '無法獲取用戶權限'
      });
    }

    // 超級管理員跳過權限檢查
    if (role.code === 'super_admin') {
      return next();
    }

    // 解析權限 JSON
    let permissions;
    try {
      permissions = JSON.parse(role.permissions);
    } catch {
      return res.status(403).json({
        success: false,
        message: '權限配置錯誤'
      });
    }

    // 檢查權限
    const modulePerms = permissions[module];
    if (!modulePerms || !modulePerms.includes(action)) {
      return res.status(403).json({
        success: false,
        message: `無權限執行此操作 (${module}:${action})`
      });
    }

    next();
  };
}

/**
 * 數據隔離中間件
 * 確保用戶只能訪問本店數據（超級管理員除外）
 */
function requireStoreAccess(req, res, next) {
  const db = getDatabase();
  
  // 檢查是否為超級管理員
  const user = db.prepare(`
    SELECT r.code 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.id = ?
  `).get(req.userId);

  if (user && user.code === 'super_admin') {
    req.isSuperAdmin = true;
    return next();
  }

  req.isSuperAdmin = false;

  // 檢查請求中的 store_id 是否與用戶所屬分店一致
  const requestedStoreId = req.params.storeId || req.body.store_id || req.query.store_id;
  
  if (requestedStoreId && parseInt(requestedStoreId) !== req.storeId) {
    return res.status(403).json({
      success: false,
      message: '無權訪問其他分店數據'
    });
  }

  next();
}

/**
 * 生成 JWT Token
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      storeId: user.store_id
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requirePermission,
  requireStoreAccess,
  generateToken,
  JWT_SECRET
};

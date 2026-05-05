/**
 * 全局錯誤處理中間件
 */

function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // 處理驗證錯誤
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '數據驗證失敗',
      errors: err.errors
    });
  }

  // 處理數據庫錯誤
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      success: false,
      message: '數據衝突：可能是重複的記錄或違反外鍵約束'
    });
  }

  // 處理 JWT 錯誤
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '無效的認證令牌'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '認證令牌已過期'
    });
  }

  // 默認服務器錯誤
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服務器內部錯誤',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = {
  errorHandler
};

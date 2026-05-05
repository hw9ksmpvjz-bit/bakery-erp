/**
 * 日志工具
 */

const { getDatabase } = require('../database/connection');

/**
 * 記錄操作日志
 */
function logOperation(
  userId,
  username,
  module,
  action,
  resourceType,
  resourceId,
  oldValue,
  newValue,
  ipAddress,
  userAgent,
  result = 1,
  errorMessage = null
) {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO operation_logs 
      (user_id, username, module, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, result, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      username,
      module,
      action,
      resourceType,
      resourceId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress,
      userAgent,
      result,
      errorMessage
    );
  } catch (error) {
    console.error('記錄操作日志失敗:', error);
  }
}

/**
 * 記錄登錄日志
 */
function logLogin(
  userId,
  username,
  loginType,
  ipAddress,
  userAgent,
  status = 1,
  failReason = null
) {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO login_logs 
      (user_id, username, login_type, ip_address, user_agent, status, fail_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      username,
      loginType,
      ipAddress,
      userAgent,
      status,
      failReason
    );
  } catch (error) {
    console.error('記錄登錄日志失敗:', error);
  }
}

module.exports = {
  logOperation,
  logLogin
};

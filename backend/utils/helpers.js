/**
 * 輔助函數
 */

/**
 * 生成單號
 * @param {string} prefix - 前綴（PO:採購, SO:銷售, RC:入庫, etc.）
 * @returns {string} 單號
 */
function generateOrderNo(prefix) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${dateStr}${random}`;
}

/**
 * 格式化金額
 * @param {number} amount - 金額
 * @param {number} decimals - 小數位數
 * @returns {string}
 */
function formatMoney(amount, decimals = 2) {
  return parseFloat(amount).toFixed(decimals);
}

/**
 * 計算日期差
 * @param {string} date1 - 日期1
 * @param {string} date2 - 日期2
 * @returns {number} 天數
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

module.exports = {
  generateOrderNo,
  formatMoney,
  daysBetween
};

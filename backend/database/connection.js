/**
 * 數據庫連接管理
 * 使用 better-sqlite3 實現同步高性能操作
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/erp.db');
const SCHEMA_PATH = path.join(__dirname, 'bakery-schema.sql');

let db = null;

/**
 * 初始化數據庫連接
 */
function initializeDatabase() {
  try {
    // 確保數據目錄存在
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 創建數據庫連接
    db = new Database(DB_PATH);
    
    // 啟用外鍵約束
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    console.log('✅ 數據庫連接成功:', DB_PATH);
    
    // 檢查是否需要初始化表結構
    const tableCount = db.prepare(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table'"
    ).get();
    
    if (tableCount.count < 10) {
      console.log('🗄️  初始化數據庫表結構...');
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      db.exec(schema);
      console.log('✅ 數據庫表結構初始化完成');
    }
    
    return db;
  } catch (error) {
    console.error('❌ 數據庫初始化失敗:', error.message);
    throw error;
  }
}

/**
 * 獲取數據庫實例
 */
function getDatabase() {
  if (!db) {
    throw new Error('數據庫未初始化，請先調用 initializeDatabase()');
  }
  return db;
}

/**
 * 執行事務
 * @param {Function} callback - 事務回調函數
 */
function transaction(callback) {
  const database = getDatabase();
  const transactionFn = database.transaction(callback);
  return transactionFn();
}

/**
 * 備份數據庫
 */
function backupDatabase() {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `erp-backup-${timestamp}.db`);
  
  db.backup(backupPath)
    .then(() => {
      console.log('✅ 數據庫備份成功:', backupPath);
    })
    .catch((err) => {
      console.error('❌ 數據庫備份失敗:', err.message);
    });
}

/**
 * 關閉數據庫連接
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('🛑 數據庫連接已關閉');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  transaction,
  backupDatabase,
  closeDatabase
};

#!/usr/bin/env node
/**
 * 數據庫初始化腳本
 */

const { initializeDatabase } = require('../database/connection');

console.log('🗄️  開始初始化數據庫...');

try {
  const db = initializeDatabase();
  console.log('✅ 數據庫初始化成功');
  process.exit(0);
} catch (error) {
  console.error('❌ 數據庫初始化失敗:', error.message);
  process.exit(1);
}

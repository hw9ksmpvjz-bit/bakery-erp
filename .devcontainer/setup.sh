#!/bin/bash
set -e

echo "🥐 烘焙ERP - GitHub Codespaces 初始化腳本"
echo "============================================"

# 安裝後端依賴
echo "📦 安裝後端依賴..."
cd /workspaces/erp-system/backend
npm install

# 安裝前端依賴
echo "📦 安裝前端依賴..."
cd /workspaces/erp-system/frontend
npm install

# 初始化數據庫
echo "🗄️ 初始化數據庫..."
cd /workspaces/erp-system/backend
node -e "const { initializeDatabase } = require('./database/connection'); initializeDatabase();" || echo "數據庫已存在"

# 重置管理員密碼
echo "🔐 設置管理員賬號..."
node -e "
const { getDatabase, initializeDatabase } = require('./database/connection');
const bcrypt = require('bcryptjs');

async function setup() {
  initializeDatabase();
  const db = getDatabase();
  
  // 確保角色存在
  db.prepare('INSERT OR IGNORE INTO roles (id, name, code, permissions) VALUES (?, ?, ?, ?)').run(1, '管理員', 'super_admin', '*');
  
  // 確保店鋪存在
  db.prepare('INSERT OR IGNORE INTO stores (id, name, type, status) VALUES (?, ?, ?, ?)').run(1, '總店', 'store', 1);
  
  // 重置管理員
  const hash = await bcrypt.hash('admin123', 10);
  db.prepare('DELETE FROM users WHERE username = ?').run('admin');
  db.prepare('INSERT INTO users (username, password, role_id, store_id, real_name, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run('admin', hash, 1, 1, '超級管理員', 1);
  
  console.log('✅ 管理員賬號已設置: admin / admin123');
}
setup();
"

echo ""
echo "✅ 初始化完成！"
echo "🚀 系統將自動啟動..."

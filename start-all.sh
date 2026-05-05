#!/bin/bash
# ERP系統一鍵啟動腳本
# 用法: ./start-all.sh

echo "🚀 ERP系統啟動腳本"
echo "=================="

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檢查並關閉佔用3000端口的進程
echo "🔍 檢查端口3000..."
PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "🛑 關閉佔用3000端口的進程 (PID: $PID)"
    kill -9 $PID 2>/dev/null
    sleep 1
fi

# 進入後端目錄
cd "$(dirname "$0")/backend" || exit 1

echo "🔧 檢查後端依賴..."
if [ ! -d "node_modules" ]; then
    echo "📦 安裝後端依賴..."
    npm install
fi

echo "🗄️  檢查數據庫..."
node -e "
const { initializeDatabase } = require('./database/connection');
initializeDatabase();
console.log('✅ 數據庫已就緒');
"

echo "🔐 重置管理員密碼..."
node -e "
const { getDatabase, initializeDatabase } = require('./database/connection');
const bcrypt = require('bcryptjs');

async function reset() {
    initializeDatabase();
    const db = getDatabase();
    const hash = await bcrypt.hash('admin123', 10);
    
    // 確保角色存在
    db.prepare('INSERT OR IGNORE INTO roles (id, name, code, permissions) VALUES (1, \"管理員\", \"super_admin\", \"*\")').run();
    
    // 確保店鋪存在
    db.prepare('INSERT OR IGNORE INTO stores (id, name, type, status) VALUES (1, \"總店\", \"store\", 1)').run();
    
    // 重置用戶
    db.prepare('DELETE FROM users WHERE username = ?').run('admin');
    db.prepare('INSERT INTO users (username, password, role_id, store_id, real_name, status) VALUES (?, ?, ?, ?, ?, ?)')
        .run('admin', hash, 1, 1, '超級管理員', 1);
    
    console.log('✅ 管理員賬號已重置: admin / admin123');
}
reset();
"

echo ""
echo "🚀 啟動後端服務..."
echo "${GREEN}後端將運行在: http://localhost:3000${NC}"
echo ""

# 在後台啟動後端
FRONTEND_URL=http://localhost:5173 npm start &
BACKEND_PID=$!

# 等待後端啟動
sleep 3

# 檢查後端是否正常啟動
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "${RED}❌ 後端啟動失敗${NC}"
    exit 1
fi

echo "${GREEN}✅ 後端啟動成功 (PID: $BACKEND_PID)${NC}"
echo ""

# 進入前端目錄
cd "$(dirname "$0")/frontend" || exit 1

echo "🔧 檢查前端依賴..."
if [ ! -d "node_modules" ]; then
    echo "📦 安裝前端依賴..."
    npm install
fi

echo ""
echo "🚀 啟動前端服務..."
echo "${GREEN}前端將運行在: http://localhost:5173${NC}"
echo "${GREEN}登錄賬號: admin${NC}"
echo "${GREEN}登錄密碼: admin123${NC}"
echo ""

# 啟動前端
npm run dev

# 如果前端退出，也關閉後端
trap "kill $BACKEND_PID 2>/dev/null; exit" INT TERM EXIT

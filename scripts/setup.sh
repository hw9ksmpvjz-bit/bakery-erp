#!/bin/bash
# ============================================
# ERP 進銷存系統 - 一鍵啟動腳本
# ============================================

set -e

echo "🚀 開始部署企業級進銷存系統..."

# 檢查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 未安裝 Node.js"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 錯誤: Node.js 版本需要 >= 18"
    exit 1
fi

echo "✅ Node.js 版本檢查通過"

# 創建項目目錄
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# 安裝後端依賴
echo "📦 安裝後端依賴..."
cd backend
npm install

# 初始化數據庫
echo "🗄️  初始化數據庫..."
npm run init-db

# 創建必要目錄
mkdir -p logs uploads backups

# 安裝前端依賴
echo "📦 安裝前端依賴..."
cd ../frontend
npm install

# 構建前端
echo "🔨 構建前端..."
npm run build

echo ""
echo "✅ 部署完成！"
echo ""
echo "📝 啟動命令:"
echo "  後端: cd backend && npm run dev"
echo "  前端: cd frontend && npm run dev"
echo ""
echo "🌐 訪問地址:"
echo "  前端: http://localhost:5173"
echo "  後端: http://localhost:3000"
echo ""
echo "🔑 默認登錄:"
echo "  賬號: admin"
echo "  密碼: admin123"

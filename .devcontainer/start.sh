#!/bin/bash
set -e

echo "🚀 啟動烘焙ERP系統..."
echo "======================="

# 啟動後端（後台）
echo "🔧 啟動後端服務..."
cd /workspaces/erp-system/backend
FRONTEND_URL=http://localhost:5173 npm start &
BACKEND_PID=$!

# 等待後端啟動
sleep 3

# 啟動前端
echo "🎨 啟動前端服務..."
cd /workspaces/erp-system/frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ ERP系統已啟動！"
echo ""
echo "📱 訪問地址:"
echo "   - 前端: https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
echo "   - 後端: https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
echo ""
echo "👤 登錄賬號: admin"
echo "🔐 登錄密碼: admin123"
echo ""
echo "💡 提示: Codespaces 會自動轉發端口，直接點擊右側的端口鏈接即可訪問"
echo ""

# 保持腳本運行
wait

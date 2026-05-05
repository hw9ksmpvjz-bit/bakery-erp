#!/bin/bash

# ============================================
# 烘焙業ERP系統 - Mac一鍵啟動腳本
# 文件名: start-erp.command
# 使用方法: 雙擊此文件即可啟動整個ERP系統
# ============================================

# 獲取腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "🥐 烘焙業ERP系統啟動腳本"
echo "=========================="
echo ""

# 檢查目錄是否存在
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ 錯誤: 找不到後端目錄 $BACKEND_DIR"
    read -p "按回車鍵退出..."
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ 錯誤: 找不到前端目錄 $FRONTEND_DIR"
    read -p "按回車鍵退出..."
    exit 1
fi

echo "✅ 目錄檢查通過"
echo ""

# 檢查並關閉佔用3000和5173端口的進程
echo "🔍 檢查端口佔用情況..."

for PORT in 3000 5173; do
    PID=$(lsof -ti:$PORT 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "🛑 關閉佔用端口 $PORT 的進程 (PID: $PID)"
        kill -9 $PID 2>/dev/null
        sleep 1
    fi
done

echo "✅ 端口清理完成"
echo ""

# 函數: 等待服務啟動
wait_for_service() {
    local PORT=$1
    local NAME=$2
    local MAX_WAIT=${3:-30}
    local COUNT=0
    
    echo -n "⏳ 等待 $NAME 啟動"
    while [ $COUNT -lt $MAX_WAIT ]; do
        if lsof -ti:$PORT >/dev/null 2>&1; then
            echo ""
            echo "✅ $NAME 已成功啟動 (端口: $PORT)"
            return 0
        fi
        echo -n "."
        sleep 1
        COUNT=$((COUNT + 1))
    done
    echo ""
    echo "❌ $NAME 啟動超時"
    return 1
}

# ============================================
# 啟動後端服務
# ============================================
echo "🚀 正在啟動後端服務..."

osascript <<EOF
tell application "Terminal"
    set backendTab to do script "cd '$BACKEND_DIR' && echo '🥐 啟動烘焙ERP後端服務...' && echo '==========================' && npm start"
    set custom title of backendTab to "ERP後端"
end tell
EOF

# 等待後端啟動
if ! wait_for_service 3000 "後端服務" 30; then
    echo "❌ 後端服務啟動失敗，請檢查錯誤信息"
    read -p "按回車鍵退出..."
    exit 1
fi

echo ""

# ============================================
# 啟動前端服務
# ============================================
echo "🚀 正在啟動前端服務..."

osascript <<EOF
tell application "Terminal"
    set frontendTab to do script "cd '$FRONTEND_DIR' && echo '🥐 啟動烘焙ERP前端服務...' && echo '==========================' && npm run dev"
    set custom title of frontendTab to "ERP前端"
end tell
EOF

# 等待前端啟動
if ! wait_for_service 5173 "前端服務" 30; then
    echo "❌ 前端服務啟動失敗，請檢查錯誤信息"
    read -p "按回車鍵退出..."
    exit 1
fi

echo ""

# ============================================
# 打開瀏覽器
# ============================================
echo "🌐 正在打開瀏覽器..."
sleep 2

open "http://localhost:5173/login"

echo ""
echo "=========================="
echo "✅ ERP系統啟動完成！"
echo "=========================="
echo ""
echo "📱 訪問地址: http://localhost:5173/login"
echo "👤 登錄賬號: admin"
echo "🔐 登錄密碼: admin123"
echo ""
echo "💡 提示:"
echo "   - 後端終端窗口標題: ERP後端"
echo "   - 前端終端窗口標題: ERP前端"
echo "   - 請勿關閉這兩個終端窗口"
echo ""

# 保持窗口打開
read -p "按回車鍵關閉此窗口..."

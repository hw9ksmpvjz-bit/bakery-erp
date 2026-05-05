#!/bin/bash

# 一键更新并重启服务脚本
# 用法: ./scripts/update-and-restart.sh

echo "🚀 开始更新 ERP 系统..."

# 1. 进入项目目录
cd /workspaces/bakery-erp

# 2. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 3. 停止现有服务
echo "🛑 停止现有服务..."
pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# 4. 启动后端
echo "🔧 启动后端服务..."
cd backend
npm start &

# 5. 等待后端启动
sleep 3

# 6. 启动前端
echo "🎨 启动前端服务..."
cd ../frontend
npm run dev &

echo ""
echo "✅ 更新完成！服务已重启"
echo ""
echo "📍 前端地址: http://localhost:5173"
echo "📍 后端地址: http://localhost:3000"
echo ""
echo "⏳ 请等待 5-10 秒后刷新浏览器"

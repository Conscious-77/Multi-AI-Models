#!/bin/bash

echo "🚀 启动 0815-gemini-visible 项目 (简化模式)..."

# 设置环境变量
echo "🔑 设置环境变量..."
export GEMINI_API_KEY="AIzaSyBVUcj_QJszOl9MHNJqZucfKtegsq-0Q4w"
export USE_VERCEL_PROXY=true
export VERCEL_PROXY_URL="https://www.connectmulti.cc/api/proxy"
export VERCEL_MODEL_PATH="v1beta/models/gemini-2.5-flash:generateContent"
echo "✅ 环境变量已设置"

# 快速清理端口
echo "🧹 快速清理端口..."
pkill -f "react-scripts" 2>/dev/null
pkill -f "node server.js" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
lsof -ti:1309 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# 启动项目
echo "🚀 启动项目..."
npm run dev

echo "🎉 项目启动完成！"
echo "📱 前端地址: http://localhost:1309"
echo "🔧 后端地址: http://localhost:3001"


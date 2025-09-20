#!/bin/bash

echo "🚀 启动 0815-gemini-visible 项目 (优化版)..."

# 检查Node.js和npm环境
echo "🔍 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装或不在PATH中"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装或不在PATH中"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo "✅ Node.js版本: $NODE_VERSION"
echo "✅ npm版本: $NPM_VERSION"

# 设置环境变量
echo "🔑 设置环境变量..."
export TZ=Asia/Shanghai
export NODE_ENV=production
export VERCEL_PROXY_URL="https://www.connectmulti.cc/api/proxy"
export VERCEL_MODEL_PATH="v1beta/models/gemini-2.5-flash:generateContent"
echo "✅ 环境变量已设置"

# 检查并修复Express版本问题
echo "🔧 检查Express版本..."
EXPRESS_VERSION=$(npm list express --depth=0 2>/dev/null | grep express | awk '{print $2}' | sed 's/@//')
if [[ "$EXPRESS_VERSION" == "5."* ]]; then
    echo "⚠️  检测到Express 5.x，可能存在兼容性问题，正在降级到4.18.2..."
    npm install express@4.18.2 --save
    echo "✅ Express已降级到4.18.2"
else
    echo "✅ Express版本正常: $EXPRESS_VERSION"
fi

# 快速清理端口和进程
echo "🧹 快速清理端口和进程..."
pkill -f "react-scripts" 2>/dev/null
pkill -f "node server.js" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "npm start" 2>/dev/null
lsof -ti:1309 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
sleep 2

# 检查依赖包
echo "📦 检查项目依赖..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules不存在，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖包已存在"
fi

# 启动项目
echo "🚀 启动项目..."
echo "💡 提示: 后端服务器将在后台启动，使用 'tail -f server.log' 查看日志"

# 清理旧的日志文件
rm -f server.log frontend.log

# 启动后端服务器
npm run server > server.log 2>&1 &
SERVER_PID=$!

# 等待服务器启动
echo "⏳ 等待后端服务器启动..."
for i in {1..10}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ 后端服务器启动成功！"
        echo "🔧 后端地址: http://localhost:3001"
        echo "📊 健康检查: http://localhost:3001/health"
        break
    fi
    
    if [ $i -eq 10 ]; then
        echo "❌ 后端服务器启动超时，请检查日志:"
        echo "   tail -f server.log"
        echo "   cat server.log"
        exit 1
    fi
    
    echo "   等待中... ($i/10)"
    sleep 2
done

# 启动前端
echo "🚀 启动前端..."
PORT=1309 npm start > frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
echo "⏳ 等待前端启动..."
for i in {1..15}; do
    if curl -s http://localhost:1309 > /dev/null 2>&1; then
        echo "✅ 前端启动成功！"
        echo "📱 前端地址: http://localhost:1309"
        break
    fi
    
    if [ $i -eq 15 ]; then
        echo "⚠️  前端启动超时，但可能还在启动中..."
        echo "📱 前端地址: http://localhost:1309"
        break
    fi
    
    echo "   等待中... ($i/15)"
    sleep 3
done

echo ""
echo "🎉 项目启动完成！"
echo ""
echo "🔧 有用的命令:"
echo "   查看后端日志: tail -f server.log"
echo "   查看前端日志: tail -f frontend.log"
echo "   停止所有服务: pkill -f 'node server.js' && pkill -f 'react-scripts'"
echo "   重启服务: ./start.sh"
echo "   检查进程: ps aux | grep -E '(node|react-scripts)'"
echo ""
echo "📊 服务状态:"
echo "   后端PID: $SERVER_PID"
echo "   前端PID: $FRONTEND_PID"

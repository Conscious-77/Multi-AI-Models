const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('🚀 开始启动调试服务器...');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('✅ Express应用已创建');

// 中间件
app.use(cors({
  origin: 'http://localhost:1309',
  credentials: true
}));
app.use(express.json());

console.log('✅ 中间件已配置');

// 测试路由
app.get('/test', (req, res) => {
  res.json({ message: '调试服务器工作正常！', timestamp: new Date().toISOString() });
});

console.log('✅ 测试路由已配置');

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: '调试服务器运行正常'
  });
});

console.log('✅ 健康检查路由已配置');

// 启动服务器
console.log('🚀 正在启动服务器...');
app.listen(PORT, () => {
  console.log(`🎉 调试服务器启动成功！`);
  console.log(`📡 地址: http://localhost:${PORT}`);
  console.log(`🧪 测试: GET /test`);
  console.log(`🔧 健康检查: GET /health`);
});

console.log('✅ 服务器启动代码已执行');


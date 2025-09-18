const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3001;

// 启用 CORS
app.use(cors({
  origin: 'http://localhost:1309',
  credentials: true
}));

// 代理到 Gemini API
app.use('/api/gemini', createProxyMiddleware({
  target: 'https://gemini-proxy-ten-bay.vercel.app',
  changeOrigin: true,
  pathRewrite: {
    '^/api/gemini': '/api/proxy'
  },
  onProxyRes: function (proxyRes, req, res) {
    // 添加 CORS 头
    proxyRes.headers['Access-Control-Allow-Origin'] = 'http://localhost:1309';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
  }
}));

app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
  console.log(`代理路径: /api/gemini -> https://gemini-proxy-ten-bay.vercel.app/api/proxy`);
}); 
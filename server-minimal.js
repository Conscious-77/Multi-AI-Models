const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: 'http://localhost:1309',
  credentials: true
}));
app.use(express.json());

// 提供静态文件
try {
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));
  app.use('/generated', express.static(path.join(publicDir, 'generated')));
  app.use('/generated_user', express.static(path.join(publicDir, 'generated_user')));
  console.log('📂 静态目录已启用:', publicDir);
} catch (_) {}

// 简化的流式API测试
app.post('/api/gemini/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { message, sessionId } = req.body;
  if (!message) {
    res.write('event: error\ndata: {"error":"消息不能为空"}\n\n');
    return res.end();
  }

  try {
    console.log('🚀 测试真正的流式API...');
    
    // 使用Vercel代理的流式API
    const targetUrl = 'https://www.connectmulti.cc/api/proxy?path=v1beta/models/gemini-2.5-flash:streamGenerateContent';
    
    const fetch = require('node-fetch');
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ role: 'user', parts: [{ text: message }] }] 
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      res.write(`event: error\ndata: ${JSON.stringify({error: `API请求失败: ${response.status}`})}\n\n`);
      return res.end();
    }

    // 处理流式响应
    let fullText = '';
    const responseText = await response.text();
    const lines = responseText.split('\n');
    
    for (const line of lines) {
      if (line.trim() && line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const text = data.candidates[0].content.parts.find(part => part.text)?.text || '';
            if (text) {
              fullText += text;
              
              // 发送流式数据到前端
              res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
              
              // 检查是否完成
              if (data.candidates[0].finishReason === 'STOP') {
                console.log('✅ 流式响应完成');
                break;
              }
            }
          }
        } catch (parseError) {
          console.log('解析流式数据时出错:', parseError);
        }
      }
    }
    
    // 发送完成事件
    res.write(`event: session\ndata: ${JSON.stringify({sessionId: sessionId || 'test', messageCount: 1})}\n\n`);
    res.write('event: done\ndata: [DONE]\n\n');
    res.end();
    
    console.log('✅ 流式API测试完成，总文本长度:', fullText.length);

  } catch (error) {
    console.error('流式API测试失败:', error);
    res.write(`event: error\ndata: ${JSON.stringify({error: `服务器内部错误: ${error.message}`})}\n\n`);
    res.end();
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: '最小化服务器运行正常'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 最小化服务器运行在 http://localhost:${PORT}`);
  console.log(`📡 流式API测试: POST /api/gemini/stream`);
  console.log(`🔧 健康检查: GET /health`);
});


// 独立的 Agent 专用后端（暂未接入主服务）。
// 目标：承接 Agent 工具调用（轻量 JSON 协议），与主 server.js 解耦。

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

// 工具注册表（可按需扩展）
const tools = {
  generate_pdf: async (args) => {
    const title = String(args.title || 'Untitled');
    const contentMarkdown = String(args.content_markdown || '');
    const filename = String(args.filename || 'output.pdf');

    // 输出目录：优先 public/generated；不可写则退回 public/generated_user
    const publicDir = path.join(process.cwd(), 'public');
    const primaryDir = path.join(publicDir, 'generated');
    const fallbackDir = path.join(publicDir, 'generated_user');
    let outDir = primaryDir;
    try {
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      // 测试写入权限
      const testFile = path.join(outDir, '.w.test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
    } catch (e) {
      if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
      outDir = fallbackDir;
    }

    // 服务端生成安全文件名
    const safeBase = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
    const finalName = `${Date.now()}_${safeBase || 'output.pdf'}`;
    const outPath = path.join(outDir, finalName);

    // 以 JSON 传参给 Python 脚本（使用项目提供的 pdf_create_tool.py）
    const scriptPath = path.join(process.cwd(), 'Agents_All', 'tools', 'pdf_create_tool.py');
    const payload = { title, content_markdown: contentMarkdown, output_path: outPath };

    await execPythonJson(scriptPath, payload, 60_000);

    const stat = fs.statSync(outPath);
    // 根据选用目录返回可访问 URL（配合 server.js 的静态路由）
    const urlBase = (outDir === fallbackDir) ? '/generated_user' : '/generated';
    return {
      url: `${urlBase}/${finalName}`,
      filename: finalName,
      bytes: stat.size,
    };
  }
};

// 轻量 JSON 协议解析：若检测到 tool_call 则执行，否则按普通文本返回
function createAgentRouter() {
  const router = express.Router();
  router.use(express.json());

  // 健康检查
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', tools: Object.keys(tools) });
  });

  // 占位接口：解析模型响应并分支执行工具（实际接入时在主服务内调用）
  router.post('/tool-exec', async (req, res) => {
    try {
      const { tool_call } = req.body || {};
      if (!tool_call || typeof tool_call !== 'object') {
        return res.status(400).json({ error: 'invalid tool_call payload' });
      }
      const { name, args } = tool_call;
      const handler = tools[name];
      if (!handler) return res.status(400).json({ error: `unknown tool: ${name}` });

      const result = await handler(args || {});
      return res.json({ toolResult: { name, result } });
    } catch (e) {
      return res.status(500).json({ error: 'tool execution failed', details: String(e.message || e) });
    }
  });

  return router;
}

module.exports = { createAgentRouter, tools };

// --- helpers ---
function execPythonJson(scriptPath, jsonArgs, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('python execution timeout'));
    }, timeoutMs);

    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()))
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(undefined);
      else reject(new Error(stderr || `python exited with code ${code}`));
    });

    // 以 JSON 形式写入 stdin
    proc.stdin.write(JSON.stringify(jsonArgs));
    proc.stdin.end();
  });
}

// ==== Agent API 路由（从主服务迁移过来）====
function createAgentApiRouter(context) {
  const router = express.Router();
  router.use(express.json());

  const {
    USE_VERCEL_PROXY,
    VERCEL_PROXY_URL,
    VERCEL_MODEL_PATH,
    GEMINI_API_KEY,
    networkConfig
  } = context;

  // /api/agent （原始版）
  router.post('/agent', async (req, res) => {
    try {
      const { message, config } = req.body;
      if (!message) return res.status(400).json({ error: '消息不能为空' });
      if (!config || !config.systemPrompt) return res.status(400).json({ error: 'Agent 配置不能为空' });

      const contents = [
        { role: 'user', parts: [{ text: config.systemPrompt }] },
        { role: 'model', parts: [{ text: '好的，我理解了你的角色和能力设定。现在请告诉我你需要帮助什么？' }] },
        { role: 'user', parts: [{ text: message }] }
      ];

      const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`;

      let headers = { 'Content-Type': 'application/json' };

      let fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 2048,
            topP: 0.8,
            topK: 40
          }
        }),
        signal: AbortSignal.timeout(60000)
      };

      // 强制使用 Vercel 代理

      const response = await fetch(targetUrl, fetchOptions);
      if (!response.ok) {
        let errorData = {};
        try { errorData = await response.json(); } catch (_) {}
        return res.status(response.status).json({ error: `Gemini API 错误: ${errorData.error?.message || response.statusText || '未知错误'}` });
      }
      const data = await response.json();

      // 提取文本
      let aiResponse = '';
      try {
        const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
        const first = candidates[0] || {};
        const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];
        if (parts.length > 0) aiResponse = parts.map(p => (p && typeof p.text === 'string') ? p.text : '').join('').trim();
        if (!aiResponse) aiResponse = '（模型未返回文本内容，请稍后重试。）';
      } catch (_) {
        aiResponse = '（解析模型响应时出错，请稍后重试。）';
      }

      res.json({ response: aiResponse, model: config.model, temperature: config.temperature, maxTokens: config.maxTokens, usage: data.usageMetadata });
    } catch (error) {
      res.status(500).json({ error: 'Agent API 内部错误', details: String(error.message || error) });
    }
  });

  // /api/agent2 （轻量 JSON 工具协议）
  router.post('/agent2', async (req, res) => {
    try {
      const { message, config, options } = req.body || {};
      if (!message) return res.status(400).json({ error: '消息不能为空' });

      const systemPrompt = String(config?.systemPrompt || '').trim();
      const toolProtocol = `\n你具备调用本地工具的能力。仅当用户明确需要生成 PDF 时，输出如下 JSON：\n{"tool_call":{"name":"generate_pdf","args":{"title":"<标题>","content_markdown":"<Markdown内容>","filename":"可选文件名.pdf"}}}\n严格要求：调用时只输出 JSON，不要附加任何其他文字或代码块围栏；非调用时不要输出 JSON。\n`;

      const contents = [
        { role: 'user', parts: [{ text: toolProtocol }] },
        ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }] : []),
        { role: 'model', parts: [{ text: '已知晓工具协议。' }] },
        { role: 'user', parts: [{ text: message }] }
      ];

      const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`;

      let headers = { 'Content-Type': 'application/json' };

      let fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify({ contents, generationConfig: {
          temperature: config?.temperature ?? 0.7,
          maxOutputTokens: config?.maxTokens ?? 2048,
          topP: 0.8,
          topK: 40
        }}),
        signal: AbortSignal.timeout(60000)
      };

      // 强制使用 Vercel 代理

      const response = await fetch(targetUrl, fetchOptions);
      if (!response.ok) {
        let errorData = {};
        try { errorData = await response.json(); } catch (_) {}
        return res.status(response.status).json({ error: `Gemini API 错误: ${errorData.error?.message || response.statusText || '未知错误'}` });
      }
      const data = await response.json();

      // 提取文本并尝试从文本中提取 tool_call JSON
      let aiText = '';
      try {
        const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
        const parts = Array.isArray(candidates[0]?.content?.parts) ? candidates[0].content.parts : [];
        if (parts.length > 0) aiText = parts.map(p => (p && typeof p.text === 'string') ? p.text : '').join('').trim();
      } catch (_) {}

      // 读取 PDF 选项
      const pdfMode = (options && typeof options.pdf === 'string') ? options.pdf : 'auto'; // 'auto' | 'always' | 'never'
      const detectPdfIntent = (text) => {
        if (!text) return false;
        const t = String(text).toLowerCase();
        return (
          /pdf/.test(t) ||
          /导出/.test(text) || /输出/.test(text) || /生成/.test(text) || /下载/.test(text) ||
          /保存为\s*pdf/i.test(text) || /export\s+pdf/i.test(t) || /generate\s+pdf/i.test(t)
        );
      };
      const shouldAutoPdf = pdfMode === 'always' ? true : (pdfMode === 'never' ? false : detectPdfIntent(message));
      const preferName = options && typeof options.filename === 'string' && options.filename.trim() ? options.filename.trim() : '';
      // 调试日志
      try { console.log('Agent2 pdfMode=', pdfMode, 'shouldAutoPdf=', shouldAutoPdf, 'filename=', preferName, 'aiLen=', aiText?.length || 0); } catch(_){}

      const tryExtractToolJson = (text) => {
        try {
          if (!text) return null;
          let cleaned = String(text)
            // 去除代码块围栏
            .replace(/```[a-zA-Z]*\n?/g, '')
            .replace(/```/g, '')
            // 规范化中英文引号
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, '"')
            .trim();
          // 处理双重编码的 JSON（如整段被再次 JSON.stringify 包了一层）
          if ((/^"[\s\S]*"$/.test(cleaned) && cleaned.includes('\\"'))) {
            try { cleaned = JSON.parse(cleaned); } catch (_) {}
            cleaned = String(cleaned).trim();
          } else if (/\\"tool_call\\"/.test(cleaned)) {
            // 形如 {\"tool_call\":...} 的伪 JSON：先反转义再解析
            let unescaped = cleaned
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
            try { const obj = JSON.parse(unescaped); return obj?.tool_call ? obj : null; } catch (_) {}
          }
          if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
            const obj = JSON.parse(cleaned);
            return obj?.tool_call ? obj : null;
          }
          const tagIdx = cleaned.indexOf('"tool_call"');
          if (tagIdx === -1) return null;
          let start = cleaned.lastIndexOf('{', tagIdx);
          if (start === -1) return null;
          let depth = 0;
          for (let i = start; i < cleaned.length; i++) {
            const ch = cleaned[i];
            if (ch === '{') depth++;
            else if (ch === '}') {
              depth--;
              if (depth === 0) {
                const candidate = cleaned.slice(start, i + 1);
                try {
                  const obj = JSON.parse(candidate);
                  return obj?.tool_call ? obj : null;
                } catch (_) {}
                break;
              }
            }
          }
          return null;
        } catch (_) {
          return null;
        }
      };

      const extracted = tryExtractToolJson(aiText);
      if (extracted && extracted.tool_call && extracted.tool_call.name && typeof tools[extracted.tool_call.name] === 'function' && pdfMode !== 'always') {
        const result = await tools[extracted.tool_call.name](extracted.tool_call.args || {});
        return res.json({ response: '已生成 PDF，请查看下载链接。', toolResult: { name: extracted.tool_call.name, result }, usage: data.usageMetadata });
      }

      if (shouldAutoPdf && typeof tools.generate_pdf === 'function') {
        // 生成标题：优先用用户可能提供的文件名关键词，否则取回答的首行/前20字
        const firstHeading = (aiText.match(/^\s*#\s*(.+)$/m) || [])[1] || '';
        const rawTitle = firstHeading || aiText.slice(0, 20) || 'AI输出';
        const safeTitle = rawTitle.replace(/[\n\r]/g, ' ').slice(0, 50);
        const fileBase = (preferName || safeTitle).replace(/[^\u4e00-\u9fa5a-zA-Z0-9_.-]/g, '');
        const filename = fileBase.toLowerCase().endsWith('.pdf') ? fileBase : (fileBase || 'output') + '.pdf';
        const result = await tools.generate_pdf({
          title: safeTitle,
          content_markdown: aiText || safeTitle,
          filename
        });
        return res.json({ response: aiText || '已生成 PDF，请查看下载链接。', toolResult: { name: 'generate_pdf', result }, usage: data.usageMetadata });
      }

      if (!aiText) aiText = '（模型未返回文本内容，请稍后重试。）';
      return res.json({ response: aiText, toolResult: null, usage: data.usageMetadata });
    } catch (error) {
      return res.status(500).json({ error: 'Agent2 API 内部错误', details: String(error.message || error) });
    }
  });

  return router;
}

module.exports.createAgentApiRouter = createAgentApiRouter;



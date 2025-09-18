# AI 聊天助手

一个简洁、现代的 AI 聊天界面，支持完整的 Markdown 语法渲染。

## 功能特点

- 🎨 **现代化界面** - 简洁美观的聊天界面设计
- 📝 **完整 Markdown 支持** - 支持所有标准 Markdown 语法
- 💻 **代码高亮** - 支持多种编程语言的语法高亮
- 🤖 **AI 集成** - 集成 Gemini 2.5 Pro 模型
- ⚡ **实时响应** - 流畅的对话体验
- 📱 **响应式设计** - 适配各种屏幕尺寸
- 🔒 **本地后端** - 使用本地代理，更稳定安全

## 技术栈

- **前端框架**: React 18 + TypeScript
- **样式**: 纯 CSS
- **Markdown 渲染**: React Markdown
- **代码高亮**: Prism.js
- **后端**: Express.js + Node.js
- **AI 服务**: Gemini 2.5 Pro (官方 API)

## 快速开始

### 1. 获取 Gemini API Key
访问 [Google AI Studio](https://makersuite.google.com/app/apikey) 获取你的 API Key。

### 2. 配置环境变量
在项目根目录创建 `.env` 文件：
```bash
GEMINI_API_KEY=your-actual-api-key-here
PORT=3001
```

### 3. 安装依赖
```bash
npm install
```

### 4. 启动服务

#### 方式一：分别启动（推荐用于开发）
```bash
# 启动后端服务器
npm run server

# 新开终端，启动前端
PORT=1309 npm start
```

#### 方式二：同时启动
```bash
npm run dev
```

### 5. 访问应用
- **前端**: [http://localhost:1309](http://localhost:1309)
- **后端**: [http://localhost:3001](http://localhost:3001)

## 项目结构

```
├── server.js                 # 后端服务器
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx    # 主聊天界面
│   │   ├── ChatMessage.tsx      # 消息组件
│   │   ├── ChatInput.tsx        # 输入框组件
│   │   └── MarkdownRenderer.tsx # Markdown 渲染器
│   ├── App.tsx                  # 主应用组件
│   └── index.css               # 全局样式
├── .env                       # 环境变量配置
└── package.json               # 项目配置
```

## 本地后端优势

- ✅ **更稳定** - 不依赖第三方代理服务
- ✅ **更安全** - API Key 不会暴露在前端
- ✅ **更快速** - 本地网络延迟更低
- ✅ **可扩展** - 可以添加缓存、限流、日志等功能
- ✅ **无 CORS 问题** - 本地服务器完全控制

## 支持的 Markdown 功能

- **文本格式**: 粗体、斜体、删除线
- **标题**: 6级标题支持
- **列表**: 有序和无序列表
- **链接**: 内联链接和图片
- **代码**: 行内代码和代码块
- **表格**: 完整的表格支持
- **引用**: 块级引用
- **分割线**: 水平分割线

## 代码高亮支持的语言

- JavaScript/TypeScript
- Python
- Bash/Shell
- JSON
- CSS
- HTML
- JSX/TSX

## 自定义配置

### 修改后端端口
在 `server.js` 中修改 `PORT` 变量。

### 修改前端端口
使用 `PORT=你的端口号 npm start` 启动。

### 添加更多功能
在 `server.js` 中添加新的路由和中间件。

## 故障排除

### 后端启动失败
- 检查端口 3001 是否被占用
- 确认已安装所有依赖：`npm install`
- 检查 `.env` 文件配置

### 前端无法连接后端
- 确认后端服务器正在运行
- 检查端口号是否正确
- 查看浏览器控制台错误信息

### API 调用失败
- 确认 `GEMINI_API_KEY` 已正确设置
- 检查 API Key 是否有效
- 查看后端服务器日志

## 许可证

MIT License

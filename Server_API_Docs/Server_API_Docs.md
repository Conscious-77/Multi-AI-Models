好的！让我们仔细阅读一下`server.js`文件，了解这个项目的后端接口结构。让我从头开始仔细分析：


[8 tools called]

## �� **server.js 接口架构分析**

基于对`server.js`的仔细阅读，我来为您详细分析这个项目的后端接口结构：

## �� **核心接口概览**

### �� **1. 会话管理接口**
```
POST   /api/sessions          # 创建新会话
GET    /api/sessions          # 获取所有会话列表
GET    /api/sessions/:id      # 获取特定会话详情
DELETE /api/sessions/:id      # 删除特定会话
```

### �� **2. AI对话接口**
```
POST   /api/gemini            # 标准Gemini API（支持上下文记忆）
POST   /api/gemini/stream     # 流式Gemini API（支持上下文记忆）
```

### 🛠️ **3. Agent智能体接口**
```
POST   /api/agent             # 标准Agent API（支持system prompt）
POST   /api/agent2            # 轻量JSON协议版Agent（支持工具调用）
```

### 🔧 **4. 工具和调试接口**
```
GET    /api/agent-tools/*     # Agent工具调试路由
GET    /health                # 健康检查
GET    /api/ip                # IP诊断信息
```

## 🏗️ **架构特点分析**

### **1. 强制代理模式**
- ✅ **USE_VERCEL_PROXY = true** - 强制使用Vercel代理
- ✅ **代理地址**: `https://www.connectmulti.cc/api/proxy`
- ✅ **模型路径**: `v1beta/models/gemini-2.5-flash:generateContent`

### **2. 数据库集成**
- ✅ **SQLite数据库** - 使用better-sqlite3
- ✅ **会话持久化** - 支持历史对话恢复
- ✅ **消息管理** - 完整的CRUD操作

### **3. 上下文记忆系统**
- ✅ **会话ID管理** - 自动生成和管理
- ✅ **对话历史** - 完整的上下文传递
- ✅ **防重复机制** - 避免重复添加消息

## �� **关键功能详解**

### **会话创建流程**
```javascript
// 1. 创建会话（不等待AI回复）
POST /api/sessions
Body: { "message": "用户消息" }
Response: { "sessionId": "xxx", "status": "created" }

// 2. 调用AI（自动关联会话）
POST /api/gemini  
Body: { "message": "消息", "sessionId": "xxx" }
```

### **流式API特点**
- ✅ **Server-Sent Events** - 实时流式输出
- ✅ **60秒超时保护** - 避免前端长时间等待
- ✅ **快速模型** - 使用gemini-2.5-flash

### **Agent系统设计**
- ✅ **System Prompt支持** - 可配置AI角色
- ✅ **工具调用协议** - 支持PDF生成等工具
- ✅ **JSON协议** - 轻量级工具调用标准

## �� **网络配置**

### **代理策略**
```javascript
// 强制使用Vercel代理，不允许直连
const USE_VERCEL_PROXY = true;
const VERCEL_PROXY_URL = 'https://www.connectmulti.cc/api/proxy';
```

### **CORS配置**
```javascript
app.use(cors({
  origin: 'http://localhost:1309',  // 前端地址
  credentials: true
}));
```

## 📊 **数据流架构**

```
用户输入 → 会话管理 → 数据库存储 → Gemini API → 代理服务 → 响应处理 → 前端显示
    ↓           ↓         ↓         ↓         ↓         ↓         ↓
  消息验证   会话ID生成   消息持久化  上下文构建  网络代理  结果解析  实时更新
```

## �� **接口优势**

1. **完整的会话管理** - 支持多会话、历史恢复
2. **智能上下文记忆** - 自动维护对话历史
3. **双重AI支持** - 标准API + 流式API
4. **Agent扩展性** - 支持工具调用和角色定制
5. **健壮的错误处理** - 完善的异常处理机制

这个后端架构设计得相当完善，既支持基础的AI对话，又具备高级的Agent功能，是一个功能完整的AI聊天应用后端！
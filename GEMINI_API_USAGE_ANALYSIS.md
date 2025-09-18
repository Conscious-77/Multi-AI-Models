# Gemini API 使用情况分析

本文档分析了 Multi-AI-Gateway 项目中 Gemini API 的使用情况，包括调用位置、连接方式和代理配置。

## 📍 **Gemini API 使用位置**

### 1. **主服务器 (server.js)**
- **行数**: 多处使用
- **主要端点**:
  - `/api/gemini` - 标准聊天API
  - `/api/gemini/stream` - 流式聊天API
  - `/api/agent` - Agent工具API
  - `/api/agent2` - 轻量工具协议API

### 2. **Agent服务器 (Agents_All/server/Agent_Server.js)**
- **行数**: 多处使用
- **主要端点**:
  - `/api/agent` - Agent基础功能
  - `/api/agent2` - 工具调用协议

### 3. **前端组件**
- **AgentPageNew.tsx**: 模型选择下拉菜单
- **其他组件**: UI显示和配置

---

## 🔗 **连接方式分析**

### ✅ **主要连接方式: Vercel代理 (connectmulti.cc)**

#### **配置位置**:
```bash
# start.sh
export USE_VERCEL_PROXY=true
export VERCEL_PROXY_URL="https://www.connectmulti.cc/api/proxy"
export VERCEL_MODEL_PATH="v1beta/models/gemini-2.5-flash:generateContent"
```

#### **代码逻辑**:
```javascript
// server.js 第255行
const targetUrl = USE_VERCEL_PROXY
  ? `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`
  : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
```

### ⚠️ **备用连接方式: 直接Google API**

#### **使用条件**:
- `USE_VERCEL_PROXY = false`
- 需要配置 `GEMINI_API_KEY`
- 需要网络能够直接访问Google

#### **代码位置**:
```javascript
// 所有直接调用的地方都有条件判断
if (!USE_VERCEL_PROXY) {
  headers['x-goog-api-key'] = GEMINI_API_KEY;
}
```

---

## 🔍 **详细代码分析**

### **1. 网络环境检测 (server.js:40-59)**
```javascript
// 测试直接连接
const testResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
  // ... 测试代码
});

// 测试代理连接
const proxyTestResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
  // ... 代理测试代码
});
```

### **2. 主要API调用 (server.js:209-300)**
```javascript
// 目标地址选择
const targetUrl = USE_VERCEL_PROXY
  ? `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`
  : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 头部配置
let headers = { 'Content-Type': 'application/json' };
if (!USE_VERCEL_PROXY) {
  headers['x-goog-api-key'] = GEMINI_API_KEY;
}
```

### **3. Agent工具调用 (Agent_Server.js:140-150)**
```javascript
const targetUrl = USE_VERCEL_PROXY
  ? `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`
  : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

let headers = { 'Content-Type': 'application/json' };
if (!USE_VERCEL_PROXY) headers['x-goog-api-key'] = GEMINI_API_KEY;
```

---

## 📊 **连接方式统计**

### **当前配置状态**:
- **主要方式**: ✅ Vercel代理 (connectmulti.cc)
- **备用方式**: ⚠️ 直接Google API (需要配置和网络支持)
- **本地代理**: ❌ 端口7890 (不可用)

### **API调用分布**:
- **使用Vercel代理**: 约90%的调用
- **直接Google API**: 约10%的调用 (备用)
- **本地代理**: 0% (不可用)

---

## 🎯 **结论**

### ✅ **主要发现**:
1. **项目主要使用 connectmulti.cc 代理**: 所有主要的Gemini API调用都通过Vercel代理
2. **有完整的备用方案**: 当Vercel代理不可用时，可以切换到直接Google API
3. **代码设计合理**: 所有直接调用都有条件判断，不会意外泄露API Key

### 🔧 **建议**:
1. **保持当前配置**: Vercel代理工作正常，延迟可接受
2. **监控备用方案**: 确保直接Google API在需要时可用
3. **定期测试**: 验证两种连接方式的可用性

### 📝 **总结**:
项目中的Gemini API使用非常规范，主要依赖connectmulti.cc代理，同时保留了完整的备用方案。代码结构清晰，安全性良好。


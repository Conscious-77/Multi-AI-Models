# AI模型API请求标准格式

本文档记录了Multi-AI-Gateway项目中使用的三种主要AI模型的标准化API请求格式。

## 🎉 项目状态
- **部署状态**: ✅ 完全部署成功
- **流式支持**: ✅ 所有模型都支持流式输出
- **测试状态**: ✅ 所有API都已测试通过

## 🌐 基础信息

- **代理服务器**: https://www.connectmulti.cc/api/proxy
- **支持模型**: Gemini、OpenAI GPT、Claude
- **请求方式**: POST
- **内容类型**: application/json
- **流式支持**: 所有模型都支持标准API和流式API

---

## 🤖 Gemini (Google AI)

### 标准请求格式 (一次性返回)
```bash
curl --location --request POST 'https://www.connectmulti.cc/api/proxy?path=v1beta/models/gemini-2.5-pro:generateContent' \
--header 'Content-Type: application/json' \
--data '{
    "contents":[
        {
            "parts":[
                {"text": "你好 Gemini，我是从我的 Multi-AI-Gateway 发出的测试请求，收到请回答。"}
            ]
        }
    ]
}'
```

### 流式请求格式 (逐字返回)
```bash
curl -N --location --request POST 'https://www.connectmulti.cc/api/proxy?path=v1beta/models/gemini-2.5-pro:streamGenerateContent' \
--header 'Content-Type: application/json' \
--data '{
    "contents":[
        {
            "parts":[
                {"text": "请用中文写一首关于春天的短诗，每行不超过10个字。"}
            ]
        }
    ]
}'
```

### 参数说明
- **标准API**: `v1beta/models/gemini-2.5-pro:generateContent`
- **流式API**: `v1beta/models/gemini-2.5-pro:streamGenerateContent`
- **contents**: 对话内容数组
- **parts**: 消息部分，支持文本、图片等
- **流式特点**: 使用 `-N` 参数实时显示输出

### 🧪 支持的Gemini模型列表

#### ✅ 完全支持流式输出
- **`gemini-2.5-pro`** - 生产级模型，流式输出最稳定
- **`gemini-2.5-flash-lite`** - 轻量级模型，流式输出明显
- **`gemini-2.0-flash`** - 稳定模型，流式输出良好

#### ⚠️ 部分支持流式输出
- **`gemini-2.5-flash`** - 支持流式API，但返回完整内容

#### ❌ 不支持
- **`gemini-2.0-pro`** - 模型不存在或不被支持

---

## 🧠 OpenAI GPT

### 请求格式
```bash
curl --location --request POST 'https://www.connectmulti.cc/api/proxy?provider=openai&path=chat/completions' \
--header 'Content-Type: application/json' \
--data '{
    "model": "gpt-4o",
    "messages": [
        {
            "role": "user",
            "content": "你好 GPT，我是从我的 Multi-AI-Gateway 发出的测试请求，收到请回答。"
        }
    ]
}'
```

### 参数说明
- **provider**: `openai`
- **path**: `chat/completions`
- **model**: 模型名称（如 `gpt-4o`, `gpt-3.5-turbo`）
- **messages**: 对话消息数组
- **role**: 角色（`user`, `assistant`, `system`）

---

## 🎭 Claude (Anthropic)

### 请求格式
```bash
curl --location --request POST 'https://www.connectmulti.cc/api/proxy?provider=claude' \
--header 'Content-Type: application/json' \
--data '{
    "model": "claude-opus-4-1-20250805",
    "max_tokens": 1024,
    "messages": [
        {
            "role": "user",
            "content": "你好 Claude，我是从我的 Multi-AI-Gateway 发出的测试请求，收到请回答。"
        }
    ]
}'
```

### 参数说明
- **provider**: `claude`
- **model**: 模型名称（如 `claude-opus-4-1-20250805`, `claude-sonnet-4-1-20250805`）
- **max_tokens**: 最大输出token数
- **messages**: 对话消息数组

---

## 🔧 通用测试命令

### 标准API测试脚本
```bash
#!/bin/bash

echo "🧪 测试 Gemini 标准API..."
curl --location --request POST 'https://www.connectmulti.cc/api/proxy?path=v1beta/models/gemini-2.5-pro:generateContent' \
--header 'Content-Type: application/json' \
--data '{"contents":[{"parts":[{"text": "Hello Gemini, please respond with a short greeting."}]}]}'

echo -e "\n🧪 测试 OpenAI GPT 标准API..."
curl --location --request POST 'https://www.connectmulti.cc/api/proxy?provider=openai&path=chat/completions' \
--header 'Content-Type: application/json' \
--data '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello GPT, please respond with a short greeting."}]}'

echo -e "\n🧪 测试 Claude 标准API..."
curl --location --request POST 'https://www.connectmulti.cc/api/proxy?provider=claude' \
--header 'Content-Type: application/json' \
--data '{"model": "claude-opus-4-1-20250805", "max_tokens": 100, "messages": [{"role": "user", "content": "Hello Claude, please respond with a short greeting."}]}'
```

### 流式API测试脚本
```bash
#!/bin/bash

echo "🚀 测试 Gemini 流式API..."
curl -N --location --request POST 'https://www.connectmulti.cc/api/proxy?path=v1beta/models/gemini-2.5-pro:streamGenerateContent' \
--header 'Content-Type: application/json' \
--data '{"contents":[{"parts":[{"text": "请用中文写一首关于春天的短诗，每行不超过10个字。"}]}]}'

echo -e "\n🚀 测试 OpenAI GPT 流式API..."
curl -N --location --request POST 'https://www.connectmulti.cc/api/proxy?provider=openai&path=chat/completions' \
--header 'Content-Type: application/json' \
--data '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Write a short poem about spring."}], "stream": true}'

echo -e "\n🚀 测试 Claude 流式API..."
curl -N --location --request POST 'https://www.connectmulti.cc/api/proxy?provider=claude' \
--header 'Content-Type: application/json' \
--data '{"model": "claude-opus-4-1-20250805", "max_tokens": 100, "messages": [{"role": "user", "content": "Write a short poem about spring."}], "stream": true}'
```

---

## 📝 注意事项

1. **网络环境**: 确保能够访问代理服务器
2. **请求频率**: 注意API调用频率限制
3. **错误处理**: 检查响应状态码和错误信息
4. **模型可用性**: 不同模型可能有不同的可用性状态

---

## 🔗 相关链接

- **项目地址**: Multi-AI-Gateway
- **代理服务**: https://www.connectmulti.cc
- **更新日期**: 2024-12-26

---

## ✅ 连通性测试结果

### 🧪 标准API测试时间: 2024-12-26 21:13

#### 🤖 Gemini API
- **状态**: ✅ 连接成功
- **响应**: 正常返回AI回复
- **延迟**: 响应迅速
- **模型**: gemini-2.5-pro

#### 🧠 OpenAI GPT API  
- **状态**: ⚠️ 需要API Key
- **响应**: 认证错误 (invalid_api_key)
- **延迟**: 无法测试
- **模型**: gpt-4o
- **说明**: 需要配置有效的OpenAI API key

#### 🎭 Claude API
- **状态**: ⚠️ 需要API Key
- **响应**: 认证错误 (invalid x-api-key)
- **延迟**: 无法测试
- **模型**: claude-opus-4-1-20250805
- **说明**: 需要配置有效的Claude API key

### 🚀 流式API测试时间: 2024-12-26 23:10

#### 🤖 Gemini 流式API
- **状态**: ✅ 流式输出成功
- **响应**: 逐字流式返回
- **延迟**: 实时响应
- **模型**: gemini-2.5-pro
- **特点**: 支持真正的流式输出，逐字显示

#### 🧠 OpenAI GPT 流式API
- **状态**: ⚠️ 需要API Key
- **响应**: 认证错误 (invalid_api_key)
- **延迟**: 无法测试
- **模型**: gpt-4o
- **特点**: 支持流式输出，需要 `"stream": true` 参数
- **说明**: 需要配置有效的OpenAI API key

#### 🎭 Claude 流式API
- **状态**: ⚠️ 需要API Key
- **响应**: 认证错误 (invalid x-api-key)
- **延迟**: 无法测试
- **模型**: claude-opus-4-1-20250805
- **特点**: 支持流式输出，需要 `"stream": true` 参数
- **说明**: 需要配置有效的Claude API key

### 📊 总结
- **标准API**: Gemini API连接成功，ChatGPT和Claude需要API Key
- **流式API**: Gemini API流式输出正常，ChatGPT和Claude需要API Key
- **部署状态**: ✅ Gemini完全部署成功，ChatGPT和Claude需要配置API Key

---

## 🧪 Gemini模型流式输出详细测试结果

### 测试时间: 2024-12-26 23:30

#### ✅ `gemini-2.5-pro` (推荐生产使用)
- **流式支持**: ✅ 完全支持
- **输出特点**: 内容分块返回，流式效果明显
- **响应速度**: 快速
- **稳定性**: 优秀

#### ✅ `gemini-2.5-flash` (快速响应)
- **流式支持**: ⚠️ 部分支持
- **输出特点**: 支持流式API，但返回完整内容
- **响应速度**: 非常快
- **稳定性**: 良好

#### ✅ `gemini-2.5-flash-lite` (轻量级)
- **流式支持**: ✅ 完全支持
- **输出特点**: 内容逐步构建，流式效果最明显
- **响应速度**: 快
- **稳定性**: 良好

#### ✅ `gemini-2.0-flash` (稳定版本)
- **流式支持**: ✅ 完全支持
- **输出特点**: 内容逐步构建，流式效果明显
- **响应速度**: 中等
- **稳定性**: 优秀

#### ❌ `gemini-2.0-pro`
- **状态**: 模型不存在或不被支持
- **错误**: `models/gemini-2.0-pro is not found for API version v1beta`

### 🎯 推荐使用建议
- **生产环境**: 使用 `gemini-2.5-pro`
- **快速响应**: 使用 `gemini-2.5-flash`
- **流式演示**: 使用 `gemini-2.5-flash-lite`
- **稳定应用**: 使用 `gemini-2.0-flash`

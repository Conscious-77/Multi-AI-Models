# Agents_All

面向 Agent 能力的独立分区，隔离于主应用的常规聊天与后端逻辑，便于扩展与维护。

目录结构（初始）：

```
Agents_All/
  README.md
  server/
    Agent_Server.js                # Agent 专用后端路由注册（未接入主服务）
    protocol/
      tool_call.schema.json        # 轻量 JSON 协议的工具调用 Schema
      examples/
        generate_pdf.example.json  # generate_pdf 调用示例
  tools/
    README.md                      # 工具侧规范（参数、输出、超时、安全）
    生成PDF.py                      # 占位脚本（后续替换实现）
  frontend/
    README.md                      # 前端集成说明（组件、展示、下载按钮）
```

注意：当前未修改主应用与 `server.js` 行为，确保不影响既有功能。后续接入将采用“轻量 JSON 协议”方式进行工具调用。




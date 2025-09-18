# 工具规范（Tools）

- 执行入口: python3 生成PDF.py
- 输入: 从 stdin 读取 JSON。例如: {"title":"标题","content_markdown":"# 内容","output_path":"/abs/path/output.pdf"}
- 输出:
  - 成功: 退出码 0（可不写 stdout）
  - 失败: 退出码非 0（stderr 输出错误信息）
- 超时: 默认 60 秒（由 Node 侧控制）
- 文件安全: 文件名由服务端生成；脚本仅写入给定的绝对路径。

新增工具时，请在 Agents_All/server/Agent_Server.js 的 tools 注册表中登记。


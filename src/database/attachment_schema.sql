-- 附件上传功能数据库扩展
-- 创建时间: 2025-09-06
-- 描述: 为附件上传功能添加必要的数据库表结构

-- 1. 附件表 (attachments)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,                    -- 唯一标识符
  session_id TEXT NOT NULL,              -- 关联会话ID
  message_id INTEGER NOT NULL,           -- 关联消息ID
  filename TEXT NOT NULL,                -- 存储文件名
  original_name TEXT NOT NULL,           -- 原始文件名
  file_path TEXT NOT NULL,               -- 文件存储路径
  file_size INTEGER NOT NULL,            -- 文件大小（字节）
  mime_type TEXT NOT NULL,               -- MIME类型
  file_type TEXT NOT NULL,               -- 文件分类（image/document/audio/video）
  width INTEGER,                         -- 图片宽度（仅图片）
  height INTEGER,                        -- 图片高度（仅图片）
  duration INTEGER,                      -- 音频/视频时长（秒）
  thumbnail_path TEXT,                   -- 缩略图路径
  metadata TEXT,                         -- 额外元数据（JSON格式）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- 2. 扩展消息表 (messages) - 添加附件支持字段
ALTER TABLE messages ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN attachment_ids TEXT; -- JSON数组存储附件ID
ALTER TABLE messages ADD COLUMN multimodal_content BOOLEAN DEFAULT FALSE; -- 是否包含多模态内容

-- 3. 文件处理日志表 (file_processing_logs)
CREATE TABLE IF NOT EXISTS file_processing_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_id TEXT NOT NULL,
  process_type TEXT NOT NULL,            -- 处理类型（upload/compress/convert/error）
  status TEXT NOT NULL,                  -- 处理状态（success/failed/processing）
  error_message TEXT,                    -- 错误信息
  processing_time INTEGER,               -- 处理耗时（毫秒）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
);

-- 4. 性能优化索引
CREATE INDEX IF NOT EXISTS idx_attachments_session_id ON attachments(session_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_file_type ON attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);
CREATE INDEX IF NOT EXISTS idx_file_logs_attachment_id ON file_processing_logs(attachment_id);
CREATE INDEX IF NOT EXISTS idx_file_logs_status ON file_processing_logs(status);

-- 5. 更新现有索引（如果需要）
-- 为messages表的新字段添加索引
CREATE INDEX IF NOT EXISTS idx_messages_has_attachments ON messages(has_attachments);
CREATE INDEX IF NOT EXISTS idx_messages_multimodal_content ON messages(multimodal_content);

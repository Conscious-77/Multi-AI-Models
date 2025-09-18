const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库文件路径
const DB_PATH = path.join(process.cwd(), 'chat_history.db');

// 数据库连接实例
let db = null;

/**
 * 获取数据库连接
 */
function getDatabase() {
  if (!db) {
    // 确保数据库目录存在
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // 创建数据库连接
    db = new Database(DB_PATH);
    
    // 启用外键约束
    db.pragma('foreign_keys = ON');
    
    // 初始化数据库表
    initializeTables();
    
    console.log(`🗄️ 数据库已连接: ${DB_PATH}`);
  }
  return db;
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('🗄️ 数据库连接已关闭');
  }
}

/**
 * 初始化数据库表结构
 */
function initializeTables() {
  const db = getDatabase();
  
  // 创建会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      message_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    )
  `);
  
  // 创建消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'model')),
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      sequence_order INTEGER NOT NULL,
      model_provider TEXT,
      model_name TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  
  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sequence_order ON messages(session_id, sequence_order);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
  `);
  
  // 初始化附件相关表结构
  initializeAttachmentTables();
  
  console.log('🗄️ 数据库表结构已初始化');
}

/**
 * 获取数据库统计信息
 */
function getDatabaseStats() {
  const db = getDatabase();
  
  const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
  const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
  
  // 获取数据库文件大小
  let dbSize = '0 KB';
  try {
    const stats = fs.statSync(DB_PATH);
    dbSize = `${(stats.size / 1024).toFixed(2)} KB`;
  } catch (error) {
    console.warn('无法获取数据库文件大小:', error);
  }
  
  return {
    sessionCount: sessionCount.count,
    messageCount: messageCount.count,
    dbSize
  };
}

// 进程退出时关闭数据库连接
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

/**
 * 初始化附件相关表结构
 */
function initializeAttachmentTables() {
  const db = getDatabase();
  
  try {
    // 1. 创建附件表
    db.exec(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        message_id INTEGER,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        file_type TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        duration INTEGER,
        thumbnail_path TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);
    
    // 2. 扩展消息表 - 添加附件支持字段
    // 检查字段是否已存在，避免重复添加
    const messagesColumns = db.prepare("PRAGMA table_info(messages)").all();
    const hasAttachmentFields = messagesColumns.some(col => 
      ['has_attachments', 'attachment_ids', 'multimodal_content'].includes(col.name)
    );
    
    if (!hasAttachmentFields) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN has_attachments BOOLEAN DEFAULT FALSE;
        ALTER TABLE messages ADD COLUMN attachment_ids TEXT;
        ALTER TABLE messages ADD COLUMN multimodal_content BOOLEAN DEFAULT FALSE;
      `);
    }
    
    // 3. 创建文件处理日志表
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_processing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attachment_id TEXT NOT NULL,
        process_type TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        processing_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
      )
    `);
    
    // 4. 创建附件相关索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_attachments_session_id ON attachments(session_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_file_type ON attachments(file_type);
      CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at);
      CREATE INDEX IF NOT EXISTS idx_file_logs_attachment_id ON file_processing_logs(attachment_id);
      CREATE INDEX IF NOT EXISTS idx_file_logs_status ON file_processing_logs(status);
      CREATE INDEX IF NOT EXISTS idx_messages_has_attachments ON messages(has_attachments);
      CREATE INDEX IF NOT EXISTS idx_messages_multimodal_content ON messages(multimodal_content);
    `);
    
    console.log('📎 附件相关表结构已初始化');
  } catch (error) {
    console.error('❌ 初始化附件表结构失败:', error.message);
    throw error;
  }
}

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

module.exports = {
  getDatabase,
  closeDatabase,
  getDatabaseStats
};

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径
const DB_PATH = path.join(process.cwd(), 'chat_history.db');

// 数据库连接实例
let db: Database.Database | null = null;

/**
 * 获取数据库连接
 */
export function getDatabase(): Database.Database {
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
    
    // 初始化数据库表 - 避免递归调用
    initializeTablesDirect(db);
    
    console.log(`🗄️ 数据库已连接: ${DB_PATH}`);
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('🗄️ 数据库连接已关闭');
  }
}

/**
 * 初始化数据库表结构 - 直接接受数据库实例
 */
function initializeTablesDirect(db: Database.Database): void {
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
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);
  
  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sequence_order ON messages(session_id, sequence_order);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
  `);
  
  console.log('🗄️ 数据库表结构已初始化');
}

/**
 * 初始化数据库表结构 - 保持向后兼容
 */
function initializeTables(): void {
  const db = getDatabase();
  initializeTablesDirect(db);
}

/**
 * 获取数据库统计信息
 */
export function getDatabaseStats(): { 
  sessionCount: number; 
  messageCount: number; 
  dbSize: string 
} {
  const db = getDatabase();
  
  const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
  const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
  
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

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

export default getDatabase;

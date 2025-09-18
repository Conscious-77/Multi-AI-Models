const { getDatabase } = require('./database');

/**
 * 生成对话标题
 * 格式：前5个字符 + | + YY/MM/DD HH:MM
 */
function generateSessionTitle(firstMessage) {
  const now = new Date();
  const dateStr = now.getFullYear().toString().slice(-2) + '/' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '/' + 
                  String(now.getDate()).padStart(2, '0');
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + 
                  String(now.getMinutes()).padStart(2, '0');
  
  // 取前5个字符，如果不足5个字符则全部使用
  const prefix = firstMessage.slice(0, 5);
  
  return `${prefix} | ${dateStr} ${timeStr}`;
}

/**
 * 创建新会话
 */
function createSession(sessionId, firstMessage) {
  const db = getDatabase();
  const title = generateSessionTitle(firstMessage);
  
  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, created_at, last_activity, message_count, status)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 'active')
  `);
  
  stmt.run(sessionId, title);
  
  console.log(`🗄️ 新会话已创建: ${sessionId} - ${title}`);
  
  return {
    id: sessionId,
    title,
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    message_count: 0,
    status: 'active'
  };
}

/**
 * 获取会话信息
 */
function getSession(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, title, created_at, last_activity, message_count, status
    FROM sessions WHERE id = ?
  `);
  
  const result = stmt.get(sessionId);
  return result || null;
}

/**
 * 获取所有会话摘要
 */
function getAllSessions() {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, title, created_at, last_activity, message_count, status
    FROM sessions 
    ORDER BY last_activity DESC
  `);
  
  return stmt.all();
}

/**
 * 更新会话最后活动时间
 */
function updateSessionActivity(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE sessions 
    SET last_activity = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  stmt.run(sessionId);
}

/**
 * 更新会话消息数量
 */
function updateSessionMessageCount(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE sessions 
    SET message_count = (
      SELECT COUNT(*) FROM messages WHERE session_id = ?
    )
    WHERE id = ?
  `);
  
  stmt.run(sessionId, sessionId);
}

/**
 * 删除会话
 */
function deleteSession(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(sessionId);
  
  if (result.changes > 0) {
    console.log(`🗄️ 会话已删除: ${sessionId}`);
    return true;
  }
  
  return false;
}

/**
 * 检查会话是否存在
 */
function sessionExists(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE id = ?');
  const result = stmt.get(sessionId);
  
  return result.count > 0;
}

/**
 * 获取活跃会话数量
 */
function getActiveSessionCount() {
  const db = getDatabase();
  
  const stmt = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'");
  const result = stmt.get();
  
  return result.count;
}

module.exports = {
  createSession,
  getSession,
  getAllSessions,
  updateSessionActivity,
  updateSessionMessageCount,
  deleteSession,
  sessionExists,
  getActiveSessionCount,
  generateSessionTitle
};

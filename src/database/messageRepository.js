const { getDatabase } = require('./database');

// 默认模型配置
const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  gpt: 'gpt-4o',
  claude: 'claude-opus-4-1-20250805'
};

/**
 * 添加新消息到数据库
 * @param {Object} messageInput - 消息输入对象
 * @param {string} messageInput.session_id - 会话ID
 * @param {string} messageInput.role - 角色 (user/model)
 * @param {string} messageInput.content - 消息内容
 * @param {string} [messageInput.model_provider] - 模型提供商
 * @param {string} [messageInput.model_name] - 模型名称
 * @returns {Object} 新消息对象
 */
function addMessage(messageInput) {
  const db = getDatabase();
  
  // 获取当前会话的最大序列号
  const maxOrderStmt = db.prepare(`
    SELECT COALESCE(MAX(sequence_order), 0) as max_order
    FROM messages 
    WHERE session_id = ?
  `);
  
  const maxOrder = maxOrderStmt.get(messageInput.session_id);
  const sequenceOrder = maxOrder.max_order + 1;
  
  // 插入新消息（包含模型信息）
  const insertStmt = db.prepare(`
    INSERT INTO messages (session_id, role, content, sequence_order, model_provider, model_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = insertStmt.run(
    messageInput.session_id,
    messageInput.role,
    messageInput.content,
    sequenceOrder,
    messageInput.model_provider || 'gemini',
    messageInput.model_name || DEFAULT_MODELS.gemini
  );
  
  console.log(`🗄️ 新消息已添加: ${messageInput.role} -> ${messageInput.content.slice(0, 50)}...`);
  
  return {
    id: result.lastInsertRowid,
    session_id: messageInput.session_id,
    role: messageInput.role,
    content: messageInput.content,
    timestamp: new Date().toISOString(),
    sequence_order: sequenceOrder,
    model_provider: messageInput.model_provider || 'gemini',
    model_name: messageInput.model_name || DEFAULT_MODELS.gemini
  };
}

/**
 * 获取会话的所有消息（按顺序）
 */
function getSessionMessages(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, session_id, role, content, timestamp, sequence_order, model_provider, model_name
    FROM messages 
    WHERE session_id = ?
    ORDER BY sequence_order ASC
  `);
  
  return stmt.all(sessionId);
}

/**
 * 获取会话的消息数量
 */
function getSessionMessageCount(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?');
  const result = stmt.get(sessionId);
  
  return result.count;
}

/**
 * 删除会话的所有消息
 */
function deleteSessionMessages(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare('DELETE FROM messages WHERE session_id = ?');
  const result = stmt.run(sessionId);
  
  console.log(`🗄️ 会话消息已删除: ${sessionId} (${result.changes} 条消息)`);
  
  return result.changes;
}

/**
 * 获取消息内容（用于Gemini API调用）
 * 返回格式：{ role: string, parts: { text: string }[] }[]
 */
function getMessagesForGemini(sessionId) {
  const messages = getSessionMessages(sessionId);
  
  return messages.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
}

/**
 * 批量添加消息到会话
 */
function addMessagesToSession(sessionId, messages) {
  const db = getDatabase();
  
  // 开始事务
  const transaction = db.transaction(() => {
    let sequenceOrder = 1;
    
    // 获取当前会话的最大序列号
    const maxOrderStmt = db.prepare(`
      SELECT COALESCE(MAX(sequence_order), 0) as max_order
      FROM messages 
      WHERE session_id = ?
    `);
    
    const maxOrder = maxOrderStmt.get(sessionId);
    sequenceOrder = maxOrder.max_order + 1;
    
    // 插入所有消息（包含模型信息）
    const insertStmt = db.prepare(`
      INSERT INTO messages (session_id, role, content, timestamp, sequence_order, model_provider, model_name)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
    `);
    
    for (const message of messages) {
      insertStmt.run(
        sessionId, 
        message.role, 
        message.content, 
        sequenceOrder,
        message.model_provider || 'gemini',
        message.model_name || DEFAULT_MODELS.gemini
      );
      sequenceOrder++;
    }
  });
  
  // 执行事务
  transaction();
  
  console.log(`🗄️ 批量消息已添加: ${sessionId} (${messages.length} 条消息)`);
}

/**
 * 获取最近的消息（用于调试）
 */
function getRecentMessages(limit = 10) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, session_id, role, content, timestamp, sequence_order, model_provider, model_name
    FROM messages 
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  return stmt.all(limit);
}

/**
 * 搜索消息内容
 */
function searchMessages(query, sessionId) {
  const db = getDatabase();
  
  let sql = `
    SELECT id, session_id, role, content, timestamp, sequence_order, model_provider, model_name
    FROM messages 
    WHERE content LIKE ?
  `;
  
  const params = [`%${query}%`];
  
  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }
  
  sql += ' ORDER BY timestamp DESC LIMIT 50';
  
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * 获取会话中AI消息的模型信息
 */
function getMessageModelInfo(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT DISTINCT model_provider, model_name
    FROM messages 
    WHERE session_id = ? AND role = 'model'
    ORDER BY sequence_order DESC
    LIMIT 1
  `);
  
  return stmt.get(sessionId);
}

/**
 * 获取会话中使用的所有模型统计
 */
function getSessionModelStats(sessionId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT model_provider, model_name, COUNT(*) as usage_count
    FROM messages 
    WHERE session_id = ? AND role = 'model'
    GROUP BY model_provider, model_name
    ORDER BY usage_count DESC
  `);
  
  return stmt.all(sessionId);
}

module.exports = {
  addMessage,
  getSessionMessages,
  getSessionMessageCount,
  deleteSessionMessages,
  getMessagesForGemini,
  addMessagesToSession,
  getRecentMessages,
  searchMessages,
  getMessageModelInfo,
  getSessionModelStats
};

import { getDatabase } from './database';

export interface Message {
  id: number;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  sequence_order: number;
}

export interface MessageInput {
  session_id: string;
  role: 'user' | 'model';
  content: string;
}

/**
 * 添加新消息到会话
 */
export function addMessage(messageInput: MessageInput): Message {
  const db = getDatabase();
  
  // 获取当前会话的下一个序列号
  const nextOrderStmt = db.prepare(`
    SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order
    FROM messages 
    WHERE session_id = ?
  `);
  
  const nextOrder = nextOrderStmt.get(messageInput.session_id) as { next_order: number };
  const sequenceOrder = nextOrder.next_order;
  
  // 插入新消息
  const insertStmt = db.prepare(`
    INSERT INTO messages (session_id, role, content, timestamp, sequence_order)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
  `);
  
  const result = insertStmt.run(
    messageInput.session_id,
    messageInput.role,
    messageInput.content,
    sequenceOrder
  );
  
  console.log(`🗄️ 新消息已添加: ${messageInput.role} -> ${messageInput.content.slice(0, 50)}...`);
  
  return {
    id: result.lastInsertRowid as number,
    session_id: messageInput.session_id,
    role: messageInput.role,
    content: messageInput.content,
    timestamp: new Date().toISOString(),
    sequence_order: sequenceOrder
  };
}

/**
 * 获取会话的所有消息（按顺序）
 */
export function getSessionMessages(sessionId: string): Message[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, session_id, role, content, timestamp, sequence_order
    FROM messages 
    WHERE session_id = ?
    ORDER BY sequence_order ASC
  `);
  
  return stmt.all(sessionId) as Message[];
}

/**
 * 获取会话的消息数量
 */
export function getSessionMessageCount(sessionId: string): number {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?');
  const result = stmt.get(sessionId) as { count: number };
  
  return result.count;
}

/**
 * 删除会话的所有消息
 */
export function deleteSessionMessages(sessionId: string): number {
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
export function getMessagesForGemini(sessionId: string): Array<{ role: string; parts: { text: string }[] }> {
  const messages = getSessionMessages(sessionId);
  
  return messages.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
}

/**
 * 批量添加消息到会话
 */
export function addMessagesToSession(sessionId: string, messages: Array<{ role: 'user' | 'model'; content: string }>): void {
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
    
    const maxOrder = maxOrderStmt.get(sessionId) as { max_order: number };
    sequenceOrder = maxOrder.max_order + 1;
    
    // 插入所有消息
    const insertStmt = db.prepare(`
      INSERT INTO messages (session_id, role, content, timestamp, sequence_order)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    
    for (const message of messages) {
      insertStmt.run(sessionId, message.role, message.content, sequenceOrder);
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
export function getRecentMessages(limit: number = 10): Message[] {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT id, session_id, role, content, timestamp, sequence_order
    FROM messages 
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  return stmt.all(limit) as Message[];
}

/**
 * 搜索消息内容
 */
export function searchMessages(query: string, sessionId?: string): Message[] {
  const db = getDatabase();
  
  let sql = `
    SELECT id, session_id, role, content, timestamp, sequence_order
    FROM messages 
    WHERE content LIKE ?
  `;
  
  const params: any[] = [`%${query}%`];
  
  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }
  
  sql += ' ORDER BY timestamp DESC LIMIT 50';
  
  const stmt = db.prepare(sql);
  return stmt.all(...params) as Message[];
}

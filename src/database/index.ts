// 数据库核心模块
export { 
  getDatabase, 
  closeDatabase, 
  getDatabaseStats 
} from './database';

// 会话管理
export { 
  createSession,
  getSession,
  getAllSessions,
  updateSessionActivity,
  updateSessionMessageCount,
  deleteSession,
  sessionExists,
  getActiveSessionCount,
  generateSessionTitle,
  type Session,
  type SessionSummary
} from './sessionRepository';

// 消息管理
export { 
  addMessage,
  getSessionMessages,
  getSessionMessageCount,
  deleteSessionMessages,
  getMessagesForGemini,
  addMessagesToSession,
  getRecentMessages,
  searchMessages,
  type Message,
  type MessageInput
} from './messageRepository';

// 数据库核心模块
const database = require('./database');
const sessionRepository = require('./sessionRepository');
const messageRepository = require('./messageRepository');

// 统一导出所有功能
module.exports = {
  // 数据库核心
  getDatabase: database.getDatabase,
  closeDatabase: database.closeDatabase,
  getDatabaseStats: database.getDatabaseStats,
  
  // 会话管理
  createSession: sessionRepository.createSession,
  getSession: sessionRepository.getSession,
  getAllSessions: sessionRepository.getAllSessions,
  updateSessionActivity: sessionRepository.updateSessionActivity,
  updateSessionMessageCount: sessionRepository.updateSessionMessageCount,
  updateSessionTitle: sessionRepository.updateSessionTitle,
  deleteSession: sessionRepository.deleteSession,
  sessionExists: sessionRepository.sessionExists,
  getActiveSessionCount: sessionRepository.getActiveSessionCount,
  generateSessionTitle: sessionRepository.generateSessionTitle,
  
  // 消息管理
  addMessage: messageRepository.addMessage,
  getSessionMessages: messageRepository.getSessionMessages,
  getSessionMessageCount: messageRepository.getSessionMessageCount,
  deleteSessionMessages: messageRepository.deleteSessionMessages,
  getMessagesForGemini: messageRepository.getMessagesForGemini,
  addMessagesToSession: messageRepository.addMessagesToSession,
  getRecentMessages: messageRepository.getRecentMessages,
  searchMessages: messageRepository.searchMessages,
  
  // 新增：模型信息相关函数
  getMessageModelInfo: messageRepository.getMessageModelInfo,
  getSessionModelStats: messageRepository.getSessionModelStats
};

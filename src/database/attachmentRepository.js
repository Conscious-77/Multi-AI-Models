const { getDatabase } = require('./database');
const { v4: uuidv4 } = require('uuid');

/**
 * 附件数据访问层
 * 提供附件的CRUD操作和查询功能
 */

/**
 * 添加附件记录
 * @param {Object} attachmentData - 附件数据
 * @param {string} attachmentData.sessionId - 会话ID
 * @param {number} attachmentData.messageId - 消息ID
 * @param {string} attachmentData.filename - 存储文件名
 * @param {string} attachmentData.originalName - 原始文件名
 * @param {string} attachmentData.filePath - 文件存储路径
 * @param {number} attachmentData.fileSize - 文件大小（字节）
 * @param {string} attachmentData.mimeType - MIME类型
 * @param {string} attachmentData.fileType - 文件分类
 * @param {Object} attachmentData.metadata - 额外元数据
 * @param {number} attachmentData.width - 图片宽度（可选）
 * @param {number} attachmentData.height - 图片高度（可选）
 * @param {number} attachmentData.duration - 音频/视频时长（可选）
 * @param {string} attachmentData.thumbnailPath - 缩略图路径（可选）
 * @returns {string} 附件ID
 */
function addAttachment(attachmentData) {
  const db = getDatabase();
  const attachmentId = uuidv4();
  
  const {
    sessionId,
    messageId,
    filename,
    originalName,
    filePath,
    fileSize,
    mimeType,
    fileType,
    metadata = {},
    width = null,
    height = null,
    duration = null,
    thumbnailPath = null
  } = attachmentData;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO attachments (
        id, session_id, message_id, filename, original_name, file_path,
        file_size, mime_type, file_type, width, height, duration,
        thumbnail_path, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      attachmentId,
      sessionId,
      messageId,
      filename,
      originalName,
      filePath,
      fileSize,
      mimeType,
      fileType,
      width,
      height,
      duration,
      thumbnailPath,
      JSON.stringify(metadata)
    );
    
    console.log(`📎 附件已添加: ${attachmentId} (${originalName})`);
    return attachmentId;
  } catch (error) {
    console.error('❌ 添加附件失败:', error.message);
    throw error;
  }
}

/**
 * 根据ID获取附件信息
 * @param {string} attachmentId - 附件ID
 * @returns {Object|null} 附件信息
 */
function getAttachmentById(attachmentId) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, session_id, message_id, filename, original_name, file_path,
        file_size, mime_type, file_type, width, height, duration,
        thumbnail_path, metadata, created_at, updated_at
      FROM attachments 
      WHERE id = ?
    `);
    
    const attachment = stmt.get(attachmentId);
    
    if (attachment) {
      // 解析JSON元数据
      attachment.metadata = JSON.parse(attachment.metadata || '{}');
    }
    
    return attachment;
  } catch (error) {
    console.error('❌ 获取附件失败:', error.message);
    throw error;
  }
}

/**
 * 根据会话ID获取所有附件
 * @param {string} sessionId - 会话ID
 * @returns {Array} 附件列表
 */
function getAttachmentsBySession(sessionId) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, session_id, message_id, filename, original_name, file_path,
        file_size, mime_type, file_type, width, height, duration,
        thumbnail_path, metadata, created_at, updated_at
      FROM attachments 
      WHERE session_id = ?
      ORDER BY created_at DESC
    `);
    
    const attachments = stmt.all(sessionId);
    
    // 解析JSON元数据
    attachments.forEach(attachment => {
      attachment.metadata = JSON.parse(attachment.metadata || '{}');
    });
    
    return attachments;
  } catch (error) {
    console.error('❌ 获取会话附件失败:', error.message);
    throw error;
  }
}

/**
 * 根据消息ID获取附件
 * @param {number} messageId - 消息ID
 * @returns {Array} 附件列表
 */
function getAttachmentsByMessage(messageId) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, session_id, message_id, filename, original_name, file_path,
        file_size, mime_type, file_type, width, height, duration,
        thumbnail_path, metadata, created_at, updated_at
      FROM attachments 
      WHERE message_id = ?
      ORDER BY created_at ASC
    `);
    
    const attachments = stmt.all(messageId);
    
    // 解析JSON元数据
    attachments.forEach(attachment => {
      attachment.metadata = JSON.parse(attachment.metadata || '{}');
    });
    
    return attachments;
  } catch (error) {
    console.error('❌ 获取消息附件失败:', error.message);
    throw error;
  }
}

/**
 * 更新附件的消息ID
 * @param {string} attachmentId - 附件ID
 * @param {number} messageId - 消息ID
 * @returns {boolean} 是否更新成功
 */
function updateAttachmentMessageId(attachmentId, messageId) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      UPDATE attachments 
      SET message_id = ? 
      WHERE id = ?
    `);
    
    const result = stmt.run(messageId, attachmentId);
    
    if (result.changes > 0) {
      console.log(`✅ 附件 ${attachmentId} 的消息ID已更新为 ${messageId}`);
      return true;
    } else {
      console.log(`⚠️ 附件 ${attachmentId} 未找到或未更新`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 更新附件消息ID失败: ${error.message}`);
    return false;
  }
}

/**
 * 更新附件信息
 * @param {string} attachmentId - 附件ID
 * @param {Object} updateData - 更新数据
 * @returns {boolean} 是否更新成功
 */
function updateAttachment(attachmentId, updateData) {
  const db = getDatabase();
  
  try {
    const allowedFields = [
      'filename', 'file_path', 'file_size', 'mime_type', 'file_type',
      'width', 'height', 'duration', 'thumbnail_path', 'metadata'
    ];
    
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(
          key === 'metadata' ? JSON.stringify(updateData[key]) : updateData[key]
        );
      }
    });
    
    if (updateFields.length === 0) {
      return false;
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(attachmentId);
    
    const stmt = db.prepare(`
      UPDATE attachments 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);
    
    const result = stmt.run(...updateValues);
    
    if (result.changes > 0) {
      console.log(`📎 附件已更新: ${attachmentId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ 更新附件失败:', error.message);
    throw error;
  }
}

/**
 * 删除附件
 * @param {string} attachmentId - 附件ID
 * @returns {boolean} 是否删除成功
 */
function deleteAttachment(attachmentId) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare('DELETE FROM attachments WHERE id = ?');
    const result = stmt.run(attachmentId);
    
    if (result.changes > 0) {
      console.log(`📎 附件已删除: ${attachmentId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ 删除附件失败:', error.message);
    throw error;
  }
}

/**
 * 根据文件类型获取附件
 * @param {string} fileType - 文件类型 (image/document/audio/video)
 * @param {string} sessionId - 会话ID（可选）
 * @returns {Array} 附件列表
 */
function getAttachmentsByType(fileType, sessionId = null) {
  const db = getDatabase();
  
  try {
    let sql = `
      SELECT 
        id, session_id, message_id, filename, original_name, file_path,
        file_size, mime_type, file_type, width, height, duration,
        thumbnail_path, metadata, created_at, updated_at
      FROM attachments 
      WHERE file_type = ?
    `;
    
    const params = [fileType];
    
    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const stmt = db.prepare(sql);
    const attachments = stmt.all(...params);
    
    // 解析JSON元数据
    attachments.forEach(attachment => {
      attachment.metadata = JSON.parse(attachment.metadata || '{}');
    });
    
    return attachments;
  } catch (error) {
    console.error('❌ 根据类型获取附件失败:', error.message);
    throw error;
  }
}

/**
 * 获取附件统计信息
 * @param {string} sessionId - 会话ID（可选）
 * @returns {Object} 统计信息
 */
function getAttachmentStats(sessionId = null) {
  const db = getDatabase();
  
  try {
    let sql = `
      SELECT 
        COUNT(*) as total_count,
        SUM(file_size) as total_size,
        file_type,
        COUNT(*) as count_by_type
      FROM attachments
    `;
    
    const params = [];
    
    if (sessionId) {
      sql += ' WHERE session_id = ?';
      params.push(sessionId);
    }
    
    sql += ' GROUP BY file_type';
    
    const stmt = db.prepare(sql);
    const stats = stmt.all(...params);
    
    const result = {
      totalCount: 0,
      totalSize: 0,
      byType: {}
    };
    
    stats.forEach(stat => {
      result.totalCount += stat.count_by_type;
      result.totalSize += stat.total_size || 0;
      result.byType[stat.file_type] = {
        count: stat.count_by_type,
        size: stat.total_size || 0
      };
    });
    
    return result;
  } catch (error) {
    console.error('❌ 获取附件统计失败:', error.message);
    throw error;
  }
}

/**
 * 搜索附件
 * @param {string} query - 搜索关键词
 * @param {string} sessionId - 会话ID（可选）
 * @returns {Array} 附件列表
 */
function searchAttachments(query, sessionId = null) {
  const db = getDatabase();
  
  try {
    let sql = `
      SELECT 
        id, session_id, message_id, filename, original_name, file_path,
        file_size, mime_type, file_type, width, height, duration,
        thumbnail_path, metadata, created_at, updated_at
      FROM attachments 
      WHERE (original_name LIKE ? OR filename LIKE ?)
    `;
    
    const params = [`%${query}%`, `%${query}%`];
    
    if (sessionId) {
      sql += ' AND session_id = ?';
      params.push(sessionId);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const stmt = db.prepare(sql);
    const attachments = stmt.all(...params);
    
    // 解析JSON元数据
    attachments.forEach(attachment => {
      attachment.metadata = JSON.parse(attachment.metadata || '{}');
    });
    
    return attachments;
  } catch (error) {
    console.error('❌ 搜索附件失败:', error.message);
    throw error;
  }
}

module.exports = {
  addAttachment,
  getAttachmentById,
  getAttachmentsBySession,
  getAttachmentsByMessage,
  updateAttachment,
  updateAttachmentMessageId,
  deleteAttachment,
  getAttachmentsByType,
  getAttachmentStats,
  searchAttachments
};

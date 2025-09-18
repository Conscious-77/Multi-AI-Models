const { getDatabase } = require('./database');

/**
 * 文件处理日志数据访问层
 * 记录文件上传、处理、转换等操作的日志
 */

/**
 * 添加处理日志
 * @param {Object} logData - 日志数据
 * @param {string} logData.attachmentId - 附件ID
 * @param {string} logData.processType - 处理类型 (upload/compress/convert/error)
 * @param {string} logData.status - 处理状态 (success/failed/processing)
 * @param {string} logData.errorMessage - 错误信息（可选）
 * @param {number} logData.processingTime - 处理耗时（毫秒）
 * @returns {number} 日志ID
 */
function addProcessingLog(logData) {
  const db = getDatabase();
  
  const {
    attachmentId,
    processType,
    status,
    errorMessage = null,
    processingTime = null
  } = logData;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO file_processing_logs (
        attachment_id, process_type, status, error_message, processing_time
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(attachmentId, processType, status, errorMessage, processingTime);
    
    console.log(`📝 处理日志已添加: ${attachmentId} - ${processType} - ${status}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('❌ 添加处理日志失败:', error.message);
    throw error;
  }
}

/**
 * 根据附件ID获取处理日志
 * @param {string} attachmentId - 附件ID
 * @returns {Array} 处理日志列表
 */
function getProcessingLogsByAttachment(attachmentId) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, attachment_id, process_type, status, error_message,
        processing_time, created_at
      FROM file_processing_logs 
      WHERE attachment_id = ?
      ORDER BY created_at ASC
    `);
    
    return stmt.all(attachmentId);
  } catch (error) {
    console.error('❌ 获取处理日志失败:', error.message);
    throw error;
  }
}

/**
 * 根据处理类型获取日志
 * @param {string} processType - 处理类型
 * @param {number} limit - 限制数量（可选）
 * @returns {Array} 处理日志列表
 */
function getProcessingLogsByType(processType, limit = 100) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, attachment_id, process_type, status, error_message,
        processing_time, created_at
      FROM file_processing_logs 
      WHERE process_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(processType, limit);
  } catch (error) {
    console.error('❌ 根据类型获取处理日志失败:', error.message);
    throw error;
  }
}

/**
 * 根据状态获取日志
 * @param {string} status - 处理状态
 * @param {number} limit - 限制数量（可选）
 * @returns {Array} 处理日志列表
 */
function getProcessingLogsByStatus(status, limit = 100) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, attachment_id, process_type, status, error_message,
        processing_time, created_at
      FROM file_processing_logs 
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(status, limit);
  } catch (error) {
    console.error('❌ 根据状态获取处理日志失败:', error.message);
    throw error;
  }
}

/**
 * 获取处理统计信息
 * @param {string} attachmentId - 附件ID（可选）
 * @returns {Object} 统计信息
 */
function getProcessingStats(attachmentId = null) {
  const db = getDatabase();
  
  try {
    let sql = `
      SELECT 
        process_type,
        status,
        COUNT(*) as count,
        AVG(processing_time) as avg_processing_time,
        MAX(processing_time) as max_processing_time,
        MIN(processing_time) as min_processing_time
      FROM file_processing_logs
    `;
    
    const params = [];
    
    if (attachmentId) {
      sql += ' WHERE attachment_id = ?';
      params.push(attachmentId);
    }
    
    sql += ' GROUP BY process_type, status';
    
    const stmt = db.prepare(sql);
    const stats = stmt.all(...params);
    
    const result = {
      byType: {},
      byStatus: {},
      total: 0,
      avgProcessingTime: 0
    };
    
    let totalCount = 0;
    let totalProcessingTime = 0;
    
    stats.forEach(stat => {
      const { process_type, status, count, avg_processing_time } = stat;
      
      totalCount += count;
      totalProcessingTime += (avg_processing_time || 0) * count;
      
      // 按类型统计
      if (!result.byType[process_type]) {
        result.byType[process_type] = { success: 0, failed: 0, processing: 0 };
      }
      result.byType[process_type][status] = count;
      
      // 按状态统计
      if (!result.byStatus[status]) {
        result.byStatus[status] = 0;
      }
      result.byStatus[status] += count;
    });
    
    result.total = totalCount;
    result.avgProcessingTime = totalCount > 0 ? totalProcessingTime / totalCount : 0;
    
    return result;
  } catch (error) {
    console.error('❌ 获取处理统计失败:', error.message);
    throw error;
  }
}

/**
 * 获取失败的处理日志
 * @param {number} limit - 限制数量（可选）
 * @returns {Array} 失败日志列表
 */
function getFailedProcessingLogs(limit = 50) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      SELECT 
        id, attachment_id, process_type, status, error_message,
        processing_time, created_at
      FROM file_processing_logs 
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  } catch (error) {
    console.error('❌ 获取失败日志失败:', error.message);
    throw error;
  }
}

/**
 * 清理旧的处理日志
 * @param {number} days - 保留天数
 * @returns {number} 删除的记录数
 */
function cleanupOldLogs(days = 30) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      DELETE FROM file_processing_logs 
      WHERE created_at < datetime('now', '-${days} days')
    `);
    
    const result = stmt.run();
    
    console.log(`🧹 清理了 ${result.changes} 条旧处理日志`);
    return result.changes;
  } catch (error) {
    console.error('❌ 清理旧日志失败:', error.message);
    throw error;
  }
}

/**
 * 更新处理日志状态
 * @param {number} logId - 日志ID
 * @param {string} status - 新状态
 * @param {string} errorMessage - 错误信息（可选）
 * @param {number} processingTime - 处理耗时（可选）
 * @returns {boolean} 是否更新成功
 */
function updateProcessingLogStatus(logId, status, errorMessage = null, processingTime = null) {
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      UPDATE file_processing_logs 
      SET status = ?, error_message = ?, processing_time = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(status, errorMessage, processingTime, logId);
    
    if (result.changes > 0) {
      console.log(`📝 处理日志状态已更新: ${logId} - ${status}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ 更新处理日志状态失败:', error.message);
    throw error;
  }
}

module.exports = {
  addProcessingLog,
  getProcessingLogsByAttachment,
  getProcessingLogsByType,
  getProcessingLogsByStatus,
  getProcessingStats,
  getFailedProcessingLogs,
  cleanupOldLogs,
  updateProcessingLogStatus
};

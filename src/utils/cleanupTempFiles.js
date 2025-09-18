const fs = require('fs');
const path = require('path');

/**
 * 临时文件清理工具
 * 清理超过指定时间的临时文件
 */

/**
 * 清理临时文件
 * @param {number} maxAgeHours - 最大保留时间（小时），默认72小时
 * @returns {Object} 清理结果
 */
function cleanupTempFiles(maxAgeHours = 72) {
  const tempDir = path.join(__dirname, '../../uploads/temp');
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000; // 转换为毫秒
  const now = Date.now();
  
  let cleanedCount = 0;
  let totalSize = 0;
  let errors = [];
  
  console.log(`🧹 开始清理临时文件，最大保留时间: ${maxAgeHours}小时`);
  
  try {
    // 检查临时目录是否存在
    if (!fs.existsSync(tempDir)) {
      console.log('📁 临时目录不存在，无需清理');
      return {
        success: true,
        cleanedCount: 0,
        totalSize: 0,
        errors: []
      };
    }
    
    // 读取临时目录中的所有文件
    const files = fs.readdirSync(tempDir);
    console.log(`📁 发现 ${files.length} 个文件`);
    
    for (const file of files) {
      // 跳过目录
      if (file === '.' || file === '..') {
        continue;
      }
      
      const filePath = path.join(tempDir, file);
      
      try {
        // 获取文件信息
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtime.getTime();
        const fileAgeHours = Math.round(fileAge / (1000 * 60 * 60));
        
        // 检查文件是否超过最大保留时间
        if (fileAge > maxAgeMs) {
          console.log(`🗑️  删除过期文件: ${file} (${fileAgeHours}小时前)`);
          
          // 记录文件大小
          totalSize += stats.size;
          
          // 删除文件
          fs.unlinkSync(filePath);
          cleanedCount++;
        } else {
          console.log(`⏰ 保留文件: ${file} (${fileAgeHours}小时前)`);
        }
      } catch (error) {
        console.error(`❌ 处理文件失败: ${file}`, error.message);
        errors.push({
          file: file,
          error: error.message
        });
      }
    }
    
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    console.log(`✅ 临时文件清理完成: 删除了 ${cleanedCount} 个文件，释放了 ${totalSizeMB}MB 空间`);
    
    return {
      success: true,
      cleanedCount: cleanedCount,
      totalSize: totalSize,
      totalSizeMB: totalSizeMB,
      errors: errors
    };
    
  } catch (error) {
    console.error('❌ 清理临时文件失败:', error.message);
    return {
      success: false,
      error: error.message,
      cleanedCount: 0,
      totalSize: 0,
      errors: [error.message]
    };
  }
}

/**
 * 获取临时文件统计信息
 * @returns {Object} 统计信息
 */
function getTempFileStats() {
  const tempDir = path.join(__dirname, '../../uploads/temp');
  const now = Date.now();
  
  let totalFiles = 0;
  let totalSize = 0;
  let oldFiles = 0;
  let oldSize = 0;
  const maxAgeMs = 72 * 60 * 60 * 1000; // 72小时
  
  try {
    if (!fs.existsSync(tempDir)) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldFiles: 0,
        oldSize: 0,
        totalSizeMB: '0.00',
        oldSizeMB: '0.00'
      };
    }
    
    const files = fs.readdirSync(tempDir);
    
    for (const file of files) {
      if (file === '.' || file === '..') {
        continue;
      }
      
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtime.getTime();
      
      totalFiles++;
      totalSize += stats.size;
      
      if (fileAge > maxAgeMs) {
        oldFiles++;
        oldSize += stats.size;
      }
    }
    
    return {
      totalFiles: totalFiles,
      totalSize: totalSize,
      oldFiles: oldFiles,
      oldSize: oldSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldSizeMB: (oldSize / 1024 / 1024).toFixed(2)
    };
    
  } catch (error) {
    console.error('❌ 获取临时文件统计失败:', error.message);
    return {
      totalFiles: 0,
      totalSize: 0,
      oldFiles: 0,
      oldSize: 0,
      totalSizeMB: '0.00',
      oldSizeMB: '0.00',
      error: error.message
    };
  }
}

/**
 * 设置定时清理任务
 * @param {number} intervalHours - 清理间隔（小时），默认24小时
 * @param {number} maxAgeHours - 最大保留时间（小时），默认72小时
 */
function startCleanupScheduler(intervalHours = 24, maxAgeHours = 72) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  console.log(`⏰ 启动定时清理任务: 每${intervalHours}小时清理一次，保留${maxAgeHours}小时内的文件`);
  
  // 立即执行一次清理
  cleanupTempFiles(maxAgeHours);
  
  // 设置定时器
  setInterval(() => {
    console.log(`⏰ 执行定时清理任务...`);
    cleanupTempFiles(maxAgeHours);
  }, intervalMs);
}

module.exports = {
  cleanupTempFiles,
  getTempFileStats,
  startCleanupScheduler
};


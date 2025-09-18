const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
// const { fileType } = require('file-type'); // ES Module，需要动态导入
const mime = require('mime-types');

/**
 * 文件处理工具
 * 提供文件类型检测、元数据提取、格式转换等功能
 */

/**
 * 根据MIME类型分类文件
 * @param {string} mimeType - MIME类型
 * @returns {string} 文件分类
 */
function categorizeFileType(mimeType) {
  if (!mimeType) return 'unknown';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/')) return 'document';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('powerpoint')) return 'document';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive';
  
  return 'document'; // 默认为文档类型
}

/**
 * 检测文件类型
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 文件类型信息
 */
async function detectFileType(filePath) {
  try {
    // 首先尝试使用file-type模块
    try {
      const fileTypeModule = await import('file-type');
      const fileTypeInfo = await fileTypeModule.fileTypeFromFile(filePath);
      
      if (fileTypeInfo) {
        return {
          mimeType: fileTypeInfo.mime,
          ext: fileTypeInfo.ext,
          detected: true
        };
      }
    } catch (importError) {
      console.warn('file-type模块导入失败，使用备用方法:', importError.message);
    }
    
    // 如果file-type无法检测，使用文件扩展名
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mime.lookup(filePath);
    
    return {
      mimeType: mimeType || 'application/octet-stream',
      ext: ext.substring(1),
      detected: false
    };
  } catch (error) {
    console.error('❌ 检测文件类型失败:', error.message);
    return {
      mimeType: 'application/octet-stream',
      ext: path.extname(filePath).toLowerCase().substring(1),
      detected: false
    };
  }
}

/**
 * 获取图片元数据
 * @param {string} filePath - 图片文件路径
 * @returns {Promise<Object>} 图片元数据
 */
async function getImageMetadata(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      hasProfile: metadata.hasProfile,
      channels: metadata.channels,
      space: metadata.space
    };
  } catch (error) {
    console.error('❌ 获取图片元数据失败:', error.message);
    return null;
  }
}

/**
 * 获取音频元数据
 * @param {string} filePath - 音频文件路径
 * @returns {Promise<Object>} 音频元数据
 */
async function getAudioMetadata(filePath) {
  try {
    // 这里可以使用music-metadata库来获取音频元数据
    // 目前返回基本信息
    const stats = fs.statSync(filePath);
    
    return {
      size: stats.size,
      duration: null, // 需要专门的音频库来获取
      bitrate: null,
      sampleRate: null,
      channels: null
    };
  } catch (error) {
    console.error('❌ 获取音频元数据失败:', error.message);
    return null;
  }
}

/**
 * 获取视频元数据
 * @param {string} filePath - 视频文件路径
 * @returns {Promise<Object>} 视频元数据
 */
async function getVideoMetadata(filePath) {
  try {
    // 这里可以使用ffprobe或类似的库来获取视频元数据
    // 目前返回基本信息
    const stats = fs.statSync(filePath);
    
    return {
      size: stats.size,
      duration: null, // 需要专门的视频库来获取
      width: null,
      height: null,
      bitrate: null,
      fps: null
    };
  } catch (error) {
    console.error('❌ 获取视频元数据失败:', error.message);
    return null;
  }
}

/**
 * 获取文档元数据
 * @param {string} filePath - 文档文件路径
 * @returns {Promise<Object>} 文档元数据
 */
async function getDocumentMetadata(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    let pageCount = null;
    let wordCount = null;
    
    // 根据文件类型获取特定元数据
    if (ext === '.pdf') {
      // 这里可以使用pdf-parse库来获取PDF元数据
      // pageCount = await getPDFPageCount(filePath);
    } else if (ext === '.docx') {
      // 这里可以使用mammoth库来获取Word文档元数据
      // wordCount = await getWordCount(filePath);
    }
    
    return {
      size: stats.size,
      pageCount: pageCount,
      wordCount: wordCount,
      language: null
    };
  } catch (error) {
    console.error('❌ 获取文档元数据失败:', error.message);
    return null;
  }
}

/**
 * 根据文件类型获取元数据
 * @param {string} filePath - 文件路径
 * @param {string} fileType - 文件类型
 * @returns {Promise<Object>} 元数据
 */
async function getFileMetadata(filePath, fileType) {
  const baseMetadata = {
    size: fs.statSync(filePath).size,
    createdAt: fs.statSync(filePath).birthtime,
    modifiedAt: fs.statSync(filePath).mtime
  };
  
  let specificMetadata = {};
  
  switch (fileType) {
    case 'image':
      specificMetadata = await getImageMetadata(filePath);
      break;
    case 'audio':
      specificMetadata = await getAudioMetadata(filePath);
      break;
    case 'video':
      specificMetadata = await getVideoMetadata(filePath);
      break;
    case 'document':
      specificMetadata = await getDocumentMetadata(filePath);
      break;
    default:
      specificMetadata = {};
  }
  
  return {
    ...baseMetadata,
    ...specificMetadata
  };
}

/**
 * 压缩图片
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 压缩选项
 * @returns {Promise<Object>} 压缩结果
 */
async function compressImage(inputPath, outputPath, options = {}) {
  const {
    quality = 80,
    maxWidth = 1920,
    maxHeight = 1080,
    format = 'jpeg'
  } = options;
  
  try {
    let pipeline = sharp(inputPath);
    
    // 调整尺寸
    if (maxWidth || maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // 设置格式和质量
    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      default:
        pipeline = pipeline.jpeg({ quality });
    }
    
    await pipeline.toFile(outputPath);
    
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    return {
      success: true,
      originalSize: originalSize,
      compressedSize: compressedSize,
      compressionRatio: compressionRatio,
      outputPath: outputPath
    };
  } catch (error) {
    console.error('❌ 压缩图片失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 创建缩略图
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {Object} options - 缩略图选项
 * @returns {Promise<Object>} 创建结果
 */
async function createThumbnail(inputPath, outputPath, options = {}) {
  const {
    width = 300,
    height = 300,
    quality = 80,
    fit = 'cover'
  } = options;
  
  try {
    await sharp(inputPath)
      .resize(width, height, {
        fit: fit,
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toFile(outputPath);
    
    return {
      success: true,
      thumbnailPath: outputPath,
      width: width,
      height: height
    };
  } catch (error) {
    console.error('❌ 创建缩略图失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 验证文件完整性
 * @param {string} filePath - 文件路径
 * @param {number} expectedSize - 期望文件大小
 * @returns {boolean} 是否完整
 */
function validateFileIntegrity(filePath, expectedSize) {
  try {
    const actualSize = fs.statSync(filePath).size;
    return actualSize === expectedSize;
  } catch (error) {
    console.error('❌ 验证文件完整性失败:', error.message);
    return false;
  }
}

/**
 * 清理临时文件
 * @param {string|Array} filePaths - 文件路径或路径数组
 * @returns {number} 清理的文件数量
 */
function cleanupTempFiles(filePaths) {
  let cleanedCount = 0;
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  
  paths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        cleanedCount++;
        console.log(`🧹 已清理临时文件: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ 清理文件失败 ${filePath}:`, error.message);
    }
  });
  
  return cleanedCount;
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名
 */
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否存在
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

module.exports = {
  categorizeFileType,
  detectFileType,
  getImageMetadata,
  getAudioMetadata,
  getVideoMetadata,
  getDocumentMetadata,
  getFileMetadata,
  compressImage,
  createThumbnail,
  validateFileIntegrity,
  cleanupTempFiles,
  getFileExtension,
  fileExists
};

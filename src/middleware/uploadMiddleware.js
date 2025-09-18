const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
// const { fileType } = require('file-type'); // ES Module，需要动态导入
const mime = require('mime-types');

// 导入文件处理工具
const { detectFileType, categorizeFileType } = require('../utils/fileProcessor');

/**
 * 文件上传中间件
 * 提供文件上传、验证、处理等功能
 */

// 确保上传目录存在
const ensureUploadDirs = () => {
  const dirs = [
    'uploads/temp',
    'uploads/processed',
    'uploads/attachments',
    'uploads/thumbnails',
    'uploads/logs'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// 初始化上传目录
ensureUploadDirs();

/**
 * 文件类型验证
 * @param {string} mimeType - MIME类型
 * @param {string} originalName - 原始文件名
 * @returns {Object} 验证结果
 */
function validateFileType(mimeType, originalName) {
  const allowedTypes = {
    image: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json',
      'application/javascript',
      'text/css',
      'text/markdown',
      'text/html',
      'application/zip',
      'application/x-zip-compressed'
    ],
    audio: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'audio/webm'
    ],
    video: [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime'
    ]
  };
  
  // 检查MIME类型
  let fileType = null;
  for (const [type, mimes] of Object.entries(allowedTypes)) {
    if (mimes.includes(mimeType)) {
      fileType = type;
      break;
    }
  }
  
  if (!fileType) {
    return {
      valid: false,
      error: `不支持的文件类型: ${mimeType}`,
      fileType: null
    };
  }
  
  // 检查文件扩展名
  const ext = path.extname(originalName).toLowerCase();
  const expectedExts = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    document: ['.pdf', '.doc', '.docx', '.txt', '.csv', '.json', '.js', '.css', '.md', '.html', '.zip'],
    audio: ['.mp3', '.wav', '.ogg', '.m4a', '.webm'],
    video: ['.mp4', '.webm', '.ogv', '.mov']
  };
  
  if (!expectedExts[fileType].includes(ext)) {
    return {
      valid: false,
      error: `文件扩展名与MIME类型不匹配: ${ext}`,
      fileType: null
    };
  }
  
  return {
    valid: true,
    fileType: fileType
  };
}

/**
 * 文件大小验证
 * @param {number} fileSize - 文件大小（字节）
 * @param {string} fileType - 文件类型
 * @returns {Object} 验证结果
 */
function validateFileSize(fileSize, fileType) {
  const maxSizes = {
    image: 10 * 1024 * 1024,      // 10MB
    document: 50 * 1024 * 1024,   // 50MB
    audio: 100 * 1024 * 1024,     // 100MB
    video: 200 * 1024 * 1024      // 200MB
  };
  
  const maxSize = maxSizes[fileType] || 50 * 1024 * 1024; // 默认50MB
  
  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `文件大小超过限制: ${(fileSize / 1024 / 1024).toFixed(2)}MB > ${(maxSize / 1024 / 1024).toFixed(2)}MB`
    };
  }
  
  return {
    valid: true
  };
}

/**
 * 生成安全的文件名
 * @param {string} originalName - 原始文件名
 * @param {string} fileType - 文件类型
 * @returns {string} 安全文件名
 */
function generateSafeFilename(originalName, fileType) {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const randomId = uuidv4().substring(0, 8);
  return `${fileType}_${timestamp}_${randomId}${ext}`;
}

/**
 * 创建缩略图（仅图片）
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出缩略图路径
 * @param {Object} options - 缩略图选项
 * @returns {Promise<Object>} 处理结果
 */
async function createThumbnail(inputPath, outputPath, options = {}) {
  const {
    maxWidth = 300,
    maxHeight = 300,
    quality = 80
  } = options;
  
  try {
    await sharp(inputPath)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toFile(outputPath);
    
    return {
      success: true,
      thumbnailPath: outputPath
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
 * 获取图片尺寸信息
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 尺寸信息
 */
async function getImageDimensions(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error('❌ 获取图片尺寸失败:', error.message);
    return {
      width: null,
      height: null
    };
  }
}

/**
 * 配置Multer存储
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 先保存到临时目录
    cb(null, 'uploads/temp');
  },
  filename: (req, file, cb) => {
    // 生成临时文件名
    const tempFilename = `temp_${Date.now()}_${uuidv4().substring(0, 8)}${path.extname(file.originalname)}`;
    cb(null, tempFilename);
  }
});

/**
 * 文件过滤器
 */
const fileFilter = (req, file, cb) => {
  const validation = validateFileType(file.mimetype, file.originalname);
  
  if (!validation.valid) {
    return cb(new Error(validation.error), false);
  }
  
  // 将文件类型添加到请求对象
  req.fileType = validation.fileType;
  cb(null, true);
};

/**
 * 创建Multer实例
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB最大文件大小（默认限制，具体限制在validateFileSize中处理）
    files: 10 // 最多10个文件
  }
});

/**
 * 文件上传后处理中间件
 */
const processUploadedFile = async (req, res, next) => {
  if (!req.file) {
    return next();
  }
  
  try {
    const tempPath = req.file.path;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;
    const fileType = req.fileType;
    
    // 验证文件大小
    const sizeValidation = validateFileSize(fileSize, fileType);
    if (!sizeValidation.valid) {
      // 删除临时文件
      fs.unlinkSync(tempPath);
      return res.status(400).json({
        success: false,
        error: sizeValidation.error
      });
    }
    
    // 生成最终文件名和路径
    const finalFilename = generateSafeFilename(originalName, fileType);
    const finalPath = path.join('uploads/attachments', finalFilename);
    
    // 移动文件到最终位置
    fs.renameSync(tempPath, finalPath);
    
    // 处理图片文件
    let thumbnailPath = null;
    let dimensions = { width: null, height: null };
    
    if (fileType === 'image') {
      // 获取图片尺寸
      dimensions = await getImageDimensions(finalPath);
      
      // 创建缩略图
      const thumbnailFilename = `thumb_${finalFilename}`;
      const thumbnailFullPath = path.join('uploads/thumbnails', thumbnailFilename);
      
      const thumbnailResult = await createThumbnail(finalPath, thumbnailFullPath);
      if (thumbnailResult.success) {
        thumbnailPath = thumbnailFullPath;
      }
    }
    
    // 将处理后的文件信息添加到请求对象
    req.processedFile = {
      filename: finalFilename,
      originalName: originalName,
      filePath: finalPath,
      fileSize: fileSize,
      mimeType: mimeType,
      fileType: fileType,
      width: dimensions.width,
      height: dimensions.height,
      thumbnailPath: thumbnailPath,
      metadata: {
        uploadedAt: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    };
    
    next();
  } catch (error) {
    console.error('❌ 处理上传文件失败:', error.message);
    
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: '文件处理失败: ' + error.message
    });
  }
};

/**
 * 多文件上传后处理中间件
 */
const processUploadedFiles = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }
  
  try {
    const processedFiles = [];
    
    for (const file of req.files) {
      const tempPath = file.path;
      const originalName = file.originalname;
      const mimeType = file.mimetype;
      const fileSize = file.size;
      const fileType = req.fileType || 'document'; // 默认类型
      
      // 验证文件大小
      const sizeValidation = validateFileSize(fileSize, fileType);
      if (!sizeValidation.valid) {
        // 删除临时文件
        fs.unlinkSync(tempPath);
        continue; // 跳过这个文件
      }
      
      // 生成最终文件名和路径
      const finalFilename = generateSafeFilename(originalName, fileType);
      const finalPath = path.join('uploads/attachments', finalFilename);
      
      // 移动文件到最终位置
      fs.renameSync(tempPath, finalPath);
      
      // 处理图片文件
      let thumbnailPath = null;
      let dimensions = { width: null, height: null };
      
      if (fileType === 'image') {
        // 获取图片尺寸
        dimensions = await getImageDimensions(finalPath);
        
        // 创建缩略图
        const thumbnailFilename = `thumb_${finalFilename}`;
        const thumbnailFullPath = path.join('uploads/thumbnails', thumbnailFilename);
        
        const thumbnailResult = await createThumbnail(finalPath, thumbnailFullPath);
        if (thumbnailResult.success) {
          thumbnailPath = thumbnailFullPath;
        }
      }
      
      processedFiles.push({
        filename: finalFilename,
        originalName: originalName,
        filePath: finalPath,
        fileSize: fileSize,
        mimeType: mimeType,
        fileType: fileType,
        width: dimensions.width,
        height: dimensions.height,
        thumbnailPath: thumbnailPath,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });
    }
    
    // 将处理后的文件信息添加到请求对象
    req.processedFiles = processedFiles;
    
    next();
  } catch (error) {
    console.error('❌ 处理上传文件失败:', error.message);
    
    // 清理临时文件
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: '文件处理失败: ' + error.message
    });
  }
};

/**
 * 处理单个上传文件的工具函数
 * @param {Object} file - Multer文件对象
 * @returns {Promise<Object>} 处理后的文件信息
 */
async function processSingleFile(file) {
  try {
    console.log(`📎 开始处理文件: ${file.originalname}`);
    
    // 检测文件类型
    const fileTypeInfo = await detectFileType(file.path);
    console.log(`🔍 文件类型检测结果:`, fileTypeInfo);
    const fileType = categorizeFileType(fileTypeInfo.mimeType);
    console.log(`🔍 文件类型分类结果:`, fileType);
    
    // 验证文件大小
    console.log(`📏 验证文件大小: ${file.originalname}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB, 类型: ${fileType}`);
    const sizeValidation = validateFileSize(file.size, fileType);
    console.log(`📏 大小验证结果:`, sizeValidation);
    if (!sizeValidation.valid) {
      console.log(`❌ 文件大小验证失败: ${sizeValidation.error}`);
      // 删除临时文件
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new Error(sizeValidation.error);
    }
    console.log(`✅ 文件大小验证通过`);
    
    // 生成安全文件名
    const safeFilename = generateSafeFilename(file.originalname, fileType);
    
    // 确定最终存储路径
    const finalDir = process.env.UPLOAD_ATTACHMENTS_DIR || 'uploads/attachments';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const finalPath = path.join(finalDir, year.toString(), month, day, safeFilename);
    
    // 确保目录存在
    const finalDirPath = path.dirname(finalPath);
    if (!fs.existsSync(finalDirPath)) {
      fs.mkdirSync(finalDirPath, { recursive: true });
    }
    
    // 移动文件到最终位置
    fs.renameSync(file.path, finalPath);
    
    // 处理文件元数据
    let metadata = {
      originalName: file.originalname,
      uploadedAt: new Date().toISOString(),
      fileType: fileType,
      mimeType: fileTypeInfo.mimeType
    };
    
    let thumbnailPath = null;
    let width = null;
    let height = null;
    let duration = null;
    
    // 如果是图片，生成缩略图
    if (fileType === 'image' && process.env.THUMBNAIL_ENABLED === 'true') {
      try {
        const thumbnailFilename = `thumb_${safeFilename}`;
        const thumbnailFullPath = path.join('uploads/thumbnails', thumbnailFilename);
        const thumbnailResult = await createThumbnail(finalPath, thumbnailFullPath);
        if (thumbnailResult.success) {
          thumbnailPath = thumbnailResult.thumbnailPath;
        }
        const dimensions = await getImageDimensions(finalPath);
        width = dimensions.width;
        height = dimensions.height;
        metadata.dimensions = dimensions;
      } catch (thumbError) {
        console.warn('生成缩略图失败:', thumbError.message);
        thumbnailPath = null;
      }
    }
    
    // 如果是音频/视频，提取时长
    if (fileType === 'audio' || fileType === 'video') {
      // 这里可以添加音频/视频时长提取逻辑
      // 暂时跳过
    }
    
    const result = {
      filename: safeFilename,
      filePath: finalPath,
      fileType: fileType,
      width: width,
      height: height,
      duration: duration,
      thumbnailPath: thumbnailPath,
      metadata: metadata,
      processingTime: Date.now() - Date.now() // 简化处理时间计算
    };
    
    console.log(`✅ 文件处理完成: ${file.originalname} -> ${safeFilename}`);
    return result;
    
  } catch (error) {
    console.error(`❌ 处理文件失败: ${file.originalname}`, error.message);
    throw error;
  }
}

module.exports = {
  upload,
  processUploadedFile,
  processUploadedFiles,
  processSingleFile,
  validateFileType,
  validateFileSize,
  generateSafeFilename,
  createThumbnail,
  getImageDimensions
};

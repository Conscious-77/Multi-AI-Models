const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// 文档解析工具函数
async function extractDocumentText(filePath, mimeType) {
  try {
    console.log(`🔍 开始提取文档内容: ${filePath}, 类型: ${mimeType}`);
    
    if (mimeType === 'application/pdf') {
      // PDF文本提取
      const pdfParse = require('pdf-parse');
      const fs = require('fs');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      console.log(`✅ PDF文本提取成功: ${data.text.length} 字符`);
      return data.text;
      
    } else if (mimeType?.includes('wordprocessingml') || mimeType?.includes('msword')) {
      // Word文档文本提取
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      console.log(`✅ Word文档文本提取成功: ${result.value.length} 字符`);
      return result.value;
      
    } else if (mimeType?.startsWith('text/') || mimeType === 'application/json') {
      // 纯文本文件和JSON文件
      const fs = require('fs');
      const textContent = fs.readFileSync(filePath, 'utf8');
      console.log(`✅ 文本/JSON文件读取成功: ${textContent.length} 字符`);
      return textContent;
      
    } else {
      console.log(`⚠️ 不支持的文档类型: ${mimeType}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ 文档内容提取失败: ${error.message}`);
    return null;
  }
}

// 导入数据库模块
const {
  getDatabase,
  getDatabaseStats,
  createSession,
  getSession,
  getAllSessions,
  updateSessionActivity,
  updateSessionMessageCount,
  deleteSession,
  sessionExists,
  addMessage,
  getSessionMessages,
  getMessagesForGemini,
  getSessionMessageCount,
  getMessageModelInfo
} = require('./src/database');

// 导入附件相关模块
const {
  addAttachment,
  getAttachmentById,
  getAttachmentsBySession,
  updateAttachment,
  deleteAttachment,
  updateAttachmentMessageId,
  getAttachmentStats
} = require('./src/database/attachmentRepository');

const {
  addProcessingLog,
  getProcessingLogsByAttachmentId,
  updateProcessingLog
} = require('./src/database/fileProcessingLogRepository');

// 导入文件上传中间件
const { upload, processSingleFile } = require('./src/middleware/uploadMiddleware');

// 导入临时文件清理工具
const { cleanupTempFiles, getTempFileStats, startCleanupScheduler } = require('./src/utils/cleanupTempFiles');

// 简单的单文件清理函数
const cleanupTempFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ 临时文件已清理: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ 清理临时文件失败: ${filePath}`, error.message);
  }
};

// 简化的网络环境检测 - 跳过复杂测试，直接使用Vercel代理
function detectNetworkEnvironment() {
  console.log('🔧 使用Vercel代理模式（跳过网络检测）');
  return { useProxy: false, proxyUrl: null };
}

// 初始化网络环境
let networkConfig = { useProxy: false, proxyUrl: null };

// 初始化网络配置
networkConfig = detectNetworkEnvironment();
console.log('🔧 网络配置已初始化');

const app = express();
const PORT = process.env.PORT || 3001;

// --------- 工具: 规范化文件名字符集（尽量修复乱码） ---------
function normalizeFilename(name) {
  try {
    if (!name || typeof name !== 'string') return name;
    const tryDecoded = Buffer.from(name, 'latin1').toString('utf8');
    const countCJK = (s) => (s && typeof s === 'string') ? (s.match(/[\u4E00-\u9FFF]/g) || []).length : 0;
    // 如果转码后包含更多中文字符，则采用转码后的结果；否则保持原样
    return countCJK(tryDecoded) > countCJK(name) ? tryDecoded : name;
  } catch (e) {
    return name;
  }
}

// 导入数据库模块（重复导入已删除）

// Vercel 代理配置（强制使用，不允许直连）
const USE_VERCEL_PROXY = true; // 强制使用 Vercel 代理
const VERCEL_PROXY_URL = process.env.VERCEL_PROXY_URL || 'https://www.connectmulti.cc/api/proxy';
const VERCEL_MODEL_PATH = process.env.VERCEL_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';

// 新增：多模型配置常量
const GPT_MODEL_PATH = 'chat/completions';
const CLAUDE_MODEL_PATH = 'claude'; // 预留
const DEFAULT_MODEL = 'gemini'; // 默认模型

// 新增：完整的模型配置对象
const MODEL_CONFIGS = {
  gemini: {
    name: 'gemini-2.5-flash', // 默认模型
    provider: 'gemini',
    path: 'v1beta/models/gemini-2.5-flash:generateContent',
    streamPath: 'v1beta/models/gemini-2.5-flash:streamGenerateContent',
    format: 'gemini',
    variants: {
      'gemini-2.5-pro': { 
        cost: 'high', 
        capabilities: ['advanced', 'multimodal', 'reasoning', 'vision'],
        description: '高级推理，多模态支持，视觉理解',
        path: 'v1beta/models/gemini-2.5-pro:generateContent',
        streamPath: 'v1beta/models/gemini-2.5-pro:streamGenerateContent'
      },
      'gemini-2.5-flash': { 
        cost: 'medium', 
        capabilities: ['fast', 'multimodal', 'vision'],
        description: '快速响应，支持多模态输入',
        path: 'v1beta/models/gemini-2.5-flash:generateContent',
        streamPath: 'v1beta/models/gemini-2.5-flash:streamGenerateContent'
      },
      'gemini-2.5-flash-lite': { 
        cost: 'low', 
        capabilities: ['fast', 'efficient', 'multimodal'],
        description: '轻量级快速，多模态支持',
        path: 'v1beta/models/gemini-2.5-flash-lite:generateContent',
        streamPath: 'v1beta/models/gemini-2.5-flash-lite:streamGenerateContent'
      },
      'gemini-2.0-flash': { 
        cost: 'low', 
        capabilities: ['fast', 'efficient'],
        description: '高效快速，成本较低',
        path: 'v1beta/models/gemini-2.0-flash:generateContent',
        streamPath: 'v1beta/models/gemini-2.0-flash:streamGenerateContent'
      },
      'gemini-1.5-pro': { 
        cost: 'high', 
        capabilities: ['advanced', 'multimodal', 'reasoning'],
        description: '高级推理，多模态支持',
        path: 'v1beta/models/gemini-1.5-pro:generateContent',
        streamPath: 'v1beta/models/gemini-1.5-pro:streamGenerateContent'
      }
    }
  },
  gpt: {
    name: 'gpt-4o', // 默认模型
    provider: 'openai',
    path: 'chat/completions',
    format: 'openai',
    variants: {
      'gpt-5': { 
        cost: 'high', 
        capabilities: ['latest', 'advanced', 'reasoning'],
        description: '最新版本，高级推理能力'
      },
      'gpt-5-mini': { 
        cost: 'medium', 
        capabilities: ['latest', 'balanced', 'fast'],
        description: '平衡性能和速度'
      },
      'gpt-5-nano': { 
        cost: 'low', 
        capabilities: ['latest', 'fast', 'efficient'],
        description: '快速高效，成本最低'
      },
      'gpt-4.1': { 
        cost: 'high', 
        capabilities: ['advanced', 'reasoning', 'analysis'],
        description: '高级分析推理能力'
      },
      'gpt-4.1-mini': { 
        cost: 'medium', 
        capabilities: ['advanced', 'balanced'],
        description: '平衡性能和成本'
      },
      'gpt-4.1-nano': { 
        cost: 'low', 
        capabilities: ['advanced', 'fast'],
        description: '快速高级模型'
      },
      'gpt-4o': { 
        cost: 'high', 
        capabilities: ['multimodal', 'fast', 'vision'],
        description: '多模态，视觉理解'
      },
      'gpt-4o-mini': { 
        cost: 'medium', 
        capabilities: ['multimodal', 'balanced'],
        description: '平衡多模态能力'
      },
      'o3': { 
        cost: 'high', 
        capabilities: ['latest', 'advanced', 'reasoning'],
        description: '最新推理模型'
      },
      'o3-mini': { 
        cost: 'medium', 
        capabilities: ['latest', 'balanced'],
        description: '平衡性能模型'
      },
      'o4-mini': { 
        cost: 'medium', 
        capabilities: ['latest', 'efficient'],
        description: '高效最新模型'
      }
    }
  },
  claude: {
    name: 'claude-opus-4-1-20250805', // 默认模型
    provider: 'claude',
    path: 'claude',
    format: 'claude',
    variants: {
      'claude-opus-4-1-20250805': { 
        cost: 'high', 
        capabilities: ['advanced', 'analysis', 'safety'],
        description: '高级分析，安全性高'
      },
      'claude-sonnet-4-1-20250805': { 
        cost: 'medium', 
        capabilities: ['balanced', 'analysis'],
        description: '平衡性能，分析能力强'
      },
      'claude-haiku-4-1-20250805': { 
        cost: 'low', 
        capabilities: ['fast', 'efficient'],
        description: '快速高效，成本低'
      }
    }
  }
};

// 新增：附件base64转换函数
// 读取附件文件并转换为base64编码
async function convertAttachmentToBase64(attachmentId) {
  try {
    const attachment = getAttachmentById(attachmentId);
    if (!attachment) {
      throw new Error(`附件不存在: ${attachmentId}`);
    }

    // 检查文件大小限制（20MB）
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (attachment.file_size > maxSize) {
      throw new Error(`文件过大: ${attachment.file_name} (${attachment.file_size} bytes > ${maxSize} bytes)`);
    }

    // 读取文件内容
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(attachment.file_path);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    // 对于Gemini API，JSON文件需要使用text/plain类型
    let mimeType = attachment.mime_type;
    if (mimeType === 'application/json') {
      mimeType = 'text/plain';
    }

    return {
      success: true,
      data: {
        mimeType: mimeType,
        base64Data: base64Data,
        fileName: attachment.file_name,
        fileSize: attachment.file_size
      }
    };
  } catch (error) {
    console.error(`❌ 附件base64转换失败 (${attachmentId}):`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 新增：消息格式转换函数
// 将数据库消息转换为不同模型的格式
async function convertMessagesForModel(messages, modelType, sessionId = null, attachments = []) {
  console.log(`🔍 convertMessagesForModel 函数被调用！`);
  console.log(`🔍 convertMessagesForModel 调用参数: modelType=${modelType}, sessionId=${sessionId}, messages.length=${messages.length}, attachments.length=${attachments.length}`);
  
  try {
    switch (modelType) {
      case 'gemini':
        console.log(`🔍 进入Gemini分支处理`);
        const result = await Promise.all(messages.map(async (msg, index) => {
          console.log(`🔍 处理消息 ${index}: role=${msg.role}, content=${msg.content.substring(0, 50)}...`);
          const parts = [{ text: msg.content }];
          
          // 如果有传递的附件，添加到最新的用户消息中
          console.log(`🔍 检查条件: attachments.length=${attachments.length}, msg.role=${msg.role}, index=${index}, messages.length=${messages.length}`);
          // 找到最新的用户消息
          const latestUserMessageIndex = messages.findLastIndex(msg => msg.role === 'user');
          if (attachments && attachments.length > 0 && msg.role === 'user' && index === latestUserMessageIndex) {
            console.log(`🔍 条件满足，开始处理传递的附件`);
            try {
              console.log(`🔍 开始处理传递的附件:`, attachments);
              for (const attachment of attachments) {
                console.log(`🔍 处理附件: ${attachment.id}`);
                const base64Result = await convertAttachmentToBase64(attachment.id);
                if (base64Result.success) {
                  parts.push({
                    inlineData: {
                      mimeType: base64Result.data.mimeType,
                      data: base64Result.data.base64Data
                    }
                  });
                  console.log(`✅ Gemini附件已添加: ${base64Result.data.fileName} (${base64Result.data.fileSize} bytes)`);
                } else {
                  console.error(`❌ Gemini附件添加失败: ${base64Result.error}`);
                }
              }
            } catch (error) {
              console.error(`❌ 处理传递的附件失败: ${error.message}`);
              console.error(`❌ 错误堆栈:`, error.stack);
            }
          } else {
            console.log(`🔍 条件不满足，跳过附件处理`);
          }
          
          console.log(`🔍 消息处理完成，parts数量: ${parts.length}`);
          return {
            role: msg.role,
            parts: parts
          };
        }));
        console.log(`🔍 Gemini分支处理完成`);
        return result;
    
      case 'gpt':
        console.log(`🔍 进入GPT分支处理`);
        const gptResult = await Promise.all(messages.map(async (msg, index) => {
          console.log(`🔍 处理GPT消息 ${index}: role=${msg.role}, content=${msg.content.substring(0, 50)}...`);
          
          // 基础消息格式
          const baseMessage = {
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: msg.content
          };
          
          // 如果有传递的附件，添加到最新的用户消息中
          console.log(`🔍 检查GPT条件: attachments.length=${attachments.length}, msg.role=${msg.role}, index=${index}, messages.length=${messages.length}`);
          // 找到最新的用户消息
          const latestUserMessageIndex = messages.findLastIndex(msg => msg.role === 'user');
          if (attachments && attachments.length > 0 && msg.role === 'user' && index === latestUserMessageIndex) {
            console.log(`🔍 GPT条件满足，开始处理传递的附件`);
            try {
              console.log(`🔍 开始处理传递的GPT附件:`, attachments);
              
              if (attachments && attachments.length > 0) {
                console.log(`📎 GPT处理传递的附件: ${attachments.length}个附件`);
                
                // 转换为content数组格式
                const contentArray = [{ type: "text", text: msg.content }];
                
                for (const attachment of attachments) {
                  console.log(`🔍 处理GPT附件: ${attachment.id}`);
                  const base64Result = await convertAttachmentToBase64(attachment.id);
                  if (base64Result.success) {
                    // 根据文件类型处理
                    if (attachment.file_type === 'image') {
                      contentArray.push({
                        type: "image_url",
                        image_url: {
                          url: `data:${base64Result.data.mimeType};base64,${base64Result.data.base64Data}`,
                          detail: "high"
                        }
                      });
                      console.log(`✅ GPT图片附件已添加: ${base64Result.data.fileName} (${base64Result.data.fileSize} bytes)`);
                    } else {
                      // 非图片文件：尝试提取文档内容
                      try {
                        if (attachment.file_type === 'document' || attachment.mime_type?.startsWith('text/') || attachment.mime_type === 'application/json') {
                          // 使用新的文档解析功能
                          console.log(`🔍 GPT开始文档解析: ${attachment.file_path}`);
                          const filePath = attachment.file_path;
                          const extractedText = await extractDocumentText(filePath, attachment.mime_type);
                          
                          if (extractedText && extractedText.trim().length > 0) {
                            // 成功提取到文本内容
                            contentArray.push({
                              type: "text",
                              text: `\n[文档: ${attachment.original_name}]\n${extractedText}\n[/文档]\n`
                            });
                            console.log(`✅ GPT文档内容已添加: ${attachment.original_name} (${extractedText.length} 字符)`);
                          } else {
                            // 文档解析失败，使用文件描述
                            contentArray.push({
                              type: "text",
                              text: `\n[附件: ${attachment.original_name} - ${attachment.file_type}, 大小: ${attachment.file_size} bytes]\n[注：文档内容解析失败，仅显示文件信息]\n`
                            });
                            console.log(`⚠️ GPT文档解析失败，使用描述模式: ${attachment.original_name}`);
                          }
                        } else {
                          // 其他类型文件作为描述添加
                          contentArray.push({
                            type: "text",
                            text: `\n[附件: ${attachment.original_name} - ${attachment.file_type}, 大小: ${attachment.file_size} bytes]\n`
                          });
                          console.log(`✅ GPT文件描述已添加: ${attachment.original_name}`);
                        }
                      } catch (error) {
                        console.error(`❌ 读取文件内容失败: ${error.message}`);
                        // 失败时回退到文件描述
                        contentArray.push({
                          type: "text",
                          text: `\n[附件: ${attachment.original_name} - ${attachment.file_type}, 大小: ${attachment.file_size} bytes]\n`
                        });
                        console.log(`✅ GPT文件描述已添加(回退): ${attachment.original_name}`);
                      }
                    }
                  } else {
                    console.error(`❌ GPT附件添加失败: ${base64Result.error}`);
                  }
                }
                
                // 返回多模态格式
                console.log(`🔍 GPT消息处理完成，content数组长度: ${contentArray.length}`);
                return {
                  role: baseMessage.role,
                  content: contentArray
                };
              } else {
                console.log(`⚠️ GPT会话中没有找到附件: ${sessionId}`);
              }
            } catch (error) {
              console.error(`❌ GPT查找会话附件失败: ${error.message}`);
              console.error(`❌ GPT错误堆栈:`, error.stack);
            }
          } else {
            console.log(`🔍 GPT条件不满足，跳过附件处理`);
          }
          
          console.log(`🔍 GPT消息处理完成，使用基础格式`);
          return baseMessage;
        }));
        console.log(`🔍 GPT分支处理完成`);
        return gptResult;
      
      case 'claude':
        console.log(`🔍 进入Claude分支处理`);
        console.log(`⚠️ Claude多模态功能暂未配置 - 需要API Key`);
        
        // TODO: Claude多模态支持预留接口
        const claudeResult = await Promise.all(messages.map(async (msg, index) => {
          console.log(`🔍 处理Claude消息 ${index}: role=${msg.role}, content=${msg.content.substring(0, 50)}...`);
          
          const baseMessage = {
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: msg.content
          };
          
          // Claude多模态处理预留逻辑
          // 找到最新的用户消息
          const latestUserMessageIndex = messages.findLastIndex(msg => msg.role === 'user');
          if (attachments && attachments.length > 0 && msg.role === 'user' && index === latestUserMessageIndex) {
            console.log(`🔍 Claude多模态处理预留: attachments.length=${attachments.length}`);
            try {
              if (attachments && attachments.length > 0) {
                console.log(`📎 Claude发现${attachments.length}个传递的附件，但API Key未配置`);
                // TODO: 当有Claude API Key时，实现类似GPT的处理逻辑
                // - 图片: 转换为base64格式
                // - 文档: 使用extractDocumentText提取文本
                // - 其他: 文件描述模式
                
                // 当前返回提示信息
                return {
                  role: baseMessage.role,
                  content: baseMessage.content + '\n\n[注: 检测到附件，但Claude API未配置，无法处理多模态内容]'
                };
              }
            } catch (error) {
              console.error(`❌ Claude附件检查失败: ${error.message}`);
            }
          }
          
          console.log(`🔍 Claude消息处理完成（基础模式）`);
          return baseMessage;
        }));
        
        console.log(`🔍 Claude分支处理完成`);
        return claudeResult;
      
      default:
        console.log(`🔍 进入默认分支处理`);
        return messages;
    }
  } catch (error) {
    console.error(`❌ convertMessagesForModel 函数执行失败:`, error.message);
    console.error(`❌ 错误堆栈:`, error.stack);
    throw error;
  }
}

// 新增：模型和变体解析函数
// 解析完整的模型名称，如 "gpt-4o-mini" -> { type: "gpt", variant: "gpt-4o-mini" }
function parseModelAndVariant(modelString) {
  console.log(`🔍 parseModelAndVariant 开始 - 模型字符串: ${modelString}`);
  
  if (!modelString) {
    console.log(`🔍 模型字符串为空，返回null`);
    return null;
  }
  
  const modelStringLower = modelString.toLowerCase();
  console.log(`🔍 转换为小写: ${modelStringLower}`);
  
  // 检查是否是基础模型类型
  if (MODEL_CONFIGS[modelStringLower]) {
    console.log(`🔍 找到基础模型类型: ${modelStringLower}`);
    return {
      type: modelStringLower,
      variant: MODEL_CONFIGS[modelStringLower].name,
      isBaseModel: true
    };
  }
  
  // 检查是否是具体的模型变体
  console.log(`🔍 检查模型变体...`);
  for (const [modelType, config] of Object.entries(MODEL_CONFIGS)) {
    console.log(`🔍 检查模型类型: ${modelType}, 是否有变体:`, !!config.variants);
    if (config.variants && config.variants[modelStringLower]) {
      console.log(`🔍 找到模型变体: ${modelStringLower} 在 ${modelType} 中`);
      return {
        type: modelType,
        variant: modelStringLower,
        isBaseModel: false
      };
    }
  }
  
  console.log(`🔍 未找到匹配的模型，返回null`);
  return null;
}

// 新增：模型选择逻辑函数（支持变体选择）
// 根据用户请求或会话历史选择合适的AI模型
function selectModelForRequest(userRequest, sessionId = null, previousModel = null) {
  console.log(`🔍 selectModelForRequest 开始 - 用户请求:`, userRequest);
  
  // 1. 检查用户请求中是否明确指定模型
  if (userRequest.model) {
    console.log(`🔍 检测到用户指定模型: ${userRequest.model}`);
    const modelInfo = parseModelAndVariant(userRequest.model);
    if (modelInfo) {
      console.log(`🎯 用户明确选择模型: ${modelInfo.variant} (类型: ${modelInfo.type})`);
      console.log(`🔍 返回模型信息:`, modelInfo);
      return {
        type: modelInfo.type,
        variant: modelInfo.variant,
        isBaseModel: modelInfo.isBaseModel
      };
    } else {
      console.log(`⚠️ 不支持的模型: ${userRequest.model}`);
    }
  }
  
  // 2. 检查会话历史中的模型使用情况
  if (sessionId && previousModel) {
    // 如果会话中已经使用了某个模型，优先保持一致性
    if (MODEL_CONFIGS[previousModel]) {
      console.log(`🔄 保持会话模型一致性: ${previousModel}`);
      return {
        type: previousModel,
        variant: MODEL_CONFIGS[previousModel].name,
        isBaseModel: true
      };
    }
  }
  
  // 3. 根据内容类型智能选择模型
  const content = userRequest.message || userRequest.content || '';
  if (content.includes('图片') || content.includes('图像') || content.includes('视觉')) {
    console.log(`🖼️ 检测到视觉相关内容，选择 Gemini`);
    return {
      type: 'gemini',
      variant: MODEL_CONFIGS.gemini.name,
      isBaseModel: true
    };
  }
  
  if (content.includes('代码') || content.includes('编程') || content.includes('技术')) {
    console.log(`💻 检测到技术相关内容，选择 GPT`);
    return {
      type: 'gpt',
      variant: MODEL_CONFIGS.gpt.name,
      isBaseModel: true
    };
  }
  
  // 4. 默认选择
  console.log(`⚡ 使用默认模型: ${DEFAULT_MODEL}`);
  return {
    type: DEFAULT_MODEL,
    variant: MODEL_CONFIGS[DEFAULT_MODEL].name,
    isBaseModel: true
  };
}

// 新增：模型能力检查函数
// 检查指定模型是否支持特定功能
function checkModelCapability(modelType, capability) {
  if (!MODEL_CONFIGS[modelType]) {
    return false;
  }
  
  const capabilities = {
    gemini: ['vision', 'multimodal', 'fast_response'],
    gpt: ['code', 'reasoning', 'long_context'],
    claude: ['analysis', 'writing', 'safety'] // 预留
  };
  
  return capabilities[modelType]?.includes(capability) || false;
}

// 生成会话ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 获取或创建会话（数据库版本）
async function getOrCreateSession(sessionId, firstMessage) {
  if (!sessionId || !(await sessionExists(sessionId))) {
    sessionId = generateSessionId();
    await createSession(sessionId, firstMessage);
    console.log(`🆔 新会话已创建: ${sessionId}`);
  } else {
    // 更新会话活动时间
    await updateSessionActivity(sessionId);
  }
  return sessionId;
}

// 中间件
app.use(cors({
  // 允许来源从环境变量 FRONTEND_ORIGINS 读取，逗号分隔；默认允许本地开发
  origin: (origin, callback) => {
    try {
      const raw = (process.env.FRONTEND_ORIGINS || 'http://localhost:1309')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const allowSet = new Set(raw);
      if (!origin) return callback(null, true); // 非浏览器请求（如 curl）
      if (allowSet.has(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    } catch (_) {
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'authorization']
}));
app.use(express.json());
console.log('🌐 允许的前端来源 (FRONTEND_ORIGINS):', (process.env.FRONTEND_ORIGINS || 'http://localhost:1309'));

// 提供静态文件（用于下载工具产物，如 /generated/*.pdf）
try {
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));
  app.use('/generated', express.static(path.join(publicDir, 'generated')));
  app.use('/generated_user', express.static(path.join(publicDir, 'generated_user')));
  console.log('📂 静态目录已启用:', publicDir);
} catch (_) {}

// ========== 方案A：API Key 鉴权（最小实现） ==========
// 从请求头 x-api-key 或 Authorization: Bearer <KEY> 读取密钥，
// 与 .env 中的 API_KEYS（逗号分隔）或 API_KEY 比对。
const parseApiKeys = () => {
  const raw = (process.env.API_KEYS || process.env.API_KEY || '').trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
};

const VALID_API_KEYS = parseApiKeys();
console.log(`🔐 API Key 数量: ${VALID_API_KEYS.size}`);

function extractClientApiKey(req) {
  const headerKey = req.get('x-api-key');
  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ')
    ? auth.slice('Bearer '.length).trim()
    : '';
  return headerKey || bearer || '';
}

function apiKeyGuard(req, res, next) {
  // 失败关闭：未配置服务端密钥时，所有受保护API拒绝访问
  if (VALID_API_KEYS.size === 0) {
    return res.status(401).json({ error: 'Unauthorized: server API_KEY not configured' });
  }
  const provided = extractClientApiKey(req);
  if (!provided || !VALID_API_KEYS.has(provided)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

// 挂载到 /api 下的所有路由（需在路由注册前）
app.use('/api', apiKeyGuard);

// 环境变量配置（当不使用 Vercel 代理时才需要本地 API Key）
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
if (!USE_VERCEL_PROXY && !GEMINI_API_KEY) {
  console.warn('⚠️ 警告: GEMINI_API_KEY 未设置，直连模式下 API 调用将失败');
}

// 挂载 Agent 专用工具调试路由（与主逻辑解耦）
let agentTools = null;
try {
  const { createAgentRouter, tools, createAgentApiRouter } = require('./Agents_All/server/Agent_Server');
  agentTools = tools;
  app.use('/api/agent-tools', createAgentRouter());
  const agentApiRouter = createAgentApiRouter({
    USE_VERCEL_PROXY,
    VERCEL_PROXY_URL,
    VERCEL_MODEL_PATH,
    GEMINI_API_KEY,
    networkConfig
  });
  app.use('/api', agentApiRouter);
  console.log('🔧 已挂载 Agent 工具调试路由: /api/agent-tools');
  console.log('🤖 已挂载 Agent API 路由: /api/agent, /api/agent2');
} catch (e) {
  console.log('ℹ️ Agent模块加载失败，跳过工具调试路由:', e.message);
}

// 创建会话端点（不等待 Gemini 回复）
app.post('/api/sessions', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    // 创建新会话
    const sessionId = generateSessionId();
    await createSession(sessionId, message);
    
    // 注意：这里不添加用户消息，让后续的API调用来处理
    // 避免重复添加消息
    
    console.log(`🆔 新会话已创建: ${sessionId}`);
    
    // 立即返回会话ID，不等待 Gemini 回复
    res.json({
      sessionId: sessionId,
      messageCount: 0, // 初始消息数量为0
      status: 'created'
    });

  } catch (error) {
    console.error('创建会话失败:', error);
    res.status(500).json({ 
      error: '创建会话失败',
      details: error.message 
    });
  }
});

// Gemini API 代理（支持上下文记忆）
app.post('/api/gemini', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    // 获取或创建会话
    const currentSessionId = await getOrCreateSession(sessionId, message);
    
    // 检查是否已经添加过这条用户消息（避免重复）
    const existingMessages = await getSessionMessages(currentSessionId);
    const messageExists = existingMessages.some(msg => 
      msg.role === 'user' && msg.content === message
    );
    
    if (!messageExists) {
      // 只在消息不存在时添加
      await addMessage({
        session_id: currentSessionId,
        role: 'user',
        content: message
      });
      console.log(`💬 新用户消息已添加: ${message.substring(0, 50)}...`);
    } else {
      console.log(`⚠️  用户消息已存在，跳过重复添加: ${message.substring(0, 50)}...`);
    }
    
    // 更新会话消息数量
    await updateSessionMessageCount(currentSessionId);

    // 从数据库获取完整的对话历史
    const contents = await getMessagesForGemini(currentSessionId);

    // 添加调试日志
    console.log(`🔍 会话 ${currentSessionId} 发送给Gemini的对话历史:`);
    console.log(JSON.stringify(contents, null, 2));

    // 使用 node-fetch，强制使用 Vercel 代理
    const fetch = require('node-fetch');
    
    // 目标地址：强制使用 Vercel 代理
    const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`;

    let headers = { 'Content-Type': 'application/json' };

    let fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents }),
      signal: AbortSignal.timeout(60000) // 60秒超时，避免前端一直等待
    };
    
    console.log('🌐 强制使用 Vercel 代理发送请求');
    
    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) {}
      console.error('Gemini API 错误:', errorData);
      return res.status(response.status).json({ 
        error: `Gemini API 错误: ${errorData.error?.message || response.statusText || '未知错误'}` 
      });
    }

    const data = await response.json();
    
    // 添加AI回复到数据库
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      await addMessage({
        session_id: currentSessionId,
        role: 'model',
        content: data.candidates[0].content.parts[0].text
      });
      
      // 更新会话消息数量
      await updateSessionMessageCount(currentSessionId);
    }
    
    // 返回响应和会话ID
    res.json({
      ...data,
      sessionId: currentSessionId,
      messageCount: await getSessionMessageCount(currentSessionId)
    });

  } catch (error) {
    console.error('服务器错误:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: '服务器内部错误',
      details: error.message 
    });
  }
});

// 流式端点（支持上下文记忆）
app.post('/api/gemini/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { message, sessionId } = req.body;
  if (!message) {
    res.write('event: error\ndata: {"error":"消息不能为空"}\n\n');
    return res.end();
  }

  try {
    // 获取或创建会话
    const currentSessionId = await getOrCreateSession(sessionId, message);
    
    // 检查是否已经添加过这条用户消息（避免重复）
    const existingMessages = await getSessionMessages(currentSessionId);
    const messageExists = existingMessages.some(msg => 
      msg.role === 'user' && msg.content === message
    );
    
    if (!messageExists) {
      // 只在消息不存在时添加
      await addMessage({
        session_id: currentSessionId,
        role: 'user',
        content: message
      });
      console.log(`💬 流式新用户消息已添加: ${message.substring(0, 50)}...`);
    } else {
      console.log(`⚠️  流式用户消息已存在，跳过重复添加: ${message.substring(0, 50)}...`);
    }
    
    // 更新会话消息数量
    await updateSessionMessageCount(currentSessionId);

    // 从数据库获取完整的对话历史
    const contents = await getMessagesForGemini(currentSessionId);

    // 添加调试日志
    console.log(`🔍 流式会话 ${currentSessionId} 发送给Gemini的对话历史:`);
    console.log(JSON.stringify(contents, null, 2));

    // 使用快速响应模型 - gemini-2.5-flash 支持流式输出，无Thinking模式
    const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent('v1beta/models/gemini-2.5-flash:streamGenerateContent')}`;

    // 使用 node-fetch，强制使用 Vercel 代理
    const fetch = require('node-fetch');
    
    let headers = { 'Content-Type': 'application/json' };

    // 按照Gemini标准格式构造请求体
    const requestBody = { contents };

    let fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000) // 60秒超时
    };
    
    console.log('🌐 流式API强制使用 Vercel 代理发送请求');
    
    const geminiResponse = await fetch(targetUrl, fetchOptions);

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      res.write(`event: error\ndata: ${JSON.stringify({error: `Gemini API 错误: ${errorData.error?.message || errorData.error?.code || '未知错误'}`})}\n\n`);
      return res.end();
    }

    console.log('🚀 使用快速流式模型 (无Thinking模式):', targetUrl);
    
    // 使用流式但快速的响应处理
    console.log('⚡ 使用快速流式处理 (无Thinking模式)');
    
    // 非流式回退方法
    async function fallbackToNonStreaming() {
      console.log('🔄 开始回退方法处理...');
      const responseText = await geminiResponse.text();
      console.log('📄 响应内容长度:', responseText.length);
      console.log('📄 响应内容前200字符:', responseText.substring(0, 200));
      
      const lines = responseText.split('\n');
      console.log('📝 总行数:', lines.length);
      
      let fullText = '';
      
      // 检查是否是JSON数组格式（直接响应）
      if (responseText.trim().startsWith('[')) {
        console.log('🔍 检测到JSON数组格式，直接解析...');
        try {
          const jsonArray = JSON.parse(responseText);
          
          for (const data of jsonArray) {
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
              const text = data.candidates[0].content.parts.find(part => part.text)?.text || '';
              if (text) {
                fullText += text;
                console.log('📝 提取到文本:', text);
                
                // 发送流式数据到前端
                console.log('🚀 发送分块到前端:', text.substring(0, 50) + '...');
                res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
                console.log('✅ 分块发送完成，长度:', text.length);
                
                // 检查是否完成
                if (data.candidates[0].finishReason === 'STOP') {
                  console.log('✅ 流式响应完成');
                  break;
                }
              }
            }
          }
        } catch (parseError) {
          console.log('解析JSON数组时出错:', parseError);
        }
      } else {
        // 尝试解析Server-Sent Events格式（仅作为备用，不重复发送）
        console.log('🔍 检测到SSE格式，但已通过JSON数组处理，跳过重复处理');
        // 不再重复处理SSE格式，避免重复发送
      }
      
      console.log('📊 最终完整文本长度:', fullText.length);
      
      // 处理后续逻辑
      try {
        await addMessage({
          session_id: currentSessionId,
          role: 'model',
          content: fullText
        });
        
        await updateSessionMessageCount(currentSessionId);
        
        res.write(`event: session\ndata: ${JSON.stringify({sessionId: currentSessionId, messageCount: await getSessionMessageCount(currentSessionId)})}\n\n`);
        res.write('event: done\ndata: [DONE]\n\n');
        res.end();
      } catch (error) {
        console.error('保存AI回复失败:', error);
        res.write(`event: error\ndata: ${JSON.stringify({error: '保存AI回复失败'})}\n\n`);
        res.end();
      }
    }
    
    await fallbackToNonStreaming();

  } catch (error) {
    console.error('Streaming Proxy Internal Error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({error: `服务器内部错误: ${error.message}`})}\n\n`);
    res.end();
  }
});

// Agent API 接口（支持 system prompt 和模型配置）
app.post('/api/agent', async (req, res) => {
  try {
    const { message, config } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    if (!config || !config.systemPrompt) {
      return res.status(400).json({ error: 'Agent 配置不能为空' });
    }

    console.log('🤖 Agent 请求:', {
      message: message.substring(0, 100) + '...',
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });

    // 构建发送给 Gemini 的消息
    const contents = [
      {
        role: 'user',
        parts: [{ text: config.systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: '好的，我理解了你的角色和能力设定。现在请告诉我你需要帮助什么？' }]
      },
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    // 使用 node-fetch，强制使用 Vercel 代理
    const fetch = require('node-fetch');
    
    // 目标地址：强制使用 Vercel 代理
    const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`;

    let headers = { 'Content-Type': 'application/json' };

    // 构建 Gemini API 请求体
    const geminiRequestBody = {
      contents,
      generationConfig: {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2048,
        topP: 0.8,
        topK: 40
      }
    };

    let fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(geminiRequestBody),
      signal: AbortSignal.timeout(60000) // 60秒超时
    };
    
    console.log('🌐 Agent API 强制使用 Vercel 代理发送请求');
    
    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) {}
      console.error('Agent Gemini API 错误:', errorData);
      return res.status(response.status).json({ 
        error: `Gemini API 错误: ${errorData.error?.message || response.statusText || '未知错误'}` 
      });
    }

    const data = await response.json();

    // 兼容多种返回结构，尽量提取文本
    let aiResponse = '';
    try {
      const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
      const firstCandidate = candidates[0] || {};
      const content = firstCandidate.content || {};
      const parts = Array.isArray(content.parts) ? content.parts : [];

      if (parts.length > 0) {
        aiResponse = parts.map((p) => (p && typeof p.text === 'string') ? p.text : '').join('').trim();
      }

      // 如果没有拿到文本，给出更友好的提示
      if (!aiResponse) {
        const finishReason = firstCandidate.finishReason || data.finishReason || 'UNKNOWN';
        console.log('⚠️ Agent 无文本返回，finishReason =', finishReason);
        if (finishReason === 'MAX_TOKENS') {
          aiResponse = '（达到最大输出长度，未能返回文本。请增大 maxTokens 后重试。）';
        } else {
          aiResponse = '（模型未返回文本内容，请稍后重试。）';
        }
      }
    } catch (e) {
      console.error('解析 Gemini 响应时出错:', e);
      aiResponse = '（解析模型响应时出错，请稍后重试。）';
    }

    console.log('✅ Agent 回复已获取:', (aiResponse || '').substring(0, 100) + '...');

    res.json({
      response: aiResponse,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      usage: data.usageMetadata
    });

  } catch (error) {
    console.error('Agent API 错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    res.status(500).json({ 
      error: 'Agent API 内部错误',
      details: errorMessage 
    });
  }
});

// Agent 轻量 JSON 协议版（不影响原 /api/agent）
app.post('/api/agent2', async (req, res) => {
  try {
    const { message, config } = req.body;
    if (!message) return res.status(400).json({ error: '消息不能为空' });

    const systemPrompt = String(config?.systemPrompt || '').trim();

    // 工具协议卡（要求模型在需要时仅输出严格 JSON）
    const toolProtocol = `
你具备调用本地工具的能力。仅当用户明确需要生成 PDF 时，输出如下 JSON：
{"tool_call":{"name":"generate_pdf","args":{"title":"<标题>","content_markdown":"<Markdown内容>","filename":"可选文件名.pdf"}}}
严格要求：调用时只输出 JSON，不要附加任何其他文字或代码块围栏；非调用时不要输出 JSON。然后再把文件直接给到用户。
`;

    const contents = [
      { role: 'user', parts: [{ text: toolProtocol }] },
      ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }] : []),
      { role: 'model', parts: [{ text: '已知晓工具协议。' }] },
      { role: 'user', parts: [{ text: message }] }
    ];

    const fetch = require('node-fetch');
    const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent(VERCEL_MODEL_PATH)}`;

    let headers = { 'Content-Type': 'application/json' };

    let fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents, generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 2048,
        topP: 0.8,
        topK: 40
      }}),
      signal: AbortSignal.timeout(60000)
    };

    console.log('🌐 Agent2 强制使用 Vercel 代理发送请求');

    const response = await fetch(targetUrl, fetchOptions);
    if (!response.ok) {
      let errorData = {};
      try { errorData = await response.json(); } catch (_) {}
      return res.status(response.status).json({ error: `Gemini API 错误: ${errorData.error?.message || response.statusText || '未知错误'}` });
    }

    const data = await response.json();

    // 提取文本
    let aiText = '';
    try {
      const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
      const parts = Array.isArray(candidates[0]?.content?.parts) ? candidates[0].content.parts : [];
      if (parts.length > 0) aiText = parts.map(p => (p && typeof p.text === 'string') ? p.text : '').join('').trim();
    } catch (_) {}

    // 解析是否为工具调用 JSON（兼容"先自然语言、再 JSON"的输出，以及代码块包裹）
    let toolResult = null;
    const tryExtractToolJson = (text) => {
      try {
        if (!text) return null;
        // 去除代码围栏 + 规范化中英文引号
        let cleaned = String(text)
          .replace(/```[a-zA-Z]*\n?/g, '')
          .replace(/```/g, '')
          .replace(/[""]/g, '"')
          .replace(/['']/g, '"')
          .trim();
        // 直接是 JSON
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
          const obj = JSON.parse(cleaned);
          return obj?.tool_call ? obj : null;
        }
        // 在长文本中提取包含 "tool_call" 的 JSON 片段（基于括号配对）
        const tagIdx = cleaned.indexOf('"tool_call"');
        if (tagIdx === -1) return null;
        let start = cleaned.lastIndexOf('{', tagIdx);
        if (start === -1) return null;
        let depth = 0;
        for (let i = start; i < cleaned.length; i++) {
          const ch = cleaned[i];
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              const candidate = cleaned.slice(start, i + 1);
              try {
                const obj = JSON.parse(candidate);
                return obj?.tool_call ? obj : null;
              } catch (_) {}
              break;
            }
          }
        }
        return null;
      } catch (_) {
        return null;
      }
    };

    const extracted = tryExtractToolJson(aiText);
    if (extracted && extracted.tool_call && extracted.tool_call.name && agentTools && typeof agentTools[extracted.tool_call.name] === 'function') {
      const result = await agentTools[extracted.tool_call.name](extracted.tool_call.args || {});
      toolResult = { name: extracted.tool_call.name, result };
      return res.json({ response: '已生成 PDF，请查看下载链接。', toolResult, usage: data.usageMetadata });
    }

    // 非工具调用，返回自然语言
    if (!aiText) aiText = '（模型未返回文本内容，请稍后重试。）';
    return res.json({ response: aiText, toolResult: null, usage: data.usageMetadata });
  } catch (error) {
    console.error('Agent2 API 错误:', error);
    return res.status(500).json({ error: 'Agent2 API 内部错误', details: String(error.message || error) });
  }
});

// 会话管理端点
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    
    // 获取会话的所有消息
    const messages = await getSessionMessages(sessionId);
    
    res.json({
      sessionId,
      title: session.title,
      messageCount: session.message_count,
      createdAt: session.created_at,
      lastActivity: session.last_activity,
      status: session.status,
      messages: messages
    });
  } catch (error) {
    console.error('获取会话详情失败:', error);
    res.status(500).json({ error: '获取会话详情失败' });
  }
});

// 删除会话
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const success = await deleteSession(sessionId);
    
    if (success) {
      res.json({ message: '会话已删除' });
    } else {
      res.status(404).json({ error: '会话不存在' });
    }
  } catch (error) {
    console.error('删除会话失败:', error);
    res.status(500).json({ error: '删除会话失败' });
  }
});

// 获取所有会话
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// 健康检查
app.get('/health', async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: stats
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// 新增：聚合聊天API接口 - 支持多模型切换和上下文记忆
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, model = 'auto', selectedModel, selectedVariant, attachmentIds = [] } = req.body;
    
    // 兼容处理：支持新旧参数名
    const finalModel = selectedModel || model;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    // 验证附件ID（如果提供）
    let attachments = [];
    let providedAttachments = [];
    if (attachmentIds && attachmentIds.length > 0) {
      console.log(`📎 处理附件: ${attachmentIds.length}个附件`);
      
      for (const attachmentId of attachmentIds) {
        const attachment = getAttachmentById(attachmentId);
        if (!attachment) {
          return res.status(400).json({ 
            error: `附件不存在: ${attachmentId}` 
          });
        }
        
        // 验证附件是否属于当前会话（如果提供了sessionId）
        if (sessionId && attachment.session_id !== sessionId) {
          return res.status(400).json({ 
            error: `附件不属于当前会话: ${attachmentId}` 
          });
        }
        
        attachments.push(attachment);
        providedAttachments.push(attachment);
      }
      
      console.log(`✅ 附件验证通过: ${attachments.length}个有效附件`);
    }

    // 获取或创建会话
    const currentSessionId = await getOrCreateSession(sessionId, message);

    // 会话级附件兜底：当本轮未显式传附件时，自动聚合会话历史附件（去重/限量/限大小）
    try {
      if (attachments.length === 0 && currentSessionId) {
        const MAX_ATTACHMENTS = 50; // 数量上限
        const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB 总大小上限

        const sessionAll = getAttachmentsBySession(currentSessionId) || [];
        // 去重并按时间排序（旧->新 或者直接保持现有顺序）
        const unique = [];
        const seen = new Set();
        for (const a of sessionAll) {
          if (!seen.has(a.id)) { seen.add(a.id); unique.push(a); }
        }
        // 选择前 MAX_ATTACHMENTS 个，且满足总大小限制
        let total = 0;
        const picked = [];
        for (const a of unique) {
          if (picked.length >= MAX_ATTACHMENTS) break;
          const size = Number(a.file_size) || 0;
          if (total + size > MAX_TOTAL_BYTES) break;
          picked.push(a);
          total += size;
        }
        attachments = picked; // 兜底附件仅用于上下文，不做绑定
        console.log(`📎 会话级附件兜底启用: 选中 ${attachments.length} 个，总大小 ${(total/1024/1024).toFixed(1)}MB`);
      }
    } catch (e) {
      console.warn('📎 会话级附件兜底失败，跳过:', e.message);
    }
    
    // 获取会话历史中的模型信息
    const previousModelInfo = await getMessageModelInfo(currentSessionId);
    const previousModel = previousModelInfo?.model_provider || null;
    
    // 智能选择模型
    const selectedModelInfo = finalModel === 'auto' 
      ? selectModelForRequest({ message }, currentSessionId, previousModel)
      : selectModelForRequest({ message, model: finalModel }, currentSessionId, previousModel);
    
    if (!selectedModelInfo) {
      return res.status(400).json({ error: `不支持的模型: ${finalModel}` });
    }
    
    const { type: finalSelectedModel, variant: finalSelectedVariant } = selectedModelInfo;
    console.log(`🤖 聚合API选择模型: ${finalSelectedVariant} (类型: ${finalSelectedModel})`);
    console.log(`🔍 模型选择详情 - selectedModelInfo:`, selectedModelInfo);
    console.log(`🔍 解析结果 - finalSelectedModel: ${finalSelectedModel}, finalSelectedVariant: ${finalSelectedVariant}`);
    
    // 检查是否已经添加过这条用户消息（避免重复）
    const existingMessages = await getSessionMessages(currentSessionId);
    const messageExists = existingMessages.some(msg => 
      msg.role === 'user' && msg.content === message
    );
    
    let userMessageId = null;
    if (!messageExists) {
      // 只在消息不存在时添加
      const userMessage = await addMessage({
        session_id: currentSessionId,
        role: 'user',
        content: message,
        model_provider: finalSelectedModel,
        model_name: finalSelectedVariant
      });
      userMessageId = userMessage.id;
      console.log(`💬 聚合API新用户消息已添加: ${message.substring(0, 50)}..., messageId: ${userMessageId}`);
    } else {
      // 如果消息已存在，获取其ID
      const existingMessages = await getSessionMessages(currentSessionId);
      const existingMessage = existingMessages.find(msg => 
        msg.role === 'user' && msg.content === message
      );
      userMessageId = existingMessage?.id;
      console.log(`⚠️  聚合API用户消息已存在，跳过重复添加: ${message.substring(0, 50)}..., messageId: ${userMessageId}`);
    }
    
    // 仅将本轮显式传入的附件关联到用户消息；兜底附件不做绑定
    if (providedAttachments.length > 0 && userMessageId) {
      console.log(`📎 将 ${providedAttachments.length} 个附件关联到消息 ${userMessageId}`);
      for (const attachment of providedAttachments) {
        try {
          // 更新附件的messageId
          await updateAttachmentMessageId(attachment.id, userMessageId);
          console.log(`✅ 附件 ${attachment.id} 已关联到消息 ${userMessageId}`);
        } catch (error) {
          console.error(`❌ 关联附件失败: ${attachment.id}`, error);
        }
      }
    }
    
    // 更新会话消息数量
    console.log(`🔍 准备调用updateSessionMessageCount: sessionId=${currentSessionId}`);
    await updateSessionMessageCount(currentSessionId);
    console.log(`✅ updateSessionMessageCount调用完成`);

    // 从数据库获取完整的对话历史
    console.log(`🔍 准备调用getSessionMessages: sessionId=${currentSessionId}`);
    const messages = await getSessionMessages(currentSessionId);
    console.log(`✅ getSessionMessages调用完成，获取到${messages.length}条消息`);
    
    // 转换为对应模型的格式
    console.log(`🔍 准备调用convertMessagesForModel: finalSelectedModel=${finalSelectedModel}, currentSessionId=${currentSessionId}`);
    console.log(`🔍 messages参数:`, messages);
    console.log(`🔍 attachments参数:`, attachments);
    console.log(`🔍 开始调用convertMessagesForModel...`);
    let modelFormattedMessages;
    try {
      modelFormattedMessages = await convertMessagesForModel(messages, finalSelectedModel, currentSessionId, attachments);
      console.log(`🔍 convertMessagesForModel调用完成，结果:`, modelFormattedMessages);
    } catch (error) {
      console.error(`❌ convertMessagesForModel调用失败:`, error.message);
      console.error(`❌ 错误堆栈:`, error.stack);
      throw error;
    }
    
    console.log(`🔍 聚合API会话 ${currentSessionId} 发送给${finalSelectedVariant}的对话历史:`);
    console.log(JSON.stringify(modelFormattedMessages, null, 2));

    // 根据选择的模型调用对应的API
    let aiResponse;
    const modelConfig = MODEL_CONFIGS[finalSelectedModel];
    
    if (finalSelectedModel === 'gemini') {
      // 调用Gemini API - 使用变体特定的路径
      const variantPath = MODEL_CONFIGS[finalSelectedModel].variants[finalSelectedVariant]?.path || modelConfig.path;
      const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent(variantPath)}`;
      
      console.log(`🔗 Gemini API调用路径: ${variantPath}`);
      console.log(`🎯 使用变体: ${finalSelectedVariant}`);
      
      const fetch = require('node-fetch');
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: modelFormattedMessages }),
        signal: AbortSignal.timeout(180000) // 180秒超时
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API 错误: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🔍 Gemini API响应结构:', JSON.stringify(data, null, 2));
      console.log('🔍 尝试提取文本:', data.candidates?.[0]?.content?.parts?.[0]?.text);
      aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '抱歉，我没有得到有效的回复。';
      
    } else if (finalSelectedModel === 'gpt') {
      // 调用GPT API
      console.log(`🤖 开始调用GPT API，模型: ${finalSelectedVariant}`);
      console.log(`🔍 GPT API调用详情 - finalSelectedModel: ${finalSelectedModel}, finalSelectedVariant: ${finalSelectedVariant}`);
      console.log(`🔍 modelConfig:`, modelConfig);
      
      try {
        const modelConfig = MODEL_CONFIGS[finalSelectedModel];
        const targetUrl = `${VERCEL_PROXY_URL}?provider=openai&path=${encodeURIComponent(modelConfig.path)}`;
        
        const fetch = require('node-fetch');
        // 根据模型类型构建不同的请求体
        let requestBody = {
          model: finalSelectedVariant,
          messages: modelFormattedMessages
        };
        
        // GPT-5模型有特殊的参数要求
        if (finalSelectedVariant.startsWith('gpt-5')) {
          // GPT-5模型只支持temperature = 1
          requestBody.temperature = 1;
          console.log(`🔧 GPT-5模型检测到，设置temperature = 1`);
        } else {
          // 其他GPT模型使用temperature参数
          requestBody.temperature = 0.7;
        }
        
        // 不设置token限制，让模型自由生成
        
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(180000) // 180秒超时
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`OpenAI API 错误: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        aiResponse = data.choices?.[0]?.message?.content || '抱歉，我没有得到有效的回复。';
        
        console.log(`✅ GPT API 调用成功，模型: ${finalSelectedVariant}`);
        
      } catch (error) {
        console.error('GPT API 调用失败:', error);
        throw new Error(`GPT API 调用失败: ${error.message}`);
      }
      
    } else if (finalSelectedModel === 'claude') {
      // 调用Claude API（预留）
      aiResponse = 'Claude API 功能正在开发中，请稍后再试。';
      
    } else {
      throw new Error(`不支持的模型: ${finalSelectedModel}`);
    }
    
    // 添加AI回复到数据库
    await addMessage({
      session_id: currentSessionId,
      role: 'model',
      content: aiResponse,
      model_provider: finalSelectedModel,
      model_name: finalSelectedVariant
    });
    
    // 更新会话消息数量
    await updateSessionMessageCount(currentSessionId);
    
    // 返回响应和会话信息
    res.json({
      response: aiResponse,
      sessionId: currentSessionId,
      model: finalSelectedModel,
      modelName: finalSelectedVariant,
      messageCount: await getSessionMessageCount(currentSessionId),
      modelCapabilities: MODEL_CONFIGS[finalSelectedModel]?.variants?.[finalSelectedVariant]?.capabilities || ['fast', 'multimodal', 'vision']
    });

  } catch (error) {
    console.error('聚合API错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      error: '聚合API内部错误',
      details: error.message 
    });
  }
});

// 新增：聚合流式聊天API接口
app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { message, sessionId, model = 'auto', selectedModel, selectedVariant, attachmentIds = [] } = req.body;
  
  // 兼容处理：支持新旧参数名
  const finalModel = selectedModel || model;
  if (!message) {
    res.write('event: error\ndata: {"error":"消息不能为空"}\n\n');
    return res.end();
  }

  // 验证附件ID（如果提供）
  let attachments = [];
  let providedAttachments = [];
  if (attachmentIds && attachmentIds.length > 0) {
    console.log(`📎 流式API处理附件: ${attachmentIds.length}个附件`);
    
    for (const attachmentId of attachmentIds) {
      const attachment = getAttachmentById(attachmentId);
      if (!attachment) {
        res.write(`event: error\ndata: ${JSON.stringify({error: `附件不存在: ${attachmentId}`})}\n\n`);
        return res.end();
      }
      
      // 验证附件是否属于当前会话（如果提供了sessionId）
      if (sessionId && attachment.session_id !== sessionId) {
        res.write(`event: error\ndata: ${JSON.stringify({error: `附件不属于当前会话: ${attachmentId}`})}\n\n`);
        return res.end();
      }
      
      attachments.push(attachment);
      providedAttachments.push(attachment);
    }
    
    console.log(`✅ 流式API附件验证通过: ${attachments.length}个有效附件`);
  }

  try {
    // 获取或创建会话
    const currentSessionId = await getOrCreateSession(sessionId, message);
    
    // 获取会话历史中的模型信息
    const previousModelInfo = await getMessageModelInfo(currentSessionId);
    const previousModel = previousModelInfo?.model_provider || null;
    
    // 智能选择模型
    const selectedModelInfo = finalModel === 'auto' 
      ? selectModelForRequest({ message }, currentSessionId, previousModel)
      : selectModelForRequest({ message, model: finalModel }, currentSessionId, previousModel);
    
    if (!selectedModelInfo) {
      res.write(`event: error\ndata: ${JSON.stringify({error: `不支持的模型: ${finalModel}`})}\n\n`);
      return res.end();
    }
    
    const { type: finalSelectedModel, variant: finalSelectedVariant } = selectedModelInfo;
    console.log(`🤖 聚合流式API选择模型: ${finalSelectedVariant} (类型: ${finalSelectedModel})`);
    
    // 检查是否已经添加过这条用户消息（避免重复）
    const existingMessages = await getSessionMessages(currentSessionId);
    const messageExists = existingMessages.some(msg => 
      msg.role === 'user' && msg.content === message
    );
    
    if (!messageExists) {
      // 只在消息不存在时添加
      await addMessage({
        session_id: currentSessionId,
        role: 'user',
        content: message,
        model_provider: finalSelectedModel,
        model_name: finalSelectedVariant
      });
      console.log(`💬 聚合流式API新用户消息已添加: ${message.substring(0, 50)}...`);
    } else {
      console.log(`⚠️  聚合流式API用户消息已存在，跳过重复添加: ${message.substring(0, 50)}...`);
    }
    
    // 检查当前用户消息是否已经有AI回复（防重复回复）
    // 找到当前用户消息
    const currentUserMessage = existingMessages
      .filter(msg => msg.role === 'user' && msg.content === message)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]; // 获取最新的匹配消息
    
    if (currentUserMessage) {
      // 检查这条用户消息是否已经有对应的AI回复
      const hasReplyToCurrentMessage = existingMessages.some(msg => 
        msg.role === 'model' && 
        msg.model_provider === finalSelectedModel && 
        msg.model_name === finalSelectedVariant &&
        new Date(msg.created_at) > new Date(currentUserMessage.created_at) // AI回复时间必须在用户消息之后
      );
      
      if (hasReplyToCurrentMessage) {
        console.log(`⚠️  聚合流式API当前消息已有AI回复，跳过重复处理: ${message.substring(0, 50)}...`);
        res.write(`event: error\ndata: ${JSON.stringify({error: '该消息已有AI回复，请勿重复请求'})}\n\n`);
        return res.end();
      }
    }
    
    // 仅将本轮显式传入的附件关联到用户消息；兜底附件不做绑定
    if (providedAttachments.length > 0 && currentUserMessage) {
      console.log(`📎 流式API将 ${providedAttachments.length} 个附件关联到消息 ${currentUserMessage.id}`);
      for (const attachment of providedAttachments) {
        try {
          await updateAttachmentMessageId(attachment.id, currentUserMessage.id);
          console.log(`✅ 附件 ${attachment.id} 已关联到消息 ${currentUserMessage.id}`);
        } catch (error) {
          console.error(`❌ 关联附件失败: ${attachment.id}`, error);
        }
      }
    }

    // 更新会话消息数量
    await updateSessionMessageCount(currentSessionId);

    // 从数据库获取完整的对话历史
    const messages = await getSessionMessages(currentSessionId);
    
    // 转换为对应模型的格式
    console.log(`🔍 准备调用convertMessagesForModel: finalSelectedModel=${finalSelectedModel}, currentSessionId=${currentSessionId}`);
    console.log(`🔍 messages参数:`, messages);
    console.log(`🔍 attachments参数:`, attachments);
    console.log(`🔍 开始调用convertMessagesForModel...`);
    let modelFormattedMessages;
    try {
      modelFormattedMessages = await convertMessagesForModel(messages, finalSelectedModel, currentSessionId, attachments);
      console.log(`🔍 convertMessagesForModel调用完成，结果:`, modelFormattedMessages);
    } catch (error) {
      console.error(`❌ convertMessagesForModel调用失败:`, error.message);
      console.error(`❌ 错误堆栈:`, error.stack);
      throw error;
    }
    
    console.log(`🔍 聚合流式API会话 ${currentSessionId} 发送给${finalSelectedVariant}的对话历史:`);
    console.log(JSON.stringify(modelFormattedMessages, null, 2));

    // 根据模型类型调用对应的流式API
    if (finalSelectedModel === 'gemini') {
      // Gemini流式输出
      const modelConfig = MODEL_CONFIGS[finalSelectedModel];
      const variantStreamPath = MODEL_CONFIGS[finalSelectedModel].variants[finalSelectedVariant]?.streamPath || modelConfig.streamPath;
      const targetUrl = `${VERCEL_PROXY_URL}?path=${encodeURIComponent(variantStreamPath)}`;
      
      console.log(`🔗 Gemini流式API调用路径: ${variantStreamPath}`);
      console.log(`🎯 使用变体: ${finalSelectedVariant}`);
      
      const fetch = require('node-fetch');
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: modelFormattedMessages }),
        signal: AbortSignal.timeout(180000) // 180秒超时
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        res.write(`event: error\ndata: ${JSON.stringify({error: `Gemini API 错误: ${errorData.error?.message || response.statusText}`})}\n\n`);
        return res.end();
      }
      
      // 处理Gemini流式响应
      await handleGeminiStreamResponse(res, response, currentSessionId, finalSelectedVariant);
      
    } else if (finalSelectedModel === 'gpt') {
      // GPT流式输出
      const modelConfig = MODEL_CONFIGS[finalSelectedModel];
      const targetUrl = `${VERCEL_PROXY_URL}?provider=openai&path=${encodeURIComponent(modelConfig.path)}`;
      
      console.log(`🔗 GPT流式API调用路径: ${targetUrl}`);
      console.log(`🎯 使用变体: ${finalSelectedVariant}`);
      
      const fetch = require('node-fetch');
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: finalSelectedVariant,
          messages: modelFormattedMessages,
          temperature: finalSelectedVariant.startsWith('gpt-5') ? 1 : 0.7, // GPT-5只支持temperature = 1
          stream: true // 启用流式输出
        }),
        signal: AbortSignal.timeout(180000) // 180秒超时
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        res.write(`event: error\ndata: ${JSON.stringify({error: `GPT API 错误: ${errorData.error?.message || response.statusText}`})}\n\n`);
        return res.end();
      }
      
      // 处理GPT流式响应
      await handleGPTStreamResponse(res, response, currentSessionId, finalSelectedVariant);
      
    } else if (finalSelectedModel === 'claude') {
      // Claude流式输出（预留）
      res.write(`event: error\ndata: ${JSON.stringify({error: 'Claude 流式输出功能正在开发中，请稍后再试'})}\n\n`);
      
    } else {
      // 其他模型暂不支持流式输出
      res.write(`event: error\ndata: ${JSON.stringify({error: `${finalSelectedModel} 暂不支持流式输出`})}\n\n`);
    }
    
    res.end();

  } catch (error) {
    console.error('聚合流式API错误:', error);
    res.write(`event: error\ndata: ${JSON.stringify({error: '聚合流式API内部错误', details: error.message})}\n\n`);
    res.end();
  }
});

// 新增：专门的Gemini流式响应处理函数（兼容性版本）
async function handleGeminiStreamResponse(res, response, sessionId, finalSelectedVariant) {
  try {
    console.log('🚀 开始Gemini流式处理（兼容性版本）...');
    
    // 使用兼容的方式处理流式响应
    const responseText = await response.text();
    console.log('📄 Gemini响应内容长度:', responseText.length);
    console.log('📄 Gemini响应内容前200字符:', responseText.substring(0, 200));
    
    const lines = responseText.split('\n');
    let fullText = '';
    
    // 检查是否是JSON数组格式（直接响应）
    if (responseText.trim().startsWith('[')) {
      console.log('🔍 检测到JSON数组格式，直接解析...');
      try {
        const jsonArray = JSON.parse(responseText);
        
        for (const data of jsonArray) {
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const text = data.candidates[0].content.parts.find(part => part.text)?.text || '';
            if (text) {
              fullText += text;
              console.log('📝 提取到文本:', text.substring(0, 50) + '...');
              
              // 发送流式数据到前端
              res.write(`event: message\ndata: ${JSON.stringify({text, fullText})}\n\n`);
              
              // 检查是否完成
              if (data.candidates[0].finishReason === 'STOP') {
                console.log('✅ 流式响应完成');
                break;
              }
            }
          }
        }
      } catch (parseError) {
        console.log('解析JSON数组时出错:', parseError);
      }
    } else {
      // 尝试解析其他格式
      console.log('🔍 检测到其他格式，尝试解析...');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
              const text = data.candidates[0].content.parts.find(part => part.text)?.text || '';
              if (text) {
                fullText += text;
                console.log('📝 提取到文本:', text.substring(0, 50) + '...');
                res.write(`event: message\ndata: ${JSON.stringify({text, fullText})}\n\n`);
              }
            }
          } catch (e) {
            // 跳过无效的JSON行
            if (line.includes('"text"') || line.includes('candidates')) {
              console.log('⚠️ 跳过无效JSON行:', line.substring(0, 50));
            }
          }
        }
      }
    }
    
    console.log('📊 Gemini最终完整文本长度:', fullText.length);
    
    // 保存完整回复到数据库 - 使用动态模型名称
    if (fullText) {
      await addMessage({
        session_id: sessionId,
        role: 'model',
        content: fullText,
        model_provider: 'gemini',
        model_name: finalSelectedVariant // 使用选择的变体名称
      });
      
      // 更新会话消息数量
      await updateSessionMessageCount(sessionId);
      
      console.log('💾 Gemini回复已保存到数据库，长度:', fullText.length);
    }
    
    // 发送完成事件
    try {
      const messageCount = await Promise.race([
        getSessionMessageCount(sessionId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('getSessionMessageCount timeout')), 5000))
      ]);
      res.write(`event: session\ndata: ${JSON.stringify({sessionId, messageCount})}\n\n`);
    } catch (error) {
      console.error('获取消息数量失败:', error);
      res.write(`event: session\ndata: ${JSON.stringify({sessionId, messageCount: 0})}\n\n`);
    }
    res.write('event: done\ndata: [DONE]\n\n');
    res.end(); // 关闭流式连接
    
  } catch (error) {
    console.error('Gemini流式响应处理错误:', error);
    res.write(`event: error\ndata: ${JSON.stringify({error: 'Gemini流式响应处理错误: ' + error.message})}\n\n`);
    res.end(); // 确保错误情况下也关闭连接
  }
}

// 新增：专门的GPT流式响应处理函数
async function handleGPTStreamResponse(res, response, sessionId, finalSelectedVariant) {
  try {
    console.log('🚀 开始GPT流式处理...');
    
    // 使用兼容的方式处理流式响应
    const responseText = await response.text();
    console.log('📄 GPT响应内容长度:', responseText.length);
    console.log('📄 GPT响应内容前200字符:', responseText.substring(0, 200));
    
    const lines = responseText.split('\n');
    let fullText = '';
    
    // 处理GPT的Server-Sent Events格式
    for (const line of lines) {
      if (line.trim() && line.startsWith('data: ')) {
        try {
          const data = line.substring(6); // 移除 'data: ' 前缀
          
          // 检查是否是结束标记
          if (data === '[DONE]') {
            console.log('✅ GPT流式响应完成');
            break;
          }
          
          // 解析JSON数据
          const parsed = JSON.parse(data);
          
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
            const text = parsed.choices[0].delta.content;
            if (text) {
              fullText += text;
              console.log('📝 提取到GPT文本:', text.substring(0, 50) + '...');
              
              // 发送流式数据到前端
              res.write(`event: message\ndata: ${JSON.stringify({text, fullText})}\n\n`);
            }
          }
        } catch (e) {
          // 跳过无效的JSON行
          if (line.includes('"content"') || line.includes('choices')) {
            console.log('⚠️ 跳过无效GPT JSON行:', line.substring(0, 50));
          }
        }
      }
    }
    
    console.log('📊 GPT最终完整文本长度:', fullText.length);
    
    // 保存完整回复到数据库
    if (fullText) {
      await addMessage({
        session_id: sessionId,
        role: 'model',
        content: fullText,
        model_provider: 'gpt',
        model_name: finalSelectedVariant // 使用选择的变体名称
      });
      
      // 更新会话消息数量
      await updateSessionMessageCount(sessionId);
      
      console.log('💾 GPT回复已保存到数据库，长度:', fullText.length);
    }
    
    // 发送完成事件
    res.write(`event: session\ndata: ${JSON.stringify({sessionId, messageCount: await getSessionMessageCount(sessionId)})}\n\n`);
    res.write('event: done\ndata: [DONE]\n\n');
    res.end(); // 关闭流式连接
    
  } catch (error) {
    console.error('GPT流式响应处理错误:', error);
    res.write(`event: error\ndata: ${JSON.stringify({error: 'GPT流式响应处理错误: ' + error.message})}\n\n`);
    res.end(); // 确保错误情况下也关闭连接
  }
}

// 诊断：查看客户端来源IP与服务端对外公网IP
app.get('/api/ip', async (req, res) => {
  const clientIpHeader = req.headers['x-forwarded-for'];
  const clientIp = Array.isArray(clientIpHeader)
    ? clientIpHeader[0]
    : (clientIpHeader ? String(clientIpHeader).split(',')[0].trim() : (req.socket?.remoteAddress || null));

  let serverPublicIp = null;
  try {
    const fetch = require('node-fetch');
    const options = { method: 'GET', signal: AbortSignal.timeout(5000) };
    if (networkConfig.useProxy && networkConfig.proxyUrl) {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      options.agent = new HttpsProxyAgent(networkConfig.proxyUrl);
    }
    const resp = await fetch('https://api.ipify.org?format=json', options);
    if (resp.ok) {
      const data = await resp.json();
      serverPublicIp = data.ip || null;
    } else {
      serverPublicIp = `status:${resp.status}`;
    }
  } catch (e) {
    serverPublicIp = `error:${e.message}`;
  }

  res.json({
    clientIp,
    serverPublicIp,
    useProxy: networkConfig.useProxy,
    proxyUrl: networkConfig.useProxy ? networkConfig.proxyUrl : null,
    userAgent: req.headers['user-agent'] || null,
    timestamp: new Date().toISOString()
  });
});

// ==================== 临时文件清理API ====================

// 手动清理临时文件API
app.post('/api/cleanup/temp-files', async (req, res) => {
  try {
    console.log('🧹 收到手动清理临时文件请求');
    
    const { maxAgeHours = 72 } = req.body;
    const result = cleanupTempFiles(maxAgeHours);
    
    res.json({
      success: result.success,
      message: result.success ? '临时文件清理完成' : '临时文件清理失败',
      cleanedCount: result.cleanedCount,
      totalSizeMB: result.totalSizeMB,
      errors: result.errors
    });
    
  } catch (error) {
    console.error('❌ 手动清理临时文件失败:', error.message);
    res.status(500).json({
      success: false,
      error: '清理临时文件失败',
      message: error.message
    });
  }
});

// 获取临时文件统计信息API
app.get('/api/cleanup/temp-files/stats', async (req, res) => {
  try {
    console.log('📊 收到临时文件统计请求');
    
    const stats = getTempFileStats();
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('❌ 获取临时文件统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取统计信息失败',
      message: error.message
    });
  }
});

// ==================== 附件管理API ====================

// 1. 文件上传API
app.post('/api/attachments/upload', upload.array('files', 10), async (req, res) => {
  try {
    console.log('📎 开始处理文件上传请求');
    console.log('📎 请求体:', req.body);
    console.log('📎 文件数量:', req.files ? req.files.length : 0);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    const { sessionId } = req.body; // 只接收sessionId，不再需要messageId
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: '缺少sessionId参数'
      });
    }

    // 验证会话是否存在
    if (!await sessionExists(sessionId)) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      });
    }
    
    // 不创建临时消息，等待AI处理时再关联附件
    console.log('📎 文件上传完成，等待AI处理时关联附件');

    const uploadedFiles = [];
    const errors = [];

    // 处理每个上传的文件
    for (const file of req.files) {
      try {
        const decodedName = normalizeFilename(file.originalname);
        console.log(`📎 处理文件: ${decodedName}`);
        
        // 处理文件（移动、生成缩略图等）
        console.log(`🔍 开始处理文件: ${decodedName}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        const processedFile = await processSingleFile(file);
        console.log(`🔍 文件处理完成: ${file.originalname}`);
        
        // 添加到数据库（暂时不关联消息ID）
        console.log(`🔍 准备添加附件到数据库: sessionId=${sessionId}, messageId=null（等待AI处理时关联）`);
        console.log(`🔍 处理后的文件信息:`, {
          filename: processedFile.filename,
          fileType: processedFile.fileType,
          mimeType: file.mimetype
        });
        
        const attachmentData = {
          sessionId: sessionId,
          messageId: null, // 暂时不关联消息，等待AI处理时关联
          filename: processedFile.filename,
          originalName: decodedName,
          filePath: processedFile.filePath,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileType: processedFile.fileType,
          width: processedFile.width,
          height: processedFile.height,
          duration: processedFile.duration,
          thumbnailPath: processedFile.thumbnailPath,
          metadata: processedFile.metadata
        };
        
        console.log(`🔍 附件数据:`, attachmentData);
        
        let attachmentId;
        try {
          attachmentId = addAttachment({
            sessionId: sessionId,
            messageId: null, // 暂时不关联消息，等待AI处理时关联
            filename: processedFile.filename,
            originalName: decodedName,
            filePath: processedFile.filePath,
            fileSize: file.size,
            mimeType: file.mimetype,
            fileType: processedFile.fileType,
            width: processedFile.width,
            height: processedFile.height,
            duration: processedFile.duration,
            thumbnailPath: processedFile.thumbnailPath,
            metadata: processedFile.metadata
          });
          
          console.log(`✅ 附件添加成功: ${attachmentId}`);

          // 记录处理日志（只有在附件插入成功后才记录）
          try {
            addProcessingLog({
              attachmentId: attachmentId,
              processType: 'upload',
              status: 'success',
              processingTime: processedFile.processingTime || 0
            });
          } catch (logError) {
            console.warn('记录处理日志失败:', logError.message);
            // 不影响主流程
          }
        } catch (attachmentError) {
          console.error(`❌ 添加附件到数据库失败: ${decodedName}`, attachmentError.message);
          throw attachmentError; // 重新抛出错误，让外层catch处理
        }

        uploadedFiles.push({
          id: attachmentId,
          filename: processedFile.filename,
          originalName: decodedName,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileType: processedFile.fileType,
          width: processedFile.width,
          height: processedFile.height,
          duration: processedFile.duration,
          thumbnailPath: processedFile.thumbnailPath,
          url: `/api/attachments/download/${attachmentId}`,
          thumbnailUrl: processedFile.thumbnailPath ? `/api/attachments/thumbnail/${attachmentId}` : null
        });

        console.log(`✅ 文件上传成功: ${decodedName} -> ${attachmentId}`);
        
      } catch (error) {
        console.error(`❌ 处理文件失败: ${decodedName}`, error.message);
        
        // 清理临时文件
        try {
          cleanupTempFile(file.path);
        } catch (cleanupError) {
          console.error('清理临时文件失败:', cleanupError.message);
        }

        errors.push({
          filename: decodedName,
          error: error.message
        });

        // 记录错误日志
        if (req.body.sessionId) {
          addProcessingLog({
            attachmentId: 'temp_' + Date.now(),
            processType: 'upload',
            status: 'error',
            errorMessage: error.message
          });
        }
      }
    }

    // 返回结果 - 修改为前端期望的格式
    const response = {
      success: uploadedFiles.length > 0,
      attachments: uploadedFiles, // 改为attachments字段，与前端期望一致
      errors: errors,
      totalFiles: req.files.length,
      successCount: uploadedFiles.length,
      errorCount: errors.length
    };

    if (uploadedFiles.length > 0) {
      console.log(`✅ 文件上传完成: ${uploadedFiles.length}/${req.files.length} 成功`);
      res.status(200).json(response);
    } else {
      console.log(`❌ 所有文件上传失败`);
      res.status(400).json(response);
    }

  } catch (error) {
    console.error('❌ 文件上传API错误:', error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 2. 文件下载API
app.get('/api/attachments/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📎 请求下载文件: ${id}`);

    const attachment = getAttachmentById(id);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    // 检查文件是否存在
    const fs = require('fs');
    if (!fs.existsSync(attachment.file_path)) {
      console.error(`❌ 文件不存在: ${attachment.file_path}`);
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_name}"`);
    res.setHeader('Content-Length', attachment.file_size);

    // 发送文件
    res.sendFile(path.resolve(attachment.file_path));
    console.log(`✅ 文件下载成功: ${attachment.original_name}`);

  } catch (error) {
    console.error('❌ 文件下载API错误:', error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 3. 缩略图API
app.get('/api/attachments/thumbnail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📎 请求缩略图: ${id}`);

    const attachment = getAttachmentById(id);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    if (!attachment.thumbnail_path) {
      return res.status(404).json({
        success: false,
        error: '缩略图不存在'
      });
    }

    // 检查缩略图文件是否存在
    const fs = require('fs');
    if (!fs.existsSync(attachment.thumbnail_path)) {
      console.error(`❌ 缩略图不存在: ${attachment.thumbnail_path}`);
      return res.status(404).json({
        success: false,
        error: '缩略图不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时

    // 发送缩略图
    res.sendFile(path.resolve(attachment.thumbnail_path));
    console.log(`✅ 缩略图下载成功: ${id}`);

  } catch (error) {
    console.error('❌ 缩略图API错误:', error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 4. 文件信息查询API
app.get('/api/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📎 查询文件信息: ${id}`);

    const attachment = getAttachmentById(id);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    // 返回文件信息（不包含敏感路径信息）
    const fileInfo = {
      id: attachment.id,
      sessionId: attachment.session_id,
      messageId: attachment.message_id,
      filename: attachment.filename,
      originalName: attachment.original_name,
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
      fileType: attachment.file_type,
      width: attachment.width,
      height: attachment.height,
      duration: attachment.duration,
      hasThumbnail: !!attachment.thumbnail_path,
      metadata: attachment.metadata ? (() => {
        try {
          return JSON.parse(attachment.metadata);
        } catch (e) {
          return attachment.metadata; // 如果不是JSON，直接返回原始值
        }
      })() : null,
      createdAt: attachment.created_at,
      updatedAt: attachment.updated_at,
      downloadUrl: `/api/attachments/download/${attachment.id}`,
      thumbnailUrl: attachment.thumbnail_path ? `/api/attachments/thumbnail/${attachment.id}` : null
    };

    res.json({
      success: true,
      data: fileInfo
    });

    console.log(`✅ 文件信息查询成功: ${attachment.original_name}`);

  } catch (error) {
    console.error('❌ 文件信息查询API错误:', error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 5. 文件删除API
app.delete('/api/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📎 请求删除文件: ${id}`);

    const attachment = getAttachmentById(id);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }

    // 删除物理文件
    const fs = require('fs');
    try {
      if (fs.existsSync(attachment.file_path)) {
        fs.unlinkSync(attachment.file_path);
        console.log(`🗑️ 已删除文件: ${attachment.file_path}`);
      }
      
      if (attachment.thumbnail_path && fs.existsSync(attachment.thumbnail_path)) {
        fs.unlinkSync(attachment.thumbnail_path);
        console.log(`🗑️ 已删除缩略图: ${attachment.thumbnail_path}`);
      }
    } catch (fileError) {
      console.error('删除物理文件失败:', fileError.message);
      // 继续执行数据库删除
    }

    // 从数据库删除记录
    const deleted = deleteAttachment(id);
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: '删除失败'
      });
    }

    // 记录删除日志
    addProcessingLog({
      attachmentId: id,
      processType: 'delete',
      status: 'success'
    });

    res.json({
      success: true,
      message: '文件删除成功'
    });

    console.log(`✅ 文件删除成功: ${attachment.original_name}`);

  } catch (error) {
    console.error('❌ 文件删除API错误:', error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 6. 批量删除API
app.delete('/api/attachments/batch', async (req, res) => {
  try {
    const { ids } = req.body;
    console.log(`📎 请求批量删除文件: ${ids?.length || 0} 个`);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少要删除的文件ID列表'
      });
    }

    const results = {
      success: [],
      failed: [],
      total: ids.length
    };

    // 逐个删除文件
    for (const id of ids) {
      try {
        const attachment = getAttachmentById(id);
        if (!attachment) {
          results.failed.push({ id, error: '文件不存在' });
          continue;
        }

        // 删除物理文件
        const fs = require('fs');
        try {
          if (fs.existsSync(attachment.file_path)) {
            fs.unlinkSync(attachment.file_path);
          }
          if (attachment.thumbnail_path && fs.existsSync(attachment.thumbnail_path)) {
            fs.unlinkSync(attachment.thumbnail_path);
          }
        } catch (fileError) {
          console.error(`删除文件失败: ${id}`, fileError.message);
        }

        // 从数据库删除
        const deleted = deleteAttachment(id);
        if (deleted) {
          results.success.push(id);
          addProcessingLog({
            attachmentId: id,
            processType: 'batch_delete',
            status: 'success'
          });
        } else {
          results.failed.push({ id, error: '数据库删除失败' });
        }

      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    res.json({
      success: results.success.length > 0,
      results: results,
      message: `批量删除完成: ${results.success.length}/${results.total} 成功`
    });

    console.log(`✅ 批量删除完成: ${results.success.length}/${results.total} 成功`);

  } catch (error) {
    console.error('❌ 批量删除API错误:', error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 7. 会话附件列表API
app.get('/api/sessions/:sessionId/attachments', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`📎 查询会话附件列表: ${sessionId}`);

    // 验证会话是否存在
    if (!await sessionExists(sessionId)) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      });
    }

    const attachments = getAttachmentsBySession(sessionId);
    
    // 格式化附件信息
    const formattedAttachments = attachments.map(attachment => ({
      id: attachment.id,
      messageId: attachment.message_id,
      filename: attachment.filename,
      originalName: normalizeFilename(attachment.original_name),
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
      fileType: attachment.file_type,
      width: attachment.width,
      height: attachment.height,
      duration: attachment.duration,
      hasThumbnail: !!attachment.thumbnail_path,
      metadata: attachment.metadata ? (() => {
        try {
          return JSON.parse(attachment.metadata);
        } catch (e) {
          return attachment.metadata; // 如果不是JSON，直接返回原始值
        }
      })() : null,
      createdAt: attachment.created_at,
      downloadUrl: `/api/attachments/download/${attachment.id}`,
      thumbnailUrl: attachment.thumbnail_path ? `/api/attachments/thumbnail/${attachment.id}` : null
    }));

    console.log('📎 附件API返回 originalName 样例: ', formattedAttachments.slice(0, 3).map(a => a.originalName));
    res.json({
      success: true,
      data: formattedAttachments,
      count: formattedAttachments.length
    });

    console.log(`✅ 会话附件列表查询成功: ${formattedAttachments.length} 个文件`);

  } catch (error) {
    console.error('❌ 会话附件列表API错误:', error.message);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
  console.error('❌ 服务器错误:', error.message);
  console.error('错误堆栈:', error.stack);
  
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: error.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 后端服务器运行在 http://localhost:${PORT}`);
  console.log(`📡 Gemini API 代理: POST /api/gemini (支持上下文记忆)`);
  console.log(`📡 流式API: POST /api/gemini/stream (支持上下文记忆)`);
  console.log(`🤖 聚合聊天API: POST /api/chat (支持多模型切换和上下文记忆)`);
  console.log(`🚀 聚合流式API: POST /api/chat/stream (支持多模型切换和上下文记忆)`);
  console.log(`🔧 会话管理: GET /api/sessions, GET /api/sessions/:id, DELETE /api/sessions/:id`);
  console.log(`📎 附件管理: POST /api/attachments/upload, GET /api/attachments/download/:id`);
  console.log(`📎 附件管理: GET /api/attachments/thumbnail/:id, DELETE /api/attachments/:id`);
  console.log(`📎 附件管理: GET /api/sessions/:sessionId/attachments (会话附件列表)`);
  console.log(`🔑 使用的 GEMINI_API_KEY: ${GEMINI_API_KEY ? '已配置' : '未配置'}`);
  console.log(`💾 会话存储: SQLite数据库，数据持久化`);
  
  // 启动临时文件清理调度器
  startCleanupScheduler(24, 72); // 每24小时清理一次，保留72小时内的文件
});

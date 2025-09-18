import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Edit3, 
  Check, 
  MessageSquare,
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
  Copy
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import './ChatPage2.css';

interface Question {
  id: string;
  content: string;
  timestamp: Date;
  aiResponse?: string; // AI的回答
  isLoading?: boolean; // 是否正在生成回答
}

interface Session {
  id: string;
  title: string;
  questions: Question[];
  createdAt: Date;
  lastActivity: Date;
}

const ChatPage2: React.FC = () => {
  const [chatTitle, setChatTitle] = useState('新对话');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(chatTitle);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  const [questionOverflow, setQuestionOverflow] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280); // 默认侧边栏宽度
  const [isResizing, setIsResizing] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false); // 输入框是否展开
  const questionContentRef = useRef<HTMLDivElement>(null);
  const conversationListRef = useRef<HTMLDivElement>(null);
  const outputSectionRef = useRef<HTMLDivElement>(null); // 输出区域引用
  const [isCopied, setIsCopied] = useState(false); // 复制状态
  const [displayedLength, setDisplayedLength] = useState(0); // 逐字显示长度
  const [typingStartTime, setTypingStartTime] = useState<number | null>(null); // 打字开始时间
  const [isSubmitting, setIsSubmitting] = useState(false); // 防重复提交状态
  const isSubmittingRef = useRef(false); // 同步的提交状态引用
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null); // 逐字显示定时器引用
  const [autoScroll, setAutoScroll] = useState(true); // 是否自动滚动
  const [userHasScrolled, setUserHasScrolled] = useState(false); // 用户是否手动滚动过
  const [isDarkMode, setIsDarkMode] = useState(true); // 主题模式：true=深色，false=浅色
  const [selectedModel, setSelectedModel] = useState(''); // 初始为空，由useEffect设置
  const selectedModelRef = useRef(''); // 使用ref保持状态，避免被重置
  
  // 文件相关状态
  const [pendingFiles, setPendingFiles] = useState<any[]>([]); // 待上传的文件
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]); // 已上传的文件
  const [isUploadingFiles, setIsUploadingFiles] = useState(false); // 文件上传状态
  
  // 可用的AI模型列表（与首页保持一致）
  const availableModels = [
    {
      id: 'gemini',
      name: 'Gemini 系列',
      type: 'group',
      variants: [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', cost: 'high' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', cost: 'medium', isDefault: true },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', cost: 'low' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', cost: 'low' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', cost: 'high' }
      ]
    },
    {
      id: 'gpt', 
      name: 'GPT 系列',
      type: 'group',
      variants: [
        { id: 'gpt-5', name: 'GPT-5', cost: 'high' },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', cost: 'medium' },
        { id: 'gpt-5-nano', name: 'GPT-5 Nano', cost: 'low' },
        { id: 'gpt-4.1', name: 'GPT-4.1', cost: 'high' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', cost: 'medium' },
        { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', cost: 'low' },
        { id: 'gpt-4o', name: 'GPT-4o', cost: 'high', isDefault: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', cost: 'medium' },
        { id: 'o3', name: 'O3', cost: 'high' },
        { id: 'o3-mini', name: 'O3 Mini', cost: 'medium' },
        { id: 'o4-mini', name: 'O4 Mini', cost: 'medium' }
      ]
    },
    {
      id: 'claude',
      name: 'Claude 系列',
      type: 'group',
      variants: [
        { id: 'claude-opus-4-1-20250805', name: 'Claude Opus', cost: 'high' },
        { id: 'claude-sonnet-4-1-20250805', name: 'Claude Sonnet', cost: 'medium' },
        { id: 'claude-haiku-4-1-20250805', name: 'Claude Haiku', cost: 'low' }
      ]
    }
  ];

  // 主题切换函数
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    console.log('🔄 切换主题:', newTheme ? '深色' : '浅色');
    
    // 更新CSS变量
    if (newTheme) {
      // 深色主题 - 复杂背景
      document.documentElement.style.setProperty('--bg-primary', '#0a0e1a');
      document.documentElement.style.setProperty('--bg-secondary', '#2a2f3e');
      document.documentElement.style.setProperty('--text-primary', '#ffffff');
      document.documentElement.style.setProperty('--text-secondary', '#b0b0b0');
      document.documentElement.style.setProperty('--surface-glass', 'rgba(255, 255, 255, 0.1)');
      document.documentElement.style.setProperty('--border-glass', 'rgba(255, 255, 255, 0.2)');
      // 深色主题的浮动球颜色
      document.documentElement.style.setProperty('--orb-color-1', '#4285f4');
      document.documentElement.style.setProperty('--orb-color-2', '#34a853');
      document.documentElement.style.setProperty('--orb-color-3', '#ea4335');
      // 显示复杂背景效果
      document.documentElement.style.setProperty('--show-complex-bg', 'block');
      document.documentElement.style.setProperty('--show-simple-bg', 'none');
      // 移除浅色主题类
      document.querySelector('.chat-container')?.classList.remove('light-theme');
      console.log('✅ 已切换到深色主题');
    } else {
      // 浅色主题 - 简洁背景
      document.documentElement.style.setProperty('--bg-primary', '#f8f9fa');
      document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
      document.documentElement.style.setProperty('--text-primary', '#333333');
      document.documentElement.style.setProperty('--text-secondary', '#666666');
      document.documentElement.style.setProperty('--surface-glass', 'rgba(255, 255, 255, 0.9)');
      document.documentElement.style.setProperty('--border-glass', '#e0e0e0');
      // 浅色主题的浮动球颜色（更柔和的颜色）
      document.documentElement.style.setProperty('--orb-color-1', '#e3f2fd');
      document.documentElement.style.setProperty('--orb-color-2', '#e8f5e8');
      document.documentElement.style.setProperty('--orb-color-3', '#ffebee');
      // 显示简洁背景，同时保持光球效果
      document.documentElement.style.setProperty('--show-complex-bg', 'block');
      document.documentElement.style.setProperty('--show-simple-bg', 'block');
      // 添加浅色主题类
      document.querySelector('.chat-container')?.classList.add('light-theme');
      console.log('✅ 已切换到浅色主题');
    }
    
    // 保存到localStorage
    localStorage.setItem('chatTheme', newTheme ? 'dark' : 'light');
    
    // 调试：检查CSS变量是否设置成功
    console.log('🔍 CSS变量检查:');
    console.log('--show-complex-bg:', getComputedStyle(document.documentElement).getPropertyValue('--show-complex-bg'));
    console.log('--show-simple-bg:', getComputedStyle(document.documentElement).getPropertyValue('--show-simple-bg'));
  };

    // 模型初始化 - 从URL参数或localStorage获取
  useEffect(() => {
    console.log('🔍 模型初始化useEffect开始执行');
    const urlParams = new URLSearchParams(window.location.search);
    const modelFromUrl = urlParams.get('model');
    
    // 移除保护逻辑，因为不再有无限循环
    
          if (modelFromUrl) {
        // 从URL参数获取模型
        console.log('🔍 检测到URL参数中的模型:', modelFromUrl);
        console.log('🔍 准备调用setSelectedModel:', modelFromUrl);
        setSelectedModel(modelFromUrl);
        selectedModelRef.current = modelFromUrl; // 同时更新ref
        localStorage.setItem('selectedModel', modelFromUrl);
        console.log('🔄 从URL获取模型:', modelFromUrl);
        
        // 状态设置完成
        console.log('🔄 模型设置完成:', modelFromUrl);
      } else {
        // 从localStorage获取模型
        console.log('🔍 未检测到URL参数，从localStorage获取模型');
        console.log('🔍 当前URL参数:', window.location.search);
        console.log('🔍 当前localStorage:', localStorage.getItem('selectedModel'));
        
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) {
          console.log('🔍 准备调用setSelectedModel:', savedModel);
          setSelectedModel(savedModel);
          console.log('🔄 从localStorage获取模型:', savedModel);
        } else {
          // 没有模型，报错
          console.error('❌ 错误: 没有指定模型，也没有保存的模型');
          console.error('❌ 请确保URL中包含model参数，或者之前选择过模型');
          // 不设置默认值，让用户知道有问题
        }
      }
    console.log('🔍 模型初始化useEffect执行完成');
  }, []); // 移除selectedModel依赖，避免无限循环
  
  // 调试：监控selectedModel的每次变化（生产环境可移除）
  useEffect(() => {
    // 只在开发环境下显示详细日志
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 selectedModel状态变化:', selectedModel);
    }
  }, [selectedModel]);

  // 监听selectedModel变化
  useEffect(() => {
    console.log('🔍 selectedModel状态变化:', selectedModel);
    console.log('🔍 当前调用栈:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
  }, [selectedModel]);

  // 监控组件生命周期
  useEffect(() => {
    console.log('🔍 ChatPage2组件已挂载');
    return () => {
      console.log('🔍 ChatPage2组件即将卸载');
    };
  }, []);

  // 主题初始化
  useEffect(() => {
    const savedTheme = localStorage.getItem('chatTheme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      // 应用浅色主题
      document.documentElement.style.setProperty('--bg-primary', '#f8f9fa');
      document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
      document.documentElement.style.setProperty('--text-primary', '#333333');
      document.documentElement.style.setProperty('--text-secondary', '#666666');
      document.documentElement.style.setProperty('--surface-glass', 'rgba(255, 255, 255, 0.9)');
      document.documentElement.style.setProperty('--border-glass', '#e0e0e0');
      // 显示简洁背景，同时保持光球效果
      document.documentElement.style.setProperty('--show-complex-bg', 'block');
      document.documentElement.style.setProperty('--show-simple-bg', 'block');
      // 添加浅色主题类
      document.querySelector('.chat-container')?.classList.add('light-theme');
    } else {
      // 默认深色主题
      document.documentElement.style.setProperty('--show-complex-bg', 'block');
      document.documentElement.style.setProperty('--show-simple-bg', 'none');
      // 移除浅色主题类
      document.querySelector('.chat-container')?.classList.remove('light-theme');
    }
  }, []);

  // 当选中问题变化时，重置滚动状态
  useEffect(() => {
    if (selectedQuestionId) {
      setUserHasScrolled(false);
      setAutoScroll(true);
      console.log('🔄 问题切换，重置滚动状态');
    }
  }, [selectedQuestionId]);

  // 真正的流式内容渲染函数
  const renderStreamingContent = (text: string) => {
    if (!text) return null;
    
    // 按字符分割，实现真正的流式效果
    return text.split('').map((char, index) => {
      const delay = index * 0.02; // 每个字符延迟0.02秒，让速度更快
      
      if (char === '\n') {
        return <br key={index} />;
      }
      
      return (
        <span 
          key={index} 
          className="streaming-char"
          style={{ 
            animationDelay: `${delay}s`,
            opacity: 0,
            animation: 'charStreamIn 0.3s ease-out forwards'
          }}
        >
          {char}
        </span>
      );
    });
  };

  // 获取测试内容的函数 - 已注释
  /*
  const getTestContent = () => {
    return `# 人工智能技术发展报告

## 概述

人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，旨在创建能够执行通常需要人类智能的任务的系统。自1956年达特茅斯会议首次提出"人工智能"概念以来，该领域已经经历了多次发展浪潮。

## 核心技术

### 机器学习
机器学习是AI的核心技术之一，它使计算机能够在没有明确编程的情况下学习和改进。主要类型包括：

- **监督学习**：使用标记数据训练模型
- **无监督学习**：从未标记数据中发现模式
- **强化学习**：通过与环境交互学习最优策略

### 深度学习
深度学习是机器学习的一个子集，使用多层神经网络来模拟人脑的工作方式。

\`\`\`python
import tensorflow as tf
from tensorflow import keras

# 创建一个简单的神经网络
model = keras.Sequential([
    keras.layers.Dense(128, activation='relu', input_shape=(784,)),
    keras.layers.Dropout(0.2),
    keras.layers.Dense(10, activation='softmax')
])

model.compile(optimizer='adam',
              loss='sparse_categorical_crossentropy',
              metrics=['accuracy'])
\`\`\`

## 应用领域

| 领域 | 应用示例 | 技术特点 |
|------|----------|----------|
| 医疗健康 | 医学影像诊断、药物发现 | 高精度、快速处理 |
| 金融科技 | 风险评估、欺诈检测 | 实时分析、模式识别 |
| 自动驾驶 | 环境感知、路径规划 | 多传感器融合、实时决策 |
| 自然语言处理 | 机器翻译、智能客服 | 语义理解、上下文感知 |

## 发展趋势

### 当前热点
1. **大语言模型**：如GPT、Claude等，在自然语言处理方面取得突破
2. **多模态AI**：能够处理文本、图像、音频等多种数据类型
3. **边缘AI**：将AI能力部署到边缘设备，减少延迟和隐私风险

### 未来展望
- **通用人工智能（AGI）**：具备人类级别智能的AI系统
- **人机协作**：AI作为人类能力的延伸，而非替代
- **伦理AI**：确保AI系统的公平性、透明性和安全性

## 挑战与机遇

### 技术挑战
- **数据质量**：高质量训练数据的获取和标注
- **计算资源**：大规模模型训练所需的算力
- **模型解释性**：复杂AI系统的决策过程难以理解

### 社会影响
- **就业变革**：某些工作可能被自动化，同时创造新的就业机会
- **教育转型**：需要培养适应AI时代的新技能
- **监管框架**：建立合适的法律和伦理规范

## 结论

人工智能技术正在快速发展，为各行各业带来深刻变革。虽然面临技术和社会挑战，但通过负责任的发展和部署，AI有潜力为人类创造更美好的未来。

## 参考文献

1. Russell, S., & Norvig, P. (2021). *Artificial Intelligence: A Modern Approach*. Pearson.
2. Goodfellow, I., Bengio, Y., & Courville, A. (2016). *Deep Learning*. MIT Press.
3. Chollet, F. (2017). *Deep Learning with Python*. Manning Publications.
4. Sutton, R. S., & Barto, A. G. (2018). *Reinforcement Learning: An Introduction*. MIT Press.

---

*本报告基于最新的AI技术发展动态编写，数据截至2024年。*`;
  };
  */

  // 分段流式显示函数 - 智能版本（保护代码块） - 已注释
  /*
  const renderSegmentedContent = () => {
    const content = getTestContent();
    
    // 智能分割：保护代码块不被破坏
    const segments = splitContentIntelligently(content);
    
    console.log('🔍 智能分段数量:', segments.length);
    console.log('🔍 第一段:', segments[0]?.substring(0, 50));
    
    // 如果分段失败，回退到完整内容
    if (segments.length <= 1) {
      console.log('⚠️ 分段失败，回退到完整内容');
      return (
        <div className="markdown-content fade-in-content">
          <MarkdownRenderer content={content} />
        </div>
      );
    }
    
    return (
      <div className="segmented-container">
        {segments.map((segment, index) => {
          const delay = index * 0.2; // 减少延迟到0.2秒
          
          return (
            <div 
              key={index} 
              className="content-segment"
              style={{ 
                animationDelay: `${delay}s`
              }}
            >
              <MarkdownRenderer content={segment} />
            </div>
          );
        })}
      </div>
    );
  };
  */

  // 智能分割函数：保护代码块
  const splitContentIntelligently = (content: string): string[] => {
    const segments: string[] = [];
    let currentSegment = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 检测代码块开始/结束
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // 开始代码块
          inCodeBlock = true;
          codeBlockContent = line + '\n';
        } else {
          // 结束代码块
          inCodeBlock = true;
          codeBlockContent += line + '\n';
          
          // 将完整代码块添加到当前段落
          currentSegment += codeBlockContent;
          inCodeBlock = false;
          codeBlockContent = '';
          continue;
        }
      } else if (inCodeBlock) {
        // 在代码块内，继续收集
        codeBlockContent += line + '\n';
        continue;
      }
      
      // 不在代码块内，正常处理
      if (line.trim() === '' && currentSegment.trim() !== '') {
        // 空行且当前段落不为空，分割段落
        segments.push(currentSegment.trim());
        currentSegment = '';
      } else {
        currentSegment += line + '\n';
      }
    }
    
    // 添加最后一个段落
    if (currentSegment.trim() !== '') {
      segments.push(currentSegment.trim());
    }
    
    return segments;
  };

  // 逐字流式显示函数
  const renderCharacterByCharacter = () => {
    // 获取当前选中问题的真实响应内容
    const selectedQuestion = currentSession?.questions.find(q => q.id === selectedQuestionId);
    const content = selectedQuestion?.aiResponse || '';
    
    // 获取当前应该显示的内容
    const currentContent = content.substring(0, displayedLength);
    
    console.log('🎨 渲染检查:', {
      selectedQuestionId,
      hasSelectedQuestion: !!selectedQuestion,
      contentLength: content.length,
      displayedLength,
      currentContentLength: currentContent.length,
      currentContent: currentContent.substring(0, 50) + '...'
    });
    
    return (
      <div className="character-streaming">
        <div className="markdown-content">
          <MarkdownRenderer content={currentContent} />
        </div>
        {/* 打字机光标 */}
        {displayedLength < content.length && (
          <span className="typing-cursor">|</span>
        )}
      </div>
    );
  };

  // 从URL获取初始消息和会话ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialMessage = urlParams.get('message');
    const sessionId = urlParams.get('sessionId');
    
    // 读取待上传的文件数据
    const storedFiles = localStorage.getItem('pendingFiles');
    let fileData = [];
    if (storedFiles) {
      try {
        fileData = JSON.parse(storedFiles);
        setPendingFiles(fileData);
        console.log('📁 ChatPage2接收到文件数据:', fileData);
        // 清除localStorage中的文件数据，避免重复使用
        localStorage.removeItem('pendingFiles');
      } catch (error) {
        console.error('解析文件数据失败:', error);
      }
    }
    
    if (sessionId) {
      const actualSessionId = sessionId;
      
      if (initialMessage) {
        // 新对话：有消息内容 - 不创建临时问题，直接调用API
        const newSession: Session = {
          id: actualSessionId,
          title: initialMessage.substring(0, 30) + '...',
          questions: [], // 初始为空，等待API返回
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        setCurrentSession(newSession);
        setCurrentSessionId(actualSessionId);
        setChatTitle(newSession.title);
        setTempTitle(newSession.title);
        
        console.log('🆔 ChatPage2已加载新对话，会话ID:', actualSessionId, '初始问题:', initialMessage);
        console.log('📁 待上传文件数量:', fileData.length);
        
        // 直接调用API，让后端处理ID生成
        console.log('🔍 直接调用API，不使用临时ID');
        fetchAIResponseDirect(actualSessionId, initialMessage, fileData);
      } else {
        // 历史对话：只有会话ID，需要加载现有数据
        loadExistingSession(actualSessionId);
      }
    }
  }, []);
  
  // 列表长度变化时，自动滚动到底部，确保新问题可见
  useEffect(() => {
    const list = conversationListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [currentSession?.questions.length]);
  

  // 逐字显示效果控制 - 从发送点开始计时
  useEffect(() => {
    const selectedQuestion = currentSession?.questions.find(q => q.id === selectedQuestionId);
    const content = selectedQuestion?.aiResponse || '';
    
    if (!content || !typingStartTime) {
      // 清除现有定时器
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      return;
    }
    
    console.log('🔄 逐字显示检查:', { 
      displayedLength, 
      contentLength: content.length, 
      typingStartTime,
      selectedQuestionId 
    });
    
    // 清除现有定时器，避免重复设置
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    
    // 简单的逐字显示：每50ms显示一个字符
    if (displayedLength < content.length) {
      typingTimerRef.current = setTimeout(() => {
        setDisplayedLength(prev => {
          const newLength = prev + 1;
          console.log('📝 逐字显示更新:', { from: prev, to: newLength });
          return newLength;
        });
        typingTimerRef.current = null; // 清除引用
      }, 50);
    }
    
    // 清理函数
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [displayedLength, currentSession, selectedQuestionId, typingStartTime]);

  // 自动滚动控制 - 简化版本，强制滚动测试
  useEffect(() => {
    console.log('🔄 滚动检查:', { autoScroll, userHasScrolled, displayedLength });
    
    // 强制滚动测试 - 不管状态如何，都尝试滚动
    if (outputSectionRef.current) {
      console.log('🔍 滚动测试 - 容器高度:', outputSectionRef.current.scrollHeight);
      console.log('🔍 滚动测试 - 当前滚动位置:', outputSectionRef.current.scrollTop);
      
      // 强制滚动到底部
      outputSectionRef.current.scrollTo({
        top: outputSectionRef.current.scrollHeight,
        behavior: 'smooth'
      });
      
      console.log('🔍 滚动测试 - 滚动后位置:', outputSectionRef.current.scrollTop);
    }
  }, [displayedLength]); // 只依赖displayedLength

  // 监听用户滚动事件
  useEffect(() => {
    const outputSection = outputSectionRef.current;
    if (!outputSection) return;

    const handleScroll = () => {
      if (!userHasScrolled) {
        setUserHasScrolled(true);
        setAutoScroll(false);
        console.log('🔄 用户手动滚动，停止自动跟随');
      }
    };

    outputSection.addEventListener('scroll', handleScroll);
    return () => outputSection.removeEventListener('scroll', handleScroll);
  }, []); // 移除依赖，避免重复绑定事件

  // 当选中问题变化时，重置展开状态并检测是否溢出两行
  useEffect(() => {
    setIsQuestionExpanded(false);
    setQuestionOverflow(false);

    // 等待DOM渲染后检测
    const timer = setTimeout(() => {
      const el = questionContentRef.current;
      if (!el) return;
      
      // 先确保处于收起状态以检测溢出
      el.classList.remove('expanded');
      el.classList.add('clamped');
      
      // 强制回流
      void el.offsetHeight;
      
      // 检测是否溢出
      const isOverflow = el.scrollHeight > el.clientHeight + 2;
      console.log('检测溢出:', {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        isOverflow: isOverflow
      });
      setQuestionOverflow(isOverflow);
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedQuestionId, currentSession]);

  // 调试：监听滚动状态变化
  useEffect(() => {
    console.log('🔄 滚动状态变化:', { autoScroll, userHasScrolled });
  }, [autoScroll, userHasScrolled]);

  // 加载现有会话数据
  const loadExistingSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        
        // 转换数据库消息格式为前端格式
        const questions: Question[] = [];
        let currentQuestion: Question | null = null;
        
        sessionData.messages.forEach((msg: any) => {
          if (msg.role === 'user') {
            // 如果有之前的问题，保存它
            if (currentQuestion) {
              questions.push(currentQuestion);
            }
            // 创建新问题
            currentQuestion = {
              id: msg.id.toString(),
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              aiResponse: undefined,
              isLoading: false
            };
          } else if (msg.role === 'model' && currentQuestion) {
            // 添加AI回答到当前问题
            currentQuestion.aiResponse = msg.content;
          }
        });
        
        // 添加最后一个问题（如果有的话）
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        const session: Session = {
          id: sessionId,
          title: sessionData.title,
          questions: questions,
          createdAt: new Date(sessionData.created_at),
          lastActivity: new Date(sessionData.last_activity)
        };
        
        setCurrentSession(session);
        setCurrentSessionId(sessionId);
        setChatTitle(sessionData.title);
        setTempTitle(sessionData.title);
        
        // 默认选中第一个问题
        if (questions.length > 0) {
          setSelectedQuestionId(questions[0].id);
        }
        
        console.log('🔄 ChatPage2已加载历史会话，会话ID:', sessionId, '问题数量:', questions.length);
      } else {
        console.error('加载会话失败:', response.statusText);
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    }
  };

  // 处理标题编辑
  const handleTitleEdit = () => {
    setIsEditingTitle(true);
    setTempTitle(chatTitle);
  };

  const handleTitleSave = () => {
    setChatTitle(tempTitle);
    setIsEditingTitle(false);
    
    // 更新当前会话的标题
    if (currentSession) {
      setCurrentSession(prev => {
        if (!prev) return prev;
        return { ...prev, title: tempTitle };
      });
    }
  };

  const handleTitleCancel = () => {
    setTempTitle(chatTitle);
    setIsEditingTitle(false);
  };

  // 上传文件到后端（使用传入的文件数据）
  const uploadFilesWithData = async (sessionId: string, filesToUpload: any[]) => {
    if (filesToUpload.length === 0) return [];
    
    setIsUploadingFiles(true);
    const uploadedAttachments = [];
    
    try {
      for (const file of filesToUpload) {
        // 将base64数据转换为Blob
        const response = await fetch(file.data);
        const blob = await response.blob();
        
        // 创建FormData
        const formData = new FormData();
        formData.append('files', blob, file.name);
        formData.append('sessionId', sessionId);
        // 不再传递messageId，让后端自动创建消息
        
        // 上传文件
        const uploadResponse = await fetch('/api/attachments/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`文件上传失败: ${uploadResponse.statusText}`);
        }
        
        const uploadResult = await uploadResponse.json();
        // 处理返回的attachments数组
        if (uploadResult.attachments && uploadResult.attachments.length > 0) {
          uploadedAttachments.push(...uploadResult.attachments);
        }
        console.log('📁 文件上传成功:', file.name, uploadResult);
      }
      
      setUploadedFiles(uploadedAttachments);
      setPendingFiles([]); // 清空待上传文件
      console.log('✅ 所有文件上传完成:', uploadedAttachments);
      
    } catch (error) {
      console.error('文件上传失败:', error);
      throw error;
    } finally {
      setIsUploadingFiles(false);
    }
    
    return uploadedAttachments;
  };

  // 上传文件到后端（使用pendingFiles状态）
  const uploadFiles = async (sessionId: string) => {
    if (pendingFiles.length === 0) return [];
    
    setIsUploadingFiles(true);
    const uploadedAttachments = [];
    
    try {
      for (const file of pendingFiles) {
        // 将base64数据转换为Blob
        const response = await fetch(file.data);
        const blob = await response.blob();
        
        // 创建FormData
        const formData = new FormData();
        formData.append('files', blob, file.name);
        formData.append('sessionId', sessionId);
        // 不再传递messageId，让后端自动创建消息
        
        // 上传文件
        const uploadResponse = await fetch('/api/attachments/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`文件上传失败: ${uploadResponse.statusText}`);
        }
        
        const uploadResult = await uploadResponse.json();
        // 处理返回的attachments数组
        if (uploadResult.attachments && uploadResult.attachments.length > 0) {
          uploadedAttachments.push(...uploadResult.attachments);
        }
        console.log('📁 文件上传成功:', file.name, uploadResult);
      }
      
      setUploadedFiles(uploadedAttachments);
      setPendingFiles([]); // 清空待上传文件
      console.log('✅ 所有文件上传完成:', uploadedAttachments);
      
    } catch (error) {
      console.error('文件上传失败:', error);
      throw error;
    } finally {
      setIsUploadingFiles(false);
    }
    
    return uploadedAttachments;
  };

  // 获取AI回答（直接版本 - 让后端处理ID生成）
  const fetchAIResponseDirect = async (sessionId: string, question: string, filesToUpload: any[] = []) => {
    console.log('🔍 fetchAIResponseDirect调用参数:', {
      sessionId,
      question: question.substring(0, 30) + '...',
      filesCount: filesToUpload.length
    });
    
    // 防重复调用检查
    if (isSubmittingRef.current) {
      console.log('⚠️ 正在提交中，忽略重复调用');
      return;
    }
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    
    try {
      // 检查模型是否有效 - 优先使用ref值
      const currentModel = selectedModel || selectedModelRef.current;
      if (!currentModel) {
        throw new Error('❌ 错误: 没有选择模型，请先选择AI模型');
      }
      
      console.log('🚀 使用模型:', currentModel);
      
      // 初始化附件数组
      let attachments: any[] = [];
      
      // 如果有待上传的文件，先上传文件
      const filesToProcess = filesToUpload.length > 0 ? filesToUpload : pendingFiles;
      if (filesToProcess.length > 0) {
        console.log('📁 开始上传文件...', filesToProcess.length, '个文件');
        attachments = await uploadFilesWithData(sessionId, filesToProcess);
        
        if (attachments.length === 0) {
          console.error('文件上传失败');
          return;
        }
        
        console.log('✅ 文件上传完成，获得附件:', attachments);
      }
      
      // 使用非流式API接口
      console.log('🚀 准备发送API请求 - 使用模型:', currentModel);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          sessionId: sessionId,
          model: currentModel,
          attachmentIds: attachments.map(att => att.id)
        })
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ 收到AI回复:', data.response?.substring(0, 50) + '...');
      
      // 重新加载会话数据，获取后端生成的ID
      console.log('🔄 重新加载会话数据，获取后端生成的ID');
      await loadExistingSession(sessionId);
      
    } catch (error) {
      console.error('获取AI回复失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 显示错误信息
      setCurrentSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: [...prev.questions, {
            id: Date.now().toString(),
            content: question,
            timestamp: new Date(),
            aiResponse: `抱歉，发生了错误：${errorMessage}`,
            isLoading: false
          }]
        };
      });
    } finally {
      // 重置提交状态，允许下次调用
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // 获取AI回答（流式版本）
  const fetchAIResponse = async (sessionId: string, question: string, questionId: string, filesToUpload: any[] = []) => {
    // 防重复调用检查 - 使用同步的ref
    if (isSubmittingRef.current) {
      console.log('⚠️ fetchAIResponse: 正在提交中，忽略重复调用');
      return;
    }
    
    // 立即设置提交状态，防止重复调用
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    
    try {
      // 立即开始计时，从用户发送点开始
      setTypingStartTime(Date.now());
      setDisplayedLength(0);
      // 重置滚动状态，重新启用自动跟随
      setUserHasScrolled(false);
      setAutoScroll(true);
      console.log('🔄 发送新问题，重置滚动状态:', { userHasScrolled: false, autoScroll: true });
      
      // 检查模型是否有效 - 优先使用ref值
      const currentModel = selectedModel || selectedModelRef.current;
      if (!currentModel) {
        throw new Error('❌ 错误: 没有选择模型，请先选择AI模型');
      }
      
      console.log('🚀 使用模型:', currentModel);
      
      // 初始化附件数组
      let attachments: any[] = [];
      
      // 如果有待上传的文件，先上传文件
      const filesToProcess = filesToUpload.length > 0 ? filesToUpload : pendingFiles;
      if (filesToProcess.length > 0) {
        console.log('📁 开始上传文件...', filesToProcess.length, '个文件');
        attachments = await uploadFilesWithData(sessionId, filesToProcess);
        
        if (attachments.length === 0) {
          console.error('文件上传失败');
          return;
        }
        
        console.log('✅ 文件上传完成，获得附件:', attachments);
      }
      
      // 使用新的聚合流式API接口
      console.log('🚀 准备发送API请求 - 使用模型:', currentModel);
      console.log('🚀 请求体:', {
        message: question,
        sessionId: sessionId,
        model: currentModel,
        attachmentIds: attachments.map(att => att.id)
      });
      
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          sessionId: sessionId,
          model: currentModel, // 传递选择的模型
          attachmentIds: attachments.map(att => att.id) // 传递附件ID数组
        })
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('流式响应不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          
          console.log('🔍 收到流式行:', line);
          
          // 处理 event: message 格式
          if (line.startsWith('event: message')) {
            console.log('📡 收到event: message事件');
            // 等待下一行的 data: 内容
            continue;
          }
          
          if (line.startsWith('data:')) {
            const payloadStr = line.slice(5).trim();
            console.log('📦 收到data内容:', payloadStr);
            
            if (payloadStr === '[DONE]') {
              console.log('✅ 收到[DONE]事件');
              continue;
            }
            
            // 处理内容数据（优先处理）
            try {
              const payload = JSON.parse(payloadStr);
              console.log('📋 解析JSON成功:', {
                hasText: !!payload.text,
                textLength: payload.text ? payload.text.length : 0,
                textPreview: payload.text ? payload.text.substring(0, 50) + '...' : '无text字段',
                hasFullText: !!payload.fullText,
                fullTextLength: payload.fullText ? payload.fullText.length : 0,
                payloadKeys: Object.keys(payload)
              });
              
              if (payload.text) {
                // 增量更新：只添加新内容，不重复显示
                const beforeLength = accumulated.length;
                accumulated += payload.text;
                const afterLength = accumulated.length;
                
                console.log('📝 流式内容更新 (增量):', {
                  newText: payload.text.substring(0, 50) + '...',
                  beforeLength,
                  afterLength,
                  addedLength: afterLength - beforeLength
                });
                console.log('📊 累积内容长度:', accumulated.length);
                
                // 强制立即更新状态，避免批处理延迟
                setCurrentSession(prev => {
                  if (!prev) return prev;
                  const updatedQuestions = prev.questions.map(q => 
                    q.id === questionId 
                      ? { 
                          ...q, 
                          aiResponse: accumulated, // 显示累积内容
                          isLoading: false 
                        }
                      : q
                  );
                  
                  console.log('🔄 状态更新触发，问题ID:', questionId);
                  console.log('📝 更新后的内容长度:', accumulated.length);
                  
                  return {
                    ...prev,
                    questions: updatedQuestions
                  };
                });
                
                // 强制立即渲染
                await new Promise(resolve => setTimeout(resolve, 0));
                
              } else if (payload.sessionId) {
                // 处理会话信息
                if (payload.sessionId && !currentSessionId) {
                  setCurrentSessionId(payload.sessionId);
                  console.log('🆔 流式对话新会话已创建:', payload.sessionId);
                }
              }
            } catch (err) {
              console.error('❌ JSON解析失败:', err);
              console.error('❌ 原始数据:', payloadStr);
              console.error('❌ 数据长度:', payloadStr.length);
              
              // 检查是否是部分JSON数据（流式传输中的不完整数据）
              if (payloadStr.includes('"text"') && !payloadStr.includes('}')) {
                console.log('⚠️ 检测到部分JSON数据，等待完整数据...');
                continue; // 跳过这个不完整的数据块
              }
              
              // 如果是其他错误，记录但继续处理
              console.log('⚠️ 跳过无效数据，继续处理下一块...');
            }
          }
        }
      }

      console.log('🔍 流式响应完成检查:', {
        accumulatedLength: accumulated.length,
        accumulated: accumulated.substring(0, 100) + '...',
        hasAccumulated: !!accumulated
      });
      
      if (!accumulated) {
        console.error('❌ 累积内容为空，抛出错误');
        throw new Error('未收到有效响应');
      }
      
      console.log('✅ AI流式回答已完成:', accumulated.substring(0, 50) + '...');
      
      // 流式响应完成后，重置显示状态并开始逐字显示
      console.log('🔄 重置显示状态，开始逐字显示');
      setDisplayedLength(0);
      setTypingStartTime(Date.now());
      
      // 更新问题状态为完成
      console.log('🔍 更新问题状态:', { questionId, selectedQuestionId, accumulatedLength: accumulated.length });
      setCurrentSession(prev => {
        if (!prev) return prev;
        const updatedQuestions = prev.questions.map(q => {
          // 使用selectedQuestionId而不是questionId来匹配
          if (q.id === selectedQuestionId) {
            console.log('✅ 找到匹配的问题，更新aiResponse:', { selectedQuestionId, aiResponseLength: accumulated.length });
            return { 
              ...q, 
              aiResponse: accumulated, // 设置完整响应内容
              isLoading: false 
            };
          }
          return q;
        });
        
        console.log('📝 更新后的问题列表:', updatedQuestions.map(q => ({ 
          id: q.id, 
          hasAiResponse: !!q.aiResponse, 
          aiResponseLength: q.aiResponse?.length || 0 
        })));
        
        return {
          ...prev,
          questions: updatedQuestions
        };
      });
      
    } catch (error) {
      console.error('获取AI回复失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      // 更新问题状态为错误
      setCurrentSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map(q => 
            q.id === questionId 
              ? { 
                  ...q, 
                                            aiResponse: `抱歉，发生了错误：${errorMessage}`, 
                  isLoading: false 
                }
              : q
          )
        };
      });
    } finally {
      // 重置提交状态，允许下次调用
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // 处理拖拉开始
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.classList.add('resizing');
    
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let resizing = true; // 使用局部标志位，避免闭包内取到过期的 state
    
    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizing) return;
      const deltaX = ev.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + deltaX)); // 限制最小200px，最大500px
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      resizing = false;
      setIsResizing(false);
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 处理输入框发送
  const handleInputSend = async () => {
    // 防重复提交检查
    if (isSubmitting) {
      console.log('⚠️ 正在提交中，忽略重复请求');
      return;
    }
    
    if (inputValue.trim() && currentSession) {
      console.log('发送新问题:', inputValue);
      const questionContent = inputValue;
      setInputValue(''); // 清空输入框
      
      // 直接调用API，让后端处理ID生成
      console.log('🔍 直接调用API，不使用临时ID');
      await fetchAIResponseDirect(currentSession.id, questionContent, pendingFiles);
    }
  };

  // 处理输入框回车键
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInputSend();
    }
  };

  // 创建新对话
  const createNewConversation = () => {
    const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newSession: Session = {
      id: newSessionId,
      title: '新对话',
      questions: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    setCurrentSession(newSession);
    setCurrentSessionId(newSessionId);
    setChatTitle('新对话');
    setTempTitle('新对话');
    setSelectedQuestionId(null);
    
    console.log('🆕 新对话已创建:', newSessionId);
  };

  return (
    <div className="chat-container">
      {/* 简洁背景 */}
      <div className="simple-background"></div>
      
      {/* 光球效果 */}
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>

      {/* 顶部导航 */}
      <header className="chat-header glass-effect">
        <div className="chat-title-section">
          {isEditingTitle ? (
            <div className="title-edit-container">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') handleTitleCancel();
                }}
                className="title-input"
                autoFocus
              />
              <button onClick={handleTitleSave} className="icon-button">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <>
              <h1 className="chat-title">{chatTitle}</h1>
              <div className="model-info">
                <span className="model-label">使用模型:</span>
                <span className="model-name">
                  {(() => {
                    // 在所有变体中查找匹配的模型
                    for (const group of availableModels) {
                      if (group.variants) {
                        const variant = group.variants.find(v => v.id === selectedModel);
                        if (variant) {
                          return variant.name;
                        }
                      }
                    }
                    // 如果没找到，显示原始ID
                    return selectedModel;
                  })()}
                </span>
              </div>
              <button onClick={handleTitleEdit} className="icon-button">
                <Edit3 size={16} />
              </button>
            </>
          )}
        </div>

        <div className="header-actions">
          <button className="theme-toggle-button" onClick={toggleTheme} title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button className="nav-button" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={16} />
            <span>回到主页</span>
          </button>
        </div>
      </header>

      {/* 主要内容区 */}
      <div className="chat-main">
        {/* 左侧问题列表 */}
        <aside 
          className="conversation-sidebar glass-effect"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="sidebar-header">
            <h3 className="sidebar-title">LIST</h3>
          </div>
          <div className="conversation-list" ref={conversationListRef}>
            {!currentSession || currentSession.questions.length === 0 ? (
              <div className="empty-state">
                <p>暂无问题</p>
                <p>在下方输入框提问开始对话</p>
              </div>
            ) : (
              currentSession.questions.map((question) => (
                <div
                  key={question.id}
                  className={`conversation-item ${question.id === selectedQuestionId ? 'active' : ''}`}
                  onClick={() => setSelectedQuestionId(question.id)}
                >
                  <div className="status-icon">
                    {question.isLoading ? (
                      <span className="loading-indicator">⏳</span>
                    ) : question.aiResponse ? (
                      <span className="response-indicator">✅</span>
                    ) : (
                      <span className="pending-indicator">⏳</span>
                    )}
                  </div>
                  <div className="question-preview">
                    <span className="question-content">{question.content}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* 拖拉条 */}
          <div className="resize-handle" onMouseDown={handleResizeStart}></div>
        </aside>

        {/* 右侧内容区 - 上下两部分布局 */}
        <main className="chat-content">
          {/* 上部分：AI回答显示区域 */}
          <div className="output-section">
            <div className="output-header">
              <div className="output-icon">
                <Sparkles size={20} />
              </div>
              <h3 className="output-title">Answer</h3>
              <div className="output-actions">
                <button
                  className="copy-markdown-button"
                  onClick={async () => {
                    try {
                      const selected = currentSession?.questions.find(q => q.id === selectedQuestionId);
                      const markdown = selected?.aiResponse || '';
                      if (!markdown.trim()) return;
                      await navigator.clipboard.writeText(markdown);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 1500);
                    } catch (_) {
                      // 忽略剪贴板异常
                    }
                  }}
                  disabled={!selectedQuestionId || !currentSession?.questions.find(q => q.id === selectedQuestionId)?.aiResponse}
                  aria-label="复制为Markdown"
                  title={isCopied ? '已复制' : '复制Markdown'}
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div className="output-content" ref={outputSectionRef}>
              {!selectedQuestionId ? (
                <div className="empty-messages">
                  <h3>选择问题查看回答</h3>
                  <p>点击左侧LIST中的任意问题，查看Gemini的回答</p>
                </div>
              ) : (
                (() => {
                  const selectedQuestion = currentSession?.questions.find(q => q.id === selectedQuestionId);
                  if (!selectedQuestion) return null;
                  
                  return (
                    <div className="question-answer-container">
                      {/* 显示选中的问题（最多2行，可展开） */}
                      <div className="selected-question">
                        <div
                          ref={questionContentRef}
                          className={`question-content ${isQuestionExpanded ? 'expanded' : 'clamped'}`}
                        >
                          {selectedQuestion.content}
                        </div>
                        {questionOverflow && (
                          <button
                            className="toggle-expand"
                            onClick={() => setIsQuestionExpanded(prev => !prev)}
                            aria-label={isQuestionExpanded ? '收起' : '展开'}
                          >
                            {isQuestionExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                      
                      {/* 显示待上传的文件 */}
                      {pendingFiles.length > 0 && (
                        <div className="pending-files-section">
                          <div className="files-header">
                            <span className="files-title">📁 待上传文件 ({pendingFiles.length})</span>
                            {isUploadingFiles && (
                              <span className="uploading-indicator">⏳ 上传中...</span>
                            )}
                          </div>
                          <div className="files-list">
                            {pendingFiles.map((file, index) => (
                              <div key={index} className="file-item">
                                <div className="file-icon">
                                  {file.type.startsWith('image/') ? '🖼️' : 
                                   file.type === 'application/pdf' ? '📄' : '📎'}
                                </div>
                                <div className="file-info">
                                  <div className="file-name">{file.name}</div>
                                  <div className="file-size">{(file.size / 1024 / 1024).toFixed(1)}MB</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 显示Gemini回答 */}
                      <div className="gemini-answer">
                        <div className="answer-content">
                          {(() => {
                            // 强制获取最新的selectedQuestion状态
                            const latestSelectedQuestion = currentSession?.questions.find(q => q.id === selectedQuestionId);
                            
                            console.log('🎨 渲染条件检查:', {
                              selectedQuestionId,
                              hasSelectedQuestion: !!latestSelectedQuestion,
                              isLoading: latestSelectedQuestion?.isLoading,
                              hasAiResponse: !!latestSelectedQuestion?.aiResponse,
                              aiResponseLength: latestSelectedQuestion?.aiResponse?.length || 0,
                              aiResponsePreview: latestSelectedQuestion?.aiResponse?.substring(0, 50) + '...',
                              currentSessionQuestionsLength: currentSession?.questions.length,
                              currentSessionId: currentSession?.id
                            });
                            
                            return latestSelectedQuestion?.isLoading ? (
                              <div className="loading-answer">
                                <span className="loading-text">⏳ AI正在思考中...</span>
                              </div>
                            ) : latestSelectedQuestion?.aiResponse ? (
          <div className="streaming-content" key={`response-${latestSelectedQuestion.aiResponse.length}`}>
                              {/* 真正的流式Markdown渲染 */}
                              <div className="content-chunk">
                                <div className="streaming-markdown">
                                  {/* 方案3: 逐字流式显示 */}
                                  <div className="markdown-content">
                                    {renderCharacterByCharacter()}
                                  </div>
                                </div>
                                
                                {/* 流式进度指示器 */}
                                <div className="streaming-progress">
                                  <div 
                                    className="streaming-progress-bar" 
                                    style={{
                                      width: `${Math.min((latestSelectedQuestion.aiResponse.length / 1000) * 100, 100)}%`
                                    }}
                                  />
                                </div>
                                
                                {/* 打字机光标效果 */}
                                {latestSelectedQuestion.isLoading && (
                                  <span className="typing-cursor"></span>
                                )}
                              </div>
                            </div>
                            ) : (
                              <div className="no-answer">
                                <span className="no-answer-text">暂无回答</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* 下部分：输入框 */}
          <div className={`chatpage2-input-container ${isInputExpanded ? 'expanded' : ''}`}>
            <div className="input-send-container">
              <div className="input-wrapper">
                <textarea
                  className="chatpage2-chat-input"
                  placeholder="输入你的问题... (支持 Markdown 格式)"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={isInputExpanded ? 8 : 2}
                />
                <button
                  className="expand-toggle-button"
                  onClick={() => setIsInputExpanded(prev => !prev)}
                  aria-label={isInputExpanded ? '收起输入框' : '展开输入框'}
                >
                  {isInputExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              <button 
                className={`chatpage2-send-button ${!inputValue.trim() || isSubmitting ? 'disabled' : ''}`}
                onClick={handleInputSend}
                disabled={!inputValue.trim() || isSubmitting}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChatPage2;

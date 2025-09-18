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
  geminiResponse?: string; // Gemini的回答
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
  const [autoScroll, setAutoScroll] = useState(true); // 是否自动滚动
  const [userHasScrolled, setUserHasScrolled] = useState(false); // 用户是否手动滚动过

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

  // 获取测试内容的函数
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

  // 分段流式显示函数 - 智能版本（保护代码块）
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
    const content = getTestContent();
    
    // 获取当前应该显示的内容
    const currentContent = content.substring(0, displayedLength);
    
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
    
    if (sessionId) {
      const actualSessionId = sessionId;
      
      if (initialMessage) {
        // 新对话：有消息内容
        const newQuestion: Question = {
          id: Date.now().toString(),
          content: initialMessage,
          timestamp: new Date(),
          isLoading: true
        };
        
        const newSession: Session = {
          id: actualSessionId,
          title: initialMessage.substring(0, 30) + '...',
          questions: [newQuestion],
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        setCurrentSession(newSession);
        setCurrentSessionId(actualSessionId);
        setChatTitle(newSession.title);
        setTempTitle(newSession.title);
        setSelectedQuestionId(newQuestion.id);
        
        console.log('🆔 ChatPage2已加载新对话，会话ID:', actualSessionId, '初始问题:', initialMessage);
        
        // 自动获取Gemini回答
        fetchGeminiResponse(actualSessionId, initialMessage, newQuestion.id);
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
    if (!typingStartTime) return; // 还没开始计时
    
    const content = getTestContent();
    const now = Date.now();
    const elapsed = now - typingStartTime;
    const targetLength = Math.floor(elapsed / 5); // 每5ms一个字符
    
    if (targetLength > displayedLength && targetLength <= content.length) {
      setDisplayedLength(targetLength);
    }
    
    // 继续计时直到完成
    if (displayedLength < content.length) {
      const timer = setTimeout(() => {
        setDisplayedLength(prev => Math.min(prev + 1, content.length));
      }, 5);
      
      return () => clearTimeout(timer);
    }
  }, [displayedLength, typingStartTime]);

  // 自动滚动控制
  useEffect(() => {
    if (autoScroll && !userHasScrolled && outputSectionRef.current) {
      // 平滑滚动到输出区域底部
      outputSectionRef.current.scrollTo({
        top: outputSectionRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [displayedLength, autoScroll, userHasScrolled]);

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
  }, [userHasScrolled]);

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
              geminiResponse: undefined,
              isLoading: false
            };
          } else if (msg.role === 'model' && currentQuestion) {
            // 添加Gemini回答到当前问题
            currentQuestion.geminiResponse = msg.content;
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

  // 获取AI回答（流式版本）
  const fetchGeminiResponse = async (sessionId: string, question: string, questionId: string) => {
    try {
      // 立即开始计时，从用户发送点开始
      setTypingStartTime(Date.now());
      setDisplayedLength(0);
      // 重置滚动状态，重新启用自动跟随
      setUserHasScrolled(false);
      setAutoScroll(true);
      
      const response = await fetch('/api/gemini/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          sessionId: sessionId
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
          
          if (line.startsWith('data:')) {
            const payloadStr = line.slice(5).trim();
            if (payloadStr === '[DONE]') continue;
            
            // 处理内容数据（优先处理）
            try {
              const payload = JSON.parse(payloadStr);
              if (payload.content) {
                // 增量更新：只添加新内容，不重复显示
                accumulated += payload.content;
                
                console.log('📝 流式内容更新 (增量):', payload.content.substring(0, 50) + '...');
                console.log('📊 累积内容长度:', accumulated.length);
                
                // 强制立即更新状态，避免批处理延迟
                setCurrentSession(prev => {
                  if (!prev) return prev;
                  const updatedQuestions = prev.questions.map(q => 
                    q.id === questionId 
                      ? { 
                          ...q, 
                          geminiResponse: accumulated, // 显示累积内容
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
              console.error('解析数据失败:', err, '原始数据:', payloadStr);
            }
          }
        }
      }

      if (!accumulated) {
        throw new Error('未收到有效响应');
      }
      
      console.log('✅ AI流式回答已完成:', accumulated.substring(0, 50) + '...');
      
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
                  geminiResponse: `抱歉，发生了错误：${errorMessage}`, 
                  isLoading: false 
                }
              : q
          )
        };
      });
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
    if (inputValue.trim() && currentSession) {
      const newQuestion: Question = {
        id: Date.now().toString(),
        content: inputValue,
        timestamp: new Date(),
        isLoading: true
      };
      
      // 添加新问题到会话
      const updatedSession = {
        ...currentSession,
        questions: [...currentSession.questions, newQuestion],
        lastActivity: new Date()
      };
      
      setCurrentSession(updatedSession);
      setSelectedQuestionId(newQuestion.id);
      
      console.log('发送新问题:', inputValue);
      const questionContent = inputValue;
      setInputValue(''); // 清空输入框
      // 发送后立即滚动到底部，优先展示新项
      requestAnimationFrame(() => {
        const list = conversationListRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
      
      // 自动获取Gemini回答
      await fetchGeminiResponse(currentSession.id, questionContent, newQuestion.id);
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
    const newSessionId = Date.now().toString();
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
      {/* 背景效果 */}
      <div className="background-gradient"></div>
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
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
              <button onClick={handleTitleEdit} className="icon-button">
                <Edit3 size={16} />
              </button>
            </>
          )}
        </div>

        <div className="header-actions">
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
                    ) : question.geminiResponse ? (
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
              <h3 className="output-title">AI 回答</h3>
              <div className="output-actions">
                <button
                  className="copy-markdown-button"
                  onClick={async () => {
                    try {
                      const selected = currentSession?.questions.find(q => q.id === selectedQuestionId);
                      const markdown = selected?.geminiResponse || '';
                      if (!markdown.trim()) return;
                      await navigator.clipboard.writeText(markdown);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 1500);
                    } catch (_) {
                      // 忽略剪贴板异常
                    }
                  }}
                  disabled={!selectedQuestionId || !currentSession?.questions.find(q => q.id === selectedQuestionId)?.geminiResponse}
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
                      
                      {/* 显示Gemini回答 */}
                      <div className="gemini-answer">
                        <div className="answer-content">
                          {selectedQuestion.isLoading ? (
                            <div className="loading-answer">
                              <span className="loading-text">⏳ AI正在思考中...</span>
                            </div>
                          ) : selectedQuestion.geminiResponse ? (
                            <div className="streaming-content" key={`response-${selectedQuestion.geminiResponse.length}`}>
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
                                      width: `${Math.min((selectedQuestion.geminiResponse.length / 1000) * 100, 100)}%`
                                    }}
                                  />
                                </div>
                                
                                {/* 打字机光标效果 */}
                                {selectedQuestion.isLoading && (
                                  <span className="typing-cursor"></span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="no-answer">
                              <span className="no-answer-text">暂无回答</span>
                            </div>
                          )}
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
                className={`chatpage2-send-button ${!inputValue.trim() ? 'disabled' : ''}`}
                onClick={handleInputSend}
                disabled={!inputValue.trim()}
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

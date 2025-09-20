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
  Copy,
  Paperclip,
  X
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import './ChatPage2.css';

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  aiResponse?: string; // AI的回答
  isLoading?: boolean; // 是否正在生成回答
  attachments?: any[]; // 附件信息
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  const [questionOverflow, setQuestionOverflow] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280); // 默认侧边栏宽度
  const [isResizing, setIsResizing] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false); // 输入框是否展开
  const questionContentRef = useRef<HTMLDivElement>(null);
  const conversationListRef = useRef<HTMLDivElement>(null);
  const outputSectionRef = useRef<HTMLDivElement>(null); // 输出区域引用
  const [isCopied, setIsCopied] = useState(false); // 复制状态
  const [isSubmitting, setIsSubmitting] = useState(false); // 防重复提交状态
  const isSubmittingRef = useRef(false); // 同步的提交状态引用
  const [currentQuestion, setCurrentQuestion] = useState(''); // 保存当前问题内容
  const [autoScroll, setAutoScroll] = useState(false); // 是否自动滚动（默认关闭，避免刷新吸底）
  const [userHasScrolled, setUserHasScrolled] = useState(false); // 用户是否手动滚动过
  // 主题已锁定为浅色，不再使用暗色模式状态
  const [selectedModel, setSelectedModel] = useState(''); // 初始为空，由useEffect设置
  const selectedModelRef = useRef(''); // 使用ref保持状态，避免被重置
  
  // 文件相关状态
  const [pendingFiles, setPendingFiles] = useState<any[]>([]); // 待上传的文件
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]); // 已上传的文件
  const [isUploadingFiles, setIsUploadingFiles] = useState(false); // 文件上传状态
  const [currentSubmittingFiles, setCurrentSubmittingFiles] = useState<any[]>([]); // 本轮提交用于展示的附件
  // 多轮对话：仅本轮选择的附件（不影响首轮从首页带来的pendingFiles）
  const [turnFiles, setTurnFiles] = useState<any[]>([]);
  const turnFileInputRef = useRef<HTMLInputElement>(null);
  const hasUploadedInitialFilesRef = useRef(false); // 是否已进行过首轮附件上传
  
  // 打字机播放标记（每条消息只播放一次）+ 本地持久化，避免刷新后重新打字
  const PLAYED_STORAGE_KEY = 'chat2_played_message_ids';
  const getPlayedSet = (): Set<string> => {
    try {
      const raw = localStorage.getItem(PLAYED_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  };
  const persistPlayedSet = (setObj: Set<string>) => {
    try { localStorage.setItem(PLAYED_STORAGE_KEY, JSON.stringify(Array.from(setObj))); } catch (_) {}
  };
  const [playedMessageMap, setPlayedMessageMap] = useState<Record<string, boolean>>({});
  const markPlayed = (id: string) => {
    setPlayedMessageMap(prev => ({ ...prev, [id]: true }));
    try { const st = getPlayedSet(); st.add(id); persistPlayedSet(st); } catch (_) {}
  };
  const hasPlayed = (id?: string | null) => {
    if (!id) return false;
    if (playedMessageMap[id]) return true;
    try { return getPlayedSet().has(id); } catch (_) { return false; }
  };
  const [typingProgressMap, setTypingProgressMap] = useState<Record<string, number>>({});
  const TYPING_MAX_CHARS = 20000; // 支持更长文本逐字输出
  const TYPING_MAX_NODES = 2500; // 控制DOM节点上限，长文按块输出
  const TYPING_CHAR_DELAY_MS = 15; // 每字符时延
  // 仅在第 N+1 轮首次展示时启用打字机的开关（会话级，一次性）
  const getTypingOnceKey = (sid?: string | null) => `typing_once_flag_${sid || ''}`;
  
  // 兜底修复可能的latin1→utf8乱码文件名
  const fixEncodedName = (name?: string): string => {
    if (!name) return '';
    try {
      // 检测常见乱码字符，避免对正常UTF-8误处理
      const looksBroken = /[ÃÂæåéèöøñþ]/.test(name);
      if (looksBroken) {
        const fixed = decodeURIComponent(escape(name));
        return fixed || name;
      }
      return name;
    } catch {
      return name;
    }
  };
  
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

  // 主题切换函数已移除（浅色锁定）

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

  // 主题初始化：强制浅色（无调试日志）
  useEffect(() => {
    try {
      document.documentElement.style.setProperty('--bg-primary', '#f8f9fa');
      document.documentElement.style.setProperty('--bg-secondary', '#f5f5f5');
      document.documentElement.style.setProperty('--text-primary', '#333333');
      document.documentElement.style.setProperty('--text-secondary', '#666666');
      document.documentElement.style.setProperty('--surface-glass', 'rgba(255, 255, 255, 0.9)');
      document.documentElement.style.setProperty('--border-glass', '#e0e0e0');
      document.documentElement.style.setProperty('--show-complex-bg', 'block');
      document.documentElement.style.setProperty('--show-simple-bg', 'block');
      document.querySelector('.chat-container')?.classList.add('light-theme');
      localStorage.setItem('chatTheme', 'light');
    } catch (_) {}
  }, []);

  // 当选中消息变化时，吸顶展示，不再吸底
  useEffect(() => {
    if (!selectedMessageId) return;
    setUserHasScrolled(true);
    setAutoScroll(false);
    try {
      const c = outputSectionRef.current;
      if (c) c.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (_) {}
    console.log('🔄 消息切换，吸顶展示');
  }, [selectedMessageId]);

  // 真正的流式内容渲染函数（自适应分块，保障长文本性能）
  const renderStreamingContent = (text: string) => {
    if (!text) return null;
    const totalLen = text.length;
    const maxNodes = TYPING_MAX_NODES;
    const chunkSize = Math.max(1, Math.ceil(totalLen / maxNodes));
    const chunks: string[] = [];
    for (let i = 0; i < totalLen; i += chunkSize) {
      chunks.push(text.slice(i, Math.min(totalLen, i + chunkSize)));
    }
    const secPerChar = TYPING_CHAR_DELAY_MS / 1000;
    const secPerChunk = secPerChar * chunkSize;
    return chunks.map((chunk, index) => (
      <span
        key={index}
        className="streaming-char"
        style={{
          animation: 'charStreamIn 0.3s ease-out forwards',
          animationDelay: `${index * secPerChunk}s`,
        }}
      >
        {chunk.replace(/\n/g, '\n')}
      </span>
    ));
  };

  // 将文本按"稳定块/活跃块"切分：
  // - 代码块：只有在遇到闭合 ``` 后才归入稳定块
  // - 表格：连续的以 | 开头的行作为表格块，遇到空行或非表格行结束
  const splitStableAndActiveBlocks = (text: string): { blocks: string[]; active: string } => {
    const lines = text.split('\n');
    const blocks: string[] = [];
    let buffer: string[] = [];
    let inCode = false;
    let inTable = false;
    const flush = () => {
      if (buffer.length > 0) {
        blocks.push(buffer.join('\n'));
        buffer = [];
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeFence = /^\s*```/;
      const tableLine = /^\s*\|.*\|\s*$/;
      if (codeFence.test(line)) {
        if (!inCode) {
          // 进入代码块
          buffer.push(line);
          inCode = true;
          continue;
        } else {
          // 结束代码块，归入稳定
          buffer.push(line);
          flush();
          inCode = false;
          inTable = false;
          continue;
        }
      }
      if (inCode) {
        buffer.push(line);
        continue;
      }
      // 表格块识别：连续以 | 开头并以 | 结束的行
      if (!inTable && tableLine.test(line)) {
        inTable = true;
        buffer.push(line);
        continue;
      }
      if (inTable) {
        if (tableLine.test(line)) { buffer.push(line); continue; }
        // 遇到非表格行，结束表格块并flush
        flush();
        inTable = false;
        // 回退当前行到普通处理（不加 continue）
      }
      // 段落分割：空行结束一个稳定块
      if (/^\s*$/.test(line)) {
        if (buffer.length > 0) {
          flush();
        }
        continue;
      } else {
        buffer.push(line);
        // 只有在遇到空行才flush，保证段落完整
      }
    }
    // 未闭合的代码块或最后一段作为活跃段（不flush）
    const active = buffer.join('\n');
    return { blocks, active };
  };

  const StableMarkdownBlock = React.memo(({ content }: { content: string }) => (
    <MarkdownRenderer content={content} />
  ), (prev, next) => prev.content === next.content);

  // 打字机 + 增量 Markdown 渲染组件
  const TypingMarkdownView: React.FC<{ text: string; messageId: string; onDone: () => void; initialIndex?: number; onProgress?: (n: number) => void }> = ({ text, messageId, onDone, initialIndex = 0, onProgress }) => {
    const [idx, setIdx] = useState(initialIndex);
    // 直接基于当前解析结果渲染，不做"追加/末尾替换"缓存
    useEffect(() => {
      setIdx(initialIndex);
      let alive = true;
      const total = text.length;
      // 动态步长，长文本更快
      const step = Math.max(1, Math.ceil(total / TYPING_MAX_NODES));
      const timer = window.setInterval(() => {
        if (!alive) return;
        setIdx(prev => {
          const next = Math.min(total, prev + step);
          if (onProgress) onProgress(next);
          if (next >= total) {
            window.clearInterval(timer);
            onDone();
          }
          return next;
        });
      }, TYPING_CHAR_DELAY_MS);
      return () => { alive = false; window.clearInterval(timer); };
    }, [text, messageId, initialIndex]);

    const current = text.slice(0, idx);
    const { blocks, active } = splitStableAndActiveBlocks(current);
    return (
      <div>
        {blocks.map((b, i) => (
          <div key={i} className="content-chunk">
            <StableMarkdownBlock content={b} />
          </div>
        ))}
        {active && (
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-primary)', background: 'transparent', border: 'none', padding: 0 }}>
            {active}
            <span className="typing-cursor">|</span>
          </pre>
        )}
        <div style={{ marginTop: 8, display: 'none' }}></div>
      </div>
    );
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


  // 从URL获取初始消息和会话ID（更稳健：先探测历史，再决定是否自动提交），并在消费后移除message参数
  useEffect(() => {
    (async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const initialMessage = urlParams.get('message');
      const sessionId = urlParams.get('sessionId');
      
      // 读取待上传的文件数据（来自首页）
      const storedFiles = localStorage.getItem('pendingFiles');
      let fileData = [] as any[];
      if (storedFiles) {
        try {
          fileData = JSON.parse(storedFiles);
          setPendingFiles(fileData);
          console.log('📁 ChatPage2接收到文件数据:', fileData);
          // 读取后立刻清空，避免二次使用
          localStorage.removeItem('pendingFiles');
        } catch (error) {
          console.error('解析文件数据失败:', error);
        }
      }
      
      if (!sessionId) return;
      const actualSessionId = sessionId;
      const consumedKey = `chat2_consumed_message_${actualSessionId}`;
      const hasConsumed = sessionStorage.getItem(consumedKey) === '1';

      // 若URL含message且已消费过，则直接移除参数，避免刷新/历史再次触发
      const stripMessageFromUrl = () => {
        try {
          const p = new URLSearchParams(window.location.search);
          if (p.has('message')) {
            p.delete('message');
            const newQuery = p.toString();
            const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
            window.history.replaceState(null, '', newUrl);
            console.log('🧹 已从URL移除message参数');
          }
        } catch (_) {}
      };

      // 如果已经消费过message，直接加载历史并清理URL
      if (initialMessage && hasConsumed) {
        await loadExistingSession(actualSessionId);
        stripMessageFromUrl();
        return;
      }

      // 探测服务端是否已有历史消息
      try {
        const probe = await authorizedFetch(`/api/sessions/${actualSessionId}`);
        if (probe.ok) {
          const sessionData = await probe.json();
          const msgs = Array.isArray(sessionData.messages) ? sessionData.messages : [];
          const hasHistory = msgs.length > 0;

          if (hasHistory) {
            // 历史会话：只加载历史，不自动提交
            await loadExistingSession(actualSessionId);
            if (initialMessage) {
              sessionStorage.setItem(consumedKey, '1');
              stripMessageFromUrl();
            }
            return;
          }
        }
      } catch (e) {
        console.log('ℹ️ 探测历史失败，可能为新会话，继续判断是否自动提交');
      }

      if (initialMessage) {
        // 新对话：有消息内容 - 不创建临时消息，直接调用API
        const newSession: Session = {
          id: actualSessionId,
          title: initialMessage.substring(0, 30) + '...',
          messages: [],
          createdAt: new Date(),
          lastActivity: new Date()
        };

        setCurrentSession(newSession);
        setCurrentQuestion(initialMessage);
        // 首轮也选中“加载中”占位并滚动，确保右侧展示问题+Thinking
        try { setSelectedMessageId('loading'); } catch (_) {}
        try {
          const c = outputSectionRef.current;
          if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
        } catch (_) {}
        setCurrentSessionId(actualSessionId);
        setChatTitle(newSession.title);
        setTempTitle(newSession.title);

        console.log('🆔 ChatPage2已加载新对话，会话ID:', actualSessionId, '初始问题:', initialMessage);
        console.log('📁 待上传文件数量:', fileData.length);

        console.log('🔍 直接调用API，不使用临时ID');
        try { sessionStorage.setItem(getTypingOnceKey(actualSessionId), '1'); } catch (_) {}
        await fetchAIResponseDirect(actualSessionId, initialMessage, fileData);

        // 标记本会话已消费message，并清理URL
        sessionStorage.setItem(consumedKey, '1');
        stripMessageFromUrl();
      } else {
        // 历史对话：只有会话ID，需要加载现有数据
        await loadExistingSession(actualSessionId);
      }
    })();
  }, []);

  // 读取文件为base64
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 统一带 API Key 的 fetch 封装
  const authorizedFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    let apiKey = localStorage.getItem('site_api_key') || '';
    if (!apiKey) {
      try {
        const entered = window.prompt('请输入访问密钥（由站点管理员提供）');
        if (entered) {
          apiKey = entered.trim();
          localStorage.setItem('site_api_key', apiKey);
        }
      } catch (_) {}
    }
    const existingHeaders = (init.headers as Record<string, string>) || {};
    const normalized: Record<string, string> = {};
    for (const key of Object.keys(existingHeaders)) {
      normalized[key.toLowerCase()] = (existingHeaders as any)[key];
    }
    if (apiKey && !('x-api-key' in normalized) && !('authorization' in normalized)) {
      normalized['x-api-key'] = apiKey;
    }
    return fetch(input, { ...init, headers: normalized });
  };

  // 选择本轮附件
  const handleTurnFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const MAX_TURN_FILES = 5;
      const remainingSlots = Math.max(0, MAX_TURN_FILES - turnFiles.length);
      const toProcess = files.slice(0, remainingSlots);
      const processed = await Promise.all(toProcess.map(async (file) => {
        const data = await readFileAsDataURL(file);
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          data
        };
      }));
      setTurnFiles(prev => [...prev, ...processed]);
      // 允许选同一文件再次选择
      if (turnFileInputRef.current) {
        turnFileInputRef.current.value = '';
      }
      console.log('📎 本轮已选择附件:', processed.map(f => f.name));
    } catch (err) {
      console.error('选择附件失败:', err);
    }
  };

  // 删除本轮已选附件
  const handleRemoveTurnFile = (index: number) => {
    setTurnFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // 列表长度变化时，自动滚动到底部，确保新消息可见
  useEffect(() => {
    const list = conversationListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [currentSession?.messages.length]);
  
  // 当提交从 true -> false 时再清空当前问题，避免首屏被清空
  const wasSubmittingRef2 = useRef(false);
  useEffect(() => {
    if (wasSubmittingRef2.current && !isSubmitting) {
      console.log('🔄 提交完成，清空当前问题内容');
      setCurrentQuestion('');
    }
    wasSubmittingRef2.current = isSubmitting;
  }, [isSubmitting]);
  


  // 自动滚动控制 - 简化版本
  useEffect(() => {
    console.log('🔄 滚动检查:', { autoScroll, userHasScrolled });
    
    // 当有新消息时自动滚动到底部
    if (outputSectionRef.current && autoScroll) {
      console.log('🔍 自动滚动到底部');
      outputSectionRef.current.scrollTo({
        top: outputSectionRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [currentSession?.messages.length, autoScroll]); // 依赖消息数量和自动滚动状态

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
  }, [selectedMessageId, currentSession]);

  // 调试：监听滚动状态变化
  useEffect(() => {
    console.log('🔄 滚动状态变化:', { autoScroll, userHasScrolled });
  }, [autoScroll, userHasScrolled]);

  // 加载现有会话数据（并行获取消息与附件，并进行合并）
  const loadExistingSession = async (sessionId: string) => {
    try {
      const [sessionResp, attachResp] = await Promise.all([
        authorizedFetch(`/api/sessions/${sessionId}`),
        authorizedFetch(`/api/sessions/${sessionId}/attachments`)
      ]);

      if (!sessionResp.ok) {
        console.error('加载会话失败:', sessionResp.statusText);
        return;
      }

      // 附件接口允许失败但不阻塞消息显示
      const sessionData = await sessionResp.json();
      const attachData = attachResp.ok ? await attachResp.json() : { success: false, data: [] };
      const attachments: any[] = attachData?.data || [];

      // 将附件按 messageId 分组，并保留未关联（null）的附件
      const attachmentsByMessageId: Record<string, any[]> = {};
      const unlinkedAttachments: any[] = [];
      for (const att of attachments) {
        if (att.messageId === null || typeof att.messageId === 'undefined') {
          unlinkedAttachments.push(att);
        } else {
          const key = String(att.messageId);
          if (!attachmentsByMessageId[key]) attachmentsByMessageId[key] = [];
          attachmentsByMessageId[key].push(att);
        }
      }
        
        // 转换数据库消息格式为前端格式
      const messages: Message[] = [];
      let currentMessage: Message | null = null;
        
      (sessionData.messages || []).forEach((msg: any) => {
          if (msg.role === 'user') {
          if (currentMessage) {
            messages.push(currentMessage);
            }
          currentMessage = {
              id: msg.id.toString(),
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              aiResponse: undefined,
            isLoading: false,
            attachments: []
          };
        } else if (msg.role === 'model' && currentMessage) {
          currentMessage.aiResponse = msg.content;
        }
      });

      if (currentMessage) {
        messages.push(currentMessage);
      }

      // 将附件合并到对应消息（不再把未关联附件临时挂到最新消息，避免后续轮Loading期误显示历史附件）
      for (const message of messages) {
        const list = attachmentsByMessageId[message.id] || [];
        message.attachments = list;
      }
        
      const session: Session = {
        id: sessionId,
        title: sessionData.title,
        messages: messages,
        createdAt: new Date(sessionData.createdAt || sessionData.created_at),
        lastActivity: new Date(sessionData.lastActivity || sessionData.last_activity)
      };
        
        setCurrentSession(session);
        setCurrentSessionId(sessionId);
        setChatTitle(sessionData.title);
        setTempTitle(sessionData.title);
        
      // 默认选中最新的消息（最后一个）
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        setSelectedMessageId(latestMessage.id);
        if (!latestMessage.aiResponse && pendingFiles.length > 0) {
          console.log('📁 保留附件显示，等待AI回答完成');
        }
      }

      console.log('🔄 ChatPage2已加载历史会话（含附件）: 会话ID:', sessionId, '消息数量:', messages.length, '附件数量:', attachments.length);
    } catch (error) {
      console.error('加载会话失败:', error);
    }
  };

  // 处理标题编辑
  const handleTitleEdit = () => {
    setIsEditingTitle(true);
    setTempTitle(chatTitle);
  };

  const handleTitleSave = async () => {
    const newTitle = (tempTitle || '').trim();
    if (!newTitle) {
      setIsEditingTitle(false);
      return;
    }

    // 先本地更新，提升响应速度
    setChatTitle(newTitle);
    setIsEditingTitle(false);
    if (currentSession) {
      setCurrentSession(prev => {
        if (!prev) return prev;
        return { ...prev, title: newTitle };
      });
    }

    // 同步到后端
    try {
      const sid = currentSessionId || currentSession?.id || null;
      if (sid) {
        const resp = await authorizedFetch(`/api/sessions/${sid}/title`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        });
        if (!resp.ok) {
          throw new Error(`保存标题失败: ${resp.status} ${resp.statusText}`);
        }
        // 二次确认：读取服务端标题，避免本地与服务端不一致
        try {
          const checkResp = await authorizedFetch(`/api/sessions/${sid}`);
          if (checkResp.ok) {
            const data = await checkResp.json();
            if (data && data.title) {
              setChatTitle(data.title);
              setCurrentSession(prev => prev ? { ...prev, title: data.title } : prev);
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error('保存标题失败:', e);
      // 回滚为旧标题
      setChatTitle(currentSession?.title || '新对话');
      if (currentSession) {
        setCurrentSession(prev => {
          if (!prev) return prev;
          return { ...prev, title: currentSession.title };
        });
      }
      // 提示失败，但避免打断
      try { console.warn('保存标题失败，请稍后重试'); } catch (_) {}
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
        const uploadResponse = await authorizedFetch('/api/attachments/upload', {
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
        const uploadResponse = await authorizedFetch('/api/attachments/upload', {
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
      
      // 如果有待上传的文件（仅第一轮或来自首页），先上传文件；后续轮次不重复上传
      const filesToProcess = filesToUpload.length > 0 ? filesToUpload : [];
      setCurrentSubmittingFiles(filesToProcess);
      if (filesToProcess.length > 0) {
        console.log('📁 开始上传文件...', filesToProcess.length, '个文件');
        attachments = await uploadFilesWithData(sessionId, filesToProcess);
        hasUploadedInitialFilesRef.current = true;
        
        if (attachments.length === 0) {
          console.error('文件上传失败');
          return;
        }
        
        console.log('✅ 文件上传完成，获得附件:', attachments);
      }
      
      // 使用非流式API接口
      console.log('🚀 准备发送API请求 - 使用模型:', currentModel);
      const response = await authorizedFetch('/api/chat', {
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
      
      // 本轮结束，清空本轮附件占位
      setCurrentSubmittingFiles([]);
      // 重新加载会话数据，获取后端生成的消息和ID
      console.log('🔄 重新加载会话数据，获取后端生成的消息和ID');
      await loadExistingSession(sessionId);
      
    } catch (error) {
      console.error('获取AI回复失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      console.error('❌ API调用失败:', errorMessage);
      
      // 重新加载会话数据，获取后端生成的消息
      try {
        await loadExistingSession(sessionId);
      } catch (reloadError) {
        console.error('重新加载会话数据失败:', reloadError);
      }
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
    console.log('🔍 handleInputSend 被调用:', { 
      isSubmitting, 
      inputValue: inputValue.substring(0, 30) + '...', 
      hasCurrentSession: !!currentSession,
      currentSessionId: currentSession?.id 
    });
    
    // 防重复提交检查
    if (isSubmitting) {
      console.log('⚠️ 正在提交中，忽略重复请求');
      return;
    }
    
    if (inputValue.trim() && currentSession) {
      console.log('发送新问题:', inputValue);
      const questionContent = inputValue;
      // 组合待发送文件：首轮可携带 pendingFiles；任意轮次可携带 turnFiles
      const usedPending = (!hasUploadedInitialFilesRef.current && pendingFiles.length > 0);
      const usedTurn = (turnFiles.length > 0);
      const selectedTurnFiles = usedTurn ? [...turnFiles] : [];
      const filesToSend = [
        ...(usedPending ? pendingFiles : []),
        ...selectedTurnFiles
      ];
      
      // 保存当前问题内容，用于显示
      setCurrentQuestion(questionContent);
      // 自动选中第 N+1 轮的“加载中”占位，并滚动到输出区
      setSelectedMessageId('loading');
      // 本轮允许一次打字机
      try { sessionStorage.setItem(getTypingOnceKey(currentSession?.id || currentSessionId), '1'); } catch (_) {}
      try {
        const c = outputSectionRef.current;
        if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
      } catch (_) {}
      
      // 清空输入框，但保留待上传文件直到API调用完成
      setInputValue('');
      
      // 直接调用API，让后端处理ID生成
      console.log('🔍 直接调用API，不使用临时ID');
      // 立即清空输入区的本轮占位，避免发送中仍显示
      if (usedTurn) {
        setTurnFiles([]);
        if (turnFileInputRef.current) turnFileInputRef.current.value = '';
      }
      await fetchAIResponseDirect(currentSession.id, questionContent, filesToSend);
      
      // API调用完成后清理本轮选择
      // （已提前清空，这里无需重复）
      // 首轮若使用了首页 pendingFiles，则清空并标记
      if (usedPending) {
        setPendingFiles([]);
        hasUploadedInitialFilesRef.current = true;
      }
      // 注意：currentQuestion 会在 isSubmitting 变为 false 时自动清空
    } else {
      console.log('❌ 发送条件不满足:', { 
        hasInput: !!inputValue.trim(), 
        hasSession: !!currentSession 
      });
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
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    setCurrentSession(newSession);
    setCurrentSessionId(newSessionId);
    setChatTitle('新对话');
    setTempTitle('新对话');
    setSelectedMessageId(null);
    
    console.log('🆕 新对话已创建:', newSessionId);
  };

  // 当选中消息拥有AI回复且未播放过时，按长度估算播放完成时间，超时后切换为Markdown
  useEffect(() => {
    // 保持空实现：避免任何基于时间的强制完成，
    // 仅由 TypingMarkdownView 在真正写满后触发 onDone。
  }, [selectedMessageId, currentSession]);

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
          {/* 主题切换按钮已移除（浅色锁定） */}
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
            {!currentSession || currentSession.messages.length === 0 ? (
              <div className="empty-state">
                {isSubmitting || !!currentQuestion ? (
                  <div className="loading-message">
                    <div className="status-icon">
                      <span className="loading-indicator">⏳</span>
                    </div>
                    <div className="question-preview">
                      <span className="question-content">{currentQuestion || 'AI正在思考中...'}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>暂无消息</p>
                <p>在下方输入框提问开始对话</p>
                  </>
                )}
              </div>
            ) : (
              [
                ...currentSession.messages,
                ...(isSubmitting || !!currentQuestion ? [{ id: 'loading', content: currentQuestion || 'AI正在思考中...', isLoading: true, aiResponse: '' }] : [])
              ].map((message) => (
                <div
                  key={message.id}
                  className={`conversation-item ${message.id === selectedMessageId ? 'active' : ''}`}
                  onClick={() => setSelectedMessageId(message.id)}
                >
                  <div className="status-icon">
                    {message.isLoading ? (
                      <span className="loading-indicator">⏳</span>
                    ) : message.aiResponse ? (
                      <span className="response-indicator">✅</span>
                    ) : (
                      <span className="pending-indicator">⏳</span>
                    )}
                  </div>
                  <div className="question-preview">
                    <span className="question-content">{message.content}</span>
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
                      const selected = currentSession?.messages.find(m => m.id === selectedMessageId);
                      const markdown = selected?.aiResponse || '';
                      if (!markdown.trim()) return;
                      await navigator.clipboard.writeText(markdown);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 1500);
                    } catch (_) {
                      // 忽略剪贴板异常
                    }
                  }}
                  disabled={!selectedMessageId || !currentSession?.messages.find(m => m.id === selectedMessageId)?.aiResponse}
                  aria-label="复制为Markdown"
                  title={isCopied ? '已复制' : '复制Markdown'}
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div className="output-content" ref={outputSectionRef}>
              {(() => {
                const selectedMessage = currentSession?.messages.find(m => m.id === selectedMessageId);
                const isLoadingPlaceholderSelected = selectedMessageId === 'loading';
                // 允许在生成中浏览历史：只有未选择任何消息且处于提交/有问题，或选中占位时，才显示提交中的视图
                const shouldShowSubmitting = isLoadingPlaceholderSelected || (!selectedMessageId && (isSubmitting || !!currentQuestion));
                
                console.log('🔍 调试信息:', {
                  selectedMessageId,
                  selectedMessage: selectedMessage?.content,
                  isSubmitting,
                  shouldShowSubmitting,
                  currentQuestion
                });
                
                if (shouldShowSubmitting) {
                  return (
                <div className="submitting-wrapper">
                        <div className="submitting-state">
                          <div className="question-answer-container">
                            {/* 显示用户的问题 */}
                            <div className="selected-question">
                            <div className="question-content">
                              {(() => {
                                // 优先显示选中消息的内容；若选中占位或未选择，则显示当前轮输入
                                const displayText = (isLoadingPlaceholderSelected ? currentQuestion : selectedMessage?.content) || currentQuestion || '用户问题';
                                console.log('🔍 问题显示调试:', {
                                  'selectedMessage?.content': selectedMessage?.content,
                                  'currentQuestion': currentQuestion,
                                  '最终显示文本': displayText
                                });
                                return displayText;
                              })()}
                </div>
                            </div>
                        
                        {/* 显示附件（仅在本次提交包含新文件时展示） */}
                        {(() => {
                          const filesToShow = currentSubmittingFiles;
                          if (!filesToShow || filesToShow.length === 0) return null;
                          const showingPending = true;
                          return (
                          <div className="pending-files-section">
                            <div className="files-header">
                              <span className="files-title">📁 附件 ({filesToShow.length})</span>
                              {showingPending && (
                                <span className="uploading-indicator">⏳ 上传中...</span>
                              )}
                            </div>
                            <div className="files-list">
                              {filesToShow.map((file: any, index: number) => {
                                const displayName = fixEncodedName(file.originalName || file.name || file.filename || `文件${index + 1}`);
                                const sizeBytes = typeof file.fileSize === 'number' ? file.fileSize : (typeof file.size === 'number' ? file.size : 0);
                                const sizeMB = sizeBytes ? (sizeBytes / 1024 / 1024).toFixed(1) : '';
                                const mimeType = (file.mimeType || file.type || '').toLowerCase();
                                const lowerName = (displayName || '').toLowerCase();
                                return (
                                <div key={file.id || index} className="file-item">
                                  <div className="file-icon">
                                    {(() => {
                                      const fileName = lowerName;
                                      const fileType = mimeType;
                                      
                                      // 图片文件
                                      if (fileType.startsWith('image/')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                            <polyline points="21,15 16,10 5,21"></polyline>
                                          </svg>
                                        );
                                      }
                                      
                                      // PDF文件
                                      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14,2 14,8 20,8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                          </svg>
                                        );
                                      }
                                      
                                      // 代码文件
                                      if (fileName.endsWith('.js') || fileName.endsWith('.ts') || fileName.endsWith('.jsx') || 
                                          fileName.endsWith('.tsx') || fileName.endsWith('.py') || fileName.endsWith('.java') ||
                                          fileName.endsWith('.cpp') || fileName.endsWith('.c') || fileName.endsWith('.cs') ||
                                          fileName.endsWith('.php') || fileName.endsWith('.rb') || fileName.endsWith('.go') ||
                                          fileName.endsWith('.rs') || fileName.endsWith('.swift') || fileName.endsWith('.html')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="16,18 22,12 16,6"></polyline>
                                            <polyline points="8,6 2,12 8,18"></polyline>
                                          </svg>
                                        );
                                      }
                                      
                                      // 文档文件
                                      if (fileType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14,2 14,8 20,8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <line x1="10" y1="9" x2="8" y2="9"></line>
                                          </svg>
                                        );
                                      }
                                      
                                      // Excel文件
                                      if (fileType.includes('excel') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14,2 14,8 20,8"></polyline>
                                            <rect x="8" y="12" width="8" height="4"></rect>
                                            <line x1="8" y1="16" x2="16" y2="16"></line>
                                          </svg>
                                        );
                                      }
                                      
                                      // PowerPoint文件
                                      if (fileType.includes('presentation') || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                            <line x1="8" y1="21" x2="16" y2="21"></line>
                                            <line x1="12" y1="17" x2="12" y2="21"></line>
                                          </svg>
                                        );
                                      }
                                      
                                      // 压缩文件
                                      if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z') ||
                                          fileName.endsWith('.tar') || fileName.endsWith('.gz')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                            <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                          </svg>
                                        );
                                      }
                                      
                                      // 音频文件
                                      if (fileType.startsWith('audio/') || fileName.endsWith('.mp3') || fileName.endsWith('.wav') ||
                                          fileName.endsWith('.flac') || fileName.endsWith('.aac')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                          </svg>
                                        );
                                      }
                                      
                                      // 视频文件
                                      if (fileType.startsWith('video/') || fileName.endsWith('.mp4') || fileName.endsWith('.avi') ||
                                          fileName.endsWith('.mov') || fileName.endsWith('.wmv')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                          </svg>
                                        );
                                      }
                                      
                                      // 文本文件
                                      if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md') ||
                                          fileName.endsWith('.rtf')) {
                                        return (
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14,2 14,8 20,8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <line x1="10" y1="9" x2="8" y2="9"></line>
                                          </svg>
                                        );
                                      }
                                      
                                      // 默认文件图标
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14,2 14,8 20,8"></polyline>
                                        </svg>
                                      );
                                    })()}
                                  </div>
                                  <div className="file-info">
                                    <div className="file-name">{displayName}</div>
                                    {sizeMB && (<div className="file-size">{sizeMB}MB</div>)}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                          );
                        })()}
                        
                        {/* 小行思考提示，避免遮挡 */}
                        <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>Thinking...</div>
                      </div>
                    </div>
                  </div>
                );
                } else {
                  // 显示选中的消息
                  return (
                (() => {
                  const selectedMessage = currentSession?.messages.find(m => m.id === selectedMessageId);
                  if (!selectedMessage) return null;
                  
                  return (
                    <div className="question-answer-container">
                      {/* 显示选中的消息（最多2行，可展开） */}
                      <div className="selected-question">
                        <div
                          ref={questionContentRef}
                          className={`question-content ${isQuestionExpanded ? 'expanded' : 'clamped'}`}
                        >
                          {selectedMessage.content || currentQuestion}
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
                        {(() => {
                          // 在问题块下方（输出文本最上方）提供 Skip 按钮，仅“流式中”显示
                          const ai = selectedMessage.aiResponse || '';
                          const typingOnce = (() => { try { return sessionStorage.getItem(getTypingOnceKey(currentSessionId)) === '1'; } catch (_) { return false; } })();
                          const lastId = currentSession?.messages[currentSession?.messages.length - 1]?.id;
                          const isCurrentStreaming = typingOnce && selectedMessage.id === lastId && !!ai && !hasPlayed(selectedMessage.id) && ai.length <= TYPING_MAX_CHARS;
                          if (!isCurrentStreaming) return null;
                          return (
                            <div style={{ marginTop: 6 }}>
                              <button
                                onClick={() => {
                                  try {
                                    markPlayed(selectedMessage.id);
                                    setTypingProgressMap(prev => ({ ...prev, [selectedMessage.id]: ai.length }));
                                    try { sessionStorage.removeItem(getTypingOnceKey(currentSessionId)); } catch (_) {}
                                  } catch (_) {}
                                }}
                                style={{ fontSize: 12, color: 'var(--text-secondary)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                              >
                                Skip
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* 显示附件（优先使用服务端附件；若仍在等待AI且无服务端附件，则临时展示本次pending文件） */}
                      {(() => {
                        // 优先显示服务端已关联到该消息的附件；若该消息仍在生成且本轮有新文件，则临时显示本轮文件
                        const filesToShow = (selectedMessage.attachments && selectedMessage.attachments.length > 0)
                          ? selectedMessage.attachments
                          : ((!selectedMessage.aiResponse && currentSubmittingFiles.length > 0) ? currentSubmittingFiles : []);
                        if (!filesToShow || filesToShow.length === 0) return null;
                        const showingPending = filesToShow === currentSubmittingFiles;
                        return (
                        <div className="pending-files-section">
                          <div className="files-header">
                            <span className="files-title">📁 附件 ({filesToShow.length})</span>
                            {isUploadingFiles && showingPending && (
                              <span className="uploading-indicator">⏳ 上传中...</span>
                            )}
                            </div>
                          <div className="files-list">
                            {filesToShow.map((file: any, index: number) => {
                              const displayName = fixEncodedName(file.originalName || file.name || file.filename || `文件${index + 1}`);
                              const sizeBytes = typeof file.fileSize === 'number' ? file.fileSize : (typeof file.size === 'number' ? file.size : 0);
                              const sizeMB = sizeBytes ? (sizeBytes / 1024 / 1024).toFixed(1) : '';
                              const mimeType = (file.mimeType || file.type || '').toLowerCase();
                              const lowerName = (displayName || '').toLowerCase();
                              return (
                              <div key={file.id || index} className="file-item">
                                <div className="file-icon">
                                  {(() => {
                                    const fileName = lowerName;
                                    const fileType = mimeType;
                                    
                                    // 图片文件
                                    if (fileType.startsWith('image/')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                          <polyline points="21,15 16,10 5,21"></polyline>
                                        </svg>
                                      );
                                    }
                                    
                                    // PDF文件
                                    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14,2 14,8 20,8"></polyline>
                                          <line x1="16" y1="13" x2="8" y2="13"></line>
                                          <line x1="16" y1="17" x2="8" y2="17"></line>
                                        </svg>
                                      );
                                    }
                                    
                                    // 代码文件
                                    if (fileName.endsWith('.js') || fileName.endsWith('.ts') || fileName.endsWith('.jsx') || 
                                        fileName.endsWith('.tsx') || fileName.endsWith('.py') || fileName.endsWith('.java') ||
                                        fileName.endsWith('.cpp') || fileName.endsWith('.c') || fileName.endsWith('.cs') ||
                                        fileName.endsWith('.php') || fileName.endsWith('.rb') || fileName.endsWith('.go') ||
                                        fileName.endsWith('.rs') || fileName.endsWith('.swift') || fileName.endsWith('.html')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <polyline points="16,18 22,12 16,6"></polyline>
                                          <polyline points="8,6 2,12 8,18"></polyline>
                                        </svg>
                                      );
                                    }
                                    
                                    // 文档文件
                                    if (fileType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14,2 14,8 20,8"></polyline>
                                          <line x1="16" y1="13" x2="8" y2="13"></line>
                                          <line x1="16" y1="17" x2="8" y2="17"></line>
                                          <line x1="10" y1="9" x2="8" y2="9"></line>
                                        </svg>
                                      );
                                    }
                                    
                                    // Excel文件
                                    if (fileType.includes('excel') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14,2 14,8 20,8"></polyline>
                                          <rect x="8" y="12" width="8" height="4"></rect>
                                          <line x1="8" y1="16" x2="16" y2="16"></line>
                                        </svg>
                                      );
                                    }
                                    
                                    // PowerPoint文件
                                    if (fileType.includes('presentation') || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                          <line x1="8" y1="21" x2="16" y2="21"></line>
                                          <line x1="12" y1="17" x2="12" y2="21"></line>
                                        </svg>
                                      );
                                    }
                                    
                                    // 压缩文件
                                    if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z') ||
                                        fileName.endsWith('.tar') || fileName.endsWith('.gz')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                          <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                                          <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                        </svg>
                                      );
                                    }
                                    
                                    // 音频文件
                                    if (fileType.startsWith('audio/') || fileName.endsWith('.mp3') || fileName.endsWith('.wav') ||
                                        fileName.endsWith('.flac') || fileName.endsWith('.aac')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                        </svg>
                                      );
                                    }
                                    
                                    // 视频文件
                                    if (fileType.startsWith('video/') || fileName.endsWith('.mp4') || fileName.endsWith('.avi') ||
                                        fileName.endsWith('.mov') || fileName.endsWith('.wmv')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                        </svg>
                                      );
                                    }
                                    
                                    // 文本文件
                                    if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md') ||
                                        fileName.endsWith('.rtf')) {
                                      return (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14,2 14,8 20,8"></polyline>
                                          <line x1="16" y1="13" x2="8" y2="13"></line>
                                          <line x1="16" y1="17" x2="8" y2="17"></line>
                                          <line x1="10" y1="9" x2="8" y2="9"></line>
                                        </svg>
                                      );
                                    }
                                    
                                    // 默认文件图标
                                    return (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14,2 14,8 20,8"></polyline>
                                      </svg>
                                    );
                                  })()}
                                  </div>
                                <div className="file-info">
                                  <div className="file-name">{displayName}</div>
                                  {sizeMB && (<div className="file-size">{sizeMB}MB</div>)}
                                </div>
                                </div>
                              );
                            })}
                              </div>
                        </div>
                        );
                      })()}
                      
                      {/* 显示Gemini回答 */}
                      <div className="gemini-answer">
                        <div className="answer-content">
                          {(() => {
                            // 强制获取最新的selectedMessage状态
                            const latestSelectedMessage = currentSession?.messages.find(m => m.id === selectedMessageId);
                            
                            console.log('🎨 渲染条件检查:', {
                              selectedMessageId,
                              hasSelectedMessage: !!latestSelectedMessage,
                              isLoading: latestSelectedMessage?.isLoading,
                              hasAiResponse: !!latestSelectedMessage?.aiResponse,
                              aiResponseLength: latestSelectedMessage?.aiResponse?.length || 0,
                              aiResponsePreview: latestSelectedMessage?.aiResponse?.substring(0, 50) + '...',
                              currentSessionMessagesLength: currentSession?.messages.length,
                              currentSessionId: currentSession?.id
                            });
                            
                            if (latestSelectedMessage?.isLoading) {
                              return (
                                <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>Thinking...</div>
                              );
                            }

                            const aiText = latestSelectedMessage?.aiResponse || '';
                            if (!aiText) {
                              return (
                                <div className="no-answer">
                                  <span className="no-answer-text">暂无回答</span>
                                </div>
                              );
                            }

                            // 仅在“会话本轮的一次性开关存在”且该条未播放过时启用打字机；
                            // 否则（前 N 轮、刷新后、再次查看）都直接全文
                            const typingOnce = (() => { try { return sessionStorage.getItem(getTypingOnceKey(currentSessionId)) === '1'; } catch (_) { return false; } })();
                            const shouldType = typingOnce && !hasPlayed(latestSelectedMessage?.id) && aiText.length <= TYPING_MAX_CHARS;
                            if (shouldType) {
                              return (
                                <TypingMarkdownView
                                  text={aiText}
                                  messageId={latestSelectedMessage!.id}
                                  initialIndex={typingProgressMap[latestSelectedMessage!.id] ?? 0}
                                  onProgress={(n) => setTypingProgressMap(prev => ({ ...prev, [latestSelectedMessage!.id]: n }))}
                                  onDone={() => { markPlayed(latestSelectedMessage!.id); setTypingProgressMap(prev => ({ ...prev, [latestSelectedMessage!.id]: aiText.length })); try { sessionStorage.removeItem(getTypingOnceKey(currentSessionId)); } catch (_) {} }}
                                />
                              );
                            }

                            // 打字完成或超长：一次性渲染Markdown（代码高亮、表格等）
                            return (
                              <div className="markdown-content">
                                <MarkdownRenderer content={aiText} />
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })()
                  );
                }
              })()}
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
                {/* 隐藏的文件输入，仅用于本轮选择 */}
                <input
                  ref={turnFileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleTurnFilesSelected}
                />
              </div>
              {/* 添加附件按钮（多轮选择用） - 对齐首页样式（发送按钮左侧） */}
              <div className="chat2-file-upload-container">
                <button 
                  className="chat2-file-upload-button"
                  type="button"
                  onClick={() => turnFileInputRef.current?.click()}
                  aria-label="添加文件"
                  title="添加文件"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                  </svg>
                </button>
                <div className="chat2-file-upload-tooltip">
                  <div className="chat2-tooltip-content">
                    <div className="chat2-tooltip-header">
                      <div className="chat2-tooltip-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14,2 14,8 20,8"></polyline>
                        </svg>
                      </div>
                      <span className="chat2-tooltip-title">文件上传</span>
                    </div>
                    <div className="chat2-tooltip-body">
                      <p className="chat2-tooltip-description">点击选择文件，最多 5 个</p>
                      <div className="chat2-tooltip-details">
                       
                        <div className="chat2-tooltip-item"><span className="label">单个</span><span className="value">≤ 50MB</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button 
                className={`chatpage2-send-button ${!inputValue.trim() || isSubmitting ? 'disabled' : ''}`}
                onClick={handleInputSend}
                disabled={!inputValue.trim() || isSubmitting}
              >
                <Send size={20} />
              </button>
            </div>
            {/* 本轮选择文件的轻量展示，仅占位，风格复用 pending-files-section */}
            {turnFiles.length > 0 && (
              <div className="turn-files-section">
                <div className="turn-files-container">
                  {turnFiles.map((file: any, idx: number) => (
                    <div key={idx} className="turn-file-item">
                      <div className="turn-file-info">
                        <div className="turn-file-icon">
                          {(() => {
                            const fileName = file.name.toLowerCase();
                            const fileType = file.type.toLowerCase();
                            
                            // 图片文件
                            if (fileType.startsWith('image/')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                  <polyline points="21,15 16,10 5,21"></polyline>
                                </svg>
                              );
                            }
                            
                            // PDF文件
                            if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14,2 14,8 20,8"></polyline>
                                  <line x1="16" y1="13" x2="8" y2="13"></line>
                                  <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                              );
                            }
                            
                            // 代码文件
                            if (fileName.endsWith('.js') || fileName.endsWith('.ts') || fileName.endsWith('.jsx') || 
                                fileName.endsWith('.tsx') || fileName.endsWith('.py') || fileName.endsWith('.java') ||
                                fileName.endsWith('.cpp') || fileName.endsWith('.c') || fileName.endsWith('.cs') ||
                                fileName.endsWith('.php') || fileName.endsWith('.rb') || fileName.endsWith('.go') ||
                                fileName.endsWith('.rs') || fileName.endsWith('.swift') || fileName.endsWith('.html')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="16,18 22,12 16,6"></polyline>
                                  <polyline points="8,6 2,12 8,18"></polyline>
                                </svg>
                              );
                            }
                            
                            // 文档文件
                            if (fileType.includes('word') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14,2 14,8 20,8"></polyline>
                                  <line x1="16" y1="13" x2="8" y2="13"></line>
                                  <line x1="16" y1="17" x2="8" y2="17"></line>
                                  <line x1="10" y1="9" x2="8" y2="9"></line>
                                </svg>
                              );
                            }
                            
                            // Excel文件
                            if (fileType.includes('excel') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14,2 14,8 20,8"></polyline>
                                  <rect x="8" y="12" width="8" height="4"></rect>
                                  <line x1="8" y1="16" x2="16" y2="16"></line>
                                </svg>
                              );
                            }
                            
                            // PowerPoint文件
                            if (fileType.includes('presentation') || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                  <line x1="8" y1="21" x2="16" y2="21"></line>
                                  <line x1="12" y1="17" x2="12" y2="21"></line>
                                </svg>
                              );
                            }
                            
                            // 压缩文件
                            if (fileName.endsWith('.zip') || fileName.endsWith('.rar') || fileName.endsWith('.7z') ||
                                fileName.endsWith('.tar') || fileName.endsWith('.gz')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                  <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                </svg>
                              );
                            }
                            
                            // 音频文件
                            if (fileType.startsWith('audio/') || fileName.endsWith('.mp3') || fileName.endsWith('.wav') ||
                                fileName.endsWith('.flac') || fileName.endsWith('.aac')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                </svg>
                              );
                            }
                            
                            // 视频文件
                            if (fileType.startsWith('video/') || fileName.endsWith('.mp4') || fileName.endsWith('.avi') ||
                                fileName.endsWith('.mov') || fileName.endsWith('.wmv')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                              );
                            }
                            
                            // 文本文件
                            if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md') ||
                                fileName.endsWith('.rtf')) {
                              return (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14,2 14,8 20,8"></polyline>
                                  <line x1="16" y1="13" x2="8" y2="13"></line>
                                  <line x1="16" y1="17" x2="8" y2="17"></line>
                                  <line x1="10" y1="9" x2="8" y2="9"></line>
                                </svg>
                              );
                            }
                            
                            // 默认文件图标
                            return (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                              </svg>
                            );
                          })()}
                        </div>
                        <div className="turn-file-details">
                          <div className="turn-file-name-size">
                            <span className="turn-file-name">{file.name}</span>
                            <span className="turn-file-separator"> | </span>
                            <span className="turn-file-size">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="turn-file-remove-button"
                        title="移除"
                        onClick={() => handleRemoveTurnFile(idx)}
                        aria-label={`移除 ${file.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChatPage2;

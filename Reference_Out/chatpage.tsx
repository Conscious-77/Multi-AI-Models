import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Edit3, 
  Copy, 
  Check, 
  Send, 
  Maximize2,
  Minimize2,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './styles.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  preview: string;
  timestamp: Date;
  isActive: boolean;
}

const ChatPage: React.FC = () => {
  const [chatTitle, setChatTitle] = useState('测试新首页');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(chatTitle);
  const [inputValue, setInputValue] = useState('');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 模拟对话历史
  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      preview: '测试新首页',
      timestamp: new Date(),
      isActive: true
    },
    {
      id: '2',
      preview: '想让我提供一些测试建议吗？',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      isActive: false
    }
  ]);

  // 模拟消息数据
  const [messages] = useState<Message[]>([
    {
      id: '1',
      role: 'user',
      content: '好的，你在测试新首页。\n\n请问有什么需要我协助的吗？比如：\n\n- 想让我提供一些测试建议吗？（e.g., 测试哪些方面？）\n- 想让我模拟用户体验并给出反馈吗？（如果可以提供具体页面链接或描述）\n- 想了解一些测试工具或方法？\n- 有什么特定的问题想让我帮忙检查或思考的吗？\n\n请告诉我更多细节，我将尽力提供帮助！',
      timestamp: new Date()
    },
    {
      id: '2',
      role: 'assistant',
      content: `好的，你在测试新首页。

请问有什么需要我协助的吗？比如：

- **想让我提供一些测试建议吗？**（e.g., 测试哪些方面？）
- **想让我模拟用户体验并给出反馈吗？**（如果可以提供具体页面链接或描述）
- **想了解一些测试工具或方法？**
- **有什么特定的问题想让我帮忙检查或思考的吗？**

请告诉我更多细节，我将尽力提供帮助！

\`\`\`javascript
// 示例代码
function testHomePage() {
  const elements = document.querySelectorAll('.test-element');
  elements.forEach(el => {
    console.log('Testing:', el);
  });
}
\`\`\`

### 测试清单
1. 页面加载性能
2. 响应式设计
3. 交互功能
4. 浏览器兼容性`,
      timestamp: new Date()
    }
  ]);

  // 处理标题编辑
  const handleTitleEdit = () => {
    setIsEditingTitle(true);
    setTempTitle(chatTitle);
  };

  const handleTitleSave = () => {
    setChatTitle(tempTitle);
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTempTitle(chatTitle);
    setIsEditingTitle(false);
  };

  // 处理复制
  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 处理输入框展开
  const toggleInputExpand = () => {
    setIsInputExpanded(!isInputExpanded);
    if (!isInputExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // 处理发送消息
  const handleSend = () => {
    if (inputValue.trim()) {
      console.log('Sending:', inputValue);
      setInputValue('');
      setIsInputExpanded(false);
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        <button className="nav-button" onClick={() => window.location.href = '/'}>
          <ArrowLeft size={20} />
          <span>返回主页</span>
        </button>
        
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
          <span className="gemini-badge">
            <Sparkles size={16} />
            Gemini 输出
          </span>
        </div>
      </header>

      {/* 主要内容区 */}
      <div className="chat-main">
        {/* 左侧对话历史 */}
        <aside className="conversation-sidebar glass-effect">
          <h3 className="sidebar-title">对话历史</h3>
          <div className="conversation-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${conv.isActive ? 'active' : ''}`}
              >
                <MessageSquare size={16} />
                <span className="conversation-preview">{conv.preview}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧消息区 */}
        <main className="chat-content">
          <div className="messages-container">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`message-wrapper ${message.role} fade-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="message-bubble glass-effect">
                  <div className="message-header">
                    <span className="message-role">
                      {message.role === 'user' ? '你' : 'Gemini'}
                    </span>
                    <button
                      className="copy-button"
                      onClick={() => handleCopy(message.content, message.id)}
                    >
                      {copiedId === message.id ? (
                        <Check size={14} className="copy-success" />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span className="copy-tooltip">
                        {copiedId === message.id ? '已复制' : '复制为Markdown'}
                      </span>
                    </button>
                  </div>
                  <div className="message-content">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="code-block"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={`inline-code ${className}`} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </main>
      </div>

      {/* 输入区域 */}
      <div className={`input-area ${isInputExpanded ? 'expanded' : ''}`}>
        <div className="input-wrapper glass-effect">
          <button className="expand-button" onClick={toggleInputExpand}>
            {isInputExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="输入消息... (支持 Markdown 格式)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            className={`send-button ${!inputValue.trim() ? 'disabled' : ''}`}
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            <Send size={20} />
          </button>
        </div>
        {isInputExpanded && (
          <div className="markdown-hint">
            支持 **粗体**、*斜体*、`代码`、[链接](url) 等 Markdown 格式
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;

import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Settings,
  Send,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import MarkdownRenderer from '../../src/components/MarkdownRenderer';
import './AgentPage.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface AgentConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const AgentPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    systemPrompt: `你是一个智能AI助手，具有以下能力：\n\n## 核心功能\n- 理解用户需求并提供专业建议\n- 分析复杂问题并给出解决方案\n- 支持多语言交流\n\n## 工作原则\n- 始终保持友好和专业的语气\n- 提供准确、有用的信息\n- 在不确定时诚实表达\n\n请根据以上设定来帮助用户。`,
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048
  });
  const [showConfig, setShowConfig] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputValue('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, config: agentConfig })
      });
      if (!response.ok) throw new Error(`API 请求失败: ${response.status}`);
      const data = await response.json();
      setMessages(prev => prev.map(msg => msg.id === assistantMessage.id ? { ...msg, content: data.response, isLoading: false } : msg));
    } catch (error) {
      setMessages(prev => prev.map(msg => msg.id === assistantMessage.id ? { ...msg, content: '抱歉，发生了错误，请稍后重试。', isLoading: false } : msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyConfig = async () => {
    const configText = `System Prompt: ${agentConfig.systemPrompt}\n\nModel: ${agentConfig.model}\nTemperature: ${agentConfig.temperature}\nMax Tokens: ${agentConfig.maxTokens}`;
    try {
      await navigator.clipboard.writeText(configText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  const resetConfig = () => {
    setAgentConfig({
      systemPrompt: `你是一个智能AI助手，具有以下能力：\n\n## 核心功能\n- 理解用户需求并提供专业建议\n- 分析复杂问题并给出解决方案\n- 支持多语言交流\n\n## 工作原则\n- 始终保持友好和专业的语气\n- 提供准确、有用的信息\n- 在不确定时诚实表达\n\n请根据以上设定来帮助用户。`,
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 2048
    });
  };

  return (
    <div className="agent-container">
      <div className="background-gradient"></div>
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <header className="agent-header glass-effect">
        <div className="header-left">
          <button className="nav-button" onClick={() => window.location.href = '/'}>
            <ArrowLeft size={16} />
            <span>回到首页</span>
          </button>
        </div>
        <div className="header-center">
          <h1 className="agent-title">
            <Sparkles size={20} />
            AI Agent 测试（副本）
          </h1>
        </div>
        <div className="header-right">
          <button className={`config-button ${showConfig ? 'active' : ''}`} onClick={() => setShowConfig(!showConfig)}>
            <Settings size={16} />
            <span>配置</span>
          </button>
        </div>
      </header>

      <div className="agent-main">
        <div className={`config-panel ${showConfig ? 'open' : ''}`}>
          <div className="config-header">
            <h3>Agent 配置</h3>
            <div className="config-actions">
              <button className="copy-button" onClick={copyConfig}>{isCopied ? <Check size={14} /> : <Copy size={14} />}</button>
              <button className="reset-button" onClick={resetConfig}>重置</button>
            </div>
          </div>
          <div className="config-section">
            <label>System Prompt</label>
            <textarea className="system-prompt-input" value={agentConfig.systemPrompt} onChange={(e) => setAgentConfig(prev => ({ ...prev, systemPrompt: e.target.value }))} placeholder="输入系统提示词..." rows={12} />
            <small>支持 Markdown 格式</small>
          </div>
          <div className="config-section">
            <label>模型</label>
            <select value={agentConfig.model} onChange={(e) => setAgentConfig(prev => ({ ...prev, model: e.target.value }))}>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>
          </div>
          <div className="config-section">
            <label>Temperature: {agentConfig.temperature}</label>
            <input type="range" min="0" max="2" step="0.1" value={agentConfig.temperature} onChange={(e) => setAgentConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))} />
            <small>0 = 确定性，2 = 创造性</small>
          </div>
          <div className="config-section">
            <label>最大 Token 数</label>
            <input type="number" min="100" max="8192" step="100" value={agentConfig.maxTokens} onChange={(e) => setAgentConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))} />
          </div>
        </div>

        <div className="chat-area">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <Sparkles size={48} />
                <h3>开始与 AI Agent 对话</h3>
                <p>配置好 system prompt 后，就可以开始测试了！</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`message ${message.role}`}>
                  <div className="message-header">
                    <span className="message-role">{message.role === 'user' ? '👤 用户' : '🤖 Agent'}</span>
                    <span className="message-time">{message.timestamp.toLocaleTimeString('zh-CN')}</span>
                  </div>
                  <div className="message-content">
                    {message.isLoading ? (
                      <div className="loading-message">
                        <div className="loading-dots"><span></span><span></span><span></span></div>
                        <span>Agent 正在思考中...</span>
                      </div>
                    ) : (
                      <MarkdownRenderer content={message.content} />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <div className="input-container">
              <textarea ref={inputRef} className="message-input" placeholder="输入您的问题或指令..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleInputKeyDown} rows={3} disabled={isSubmitting} />
              <button className={`send-button ${!inputValue.trim() || isSubmitting ? 'disabled' : ''}`} onClick={handleSendMessage} disabled={!inputValue.trim() || isSubmitting}>
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPage;



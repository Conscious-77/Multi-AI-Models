import React, { useState, useRef, useEffect, useMemo } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import MarkdownRenderer from './MarkdownRenderer';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
  aiResponse?: string; // AI 的回复内容
}

interface Conversation {
  id: string;
  userMessage: string;
  aiResponse?: string;
  timestamp: string;
  isLoading?: boolean;
}

const ChatInterface: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null); // 添加会话ID状态
  const [isLoadingSession, setIsLoadingSession] = useState(true); // 添加会话加载状态
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 从 URL 获取会话 ID 并加载现有会话数据
  useEffect(() => {
    const loadSessionFromUrl = async () => {
      const path = window.location.pathname;
      const match = path.match(/\/chat\/(.+)/);
      
      if (match) {
        const sessionId = match[1];
        setCurrentSessionId(sessionId);
        
        try {
          // 加载会话数据
          const response = await fetch(`/api/sessions/${sessionId}`);
          if (response.ok) {
            const sessionData = await response.json();
            
            // 将数据库中的消息转换为前端格式
            const existingConversations: Conversation[] = [];
            let currentUserMessage = '';
            let currentAiResponse = '';
            
            sessionData.messages.forEach((msg: any, index: number) => {
              if (msg.role === 'user') {
                // 如果有之前的用户消息，保存对话
                if (currentUserMessage && currentAiResponse) {
                  existingConversations.push({
                    id: `existing_${index}`,
                    userMessage: currentUserMessage,
                    aiResponse: currentAiResponse,
                    timestamp: new Date(msg.timestamp).toLocaleTimeString(),
                    isLoading: false
                  });
                }
                currentUserMessage = msg.content;
                currentAiResponse = '';
              } else if (msg.role === 'model') {
                currentAiResponse = msg.content;
              }
            });
            
            // 添加最后一个对话（如果有的话）
            if (currentUserMessage) {
              const conversationId = `existing_${sessionData.messages.length}`;
              existingConversations.push({
                id: conversationId,
                userMessage: currentUserMessage,
                aiResponse: currentAiResponse, // 可能为空字符串
                timestamp: new Date().toLocaleTimeString(),
                isLoading: !currentAiResponse // 如果没有AI回复，设置为加载状态
              });
              
              // 如果没有AI回复，自动调用Gemini API
              if (!currentAiResponse) {
                // 延迟一下，确保组件已经渲染
                setTimeout(() => {
                  fetchGeminiResponse(sessionId, currentUserMessage, conversationId);
                }, 100);
              }
            }
            
            setConversations(existingConversations);
            
            // 选中最后一个对话
            if (existingConversations.length > 0) {
              setSelectedConversationId(existingConversations[existingConversations.length - 1].id);
            }
          } else {
            console.error('加载会话失败:', response.statusText);
          }
        } catch (error) {
          console.error('加载会话失败:', error);
        }
      }
      
      setIsLoadingSession(false);
    };
    
    loadSessionFromUrl();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversations]);

  const addConversation = (userMessage: string) => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      userMessage,
      timestamp: new Date().toLocaleTimeString(),
      isLoading: true
    };
    setConversations(prev => [...prev, newConversation]);
    setSelectedConversationId(newConversation.id); // 自动选中最新对话
    return newConversation.id;
  };

  const updateConversationResponse = (conversationId: string, aiResponse: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, aiResponse, isLoading: false }
        : conv
    ));
  };

  // 自动获取Gemini回复的函数
  const fetchGeminiResponse = async (sessionId: string, userMessage: string, conversationId: string) => {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Gemini API 错误: ${data.error.message || data.error.code || '未知错误'}`);
      }
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiResponse = data.candidates[0].content.parts[0].text;
        updateConversationResponse(conversationId, aiResponse);
      } else {
        updateConversationResponse(conversationId, '抱歉，我无法理解您的请求。');
      }
    } catch (error) {
      console.error('获取Gemini回复失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      updateConversationResponse(conversationId, `抱歉，发生了错误：${errorMessage}`);
    }
  };

  const selectedConversation = useMemo(() => 
    conversations.find(conv => conv.id === selectedConversationId), 
    [conversations, selectedConversationId]
  );

  const sendMessage = async (message: string) => {
    // 添加用户消息到左侧
    const conversationId = addConversation(message);
    setIsLoading(true);

    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

      // 调用本地后端 Gemini API，传递会话ID
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sessionId: currentSessionId // 传递当前会话ID
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 检查 API 是否返回错误
      if (data.error) {
        throw new Error(`Gemini API 错误: ${data.error.message || data.error.code || '未知错误'}`);
      }
      
      // 保存会话ID（如果是第一次对话）
      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId);
        console.log('🆔 新会话已创建:', data.sessionId);
      }
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const aiResponse = data.candidates[0].content.parts[0].text;
        updateConversationResponse(conversationId, aiResponse);
      } else {
        updateConversationResponse(conversationId, '抱歉，我无法理解您的请求。');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      
      let errorMessage = '抱歉，发生了错误，请稍后重试。';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，请稍后重试。';
        } else if (error.message.includes('Gemini API 错误')) {
          errorMessage = error.message;
        } else if (error.message.includes('API 请求失败')) {
          errorMessage = `API 请求失败: ${error.message}`;
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查网络连接。';
        }
      }
      
      updateConversationResponse(conversationId, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessageStream = async (message: string) => {
    const conversationId = addConversation(message);
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch('/api/gemini/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          sessionId: currentSessionId // 传递当前会话ID
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`流式通道启动失败: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        let currentEvent = null;
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const payloadStr = line.slice(5).trim();
            if (payloadStr === '[DONE]') continue;
            
            if (currentEvent === 'session') {
              // 处理会话信息
              try {
                const sessionData = JSON.parse(payloadStr);
                if (sessionData.sessionId && !currentSessionId) {
                  setCurrentSessionId(sessionData.sessionId);
                  console.log('🆔 流式对话新会话已创建:', sessionData.sessionId);
                }
              } catch (err) {
                console.error('解析会话数据失败:', err);
              }
            } else {
              // 处理内容数据
              try {
                const payload = JSON.parse(payloadStr);
                if (payload.content) {
                  accumulated += payload.content;
                  updateConversationResponse(conversationId, accumulated);
                  // 实时预览：选中当前对话
                  setSelectedConversationId(conversationId);
                }
              } catch (err) {
                console.error('解析内容数据失败:', err);
              }
            }
          }
        }
      }

      clearTimeout(timeoutId);
      if (!accumulated) {
        updateConversationResponse(conversationId, '（空响应）');
      }
    } catch (error) {
      console.error('流式发送失败:', error);
      updateConversationResponse(conversationId, '抱歉，流式输出失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加清除会话功能
  const clearSession = () => {
    setCurrentSessionId(null);
    setConversations([]);
    setSelectedConversationId(null);
    console.log('🧹 会话已清除');
  };

  return (
    <div className="chat-container">
      {/* 头部 */}
      <div className="chat-header">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 'normal', color: '#6b7280', margin: 0 }}>
            Welcome To Gemini-2.5-Pro
          </h1>
          {currentSessionId && (
            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              会话: {currentSessionId.slice(-8)}...
            </div>
          )}
          {currentSessionId && (
            <button 
              onClick={clearSession}
              style={{
                padding: '4px 8px',
                fontSize: '0.7rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              清除会话
            </button>
          )}
        </div>
      </div>

      {/* 分栏主体 */}
      <div className="split-body">
        {/* 左侧：显示所有对话历史 */}
        <div className="left-panel">
          <div className="panel-header">对话历史</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoadingSession && (
              <div className="welcome-screen">
                <div className="emoji">⏳</div>
                <h2>正在加载会话...</h2>
                <p>请稍候</p>
              </div>
            )}
            {!isLoadingSession && conversations.length === 0 && (
              <div className="welcome-screen">
                <div className="emoji">👤</div>
                <h2>在这里输入你的问题</h2>
                <p>发送后在右侧查看 Gemini 的输出</p>
              </div>
            )}
            {conversations.map((conv) => (
              <div key={conv.id} className="conversation-item">
                <div className="conversation-bubble">
                  <div className="conversation-content">{conv.userMessage}</div>
                  <div className="conversation-actions">
                    {conv.aiResponse && (
                      <button 
                        onClick={() => setSelectedConversationId(conv.id)}
                        className="show-result-btn"
                      >
                        展示结果
                      </button>
                    )}
                    {conv.isLoading && (
                      <span className="loading-text">生成中...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 右侧：Gemini 输出 */}
        <div className="right-panel">
          <div className="panel-header">Gemini 输出</div>
          <div className="right-panel-inner">
            {isLoadingSession && (
              <div className="right-placeholder">正在加载会话数据...</div>
            )}
            
            {!isLoadingSession && selectedConversation?.isLoading && (
              <div className="reveal-hint right-placeholder">
                正在生成中，请稍候...
              </div>
            )}

            {!isLoadingSession && selectedConversation?.aiResponse && (
              <div className="right-content">
                <MarkdownRenderer content={selectedConversation.aiResponse} />
              </div>
            )}

            {!isLoadingSession && !selectedConversation && conversations.length === 0 && (
              <div className="right-placeholder">尚无输出。发送一条消息以开始。</div>
            )}

            {!isLoadingSession && !selectedConversation && conversations.length > 0 && (
              <div className="right-placeholder">点击左侧"展示结果"查看回复</div>
            )}
          </div>
        </div>
      </div>

      {/* 底部输入 */}
      <ChatInput 
        onSendMessage={sendMessageStream}
        disabled={isLoading}
        placeholder={isLoading ? "AI 正在思考中..." : "输入消息..."}
      />
    </div>
  );
};

export default ChatInterface; 
import React, { useState } from 'react';
import './ChatPageTest.css';

const ChatPageTest: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    setIsLoading(true);
    setError('');
    setResponse('');
    
    try {
      console.log('🚀 发送测试请求:', inputValue);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue,
          sessionId: `test_session_${Date.now()}`,
          model: 'gemini-2.5-flash'
        })
      });

      console.log('📡 收到响应:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ 解析数据:', data);
      
      setResponse(data.response || '没有收到响应内容');
      
    } catch (error) {
      console.error('❌ 请求失败:', error);
      setError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-test-container">
      <h1>🧪 API测试页面</h1>
      
      <div className="test-section">
        <h2>输入测试消息</h2>
        <div className="input-area">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入你的问题..."
            rows={3}
            disabled={isLoading}
          />
          <button 
            onClick={handleSend} 
            disabled={!inputValue.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>

      <div className="test-section">
        <h2>API响应</h2>
        <div className="response-area">
          {isLoading && (
            <div className="loading">⏳ 正在调用API...</div>
          )}
          
          {error && (
            <div className="error">❌ 错误: {error}</div>
          )}
          
          {response && (
            <div className="success">
              <h3>✅ 成功响应:</h3>
              <pre>{response}</pre>
            </div>
          )}
        </div>
      </div>

      <div className="test-section">
        <h2>调试信息</h2>
        <div className="debug-info">
          <p><strong>API端点:</strong> /api/chat</p>
          <p><strong>请求方法:</strong> POST</p>
          <p><strong>模型:</strong> gemini-2.5-flash</p>
          <p><strong>状态:</strong> {isLoading ? '加载中' : error ? '错误' : response ? '成功' : '等待'}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatPageTest;

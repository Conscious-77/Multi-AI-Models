import React, { useState, useRef, useEffect } from 'react';
import './InputTestPage.css';

const InputTestPage: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('发送消息:', inputValue);
    }
  };

  // 简化：只处理光标定位，让CSS处理从下往上输入
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;

      console.log('InputTestPage: CSS从下往上输入', {
        inputValue: inputValue,
        scrollHeight: textarea.scrollHeight,
        clientHeight: textarea.clientHeight,
        offsetHeight: textarea.offsetHeight
      });

      // 只设置光标位置到底部
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    }
  }, [inputValue]);

  return (
    <div className="input-test-page">
      <div className="test-container">
        <div className="brand-section">
          <h1 className="brand-title">Co-Hundred</h1>
          <p className="brand-subtitle">NEXT GENERATION AI</p>
        </div>
        
        <div className="input-section">
          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                className="test-input"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Hi, 今天你想聊些什么..."
              />
              <button className="send-button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputTestPage;

import React, { useState, useEffect, useRef } from 'react';
import './HomePage.css';

const HomePage: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [showSendButton, setShowSendButton] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [editorLines, setEditorLines] = useState<string[]>(['']);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  
  const mainInputRef = useRef<HTMLInputElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  // 生成漂浮粒子
  useEffect(() => {
    const container = document.getElementById('particles');
    if (container && container.children.length === 0) {
      for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        container.appendChild(particle);
      }
    }
  }, []);

  // 自动聚焦
  useEffect(() => {
    mainInputRef.current?.focus();
  }, []);

  // ESC键关闭侧边栏
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowHistorySidebar(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // 处理输入变化
  const handleInputChange = (value: string, index: number) => {
    const newLines = [...editorLines];
    newLines[index] = value;
    setEditorLines(newLines);
    
    // 检查是否需要显示发送按钮
    const hasContent = newLines.some(line => line.trim() !== '');
    setShowSendButton(hasContent);
    
    // 保持当前行在视图中心
    centerActiveLine();
  };

  // 保持当前行在视图中心
  const centerActiveLine = () => {
    if (!editorWrapperRef.current) return;
    
    const wrapper = editorWrapperRef.current;
    const activeLine = wrapper.children[activeLineIndex] as HTMLElement;
    if (!activeLine) return;
    
    const lineRect = activeLine.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const lineCenter = lineRect.top + lineRect.height / 2;
    const wrapperCenter = wrapperRect.top + wrapperRect.height / 2;
    
    if (Math.abs(lineCenter - wrapperCenter) > 50) {
      wrapper.scrollTop += lineCenter - wrapperCenter;
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      addNewLine(index);
    } else if (e.key === 'Backspace' && editorLines[index] === '' && editorLines.length > 1) {
      e.preventDefault();
      removeLine(index);
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      focusLine(index - 1);
    } else if (e.key === 'ArrowDown' && index < editorLines.length - 1) {
      e.preventDefault();
      focusLine(index + 1);
    }
  };

  // 添加新行
  const addNewLine = (currentIndex: number) => {
    const newLines = [...editorLines];
    newLines.splice(currentIndex + 1, 0, '');
    setEditorLines(newLines);
    setActiveLineIndex(currentIndex + 1);
    
    setTimeout(() => {
      const inputs = editorWrapperRef.current?.querySelectorAll('.editor-input');
      if (inputs && inputs[currentIndex + 1]) {
        (inputs[currentIndex + 1] as HTMLInputElement).focus();
      }
    }, 0);
  };

  // 删除行
  const removeLine = (index: number) => {
    if (editorLines.length <= 1) return;
    
    const newLines = editorLines.filter((_, i) => i !== index);
    setEditorLines(newLines);
    
    const newIndex = Math.max(0, index - 1);
    setActiveLineIndex(newIndex);
    
    setTimeout(() => {
      const inputs = editorWrapperRef.current?.querySelectorAll('.editor-input');
      if (inputs && inputs[newIndex]) {
        (inputs[newIndex] as HTMLInputElement).focus();
      }
    }, 0);
  };

  // 聚焦指定行
  const focusLine = (index: number) => {
    setActiveLineIndex(index);
    const inputs = editorWrapperRef.current?.querySelectorAll('.editor-input');
    if (inputs && inputs[index]) {
      (inputs[index] as HTMLInputElement).focus();
    }
  };

  // 发送消息
  const sendMessage = () => {
    const message = editorLines.filter(line => line.trim()).join('\n');
    if (!message) return;

    console.log('发送消息:', message);
    
    // 清空输入
    setEditorLines(['']);
    setActiveLineIndex(0);
    setShowSendButton(false);
    
    // 添加动画反馈
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.style.transform = 'translateY(-50%) scale(0.8)';
      setTimeout(() => {
        sendBtn.style.transform = 'translateY(-50%)';
      }, 200);
    }

    // 这里可以处理发送逻辑，比如跳转到对话页面
    // navigate('/chat');
  };

  // 历史记录数据
  const historyItems = [
    {
      title: '测试新首页设计',
      preview: '探讨了全新的极简主义设计风格...',
      time: '2小时前'
    },
    {
      title: '机器学习算法优化',
      preview: '讨论了神经网络的训练技巧...',
      time: '昨天'
    },
    {
      title: '前端性能优化方案',
      preview: '分析了React应用的性能瓶颈...',
      time: '3天前'
    },
    {
      title: '数据可视化最佳实践',
      preview: '探讨了D3.js和ECharts的使用场景...',
      time: '一周前'
    }
  ];

  return (
    <div className="home-container">
      {/* 背景层 */}
      <div className="background-layer"></div>
      <div className="floating-particles" id="particles"></div>

      {/* 主容器 */}
      <div className="main-container">
        {/* 左侧品牌区域 */}
        <div className="brand-section">
          <div className="brand-content">
            <h1 className="brand-title">Multi-Gemini</h1>
            <p className="brand-subtitle">Next Generation AI</p>
            <div className="minimal-lines"></div>
          </div>
        </div>

        {/* 右侧编辑区域 */}
        <div className="editor-section">
          <div className="typora-editor">
            <div className="editor-wrapper" ref={editorWrapperRef}>
              {editorLines.map((line, index) => (
                <div 
                  key={index}
                  className={`editor-line ${activeLineIndex === index ? 'active' : ''}`}
                >
                  <input
                    type="text"
                    className="editor-input"
                    value={line}
                    onChange={(e) => handleInputChange(e.target.value, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onFocus={() => setActiveLineIndex(index)}
                    placeholder={index === 0 ? "Hi, 今天你想聊些什么..." : ""}
                    autoComplete="off"
                    ref={index === 0 ? mainInputRef : null}
                  />
                  {activeLineIndex === index && (
                    <span className="typewriter-cursor"></span>
                  )}
                </div>
              ))}
            </div>

            {/* 发送按钮 */}
            <button 
              className={`send-button ${showSendButton ? 'visible' : ''}`}
              id="sendBtn"
              onClick={sendMessage}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 历史记录按钮 */}
      <button 
        className="history-button"
        onClick={() => setShowHistorySidebar(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
      </button>

      {/* 历史记录侧边栏 */}
      <div className={`history-sidebar ${showHistorySidebar ? 'open' : ''}`}>
        <h3 className="history-header">历史对话</h3>
        
        {historyItems.map((item, index) => (
          <div 
            key={index}
            className="history-item"
            onClick={() => {
              console.log('打开历史对话:', item.title);
              // navigate('/chat');
            }}
          >
            <div className="history-item-title">{item.title}</div>
            <div className="history-item-preview">{item.preview}</div>
            <div className="history-item-time">{item.time}</div>
          </div>
        ))}
      </div>

      {/* 遮罩层 */}
      <div 
        className={`overlay ${showHistorySidebar ? 'active' : ''}`}
        onClick={() => setShowHistorySidebar(false)}
      ></div>

      {/* 快捷键提示 */}
      <div className="shortcut-hint">
        <span className="shortcut-key">Enter</span> 发送
        <span className="shortcut-key">Shift + Enter</span> 换行
        <span className="shortcut-key">↑ ↓</span> 切换行
      </div>
    </div>
  );
};

export default HomePage;

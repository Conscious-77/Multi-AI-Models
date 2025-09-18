import React, { useState, useEffect, useRef } from 'react';
import './HomePage2.css';
import FileUpload from './FileUpload';
import FilePreview from './FilePreview';

const HomePage2: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [showSendButton, setShowSendButton] = useState(true);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [editorLines, setEditorLines] = useState<string[]>(['']);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash'); // 默认选择Gemini 2.5 Flash
  const [showModelSelector, setShowModelSelector] = useState(false); // 模型选择器显示状态
  
  // 附件相关状态
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const textareasRef = useRef<(HTMLTextAreaElement | null)[]>([]);

  // 确保有 API Key（localStorage，首访提示一次）
  const ensureApiKey = async (): Promise<string> => {
    let apiKey = localStorage.getItem('site_api_key') || '';
    if (!apiKey) {
      try {
        const entered = window.prompt('请输入访问密钥（由站点管理员提供）');
        if (entered) {
          apiKey = entered.trim();
          if (apiKey) localStorage.setItem('site_api_key', apiKey);
        }
      } catch (_) {}
    }
    return apiKey;
  };

  // 统一带密钥请求；401 时清密钥→提示一次→自动重试一次
  const authorizedFetch = async (input: RequestInfo | URL, init: RequestInit = {}, retryOn401 = true): Promise<Response> => {
    const apiKey = localStorage.getItem('site_api_key') || '';
    const existing = (init.headers as Record<string, string>) || {};
    const headers: Record<string, string> = { ...existing };
    const lower = Object.fromEntries(Object.keys(headers).map(k => [k.toLowerCase(), k]));
    if (apiKey && !('x-api-key' in lower) && !('authorization' in lower)) headers['x-api-key'] = apiKey;

    const resp = await fetch(input, { ...init, headers });
    if (resp.status === 401 && retryOn401) {
      localStorage.removeItem('site_api_key');
      await ensureApiKey();
      return authorizedFetch(input, init, false);
    }
    return resp;
  };

  // 可用的AI模型列表 - 分层显示所有变体
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
    // 移除复杂的自动居中逻辑
  }, []);

  // 加载历史会话
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingHistory(true);
      try {
        await ensureApiKey();
        const response = await authorizedFetch('/api/sessions');
        if (response.ok) {
          const data = await response.json();
          setSessions(data);
          console.log('HomePage2加载到会话数据:', data);
        }
      } catch (error) {
        console.error('加载会话失败:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchSessions();
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
  const handleInputChange = (value: string) => {
    setInputValue(value);
    
    const hasContent = value.trim() !== '';
    setShowSendButton(true);
  };

  // 处理文件选择
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log('🔍 [DEBUG] HomePage2: handleFilesSelected 被调用', new Date().toISOString());
    console.log('🔍 [DEBUG] HomePage2: 接收到的文件数量:', files.length);
    console.log('🔍 [DEBUG] HomePage2: 文件详情:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    console.log('🔍 [DEBUG] HomePage2: 当前 selectedFiles 状态:', selectedFiles.length);
    
    // 检查文件数量限制
    if (files.length > 5) {
      showToast('最多只能上传5个文件');
      return;
    }
    
    // 检查localStorage中的现有文件
    const existingPendingFiles = localStorage.getItem('pendingFiles');
    if (existingPendingFiles) {
      console.log('🔍 [DEBUG] HomePage2: localStorage中已存在pendingFiles:', existingPendingFiles);
      try {
        const parsedExisting = JSON.parse(existingPendingFiles);
        console.log('🔍 [DEBUG] HomePage2: 解析后的现有pendingFiles数量:', parsedExisting.length);
      } catch (e) {
        console.log('🔍 [DEBUG] HomePage2: 解析现有pendingFiles失败:', e);
      }
    }
    
    setSelectedFiles(prev => {
      const newFiles = [...prev, ...files];
      console.log('🔍 [DEBUG] HomePage2: 更新后的文件列表长度:', newFiles.length);
      console.log('🔍 [DEBUG] HomePage2: 更新后的文件列表详情:', newFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
      console.log('🔍 [DEBUG] HomePage2: 文件预览区域应该显示，selectedFiles.length > 0:', newFiles.length > 0);
      
      // 检查是否有重复文件
      const fileNames = newFiles.map(f => f.name);
      const uniqueFileNames = Array.from(new Set(fileNames));
      if (fileNames.length !== uniqueFileNames.length) {
        console.log('⚠️ [WARNING] HomePage2: 发现重复文件!');
        console.log('⚠️ [WARNING] HomePage2: 所有文件名:', fileNames);
        console.log('⚠️ [WARNING] HomePage2: 唯一文件名:', uniqueFileNames);
      }
      
      return newFiles;
    });
    
    console.log('🔍 [DEBUG] HomePage2: 文件处理完成');
  };

  // 处理文件删除
  const handleFileRemove = (index: number) => {
    console.log('🔍 [DEBUG] HomePage2: 删除文件，索引:', index);
    console.log('🔍 [DEBUG] HomePage2: 删除前文件数量:', selectedFiles.length);
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      console.log('🔍 [DEBUG] HomePage2: 删除后文件数量:', newFiles.length);
      return newFiles;
    });
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter 使用浏览器默认行为，不进行任何处理
  };

  // 获取当前选中模型的显示名称
  const getSelectedModelDisplayName = () => {
    for (const group of availableModels) {
      if (group.type === 'group') {
        const variant = group.variants.find(v => v.id === selectedModel);
        if (variant) {
          return variant.name;
        }
      }
    }
    return 'Gemini 2.5 Flash'; // 默认显示名称
  };

  // 模型切换函数
  const handleModelChange = (modelId: string) => {
    console.log('🔍 handleModelChange 开始 - 参数:', modelId);
    console.log('🔍 切换前 selectedModel:', selectedModel);
    
    setSelectedModel(modelId);
    localStorage.setItem('selectedModel', modelId);
    setShowModelSelector(false);
    
    console.log('🔄 切换到模型:', modelId);
    console.log('🔍 切换后 selectedModel 状态:', modelId);
    console.log('🔍 localStorage 已更新:', localStorage.getItem('selectedModel'));
  };

  // 全选所有文本
  const selectAllText = () => {
    const textarea = mainInputRef.current;
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  };

  // 复制所有文本
  const copyAllText = () => {
    if (!inputValue.trim()) return;
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inputValue).then(() => {
        showToast('所有文本已复制到剪贴板');
      }).catch(() => {
        fallbackCopyTextToClipboard(inputValue);
      });
    } else {
      fallbackCopyTextToClipboard(inputValue);
    }
  };

  // 显示提示信息
  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      zIndex: '10000',
      fontSize: '14px',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    });
    
    document.body.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  };

  // 传统复制方法（兼容性）
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      showToast('所有文本已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
      showToast('复制失败，请手动选择文本');
    }
    
    document.body.removeChild(textArea);
  };

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 创建自定义右键菜单
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="select-all">全选</div>
      <div class="context-menu-item" data-action="copy-all">复制所有文本</div>
      <div class="context-menu-item" data-action="paste">粘贴</div>
    `;
    
    // 设置样式
    Object.assign(contextMenu.style, {
      position: 'fixed',
      top: `${e.clientY}px`,
      left: `${e.clientX}px`,
      background: 'rgba(0, 0, 0, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 0',
      zIndex: '1000',
      minWidth: '140px',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    });
    
    // 添加菜单项样式
    const style = document.createElement('style');
    style.textContent = `
      .context-menu-item {
        padding: 8px 16px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }
      .context-menu-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    `;
    document.head.appendChild(style);
    
    // 处理菜单项点击
    contextMenu.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      
      switch (action) {
        case 'select-all':
          selectAllText();
          break;
        case 'copy-all':
          copyAllText();
          break;
        case 'paste':
          // 粘贴功能
          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.readText().then(text => {
              setInputValue(text);
            });
          }
          break;
      }
      
      // 移除菜单
      document.body.removeChild(contextMenu);
      document.head.removeChild(style);
    });
    
    // 点击其他地方关闭菜单
    const closeMenu = () => {
      if (document.body.contains(contextMenu)) {
        document.body.removeChild(contextMenu);
        document.head.removeChild(style);
      }
      document.removeEventListener('click', closeMenu);
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
    
    document.body.appendChild(contextMenu);
  };

  // 移除 autoResize 函数，因为现在使用固定高度

  // 首次与内容变化后统一调整高度 - 现在不需要了
  // useEffect(() => {
  //   const id = requestAnimationFrame(() => autoResize());
  //   return () => cancelAnimationFrame(id);
  // }, [editorLines, activeLineIndex]);

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

  // 发送消息：创建会话并跳转到 /chat2
  const sendMessage = async () => {
    const message = inputValue.trim();
    console.log('🔍 [DEBUG] HomePage2: sendMessage 开始');
    console.log('🔍 [DEBUG] HomePage2: 当前 selectedFiles 长度:', selectedFiles.length);
    console.log('🔍 [DEBUG] HomePage2: selectedFiles 详情:', selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
    console.log('🔍 [DEBUG] HomePage2: message:', message);
    
    if (!message && selectedFiles.length === 0) {
      console.log('🔍 [DEBUG] HomePage2: 没有消息和文件，退出');
      return; // 允许纯文件发送
    }
    if (isSubmitting) {
      console.log('🔍 [DEBUG] HomePage2: 正在提交，退出');
      return;
    }
    setIsSubmitting(true);
    
    try {
      await ensureApiKey();
      // 准备文件数据 - 将文件转换为base64
      console.log('🔍 [DEBUG] HomePage2: 开始处理文件，数量:', selectedFiles.length);
      const fileData = await Promise.all(selectedFiles.map(async (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              data: reader.result // base64数据
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }));
      
      console.log('🔍 [DEBUG] HomePage2: 文件处理完成，fileData 长度:', fileData.length);
      console.log('🔍 [DEBUG] HomePage2: fileData 详情:', fileData.map((f: any) => ({ name: f.name, size: f.size, type: f.type })));
      
      // 将文件数据存储到localStorage，供ChatPage2使用
      if (fileData.length > 0) {
        console.log('🔍 [DEBUG] HomePage2: 准备存储文件到localStorage');
        localStorage.setItem('pendingFiles', JSON.stringify(fileData));
      } else {
        localStorage.removeItem('pendingFiles');
        console.log('🔍 [DEBUG] HomePage2: 没有文件，清除localStorage中的pendingFiles');
      }
      
      // 创建新会话
      const res = await authorizedFetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `创建会话失败: ${res.status}`);
      }
      
      const data = await res.json();
      const sessionId = data.sessionId;
      if (!sessionId) throw new Error('未返回会话ID');
      
      // 跳转到聊天页面，传递消息、会话ID和选择的模型
      console.log('🔍 准备跳转到ChatPage2 - 传递的模型:', selectedModel);
      window.location.href = `/chat2?message=${encodeURIComponent(message)}&sessionId=${encodeURIComponent(sessionId)}&model=${encodeURIComponent(selectedModel)}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理历史记录点击
  const handleHistoryClick = (sessionId: string) => {
    window.location.href = `/chat2?sessionId=${sessionId}`;
  };

  // 分类历史记录
  const categorizeHistory = (items: any[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const categories = { today: [] as any[], yesterday: [] as any[], lastWeek: [] as any[], older: [] as any[] };

    items.forEach(item => {
      const itemDate = new Date(item.created_at);
      if (itemDate >= today) categories.today.push(item);
      else if (itemDate >= yesterday) categories.yesterday.push(item);
      else if (itemDate >= weekAgo) categories.lastWeek.push(item);
      else categories.older.push(item);
    });

    return categories;
  };

  const categorizedHistory = categorizeHistory(sessions);

  const getCategoryLabel = (category: string) => ({ 
    today: '今天', 
    yesterday: '昨天', 
    lastWeek: '最近7天', 
    older: '更久' 
  }[category] || '');

  return (
    <div className="home2">
      <div className="home-container">
        {/* 背景层 */}
        <div className="background-layer"></div>
        
        {/* 光球效果 */}
        <div className="light-orbs">
          <div className="light-orb"></div>
          <div className="light-orb"></div>
          <div className="light-orb"></div>
          <div className="light-orb"></div>
        </div>
        
        <div className="floating-particles" id="particles"></div>

        {/* 主容器 */}
        <div className="main-container">
          {/* 左侧品牌区域 */}
          <div className="brand-section">
            <div className="brand-content">
              <h1 className="brand-title">Co-Hundred</h1>
              <p className="brand-subtitle">Next Generation AI</p>
              <div className="minimal-lines"></div>
              

              
              {/* 模型选择器 */}
              <div className="model-selector">
                <div className="model-selector-dropdown">
                  <div 
                    className="model-selector-current"
                    onClick={() => setShowModelSelector(!showModelSelector)}
                  >
                    <span>{getSelectedModelDisplayName()}</span>
                    <svg className="model-selector-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </div>
                  
                  {/* 下拉菜单 */}
                  {showModelSelector && (
                    <div className="model-selector-menu">
                      {availableModels.map((group) => (
                        <div key={group.id} className="model-group">
                          {/* 模型系列标题 */}
                          <div className="model-group-header">
                            <span className="model-group-name">{group.name}</span>
                          </div>
                          
                          {/* 模型变体列表 */}
                          {group.variants.map((variant) => (
                            <div
                              key={variant.id}
                              className={`model-variant-item ${variant.id === selectedModel ? 'active' : ''}`}
                              onClick={() => handleModelChange(variant.id)}
                            >
                              <div className="variant-name">{variant.name}</div>

                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右侧编辑区域 - 新输入框模式 */}
          <div className="input-section">
            <div className="input-container">
              <div className="input-wrapper">
                <textarea
                  className="editor-input"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onContextMenu={handleContextMenu}
                  placeholder="Hi, 今天你想聊些什么..."
                  ref={mainInputRef}
                  rows={8} /* 设置初始行数 */
                  style={{ resize: 'none' }} /* 禁用手动调整大小 */
                />
                
                {/* 文件上传按钮 */}
                <div className="file-upload-container">
                  <button 
                    className="file-upload-button"
                    onClick={() => {
                      console.log('🔍 [DEBUG] HomePage2: 文件上传按钮被点击，直接调起文件选择器');
                      fileInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    aria-label="添加文件"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10,9 9,9 8,9"></polyline>
                    </svg>
                  </button>
                  
                  {/* Hover提示框 */}
                  <div className="file-upload-tooltip">
                    <div className="tooltip-content">
                      <div className="tooltip-header">
                        <div className="tooltip-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                          </svg>
                        </div>
                        <span className="tooltip-title">文件上传</span>
                      </div>
                      <div className="tooltip-body">
                        <p className="tooltip-description">拖拽文件到此处或点击选择文件</p>
                        <div className="tooltip-details">
                          <div className="tooltip-item">
                            <span className="tooltip-label">支持格式：</span>
                            <span className="tooltip-value">图片、PDF、文档等</span>
                          </div>
                          <div className="tooltip-item">
                            <span className="tooltip-label">文件大小：</span>
                            <span className="tooltip-value">单个文件最大 50MB</span>
                          </div>
                          <div className="tooltip-item">
                            <span className="tooltip-label">文件数量：</span>
                            <span className="tooltip-value">最多 5 个文件</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 发送按钮 */}
                <button 
                  className={`send-button visible`}
                  id="sendBtn"
                  onClick={sendMessage}
                  disabled={isSubmitting || (!inputValue.trim() && selectedFiles.length === 0)}
                  aria-label="发送"
                  title="发送 (Enter)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
              
              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFilesSelected}
                disabled={isUploading}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
                title="最多可上传5个文件"
              />
            </div>
          </div>
        </div>

        {/* 文件展示区域 - 平级模块，独立于输入区域 */}
        {selectedFiles.length > 0 && (
          <div className="file-display-section">
            <div className="file-display-container">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="file-display-item">
                  <div className="file-display-info">
                    <div className="file-display-icon">
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
                            fileName.endsWith('.rs') || fileName.endsWith('.swift')  || fileName.endsWith('.html')) {
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
                    <div className="file-display-details">
                      <div className="file-display-name-size">
                        <span className="file-display-name">{file.name}</span>
                        <span className="file-display-separator"> | </span>
                        <span className="file-display-size">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="file-display-remove"
                    onClick={() => handleFileRemove(index)}
                    aria-label="删除文件"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Agent 测试页面按钮 */}
        <button 
          className="agent-button"
          onClick={() => window.location.href = '/agent'}
          title="AI Agent 测试"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9.59 4.57A1.75 1.75 0 1 1 11.58 6.4L8.6 9.4a1.75 1.75 0 0 1-2.83-2.83l2.83-2.83Z"></path>
            <path d="M14.41 4.57A1.75 1.75 0 0 0 12.42 6.4l2.83 2.83a1.75 1.75 0 0 0 2.83-2.83l-2.83-2.83Z"></path>
            <path d="M9.59 19.43A1.75 1.75 0 0 0 11.58 17.6L8.6 14.6a1.75 1.75 0 0 0-2.83 2.83l2.83 2.83Z"></path>
            <path d="M14.41 19.43A1.75 1.75 0 0 1 12.42 17.6l2.83-2.83a1.75 1.75 0 0 1 2.83 2.83l-2.83 2.83Z"></path>
            <path d="M12 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
          </svg>
        </button>

        {/* 历史记录侧边栏 */}
        <div className={`history-sidebar ${showHistorySidebar ? 'open' : ''}`}>
          <h3 className="history-header">历史对话 ({sessions.length} 个会话)</h3>
          {isLoadingHistory ? (
            <div className="history-loading">加载中...</div>
          ) : (
            Object.entries(categorizedHistory).map(([category, items]) => (
              items.length === 0 ? null : (
                <div key={category} className="history-category">
                  <div className="category-header">
                    <span className="category-label">{getCategoryLabel(category)}</span>
                  </div>
                  <div className="history-items">
                    {(items as any[]).map((item: any) => (
                      <div 
                        key={item.id}
                        className="history-item"
                        onClick={() => handleHistoryClick(item.id)}
                      >
                        <div className="history-item-title">{item.title || '无标题对话'}</div>
                        <div className="history-item-preview">{item.title ? item.title.substring(0, 50) + '...' : '新对话'}</div>
                        <div className="history-item-time">
                          {new Date(item.created_at).toLocaleDateString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
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
    </div>
  );
};

export default HomePage2;



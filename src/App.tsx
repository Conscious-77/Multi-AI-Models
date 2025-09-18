import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import ChatPage2 from './components/ChatPage2';
import ChatPageTest from './components/ChatPageTest';
import AgentPage from './components/AgentPage';
import AgentPageNew from './components/AgentPageNew';
import FileUploadTest from './components/FileUploadTest';
import InputTestPage from './components/InputTestPage';
import { Send, MessageSquare, Clock, Calendar, CalendarDays, Archive } from 'lucide-react';
import './App.css';
import HomePage2 from './components/HomePage2';

// 新的HomePage组件
const HomePage = () => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const historyRef = useRef<HTMLDivElement>(null);

  // 确保有 API Key（存于 sessionStorage，首访提示一次）
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

  // 加载历史会话
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        await ensureApiKey();
        const response = await authorizedFetch('/api/sessions');
        if (response.ok) {
          const data = await response.json();
          setSessions(data);
          console.log('加载到会话数据:', data);
        }
      } catch (error) {
        console.error('加载会话失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []);

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

  useEffect(() => {
    const timer = setTimeout(() => setIsTyping(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-id');
          if (id) setTimeout(() => setVisibleCards(prev => new Set(prev).add(id)), 100);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    const cards = document.querySelectorAll('.history-card');
    cards.forEach(card => observer.observe(card));
    return () => cards.forEach(card => observer.unobserve(card));
  }, [categorizedHistory]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const message = inputValue.trim();
    try {
      await ensureApiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const response = await authorizedFetch('/api/sessions', { method: 'POST', headers, body: JSON.stringify({ message }) });
      if (!response.ok) throw new Error((await response.json()).error || '创建会话失败');
      const data = await response.json();
      window.location.href = `/chat2?message=${encodeURIComponent(message)}&sessionId=${data.sessionId}`;
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleHistoryClick = (sessionId: string) => {
    window.location.href = `/chat2?sessionId=${sessionId}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'today': return <Clock className="category-icon" />;
      case 'yesterday': return <Calendar className="category-icon" />;
      case 'lastWeek': return <CalendarDays className="category-icon" />;
      case 'older': return <Archive className="category-icon" />;
      default: return null;
    }
  };

  const getCategoryLabel = (category: string) => ({ today: '今天', yesterday: '昨天', lastWeek: '最近7天', older: '更久' }[category] || '');

  return (
    <div className="home-container">
      <div className="background-gradient"></div>
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      <div className="content-wrapper">
        <header className="header">
          <h1 className={`main-title ${isTyping ? 'typing' : ''}`}>Multi-Gemini</h1>
          <div className="title-shimmer"></div>
        </header>
        <div className="input-section">
          <div className="input-container glass-effect">
            <textarea
              className="message-input"
              placeholder="Hi, 今天你想聊些什么？"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
              rows={2}
            />
            <button className={`send-button ${!inputValue.trim() ? 'disabled' : ''}`} onClick={handleSend} disabled={!inputValue.trim()}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
      <div className="scroll-hint" onClick={() => document.querySelector('.history-section')?.scrollIntoView({ behavior: 'smooth' })}>
        <div className="scroll-hint-text">查看历史</div>
        <div className="scroll-arrow"></div>
      </div>
      <div className="history-section">
        <div className="section-header">
          <h2 className="section-title">History ({sessions.length} 个会话)</h2>
          <div className="section-line"></div>
        </div>
        <div className="history-content">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>加载中...</div>
          ) : (
            Object.entries(categorizedHistory).map(([category, items]) => (
              items.length === 0 ? null : (
                <div key={category} className="history-category">
                  <div className="category-header">{getCategoryIcon(category)}<span className="category-label">{getCategoryLabel(category)}</span></div>
                  <div className="history-grid">
                    {(items as any[]).map((item: any, index: number) => (
                      <div key={item.id} data-id={item.id} className={`history-card glass-effect ${visibleCards.has(item.id) ? 'visible' : ''}`} style={{ animationDelay: `${index * 0.1}s` }} onClick={() => handleHistoryClick(item.id)}>
                        <div className="card-icon"><MessageSquare size={18} /></div>
                        <div className="card-content">
                          <h3 className="card-title">{item.title}</h3>
                          <p className="card-message">{item.title.split(' | ')[0]}</p>
                        </div>
                        <div className="card-hover-effect"></div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  const path = window.location.pathname;
  if (path === '/test-upload') return <div className="App"><FileUploadTest /></div>;
  if (path === '/input-test') return <div className="App"><InputTestPage /></div>;
  if (path === '/chat2') return <div className="App"><ChatPage2 /></div>;
  if (path === '/chat-test') return <div className="App"><ChatPageTest /></div>;
  if (path === '/home2') return <div className="App"><HomePage2 /></div>;
  if (path === '/agent') return <div className="App"><AgentPage /></div>;
  if (path === '/agent-new') return <div className="App"><AgentPageNew /></div>;
  if (path.startsWith('/chat/')) return <div className="App"><ChatInterface /></div>;
  if (path === '/') return <div className="App"><HomePage2 /></div>;
  if (path === '/old-home') return <div className="App"><HomePage /></div>;
  return <div className="App"><HomePage2 /></div>;
}

export default App;

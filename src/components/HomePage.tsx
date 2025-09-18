import React, { useState, useEffect, useRef } from 'react';
import './HomePage.css';
import { Send } from 'lucide-react';

interface HistoryItem {
  id: string;
  title: string;
  firstMessage: string;
  timestamp: Date;
}

const HomePage: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const historyRef = useRef<HTMLDivElement>(null);

  // 模拟历史数据
  const historyData: HistoryItem[] = [
    {
      id: '1',
      title: 'AI的未来发展',
      firstMessage: '人工智能在未来十年会如何改变我们的生活？',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2小时前
    },
    {
      id: '2',
      title: '量子计算原理',
      firstMessage: '能否解释一下量子纠缠的基本概念？',
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 昨天
    },
    {
      id: '3',
      title: '深度学习框架比较',
      firstMessage: 'PyTorch和TensorFlow各有什么优势？',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3天前
    },
    {
      id: '4',
      title: '区块链技术应用',
      firstMessage: '区块链除了加密货币还有哪些实际应用？',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5天前
    },
    {
      id: '5',
      title: '神经网络架构',
      firstMessage: 'Transformer架构是如何工作的？',
      timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10天前
    },
  ];

  // 分类历史记录
  const categorizeHistory = (items: HistoryItem[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const categories = {
      today: [] as HistoryItem[],
      yesterday: [] as HistoryItem[],
      lastWeek: [] as HistoryItem[],
      older: [] as HistoryItem[],
    };

    items.forEach(item => {
      const itemDate = new Date(item.timestamp);
      if (itemDate >= today) {
        categories.today.push(item);
      } else if (itemDate >= yesterday) {
        categories.yesterday.push(item);
      } else if (itemDate >= weekAgo) {
        categories.lastWeek.push(item);
      } else {
        categories.older.push(item);
      }
    });

    return categories;
  };

  const categorizedHistory = categorizeHistory(historyData);

  // 打字机效果
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // 滚动动画观察器
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-id');
            if (id) {
              setTimeout(() => {
                setVisibleCards(prev => new Set(prev).add(id));
              }, 100);
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    const cards = document.querySelectorAll('.history-card');
    cards.forEach(card => observer.observe(card));

    return () => {
      cards.forEach(card => observer.unobserve(card));
    };
  }, [categorizedHistory]);

  const handleSend = () => {
    if (inputValue.trim()) {
      console.log('发送消息:', inputValue);
      // 跳转到新的聊天页面2.0
      window.location.href = '/chat2';
    }
  };

  const handleHistoryClick = (id: string) => {
    console.log('跳转到会话:', id);
    // 跳转到新的聊天页面2.0，并传递会话ID
    window.location.href = `/chat2?session=${id}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'today': return <span className="category-icon">🕐</span>;
      case 'yesterday': return <span className="category-icon">📅</span>;
      case 'lastWeek': return <span className="category-icon">📆</span>;
      case 'older': return <span className="category-icon">📁</span>;
      default: return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'today': return '今天';
      case 'yesterday': return '昨天';
      case 'lastWeek': return '最近7天';
      case 'older': return '更久';
      default: return '';
    }
  };

  return (
    <div className="home-container">
      {/* 背景效果 */}
      <div className="background-gradient"></div>
      <div className="floating-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* 主要内容 */}
      <div className="content-wrapper">
        {/* 顶部标题 */}
        <header className="header">
          <h1 className={`main-title ${isTyping ? 'typing' : ''}`}>
            Multi-Gemini
          </h1>
          <div className="title-shimmer"></div>
        </header>

        {/* 输入区域 */}
        <div className="input-section">
          <div className="input-container glass-effect">
            <textarea
              className="message-input"
              placeholder="Hi, 今天你想聊些什么？"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
            />
            <button
              className={`send-button ${!inputValue.trim() ? 'disabled' : ''}`}
              onClick={handleSend}
              disabled={!inputValue.trim()}
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {/* 历史记录 */}
        <div className="history-section" ref={historyRef}>
          <div className="section-header">
            <h2 className="section-title">History</h2>
            <div className="section-line"></div>
          </div>

          <div className="history-content">
            {Object.entries(categorizedHistory).map(([category, items]) => {
              if (items.length === 0) return null;
              
              return (
                <div key={category} className="history-category">
                  <div className="category-header">
                    {getCategoryIcon(category)}
                    <span className="category-label">{getCategoryLabel(category)}</span>
                  </div>
                  
                  <div className="history-grid">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        data-id={item.id}
                        className={`history-card glass-effect ${
                          visibleCards.has(item.id) ? 'visible' : ''
                        }`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                        onClick={() => handleHistoryClick(item.id)}
                      >
                        <div className="card-icon">
                          💬
                        </div>
                        <div className="card-content">
                          <h3 className="card-title">{item.title}</h3>
                          <p className="card-message">{item.firstMessage}</p>
                        </div>
                        <div className="card-hover-effect"></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

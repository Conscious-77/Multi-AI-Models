import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser, timestamp }) => {
  return (
    <div className={`message ${isUser ? 'user' : 'ai'}`}>
      <div className="message-content">
        <MarkdownRenderer content={message} />
      </div>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      {timestamp && (
        <div className="message-timestamp">
          {timestamp}
        </div>
      )}
    </div>
  );
};

export default ChatMessage; 
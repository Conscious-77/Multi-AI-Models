import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism.css';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
console.log('📝 MarkdownRenderer渲染:', {
    contentLength: content.length,
    content: content.substring(0, 100) + '...',
    className
  });

  useEffect(() => {
    // 等待DOM更新完成后手动高亮代码块
    const timer = setTimeout(() => {
      Prism.highlightAll();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [content]);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 自定义表格样式
          table: ({ children, ...props }) => (
            <div style={{ overflowX: 'auto' }}>
              <table 
                {...props} 
                style={{ 
                  borderCollapse: 'collapse', 
                  width: '100%',
                  margin: '16px 0',
                  border: '1px solid #e1e4e8'
                }}
              >
                {children}
              </table>
            </div>
          ),
          // 自定义表格头部样式
          thead: ({ children, ...props }) => (
            <thead {...props} style={{ backgroundColor: '#f6f8fa' }}>
              {children}
            </thead>
          ),
          // 自定义表格行样式
          tr: ({ children, ...props }) => (
            <tr {...props} style={{ borderBottom: '1px solid #e1e4e8' }}>
              {children}
            </tr>
          ),
          // 自定义表格单元格样式
          th: ({ children, ...props }) => (
            <th 
              {...props} 
              style={{ 
                padding: '12px 8px', 
                textAlign: 'left',
                fontWeight: '600',
                border: '1px solid #e1e4e8'
              }}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td 
              {...props} 
              style={{ 
                padding: '12px 8px', 
                border: '1px solid #e1e4e8'
              }}
            >
              {children}
            </td>
          ),
          // 自定义代码块样式
          code: ({ node, className, children, ...props }: any) => {
            // 统一小写并做常见别名映射，避免大小写/别名导致不高亮
            const raw = (className || '').toLowerCase();
            const match = /language-([a-z0-9#+-]+)/.exec(raw || '');
            const isInline = !raw || !raw.includes('language-');
            const aliasMap: Record<string, string> = {
              js: 'javascript',
              jsx: 'jsx',
              ts: 'typescript',
              tsx: 'tsx',
              shell: 'bash',
              sh: 'bash',
              csharp: 'csharp',
              'c#': 'csharp',
              cs: 'csharp',
              'c++': 'cpp',
              cc: 'cpp',
              hpp: 'cpp',
              kt: 'kotlin',
              yml: 'yaml'
            };
            const langRaw = match ? match[1] : '';
            const lang = aliasMap[langRaw] || langRaw;
            const normalizedClass = lang ? `language-${lang}` : (raw || undefined);
            return !isInline && match ? (
              <pre style={{ 
                backgroundColor: '#f8f9fa',
                padding: '16px', 
                borderRadius: '6px',
                overflow: 'auto',
                margin: '16px 0',
                border: '1px solid #e9ecef'
              }}>
                <code className={normalizedClass} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code 
                className={normalizedClass} 
                {...props}
                style={{ 
                  backgroundColor: '#f6f8fa', 
                  padding: '2px 4px', 
                  borderRadius: '3px',
                  fontSize: '0.9em'
                }}
              >
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 
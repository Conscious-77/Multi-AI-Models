// 文件预览组件
import React, { useState, useEffect } from 'react';
import { X, Download, Eye, FileText, Image, Video, Music, File } from 'lucide-react';

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string;
    thumbnailUrl?: string;
  };
  onRemove?: (id: string) => void;
  onDownload?: (id: string) => void;
  showActions?: boolean;
  className?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  onDownload,
  showActions = true,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件图标
  const getFileIcon = () => {
    console.log('FilePreview: 渲染文件图标，类型:', file.type, '名称:', file.name);
    if (file.type.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (file.type.startsWith('video/')) return <Video className="w-8 h-8 text-purple-500" />;
    if (file.type.startsWith('audio/')) return <Music className="w-8 h-8 text-green-500" />;
    if (file.type === 'application/pdf') return <FileText className="w-8 h-8 text-red-500" />;
    if (file.type === 'text/html') return <FileText className="w-8 h-8 text-orange-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  // 处理图片加载错误
  const handleImageError = () => {
    setImageError(true);
  };

  // 处理预览点击
  const handlePreviewClick = () => {
    if (file.type.startsWith('image/')) {
      setShowFullPreview(true);
    } else if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  // 处理下载
  const handleDownload = () => {
    if (onDownload) {
      onDownload(file.id);
    } else if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 处理删除
  const handleRemove = () => {
    if (onRemove) {
      onRemove(file.id);
    }
  };

  return (
    <>
      <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${className}`}>
        <div className="flex items-start space-x-3">
          {/* 文件图标或预览 */}
          <div className="flex-shrink-0">
            {(() => {
              console.log('FilePreview: 判断显示类型', {
                type: file.type,
                isImage: file.type.startsWith('image/'),
                hasUrl: !!file.url,
                imageError: imageError,
                name: file.name
              });
              return file.type.startsWith('image/') && file.url && !imageError;
            })() ? (
              <div className="relative">
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded border"
                  onError={handleImageError}
                />
                <button
                  onClick={handlePreviewClick}
                  className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 rounded transition-all duration-200 flex items-center justify-center"
                  title="预览图片"
                >
                  <Eye className="w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity" />
                </button>
              </div>
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-gray-50 rounded border">
                {getFileIcon()}
              </div>
            )}
          </div>

          {/* 文件信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                {file.name}
              </h4>
              {showActions && (
                <div className="flex items-center space-x-1 ml-2">
                  {/* 预览按钮 */}
                  {(file.type.startsWith('image/') || file.url) && (
                    <button
                      onClick={handlePreviewClick}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                      title="预览"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  
                  {/* 下载按钮 */}
                  <button
                    onClick={handleDownload}
                    className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  
                  {/* 删除按钮 */}
                  {onRemove && (
                    <button
                      onClick={handleRemove}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-1 text-xs text-gray-500">
              <span>{formatFileSize(file.size)}</span>
              <span className="mx-1">•</span>
              <span>{file.type}</span>
            </div>
            
            {/* 文件状态 */}
            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                已上传
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 全屏图片预览模态框 */}
      {showFullPreview && file.type.startsWith('image/') && file.url && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={() => setShowFullPreview(false)}
              className="absolute top-2 right-2 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={file.url}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default FilePreview;

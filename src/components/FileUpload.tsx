// 拖拽上传组件
import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, Video, Music, File } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = ['image/*', 'application/pdf', 'text/*'],
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const componentId = useRef(Math.random().toString(36).substr(2, 9));
  const inputId = useRef(`file-input-${componentId.current}`);
  
  console.log('🔍 [DEBUG] FileUpload: 组件渲染，ID:', componentId.current);

  // 处理拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [disabled]);

  // 验证和处理文件
  const handleFiles = useCallback((files: File[]) => {
    console.log('🔍 [DEBUG] FileUpload: handleFiles 被调用，文件数量:', files.length);
    console.log('🔍 [DEBUG] FileUpload: 输入文件详情:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file, index) => {
      console.log(`🔍 [DEBUG] FileUpload: 处理文件 ${index + 1}/${files.length}:`, file.name);
      
      // 检查文件数量限制
      if (validFiles.length >= maxFiles) {
        const error = `最多只能上传 ${maxFiles} 个文件`;
        console.log('🔍 [DEBUG] FileUpload: 文件数量超限:', error);
        errors.push(error);
        return;
      }

      // 检查文件大小
      if (file.size > maxFileSize) {
        const error = `${file.name} 文件过大，最大支持 ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`;
        console.log('🔍 [DEBUG] FileUpload: 文件大小超限:', error);
        errors.push(error);
        return;
      }

      // 检查文件类型
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });

      if (!isValidType) {
        const error = `${file.name} 文件类型不支持`;
        console.log('🔍 [DEBUG] FileUpload: 文件类型不支持:', error);
        errors.push(error);
        return;
      }

      console.log('🔍 [DEBUG] FileUpload: 文件验证通过:', file.name);
      validFiles.push(file);
    });

    console.log('🔍 [DEBUG] FileUpload: 验证结果 - 有效文件:', validFiles.length, '错误:', errors.length);

    // 显示错误信息
    if (errors.length > 0) {
      console.log('🔍 [DEBUG] FileUpload: 显示错误信息');
      errors.forEach(error => console.warn('❌ FileUpload 错误:', error));
      // 这里可以集成toast通知
    }

    if (validFiles.length > 0) {
      console.log('🔍 [DEBUG] FileUpload: 准备调用 onFilesSelected，有效文件数量:', validFiles.length);
      console.log('🔍 [DEBUG] FileUpload: 有效文件详情:', validFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
      onFilesSelected(validFiles);
      console.log('🔍 [DEBUG] FileUpload: onFilesSelected 调用完成');
    } else {
      console.log('🔍 [DEBUG] FileUpload: 没有有效文件，不调用 onFilesSelected');
    }
  }, [maxFiles, maxFileSize, acceptedTypes, onFilesSelected]);

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔍 [DEBUG] FileUpload: handleFileSelect 被调用', new Date().toISOString(), '组件ID:', componentId.current);
    console.log('🔍 [DEBUG] FileUpload: 文件列表长度:', e.target.files?.length);
    
    const files = Array.from(e.target.files || []);
    console.log('🔍 [DEBUG] FileUpload: 选择的文件数量:', files.length);
    
    if (files.length > 0) {
      console.log('🔍 [DEBUG] FileUpload: 处理文件:', files.map(f => f.name), '组件ID:', componentId.current);
      handleFiles(files);
    }
    
    // 重置文件输入框
    if (e.target) {
      e.target.value = '';
    }
  }, [handleFiles]);

  // 获取文件图标
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-6 h-6 text-blue-500" />;
    if (file.type.startsWith('video/')) return <Video className="w-6 h-6 text-purple-500" />;
    if (file.type.startsWith('audio/')) return <Music className="w-6 h-6 text-green-500" />;
    if (file.type === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
    return <File className="w-6 h-6 text-gray-500" />;
  };

  return (
    <div className="w-full">
      {/* 拖拽区域（用 label 触发原生文件选择） */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={`最多可上传 ${maxFiles} 个文件`}
      >
        <label htmlFor={inputId.current} style={{ display: 'block', width: '100%', height: '100%' }}>
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4 group-hover:text-gray-500 transition-colors" />
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900 group-hover:text-gray-800 transition-colors">
              拖拽文件到此处或点击选择文件
            </p>
            <p className="text-sm text-gray-500 group-hover:text-gray-600 transition-colors">
              支持图片、PDF、文档等格式，单个文件最大 {maxFileSize / 1024 / 1024}MB
            </p>
            {/* 移除静态的文件数量提示，改为hover tooltip */}
          </div>
        </label>

        {/* 可访问但视觉隐藏的文件输入 */}
        <input
          id={inputId.current}
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={disabled}
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
        />
      </div>

      {/* 上传进度显示 */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mt-4 space-y-2">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-gray-600 min-w-[60px]">
                {progress}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;

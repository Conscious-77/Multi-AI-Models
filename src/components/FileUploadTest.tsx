// FileUpload组件测试页面
import React, { useState } from 'react';
import FileUpload from './FileUpload';
import FilePreview from './FilePreview';

const FileUploadTest: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<string[]>([]);

  // 处理文件选择
  const handleFilesSelected = (files: File[]) => {
    console.log('=== FileUploadTest: handleFilesSelected 被调用 ===', new Date().toISOString());
    console.log('选择的文件数量:', files.length);
    console.log('文件详情:', files.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified
    })));
    console.log('当前已选择的文件数量:', selectedFiles.length);
    console.log('==================');
    
    setSelectedFiles(prev => {
      const newFiles = [...prev, ...files];
      console.log('更新后的文件列表长度:', newFiles.length);
      return newFiles;
    });
    setUploadResults(prev => [...prev, `选择了 ${files.length} 个文件`]);
  };

  // 清除所有文件
  const clearFiles = () => {
    setSelectedFiles([]);
    setUploadResults([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">
        FileUpload 组件测试
      </h1>
      
      {/* 测试区域 */}
      <div className="space-y-6">
        {/* FileUpload组件 */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">
            文件上传组件
          </h2>
          <FileUpload
            onFilesSelected={handleFilesSelected}
            maxFiles={5}
            maxFileSize={10 * 1024 * 1024} // 10MB
            acceptedTypes={['image/*', 'application/pdf', 'text/*']}
          />
        </div>

        {/* 选中的文件列表 */}
        {selectedFiles.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                已选择的文件 ({selectedFiles.length})
              </h2>
              <button
                onClick={clearFiles}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                清除所有
              </button>
            </div>
            
            <div className="space-y-3">
              {selectedFiles.map((file, index) => (
                <FilePreview
                  key={index}
                  file={{
                    id: `file-${index}`,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
                  }}
                  onRemove={() => {
                    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                  }}
                  onDownload={() => {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(file);
                    link.download = file.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 操作日志 */}
        {uploadResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              操作日志
            </h2>
            <div className="space-y-1">
              {uploadResults.map((result, index) => (
                <div
                  key={index}
                  className="text-sm text-gray-600 bg-gray-50 p-2 rounded"
                >
                  {new Date().toLocaleTimeString()} - {result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 测试说明 */}
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <h2 className="text-lg font-semibold mb-2 text-blue-800">
            测试说明
          </h2>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 拖拽文件到上传区域或点击选择文件</li>
            <li>• 支持图片、PDF、文本文件</li>
            <li>• 单个文件最大10MB</li>
            <li>• 最多选择5个文件</li>
            <li>• <strong>按F12打开开发者工具，查看Console标签页的日志输出</strong></li>
          </ul>
        </div>

        {/* 控制台提示 */}
        <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
          <h2 className="text-lg font-semibold mb-2 text-yellow-800">
            🔍 如何查看控制台输出
          </h2>
          <div className="text-sm text-yellow-700 space-y-2">
            <p><strong>方法1：</strong> 按 F12 键打开开发者工具，点击 "Console" 标签页</p>
            <p><strong>方法2：</strong> 右键点击页面 → 选择 "检查" → 点击 "Console" 标签页</p>
            <p><strong>方法3：</strong> 按 Ctrl+Shift+I (Windows) 或 Cmd+Option+I (Mac)</p>
            <p className="text-yellow-600 font-medium">选择文件后，控制台会显示详细的文件信息！</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploadTest;

'use client'

import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileAudio, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  onFileRemove?: () => void
  isLoading?: boolean
  isUploading?: boolean
  isGenerating?: boolean
  isProcessing?: boolean
  selectedFile?: File | null
  className?: string
}

export function FileDropzone({
  onFileSelect,
  onFileRemove,
  isLoading = false,
  isUploading = false,
  isGenerating = false,
  isProcessing = false,
  selectedFile = null,
  className
}: FileDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
    },
    maxFiles: 1,
    disabled: isLoading || isProcessing
  })

  const getStatusText = () => {
    if (isUploading) return '正在上傳檔案...'
    if (isGenerating) return '正在生成會議記錄...'
    if (isLoading) return '處理中...'
    if (isProcessing && selectedFile) return '等待開始處理...'
    return null
  }

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    if (selectedFile) return <FileAudio className="h-8 w-8 text-green-500" />
    return <Upload className="h-8 w-8 text-gray-400" />
  }

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onFileRemove) {
      onFileRemove()
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
          "hover:border-blue-400 hover:bg-blue-50/50",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isDragActive && !isDragReject && "border-blue-500 bg-blue-50",
          isDragReject && "border-red-500 bg-red-50",
          isLoading && "cursor-not-allowed opacity-75",
          isProcessing && "cursor-not-allowed opacity-75",
          selectedFile && !isLoading && !isProcessing && "border-green-500 bg-green-50",
          selectedFile && isProcessing && "border-orange-500 bg-orange-50"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {getStatusIcon()}
          
          <div className="space-y-2">
            {getStatusText() ? (
              <div className="space-y-2">
                <p className="text-lg font-medium text-blue-600">
                  {getStatusText()}
                </p>
                {(isUploading || isGenerating) && (
                  <div className="w-48 bg-gray-200 rounded-full h-2 mx-auto">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
                  </div>
                )}
              </div>
            ) : selectedFile ? (
              <div className="space-y-2">
                <p className="text-lg font-medium text-green-600">
                  {isProcessing ? '檔案處理中' : '檔案已選擇'}
                </p>
                <div className="flex items-center justify-center gap-2 p-3 bg-white rounded-lg border max-w-sm mx-auto">
                  <FileAudio className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">
                    {selectedFile.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    disabled={isProcessing}
                    className="h-6 w-6 p-0 hover:bg-red-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {isDragActive ? (
                  isDragReject ? (
                    <p className="text-lg font-medium text-red-600">
                      不支援的檔案格式
                    </p>
                  ) : (
                    <p className="text-lg font-medium text-blue-600">
                      放開以上傳檔案
                    </p>
                  )
                ) : (
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      拖放音頻檔案到這裡
                    </p>
                    <p className="text-sm text-gray-500">
                      或點擊選擇檔案
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {!isLoading && !selectedFile && !isProcessing && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Upload className="h-4 w-4 mr-2" />
              選擇檔案
            </Button>
          )}
        </div>
        
        {/* 支援格式提示 */}
        {!isLoading && !isProcessing && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2">
            <p className="text-xs text-gray-400">
              支援格式: MP3, WAV, OGG, M4A, AAC
            </p>
          </div>
        )}
      </div>
      
      {/* 錯誤提示 */}
      {isDragReject && (
        <p className="mt-2 text-sm text-red-600 text-center">
          請選擇有效的音頻檔案
        </p>
      )}
    </div>
  )
}
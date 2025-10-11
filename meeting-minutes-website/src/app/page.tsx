// src/app/page-upgraded.tsx
// 升級版頁面 - 使用新的 Hooks 和 IAP 功能
'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { FileDropzone } from '@/components/FileDropzone'
import { SuccessIndicator, ErrorIndicator } from '@/components/StatusIndicator'
import { useExportToDocs } from '@/hooks/api/useDocsQuery'
import { useProcessMeetingMinutes } from '@/hooks/api/useMinutesQuery'
import { Copy, Trash2, FileDown, LogOut, Edit, Eye, AlertCircle, Shield } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export default function Home() {
  // 會議記錄相關狀態
  const [meetingRecord, setMeetingRecord] = useState('')
  const [meetingName, setMeetingName] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [participants, setParticipants] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')

  // UI 狀態
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<{ message: string; url: string } | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  // 檔案相關
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // 使用新的認證 Hook（支援 IAP）
  const {
    user,
    isAuthenticated,
    isConfigLoading,
    hasDocsPermission,
    requestDocsPermission,
    logout,
    clearError,
    isIAPAuthenticated,
    isOAuthAuthenticated
  } = useAuth()

  // 使用新的 Docs 匯出 Hook
  const exportMutation = useExportToDocs()

  // 使用新的會議記錄處理 Hook（含上傳進度）
  const {
    processFile,
    currentStep,
    uploadProgress,
    isLoading: isProcessingMinutes,
    isUploading,
    isGenerating,
    error: processError,
    reset: resetProcess
  } = useProcessMeetingMinutes()

  // 保存會議記錄到 localStorage
  const saveMeetingDataToLocal = useCallback((data: {
    meetingRecord: string;
    meetingName: string;
    meetingDate: string;
    participants: string;
    additionalInfo: string;
  }) => {
    try {
      localStorage.setItem('savedMeetingData', JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('無法保存會議記錄到 localStorage:', error);
    }
  }, []);

  // 從 localStorage 恢復會議記錄
  const loadMeetingDataFromLocal = useCallback(() => {
    try {
      const savedData = localStorage.getItem('savedMeetingData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // 檢查是否是最近 24 小時內的數據
        const isRecent = Date.now() - parsedData.timestamp < 24 * 60 * 60 * 1000;
        if (isRecent) {
          setMeetingRecord(parsedData.meetingRecord || '');
          setMeetingName(parsedData.meetingName || '');
          setMeetingDate(parsedData.meetingDate || '');
          setParticipants(parsedData.participants || '');
          setAdditionalInfo(parsedData.additionalInfo || '');
          return true;
        }
      }
    } catch (error) {
      console.warn('無法從 localStorage 讀取會議記錄:', error);
    }
    return false;
  }, []);

  // 處理檔案選擇
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setError(null)
    setExportSuccess(null)
  }, [])

  // 開始處理音頻檔案（使用新的 Hook）
  const handleStartProcessing = useCallback(async () => {
    if (!selectedFile) return

    try {
      setError(null)

      const result = await processFile(selectedFile, {
        meetingName: meetingName || '會議記錄',
        meetingDate: meetingDate || new Date().toISOString().split('T')[0],
        participants: participants || '',
        additionalInfo: additionalInfo || ''
      })

      setMeetingRecord(result.meetingMinutes)

      // 保存到 localStorage
      saveMeetingDataToLocal({
        meetingRecord: result.meetingMinutes,
        meetingName,
        meetingDate,
        participants,
        additionalInfo
      })

    } catch (error) {
      console.error('處理音頻檔案失敗:', error)
      setError(error instanceof Error ? error.message : '處理音頻檔案失敗')
      setSelectedFile(null)
    }
  }, [selectedFile, meetingName, meetingDate, participants, additionalInfo, processFile, saveMeetingDataToLocal])

  // Google Docs 匯出（使用新的 Hook）
  const exportToGoogleDocs = useCallback(async () => {
    if (!meetingRecord) {
      setError('沒有會議記錄可匯出')
      return
    }

    // 如果未登入或沒有 Docs 權限，觸發 OAuth 授權流程
    if (!isAuthenticated || !hasDocsPermission) {
      console.log('觸發 Google OAuth 授權流程...')
      requestDocsPermission()
      return
    }

    const title = meetingName || `會議記錄 - ${meetingDate || new Date().toLocaleDateString()}`

    setError(null)
    setExportSuccess(null)

    exportMutation.mutate(
      {
        markdownContent: meetingRecord,
        title: title
      },
      {
        onSuccess: (data) => {
          setExportSuccess({
            message: `成功匯出到 Google Docs: ${title}`,
            url: data.documentUrl
          })
        },
        onError: (error) => {
          setError(error.message)
        }
      }
    )
  }, [meetingRecord, isAuthenticated, hasDocsPermission, meetingName, meetingDate, requestDocsPermission, exportMutation])

  // 複製會議記錄
  const copyToClipboard = async () => {
    if (!meetingRecord) return

    try {
      await navigator.clipboard.writeText(meetingRecord)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('複製失敗:', error)
      setError('複製到剪貼板失敗')
    }
  }

  // 清除選擇的檔案
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null)
    setError(null)
    setExportSuccess(null)
    resetProcess()
  }, [resetProcess])

  // 清除所有內容
  const clearAll = useCallback(() => {
    setMeetingRecord('')
    setMeetingName('')
    setMeetingDate('')
    setParticipants('')
    setAdditionalInfo('')
    setError(null)
    setExportSuccess(null)
    setSelectedFile(null)
    resetProcess()
    try {
      localStorage.removeItem('savedMeetingData')
    } catch (error) {
      console.warn('無法清除 localStorage:', error)
    }
  }, [resetProcess])

  // 初始化時載入資料
  useEffect(() => {
    loadMeetingDataFromLocal()
  }, [loadMeetingDataFromLocal])

  // 清除錯誤
  useEffect(() => {
    if (error || processError) {
      clearError()
    }
  }, [error, processError, clearError])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* 標題與認證區域 */}
        <Card className="mb-12 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
              <div className="space-y-2">
                <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  AI 會議記錄生成器
                </CardTitle>
                <CardDescription className="text-lg text-gray-600">
                  上傳音頻檔案，AI 自動生成專業會議記錄並匯出到 Google Docs
                </CardDescription>
              </div>

              {/* 認證狀態（支援 IAP 和 OAuth） */}
              <div className="flex items-center gap-4">
                {isAuthenticated && user ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-10 h-10 rounded-full border-2 border-green-300"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-green-800">
                          {user.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600">
                            {user.source === 'iap' ? (
                              <span className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                IAP 認證
                              </span>
                            ) : (
                              '已連結 Google 帳戶'
                            )}
                          </span>
                          {!hasDocsPermission && isIAPAuthenticated && (
                            <span className="flex items-center gap-1 text-xs text-orange-600">
                              <AlertCircle className="h-3 w-3" />
                              需授權 Docs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 只有 OAuth 登入才顯示登出按鈕 */}
                    {isOAuthAuthenticated && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={logout}
                        className="border-green-300 text-green-700 hover:bg-green-100"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        登出
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    {isConfigLoading ? '載入中...' : '未登入'}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 狀態指示器 */}
        <div className="space-y-6 mb-12">
          {(error || processError) && (
            <ErrorIndicator
              title="操作失敗"
              message={error || processError?.message || '未知錯誤'}
              onDismiss={() => {
                setError(null)
                resetProcess()
              }}
            />
          )}

          {exportSuccess && (
            <SuccessIndicator
              title="匯出成功"
              message={exportSuccess.message}
              action={{
                label: "開啟文件",
                onClick: () => window.open(exportSuccess.url, '_blank'),
                variant: "default"
              }}
              secondaryAction={{
                label: "關閉",
                onClick: () => setExportSuccess(null)
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          {/* 左側：會議資訊輸入 */}
          <div className="space-y-8">
            {/* 會議基本資訊 */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-semibold text-gray-800">會議資訊</CardTitle>
                <CardDescription className="text-gray-600">
                  填寫會議基本資訊，幫助 AI 生成更準確的記錄
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="meetingName" className="text-sm font-medium text-gray-700">
                      會議名稱
                    </Label>
                    <Input
                      id="meetingName"
                      value={meetingName}
                      onChange={(e) => setMeetingName(e.target.value)}
                      placeholder="例如：產品規劃會議"
                      className="h-11"
                      disabled={isProcessingMinutes}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meetingDate" className="text-sm font-medium text-gray-700">
                      會議日期
                    </Label>
                    <Input
                      id="meetingDate"
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="h-11"
                      disabled={isProcessingMinutes}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="participants" className="text-sm font-medium text-gray-700">
                    與會人員
                  </Label>
                  <Input
                    id="participants"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="例如：張三、李四、王五"
                    className="h-11"
                    disabled={isProcessingMinutes}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInfo" className="text-sm font-medium text-gray-700">
                    其他資訊
                  </Label>
                  <Textarea
                    id="additionalInfo"
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder="例如：會議目標、背景資訊等"
                    rows={4}
                    className="resize-none"
                    disabled={isProcessingMinutes}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 音頻檔案上傳 */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-semibold text-gray-800">音頻檔案</CardTitle>
                <CardDescription className="text-gray-600">
                  上傳會議音頻檔案，AI 將自動轉錄並生成記錄
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FileDropzone
                  onFileSelect={handleFileSelect}
                  onFileRemove={clearSelectedFile}
                  isLoading={isProcessingMinutes}
                  isUploading={isUploading}
                  isGenerating={isGenerating}
                  isProcessing={isProcessingMinutes}
                  selectedFile={selectedFile}
                />

                {/* 上傳進度條 */}
                {isUploading && uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>上傳進度</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 確認處理按鈕 */}
                {selectedFile && !isProcessingMinutes && currentStep === 'idle' && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleStartProcessing}
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl shadow-lg"
                    >
                      開始處理音頻檔案
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右側：會議記錄顯示與操作 */}
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-6">
              <div className="space-y-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-800">會議記錄</CardTitle>
                  <CardDescription className="text-gray-600">
                    AI 生成的會議記錄將顯示在這裡，您可以編輯和匯出
                  </CardDescription>
                </div>

                {/* 操作按鈕 */}
                {meetingRecord && (
                  <div className="flex flex-wrap gap-3 pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={copyToClipboard}
                      disabled={!meetingRecord || isProcessingMinutes}
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      {isCopied ? '已複製' : '複製內容'}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={clearAll}
                      disabled={isProcessingMinutes}
                      className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      清除全部
                    </Button>

                    <Button
                      onClick={exportToGoogleDocs}
                      disabled={!meetingRecord || exportMutation.isPending || isProcessingMinutes}
                      className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      <FileDown className="h-4 w-4" />
                      {exportMutation.isPending
                        ? '匯出中...'
                        : hasDocsPermission
                          ? '匯出到 Google Docs'
                          : '授權並匯出'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {meetingRecord ? (
                <div className="space-y-4">
                  {/* 編輯/預覽模式切換 */}
                  <div className="flex gap-2 border-b">
                    <button
                      onClick={() => setIsPreviewMode(false)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        !isPreviewMode
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                      disabled={isProcessingMinutes}
                    >
                      <Edit className="h-4 w-4" />
                      編輯
                    </button>
                    <button
                      onClick={() => setIsPreviewMode(true)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        isPreviewMode
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                      disabled={isProcessingMinutes}
                    >
                      <Eye className="h-4 w-4" />
                      預覽
                    </button>
                  </div>

                  {/* 內容區域 */}
                  {isPreviewMode ? (
                    <div className="h-[600px] overflow-y-auto p-6 border border-gray-200 rounded-lg bg-white">
                      <div className="markdown-body">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                        >
                          {meetingRecord}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <Textarea
                      value={meetingRecord}
                      onChange={(e) => setMeetingRecord(e.target.value)}
                      className="h-[600px] font-mono text-sm leading-relaxed resize-none border-gray-200 focus:border-blue-500 focus:ring-blue-500 overflow-y-auto"
                      placeholder="會議記錄將出現在這裡..."
                      disabled={isProcessingMinutes}
                    />
                  )}

                  <div className="text-xs text-gray-500 text-right">
                    字數：{meetingRecord.length} | 行數：{meetingRecord.split('\n').length}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <FileDown className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-700 mb-2">
                        尚無會議記錄
                      </p>
                      <p className="text-sm text-gray-500">
                        請上傳音頻檔案，AI 將自動生成會議記錄
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

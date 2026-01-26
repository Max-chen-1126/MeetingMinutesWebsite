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
import { Copy, Trash2, FileDown, LogOut } from "lucide-react";
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { toast } from "sonner";

export default function Home() {
    // 會議記錄相關狀態
    const [meetingRecord, setMeetingRecord] = useState("");
    const [meetingName, setMeetingName] = useState("");
    const [meetingDate, setMeetingDate] = useState("");
    const [participants, setParticipants] = useState("");
    const [additionalInfo, setAdditionalInfo] = useState("");

    // UI 狀態
    const [error, setError] = useState<string | null>(null);
    const [exportSuccess, setExportSuccess] = useState<{
        message: string;
        url: string;
    } | null>(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    // 檔案相關
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // 使用新的認證 Hook（支援 IAP）
    const {
        user,
        isAuthenticated,
        isConfigLoading,
        hasDocsPermission,
        requestDocsPermission,
        logout,
        clearError,
        isOAuthAuthenticated,
    } = useAuth();

    // 使用新的 Docs 匯出 Hook
    const exportMutation = useExportToDocs();

    // 使用新的會議記錄處理 Hook（含上傳進度）
    const {
        processFile,
        currentStep,
        uploadProgress,
        isLoading: isProcessingMinutes,
        isUploading,
        isGenerating,
        error: processError,
        reset: resetProcess,
    } = useProcessMeetingMinutes();

    // 保存會議記錄到 localStorage
    const saveMeetingDataToLocal = useCallback(
        (data: {
            meetingRecord: string;
            meetingName: string;
            meetingDate: string;
            participants: string;
            additionalInfo: string;
        }) => {
            try {
                localStorage.setItem(
                    "savedMeetingData",
                    JSON.stringify({
                        ...data,
                        timestamp: Date.now(),
                    }),
                );
            } catch (error) {
                console.warn("無法保存會議記錄到 localStorage:", error);
            }
        },
        [],
    );

    // 從 localStorage 恢復會議記錄
    const loadMeetingDataFromLocal = useCallback(() => {
        try {
            const savedData = localStorage.getItem("savedMeetingData");
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                // 檢查是否是最近 24 小時內的數據
                const isRecent =
                    Date.now() - parsedData.timestamp < 24 * 60 * 60 * 1000;
                if (isRecent) {
                    setMeetingRecord(parsedData.meetingRecord || "");
                    setMeetingName(parsedData.meetingName || "");
                    setMeetingDate(parsedData.meetingDate || "");
                    setParticipants(parsedData.participants || "");
                    setAdditionalInfo(parsedData.additionalInfo || "");
                    return true;
                }
            }
        } catch (error) {
            console.warn("無法從 localStorage 讀取會議記錄:", error);
        }
        return false;
    }, []);

    // 處理檔案選擇
    const handleFileSelect = useCallback((file: File) => {
        setSelectedFile(file);
        setError(null);
        setExportSuccess(null);
    }, []);

    // 開始處理音頻檔案（使用新的 Hook）
    const handleStartProcessing = useCallback(async () => {
        if (!selectedFile) return;

        try {
            setError(null);

            const result = await processFile(selectedFile, {
                meetingName: meetingName || "會議記錄",
                meetingDate: meetingDate || new Date().toISOString().split("T")[0],
                participants: participants || "",
                additionalInfo: additionalInfo || "",
            });

            setMeetingRecord(result.meetingMinutes);

            // 保存到 localStorage
            saveMeetingDataToLocal({
                meetingRecord: result.meetingMinutes,
                meetingName,
                meetingDate,
                participants,
                additionalInfo,
            });
        } catch (error) {
            console.error("處理音頻檔案失敗:", error);
            setError(error instanceof Error ? error.message : "處理音頻檔案失敗");
            setSelectedFile(null);
        }
    }, [
        selectedFile,
        meetingName,
        meetingDate,
        participants,
        additionalInfo,
        processFile,
        saveMeetingDataToLocal,
    ]);

    // Google Docs 匯出（使用新的 Hook）
    const exportToGoogleDocs = useCallback(async () => {
        if (!meetingRecord) {
            setError("沒有會議記錄可匯出");
            return;
        }

        // 如果未登入或沒有 Docs 權限，觸發 OAuth 授權流程
        if (!isAuthenticated || !hasDocsPermission) {
            console.log("觸發 Google OAuth 授權流程...");
            requestDocsPermission();
            return;
        }

        const title =
            meetingName ||
            `會議記錄 - ${meetingDate || new Date().toLocaleDateString()}`;

        setError(null);
        setExportSuccess(null);

        exportMutation.mutate(
            {
                markdownContent: meetingRecord,
                title: title,
            },
            {
                onSuccess: (data) => {
                    setExportSuccess({
                        message: `成功匯出到 Google Docs: ${title}`,
                        url: data.documentUrl,
                    });
                },
                onError: (error) => {
                    setError(error.message);
                },
            },
        );
    }, [
        meetingRecord,
        isAuthenticated,
        hasDocsPermission,
        meetingName,
        meetingDate,
        requestDocsPermission,
        exportMutation,
    ]);

    // 複製會議記錄
    const copyToClipboard = async () => {
        if (!meetingRecord) return;

        try {
            await navigator.clipboard.writeText(meetingRecord);
            toast.success("已複製到剪貼板");
        } catch (error) {
            console.error("複製失敗:", error);
            toast.error("複製到剪貼板失敗");
            setError("複製到剪貼板失敗");
        }
    };

    // 清除選擇的檔案
    const clearSelectedFile = useCallback(() => {
        setSelectedFile(null);
        setError(null);
        setExportSuccess(null);
        resetProcess();
    }, [resetProcess]);

    // 清除所有內容
    const clearAll = useCallback(() => {
        setMeetingRecord("");
        setMeetingName("");
        setMeetingDate("");
        setParticipants("");
        setAdditionalInfo("");
        setError(null);
        setExportSuccess(null);
        setSelectedFile(null);
        resetProcess();
        try {
            localStorage.removeItem("savedMeetingData");
        } catch (error) {
            console.warn("無法清除 localStorage:", error);
        }
    }, [resetProcess]);

    // 初始化時載入資料
    useEffect(() => {
        loadMeetingDataFromLocal();
    }, [loadMeetingDataFromLocal]);

    // 清除錯誤
    useEffect(() => {
        if (error || processError) {
            clearError();
        }
    }, [error, processError, clearError]);

    return (
        <div className="min-h-screen bg-background selection:bg-primary/10 selection:text-primary">
            <div className="container mx-auto px-4 py-12 max-w-6xl">
                {/* 標題與認證區域 */}
                <div className="mb-12">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 mb-8">
                        <div className="space-y-3">
                            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                                AI 會議記錄生成
                            </h1>
                            <p className="text-lg text-muted-foreground font-light max-w-2xl">
                                上傳音頻，讓 Gemini 3.0 協助生成專業的會議記錄並匯出
                            </p>
                        </div>

                        {/* 認證狀態 */}
                        <div className="flex items-center gap-4">
                            {isAuthenticated && user ? (
                                <div className="flex items-center gap-3 pl-4 pr-2 py-1.5 bg-card/50 rounded-full border border-border shadow-xs backdrop-blur-sm transition-all hover:bg-card hover:shadow-md">
                                    <div className="flex items-center gap-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={user.picture}
                                            alt={user.name}
                                            className="w-8 h-8 rounded-full ring-2 ring-background"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-foreground leading-none mb-0.5">
                                                {user.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                {user.source === "iap"
                                                    ? "IAP Verified"
                                                    : "Google Account"}
                                            </span>
                                        </div>
                                    </div>

                                    {isOAuthAuthenticated && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={logout}
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full ml-1"
                                        >
                                            <LogOut className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-muted-foreground text-sm font-medium px-4 py-2 bg-muted/50 rounded-full">
                                    {isConfigLoading ? "載入中..." : "未登入"}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 分隔線 */}
                    <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
                </div>

                {/* 狀態指示器 */}
                <div className="space-y-6 mb-12">
                    {(error || processError) && (
                        <ErrorIndicator
                            title="操作失敗"
                            message={error || processError?.message || "未知錯誤"}
                            onDismiss={() => {
                                setError(null);
                                resetProcess();
                            }}
                        />
                    )}

                    {exportSuccess && (
                        <SuccessIndicator
                            title="匯出成功"
                            message={exportSuccess.message}
                            action={{
                                label: "開啟文件",
                                onClick: () => window.open(exportSuccess.url, "_blank"),
                                variant: "default",
                            }}
                            secondaryAction={{
                                label: "關閉",
                                onClick: () => setExportSuccess(null),
                            }}
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    {/* 左側：輸入區域 */}
                    <div className="space-y-8">
                        {/* 音頻檔案上傳 - 把這個移到最上面，因為是最重要的第一步 */}
                        <Card className="border-border shadow-sm bg-card overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                                    <div className="h-6 w-1 bg-primary rounded-full" />
                                    步驟 1：上傳錄音
                                </CardTitle>
                                <CardDescription>
                                    支援 mp3, wav, m4a 等常見格式
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
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
                                        <div className="flex justify-between text-sm text-foreground/80 font-medium">
                                            <span>上傳中...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 會議資訊 */}
                        <Card className="border-border shadow-sm bg-card overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                                    <div className="h-6 w-1 bg-primary/40 rounded-full" />
                                    步驟 2：補充資訊
                                </CardTitle>
                                <CardDescription>
                                    提供更多上下文，幫助 AI 更精確地識別內容
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="meetingName"
                                            className="text-sm font-medium text-foreground/80"
                                        >
                                            會議名稱
                                        </Label>
                                        <Input
                                            id="meetingName"
                                            value={meetingName}
                                            onChange={(e) =>
                                                setMeetingName(e.target.value)
                                            }
                                            placeholder="例如：產品規劃會議"
                                            className="h-10 bg-background/50 focus:bg-background transition-colors"
                                            disabled={isProcessingMinutes}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="meetingDate"
                                            className="text-sm font-medium text-foreground/80"
                                        >
                                            會議日期
                                        </Label>
                                        <Input
                                            id="meetingDate"
                                            type="date"
                                            value={meetingDate}
                                            onChange={(e) =>
                                                setMeetingDate(e.target.value)
                                            }
                                            className="h-10 bg-background/50 focus:bg-background transition-colors"
                                            disabled={isProcessingMinutes}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="participants"
                                        className="text-sm font-medium text-foreground/80"
                                    >
                                        與會人員
                                    </Label>
                                    <Input
                                        id="participants"
                                        value={participants}
                                        onChange={(e) =>
                                            setParticipants(e.target.value)
                                        }
                                        placeholder="例如：Alex, Sarah, Mike"
                                        className="h-10 bg-background/50 focus:bg-background transition-colors"
                                        disabled={isProcessingMinutes}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="additionalInfo"
                                        className="text-sm font-medium text-foreground/80"
                                    >
                                        其他備註
                                    </Label>
                                    <Textarea
                                        id="additionalInfo"
                                        value={additionalInfo}
                                        onChange={(e) =>
                                            setAdditionalInfo(e.target.value)
                                        }
                                        placeholder="例如：本次會議重點在於討論 Q4 營收..."
                                        rows={3}
                                        className="resize-none bg-background/50 focus:bg-background transition-colors"
                                        disabled={isProcessingMinutes}
                                    />
                                </div>

                                {/* 確認處理按鈕 - 移到這裡 */}
                                {selectedFile &&
                                    !isProcessingMinutes &&
                                    currentStep === "idle" && (
                                        <div className="pt-2">
                                            <Button
                                                onClick={handleStartProcessing}
                                                size="lg"
                                                className="w-full text-base font-semibold shadow-md active:scale-[0.99] transition-all"
                                            >
                                                開始生成會議記錄
                                            </Button>
                                        </div>
                                    )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* 右側：結果 */}
                    <div className="flex flex-col h-full">
                        <Card className="border-border shadow-sm bg-card flex-1 flex flex-col overflow-hidden h-full min-h-[600px]">
                            <CardHeader className="pb-2 flex-none">
                                <div className="flex flex-row items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                                            <div className="h-6 w-1 bg-primary rounded-full" />
                                            生成結果
                                        </CardTitle>
                                    </div>

                                    {meetingRecord && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={copyToClipboard}
                                                disabled={
                                                    !meetingRecord ||
                                                    isProcessingMinutes
                                                }
                                                className="h-8 px-2 text-muted-foreground hover:text-primary"
                                            >
                                                <Copy className="h-4 w-4 mr-1.5" />
                                                複製
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearAll}
                                                disabled={isProcessingMinutes}
                                                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4 mr-1.5" />
                                                清除
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 p-0 flex flex-col min-h-0">
                                {meetingRecord ? (
                                    <div className="flex flex-col h-full">
                                        {/* Toolbar */}
                                        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/50">
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() =>
                                                        setIsPreviewMode(false)
                                                    }
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                                        !isPreviewMode
                                                            ? "bg-primary/10 text-primary"
                                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    }`}
                                                >
                                                    編輯模式
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setIsPreviewMode(true)
                                                    }
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                                        isPreviewMode
                                                            ? "bg-primary/10 text-primary"
                                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    }`}
                                                >
                                                    預覽模式
                                                </button>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground tabular-nums">
                                                {meetingRecord.length} 字
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 overflow-hidden relative group">
                                            {isPreviewMode ? (
                                                <div className="absolute inset-0 overflow-y-auto p-6 scroll-smooth">
                                                    <div className="markdown-body prose prose-sm prose-slate dark:prose-invert max-w-none">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            rehypePlugins={[
                                                                rehypeHighlight,
                                                            ]}
                                                        >
                                                            {meetingRecord}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Textarea
                                                    value={meetingRecord}
                                                    onChange={(e) =>
                                                        setMeetingRecord(e.target.value)
                                                    }
                                                    className="absolute inset-0 w-full h-full resize-none border-0 focus:ring-0 rounded-none p-6 font-mono text-sm leading-relaxed bg-transparent"
                                                    placeholder="會議記錄將出現在這裡..."
                                                />
                                            )}
                                        </div>

                                        {/* Bottom Action */}
                                        <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm">
                                            <Button
                                                onClick={exportToGoogleDocs}
                                                disabled={
                                                    !meetingRecord ||
                                                    exportMutation.isPending ||
                                                    isProcessingMinutes
                                                }
                                                className="w-full shadow-sm"
                                                size="lg"
                                            >
                                                <FileDown className="h-4 w-4 mr-2" />
                                                {exportMutation.isPending
                                                    ? "正在匯出到 Google Docs..."
                                                    : hasDocsPermission
                                                      ? "匯出到 Google Docs"
                                                      : "授權並匯出"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-muted/5 space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                                            <FileDown className="h-8 w-8 text-muted-foreground/50" />
                                        </div>
                                        <div className="max-w-xs space-y-1">
                                            <p className="font-medium text-foreground">
                                                準備就緒
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                請在左側上傳錄音檔案，AI
                                                將為您生成詳細的會議記錄
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

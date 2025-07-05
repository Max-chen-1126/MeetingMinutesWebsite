'use client'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { UserInfo } from "@/components/UserInfo"
import { AnimatePresence, motion } from "framer-motion"
import {
  CalendarDays,
  Check,
  ClipboardCopy,
  FileAudio,
  FileText,
  Loader2,
  LogIn,
  MicVocal,
  PenLine,
  Sparkles,
  UploadCloud,
  Users,
  X
} from "lucide-react"
import { useCallback, useState, useEffect } from 'react'
import { DropzoneOptions, FileRejection, useDropzone } from 'react-dropzone'
import ReactMarkdown, { Components } from 'react-markdown'; // Import Components type if needed for stricter typing
import remarkGfm from 'remark-gfm'


export default function Home() {
  const [meetingRecord, setMeetingRecord] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [gcsPath, setGcsPath] = useState<string | null>(null) // State to store GCS path after upload
  const [meetingName, setMeetingName] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [participants, setParticipants] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [isLoading, setIsLoading] = useState(false) // Overall loading state
  const [isUploadingToGCS, setIsUploadingToGCS] = useState(false); // Specific GCS upload phase
  const [isGenerating, setIsGenerating] = useState(false) // Specific generation phase
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)

  // --- 保存會議記錄到 localStorage ---
  const saveMeetingDataToLocal = (data: {
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
  };

  // --- 從 localStorage 恢復會議記錄 ---
  const loadMeetingDataFromLocal = () => {
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
          return true; // 表示成功恢復數據
        }
      }
    } catch (error) {
      console.warn('無法從 localStorage 讀取會議記錄:', error);
    }
    return false;
  };

  // --- 清除保存的會議記錄 ---
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clearSavedMeetingData = () => {
    try {
      localStorage.removeItem('savedMeetingData');
    } catch (error) {
      console.warn('無法清除保存的會議記錄:', error);
    }
  };

  // --- 清理過期 Token ---
  const clearExpiredToken = useCallback(() => {
    console.log('清理過期或無效的 token');
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleTokenInfo');
    setGoogleAccessToken(null);
  }, []);

  // --- 刷新 Access Token ---
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    try {
      const tokenInfo = localStorage.getItem('googleTokenInfo');
      if (!tokenInfo) {
        console.warn('沒有 token 資訊，無法刷新');
        return false;
      }

      const parsed = JSON.parse(tokenInfo);
      if (!parsed.refresh_token) {
        console.warn('沒有 refresh token，無法自動刷新');
        return false;
      }

      console.log('正在刷新 access token...');
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: parsed.refresh_token })
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        // 更新 token 資訊
        const newTokenInfo = {
          ...parsed,
          access_token: data.access_token,
          expires_at: data.expires_at
        };
        
        localStorage.setItem('googleAccessToken', data.access_token);
        localStorage.setItem('googleTokenInfo', JSON.stringify(newTokenInfo));
        setGoogleAccessToken(data.access_token);
        
        console.log('Access token 刷新成功');
        return true;
      } else {
        console.error('刷新 token 失敗:', data.error);
        // 如果刷新失敗，清除所有 token
        clearExpiredToken();
        return false;
      }
    } catch (error) {
      console.error('刷新 token 時出錯:', error);
      clearExpiredToken();
      return false;
    }
  }, [clearExpiredToken]);

  // --- Token 有效性檢查 ---
  const isTokenValid = useCallback((): boolean => {
    if (!googleAccessToken) return false;
    
    try {
      const tokenInfo = localStorage.getItem('googleTokenInfo');
      if (!tokenInfo) {
        console.warn('找不到 token 詳細資訊，建議重新登入');
        return false; // 改為返回 false，要求重新登入以確保安全
      }
      
      const parsed = JSON.parse(tokenInfo);
      const now = Date.now();
      
      // 檢查是否過期（提前 2 分鐘檢查，減少誤判）
      const isValid = parsed.expires_at && now < (parsed.expires_at - 2 * 60 * 1000);
      
      if (!isValid) {
        console.log('Token 已過期或即將過期，需要重新登入');
        console.log('當前時間:', new Date(now).toLocaleString());
        console.log('Token 過期時間:', new Date(parsed.expires_at).toLocaleString());
      }
      
      return isValid;
    } catch (error) {
      console.error('檢查 token 有效性時出錯:', error);
      // 出錯時清除可能損壞的 token 資料
      clearExpiredToken();
      return false;
    }
  }, [googleAccessToken, clearExpiredToken]);

  // --- 初始化 Google Token 和恢復會議記錄 ---
  useEffect(() => {
    const initializeTokens = () => {
      // 從 localStorage 讀取 Google access token
      const storedToken = localStorage.getItem('googleAccessToken');
      const storedTokenInfo = localStorage.getItem('googleTokenInfo');
      
      if (storedToken) {
        console.log('發現已存儲的 Google token，檢查有效性');
        
        // 檢查 token 是否過期
        try {
          if (storedTokenInfo) {
            const parsed = JSON.parse(storedTokenInfo);
            const now = Date.now();
            
            // 檢查是否過期（提前 2 分鐘檢查，與 isTokenValid 一致）
            if (parsed.expires_at && now >= (parsed.expires_at - 2 * 60 * 1000)) {
              console.log('Google token 已過期，自動清理');
              localStorage.removeItem('googleAccessToken');
              localStorage.removeItem('googleTokenInfo');
              setError('Google 授權已過期，如需匯出請重新登入');
              return;
            }
            
            console.log('Token 有效，設定狀態');
            setGoogleAccessToken(storedToken);
          } else {
            // 沒有 token 資訊，但有 token，清除以確保一致性
            console.warn('發現 token 但沒有詳細資訊，清除以確保安全');
            localStorage.removeItem('googleAccessToken');
            setError('Google 授權資訊不完整，請重新登入');
          }
        } catch (error) {
          console.error('解析 token 資訊時出錯:', error);
          // 清除可能損壞的資料
          localStorage.removeItem('googleAccessToken');
          localStorage.removeItem('googleTokenInfo');
          setError('Google 授權資訊損壞，請重新登入');
        }
      } else {
        console.log('沒有找到已存儲的 Google token');
      }
    };

    // 檢查是否有錯誤參數
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      // 清除 URL 中的錯誤參數
      window.history.replaceState({}, '', window.location.pathname);
    }

    // 初始化 tokens
    initializeTokens();

    // 恢復保存的會議記錄
    const restored = loadMeetingDataFromLocal();
    if (restored) {
      console.log('已恢復之前保存的會議記錄');
    }
  }, []);

  // --- GCS File Deletion Helper ---
  const deleteGcsFile = useCallback(async (pathToDelete: string | null) => {
    if (!pathToDelete) return;
    console.log(`Requesting deletion of GCS file: ${pathToDelete}`);
    try {
      const response = await fetch('/api/delete-file', { // Assuming you created this API route
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gcsPath: pathToDelete }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.warn(`Failed to delete GCS file ${pathToDelete}:`, errorData.error || response.statusText);
      } else {
        console.log(`Successfully requested deletion for GCS file: ${pathToDelete}`);
      }
    } catch (err) {
      console.error(`Error calling delete API for ${pathToDelete}:`, err);
    }
  }, []);

  // --- File Handling with React Dropzone ---
  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    setError(null);
    // If a file was previously uploaded to GCS, trigger deletion before setting new file
    if (gcsPath) {
      deleteGcsFile(gcsPath);
      setGcsPath(null); // Clear GCS path state
    }
    setAudioFile(null); // Clear current file state first

    if (fileRejections.length > 0) {
      setError(`檔案類型錯誤或不符要求: ${fileRejections[0].errors[0].message}`);
    } else if (acceptedFiles.length > 0) {
      setAudioFile(acceptedFiles[0]); // Set the new accepted file
    }
  }, [gcsPath, deleteGcsFile]); // Add dependencies

  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3'], 'audio/wav': ['.wav'], 'audio/ogg': ['.ogg'],
      'audio/mp4': ['.m4a'], 'audio/aac': ['.aac'], 'audio/*': []
    },
    multiple: false,
    disabled: isLoading // Disable dropzone during any loading phase
  };

  const { getRootProps, getInputProps, isDragActive, isFocused, isDragAccept, isDragReject } = useDropzone(dropzoneOptions);

  // Modified remove function to also trigger GCS deletion if needed
  const removeAudioFile = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (gcsPath) {
      deleteGcsFile(gcsPath);
      setGcsPath(null);
    }
    setAudioFile(null);
  }, [gcsPath, deleteGcsFile]); // Add dependencies

  // --- Markdown Extraction ---
  function extractMarkdown(rawText: string): string {
    // (Your existing extractMarkdown function - no changes needed)
    if (!rawText) return '';
    const startMarker = '```markdown\n';
    const startIndex = rawText.indexOf(startMarker);
    const endMarker = '\n```';
    const endIndex = rawText.lastIndexOf(endMarker);
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return rawText.substring(startIndex + startMarker.length, endIndex).trim();
    }
    const simpleStartMarker = '```\n';
    const simpleStartIndex = rawText.indexOf(simpleStartMarker);
    const simpleEndIndex = rawText.lastIndexOf(endMarker);
    if (simpleStartIndex !== -1 && simpleEndIndex !== -1 && simpleEndIndex > simpleStartIndex) {
      return rawText.substring(simpleStartIndex + simpleStartMarker.length, simpleEndIndex).trim();
    }
    console.warn("Markdown markers not found in AI response, returning raw trimmed text.");
    return rawText.trim();
  }

  const handleGenerateRecord = async () => {
    if (!audioFile) {
      setError("請先上傳音檔");
      return;
    }

    setIsLoading(true);
    setIsUploadingToGCS(false);
    setIsGenerating(false);
    setError(null);
    setMeetingRecord('');
    setIsCopied(false);
    // Clear previous GCS path if starting a new generation attempt
    // (Deletion of old GCS file handled by onDrop or removeAudioFile)
    setGcsPath(null);

    let currentGcsPath: string | null = null; // Keep track of path for this attempt

    try {
      // ----- Step 1: Get Signed URL -----
      console.log("Requesting signed URL...");
      const signedUrlResponse = await fetch('/api/generate-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: audioFile.name, contentType: audioFile.type }),
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json();
        throw new Error(errorData.error || `無法取得上傳網址: ${signedUrlResponse.statusText}`);
      }

      const { signedUrl, gcsPath: receivedGcsPath } = await signedUrlResponse.json();
      currentGcsPath = receivedGcsPath; // Store path for potential cleanup
      console.log("Received Signed URL and GCS Path:", currentGcsPath);

      // ----- Step 2: Upload file DIRECTLY to GCS -----
      console.log("Uploading to GCS...");
      setIsUploadingToGCS(true);

      const gcsUploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: audioFile,
        headers: { 'Content-Type': audioFile.type },
      });

      setIsUploadingToGCS(false);

      if (!gcsUploadResponse.ok) {
        throw new Error(`GCS 上傳失敗: ${gcsUploadResponse.status} ${gcsUploadResponse.statusText}`);
      }
      console.log("GCS Upload Successful!");
      setGcsPath(currentGcsPath); // Persist GCS path in state only after successful upload

      // ----- Step 3: Notify backend API for Processing -----
      console.log("Notifying backend API to process file from GCS...");
      setIsGenerating(true); // Indicate processing phase

      const processResponse = await fetch('/api/generate-minutes', { // Your ORIGINAL endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // IMPORTANT: Sending JSON now
        body: JSON.stringify({
          gcsPath: currentGcsPath, // Send the GCS path
          meetingName: meetingName,
          meetingDate: meetingDate,
          participants: participants,
          additionalInfo: additionalInfo,
        }),
      });

      setIsGenerating(false); // Processing phase finished

      if (!processResponse.ok) {
        let errorMsg = `API 處理錯誤: ${processResponse.statusText}`;
        try { const errorData = await processResponse.json(); errorMsg = errorData.error || errorMsg; }
        catch (parseError) { console.warn("Could not parse processing error JSON:", parseError); }
        throw new Error(errorMsg);
      }

      const data = await processResponse.json();
      const rawRecord = data.meetingRecord || '';
      const cleanedRecord = extractMarkdown(rawRecord);
      setMeetingRecord(cleanedRecord);
      
      // 自動保存會議記錄到 localStorage
      saveMeetingDataToLocal({
        meetingRecord: cleanedRecord,
        meetingName,
        meetingDate,
        participants,
        additionalInfo
      });
      
      console.log("Meeting record generated successfully.");
      // File successfully processed, GCS file will be deleted by backend (`generate-minutes`) now.
      // Reset frontend gcsPath state as it's no longer relevant for deletion from frontend.
      setGcsPath(null);

    } catch (err: unknown) {
      console.error("Frontend process error:", err);
      let errorMessage = "處理過程中發生錯誤";
      if (err instanceof Error) errorMessage = err.message;
      else if (typeof err === 'string') errorMessage = err;
      setError(errorMessage);
      setMeetingRecord('');
      // If an error occurred AFTER GCS upload started, try to clean up the GCS file
      if (currentGcsPath && !meetingRecord) { // Check if gcsPath was set and no record was generated
         console.log("Error occurred, attempting GCS cleanup...");
         deleteGcsFile(currentGcsPath);
         setGcsPath(null); // Clear state even if deletion fails
      }
    } finally {
      setIsLoading(false);
      setIsUploadingToGCS(false);
      setIsGenerating(false);
    }
  }

  // --- Copy Handling ---
  const handleCopyRecord = () => {
    if (meetingRecord) {
      navigator.clipboard.writeText(meetingRecord)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        })
        .catch(err => {
          console.error("Failed to copy:", err);
          setError("複製失敗，請手動複製"); // Provide user feedback
        });
    }
  }

  // --- Google OAuth Handling ---
  const handleGoogleLogin = async () => {
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setError('Google Client ID 未設定');
        return;
      }

      // 使用 Google Identity Services 進行授權
      // 優先使用環境變數，再使用當前域名
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      const redirectUri = `${baseUrl}/auth/callback`;
      
      console.log('OAuth 設定:', { baseUrl, redirectUri }); // 用於除錯
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email')}&` +
        `access_type=offline&` +
        `prompt=consent`;

      // 開啟授權頁面
      window.location.href = authUrl;
    } catch (error) {
      console.error('Google 授權失敗:', error);
      setError('Google 授權失敗，請稍後再試');
    }
  };

  // --- Google 登出處理 ---
  const handleGoogleLogout = () => {
    clearExpiredToken();
  };

  // --- Google Docs Export Handling ---
  const exportToGoogleDocs = async (retryCount = 0) => {
    if (!meetingRecord) return;
    
    if (!googleAccessToken) {
      setError('請先在頁面頂部登入 Google 帳戶');
      return;
    }

    // 檢查 token 是否有效，如果即將過期則嘗試刷新
    if (!isTokenValid()) {
      console.log('Token 無效或即將過期，嘗試刷新...');
      const refreshed = await refreshAccessToken();
      
      if (!refreshed) {
        clearExpiredToken();
        setError('Google 授權已過期，請重新登入後再匯出');
        return;
      }
      
      console.log('Token 刷新成功，繼續匯出流程');
    }

    setIsExporting(true);
    setError(null);
    
    try {
      const title = meetingName || `會議記錄 - ${meetingDate || new Date().toLocaleDateString()}`;
      
      // 詳細的調試資訊
      console.log('開始匯出到 Google Docs:', { 
        title, 
        hasToken: !!googleAccessToken,
        tokenLength: googleAccessToken?.length || 0,
        tokenPrefix: googleAccessToken ? googleAccessToken.substring(0, 20) + '...' : 'null',
        retryCount
      });
      
      const response = await fetch('/api/export-to-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${googleAccessToken}`
        },
        body: JSON.stringify({
          markdownContent: meetingRecord,
          title: title
        })
      });
      
      const data = await response.json();
      
      console.log('匯出 API 回應:', { status: response.status, data });
      
      if (response.ok) {
        // 開啟 Google Docs 文件
        console.log('匯出成功，開啟文件:', data.documentUrl);
        window.open(data.documentUrl, '_blank');
      } else {
        console.error('匯出失敗:', data.error);
        if (response.status === 401) {
          console.log('認證失敗，嘗試刷新 token 並重試...');
          
          // 避免無限重試
          if (retryCount >= 1) {
            console.log('已重試過一次，停止重試');
            clearExpiredToken();
            setError('Google 授權已過期，請重新登入');
            return;
          }
          
          const refreshed = await refreshAccessToken();
          
          if (refreshed) {
            console.log('Token 刷新成功，重試匯出...');
            // 重新呼叫匯出函式
            setIsExporting(false);
            setTimeout(() => exportToGoogleDocs(retryCount + 1), 100);
            return;
          } else {
            clearExpiredToken();
            setError('Google 授權已過期，請重新登入');
          }
        } else if (response.status === 403) {
          setError('權限不足，請確認已授予 Google Docs 存取權限');
        } else {
          const errorMessage = data.error || data.details || '匯出至 Google Docs 失敗';
          setError(errorMessage);
        }
      }
    } catch (error) {
      console.error('匯出錯誤:', error);
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          setError('網路連線問題，請檢查網路連線後重試');
        } else {
          setError(`匯出失敗: ${error.message}`);
        }
      } else {
        setError('匯出至 Google Docs 失敗，請稍後再試');
      }
    } finally {
      setIsExporting(false);
    }
  }

  // --- 事件處理器包裝函數 ---
  const handleExportToGoogleDocs = () => {
    exportToGoogleDocs(0);
  }

  // FIX 2: Define custom components with unused 'node' prefixed
  const markdownComponents: Components = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" />,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    h1: ({ node: _node, ...props }) => <h1 {...props} className="text-2xl font-bold mb-1" />, // Example styling
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    h2: ({ node: _node, ...props }) => <h2 {...props} className="text-xl font-semibold mb-1" />, // Example styling
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    h3: ({ node: _node, ...props }) => <h3 {...props} />, // Example styling
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ul: ({ node: _node, ...props }) => <ul {...props} />, // Example styling
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ol: ({ node: _node, ...props }) => <ol {...props} />, // Example styling
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    li: ({ node: _node, ...props }) => <li {...props} />, // Example styling
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    p: ({ node: _node, ...props }) => <p {...props} className="leading-relaxed" />, // Example styling
};


  // --- Render ---
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-12 max-w-4xl"
    >
      {/* 添加用戶資訊區塊 */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex justify-end items-center gap-4 mb-2"
      >
        <UserInfo className="px-4 py-2 bg-card rounded-full shadow-sm" />
        
        {/* Google 登入狀態區域 */}
        <motion.div
          className="flex items-center gap-2 px-4 py-2 bg-card rounded-full shadow-sm"
          whileHover={{ scale: 1.02 }}
        >
          {googleAccessToken ? (
            <>
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check className="h-4 w-4" />
                <span>Google 已登入</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoogleLogout}
                disabled={isLoading}
                className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                登出
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="text-sm text-primary hover:text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <LogIn className="h-4 w-4 mr-1" />
              登入 Google
            </Button>
          )}
        </motion.div>
      </motion.div>
      
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center mb-10"
      >
        <h1 className="text-3xl font-bold text-center flex items-center gap-2">
          <MicVocal className="w-8 h-8 text-primary" />
          會議記錄生成器
        </h1>
        <p className="text-muted-foreground mt-2">上傳會議音檔，快速獲得會議記錄草稿</p>
      </motion.div>

      {/* Error Message Area */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-destructive/10 text-destructive border border-destructive rounded-md flex items-center"
          >
            <X className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Single column with increased gap */}
      <motion.div
        className="grid gap-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {/* Input Card */}
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="h-5 w-5 text-primary" />
              會議資訊與上傳
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* --- React Dropzone Implementation --- */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <UploadCloud className="h-4 w-4 text-muted-foreground" />
                上傳會議音檔
              </Label>
              <motion.div
                whileHover={{ scale: isDragActive || isLoading ? 1 : 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <div
                  {...getRootProps()}
                  className={`
                    relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200
                    ${isFocused ? 'border-primary ring-2 ring-ring ring-offset-2' : 'border-border'}
                    ${isDragAccept ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : ''}
                    ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
                    ${isLoading ? 'cursor-not-allowed opacity-60' : 'bg-muted/30 hover:bg-muted/50'}
                  `}
                >
                  <input {...getInputProps()} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <AnimatePresence mode="wait">
                      {audioFile ? (
                        // Display selected file info
                        <motion.div
                          key="file-info"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="text-sm flex flex-col items-center"
                        >
                          <div className="flex items-center text-primary">
                            <FileAudio className="h-8 w-8 mr-2" />
                            <div>
                              <p className="font-semibold break-all">{audioFile.name}</p>
                              <p className="text-muted-foreground">({(audioFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                            </div>
                          </div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-4 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={removeAudioFile}
                              disabled={isLoading}
                            >
                              <X className="mr-1 h-4 w-4" /> 移除檔案
                            </Button>
                          </motion.div>
                        </motion.div>
                      ) : (
                        // Display dropzone prompt
                        <motion.div
                          key="upload-prompt"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col items-center"
                        >
                          <motion.div
                            animate={{
                              y: isDragActive ? [-5, 0, -5] : 0
                            }}
                            transition={{
                              repeat: isDragActive ? Infinity : 0,
                              duration: 1.5
                            }}
                          >
                            <UploadCloud className={`h-12 w-12 mb-3 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          </motion.div>

                          {isDragReject && (
                            <motion.p
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-destructive text-sm mb-2 flex items-center"
                            >
                              <X className="h-4 w-4 mr-1" />
                              檔案類型不支援
                            </motion.p>
                          )}

                          {isDragActive ? (
                            <p className="text-primary font-semibold">將檔案拖放到這裡...</p>
                          ) : (
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-primary">點擊選擇檔案</span> 或拖放音檔到此
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">(MP3, WAV, M4A, AAC 等)</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid gap-4">
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Label htmlFor="meetingName" className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  會議名稱
                </Label>
                <Input
                  id="meetingName"
                  placeholder="請輸入會議名稱"
                  value={meetingName}
                  onChange={(e) => setMeetingName(e.target.value)}
                  disabled={isLoading}
                  className="transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
                />
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Label htmlFor="meetingDate" className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  會議時間
                </Label>
                <Input
                  id="meetingDate"
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  disabled={isLoading}
                  className="transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
                />
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Label htmlFor="participants" className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  參與人員
                </Label>
                <Input
                  id="participants"
                  placeholder="請輸入參與人員，用逗號分隔"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  disabled={isLoading}
                  className="transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
                />
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Label htmlFor="additionalInfo" className="flex items-center gap-1.5">
                  <PenLine className="h-4 w-4 text-muted-foreground" />
                  其他資訊
                </Label>
                <Textarea
                  id="additionalInfo"
                  placeholder="請輸入其他相關資訊 (例如：會議目標)"
                  rows={3}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  disabled={isLoading}
                  className="resize-none transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
                />
              </motion.div>
            </div>

            <motion.div whileHover={{ scale: isLoading || !audioFile ? 1 : 1.02 }} /* ... */ >
              <Button
                className="w-full group relative overflow-hidden"
                onClick={handleGenerateRecord}
                disabled={isLoading || !audioFile} // Disable if loading or no file
              >
                <div className="absolute inset-0 ..." />
                <span className="relative flex items-center justify-center">
                  {/* Updated loading text */}
                  {isUploadingToGCS ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 上傳至 GCS... </>)
                  : isGenerating ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中... </>)
                  : isLoading ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 準備中... </>) // Generic loading
                  : (<> <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> 生成會議記錄 </>)}
                </span>
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        {/* Output Card */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  會議記錄
                </span>
                <div className="flex items-center space-x-2">
                  <motion.div
                    whileHover={{ scale: !meetingRecord || isLoading || isCopied ? 1 : 1.05 }}
                    whileTap={{ scale: !meetingRecord || isLoading || isCopied ? 1 : 0.95 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyRecord}
                      disabled={!meetingRecord || isLoading || isCopied}
                      className="transition-all disabled:opacity-50"
                    >
                      {isCopied ? (
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="flex items-center"
                        >
                          <Check className="mr-2 h-4 w-4 text-green-600" />
                          已複製
                        </motion.div>
                      ) : (
                        <>
                          <ClipboardCopy className="mr-2 h-4 w-4" />
                          複製內容
                        </>
                      )}
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: !meetingRecord || isLoading || isExporting ? 1 : 1.05 }}
                    whileTap={{ scale: !meetingRecord || isLoading || isExporting ? 1 : 0.95 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportToGoogleDocs}
                      disabled={!meetingRecord || isLoading || isExporting || !googleAccessToken}
                      className="transition-all disabled:opacity-50"
                    >
                      {isExporting ? (
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="flex items-center"
                        >
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          匯出中...
                        </motion.div>
                      ) : googleAccessToken ? (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          匯出至 Google Docs
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 h-4 w-4 opacity-50" />
                          需登入 Google
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <motion.div
                className="min-h-[300px] p-4 bg-muted/40 rounded-lg whitespace-pre-wrap overflow-x-auto border border-border/50 transition-all duration-300"
                animate={{
                  boxShadow: isGenerating ? "0 0 0 2px rgba(var(--primary), 0.2)" : "none"
                }}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-3/4 mt-6" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                    </motion.div>
                  ) : meetingRecord ? (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      // Apply prose styles for better markdown rendering
                      className="prose dark:prose-invert max-w-none"
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        // Use the defined components object
                        components={markdownComponents}
                      >
                        {meetingRecord}
                      </ReactMarkdown>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground"
                    >
                      <FileText className="w-12 h-12 mb-3 opacity-20" />
                      <p>請先上傳音檔並填寫資訊，<br/>點擊生成按鈕後，<br/>會議記錄將顯示於此。</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-xs text-muted-foreground mt-10"
      >
        © {new Date().getFullYear()} Vibe Coding by Max. 使用 Gemini 2.5 Pro 進行會議記錄生成 。
      </motion.footer>
    </motion.main>
  )
}
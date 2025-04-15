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
  MicVocal,
  PenLine,
  Sparkles,
  UploadCloud,
  Users,
  X
} from "lucide-react"
import { useCallback, useState } from 'react'
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
        className="flex justify-end mb-2"
      >
        <UserInfo className="px-4 py-2 bg-card rounded-full shadow-sm" />
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
          <CardHeader className="bg-muted/30">
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
            <CardHeader className="bg-muted/30">
              <CardTitle className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  會議記錄
                </span>
                <motion.div
                  whileHover={{ scale: !meetingRecord || isLoading || isCopied ? 1 : 1.05 }}
                  whileTap={{ scale: !meetingRecord || isLoading || isCopied ? 1 : 0.95 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyRecord}
                    disabled={!meetingRecord || isLoading || isCopied}
                    className="transition-all"
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
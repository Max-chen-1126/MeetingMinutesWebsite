// src/hooks/api/useMinutesQuery.ts
'use client'

import { useMutation } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

interface GenerateMinutesParams {
  fileName: string;
  meetingName: string;
  meetingDate: string;
  participants: string;
  additionalInfo: string;
}

interface GenerateMinutesResult {
  meetingMinutes: string;
}

interface UploadUrlParams {
  fileName: string;
  contentType: string;
}

interface UploadUrlResult {
  uploadUrl: string;
  fileName: string;
}

/**
 * 生成上傳 URL 的 Mutation Hook
 */
export function useGenerateUploadUrl() {
  return useMutation({
    mutationFn: async (params: UploadUrlParams): Promise<UploadUrlResult> => {
      const response = await fetch('/api/generate-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '無法取得上傳 URL');
      }

      return response.json();
    },
  });
}

/**
 * 上傳檔案到 GCS 的 Hook（帶進度追蹤）
 */
export function useUploadToGCS() {
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = useCallback(async (
    file: File,
    uploadUrl: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 追蹤上傳進度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      // 上傳完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
          resolve();
        } else {
          reject(new Error(`上傳失敗: ${xhr.status}`));
        }
      });

      // 上傳錯誤
      xhr.addEventListener('error', () => {
        reject(new Error('網路錯誤'));
      });

      // 上傳中斷
      xhr.addEventListener('abort', () => {
        reject(new Error('上傳已取消'));
      });

      // 開始上傳
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }, []);

  const reset = useCallback(() => {
    setUploadProgress(0);
  }, []);

  return {
    uploadFile,
    uploadProgress,
    reset,
  };
}

/**
 * 生成會議記錄的 Mutation Hook
 */
export function useGenerateMinutes() {
  return useMutation({
    mutationFn: async (params: GenerateMinutesParams): Promise<GenerateMinutesResult> => {
      const response = await fetch('/api/generate-minutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成會議記錄失敗');
      }

      return response.json();
    },

    // 設定較長的超時時間（因為 AI 處理需要時間）
    retry: 1,
    retryDelay: 2000,
  });
}

/**
 * 完整的會議記錄處理流程
 */
export function useProcessMeetingMinutes() {
  const generateUploadUrl = useGenerateUploadUrl();
  const { uploadFile, uploadProgress, reset: resetUpload } = useUploadToGCS();
  const generateMinutes = useGenerateMinutes();

  const [currentStep, setCurrentStep] = useState<
    'idle' | 'uploading' | 'generating' | 'completed' | 'error'
  >('idle');

  const processFile = useCallback(
    async (
      file: File,
      meetingInfo: {
        meetingName: string;
        meetingDate: string;
        participants: string;
        additionalInfo: string;
      }
    ) => {
      try {
        // 重置狀態
        resetUpload();
        setCurrentStep('uploading');

        // 1. 取得上傳 URL
        const { uploadUrl, fileName } = await generateUploadUrl.mutateAsync({
          fileName: file.name,
          contentType: file.type,
        });

        // 2. 上傳檔案到 GCS
        await uploadFile(file, uploadUrl);

        // 3. 生成會議記錄
        setCurrentStep('generating');
        const result = await generateMinutes.mutateAsync({
          fileName,
          ...meetingInfo,
        });

        setCurrentStep('completed');
        return result;

      } catch (error) {
        setCurrentStep('error');
        throw error;
      }
    },
    [generateUploadUrl, uploadFile, generateMinutes, resetUpload]
  );

  const reset = useCallback(() => {
    setCurrentStep('idle');
    resetUpload();
  }, [resetUpload]);

  return {
    processFile,
    currentStep,
    uploadProgress,
    isLoading:
      generateUploadUrl.isPending ||
      generateMinutes.isPending ||
      currentStep === 'uploading',
    isUploading: currentStep === 'uploading',
    isGenerating: currentStep === 'generating',
    error:
      generateUploadUrl.error ||
      generateMinutes.error,
    reset,
  };
}

// src/hooks/api/useDocsQuery.ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ExportToDocsParams {
  markdownContent: string;
  title: string;
}

interface ExportToDocsResult {
  documentId: string;
  documentUrl: string;
  method?: string;
}

/**
 * 匯出到 Google Docs 的 Mutation Hook
 */
export function useExportToDocs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ExportToDocsParams): Promise<ExportToDocsResult> => {
      const response = await fetch('/api/export-to-docs-secure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '匯出失敗');
      }

      return response.json();
    },

    onSuccess: (data) => {
      console.log('匯出成功:', data.documentUrl);
      // 可以在這裡更新相關快取或顯示通知
    },

    onError: (error) => {
      console.error('匯出失敗:', error);

      // 如果是 401 錯誤，清除 OAuth 狀態快取
      if (error instanceof Error && error.message.includes('401')) {
        queryClient.invalidateQueries({ queryKey: ['auth', 'oauth'] });
      }
    },

    // 重試設定
    retry: (failureCount, error) => {
      // 401/403 錯誤不重試
      if (error instanceof Error && (
        error.message.includes('401') ||
        error.message.includes('403')
      )) {
        return false;
      }

      // 其他錯誤最多重試 1 次
      return failureCount < 1;
    },

    retryDelay: 1000,
  });
}

// src/lib/query-client.ts
'use client'

import { QueryClient } from '@tanstack/react-query';

/**
 * 建立 React Query Client 設定
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 資料視為新鮮的時間（30 秒）
        staleTime: 30 * 1000,

        // 快取時間（5 分鐘）
        gcTime: 5 * 60 * 1000,

        // 自動重試設定
        retry: (failureCount, error) => {
          // 特定錯誤不重試
          if (error instanceof Error) {
            if (
              error.message.includes('401') ||
              error.message.includes('403') ||
              error.message.includes('invalid_grant')
            ) {
              return false;
            }
          }

          // 最多重試 2 次
          return failureCount < 2;
        },

        // 重試延遲（exponential backoff）
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // 視窗獲得焦點時重新取得資料
        refetchOnWindowFocus: false,

        // 網路重新連線時重新取得資料
        refetchOnReconnect: true,

        // 元件掛載時重新取得資料
        refetchOnMount: true,
      },
      mutations: {
        // Mutation 重試設定
        retry: 1,

        // 重試延遲
        retryDelay: 1000,
      },
    },
  });
}

// 建立全域 Query Client（瀏覽器環境）
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  // 伺服器端：總是建立新的 client
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }

  // 瀏覽器端：使用單例
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

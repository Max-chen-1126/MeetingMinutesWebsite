'use client'

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthCallback() {
  const router = useRouter();
  const hasProcessed = useRef(false); // 防止重複執行

  useEffect(() => {
    // 避免 React Strict Mode 導致重複執行
    if (hasProcessed.current) {
      console.log('已經處理過授權回調，跳過');
      return;
    }

    const handleCallback = async () => {
      try {
        // 從 URL 中獲取授權碼
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          console.error('OAuth 錯誤:', error);
          // 重定向回首頁並顯示錯誤
          router.push('/?error=' + encodeURIComponent('Google 授權失敗'));
          return;
        }

        if (!code) {
          console.error('未收到授權碼');
          router.push('/?error=' + encodeURIComponent('未收到授權碼'));
          return;
        }

        // 標記為已處理（在發送請求之前）
        hasProcessed.current = true;
        console.log('開始處理授權碼...');

        // 將授權碼交換為 access token
        const tokenResponse = await fetch('/api/auth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code })
        });

        const tokenData = await tokenResponse.json();

        if (tokenResponse.ok && tokenData.user) {
          // 成功取得使用者資料，重定向回首頁
          console.log('授權成功，重定向至首頁');
          router.push('/');
        } else {
          console.error('獲取使用者資料失敗:', tokenData.error);
          router.push('/?error=' + encodeURIComponent('獲取 Google 授權失敗'));
        }
      } catch (error) {
        console.error('處理授權回調失敗:', error);
        router.push('/?error=' + encodeURIComponent('處理授權回調失敗'));
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto mt-20 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              AI 會議記錄生成器
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6 py-8">
              {/* 雙層載入動畫 */}
              <div className="relative w-16 h-16">
                {/* 外層灰色圓環 */}
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                {/* 內層漸層旋轉圓環 */}
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600 border-r-indigo-600"></div>
                {/* 脈動效果 */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 animate-pulse"></div>
              </div>

              {/* 狀態文字 */}
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-gray-800">
                  正在處理 Google 授權
                </h2>
                <p className="text-sm text-gray-600">
                  授權完成後將自動返回主頁面...
                </p>
                <div className="flex items-center justify-center gap-1 mt-4">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

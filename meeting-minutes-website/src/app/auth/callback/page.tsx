'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">處理 Google 授權中...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  );
}
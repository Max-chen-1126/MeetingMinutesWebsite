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

        if (tokenResponse.ok && tokenData.access_token) {
          // 將完整的 token 資訊存儲在 localStorage
          const tokenInfo = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at,
            token_type: tokenData.token_type || 'Bearer'
          };
          localStorage.setItem('googleTokenInfo', JSON.stringify(tokenInfo));
          
          // 為了向後相容，也保存 access_token
          localStorage.setItem('googleAccessToken', tokenData.access_token);
          
          // 重定向回首頁
          router.push('/');
        } else {
          console.error('獲取 access token 失敗:', tokenData.error);
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
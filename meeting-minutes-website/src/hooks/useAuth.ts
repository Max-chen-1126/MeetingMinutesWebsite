// src/hooks/useAuth.ts
'use client'

import { useState, useEffect, useCallback } from 'react';

export interface User {
  name: string;
  email: string;
  picture: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // 檢查認證狀態
  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/auth/verify', {
        credentials: 'include' // 包含 HttpOnly cookies
      });
      
      const data = await response.json();
      
      if (data.authenticated && data.user) {
        setAuthState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: data.error || null
        });
      }
    } catch (error) {
      console.error('檢查認證狀態失敗:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: '無法檢查認證狀態'
      });
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('登出失敗:', error);
    }
  }, []);

  // 開始 Google OAuth 流程
  const initiateGoogleLogin = useCallback(() => {
    // 這個邏輯保持不變，因為需要重定向到 Google
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      setAuthState(prev => ({ 
        ...prev, 
        error: 'Google Client ID 未設定' 
      }));
      return;
    }

    const redirectUri = `${baseUrl}/auth/callback`;
    const scope = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    
    const authUrl = 
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `state=${encodeURIComponent('meeting_minutes')}`;

    window.location.href = authUrl;
  }, []);

  // 清除錯誤
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // 初始化時檢查認證狀態
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // 處理 URL 錯誤參數
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      setAuthState(prev => ({ 
        ...prev, 
        error: decodeURIComponent(errorParam) 
      }));
      
      // 清除 URL 參數
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return {
    ...authState,
    login: initiateGoogleLogin,
    logout,
    checkAuthStatus,
    clearError
  };
}
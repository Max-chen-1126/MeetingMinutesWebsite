// src/hooks/useAuth.ts
'use client'

import { useState, useEffect, useCallback } from 'react';
import { AuthState, IAPUser, OAuthUser } from '@/types/auth';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    iapUser: null,
    isIAPAuthenticated: false,
    oauthUser: null,
    isOAuthAuthenticated: false,
    hasDocsPermission: false,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    isConfigLoading: true,
    error: null,
    oauthConfig: null
  });

  // 檢查 IAP 認證狀態
  const checkIAPStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/iap-verify', {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.authenticated && data.user) {
        const iapUser: IAPUser = {
          email: data.user.email,
          name: data.user.name,
          picture: data.user.picture,
          sub: data.user.sub
        };

        setAuthState(prev => ({
          ...prev,
          iapUser,
          isIAPAuthenticated: true,
          // 如果沒有 OAuth 使用者，使用 IAP 使用者資訊
          user: prev.oauthUser ? prev.user : {
            email: iapUser.email,
            name: iapUser.name || iapUser.email.split('@')[0],
            picture: iapUser.picture || '',
            source: 'iap'
          },
          isAuthenticated: true
        }));

        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          iapUser: null,
          isIAPAuthenticated: false
        }));
        return false;
      }
    } catch (error) {
      console.error('檢查 IAP 狀態失敗:', error);
      setAuthState(prev => ({
        ...prev,
        iapUser: null,
        isIAPAuthenticated: false
      }));
      return false;
    }
  }, []);

  // 檢查 OAuth 認證狀態
  const checkOAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.authenticated && data.user) {
        const oauthUser: OAuthUser = {
          name: data.user.name,
          email: data.user.email,
          picture: data.user.picture
        };

        setAuthState(prev => ({
          ...prev,
          oauthUser,
          isOAuthAuthenticated: true,
          hasDocsPermission: true,
          // OAuth 使用者資訊優先於 IAP
          user: {
            email: oauthUser.email,
            name: oauthUser.name,
            picture: oauthUser.picture,
            source: 'oauth'
          },
          isAuthenticated: true,
          error: null
        }));

        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          oauthUser: null,
          isOAuthAuthenticated: false,
          hasDocsPermission: false
        }));
        return false;
      }
    } catch (error) {
      console.error('檢查 OAuth 狀態失敗:', error);
      setAuthState(prev => ({
        ...prev,
        oauthUser: null,
        isOAuthAuthenticated: false,
        hasDocsPermission: false
      }));
      return false;
    }
  }, []);

  // 統一檢查認證狀態
  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // 並行檢查 IAP 和 OAuth 狀態
      const [hasIAP, hasOAuth] = await Promise.all([
        checkIAPStatus(),
        checkOAuthStatus()
      ]);

      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        isAuthenticated: hasIAP || hasOAuth
      }));

    } catch (error) {
      console.error('檢查認證狀態失敗:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: '無法檢查認證狀態'
      }));
    }
  }, [checkIAPStatus, checkOAuthStatus]);

  // 登出（清除 OAuth，但保留 IAP）
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      setAuthState(prev => ({
        ...prev,
        oauthUser: null,
        isOAuthAuthenticated: false,
        hasDocsPermission: false,
        // 如果有 IAP 使用者，恢復使用 IAP 資訊
        user: prev.iapUser ? {
          email: prev.iapUser.email,
          name: prev.iapUser.name || prev.iapUser.email.split('@')[0],
          picture: prev.iapUser.picture || '',
          source: 'iap'
        } : null,
        isAuthenticated: prev.isIAPAuthenticated,
        error: null
      }));

    } catch (error) {
      console.error('登出失敗:', error);
    }
  }, []);

  // 載入 OAuth 設定
  const loadOAuthConfig = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isConfigLoading: true, error: null }));

      console.log('正在載入 OAuth 設定...');
      const response = await fetch('/api/auth/config');
      const data = await response.json();

      if (response.ok && data.success) {
        console.log('OAuth 設定載入成功:', {
          hasClientId: !!data.clientId,
          baseUrl: data.baseUrl
        });

        setAuthState(prev => ({
          ...prev,
          oauthConfig: {
            clientId: data.clientId,
            baseUrl: data.baseUrl
          },
          isConfigLoading: false
        }));
      } else {
        throw new Error(data.error || '載入 OAuth 設定失敗');
      }
    } catch (error) {
      console.error('載入 OAuth 設定失敗:', error);
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '無法載入 OAuth 設定',
        isConfigLoading: false
      }));
    }
  }, []);

  // 開始 Google OAuth 流程（僅用於 Docs 權限）
  const requestDocsPermission = useCallback(() => {
    if (!authState.oauthConfig) {
      setAuthState(prev => ({
        ...prev,
        error: 'OAuth 設定尚未載入，請稍後再試'
      }));
      return;
    }

    const { clientId, baseUrl } = authState.oauthConfig;

    if (!clientId) {
      setAuthState(prev => ({
        ...prev,
        error: 'Google Client ID 未設定'
      }));
      return;
    }

    console.log('啟動 Google OAuth 流程（Docs 權限）:', {
      clientId: clientId.substring(0, 20) + '...',
      baseUrl
    });

    const redirectUri = `${baseUrl}/auth/callback`;
    // 請求 Docs、Drive 和使用者資料權限
    const scope = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent&` + // 強制顯示授權畫面
      `state=${encodeURIComponent('docs_permission')}`;

    console.log('重定向到 Google OAuth:', redirectUri);
    window.location.href = authUrl;
  }, [authState.oauthConfig]);

  // 清除錯誤
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // 初始化時載入 OAuth 設定
  useEffect(() => {
    loadOAuthConfig();
  }, [loadOAuthConfig]);

  // OAuth 設定載入完成後檢查認證狀態
  useEffect(() => {
    if (!authState.isConfigLoading && authState.oauthConfig) {
      checkAuthStatus();
    }
  }, [authState.isConfigLoading, authState.oauthConfig, checkAuthStatus]);

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
    // 重新命名方法以更清楚
    login: requestDocsPermission, // 向後兼容
    requestDocsPermission,
    logout,
    checkAuthStatus,
    checkIAPStatus,
    checkOAuthStatus,
    clearError,
    loadOAuthConfig
  };
}

// src/types/auth.ts

/**
 * IAP 使用者資訊（從 IAP JWT 提取）
 */
export interface IAPUser {
  email: string;
  name?: string;
  picture?: string;
  sub: string; // Google User ID
}

/**
 * OAuth 使用者資訊（用於 Google Docs 權限）
 */
export interface OAuthUser {
  name: string;
  email: string;
  picture: string;
}

/**
 * 統一的使用者資訊介面
 */
export interface User {
  email: string;
  name: string;
  picture: string;
  source: 'iap' | 'oauth'; // 資料來源
}

/**
 * OAuth 設定
 */
export interface OAuthConfig {
  clientId: string;
  baseUrl: string;
}

/**
 * 認證狀態
 */
export interface AuthState {
  // IAP 相關
  iapUser: IAPUser | null;
  isIAPAuthenticated: boolean;

  // OAuth 相關
  oauthUser: OAuthUser | null;
  isOAuthAuthenticated: boolean;
  hasDocsPermission: boolean;

  // 統一使用者資訊（優先使用 OAuth，否則使用 IAP）
  user: User | null;
  isAuthenticated: boolean;

  // 載入狀態
  isLoading: boolean;
  isConfigLoading: boolean;

  // 錯誤
  error: string | null;

  // OAuth 設定
  oauthConfig: OAuthConfig | null;
}

/**
 * IAP JWT Payload 結構
 */
export interface IAPJWTPayload {
  iss: string;
  sub: string;
  email: string;
  aud: string;
  exp: number;
  iat: number;
  hd?: string; // Hosted domain
}

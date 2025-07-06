// src/lib/oauth-config.ts
import { getSecret } from './secrets';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

/**
 * 取得 OAuth 設定
 * 根據環境自動選擇從 Secret Manager 或環境變數讀取
 */
export async function getOAuthConfig(): Promise<OAuthConfig> {
  // 判斷是否在生產環境
  const isProduction = process.env.GOOGLE_CLOUD_PROJECT && 
                       process.env.NODE_ENV === 'production' ||
                       process.env.DEPLOYMENT_ENV === 'production';
  
  let clientId: string;
  let clientSecret: string;
  let baseUrl: string;
  
  if (isProduction) {
    // 生產環境：從 Secret Manager 讀取
    try {
      clientId = await getSecret('google-oauth-client-id');
      clientSecret = await getSecret('google-oauth-client-secret');
      baseUrl = await getSecret('google-oauth-base-url');
    } catch (error) {
      console.error('從 Secret Manager 讀取憑證失敗:', error);
      throw new Error('無法讀取 OAuth 設定');
    }
  } else {
    // 開發環境：從環境變數讀取
    clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth 設定不完整');
  }
  
  return {
    clientId,
    clientSecret,
    baseUrl
  };
}
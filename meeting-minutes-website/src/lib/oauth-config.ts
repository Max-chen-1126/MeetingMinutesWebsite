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
  // 判斷是否使用 Secret Manager
  // 1. 明確設定 USE_SECRET_MANAGER=true 時強制使用
  // 2. 生產環境自動使用
  const useSecretManager = process.env.USE_SECRET_MANAGER === 'true' ||
                           (process.env.GOOGLE_CLOUD_PROJECT &&
                            (process.env.NODE_ENV === 'production' ||
                             process.env.DEPLOYMENT_ENV === 'production'));

  let clientId: string;
  let clientSecret: string;
  let baseUrl: string;

  if (useSecretManager) {
    // 從 Secret Manager 讀取
    console.log('使用 Secret Manager 讀取 OAuth 設定');
    try {
      clientId = await getSecret('google-oauth-client-id');
      clientSecret = await getSecret('google-oauth-client-secret');
      baseUrl = await getSecret('google-oauth-base-url');
    } catch (error) {
      console.error('從 Secret Manager 讀取憑證失敗:', error);
      throw new Error('無法讀取 OAuth 設定');
    }
  } else {
    // 從環境變數讀取
    console.log('使用環境變數讀取 OAuth 設定');
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
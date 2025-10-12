// src/lib/token-manager.ts
import { OAuth2Client } from 'google-auth-library';
import { getOAuthConfig } from './oauth-config';
import { decrypt } from './crypto';
import tokenCache, { generateCacheKey } from './token-cache';

export interface GoogleTokens {
  access_token: string;
  expires_at: number;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

/**
 * Exponential backoff 重試函數
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 不重試特定錯誤
      if (
        lastError.message.includes('invalid_grant') ||
        lastError.message.includes('Invalid Credentials')
      ) {
        throw lastError;
      }

      // 如果不是最後一次嘗試，等待後重試
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`重試 ${attempt + 1}/${maxRetries}，等待 ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('重試失敗');
}

/**
 * 從加密的 refresh token 取得新的 access token
 * @param encryptedRefreshToken 加密的 refresh token
 * @returns 新的 access token 和過期時間
 */
export async function refreshAccessToken(encryptedRefreshToken: string): Promise<GoogleTokens> {
  return retryWithBackoff(async () => {
    try {
      // 解密 refresh token
      const refreshToken = await decrypt(encryptedRefreshToken);

      // 取得 OAuth 設定
      const oauthConfig = await getOAuthConfig();

      const oauth2Client = new OAuth2Client(
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        `${oauthConfig.baseUrl}/auth/callback`
      );

      // 設置 refresh token
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      // 刷新 access token
      console.log('正在刷新 access token...');
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('無法取得新的 access token');
      }

      // 計算過期時間戳
      const expiresAt = credentials.expiry_date || (Date.now() + 3600 * 1000);

      console.log(`Access token 刷新成功，過期時間: ${new Date(expiresAt).toISOString()}`);

      // 儲存到快取
      const cacheKey = generateCacheKey(encryptedRefreshToken);
      tokenCache.set(cacheKey, credentials.access_token, expiresAt, encryptedRefreshToken);

      return {
        access_token: credentials.access_token,
        expires_at: expiresAt
      };
    } catch (error) {
      console.error('刷新 access token 失敗:', error);

      // 如果刷新失敗，從快取中移除
      const cacheKey = generateCacheKey(encryptedRefreshToken);
      tokenCache.delete(cacheKey);

      throw new Error('無法刷新存取權杖');
    }
  });
}

/**
 * 取得使用者的 Google 個人資料
 * @param accessToken 有效的 access token
 * @returns 使用者資料
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  return retryWithBackoff(async () => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Google API 錯誤: ${response.status}`);
      }

      const userInfo = await response.json();

      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      };
    } catch (error) {
      console.error('取得使用者資料失敗:', error);
      throw new Error('無法取得使用者資料');
    }
  });
}

/**
 * 驗證並取得有效的 access token
 * 優先使用快取，只有在需要時才刷新
 * @param encryptedRefreshToken 加密的 refresh token
 * @returns 有效的 access token
 */
export async function getValidAccessToken(encryptedRefreshToken: string): Promise<string> {
  try {
    const cacheKey = generateCacheKey(encryptedRefreshToken);

    // 1. 檢查快取
    const cachedToken = tokenCache.get(cacheKey);

    if (cachedToken && cachedToken.accessToken) {
      console.log('使用快取的 access token');
      return cachedToken.accessToken;
    }

    // 2. 快取未命中或過期，刷新 token
    console.log('快取未命中，刷新 access token...');
    const tokens = await refreshAccessToken(encryptedRefreshToken);
    return tokens.access_token;

  } catch (error) {
    console.error('取得有效 access token 失敗:', error);
    throw new Error('無法取得有效的存取權杖');
  }
}

/**
 * 從加密的 refresh token 直接取得使用者資料
 * @param encryptedRefreshToken 加密的 refresh token
 * @returns 使用者資料
 */
export async function getUserInfoFromRefreshToken(encryptedRefreshToken: string): Promise<GoogleUserInfo> {
  try {
    // 取得有效的 access token（使用快取）
    const accessToken = await getValidAccessToken(encryptedRefreshToken);

    // 取得使用者資料
    return await getUserInfo(accessToken);
  } catch (error) {
    console.error('從 refresh token 取得使用者資料失敗:', error);
    throw new Error('無法驗證使用者身份');
  }
}

/**
 * 使快取的 token 失效
 * @param encryptedRefreshToken 加密的 refresh token
 */
export function invalidateToken(encryptedRefreshToken: string): void {
  const cacheKey = generateCacheKey(encryptedRefreshToken);
  tokenCache.delete(cacheKey);
  console.log('Token 已失效');
}

/**
 * 取得快取統計資訊
 */
export function getTokenCacheStats() {
  return tokenCache.getStats();
}

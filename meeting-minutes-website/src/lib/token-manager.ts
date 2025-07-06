// src/lib/token-manager.ts
import { OAuth2Client } from 'google-auth-library';
import { getOAuthConfig } from './oauth-config';
import { decrypt } from './crypto';

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
 * 從加密的 refresh token 取得新的 access token
 * @param encryptedRefreshToken 加密的 refresh token
 * @returns 新的 access token 和過期時間
 */
export async function refreshAccessToken(encryptedRefreshToken: string): Promise<GoogleTokens> {
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
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('無法取得新的 access token');
    }
    
    // 計算過期時間戳
    const expiresAt = credentials.expiry_date || (Date.now() + 3600 * 1000);
    
    return {
      access_token: credentials.access_token,
      expires_at: expiresAt
    };
  } catch (error) {
    console.error('刷新 access token 失敗:', error);
    throw new Error('無法刷新存取權杖');
  }
}

/**
 * 取得使用者的 Google 個人資料
 * @param accessToken 有效的 access token
 * @returns 使用者資料
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
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
}

/**
 * 驗證並取得有效的 access token
 * 如果 token 過期，會自動刷新
 * @param encryptedRefreshToken 加密的 refresh token
 * @returns 有效的 access token
 */
export async function getValidAccessToken(encryptedRefreshToken: string): Promise<string> {
  try {
    // 取得新的 access token（每次都刷新以確保最新）
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
    // 取得有效的 access token
    const accessToken = await getValidAccessToken(encryptedRefreshToken);
    
    // 取得使用者資料
    return await getUserInfo(accessToken);
  } catch (error) {
    console.error('從 refresh token 取得使用者資料失敗:', error);
    throw new Error('無法驗證使用者身份');
  }
}
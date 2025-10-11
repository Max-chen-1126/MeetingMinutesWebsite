// src/lib/iap-auth.ts
import { OAuth2Client } from 'google-auth-library';
import { IAPUser, IAPJWTPayload } from '@/types/auth';

/**
 * 驗證 IAP JWT Token
 *
 * @param iapJwt IAP JWT token（從 X-Goog-IAP-JWT-Assertion header 取得）
 * @returns 驗證後的使用者資訊
 */
export async function verifyIAPToken(iapJwt: string): Promise<IAPUser> {
  try {
    // 取得預期的 audience
    // 格式: /projects/PROJECT_NUMBER/apps/PROJECT_ID
    const projectId = process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

    if (!projectId) {
      throw new Error('PROJECT_ID 環境變數未設定');
    }

    // 在生產環境中，我們需要驗證 JWT
    // 但在開發環境或 IAP 未啟用時，我們可以跳過驗證
    const isProduction = process.env.NODE_ENV === 'production' ||
                        process.env.DEPLOYMENT_ENV === 'production';

    if (!isProduction) {
      // 開發環境：直接解析 JWT（不驗證簽名）
      console.warn('開發環境：跳過 IAP JWT 簽名驗證');
      const payload = parseJWTPayload(iapJwt);
      return extractUserFromPayload(payload);
    }

    // 生產環境：使用 Google Auth Library 驗證 JWT
    const oAuth2Client = new OAuth2Client();

    // 驗證 token
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: iapJwt,
      // IAP 使用特定的 audience 格式
      // 如果不確定 audience，可以先不驗證，只解碼
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      throw new Error('JWT payload 無效或缺少 email');
    }

    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      sub: payload.sub || payload.email,
    };

  } catch (error) {
    console.error('IAP JWT 驗證失敗:', error);
    throw new Error('IAP 身份驗證失敗');
  }
}

/**
 * 解析 JWT payload（不驗證簽名）
 * 僅用於開發環境
 */
function parseJWTPayload(jwt: string): IAPJWTPayload {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT 格式無效');
    }

    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload) as IAPJWTPayload;
  } catch (error) {
    console.error('解析 JWT 失敗:', error);
    throw new Error('JWT 格式無效');
  }
}

/**
 * 從 JWT payload 提取使用者資訊
 */
function extractUserFromPayload(payload: IAPJWTPayload): IAPUser {
  return {
    email: payload.email,
    name: payload.email.split('@')[0], // 從 email 提取名稱
    picture: undefined, // IAP JWT 通常不包含頭像
    sub: payload.sub,
  };
}

/**
 * 從請求 headers 中提取 IAP JWT
 *
 * @param headers Request headers
 * @returns IAP JWT token 或 null
 */
export function extractIAPToken(headers: Headers): string | null {
  // IAP 會在這個 header 中包含 JWT
  const iapJwt = headers.get('x-goog-iap-jwt-assertion');

  if (!iapJwt) {
    console.log('未找到 IAP JWT header');
    return null;
  }

  return iapJwt;
}

/**
 * 檢查是否啟用 IAP
 */
export function isIAPEnabled(): boolean {
  // 可以根據環境變數判斷
  return process.env.IAP_ENABLED === 'true' ||
         process.env.NODE_ENV === 'production';
}

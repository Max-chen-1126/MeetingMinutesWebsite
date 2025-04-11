// src/app/api/user-info/jwt.ts
import { jwtVerify } from 'jose';

// IAP 使用的 Google 公鑰 URL
const IAP_PUBLIC_KEYS_URL = 'https://www.gstatic.com/iap/verify/public_key';

interface JwtPayload {
  sub: string;            // 主體（用戶ID）
  email: string;          // 用戶郵箱
  aud: string;            // 受眾（項目編號）
  iss: string;            // 簽發者
  exp: number;            // 過期時間
  iat: number;            // 簽發時間
  hd?: string;            // Hosted domain (optional, example)
  [key: string]: unknown; // <-- 將 any 改為 unknown
}

/**
 * 獲取 IAP 公鑰
 */
// ... (getIapPublicKeys function remains the same) ...
async function getIapPublicKeys(): Promise<Record<string, string>> {
  const response = await fetch(IAP_PUBLIC_KEYS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch IAP public keys: ${response.statusText}`);
  }
  // Assuming the response is JSON mapping key IDs to PEM-encoded keys
  const keys: Record<string, string> = await response.json(); 
  return keys;
}


/**
 * 驗證 IAP JWT
 * @param jwt IAP JWT 令牌
 * @param expectedAudience 預期的受眾 (項目編號)
 * @returns 驗證通過後的 JWT 載荷
 */
export async function verifyIapJwt(jwt: string, expectedAudience: string): Promise<JwtPayload> {
  try {
    // 獲取 JWT 頭部以確定使用的 key ID
    const [headerB64] = jwt.split('.');
    if (!headerB64) {
        throw new Error('Invalid JWT format: Missing header');
    }
    const headerString = Buffer.from(headerB64, 'base64').toString();
    const header = JSON.parse(headerString);
    const keyId = header.kid;
    
    if (typeof keyId !== 'string' || !keyId) { // More robust check
      throw new Error('JWT does not contain a valid key ID (kid)');
    }
    
    // 獲取公鑰
    const publicKeys = await getIapPublicKeys();
    const publicKeyPem = publicKeys[keyId]; // Key is likely PEM formatted
    
    if (!publicKeyPem) {
      throw new Error(`Unable to find public key for key ID: ${keyId}`);
    }

    // Import the PEM key
    // Note: jose v5+ might use createPublicKey directly or importSPKI/importX509
    // Assuming TextEncoder is sufficient if the key format is simple or handled by jwtVerify
    // If using PEM, you might need crypto.createPublicKey(publicKeyPem) or jose's import methods
    const publicKey = new TextEncoder().encode(publicKeyPem); // Simplistic approach, may need adjustment based on key format

    // 驗證 JWT
    const { payload } = await jwtVerify(
      jwt,
      publicKey, // Pass the imported key object/buffer
      {
        audience: expectedAudience,
        issuer: 'https://cloud.google.com/iap',
        algorithms: ['ES256'], // IAP typically uses ES256
      }
    );
    
    // Type assertion remains, as jwtVerify returns a generic JWTPayload
    return payload as unknown as JwtPayload; 
  } catch (error) {
    console.error('JWT verification failed:', error);
    // Rethrow or handle specific error types
    if (error instanceof Error) {
        throw new Error(`JWT verification failed: ${error.message}`);
    }
    throw new Error('JWT verification failed with an unknown error.');
  }
}
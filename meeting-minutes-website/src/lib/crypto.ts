// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getSecret } from './secrets';

/**
 * 取得加密金鑰
 */
async function getEncryptionKey(): Promise<Buffer> {
  // 判斷是否在生產環境
  const isProduction = process.env.GOOGLE_CLOUD_PROJECT && 
                       process.env.NODE_ENV === 'production' ||
                       process.env.DEPLOYMENT_ENV === 'production';
  
  let encryptionKey: string;
  
  if (isProduction) {
    // 生產環境：從 Secret Manager 讀取
    try {
      encryptionKey = await getSecret('token-encryption-key');
    } catch (error) {
      console.error('無法從 Secret Manager 讀取加密金鑰:', error);
      throw new Error('無法讀取加密設定');
    }
  } else {
    // 開發環境：從環境變數讀取，如果沒有則使用預設值（僅開發用）
    encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'dev-key-32-chars-long-for-aes256!!';
  }
  
  if (!encryptionKey) {
    throw new Error('加密金鑰未設定');
  }
  
  // 檢查是否為 base64 編碼的金鑰（通常 base64 字串會包含 = 或 +/）
  let keyBuffer: Buffer;
  
  try {
    // 首先嘗試作為 base64 解碼
    if (encryptionKey.includes('=') || encryptionKey.includes('+') || encryptionKey.includes('/')) {
      keyBuffer = Buffer.from(encryptionKey, 'base64');
      console.log('使用 base64 解碼的加密金鑰');
    } else {
      // 如果不是 base64，直接作為 UTF-8 字串處理
      keyBuffer = Buffer.from(encryptionKey, 'utf8');
      console.log('使用 UTF-8 編碼的加密金鑰');
    }
  } catch {
    // 如果 base64 解碼失敗，回退到 UTF-8
    keyBuffer = Buffer.from(encryptionKey, 'utf8');
    console.log('base64 解碼失敗，使用 UTF-8 編碼的加密金鑰');
  }
  
  // 確保金鑰長度為 32 字節（AES-256 要求）
  if (keyBuffer.length < 32) {
    // 如果金鑰太短，用零填充到 32 字節
    const paddedKey = Buffer.alloc(32);
    keyBuffer.copy(paddedKey);
    keyBuffer = paddedKey;
    console.warn('加密金鑰長度不足，已填充到 32 字節');
  } else if (keyBuffer.length > 32) {
    // 如果金鑰太長，取前 32 字節
    keyBuffer = keyBuffer.subarray(0, 32);
    console.warn('加密金鑰過長，已截取前 32 字節');
  }
  
  return keyBuffer;
}

/**
 * 加密文字
 * @param text 要加密的文字
 * @returns 加密後的字串 (base64編碼)
 */
export async function encrypt(text: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const iv = randomBytes(16); // AES-GCM 需要 16 字元的 IV
    
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // 將 IV、authTag 和加密資料組合，並轉為 base64
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('加密失敗:', error);
    throw new Error('加密過程發生錯誤');
  }
}

/**
 * 解密文字
 * @param encryptedData 加密的資料 (base64編碼)
 * @returns 原始文字
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    
    // 分離 IV、authTag 和加密資料
    const iv = combined.subarray(0, 16);
    const authTag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('解密失敗:', error);
    throw new Error('解密過程發生錯誤');
  }
}

/**
 * 驗證加密字串格式是否正確
 * @param encryptedData 要驗證的加密資料
 * @returns 是否為有效格式
 */
export function isValidEncryptedData(encryptedData: string): boolean {
  try {
    const combined = Buffer.from(encryptedData, 'base64');
    // 最小長度：16 (IV) + 16 (authTag) + 1 (至少1字元的加密資料) = 33
    return combined.length >= 33;
  } catch {
    return false;
  }
}
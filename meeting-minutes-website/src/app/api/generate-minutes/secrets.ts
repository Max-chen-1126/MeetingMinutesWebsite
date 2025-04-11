// src/lib/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

/**
 * 從 Google Cloud Secret Manager 獲取機密
 * 
 * @param {string} secretName 機密的名稱，例如："google-api-key"
 * @returns {Promise<string>} 機密的值
 */
export async function getSecret(secretName: string): Promise<string> {
  try {
    // 使用應用默認憑證初始化 Secret Manager 客戶端
    const client = new SecretManagerServiceClient();
    
    // 獲取項目 ID，在 App Engine 中會自動設置
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    
    if (!projectId) {
      throw new Error('無法獲取項目 ID，請確保 GOOGLE_CLOUD_PROJECT 環境變數已設置');
    }
    
    // 構建完整的機密名稱
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    
    // 訪問機密
    const [version] = await client.accessSecretVersion({ name });
    
    // 將響應資料轉換為字符串
    if (!version.payload || !version.payload.data) {
      throw new Error(`無法獲取機密值: ${secretName}`);
    }
    
    return version.payload.data.toString();
  } catch (error) {
    console.error(`獲取機密 ${secretName} 失敗:`, error);
    throw error;
  }
}
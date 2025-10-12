// src/lib/token-cache.ts

/**
 * Token 快取項目
 */
interface TokenCacheItem {
  accessToken: string;
  expiresAt: number; // Unix timestamp (ms)
  refreshToken: string; // 加密的 refresh token
}

/**
 * 簡單的記憶體 Token 快取
 * 使用 Map 儲存，以使用者 email 或 refresh token hash 作為 key
 */
class TokenCache {
  private cache: Map<string, TokenCacheItem> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每 5 分鐘清理過期的 token
    this.startCleanupTimer();
  }

  /**
   * 儲存 access token
   */
  set(key: string, accessToken: string, expiresAt: number, refreshToken: string): void {
    this.cache.set(key, {
      accessToken,
      expiresAt,
      refreshToken
    });

    console.log(`Token 已快取: ${key.substring(0, 20)}...，過期時間: ${new Date(expiresAt).toISOString()}`);
  }

  /**
   * 取得快取的 access token
   * 如果 token 已過期或不存在，回傳 null
   */
  get(key: string): TokenCacheItem | null {
    const item = this.cache.get(key);

    if (!item) {
      console.log(`Token 快取未命中: ${key.substring(0, 20)}...`);
      return null;
    }

    // 檢查是否過期（提前 5 分鐘視為過期，以確保足夠時間使用）
    const bufferTime = 5 * 60 * 1000; // 5 分鐘
    const now = Date.now();

    if (now >= item.expiresAt - bufferTime) {
      console.log(`Token 已過期或即將過期: ${key.substring(0, 20)}...`);
      this.cache.delete(key);
      return null;
    }

    console.log(`Token 快取命中: ${key.substring(0, 20)}...，剩餘時間: ${Math.floor((item.expiresAt - now) / 1000 / 60)} 分鐘`);
    return item;
  }

  /**
   * 檢查 token 是否存在且有效
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 刪除指定的 token
   */
  delete(key: string): void {
    this.cache.delete(key);
    console.log(`Token 已從快取移除: ${key.substring(0, 20)}...`);
  }

  /**
   * 清除所有 token
   */
  clear(): void {
    this.cache.clear();
    console.log('所有 Token 快取已清除');
  }

  /**
   * 取得快取統計資訊
   */
  getStats(): { total: number; valid: number; expired: number } {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000;

    let valid = 0;
    let expired = 0;

    for (const item of this.cache.values()) {
      if (now >= item.expiresAt - bufferTime) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired
    };
  }

  /**
   * 清理過期的 token
   */
  private cleanup(): void {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000;
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now >= item.expiresAt - bufferTime) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Token 快取清理完成: 移除 ${cleaned} 個過期項目`);
    }
  }

  /**
   * 啟動定期清理計時器
   */
  private startCleanupTimer(): void {
    // 每 5 分鐘執行一次清理
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // 確保在 Node.js 關閉時清理計時器
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => {
        this.stopCleanupTimer();
      });
    }
  }

  /**
   * 停止清理計時器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 建立單例實例
const tokenCache = new TokenCache();

export default tokenCache;

/**
 * 從加密的 refresh token 生成快取 key
 * 使用簡單的 hash 函數（僅用於快取 key，不涉及安全）
 */
export function generateCacheKey(encryptedRefreshToken: string): string {
  // 簡單的 hash: 取前 32 個字元
  // 在實際應用中，可以使用 crypto.createHash 生成更安全的 hash
  return encryptedRefreshToken.substring(0, 32);
}

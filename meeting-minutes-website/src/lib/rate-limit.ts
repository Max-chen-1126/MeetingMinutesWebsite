// src/lib/rate-limit.ts

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * 簡單的記憶體 Rate Limiter
 * 使用 Token Bucket 演算法
 */
class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每分鐘清理過期的記錄
    this.startCleanup();
  }

  /**
   * 檢查是否超過速率限制
   * @param identifier 識別符（如 IP 位址或使用者 ID）
   * @param limit 限制次數
   * @param windowMs 時間窗口（毫秒）
   * @returns 是否允許請求
   */
  check(identifier: string, limit: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    // 如果沒有記錄或已過期，建立新記錄
    if (!entry || now >= entry.resetTime) {
      const resetTime = now + windowMs;
      this.requests.set(identifier, {
        count: 1,
        resetTime
      });

      return {
        allowed: true,
        remaining: limit - 1,
        resetTime
      };
    }

    // 檢查是否超過限制
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    // 增加計數
    entry.count++;
    this.requests.set(identifier, entry);

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * 重置指定識別符的速率限制
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * 清理過期的記錄
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.requests.entries()) {
      if (now >= entry.resetTime) {
        this.requests.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Rate limiter 清理完成: 移除 ${cleaned} 個過期記錄`);
    }
  }

  /**
   * 啟動定期清理
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // 每分鐘清理一次

    // 確保在 Node.js 關閉時清理計時器
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => {
        this.stopCleanup();
      });
    }
  }

  /**
   * 停止清理計時器
   */
  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 取得統計資訊
   */
  getStats(): { total: number; active: number } {
    const now = Date.now();
    let active = 0;

    for (const entry of this.requests.values()) {
      if (now < entry.resetTime) {
        active++;
      }
    }

    return {
      total: this.requests.size,
      active
    };
  }
}

// 建立單例實例
const rateLimiter = new RateLimiter();

export default rateLimiter;

/**
 * 預設的 Rate Limit 設定
 */
export const RATE_LIMITS = {
  // API 端點限制
  API: {
    limit: 100, // 100 次請求
    window: 15 * 60 * 1000 // 15 分鐘
  },

  // 認證端點限制（更嚴格）
  AUTH: {
    limit: 10, // 10 次請求
    window: 15 * 60 * 1000 // 15 分鐘
  },

  // 檔案上傳限制
  UPLOAD: {
    limit: 20, // 20 次請求
    window: 60 * 60 * 1000 // 1 小時
  },

  // 匯出限制
  EXPORT: {
    limit: 30, // 30 次請求
    window: 60 * 60 * 1000 // 1 小時
  },

  // 會議記錄生成限制（因為耗時較長）
  GENERATE: {
    limit: 10, // 10 次請求
    window: 60 * 60 * 1000 // 1 小時
  }
};

/**
 * 從請求中提取識別符（IP 或使用者 ID）
 */
export function getIdentifier(headers: Headers, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // 嘗試從各種 header 取得真實 IP
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare

  const ip = forwardedFor?.split(',')[0].trim() ||
             realIp ||
             cfConnectingIp ||
             'unknown';

  return `ip:${ip}`;
}

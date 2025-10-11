// src/app/api/monitoring/health/route.ts
import { NextResponse } from 'next/server';
import { getSystemHealth } from '@/lib/monitoring';
import { getTokenCacheStats } from '@/lib/token-manager';
import rateLimiter from '@/lib/rate-limit';

/**
 * 系統健康檢查端點
 *
 * GET /api/monitoring/health
 *
 * 回應系統整體健康狀態和各項指標
 */
export async function GET() {
  try {
    const systemHealth = getSystemHealth();
    const tokenCacheStats = getTokenCacheStats();
    const rateLimitStats = rateLimiter.getStats();

    return NextResponse.json({
      ...systemHealth,
      services: {
        tokenCache: {
          status: 'ok',
          stats: tokenCacheStats
        },
        rateLimit: {
          status: 'ok',
          stats: rateLimitStats
        }
      }
    });

  } catch (error) {
    console.error('健康檢查失敗:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : '未知錯誤',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

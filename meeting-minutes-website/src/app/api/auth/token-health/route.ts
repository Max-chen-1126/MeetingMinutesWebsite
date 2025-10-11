// src/app/api/auth/token-health/route.ts
import { NextResponse } from 'next/server';
import { getTokenCacheStats } from '@/lib/token-manager';

/**
 * Token 健康檢查端點
 *
 * GET /api/auth/token-health
 *
 * 回應: Token 快取統計資訊
 */
export async function GET() {
  try {
    const stats = getTokenCacheStats();

    return NextResponse.json({
      status: 'ok',
      cache: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token 健康檢查失敗:', error);

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}

// src/app/api/monitoring/metrics/route.ts
import { NextResponse } from 'next/server';
import monitor, { errorRateMonitor } from '@/lib/monitoring';

/**
 * 效能指標端點
 *
 * GET /api/monitoring/metrics
 *
 * 回應詳細的效能指標
 */
export async function GET() {
  try {
    const performanceStats = monitor.getAllStats();
    const errorRates = errorRateMonitor.getAllErrorRates();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      performance: performanceStats,
      errorRates: errorRates,
    });

  } catch (error) {
    console.error('取得指標失敗:', error);

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}

/**
 * 重置指標（僅開發環境）
 */
export async function DELETE() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: '此操作僅在開發環境可用' },
      { status: 403 }
    );
  }

  try {
    monitor.clear();
    errorRateMonitor.reset();

    return NextResponse.json({
      status: 'ok',
      message: '指標已重置'
    });

  } catch (error) {
    console.error('重置指標失敗:', error);

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}

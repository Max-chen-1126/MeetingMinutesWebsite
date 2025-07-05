// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

/**
 * 健康檢查和環境狀態端點
 * 
 * GET /api/health
 * 
 * 回應: 系統狀態和環境資訊
 */
export async function GET() {
  try {
    // 判斷環境
    const isProduction = process.env.GOOGLE_CLOUD_PROJECT && 
                         process.env.NODE_ENV === 'production' ||
                         process.env.DEPLOYMENT_ENV === 'production';
    
    const environment = isProduction ? 'production' : 'development';
    
    // 檢查關鍵環境變數（不洩露實際值）
    const envCheck = {
      hasGoogleCloudProject: !!process.env.GOOGLE_CLOUD_PROJECT,
      hasProjectId: !!process.env.PROJECT_ID,
      hasGcsBucket: !!process.env.GCS_BUCKET_NAME,
      hasLocation: !!process.env.LOCATION,
      hasBaseUrl: !!process.env.NEXT_PUBLIC_BASE_URL,
      nodeEnv: process.env.NODE_ENV,
      deploymentEnv: process.env.DEPLOYMENT_ENV
    };

    // 在生產環境不顯示敏感資訊
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment,
      isProduction,
      ...(isProduction ? {} : { envCheck }) // 只在開發環境顯示詳細資訊
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('健康檢查失敗:', error);
    
    return NextResponse.json(
      { 
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}
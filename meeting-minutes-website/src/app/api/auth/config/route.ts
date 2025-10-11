// src/app/api/auth/config/route.ts
import { NextResponse } from 'next/server';
import { getOAuthConfig } from '@/lib/oauth-config';

/**
 * 取得前端需要的 OAuth 設定（不包含機密資訊）
 * 
 * GET /api/auth/config
 * 
 * 回應: { clientId: string, baseUrl: string }
 */
export async function GET() {
  try {
    console.log('正在載入 OAuth 設定...');
    
    // 從 Secret Manager 或環境變數獲取 OAuth 設定
    const oauthConfig = await getOAuthConfig();
    
    console.log('OAuth 設定載入成功:', {
      hasClientId: !!oauthConfig.clientId,
      clientIdLength: oauthConfig.clientId?.length || 0,
      baseUrl: oauthConfig.baseUrl
    });

    // 只返回前端需要的非敏感資訊
    return NextResponse.json({
      clientId: oauthConfig.clientId,
      baseUrl: oauthConfig.baseUrl,
      success: true
    });

  } catch (error) {
    console.error('載入 OAuth 設定失敗:', error);
    
    let errorMessage = '無法載入 OAuth 設定';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('Google OAuth 設定不完整')) {
        errorMessage = 'OAuth 設定不完整，請檢查 Secret Manager 設定';
        statusCode = 503; // Service Unavailable
      } else if (error.message.includes('無法讀取 OAuth 設定')) {
        errorMessage = '無法從 Secret Manager 讀取設定';
        statusCode = 503;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false,
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: statusCode }
    );
  }
}

/**
 * 健康檢查端點
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
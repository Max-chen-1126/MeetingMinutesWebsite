// src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getSecret } from '@/lib/secrets';

/**
 * 使用 refresh token 更新 access token
 * 
 * POST /api/auth/refresh
 * Body: { refresh_token: string }
 * 
 * 回應: { access_token: string, expires_at: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = await req.json();
    
    if (!refresh_token) {
      return NextResponse.json(
        { error: '缺少 refresh token' },
        { status: 400 }
      );
    }

    // 判斷是否在生產環境
    const isProduction = process.env.GOOGLE_CLOUD_PROJECT && 
                         process.env.NODE_ENV === 'production' ||
                         process.env.DEPLOYMENT_ENV === 'production';
    
    let clientId: string;
    let clientSecret: string;
    let baseUrl: string;
    
    if (isProduction) {
      // 生產環境：從 Secret Manager 讀取
      try {
        clientId = await getSecret('google-oauth-client-id');
        clientSecret = await getSecret('google-oauth-client-secret');
        baseUrl = await getSecret('google-oauth-base-url');
      } catch (error) {
        console.error('從 Secret Manager 讀取憑證失敗:', error);
        return NextResponse.json(
          { error: '無法讀取 OAuth 設定' },
          { status: 500 }
        );
      }
    } else {
      // 開發環境：從環境變數讀取
      clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
      clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    }
    
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth 設定不完整' },
        { status: 500 }
      );
    }

    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      `${baseUrl}/auth/callback`
    );

    // 設置 refresh token
    oauth2Client.setCredentials({ refresh_token });

    // 刷新 access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      return NextResponse.json(
        { error: '無法刷新 access token' },
        { status: 500 }
      );
    }

    // 計算過期時間戳
    const expiresAt = credentials.expiry_date || (Date.now() + 3600 * 1000);

    console.log('Access token 刷新成功');

    return NextResponse.json({
      access_token: credentials.access_token,
      expires_at: expiresAt,
      token_type: 'Bearer'
    });

  } catch (error) {
    console.error('刷新 token 失敗:', error);
    
    let errorMessage = '刷新 token 失敗';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('invalid_grant')) {
        errorMessage = '刷新權杖已過期，請重新登入';
        statusCode = 401;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: statusCode }
    );
  }
}
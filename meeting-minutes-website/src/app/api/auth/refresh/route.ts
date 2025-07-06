// src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getOAuthConfig } from '@/lib/oauth-config';

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

    // 取得 OAuth 設定
    let oauthConfig;
    try {
      oauthConfig = await getOAuthConfig();
    } catch (error) {
      console.error('取得 OAuth 設定失敗:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '無法讀取 OAuth 設定' },
        { status: 500 }
      );
    }

    const oauth2Client = new OAuth2Client(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      `${oauthConfig.baseUrl}/auth/callback`
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
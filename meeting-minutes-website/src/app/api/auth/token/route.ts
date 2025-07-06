// src/app/api/auth/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getOAuthConfig } from '@/lib/oauth-config';

/**
 * 將授權碼交換為 access token
 * 
 * POST /api/auth/token
 * Body: { code: string }
 * 
 * 回應: { access_token: string, refresh_token?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    
    if (!code) {
      return NextResponse.json(
        { error: '缺少授權碼' },
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

    // 交換授權碼為 token
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.json(
        { error: '無法獲取 access token' },
        { status: 500 }
      );
    }

    // 計算過期時間戳（如果沒有提供，預設 1 小時後過期）
    const expiresAt = tokens.expiry_date || (Date.now() + 3600 * 1000);

    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      token_type: 'Bearer'
    });

  } catch (error) {
    console.error('Token 交換失敗:', error);
    
    return NextResponse.json(
      { 
        error: 'Token 交換失敗',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}
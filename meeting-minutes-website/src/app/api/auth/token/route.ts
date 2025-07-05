// src/app/api/auth/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getSecret } from '@/lib/secrets';

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

    // 判斷是否在生產環境 - 使用更可靠的檢查方式
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
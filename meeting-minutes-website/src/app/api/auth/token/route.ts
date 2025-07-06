// src/app/api/auth/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getOAuthConfig } from '@/lib/oauth-config';
import { encrypt } from '@/lib/crypto';
import { getUserInfo } from '@/lib/token-manager';

/**
 * 將授權碼交換為 access token，並設定安全的 HttpOnly Cookie
 * 
 * POST /api/auth/token
 * Body: { code: string }
 * 
 * 回應: { user: { name, email, picture } }
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
    console.log('正在交換授權碼為 access token...');
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('Google OAuth 回應:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      accessTokenType: typeof tokens.access_token,
      refreshTokenType: typeof tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      tokenType: tokens.token_type,
      scope: tokens.scope
    });
    
    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('獲取 tokens 失敗:', {
        access_token: tokens.access_token ? '存在' : '缺失',
        refresh_token: tokens.refresh_token ? '存在' : '缺失',
        allTokens: Object.keys(tokens)
      });
      
      return NextResponse.json(
        { 
          error: '無法獲取必要的認證權杖',
          details: {
            access_token_received: !!tokens.access_token,
            refresh_token_received: !!tokens.refresh_token,
            available_tokens: Object.keys(tokens)
          }
        },
        { status: 500 }
      );
    }

    // 取得使用者資料
    const userInfo = await getUserInfo(tokens.access_token);

    // 加密 refresh token
    const encryptedRefreshToken = await encrypt(tokens.refresh_token);

    // 建立回應並設定 HttpOnly Cookie
    const response = NextResponse.json({
      user: {
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture
      }
    });

    // 設定安全的 HttpOnly Cookie
    response.cookies.set('auth-token', encryptedRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 天
      path: '/'
    });

    return response;

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
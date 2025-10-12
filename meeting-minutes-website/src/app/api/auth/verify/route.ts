// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isValidEncryptedData } from '@/lib/crypto';
import { getUserInfoFromRefreshToken } from '@/lib/token-manager';

/**
 * 驗證使用者登入狀態並回傳使用者資料
 * 
 * GET /api/auth/verify
 * Cookie: auth-token (HttpOnly)
 * 
 * 回應: { user: { name, email, picture }, authenticated: true } 或 { authenticated: false }
 */
export async function GET(req: NextRequest) {
  try {
    // 從 Cookie 讀取加密的 refresh token
    const encryptedRefreshToken = req.cookies.get('auth-token')?.value;
    
    if (!encryptedRefreshToken) {
      return NextResponse.json({ authenticated: false });
    }
    
    // 驗證加密資料格式
    if (!isValidEncryptedData(encryptedRefreshToken)) {
      // 清除無效的 Cookie
      const response = NextResponse.json({ authenticated: false });
      response.cookies.delete('auth-token');
      return response;
    }
    
    try {
      // 從 refresh token 取得使用者資料
      const userInfo = await getUserInfoFromRefreshToken(encryptedRefreshToken);
      
      return NextResponse.json({
        authenticated: true,
        user: {
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture
        }
      });
    } catch (error) {
      console.error('驗證使用者失敗:', error);
      
      // 如果 token 無效或過期，清除 Cookie
      const response = NextResponse.json({ 
        authenticated: false,
        error: '認證已過期，請重新登入'
      });
      response.cookies.delete('auth-token');
      return response;
    }
    
  } catch (error) {
    console.error('驗證過程發生錯誤:', error);
    
    return NextResponse.json(
      { 
        authenticated: false,
        error: '驗證過程發生錯誤'
      },
      { status: 500 }
    );
  }
}
// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

/**
 * 登出並清除認證 Cookie
 * 
 * POST /api/auth/logout
 * 
 * 回應: { success: true }
 */
export async function POST() {
  try {
    // 建立回應
    const response = NextResponse.json({ 
      success: true,
      message: '已成功登出'
    });
    
    // 清除認證 Cookie
    response.cookies.delete('auth-token');
    
    return response;
    
  } catch (error) {
    console.error('登出過程發生錯誤:', error);
    
    // 即使發生錯誤，也要嘗試清除 Cookie
    const response = NextResponse.json(
      { 
        success: false,
        error: '登出過程發生錯誤'
      },
      { status: 500 }
    );
    
    response.cookies.delete('auth-token');
    return response;
  }
}

/**
 * 也支援 GET 方法以便於測試
 */
export async function GET() {
  return POST();
}
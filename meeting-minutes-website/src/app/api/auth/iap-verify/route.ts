// src/app/api/auth/iap-verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractIAPToken, verifyIAPToken, isIAPEnabled } from '@/lib/iap-auth';

/**
 * 驗證 IAP 使用者並回傳使用者資訊
 *
 * GET /api/auth/iap-verify
 * Headers: X-Goog-IAP-JWT-Assertion (由 IAP 自動加入)
 *
 * 回應: { authenticated: true, user: IAPUser } 或 { authenticated: false }
 */
export async function GET(req: NextRequest) {
  try {
    // 檢查是否啟用 IAP
    if (!isIAPEnabled()) {
      return NextResponse.json({
        authenticated: false,
        message: 'IAP 未啟用',
        iapEnabled: false
      });
    }

    // 從 headers 提取 IAP JWT
    const iapJwt = extractIAPToken(req.headers);

    if (!iapJwt) {
      return NextResponse.json({
        authenticated: false,
        message: '未找到 IAP JWT token',
        iapEnabled: true
      });
    }

    // 驗證 JWT 並提取使用者資訊
    const user = await verifyIAPToken(iapJwt);

    return NextResponse.json({
      authenticated: true,
      user: {
        email: user.email,
        name: user.name || user.email.split('@')[0],
        picture: user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random`,
        sub: user.sub
      },
      iapEnabled: true
    });

  } catch (error) {
    console.error('IAP 驗證失敗:', error);

    return NextResponse.json(
      {
        authenticated: false,
        error: error instanceof Error ? error.message : 'IAP 驗證失敗',
        iapEnabled: true
      },
      { status: 401 }
    );
  }
}

/**
 * 健康檢查端點
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

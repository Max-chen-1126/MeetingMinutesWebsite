// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware - 處理 CSRF 保護和安全 headers
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 安全 Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (CSP)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 需要
    "style-src 'self' 'unsafe-inline'", // Tailwind 需要
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://accounts.google.com https://*.googleapis.com https://*.google.com",
    "frame-src 'self' https://accounts.google.com",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // CSRF 保護：檢查 POST/PUT/DELETE 請求的 Origin
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // 如果是 API 路由，檢查 Origin
    if (request.nextUrl.pathname.startsWith('/api/')) {
      // 允許的來源
      const allowedOrigins = [
        `https://${host}`,
        `http://localhost:3000`, // 開發環境
        process.env.NEXT_PUBLIC_BASE_URL,
      ].filter(Boolean);

      if (origin && !allowedOrigins.includes(origin)) {
        console.warn(`CSRF 檢查失敗: Origin=${origin}, Host=${host}`);
        return NextResponse.json(
          { error: 'CSRF 驗證失敗' },
          { status: 403 }
        );
      }
    }
  }

  return response;
}

/**
 * Middleware 套用的路徑
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

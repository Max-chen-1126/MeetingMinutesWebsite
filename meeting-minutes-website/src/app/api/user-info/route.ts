import { NextRequest, NextResponse } from 'next/server';
import { verifyIapJwt } from './jwt';

export async function GET(req: NextRequest) {
  // 從請求頭中獲取 IAP 添加的用戶資訊
  const userEmail = req.headers.get('X-Goog-Authenticated-User-Email');
  const userId = req.headers.get('X-Goog-Authenticated-User-Id');
  
  // 獲取 JWT 斷言，用於驗證請求確實通過了 IAP
  const jwtAssertion = req.headers.get('x-goog-iap-jwt-assertion');
  
  // 如果沒有 JWT 斷言，返回未認證
  if (!jwtAssertion) {
    return NextResponse.json({
      authenticated: false,
      email: null,
      id: null,
      message: 'IAP JWT 斷言缺失'
    });
  }
  
  try {
    // 在生產環境中，您應該驗證 JWT
    // 這裡使用環境變量或 Secret Manager 獲取您的項目編號
    const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
    
    if (process.env.NODE_ENV === 'production' && projectNumber) {
      // 在生產環境中驗證 JWT
      const expectedAudience = `/projects/${projectNumber}/apps/${process.env.GOOGLE_CLOUD_PROJECT}`;
      await verifyIapJwt(jwtAssertion, expectedAudience);
    } else {
      // 開發環境中，僅檢查是否存在 JWT
      console.log('開發模式: 跳過 JWT 驗證');
    }
    
    // 如果無法獲取用戶資訊
    if (!userEmail) {
      return NextResponse.json({
        authenticated: true,
        email: null,
        id: null,
        message: 'JWT 驗證通過，但無法獲取用戶資訊'
      });
    }
    
    // 清理郵箱格式
    const email = userEmail.startsWith('accounts.google.com:') 
      ? userEmail.replace('accounts.google.com:', '') 
      : userEmail;
      
    // 清理用戶 ID 格式
    const id = userId?.startsWith('accounts.google.com:')
      ? userId.replace('accounts.google.com:', '')
      : userId;
    
    // 返回用戶資訊
    return NextResponse.json({
      authenticated: true,
      email,
      id,
      message: '認證成功'
    });
    
  } catch (error) {
    console.error('JWT 驗證失敗:', error);
    
    return NextResponse.json({
      authenticated: false,
      email: null,
      id: null,
      message: 'JWT 驗證失敗'
    }, { status: 401 });
  }
}
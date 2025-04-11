// src/app/api/user-info/route.ts 的修正版本
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // 從請求頭中獲取 IAP 添加的用戶資訊
  const userEmail = req.headers.get('X-Goog-Authenticated-User-Email');
  const userId = req.headers.get('X-Goog-Authenticated-User-Id');
  
  // 簡化版本 - 如果有用戶郵箱頭信息，我們認為用戶已通過 IAP 認證
  const isAuthenticated = !!userEmail;
  
  // 如果沒有通過 IAP 認證，返回未認證狀態
  if (!isAuthenticated) {
    return NextResponse.json({
      authenticated: false,
      email: null,
      id: null,
      message: '未通過 IAP 認證'
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
}
// src/app/api/export-to-docs/route.ts
import { convertMarkdownToGoogleDocs } from '@/lib/markdown-to-docs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/token-manager';
import { getOAuthConfig } from '@/lib/oauth-config';
import { isValidEncryptedData } from '@/lib/crypto';

/**
 * 匯出會議記錄到 Google Docs (使用 HttpOnly Cookie 認證)
 * 
 * POST /api/export-to-docs
 * Body: { markdownContent: string, title: string }
 * Cookie: auth-token (HttpOnly)
 * 
 * 回應: { documentId: string, documentUrl: string }
 */
export async function POST(req: NextRequest) {
  try {
    // 解析請求內容
    const { markdownContent, title } = await req.json();
    
    if (!markdownContent || !title) {
      return NextResponse.json(
        { error: '缺少必要參數：markdownContent 或 title' },
        { status: 400 }
      );
    }

    // 從 Cookie 讀取加密的 refresh token
    const encryptedRefreshToken = req.cookies.get('auth-token')?.value;
    
    if (!encryptedRefreshToken) {
      return NextResponse.json(
        { error: '需要用戶授權，請先登入 Google 帳戶' },
        { status: 401 }
      );
    }
    
    // 驗證加密資料格式
    if (!isValidEncryptedData(encryptedRefreshToken)) {
      return NextResponse.json(
        { error: '認證資料格式無效，請重新登入' },
        { status: 401 }
      );
    }

    // 取得有效的 access token
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(encryptedRefreshToken);
    } catch (error) {
      console.error('無法取得有效 access token:', error);
      return NextResponse.json(
        { error: '認證已過期，請重新登入' },
        { status: 401 }
      );
    }
    
    // 取得 OAuth 設定
    const oauthConfig = await getOAuthConfig();
    
    // 使用 access token 初始化 OAuth2 客戶端
    const oauth2Client = new OAuth2Client(
      oauthConfig.clientId,
      oauthConfig.clientSecret
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    // 初始化 Google APIs
    const docs = google.docs({ version: 'v1', auth: oauth2Client});

    // 直接使用手動轉換方法（更可靠）
    return await handleManualConversion(docs, markdownContent, title);

  } catch (error) {
    console.error('匯出 Google Docs 失敗:', error);
    
    let errorMessage = '匯出 Google Docs 失敗';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('invalid_grant') || error.message.includes('Invalid Credentials')) {
        errorMessage = '用戶授權已過期，請重新登入';
        statusCode = 401;
      } else if (error.message.includes('Access denied')) {
        errorMessage = '權限不足，請確認已授予 Google Docs 權限';
        statusCode = 403;
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

/**
 * 手動轉換 Markdown 到 Google Docs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleManualConversion(docs: any, markdownContent: string, title: string) {
  try {
    console.log('開始手動轉換 Markdown 到 Google Docs');
    console.log('標題:', title);
    console.log('內容長度:', markdownContent.length);
    
    // 建立新的 Google Docs 文件
    console.log('正在呼叫 docs.documents.create...');
    const document = await docs.documents.create({
      requestBody: {
        title: title
      }
    });

    if (!document.data.documentId) {
      throw new Error('文件建立成功但沒有返回 documentId');
    }

    console.log('Google Docs 文件建立完成，ID:', document.data.documentId);

    // 轉換 Markdown 內容
    const requests = convertMarkdownToGoogleDocs(markdownContent);
    
    console.log('Markdown 轉換完成，請求數量:', requests.length);

    // 如果有轉換請求，執行批次更新
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: document.data.documentId,
        requestBody: {
          requests: requests
        }
      });
      
      console.log('Google Docs 批次更新完成');
    }

    const documentUrl = `https://docs.google.com/document/d/${document.data.documentId}/edit`;
    
    return NextResponse.json({
      documentId: document.data.documentId,
      documentUrl,
      method: 'manual'
    });

  } catch (error) {
    console.error('手動轉換失敗:', error);
    
    // 提供更詳細的錯誤資訊
    if (error instanceof Error) {
      console.error('錯誤詳情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // 檢查是否為特定的 Google API 錯誤
      if (error.message.includes('The caller does not have permission')) {
        throw new Error('權限不足：無法創建 Google Docs 文件，請確認已授予正確的權限');
      } else if (error.message.includes('invalid_grant')) {
        throw new Error('授權已過期：請重新登入 Google 帳戶');
      } else if (error.message.includes('Login Required')) {
        throw new Error('需要登入：Google 授權無效或不足，請重新登入');
      }
    }
    
    throw error;
  }
}


/**
 * 健康檢查端點
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'export-to-docs',
    timestamp: new Date().toISOString()
  });
}
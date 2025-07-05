// src/app/api/export-to-docs/route.ts
import { convertMarkdownToGoogleDocs } from '@/lib/markdown-to-docs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 匯出會議記錄到 Google Docs
 * 
 * POST /api/export-to-docs
 * Body: { markdownContent: string, title: string }
 * 
 * 回應: { documentId: string, documentUrl: string }
 */
export async function POST(req: NextRequest) {
  try {
    console.log('開始匯出 Google Docs 流程');
    console.log('請求標頭:', {
      authorization: req.headers.get('Authorization') ? '已提供' : '未提供',
      contentType: req.headers.get('Content-Type')
    });
    
    // 解析請求內容
    const { markdownContent, title } = await req.json();
    
    if (!markdownContent || !title) {
      return NextResponse.json(
        { error: '缺少必要參數：markdownContent 或 title' },
        { status: 400 }
      );
    }

    console.log('請求參數驗證完成，標題:', title);

    // 從請求標頭中獲取 Authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '需要用戶授權，請先登入 Google 帳戶' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7); // 移除 "Bearer " 前綴
    console.log('Access Token 長度:', accessToken.length);
    console.log('Access Token 前綴:', accessToken.substring(0, 20) + '...');
    
    // 使用用戶的 Access Token 初始化 OAuth2 客戶端
    // 注意：這裡我們不需要 redirect URI，因為我們使用的是已有的 access token
    const oauth2Client = new OAuth2Client(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    console.log('OAuth2 客戶端初始化完成');

    // 驗證 token 的有效性
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(accessToken);
      console.log('Token 驗證成功:', { 
        scopes: tokenInfo.scopes, 
        expiry: tokenInfo.expiry_date,
        audience: tokenInfo.aud 
      });
      
      // 檢查是否有 documents 權限
      if (!tokenInfo.scopes?.includes('https://www.googleapis.com/auth/documents')) {
        console.error('Token 缺少 documents 權限:', tokenInfo.scopes);
        return NextResponse.json(
          { error: '權限不足，請重新登入並授予 Google Docs 權限' },
          { status: 403 }
        );
      }
    } catch (tokenError) {
      console.error('Token 驗證失敗:', tokenError);
      return NextResponse.json(
        { error: '無效的授權令牌，請重新登入' },
        { status: 401 }
      );
    }

    // 初始化 Google APIs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = google.docs({ version: 'v1', auth: oauth2Client});

    console.log('Google APIs 初始化完成');

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
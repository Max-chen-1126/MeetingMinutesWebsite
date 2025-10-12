// src/app/api/export-to-docs-secure/route.ts
// 使用 HTML 轉檔法：Markdown → HTML → Google Docs
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { marked } from 'marked';
import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/token-manager';
import { getOAuthConfig } from '@/lib/oauth-config';
import { isValidEncryptedData } from '@/lib/crypto';
import { validateRequest, exportToDocsSchema } from '@/lib/validation';
import rateLimiter, { RATE_LIMITS, getIdentifier } from '@/lib/rate-limit';

/**
 * 安全的匯出會議記錄到 Google Docs API
 *
 * 使用方案 A（HTML 轉檔法）：
 * 1. Markdown → HTML (使用 marked)
 * 2. HTML → Google Docs (使用 Drive API 自動轉檔)
 *
 * POST /api/export-to-docs-secure
 * Body: { markdownContent: string, title: string }
 * Cookie: auth-token (HttpOnly)
 *
 * 優勢：
 * - 最簡單穩定：依賴 Google 官方轉檔引擎
 * - 格式保證正確：標題、列表、表格都能正確轉換
 * - 原生結構：列表是 Google Docs 原生項目符號
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const identifier = getIdentifier(req.headers);
    const rateLimit = rateLimiter.check(
      identifier,
      RATE_LIMITS.EXPORT.limit,
      RATE_LIMITS.EXPORT.window
    );

    if (!rateLimit.allowed) {
      const resetTime = new Date(rateLimit.resetTime).toISOString();
      return NextResponse.json(
        {
          error: '請求過於頻繁，請稍後再試',
          resetTime
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMITS.EXPORT.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetTime),
          }
        }
      );
    }

    // 2. 解析並驗證請求內容
    const body = await req.json();
    const validation = validateRequest(exportToDocsSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: `驗證失敗: ${validation.error}` },
        { status: 400 }
      );
    }

    const { markdownContent, title } = validation.data;

    // 3. 認證檢查
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

    // 4. 取得有效的 access token
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

    // 5. 取得 OAuth 設定
    const oauthConfig = await getOAuthConfig();

    // 6. 使用 access token 初始化 OAuth2 客戶端
    const oauth2Client = new OAuth2Client(
      oauthConfig.clientId,
      oauthConfig.clientSecret
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    // 7. 執行 HTML 轉檔匯出
    return await convertMarkdownToGoogleDocsViaHTML(oauth2Client, markdownContent, title);

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
 * 使用 HTML 轉檔法將 Markdown 轉換為 Google Docs
 *
 * 流程：
 * 1. 使用 marked 將 Markdown 轉為 HTML
 * 2. 加上基本的 HTML 結構與樣式
 * 3. 使用 Drive API 上傳 HTML 並自動轉為 Google Docs
 *
 * 這是最穩定的方法，因為：
 * - 依賴 Google 官方的 HTML → Docs 轉檔引擎
 * - 自動處理標題、列表、表格、粗體、斜體等
 * - 轉換後的列表是原生 Google Docs 項目符號
 */
async function convertMarkdownToGoogleDocsViaHTML(
  oauth2Client: OAuth2Client,
  markdownContent: string,
  title: string
) {
  try {
    console.log('開始使用 HTML 轉檔法轉換 Markdown');
    console.log('標題:', title);
    console.log('Markdown 內容長度:', markdownContent.length);

    // 步驟 1：將 Markdown 轉為 HTML
    console.log('正在將 Markdown 轉換為 HTML...');
    const htmlContent = marked.parse(markdownContent, {
      gfm: true,           // GitHub Flavored Markdown
      breaks: true,        // 換行轉為 <br>
      pedantic: false,
    }) as string;

    // 步驟 2：加上完整的 HTML 結構與樣式
    // 這些樣式會幫助 Google Docs 更好地轉換格式
    const styledHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { font-size: 24px; font-weight: bold; margin: 20px 0 10px 0; }
    h2 { font-size: 20px; font-weight: bold; margin: 18px 0 9px 0; }
    h3 { font-size: 18px; font-weight: bold; margin: 16px 0 8px 0; }
    h4 { font-size: 16px; font-weight: bold; margin: 14px 0 7px 0; }
    h5 { font-size: 14px; font-weight: bold; margin: 12px 0 6px 0; }
    h6 { font-size: 12px; font-weight: bold; margin: 10px 0 5px 0; }
    p { margin: 10px 0; }
    ul, ol { margin: 10px 0; padding-left: 30px; }
    li { margin: 5px 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background-color: #f4f4f4;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 15px;
      margin: 10px 0;
      color: #666;
    }
    a {
      color: #1a73e8;
      text-decoration: none;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

    console.log('HTML 轉換完成，長度:', styledHtml.length);

    // 步驟 3：使用 Drive API 上傳 HTML 並轉為 Google Docs
    console.log('正在上傳 HTML 到 Google Drive 並轉為 Google Docs...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const file = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.document', // 目標格式：Google Docs
      },
      media: {
        mimeType: 'text/html', // 來源格式：HTML
        body: styledHtml,
      },
      fields: 'id,name,mimeType,webViewLink',
    });

    if (!file.data.id) {
      throw new Error('檔案建立成功但沒有返回檔案 ID');
    }

    console.log('✅ Google Docs 文件建立完成！');
    console.log('文件 ID:', file.data.id);
    console.log('文件名稱:', file.data.name);

    const documentUrl = file.data.webViewLink || `https://docs.google.com/document/d/${file.data.id}/edit`;

    return NextResponse.json({
      documentId: file.data.id,
      documentUrl,
      method: 'html-import',
      message: '使用 HTML 轉檔法（最穩定）',
    });

  } catch (error) {
    console.error('HTML 轉檔失敗:', error);

    // 提供更詳細的錯誤資訊
    if (error instanceof Error) {
      console.error('錯誤詳情:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // 檢查是否為特定的 Google API 錯誤
      if (error.message.includes('The caller does not have permission')) {
        throw new Error('權限不足：無法創建 Google Docs 文件，請確認已授予 Google Drive 權限');
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
    service: 'export-to-docs-secure',
    method: 'html-import',
    timestamp: new Date().toISOString(),
    security: {
      rateLimit: true,
      inputValidation: true,
      csrf: true,
      httpOnlyCookie: true,
    },
    features: {
      markdown: true,
      tables: true,
      lists: true,
      codeBlocks: true,
      formatting: true,
    }
  });
}

// src/lib/validation.ts
import { z } from 'zod';

/**
 * 生成上傳 URL 請求驗證
 */
export const generateUploadUrlSchema = z.object({
  fileName: z.string().min(1, '檔案名稱不能為空').max(255, '檔案名稱過長'),
  contentType: z.string().min(1, 'Content-Type 不能為空').regex(
    /^(audio|video)\/.+$/,
    '只支援音頻或視頻檔案'
  ),
});

/**
 * 生成會議記錄請求驗證
 */
export const generateMinutesSchema = z.object({
  fileName: z.string().min(1, '檔案名稱不能為空').max(255, '檔案名稱過長'),
  meetingName: z.string().max(200, '會議名稱過長').optional(),
  meetingDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    '日期格式錯誤，應為 YYYY-MM-DD'
  ).optional(),
  participants: z.string().max(500, '與會人員列表過長').optional(),
  additionalInfo: z.string().max(2000, '附加資訊過長').optional(),
});

/**
 * 匯出到 Google Docs 請求驗證
 */
export const exportToDocsSchema = z.object({
  markdownContent: z.string()
    .min(1, '會議記錄內容不能為空')
    .max(100000, '會議記錄內容過長（最多 100KB）'),
  title: z.string()
    .min(1, '標題不能為空')
    .max(255, '標題過長'),
});

/**
 * OAuth 授權碼交換請求驗證
 */
export const tokenExchangeSchema = z.object({
  code: z.string().min(1, '授權碼不能為空'),
});

/**
 * 驗證請求數據
 * @param schema Zod schema
 * @param data 要驗證的數據
 * @returns 驗證結果
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join(', ');
      return { success: false, error: messages };
    }
    return { success: false, error: '驗證失敗' };
  }
}

/**
 * 清理使用者輸入（防止 XSS）
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 驗證檔案名稱（防止路徑遍歷攻擊）
 */
export function validateFileName(fileName: string): boolean {
  // 不允許包含路徑分隔符或特殊字元
  const invalidChars = /[\/\\:*?"<>|]/;
  const pathTraversal = /\.\./;

  return !invalidChars.test(fileName) && !pathTraversal.test(fileName);
}

/**
 * 驗證 URL（防止 SSRF）
 */
export function validateUrl(url: string, allowedDomains?: string[]): boolean {
  try {
    const parsed = new URL(url);

    // 只允許 https
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // 如果指定了允許的域名，檢查域名
    if (allowedDomains && allowedDomains.length > 0) {
      return allowedDomains.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    }

    return true;
  } catch {
    return false;
  }
}

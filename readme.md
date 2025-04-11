# 會議記錄生成器 (Meeting Minutes Generator)

![會議記錄生成器](https://img.shields.io/badge/會議記錄-生成器-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-blue)
![Google Gemini AI](https://img.shields.io/badge/Gemini-2.5%20Pro-orange)

一個基於 Google Gemini AI 的自動會議記錄生成器，可將會議音頻檔案轉換為結構化的會議記錄草稿。只需上傳音頻檔案，填寫基本會議資訊，系統即可生成格式化的會議記錄，節省大量整理時間。

## 功能特點

- 🎙️ **音頻轉文字**：支援多種音頻格式（MP3、WAV、OGG、M4A、AAC）
- 📝 **自動生成**：全自動將語音內容整理為結構化會議記錄
- 🔍 **關鍵要點提取**：自動識別會議中的重要決議和待辦事項
- 📱 **響應式設計**：完美適配桌面和移動設備
- 📋 **一鍵複製**：快速複製生成的會議記錄

## 技術堆疊

- **前端框架**：Next.js 14、React 19、TypeScript
- **樣式**：TailwindCSS, shadcn
- **UI 動畫**：Framer Motion
- **人工智能**：Google Gemini 2.5 Pro
- **檔案處理**：react-dropzone
- **Markdown 渲染**：react-markdown、remark-gfm

## 快速開始

### 前提條件

- Node.js 18.17 或更高版本
- 有效的 Google AI (Gemini) API 金鑰

### 安裝步驟

1. 克隆專案存儲庫:

```bash
git clone https://github.com/yourusername/meeting-minutes-generator.git
cd meeting-minutes-generator
```

2. 安裝依賴:

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. 創建環境變數檔案:

```bash
cp .env.example .env.local
```

4. 在 `.env.local` 中設置你的 Google AI API 金鑰:

```env
GOOGLE_API_KEY=your_api_key_here
```

5. 啟動開發伺服器:

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

6. 在瀏覽器中打開 [http://localhost:3000](http://localhost:3000)

### 生產環境部署

構建用於生產環境的應用:

```bash
npm run build
# 或
yarn build
# 或
pnpm build
```

然後啟動生產伺服器:

```bash
npm start
# 或
yarn start
# 或
pnpm start
```

## 使用指南

1. **上傳音頻檔案**：點擊上傳區域或拖放音頻檔案到上傳區域
2. **填寫會議資訊**：
   - 會議名稱
   - 會議時間
   - 參與人員（用逗號分隔）
   - 任何其他相關資訊
3. **生成會議記錄**：點擊「生成會議記錄」按鈕
4. **複製或保存**：生成完成後，可點擊「複製內容」按鈕複製會議記錄

## API 說明

該專案包含一個 API 端點 `/api/generate-minutes`，用於處理音頻文件並生成會議記錄:

### POST /api/generate-minutes

接受多部分表單資料，包含:

- `audioFile`: 音頻檔案（支援格式：MP3、WAV、OGG、M4A、AAC）
- `meetingName`: 會議名稱
- `meetingDate`: 會議日期和時間
- `participants`: 參與人員列表
- `additionalInfo`: 其他會議相關資訊

回傳 JSON 物件，包含:

- 成功: `{ meetingRecord: "生成的會議記錄" }`
- 失敗: `{ error: "錯誤訊息" }`

## 限制說明

- 音頻檔案大小取決於您的 Google API 配額限制
- 語言主要支援中文，但 Gemini AI 也可處理其他語言
- 生成過程可能需要幾分鐘，取決於音頻長度和複雜度

## 隱私聲明

上傳的音頻檔案僅用於生成會議記錄，處理完成後會從伺服器中刪除。本應用不會永久儲存任何用戶資料或音頻內容。


## 贊助和支持

如果您喜歡這個專案，請考慮給它一個 ⭐️。您的支持將幫助我們持續改進這個工具！

## 聯絡方式

如有任何問題或建議，請提交 Issue 或通過以下方式聯繫:

- Email: maxchen1126@gmail.com

---

由 [Vibe Coding by Max](https://vibecoding.com) 開發 ✨

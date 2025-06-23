# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案架構

這是一個基於 Google Gemini AI 的會議記錄生成器，採用 Next.js 14 開發，部署在 Google Cloud Platform (GCP) App Engine 上。

### 技術堆疊
- **前端**: Next.js 14、React 19、TypeScript、TailwindCSS、shadcn/ui
- **後端**: Next.js API Routes、Google Cloud Storage、Google Cloud Secret Manager
- **AI 模型**: Google Gemini 2.5 Pro (REST API)
- **部署**: GCP App Engine、Cloud Storage Bucket

### 核心功能流程
1. 使用者上傳音頻檔案
2. 檔案上傳至 Google Cloud Storage 
3. 呼叫 Gemini 2.5 Pro API 處理音頻並生成會議記錄
4. 處理完成後自動刪除 GCS 檔案

## 常用指令

### 開發環境
```bash
# 安裝依賴套件
npm install

# 啟動開發伺服器（使用 Turbopack）
npm run dev

# 編譯專案
npm run build

# 啟動正式環境伺服器
npm start

# 執行 ESLint 檢查
npm run lint
```

### 部署到 GCP App Engine
```bash
# 部署應用程式
gcloud app deploy

# 查看應用程式
gcloud app browse

# 檢查版本
gcloud app versions list

# 刪除舊版本
gcloud app versions delete [VERSION_ID]
```

### GCP 設定指令
```bash
# 啟用 Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 創建機密（API 金鑰）
gcloud secrets create google-api-key --replication-policy="automatic"

# 添加機密版本
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add google-api-key --data-file=-

# 授予 App Engine 服務帳戶權限
gcloud secrets add-iam-policy-binding google-api-key \
    --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## 專案結構說明

### API 路由 (`src/app/api/`)
- `generate-minutes/route.ts`: 主要的會議記錄生成 API，處理 GCS 檔案並呼叫 Gemini API
- `generate-upload-url/route.ts`: 生成 GCS 上傳 URL 
- `delete-file/route.ts`: 刪除 GCS 檔案
- `user-info/route.ts`: 取得使用者資訊

### 元件架構 (`src/components/`)
- `UserInfo.tsx`: 主要的使用者介面元件
- `ui/`: shadcn/ui 元件庫 (Button、Card、Form、Input 等)

### 工具函式 (`src/lib/`)
- `secrets.ts`: Google Cloud Secret Manager 介接
- `utils.ts`: 通用工具函式 (Tailwind CSS 類別合併等)

## 環境變數配置

### app.yaml 中的環境變數
- `PROJECT_ID`: GCP 專案 ID
- `GCS_BUCKET_NAME`: Cloud Storage Bucket 名稱  
- `LOCATION`: GCP 區域 (例如: us-central1, asia-east1)
- `NODE_ENV`: 執行環境 (production)

### 本地開發環境變數 (.env.local)
- `GOOGLE_API_KEY`: Google Gemini API 金鑰

## 重要注意事項

### GCP 部署配置
- 使用 F1 實例類別（免費方案）
- 設定自動擴展：最小 0 實例，最大 2 實例
- 強制 HTTPS 連線
- 針對低流量內部應用最佳化

### 安全性考量
- API 金鑰透過 Secret Manager 安全儲存
- 使用 Google Auth Library 進行認證
- 處理完成後自動刪除 GCS 暫存檔案
- 所有連線強制使用 HTTPS

### Gemini API 整合
- 使用 Gemini 2.5 Pro 模型
- 透過 REST API 呼叫 (非 SDK)
- 支援音頻檔案處理：MP3、WAV、OGG、M4A、AAC
- 生成結構化的 Markdown 格式會議記錄

### 效能最佳化
- 使用 Turbopack 進行開發
- 響應式設計適配行動裝置
- 自動清理暫存檔案節省儲存空間
- 實例自動縮放至零節省成本
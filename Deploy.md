# 將會議記錄生成器部署到 GCP App Engine (免費方案)

本指南將幫助您將會議記錄生成器部署到 Google Cloud Platform (GCP) 的 App Engine，並盡可能保持在免費使用量內。

## 前置需求

1. Google Cloud Platform 帳號
2. Google Cloud SDK 安裝在本地開發環境
3. Node.js 和 npm/yarn 安裝在本地開發環境
4. Google Gemini API 金鑰

## 步驟 1: 設置 Secret Manager

首先，將 API 金鑰存儲在 Secret Manager 中：

```bash
# 啟用 Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 創建機密
gcloud secrets create google-api-key --replication-policy="automatic"

# 添加機密版本 (API 金鑰)
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add google-api-key --data-file=-

# 授予 App Engine 服務帳戶訪問權限
gcloud secrets add-iam-policy-binding google-api-key \
    --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## 步驟 2: 安裝 Secret Manager 依賴

```bash
npm install @google-cloud/secret-manager
# 或
yarn add @google-cloud/secret-manager
```

## 步驟 3: 創建 app.yaml 文件

在項目根目錄創建 `app.yaml` 文件，內容如下：

```yaml
runtime: nodejs20
instance_class: F1

handlers:
  - url: /.*
    secure: always
    redirect_http_response_code: 301
    script: auto

# 自動擴展配置 - 內部應用使用，低流量
automatic_scaling:
  min_instances: 0
  max_instances: 1  # 限制最多 1 個實例
  min_idle_instances: 0
  max_idle_instances: 0
  min_pending_latency: 3000ms  # 增加延遲容忍度，減少實例啟動頻率
  max_pending_latency: 5000ms
```

## 步驟 4: 創建 .gcloudignore 文件

在項目根目錄創建 `.gcloudignore` 文件，內容如下：

```
.git
.github
node_modules/
.next/cache
```

## 步驟 5: 構建應用

```bash
npm run build
# 或
yarn build
```

## 步驟 6: 部署到 App Engine

```bash
gcloud app deploy
```

## 步驟 7: 驗證部署

```bash
gcloud app browse
```

## 優化免費額度使用

為了保持在免費額度範圍內，請遵循以下建議：

### 實例使用量優化

1. **限制最大實例數為 1**：
   - 在 `app.yaml` 中設置 `max_instances: 1`

2. **增加延遲容忍度**：
   - 設置較高的 `min_pending_latency` 和 `max_pending_latency`，減少實例啟動頻率

3. **設置最小實例為 0**：
   - 允許在沒有流量時完全關閉實例

### 存儲優化

1. **定期清理不再需要的版本**：
   - 只保留最新的部署版本，刪除舊版本
   - `gcloud app versions list`
   - `gcloud app versions delete [VERSION_ID]`

2. **臨時文件處理**：
   - 確保處理完成後刪除臨時音頻文件
   - 使用 `/tmp` 目錄存儲臨時文件，不計入存儲配額

### 監控使用情況

定期檢查資源使用情況：

```bash
# 檢查配額使用情況
gcloud compute project-info describe --project YOUR_PROJECT_ID

# 監控 App Engine 實例
gcloud app instances list
```

在 Google Cloud 控制台中，訪問以下部分監控使用情況：
- App Engine > 配額
- 計費 > 報告

## 免費額度限制提醒

請記住 App Engine 免費額度的主要限制：

- **F1 實例**：每天 28 小時免費
- **存儲**：代碼和靜態文件 1GB 免費
- **Datastore**：1GiB 免費存儲
- **出口流量**：每天 1GB 免費

## 處理超出免費額度的情況

如果應用超出免費額度，您有幾個選擇：

1. **設置預算提醒**：在 Google Cloud 控制台設置預算提醒，以防止意外支出
2. **暫停應用**：在非工作時間停止應用以節省實例時間
3. **限制使用量**：在應用程序中添加使用限制，例如每天允許生成的會議記錄數量

---

**注意**：本指南專為內部低流量應用設計，以最大限度地利用 App Engine 免費額度。對於更高流量或更複雜的用例，可能需要調整配置。
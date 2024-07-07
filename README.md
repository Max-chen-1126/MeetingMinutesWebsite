# MeetingMinutesWebsite
> 使用 STT 的技術將上傳的音檔轉成文字並使用 Gemini-1.5-Pro 將會議紀錄整理好

---
## 主要技術
- 語音轉文字使用 AssemblyAI 的模型進行
  - 每個月有 100 hr 的免費使用量可以提供使用
- 後續的 LLM 使用 Google 的 Gemini-1.5-Pro 模型進行會議紀錄和整理
  - 通過我本身的 GCP Project 來調用
- 前端通過 Streamlit 來建立網站，讓同事能通過網站來上傳音檔並快速生成會議紀錄

---

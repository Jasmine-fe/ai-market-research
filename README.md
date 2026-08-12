# Market Memo

Market Memo 是一個美股市場寬度與 AI 研究工具，追蹤 S&P 500、QQQ、MA20／MA60 乖離率，以及各自的等權 Breadth 20。

## AI Market Brief MVP

首頁的「分析目前市場」執行一條固定、可檢查的研究流程：

1. **Tool calling**：取得 SPX、QQQ 與 Breadth 歷史資料。
2. **Tool calling**：以價格乖離、Breadth 水準及五日動能搜尋三個歷史相似案例，計算後續 20 日報酬與最大回撤。
3. **RAG**：取得最接近案例日期的 Federal Reserve FOMC 會議紀錄，以 embedding similarity 檢索相關段落。
4. **LLM application / Agent workflow**：將市場資料、歷史案例與官方文件整合成繁體中文結構化研究摘要。
5. **AI evaluation**：檢查輸出結構、證據 ID、歷史結果及禁止交易指令。

AI 僅提供有證據的市場研究，不提供買賣、部位或報酬保證。輸出若未通過引用、數字或安全性檢查，API 會 fail closed，不回傳研究結論。

## Execution log

每次 AI Market Brief request 都會保存一筆精簡摘要，包含 request ID、執行時間、耗時、結果狀態、模型、RAG 狀態、證據 ID、工作流程步驟及失敗檢查名稱。Log 不保存 API key、完整 prompt 或 FOMC 文件全文。

- Sites 部署環境使用 D1 的 `market_brief_executions` table。
- 本機 production preview 使用 `.local-data/market-brief-executions.jsonl`，此目錄不會提交至 Git。

## Local development

需要 Node.js `>=22.13.0`。

```bash
cp .env.example .env.local
npm install
npm run dev
```

在 `.env.local` 設定伺服器端 `OPENAI_API_KEY`。金鑰不會傳送至瀏覽器。

## Validation

```bash
npm run build
npm run lint
npm test
```

## Data sources

- TradingView：即時／延遲價格卡片
- Barchart：S&P 500、QQQ 與 Breadth 歷史日線
- Federal Reserve：FOMC 官方會議紀錄

資料可能延遲或暫時中斷，網站內容不構成投資建議。

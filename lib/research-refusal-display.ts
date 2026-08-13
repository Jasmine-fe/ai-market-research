const REASON_LABELS: Record<string, string> = {
  QUESTION_OUT_OF_SCOPE: "問題超出研究範圍",
  RAG_INDEX_EMPTY: "FOMC 知識庫尚未就緒",
  INSUFFICIENT_EVIDENCE: "可用證據不足",
  OUTPUT_GUARDRAIL_REJECTED: "回答未通過品質檢查",
  MODEL_REFUSAL: "模型拒絕處理",
};

const CHECK_LABELS: Record<string, string> = {
  "Retrieval availability": "沒有可用的 Semantic 或 Keyword 檢索結果",
  "Hybrid retrieval": "檢索候選不足",
  "Citation validity": "引用編號無效",
  "Citation support": "引用原文無法直接支持結論",
  "Temporal safety": "使用了請求日期之後發布的文件",
  "No trading instruction": "回答包含交易或部位指令",
};

export function refusalReasonLabel(code?: string) {
  return (code && REASON_LABELS[code]) || "研究流程拒絕輸出";
}

export function failedCheckLabel(name: string) {
  return CHECK_LABELS[name] ?? name;
}

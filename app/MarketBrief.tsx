"use client";

import { useState } from "react";

type MarketBriefResponse = {
  generatedAt: string;
  model: string;
  analogs: Array<{
    date: string;
    similarity: number;
    reasons: string[];
    spxReturn20: number;
    qqqReturn20: number;
    spxMaxDrawdown20: number;
    qqqMaxDrawdown20: number;
  }>;
  evidence: Array<{
    id: string;
    title: string;
    meetingDate: string;
    excerpt: string;
    url: string;
  }>;
  ragStatus: "grounded" | "insufficient";
  brief: {
    headline: string;
    summary: string[];
    observations: Array<{
      label: string;
      detail: string;
      evidenceIds: string[];
    }>;
    watchFor: string[];
    limitations: string[];
  };
  evaluation: {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  };
  trace: Array<{ step: string; label: string; status: string }>;
};

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function MarketBrief() {
  const [result, setResult] = useState<MarketBriefResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [refused, setRefused] = useState(false);

  async function analyzeMarket() {
    setStatus("loading");
    setMessage("");
    setRefused(false);
    setResult(null);
    try {
      const response = await fetch("/api/market-brief", { method: "POST" });
      const payload = (await response.json()) as MarketBriefResponse & {
        message?: string;
        refusal?: boolean;
      };
      if (!response.ok) {
        setRefused(payload.refusal === true);
        throw new Error(payload.message ?? "無法產生研究摘要。");
      }
      setResult(payload);
      setStatus("idle");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法產生研究摘要。");
      setStatus("error");
    }
  }

  return (
    <section className="ai-brief" aria-labelledby="ai-brief-heading">
      <div className="ai-brief__intro">
        <div className="ai-brief__intro-copy">
          <div className="ai-brief__label">
            <span>AI</span>
            <p>AI MARKET RESEARCH</p>
          </div>
          <h2 id="ai-brief-heading">現在像哪一段市場？</h2>
          <p>
            把今天的市場寬度與價格位置交給 AI，比對三個歷史相似案例，計算當時後續表現，再用聯準會官方文件補充可追溯的背景。
          </p>
          <ol className="ai-brief__steps" aria-label="AI 研究流程">
            <li><span>1</span>讀取目前市場</li>
            <li><span>2</span>尋找歷史案例</li>
            <li><span>3</span>檢索官方文件</li>
            <li><span>4</span>檢查答案品質</li>
          </ol>
        </div>
        <div className="ai-brief__action">
          <p>約需 20–30 秒</p>
          <button
            className="ai-brief__button"
            type="button"
            onClick={analyzeMarket}
            disabled={status === "loading"}
          >
            {status === "loading" ? "正在研究市場…" : result ? "重新分析" : "分析目前市場"}
          </button>
          <small>研究用途 · 不提供買賣指令</small>
        </div>
      </div>

      {status === "loading" && (
        <div className="ai-brief__loading" role="status">
          <span />
          <div>
            <strong>研究流程執行中</strong>
            <p>市場資料 → 歷史案例 → FOMC 文件 → AI 摘要 → 品質檢查</p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="ai-brief__error" role="alert">
          <strong>
            {refused ? "本次未顯示 AI 結論" : "暫時無法產生 Market Brief"}
          </strong>
          <p>{message}</p>
        </div>
      )}

      {result && status !== "loading" && (
        <div className="ai-report">
          <div className="ai-report__header">
            <div>
              <span>AI MARKET BRIEF</span>
              <h3>{result.brief.headline}</h3>
            </div>
            <div className={`eval-badge ${result.evaluation.passed ? "is-passed" : "is-warning"}`}>
              {result.evaluation.passed ? "EVAL PASSED" : "REVIEW NEEDED"}
            </div>
          </div>

          <div className="ai-report__summary">
            {result.brief.summary.map((item) => <p key={item}>{item}</p>)}
          </div>

          <div className="ai-report__grid">
            <section>
              <p className="overline">EVIDENCE-BASED OBSERVATIONS</p>
              <div className="observation-list">
                {result.brief.observations.map((item) => (
                  <article key={`${item.label}-${item.detail}`}>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                    <small>{item.evidenceIds.join(" · ")}</small>
                  </article>
                ))}
              </div>
            </section>
            <aside>
              <p className="overline">NEXT TO WATCH</p>
              <ul>{result.brief.watchFor.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="overline ai-report__limit-title">LIMITS</p>
              <ul>{result.brief.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
            </aside>
          </div>

          <section className="analog-section">
            <div className="section-heading section-heading--compact">
              <div>
                <p className="overline">HISTORICAL CASES</p>
                <h3>三個歷史相似案例</h3>
                <p className="analog-section__description">
                  依目前的市場廣度與均線位置，找出狀態最接近的過往日期。
                </p>
              </div>
              <span>其後 20 個交易日表現</span>
            </div>
            <div className="analog-grid">
              {result.analogs.map((analog) => (
                <article key={analog.date}>
                  <div className="analog-card__top">
                    <strong>{analog.date}</strong>
                    <span>{analog.similarity}% 相似</span>
                  </div>
                  <p>{analog.reasons[0]}</p>
                  <dl>
                    <div><dt>SPX 報酬</dt><dd>{signed(analog.spxReturn20)}</dd></div>
                    <div><dt>QQQ 報酬</dt><dd>{signed(analog.qqqReturn20)}</dd></div>
                    <div><dt>SPX 最大回撤</dt><dd>{signed(analog.spxMaxDrawdown20)}</dd></div>
                    <div><dt>QQQ 最大回撤</dt><dd>{signed(analog.qqqMaxDrawdown20)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <div className="ai-report__footer-grid">
            <section>
              <p className="overline">RAG SOURCES</p>
              {result.ragStatus === "insufficient" && (
                <p className="rag-empty">
                  官方文件未達相關度門檻；本次報告不包含總經背景推論。
                </p>
              )}
              {result.evidence.map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noreferrer">
                  <strong>{item.title}</strong>
                  <span>{item.meetingDate} · Federal Reserve ↗</span>
                </a>
              ))}
            </section>
            <section>
              <p className="overline">AGENT TRACE</p>
              {result.trace.map((item, index) => (
                <div className="trace-row" key={`${item.step}-${item.label}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item.label}</p>
                  <strong>完成</strong>
                </div>
              ))}
            </section>
            <section>
              <p className="overline">AI EVALUATION</p>
              {result.evaluation.checks.map((check) => (
                <div className="eval-row" key={check.name} title={check.detail}>
                  <span>{check.passed ? "PASS" : "FAIL"}</span>
                  <p>{check.name}</p>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

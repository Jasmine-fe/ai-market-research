"use client";

import { FormEvent, useState } from "react";
import {
  failedCheckLabel,
  refusalReasonLabel,
} from "../lib/research-refusal-display";

const SUGGESTED_QUESTIONS = [
  "市場廣度轉弱時，FOMC 通常關注哪些金融市場風險？",
  "FOMC 如何看待通膨下降，但股市仍維持強勢的環境？",
  "就業市場降溫時，FOMC 對經濟衰退風險的判斷如何改變？",
];

type ResearchResponse = {
  generatedAt: string;
  model: string;
  question: string;
  query: {
    semantic: string;
    keywords: string[];
    explanation: string;
    asOf: string;
  };
  retrieval: {
    mode: "hybrid";
    semanticCandidates: number;
    keywordCandidates: number;
    evidence: Array<{
      id: string;
      title: string;
      meetingDate: string;
      publishedAt: string;
      sectionTitle: string;
      excerpt: string;
      url: string;
      matchedBy: "hybrid" | "semantic" | "keyword";
      semanticScore: number | null;
      keywordRank: number | null;
      hybridScore: number;
    }>;
  };
  answer: {
    headline: string;
    answerPoints: Array<{ text: string; citationIds: string[] }>;
    limitations: string[];
  };
  evaluation: {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
  };
};

function sourceNumbers(citationIds: string[], result: ResearchResponse) {
  return citationIds.flatMap((id) => {
    const index = result.retrieval.evidence.findIndex((item) => item.id === id);
    return index < 0 ? [] : [index + 1];
  });
}

export default function MarketBrief() {
  const [question, setQuestion] = useState(SUGGESTED_QUESTIONS[0]);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [refused, setRefused] = useState(false);
  const [errorCode, setErrorCode] = useState("");
  const [failedChecks, setFailedChecks] = useState<string[]>([]);
  const [requestId, setRequestId] = useState("");

  async function research(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 8) return;
    setStatus("loading");
    setMessage("");
    setRefused(false);
    setErrorCode("");
    setFailedChecks([]);
    setRequestId("");
    setResult(null);
    try {
      const response = await fetch("/api/market-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = (await response.json()) as ResearchResponse & {
        requestId?: string;
        error?: string;
        message?: string;
        refusal?: boolean;
        failedChecks?: string[];
      };
      if (!response.ok) {
        setRefused(payload.refusal === true);
        setErrorCode(payload.error ?? "");
        setFailedChecks(payload.failedChecks ?? []);
        setRequestId(payload.requestId ?? "");
        throw new Error(payload.message ?? "無法完成研究。");
      }
      setResult(payload);
      setStatus("idle");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法完成研究。");
      setStatus("error");
    }
  }

  return (
    <section className="research-lab" aria-labelledby="research-heading">
      <div className="research-lab__header">
        <div>
          <div className="research-lab__label"><span>AI</span> AI MARKET RESEARCH</div>
          <h2 id="research-heading">從歷史中學習</h2>
          <p>
            搜尋過去十年的 FOMC 聯準會會議紀錄，以 keyword 與 semantic hybrid search 找出證據，再由 AI 整理附引用的回答。
          </p>
        </div>
        <div className="research-lab__stack" aria-label="RAG 技術">
          <span>10 YEARS</span><span>VECTOR STORE</span><span>HYBRID SEARCH</span>
        </div>
      </div>

      <div className="research-prompt">
        <div className="research-prompt__suggestions">
          <p>從一個問題開始</p>
          {SUGGESTED_QUESTIONS.map((suggestion, index) => (
            <button
              type="button"
              className={question === suggestion ? "is-selected" : ""}
              onClick={() => setQuestion(suggestion)}
              key={suggestion}
            >
              <span>0{index + 1}</span>
              {suggestion}
            </button>
          ))}
        </div>

        <form className="research-prompt__form" onSubmit={research}>
          <label htmlFor="research-question">你的研究問題</label>
          <textarea
            id="research-question"
            value={question}
            maxLength={500}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="輸入市場、經濟或貨幣政策問題…"
          />
          <div>
            <small>回答只使用可追溯的 FOMC 官方文件</small>
            <button type="submit" disabled={status === "loading" || question.trim().length < 8}>
              {status === "loading" ? "研究中…" : "開始研究"}
            </button>
          </div>
        </form>
      </div>

      {status === "loading" && (
        <div className="research-status" role="status">
          <span />
          <div>
            <strong>正在搜尋官方證據</strong>
            <p>Query rewrite → Keyword + Semantic → Hybrid ranking → AI answer → Evaluation</p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="research-error" role="alert">
          <div>
            <strong>{refused ? "本次未產生研究結論" : "暫時無法完成研究"}</strong>
            {refused && (
              <div className="research-error__reason">
                <span>原因</span>
                <b>{refusalReasonLabel(errorCode)}</b>
              </div>
            )}
            <p>{message}</p>
            {failedChecks.length > 0 && (
              <div className="research-error__checks">
                <span>未通過的檢查</span>
                <ul>
                  {failedChecks.map((check) => (
                    <li key={check}>{failedCheckLabel(check)}</li>
                  ))}
                </ul>
              </div>
            )}
            {requestId && <small>Request ID · {requestId}</small>}
          </div>
        </div>
      )}

      {result && status !== "loading" && (
        <div className="research-result">
          <header className="research-answer__header">
            <div>
              <p>AI RESEARCH ANSWER</p>
              <h3>{result.answer.headline}</h3>
              <small>{result.question}</small>
            </div>
            <span className="research-pass">EVAL PASSED</span>
          </header>

          <div className="research-answer">
            {result.answer.answerPoints.map((point, index) => (
              <article key={`${index}-${point.text}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{point.text}</p>
                <div className="research-answer__citations" aria-label="引用來源">
                  {sourceNumbers(point.citationIds, result).map((number) => (
                    <a href={`#fomc-source-${number}`} key={number}>[{number}]</a>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="research-limit">
            <strong>研究限制</strong>
            {result.answer.limitations.map((item) => <p key={item}>{item}</p>)}
          </div>

          <section className="research-evidence" aria-labelledby="evidence-heading">
            <div className="research-section-heading">
              <div>
                <p>RETRIEVED EVIDENCE</p>
                <h3 id="evidence-heading">FOMC 引用證據</h3>
              </div>
              <span>{result.retrieval.evidence.length} CHUNKS</span>
            </div>
            <div className="research-evidence__list">
              {result.retrieval.evidence.map((item, index) => (
                <article id={`fomc-source-${index + 1}`} key={item.id}>
                  <div className="research-evidence__meta">
                    <span>[{index + 1}]</span>
                    <div>
                      <strong>{item.sectionTitle}</strong>
                      <p>Meeting {item.meetingDate} · Published {item.publishedAt}</p>
                    </div>
                    <em>{item.matchedBy.toUpperCase()}</em>
                  </div>
                  <blockquote>{item.excerpt}</blockquote>
                  <div className="research-evidence__footer">
                    <span>Hybrid {item.hybridScore}</span>
                    {item.semanticScore != null && <span>Semantic {item.semanticScore}</span>}
                    {item.keywordRank != null && <span>Keyword rank {item.keywordRank}</span>}
                    <a href={item.url} target="_blank" rel="noreferrer">Federal Reserve 原文 ↗</a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="research-details-grid">
            <details>
              <summary>查看 Hybrid Search 詳細資料</summary>
              <dl>
                <div><dt>Semantic query</dt><dd>{result.query.semantic}</dd></div>
                <div><dt>Keywords</dt><dd>{result.query.keywords.join(" · ")}</dd></div>
                <div><dt>Query rewrite</dt><dd>{result.query.explanation}</dd></div>
                <div><dt>Temporal filter</dt><dd>published_at ≤ {result.query.asOf}</dd></div>
                <div><dt>Candidate pool</dt><dd>Semantic {result.retrieval.semanticCandidates} · Keyword {result.retrieval.keywordCandidates}</dd></div>
              </dl>
            </details>
            <section>
              <p>AI EVALUATION</p>
              {result.evaluation.checks.map((check) => (
                <div className="research-check" key={check.name} title={check.detail}>
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

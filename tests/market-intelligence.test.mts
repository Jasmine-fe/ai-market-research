import assert from "node:assert/strict";
import test from "node:test";
import {
  rankHistoricalAnalogs,
  toFeatures,
  type CombinedHistoryPoint,
} from "../lib/market-intelligence.ts";
import { evaluateBrief, type MarketBriefContent } from "../lib/brief-evaluation.ts";
import {
  isMarketDateFresh,
  selectRelevantEvidence,
} from "../lib/research-guardrails.ts";
import { parseBreadthSnapshot } from "../lib/barchart-breadth.ts";

function history(scale: number): CombinedHistoryPoint[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: 180 }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    price: scale * (100 + index * 0.18 + Math.sin(index / 8) * 4),
    breadth: 52 + Math.sin(index / 7) * 22 + Math.cos(index / 19) * 8,
  }));
}

test("feature extraction uses only information available on each date", () => {
  const points = history(1);
  const features = toFeatures(points);
  assert.equal(features.length, points.length - 59);
  assert.equal(features[0].date, points[59].date);
  assert.ok(Number.isFinite(features[0].bias20));
  assert.ok(Number.isFinite(features[0].breadthMomentum5));
});

test("analog tool returns three past cases with forward outcomes", () => {
  const result = rankHistoricalAnalogs(history(1), history(1.8));
  assert.equal(result.analogs.length, 3);
  assert.ok(result.analogs.every((item) => item.date < result.current.spx.date));
  assert.ok(result.analogs.every((item) => Number.isFinite(item.spxReturn20)));
});

test("evaluation rejects invented citations and trading instructions", () => {
  const brief: MarketBriefContent = {
    headline: "測試摘要",
    summary: ["市場資料摘要。", "歷史結果摘要。"],
    observations: [
      { label: "觀察一", detail: "建議買進。", evidenceIds: ["invented-source"] },
      { label: "觀察二", detail: "資料顯示分歧。", evidenceIds: ["market:spx-current"] },
    ],
    watchFor: ["Breadth 是否擴張"],
    limitations: ["歷史不代表未來"],
  };
  const checks = evaluateBrief(brief, [], []);
  assert.equal(checks.find((item) => item.name === "引用可追溯")?.passed, false);
  assert.equal(checks.find((item) => item.name === "無交易指令")?.passed, false);
});

test("RAG drops weak evidence and keeps one result per document", () => {
  const base = {
    meetingDate: "2025-06-18",
    title: "FOMC minutes",
    url: "https://www.federalreserve.gov/example",
    excerpt: "Evidence",
  };
  const selected = selectRelevantEvidence(
    [
      { ...base, id: "strong", relevance: 61 },
      { ...base, id: "strong", relevance: 52 },
      { ...base, id: "weak", relevance: 24 },
    ],
    25,
  );
  assert.deepEqual(selected.map((item) => item.id), ["strong"]);
});

test("market freshness allows recent closes and rejects stale data", () => {
  const now = new Date("2026-08-12T12:00:00Z");
  assert.equal(isMarketDateFresh("2026-08-11", now), true);
  assert.equal(isMarketDateFresh("2026-08-01", now), false);
});

test("evaluation rejects numbers that are absent from tool results", () => {
  const brief: MarketBriefContent = {
    headline: "市場寬度為 77.77%",
    summary: ["量化資料摘要。", "歷史資料摘要。"],
    observations: [
      { label: "市場", detail: "SPX Breadth 為 77.77%。", evidenceIds: ["market:spx-current"] },
      { label: "限制", detail: "歷史不代表未來。", evidenceIds: ["market:qqq-current"] },
    ],
    watchFor: ["Breadth 是否擴張"],
    limitations: ["歷史不代表未來"],
  };
  const checks = evaluateBrief(
    brief,
    [],
    [],
    { spx: { breadth: 63.61 }, qqq: { breadth: 64.7 } },
    [true, true],
  );
  assert.equal(checks.find((item) => item.name === "數字有根據")?.passed, false);
});

test("evaluation fails closed when a cited source does not support a claim", () => {
  const brief: MarketBriefContent = {
    headline: "市場研究",
    summary: ["量化資料摘要。", "歷史資料摘要。"],
    observations: [
      { label: "市場", detail: "市場參與度偏高。", evidenceIds: ["market:spx-current"] },
      { label: "限制", detail: "歷史不代表未來。", evidenceIds: ["market:qqq-current"] },
    ],
    watchFor: ["Breadth 是否擴張"],
    limitations: ["歷史不代表未來"],
  };
  const checks = evaluateBrief(
    brief,
    [],
    [],
    { spx: {}, qqq: {} },
    [true, false],
  );
  assert.equal(checks.find((item) => item.name === "引用支持主張")?.passed, false);
});

test("evaluation accepts dates and a safely rounded index level", () => {
  const brief: MarketBriefContent = {
    headline: "市場研究",
    summary: ["SPX 約為 7730。", "歷史案例日期為 2021-06-08。"],
    observations: [
      {
        label: "市場",
        detail: "SPX 約為 7730。",
        evidenceIds: ["market:spx-current"],
      },
      {
        label: "案例",
        detail: "案例日期為 2021-06-08。",
        evidenceIds: ["analog:2021-06-08"],
      },
    ],
    watchFor: ["Breadth 是否擴張"],
    limitations: ["歷史不代表未來"],
  };
  const analog = {
    date: "2021-06-08",
    similarity: 90,
    spxReturn20: 3.1,
    qqqReturn20: 7.18,
    spxMaxDrawdown20: -1.44,
    qqqMaxDrawdown20: 0.02,
    reasons: ["Breadth 63.61%"],
  };
  const checks = evaluateBrief(
    brief,
    [analog],
    [],
    { spx: { date: "2026-08-11", price: 7728.2 }, qqq: {} },
    [true, true],
  );
  assert.equal(checks.find((item) => item.name === "數字有根據")?.passed, true);
});

test("evaluation allows explicit no-trading-advice disclaimers", () => {
  const brief: MarketBriefContent = {
    headline: "市場研究",
    summary: ["量化資料摘要。", "歷史資料摘要。"],
    observations: [
      { label: "市場", detail: "市場參與度分歧。", evidenceIds: ["market:spx-current"] },
      { label: "限制", detail: "歷史不代表未來。", evidenceIds: ["market:qqq-current"] },
    ],
    watchFor: ["Breadth 是否擴張"],
    limitations: ["未提供可操作的買賣建議，也不能保證未來走勢。"],
  };
  const checks = evaluateBrief(brief, [], [], { spx: {}, qqq: {} }, [true, true]);
  assert.equal(checks.find((item) => item.name === "無交易指令")?.passed, true);
});

test("Barchart parser keeps an unchanged Breadth quote", () => {
  const html = `
    <div data-ng-init='quote={"symbol":"$S5TW","symbolName":"S&P 500 Stocks Above 20-Day Average","symbolType":9,"lastPrice":"63.61","priceChange":"unch","percentChange":"unch","tradeTime":"21:49 ET","sessionDateDisplayLong":"Wed, Aug 12th, 2026"}'></div>
    <script>{"highPrice1y":84.5,"lowPrice1y":12.25}</script>
  `;
  assert.deepEqual(parseBreadthSnapshot(html, "S5TW"), {
    value: 63.61,
    changePoints: 0,
    tradeDate: "2026/08/12",
    high52w: 84.5,
    low52w: 12.25,
  });
});

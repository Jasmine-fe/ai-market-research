import type { HistoricalAnalog } from "./market-intelligence";

export type MarketBriefContent = {
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

export type EvaluationCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type CurrentMarketEvidence = {
  spx: Record<string, string | number>;
  qqq: Record<string, string | number>;
};

function textForNumericReview(brief: MarketBriefContent) {
  return [
    brief.headline,
    ...brief.summary,
    ...brief.observations.flatMap((item) => [item.label, item.detail]),
    ...brief.watchFor,
    ...brief.limitations,
  ].join(" ");
}

const NUMBER_PATTERN = /(?<!\d)[-+]?\d+(?:\.\d+)?/g;

function isGroundedNumber(mentioned: number, allowed: number[]) {
  return allowed.some((value) => {
    const isSourceValueRoundedToInteger =
      Number.isInteger(mentioned) &&
      (mentioned === Math.round(value) || mentioned === Math.trunc(value));
    if (isSourceValueRoundedToInteger) return true;

    const absoluteTolerance = 0.11;
    const roundedIndexTolerance =
      Number.isInteger(mentioned) && Math.abs(value) >= 100
        ? Math.abs(value) * 0.001
        : 0;
    return Math.abs(value - mentioned) <= Math.max(
      absoluteTolerance,
      roundedIndexTolerance,
    );
  });
}

function containsTradingInstruction(text: string) {
  return (
    /(?:建議|應|可以|可考慮|適合).{0,8}(?:買進|賣出|加碼|減碼)/.test(text) ||
    /(?:買進|賣出|加碼|減碼).{0,8}(?:建議|時機|訊號)/.test(text) ||
    /(?:保證|必然|穩賺).{0,8}(?:獲利|報酬|上漲|下跌)/.test(text)
  );
}

function collectAllowedNumbers(
  current: CurrentMarketEvidence,
  analogs: HistoricalAnalog[],
  evidence: Array<{ id: string }>,
) {
  const allowed = new Set<number>([3, 5, 20, 60]);
  const addValue = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) allowed.add(value);
    if (typeof value === "string") {
      for (const match of value.matchAll(NUMBER_PATTERN)) {
        allowed.add(Number(match[0]));
      }
    }
  };
  Object.values(current.spx).forEach(addValue);
  Object.values(current.qqq).forEach(addValue);
  analogs.forEach((analog) => Object.values(analog).forEach(addValue));
  evidence.forEach((item) => addValue(item.id));
  return [...allowed];
}

export function findUngroundedNumbers(
  brief: MarketBriefContent,
  current: CurrentMarketEvidence,
  analogs: HistoricalAnalog[],
  evidence: Array<{ id: string }>,
) {
  const allowed = collectAllowedNumbers(current, analogs, evidence);
  const mentioned = [...textForNumericReview(brief).matchAll(NUMBER_PATTERN)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
  return [...new Set(mentioned.filter((number) => !isGroundedNumber(number, allowed)))];
}

export function evaluateBrief(
  brief: MarketBriefContent,
  analogs: HistoricalAnalog[],
  evidence: Array<{ id: string }>,
  current: CurrentMarketEvidence = { spx: {}, qqq: {} },
  claimSupport: boolean[] = brief.observations.map(() => true),
): EvaluationCheck[] {
  const validIds = new Set([
    "market:spx-current",
    "market:qqq-current",
    ...analogs.map((analog) => `analog:${analog.date}`),
    ...evidence.map((item) => item.id),
  ]);
  const referencedIds = brief.observations.flatMap((item) => item.evidenceIds);
  const allText = JSON.stringify(brief);
  const ungroundedNumbers = findUngroundedNumbers(
    brief,
    current,
    analogs,
    evidence,
  );

  return [
    {
      name: "結構完整",
      passed:
        brief.summary.length >= 2 &&
        brief.observations.length >= 2 &&
        brief.watchFor.length >= 1 &&
        brief.limitations.length >= 1,
      detail: "摘要、證據、觀察條件與限制皆需存在。",
    },
    {
      name: "引用可追溯",
      passed:
        referencedIds.length > 0 && referencedIds.every((id) => validIds.has(id)),
      detail: "AI 只能引用本次工具與 RAG 實際回傳的證據 ID。",
    },
    {
      name: "引用支持主張",
      passed:
        claimSupport.length === brief.observations.length &&
        claimSupport.every(Boolean),
      detail: "每一項觀察都必須由其引用的市場資料或文件內容支持。",
    },
    {
      name: "數字有根據",
      passed: ungroundedNumbers.length === 0,
      detail:
        ungroundedNumbers.length === 0
          ? "報告中的數字皆可追溯至工具結果。"
          : `發現未經工具結果支持的數字：${ungroundedNumbers.join("、")}`,
    },
    {
      name: "無交易指令",
      passed: !containsTradingInstruction(allText),
      detail: "報告不得產生買賣或保證獲利等指令。",
    },
    {
      name: "歷史結果齊全",
      passed: analogs.length === 3 && analogs.every((item) => Number.isFinite(item.spxReturn20)),
      detail: "三個相似案例皆由計算工具提供 20 日結果。",
    },
  ];
}

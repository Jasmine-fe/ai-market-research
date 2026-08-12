import OpenCC from "opencc-js";
import type { MarketBriefContent } from "./brief-evaluation";

const toTaiwanTraditional = OpenCC.Converter({ from: "cn", to: "tw" });

export function normalizeResearchText(text: string) {
  return toTaiwanTraditional(text)
    .replaceAll("歷史類比", "歷史相似案例")
    .replaceAll("類比案例", "相似案例")
    .replaceAll("類比", "相似案例");
}

export function normalizeMarketBriefLanguage(
  brief: MarketBriefContent,
): MarketBriefContent {
  return {
    ...brief,
    headline: normalizeResearchText(brief.headline),
    summary: brief.summary.map(normalizeResearchText),
    observations: brief.observations.map((item) => ({
      ...item,
      label: normalizeResearchText(item.label),
      detail: normalizeResearchText(item.detail),
    })),
    watchFor: brief.watchFor.map(normalizeResearchText),
    limitations: brief.limitations.map(normalizeResearchText),
  };
}

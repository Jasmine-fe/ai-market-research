import { embedTexts } from "./openai";
import { selectRelevantEvidence } from "./research-guardrails";

type FomcDocument = {
  id: string;
  meetingDate: string;
  title: string;
  url: string;
};

export type FomcEvidence = FomcDocument & {
  excerpt: string;
  relevance: number;
};

export const DEFAULT_RAG_MIN_RELEVANCE = 25;

const FOMC_DOCUMENTS: FomcDocument[] = [
  ["2021-01-27", "2021 年 1 月 FOMC 會議紀錄"],
  ["2021-03-17", "2021 年 3 月 FOMC 會議紀錄"],
  ["2021-04-28", "2021 年 4 月 FOMC 會議紀錄"],
  ["2021-06-16", "2021 年 6 月 FOMC 會議紀錄"],
  ["2021-07-28", "2021 年 7 月 FOMC 會議紀錄"],
  ["2021-09-22", "2021 年 9 月 FOMC 會議紀錄"],
  ["2021-11-03", "2021 年 11 月 FOMC 會議紀錄"],
  ["2021-12-15", "2021 年 12 月 FOMC 會議紀錄"],
  ["2022-01-26", "2022 年 1 月 FOMC 會議紀錄"],
  ["2022-03-16", "2022 年 3 月 FOMC 會議紀錄"],
  ["2022-05-04", "2022 年 5 月 FOMC 會議紀錄"],
  ["2022-06-15", "2022 年 6 月 FOMC 會議紀錄"],
  ["2022-07-27", "2022 年 7 月 FOMC 會議紀錄"],
  ["2022-09-21", "2022 年 9 月 FOMC 會議紀錄"],
  ["2022-11-02", "2022 年 11 月 FOMC 會議紀錄"],
  ["2022-12-14", "2022 年 12 月 FOMC 會議紀錄"],
  ["2023-02-01", "2023 年 2 月 FOMC 會議紀錄"],
  ["2023-03-22", "2023 年 3 月 FOMC 會議紀錄"],
  ["2023-05-03", "2023 年 5 月 FOMC 會議紀錄"],
  ["2023-06-14", "2023 年 6 月 FOMC 會議紀錄"],
  ["2023-07-26", "2023 年 7 月 FOMC 會議紀錄"],
  ["2023-09-20", "2023 年 9 月 FOMC 會議紀錄"],
  ["2023-11-01", "2023 年 11 月 FOMC 會議紀錄"],
  ["2023-12-13", "2023 年 12 月 FOMC 會議紀錄"],
  ["2024-01-31", "2024 年 1 月 FOMC 會議紀錄"],
  ["2024-03-20", "2024 年 3 月 FOMC 會議紀錄"],
  ["2024-05-01", "2024 年 5 月 FOMC 會議紀錄"],
  ["2024-06-12", "2024 年 6 月 FOMC 會議紀錄"],
  ["2024-07-31", "2024 年 7 月 FOMC 會議紀錄"],
  ["2024-09-18", "2024 年 9 月 FOMC 會議紀錄"],
  ["2024-11-07", "2024 年 11 月 FOMC 會議紀錄"],
  ["2024-12-18", "2024 年 12 月 FOMC 會議紀錄"],
  ["2025-01-29", "2025 年 1 月 FOMC 會議紀錄"],
  ["2025-03-19", "2025 年 3 月 FOMC 會議紀錄"],
  ["2025-05-07", "2025 年 5 月 FOMC 會議紀錄"],
  ["2025-06-18", "2025 年 6 月 FOMC 會議紀錄"],
  ["2025-07-30", "2025 年 7 月 FOMC 會議紀錄"],
  ["2025-09-17", "2025 年 9 月 FOMC 會議紀錄"],
  ["2025-10-29", "2025 年 10 月 FOMC 會議紀錄"],
  ["2025-12-10", "2025 年 12 月 FOMC 會議紀錄"],
  ["2026-01-28", "2026 年 1 月 FOMC 會議紀錄"],
  ["2026-03-18", "2026 年 3 月 FOMC 會議紀錄"],
  ["2026-04-29", "2026 年 4 月 FOMC 會議紀錄"],
  ["2026-06-17", "2026 年 6 月 FOMC 會議紀錄"],
].map(([meetingDate, title]) => ({
  id: `fomc-${meetingDate}`,
  meetingDate,
  title,
  url: `https://www.federalreserve.gov/monetarypolicy/fomcminutes${meetingDate.replaceAll("-", "")}.htm`,
}));

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractChunks(html: string) {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((text) => text.length >= 180 && text.length <= 1800)
    .slice(0, 80);
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function nearestDocuments(dates: string[]) {
  const unique = new Map<string, FomcDocument>();
  for (const date of dates) {
    const timestamp = Date.parse(date);
    const nearest = [...FOMC_DOCUMENTS].sort(
      (a, b) =>
        Math.abs(Date.parse(a.meetingDate) - timestamp) -
        Math.abs(Date.parse(b.meetingDate) - timestamp),
    )[0];
    unique.set(nearest.id, nearest);
  }
  return [...unique.values()];
}

export async function retrieveFomcEvidenceTool(
  analogDates: string[],
  marketQuery: string,
  minimumRelevance = Number(
    process.env.RAG_MIN_RELEVANCE ?? DEFAULT_RAG_MIN_RELEVANCE,
  ),
): Promise<FomcEvidence[]> {
  const documents = nearestDocuments(analogDates);
  const fetched = await Promise.all(
    documents.map(async (document) => {
      const response = await fetch(document.url, {
        headers: {
          accept: "text/html",
          "user-agent": "Mozilla/5.0 (compatible; MarketMemoRAG/1.0)",
        },
        cache: "force-cache",
      });
      if (!response.ok) return [];
      return extractChunks(await response.text()).map((text) => ({ document, text }));
    }),
  );
  const chunks = fetched.flat().slice(0, 36);
  if (!chunks.length) return [];

  const query = `${marketQuery}。尋找當時關於通膨、就業、金融市場、政策風險與經濟展望的官方證據。`;
  const vectors = await embedTexts([query, ...chunks.map((chunk) => chunk.text)]);
  const [queryVector, ...chunkVectors] = vectors;
  const ranked = chunks
    .map((chunk, index) => ({
      ...chunk.document,
      excerpt: chunk.text,
      relevance: Math.round(
        cosineSimilarity(queryVector, chunkVectors[index]) * 100,
      ),
    }));
  return selectRelevantEvidence(ranked, minimumRelevance);
}

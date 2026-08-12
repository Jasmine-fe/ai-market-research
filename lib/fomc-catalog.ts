import { htmlToText } from "./fomc-chunking";

export type FomcCatalogDocument = {
  id: string;
  meetingDate: string;
  title: string;
  url: string;
};

const FED_BASE = "https://www.federalreserve.gov";

function dateFromId(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export async function fetchTenYearFomcCatalog(now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const firstYear = currentYear - 10;
  const pages: string[] = [];

  for (let year = firstYear; year <= Math.min(2020, currentYear); year += 1) {
    pages.push(`${FED_BASE}/monetarypolicy/fomchistorical${year}.htm`);
  }
  if (currentYear >= 2021) {
    pages.push(`${FED_BASE}/monetarypolicy/fomccalendars.htm`);
  }

  const htmlPages = await Promise.all(
    pages.map(async (url) => {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; MarketMemoIndexer/1.0)" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`FOMC catalog unavailable: ${response.status}`);
      return response.text();
    }),
  );

  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 10);
  const documents = new Map<string, FomcCatalogDocument>();
  for (const html of htmlPages) {
    for (const match of html.matchAll(/(?:href=["'])([^"']*fomcminutes(20\d{6})\.htm)/gi)) {
      const compactDate = match[2];
      const meetingDate = dateFromId(compactDate);
      if (Date.parse(`${meetingDate}T00:00:00Z`) < cutoff.getTime()) continue;
      documents.set(compactDate, {
        id: `fomc-${meetingDate}`,
        meetingDate,
        title: `FOMC Minutes · ${meetingDate}`,
        url: new URL(match[1], FED_BASE).toString(),
      });
    }
  }
  return [...documents.values()].sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
}

export function extractPublishedAt(html: string, meetingDate: string) {
  const match = html.match(/Last Update:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (match) {
    const parsed = Date.parse(htmlToText(match[1]));
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  const fallback = new Date(`${meetingDate}T00:00:00Z`);
  fallback.setUTCDate(fallback.getUTCDate() + 21);
  return fallback.toISOString().slice(0, 10);
}

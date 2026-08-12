export function selectRelevantEvidence<T extends { id: string; relevance: number }>(
  items: T[],
  minimumRelevance: number,
) {
  return [...items]
    .sort((a, b) => b.relevance - a.relevance)
    .filter(
      (item, index, all) =>
        index === all.findIndex((candidate) => candidate.id === item.id),
    )
    .filter((item) => item.relevance >= minimumRelevance)
    .slice(0, 3);
}

export function isMarketDateFresh(
  date: string,
  now = new Date(),
  maximumAgeDays = 5,
) {
  const marketTime = Date.parse(`${date}T23:59:59Z`);
  if (!Number.isFinite(marketTime)) return false;
  const age = now.getTime() - marketTime;
  return age >= -86_400_000 && age <= maximumAgeDays * 86_400_000;
}

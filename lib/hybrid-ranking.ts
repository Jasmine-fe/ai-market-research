export type HybridCandidate = {
  id: string;
  documentId: string;
  semanticScore?: number;
  semanticRank?: number;
  keywordRank?: number;
  rrfScore: number;
};

export function fuseHybridRanks(
  semantic: Array<{ id: string; documentId: string; score: number }>,
  keyword: Array<{ id: string; documentId: string }>,
  limit = 6,
) {
  const candidates = new Map<string, HybridCandidate>();
  const get = (id: string, documentId: string) => {
    const current = candidates.get(id) ?? { id, documentId, rrfScore: 0 };
    candidates.set(id, current);
    return current;
  };

  semantic.forEach((item, index) => {
    const candidate = get(item.id, item.documentId);
    candidate.semanticScore = item.score;
    candidate.semanticRank = index + 1;
    candidate.rrfScore += 1 / (60 + index + 1);
  });
  keyword.forEach((item, index) => {
    const candidate = get(item.id, item.documentId);
    candidate.keywordRank = index + 1;
    candidate.rrfScore += 1 / (60 + index + 1);
  });

  const ranked = [...candidates.values()].sort((a, b) => b.rrfScore - a.rrfScore);
  const selected: HybridCandidate[] = [];
  const perDocument = new Map<string, number>();
  for (const candidate of ranked) {
    if ((perDocument.get(candidate.documentId) ?? 0) >= 2) continue;
    selected.push(candidate);
    perDocument.set(candidate.documentId, (perDocument.get(candidate.documentId) ?? 0) + 1);
    if (selected.length === limit) break;
  }
  return selected;
}

export function hasRetrievalCandidates(retrieval: {
  semanticCandidates: number;
  keywordCandidates: number;
}) {
  return retrieval.semanticCandidates > 0 || retrieval.keywordCandidates > 0;
}

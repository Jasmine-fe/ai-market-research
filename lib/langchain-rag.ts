import { Document } from "@langchain/core/documents";
import { RunnableLambda } from "@langchain/core/runnables";
import {
  hybridSearchFomc,
  type HybridSearchEvidence,
  type QueryRewrite,
} from "./hybrid-search";

export type FomcDocumentMetadata = Omit<HybridSearchEvidence, "excerpt">;

export type LangChainRetrievalResult = {
  documents: Array<Document<FomcDocumentMetadata>>;
  semanticCandidates: number;
  keywordCandidates: number;
};

export type HybridRetrieverInput = {
  rewrite: QueryRewrite;
  asOf: string;
};

export const fomcHybridRetriever = RunnableLambda.from(
  async ({ rewrite, asOf }: HybridRetrieverInput): Promise<LangChainRetrievalResult> => {
    const retrieval = await hybridSearchFomc(rewrite, asOf);
    return {
      semanticCandidates: retrieval.semanticCandidates,
      keywordCandidates: retrieval.keywordCandidates,
      documents: retrieval.evidence.map(
        ({ excerpt, ...metadata }) =>
          new Document<FomcDocumentMetadata>({
            pageContent: excerpt,
            metadata,
          }),
      ),
    };
  },
).withConfig({ runName: "fomc_hybrid_retriever" });

export function evidenceFromDocuments(
  documents: Array<Document<FomcDocumentMetadata>>,
): HybridSearchEvidence[] {
  return documents.map((document) => ({
    ...document.metadata,
    excerpt: document.pageContent,
  }));
}

export function evidencePayloadFromDocuments(
  documents: Array<Document<FomcDocumentMetadata>>,
) {
  return documents.map((document) => ({
    id: document.metadata.id,
    meetingDate: document.metadata.meetingDate,
    publishedAt: document.metadata.publishedAt,
    sectionTitle: document.metadata.sectionTitle,
    excerpt: document.pageContent,
    sourceUrl: document.metadata.url,
  }));
}

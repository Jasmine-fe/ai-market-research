import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const marketBriefExecutions = sqliteTable("market_brief_executions", {
  id: text("id").primaryKey(),
  requestedAt: text("requested_at").notNull(),
  completedAt: text("completed_at").notNull(),
  durationMs: integer("duration_ms").notNull(),
  status: text("status").notNull(),
  model: text("model"),
  ragStatus: text("rag_status"),
  summaryJson: text("summary_json").notNull(),
});

export const fomcDocuments = sqliteTable(
  "fomc_documents",
  {
    id: text("id").primaryKey(),
    meetingDate: text("meeting_date").notNull(),
    publishedAt: text("published_at").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    contentHash: text("content_hash").notNull(),
    chunkingVersion: text("chunking_version").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    embeddingDimensions: integer("embedding_dimensions").notNull(),
    chunkCount: integer("chunk_count").notNull(),
    indexedAt: text("indexed_at").notNull(),
  },
  (table) => [
    index("idx_fomc_documents_meeting_date").on(table.meetingDate),
    index("idx_fomc_documents_published_at").on(table.publishedAt),
  ],
);

export const fomcChunks = sqliteTable(
  "fomc_chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => fomcDocuments.id, { onDelete: "cascade" }),
    sectionTitle: text("section_title").notNull(),
    sectionIndex: integer("section_index").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: blob("embedding", { mode: "buffer" }).notNull(),
  },
  (table) => [index("idx_fomc_chunks_document_id").on(table.documentId)],
);

export const fomcIngestionRuns = sqliteTable("fomc_ingestion_runs", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull(),
  documentsIndexed: integer("documents_indexed").notNull(),
  chunksIndexed: integer("chunks_indexed").notNull(),
  errorMessage: text("error_message"),
});

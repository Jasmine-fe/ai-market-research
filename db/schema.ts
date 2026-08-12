import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

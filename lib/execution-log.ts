export type ExecutionStatus = "success" | "refused" | "error";

export type ExecutionLogSummary = {
  requestId: string;
  requestedAt: string;
  completedAt: string;
  durationMs: number;
  status: ExecutionStatus;
  model?: string;
  ragStatus?: "grounded" | "insufficient";
  analogDates?: string[];
  evidence?: Array<{ id: string; relevance: number }>;
  steps?: Array<{ step: string; status: string; attempt?: number }>;
  failedChecks?: string[];
  errorCode?: string;
  question?: string;
  queryRewrite?: { semantic?: string; keywords?: string[] };
  retrievedChunks?: string[];
  searchStats?: { semanticCandidates?: number; keywordCandidates?: number };
  evaluationChecks?: Array<{ name: string; passed: boolean }>;
  workflow?: {
    framework: "LangGraph";
    corrections: number;
    retrievalAttempts: number;
    generationAttempts: number;
    correctionReason?: string;
  };
};

const CREATE_EXECUTION_TABLE = `
  CREATE TABLE IF NOT EXISTS market_brief_executions (
    id TEXT PRIMARY KEY NOT NULL,
    requested_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    model TEXT,
    rag_status TEXT,
    summary_json TEXT NOT NULL
  )
`;

let schemaReady: Promise<void> | undefined;

class CloudflareRuntimeUnavailable extends Error {}

type ExecutionDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
    };
    run(): Promise<unknown>;
  };
};

async function getExecutionDatabase() {
  let runtime: typeof import("cloudflare:workers");
  try {
    runtime = await import("cloudflare:workers");
  } catch {
    throw new CloudflareRuntimeUnavailable();
  }
  const database = (runtime.env as { DB?: ExecutionDatabase }).DB;
  if (!database) throw new Error("D1 binding DB is unavailable");
  return database;
}

async function appendLocalExecutionLog(summary: ExecutionLogSummary) {
  const [{ appendFile, mkdir }, { dirname, resolve }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const path = resolve(
    process.cwd(),
    process.env.EXECUTION_LOG_PATH ??
      ".local-data/market-brief-executions.jsonl",
  );
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(summary)}\n`, "utf8");
}

async function ensureExecutionTable(database: ExecutionDatabase) {
  schemaReady ??= database.prepare(CREATE_EXECUTION_TABLE)
    .run()
    .then(() => undefined)
    .catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  await schemaReady;
}

export async function appendExecutionLog(summary: ExecutionLogSummary) {
  let database: ExecutionDatabase;
  try {
    database = await getExecutionDatabase();
  } catch (error) {
    if (error instanceof CloudflareRuntimeUnavailable) {
      await appendLocalExecutionLog(summary);
      return;
    }
    throw error;
  }
  await ensureExecutionTable(database);
  await database.prepare(
    `INSERT INTO market_brief_executions (
      id, requested_at, completed_at, duration_ms, status, model, rag_status, summary_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      summary.requestId,
      summary.requestedAt,
      summary.completedAt,
      summary.durationMs,
      summary.status,
      summary.model ?? null,
      summary.ragStatus ?? null,
      JSON.stringify({
        analogDates: summary.analogDates ?? [],
        evidence: summary.evidence ?? [],
        steps: summary.steps ?? [],
        failedChecks: summary.failedChecks ?? [],
        errorCode: summary.errorCode ?? null,
        question: summary.question ?? null,
        queryRewrite: summary.queryRewrite ?? null,
        retrievedChunks: summary.retrievedChunks ?? [],
        searchStats: summary.searchStats ?? null,
        evaluationChecks: summary.evaluationChecks ?? [],
        workflow: summary.workflow ?? null,
      }),
    )
    .run();
}

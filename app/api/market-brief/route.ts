import { appendExecutionLog, type ExecutionLogSummary } from "../../../lib/execution-log";
import { hasOpenAIKey, ModelRefusalError } from "../../../lib/openai";
import { ResearchRefusal, runMarketResearchAgent } from "../../../lib/research-agent";

export const dynamic = "force-dynamic";

async function persistExecution(summary: ExecutionLogSummary) {
  try {
    await appendExecutionLog(summary);
  } catch (error) {
    console.error("Failed to persist research execution", error);
  }
}

function completionFields(startedAt: Date) {
  const completedAt = new Date();
  return {
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = new Date();
  const requestedAt = startedAt.toISOString();
  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = body.question?.trim() ?? "";

  if (question.length < 8 || question.length > 500) {
    return Response.json(
      { error: "INVALID_QUESTION", message: "請輸入 8–500 個字的市場研究問題。" },
      { status: 400 },
    );
  }
  if (!hasOpenAIKey()) {
    return Response.json(
      { error: "AI_SERVICE_NOT_CONFIGURED", message: "AI 服務尚未完成設定。" },
      { status: 503 },
    );
  }

  try {
    const result = await runMarketResearchAgent(question);
    await persistExecution({
      requestId,
      requestedAt,
      ...completionFields(startedAt),
      status: "success",
      model: result.model,
      ragStatus: "grounded",
      question,
      queryRewrite: {
        semantic: result.query.semantic,
        keywords: result.query.keywords,
      },
      retrievedChunks: result.retrieval.evidence.map((item) => item.id),
      searchStats: {
        semanticCandidates: result.retrieval.semanticCandidates,
        keywordCandidates: result.retrieval.keywordCandidates,
      },
      evaluationChecks: result.evaluation.checks.map(({ name, passed }) => ({
        name,
        passed,
      })),
      workflow: result.workflow,
      steps: result.trace.map((item) => ({
        step: item.step,
        status: "completed",
        attempt: item.attempt,
      })),
    });
    return Response.json({ requestId, ...result });
  } catch (error) {
    if (error instanceof ResearchRefusal) {
      const details = (error.internalDetails ?? {}) as Record<string, unknown>;
      const evaluationChecks = Array.isArray(details.checks)
        ? (details.checks as Array<{ name?: unknown; passed?: unknown }>).flatMap((check) =>
            typeof check.name === "string" && typeof check.passed === "boolean"
              ? [{ name: check.name, passed: check.passed }]
              : [],
          )
        : undefined;
      const rewrite = details.rewrite as
        | { semanticQuery?: string; keywords?: string[] }
        | undefined;
      const retrieval = details.retrieval as
        | { semanticCandidates?: number; keywordCandidates?: number }
        | undefined;
      const trace = Array.isArray(details.trace)
        ? (details.trace as Array<{ step?: unknown; attempt?: unknown }>).flatMap((item) =>
            typeof item.step === "string"
              ? [{
                  step: item.step,
                  status: "completed",
                  attempt: typeof item.attempt === "number" ? item.attempt : undefined,
                }]
              : [],
          )
        : undefined;
      console.warn("Market research refused", error.code, {
        requestId,
        evaluationChecks,
      });
      await persistExecution({
        requestId,
        requestedAt,
        ...completionFields(startedAt),
        status: "refused",
        model: typeof details.model === "string" ? details.model : undefined,
        ragStatus: error.code === "RAG_INDEX_EMPTY" || error.code === "INSUFFICIENT_EVIDENCE"
          ? "insufficient"
          : undefined,
        question,
        errorCode: error.code,
        queryRewrite: rewrite
          ? { semantic: rewrite.semanticQuery, keywords: rewrite.keywords }
          : undefined,
        retrievedChunks: Array.isArray(details.evidence)
          ? details.evidence.filter((item): item is string => typeof item === "string")
          : undefined,
        searchStats: retrieval
          ? {
              semanticCandidates: retrieval.semanticCandidates,
              keywordCandidates: retrieval.keywordCandidates,
            }
          : undefined,
        evaluationChecks,
        failedChecks: evaluationChecks
          ?.filter((check) => !check.passed)
          .map((check) => check.name),
        steps: trace,
        workflow: details.workflow as ExecutionLogSummary["workflow"],
      });
      const status = error.code === "RAG_INDEX_EMPTY" ? 503 : 422;
      return Response.json(
        {
          requestId,
          error: error.code,
          refusal: true,
          message: error.safeMessage,
          failedChecks: evaluationChecks
            ?.filter((check) => !check.passed)
            .map((check) => check.name) ?? [],
        },
        { status },
      );
    }
    if (error instanceof ModelRefusalError) {
      await persistExecution({
        requestId,
        requestedAt,
        ...completionFields(startedAt),
        status: "refused",
        question,
        errorCode: "MODEL_REFUSAL",
      });
      return Response.json(
        { requestId, error: "MODEL_REFUSAL", refusal: true, message: "模型拒絕處理本次問題。" },
        { status: 422 },
      );
    }
    console.error("Market research failed", error);
    await persistExecution({
      requestId,
      requestedAt,
      ...completionFields(startedAt),
      status: "error",
      question,
      errorCode: "MARKET_RESEARCH_FAILED",
    });
    return Response.json(
      { error: "MARKET_RESEARCH_FAILED", message: "目前無法完成研究，請稍後再試。" },
      { status: 502 },
    );
  }
}

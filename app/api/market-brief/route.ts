import {
  MarketBriefRefusal,
  runMarketBriefAgent,
} from "../../../lib/market-agent";
import {
  appendExecutionLog,
  type ExecutionLogSummary,
} from "../../../lib/execution-log";
import { hasOpenAIKey, ModelRefusalError } from "../../../lib/openai";

export const dynamic = "force-dynamic";

async function persistExecution(summary: ExecutionLogSummary) {
  try {
    await appendExecutionLog(summary);
  } catch (error) {
    console.error("Failed to persist Market Brief execution summary", error);
  }
}

function completionFields(startedAt: Date) {
  const completedAt = new Date();
  return {
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };
}

export async function POST() {
  const requestId = crypto.randomUUID();
  const startedAt = new Date();
  const requestedAt = startedAt.toISOString();

  if (!hasOpenAIKey()) {
    await persistExecution({
      requestId,
      requestedAt,
      ...completionFields(startedAt),
      status: "error",
      errorCode: "AI_SERVICE_NOT_CONFIGURED",
    });
    return Response.json(
      {
        error: "AI_SERVICE_NOT_CONFIGURED",
        message: "AI Market Brief 尚未連接模型服務，請先設定部署環境的 OpenAI API key。",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runMarketBriefAgent();
    await persistExecution({
      requestId,
      requestedAt,
      ...completionFields(startedAt),
      status: "success",
      model: result.model,
      ragStatus: result.ragStatus,
      analogDates: result.analogs.map((analog) => analog.date),
      evidence: result.evidence.map((item) => ({
        id: item.id,
        relevance: item.relevance,
      })),
      steps: result.trace.map(({ step, status }) => ({ step, status })),
    });
    return Response.json({ requestId, ...result });
  } catch (error) {
    if (error instanceof MarketBriefRefusal) {
      console.warn("Market Brief refused", error.code, error.internalDetails ?? "");
      const details = (error.internalDetails ?? {}) as Partial<ExecutionLogSummary>;
      const failedChecks = Array.isArray(details.failedChecks)
        ? details.failedChecks.map((check) =>
            typeof check === "string"
              ? check
              : (check as { name?: string }).name ?? "unknown",
          )
        : undefined;
      await persistExecution({
        requestId,
        requestedAt,
        ...completionFields(startedAt),
        status: "refused",
        model: details.model,
        ragStatus: details.ragStatus,
        analogDates: details.analogDates,
        evidence: details.evidence,
        steps: details.steps,
        failedChecks,
        errorCode: error.code,
      });
      return Response.json(
        {
          requestId,
          error: error.code,
          refusal: true,
          message: error.safeMessage,
        },
        { status: 422 },
      );
    }
    if (error instanceof ModelRefusalError) {
      await persistExecution({
        requestId,
        requestedAt,
        ...completionFields(startedAt),
        status: "refused",
        errorCode: "MODEL_REFUSAL",
      });
      return Response.json(
        {
          requestId,
          error: "MODEL_REFUSAL",
          refusal: true,
          message: "模型拒絕產生本次內容，因此沒有顯示 AI 研究結論。",
        },
        { status: 422 },
      );
    }
    console.error("Market Brief agent failed", error);
    await persistExecution({
      requestId,
      requestedAt,
      ...completionFields(startedAt),
      status: "error",
      errorCode: "MARKET_BRIEF_FAILED",
    });
    return Response.json(
      {
        requestId,
        error: "MARKET_BRIEF_FAILED",
        message: "目前無法完成市場研究，可能是外部資料來源暫時沒有回應。請稍後再試。",
      },
      { status: 502 },
    );
  }
}

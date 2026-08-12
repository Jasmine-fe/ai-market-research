import { getFomcIndexStatus, ingestFomcBatch } from "../../../../lib/fomc-ingestion";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.RAG_INDEX_TOKEN;
  return Boolean(
    expected && request.headers.get("authorization") === `Bearer ${expected}`,
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json(await getFomcIndexStatus());
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as {
    cursor?: number;
    batchSize?: number;
  };
  try {
    return Response.json(
      await ingestFomcBatch(Number(body.cursor ?? 0), Number(body.batchSize ?? 3)),
    );
  } catch (error) {
    console.error("FOMC ingestion failed", error);
    return Response.json(
      { error: "INGESTION_FAILED", message: "FOMC 文件索引失敗。" },
      { status: 500 },
    );
  }
}

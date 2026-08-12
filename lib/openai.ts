const OPENAI_BASE_URL = "https://api.openai.com/v1";

export class ModelRefusalError extends Error {
  constructor() {
    super("MODEL_REFUSAL");
    this.name = "ModelRefusalError";
  }
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }
  return key;
}

async function openAIRequest(path: string, body: unknown) {
  const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${detail.slice(0, 240)}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDING_DIMENSIONS = 256;

export async function embedTexts(
  texts: string[],
  dimensions = DEFAULT_EMBEDDING_DIMENSIONS,
) {
  const payload = await openAIRequest("/embeddings", {
    model: process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    input: texts,
    encoding_format: "float",
    dimensions,
  });
  const data = payload.data as Array<{ embedding: number[] }> | undefined;
  if (!data || data.length !== texts.length) {
    throw new Error("Embedding API 回傳的向量數量不正確。");
  }
  return data.map((item) => item.embedding);
}

export function embeddingConfiguration() {
  return {
    model: process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    dimensions: Number(
      process.env.OPENAI_EMBEDDING_DIMENSIONS ?? DEFAULT_EMBEDDING_DIMENSIONS,
    ),
  };
}

export async function generateStructuredResponse(
  system: string,
  input: string,
  schema: Record<string, unknown>,
  schemaName = "structured_response",
) {
  const payload = await openAIRequest("/responses", {
    model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
    store: false,
    max_output_tokens: 2500,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });
  const output = payload.output as
    | Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
    | undefined;
  const text = output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  const refused = output
    ?.flatMap((item) => item.content ?? [])
    .some((item) => item.type === "refusal");
  if (refused) throw new ModelRefusalError();
  if (!text) throw new Error("模型沒有回傳可解析的研究摘要。");
  return { data: JSON.parse(text) as unknown, model: String(payload.model ?? "unknown") };
}

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

type D1Result<T = Record<string, unknown>> = { results?: T[] };

export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type RagDatabase = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
};

export async function getRagDatabase() {
  const runtime = await import("cloudflare:workers");
  const database = (runtime.env as { DB?: RagDatabase }).DB;
  if (!database) throw new Error("D1 binding DB is unavailable");
  return database;
}

export function vectorToBlob(vector: number[]) {
  const floats = new Float32Array(vector);
  return new Uint8Array(floats.buffer);
}

export function blobToVector(value: unknown) {
  let bytes: Uint8Array;
  if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) {
    bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  } else if (Array.isArray(value)) bytes = Uint8Array.from(value);
  else throw new Error("Unsupported embedding blob");

  return new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>) {
  if (a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

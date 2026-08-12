import {
  CHUNKING_VERSION,
  chunkFomcSections,
  extractFomcSections,
} from "./fomc-chunking";
import {
  extractPublishedAt,
  fetchTenYearFomcCatalog,
  type FomcCatalogDocument,
} from "./fomc-catalog";
import { embedTexts, embeddingConfiguration } from "./openai";
import { getRagDatabase, vectorToBlob } from "./rag-database";

const CREATE_FTS_TABLE = `
  CREATE VIRTUAL TABLE IF NOT EXISTS fomc_chunks_fts USING fts5(
    chunk_id UNINDEXED,
    content,
    section_title,
    tokenize = 'porter unicode61'
  )
`;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchDocument(document: FomcCatalogDocument) {
  const response = await fetch(document.url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; MarketMemoIndexer/1.0)" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`FOMC document unavailable: ${response.status} ${document.id}`);
  }
  const html = await response.text();
  const sections = extractFomcSections(html);
  const chunks = chunkFomcSections(sections);
  if (!chunks.length) throw new Error(`No chunks extracted from ${document.id}`);
  return {
    html,
    chunks,
    publishedAt: extractPublishedAt(html, document.meetingDate),
    contentHash: await sha256(JSON.stringify(sections)),
  };
}

async function indexDocument(document: FomcCatalogDocument) {
  const database = await getRagDatabase();
  const { model, dimensions } = embeddingConfiguration();
  const parsed = await fetchDocument(document);
  const existing = await database
    .prepare(
      `SELECT content_hash, chunking_version, embedding_model, embedding_dimensions
       FROM fomc_documents WHERE id = ?`,
    )
    .bind(document.id)
    .first<{
      content_hash: string;
      chunking_version: string;
      embedding_model: string;
      embedding_dimensions: number;
    }>();

  if (
    existing?.content_hash === parsed.contentHash &&
    existing.chunking_version === CHUNKING_VERSION &&
    existing.embedding_model === model &&
    existing.embedding_dimensions === dimensions
  ) {
    return { documentId: document.id, chunks: parsed.chunks.length, skipped: true };
  }

  const vectors = await embedTexts(
    parsed.chunks.map(
      (chunk) => `${document.title}\n${chunk.sectionTitle}\n${chunk.content}`,
    ),
    dimensions,
  );

  await database.prepare(CREATE_FTS_TABLE).run();
  await database.batch([
    database
      .prepare(
        `DELETE FROM fomc_chunks_fts
         WHERE chunk_id IN (SELECT id FROM fomc_chunks WHERE document_id = ?)`,
      )
      .bind(document.id),
    database.prepare("DELETE FROM fomc_chunks WHERE document_id = ?").bind(document.id),
    database
      .prepare(
        `INSERT INTO fomc_documents (
          id, meeting_date, published_at, title, source_url, content_hash,
          chunking_version, embedding_model, embedding_dimensions, chunk_count, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          meeting_date = excluded.meeting_date,
          published_at = excluded.published_at,
          title = excluded.title,
          source_url = excluded.source_url,
          content_hash = excluded.content_hash,
          chunking_version = excluded.chunking_version,
          embedding_model = excluded.embedding_model,
          embedding_dimensions = excluded.embedding_dimensions,
          chunk_count = excluded.chunk_count,
          indexed_at = excluded.indexed_at`,
      )
      .bind(
        document.id,
        document.meetingDate,
        parsed.publishedAt,
        document.title,
        document.url,
        parsed.contentHash,
        CHUNKING_VERSION,
        model,
        dimensions,
        parsed.chunks.length,
        new Date().toISOString(),
      ),
  ]);

  const statements = parsed.chunks.flatMap((chunk, index) => {
    const id = `${document.id}:${chunk.sectionIndex}:${chunk.chunkIndex}`;
    return [
      database
        .prepare(
          `INSERT INTO fomc_chunks (
            id, document_id, section_title, section_index, chunk_index,
            content, token_count, embedding
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          document.id,
          chunk.sectionTitle,
          chunk.sectionIndex,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount,
          vectorToBlob(vectors[index]),
        ),
      database
        .prepare(
          "INSERT INTO fomc_chunks_fts (chunk_id, content, section_title) VALUES (?, ?, ?)",
        )
        .bind(id, chunk.content, chunk.sectionTitle),
    ];
  });

  for (let index = 0; index < statements.length; index += 80) {
    await database.batch(statements.slice(index, index + 80));
  }
  return { documentId: document.id, chunks: parsed.chunks.length, skipped: false };
}

export async function ingestFomcBatch(cursor = 0, batchSize = 3) {
  const catalog = await fetchTenYearFomcCatalog();
  const boundedCursor = Math.max(0, Math.min(cursor, catalog.length));
  const documents = catalog.slice(boundedCursor, boundedCursor + Math.min(5, batchSize));
  const results = [];
  for (const document of documents) results.push(await indexDocument(document));
  const nextCursor = boundedCursor + documents.length;
  return {
    totalDocuments: catalog.length,
    cursor: boundedCursor,
    nextCursor,
    done: nextCursor >= catalog.length,
    documents: results,
    chunksIndexed: results.reduce((sum, item) => sum + item.chunks, 0),
  };
}

export async function getFomcIndexStatus() {
  const database = await getRagDatabase();
  const result = await database
    .prepare(
      `SELECT COUNT(*) AS document_count,
              COALESCE(SUM(chunk_count), 0) AS chunk_count,
              MAX(indexed_at) AS last_indexed_at
       FROM fomc_documents`,
    )
    .first<{
      document_count: number;
      chunk_count: number;
      last_indexed_at: string | null;
    }>();
  return {
    documents: Number(result?.document_count ?? 0),
    chunks: Number(result?.chunk_count ?? 0),
    lastIndexedAt: result?.last_indexed_at ?? null,
  };
}

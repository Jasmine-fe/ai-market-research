import { decode, encode } from "gpt-tokenizer";

export const CHUNKING_VERSION = "section-recursive-v1";
export const CHUNK_TARGET_TOKENS = 600;
export const CHUNK_MAX_TOKENS = 700;
export const CHUNK_OVERLAP_TOKENS = 90;

export type FomcSection = {
  title: string;
  paragraphs: string[];
};

export type FomcChunkDraft = {
  sectionTitle: string;
  sectionIndex: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  ndash: "–",
  nbsp: " ",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

export function htmlToText(value: string) {
  return decodeEntities(
    value
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isSectionLabel(rawHtml: string, text: string) {
  const strong = rawHtml.match(/^\s*<strong\b[^>]*>([\s\S]*?)<\/strong>\s*$/i);
  return Boolean(strong && text.length >= 4 && text.length <= 140);
}

export function extractFomcSections(html: string): FomcSection[] {
  const start = html.search(/<h3\b[^>]*>\s*Minutes of the Federal Open Market Committee/i);
  const article = (start >= 0 ? html.slice(start) : html).split(/<footer\b/i)[0];
  const blocks = [...article.matchAll(/<(h[2-5]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const sections: FomcSection[] = [];
  let current: FomcSection = { title: "Meeting overview", paragraphs: [] };

  const pushCurrent = () => {
    if (current.paragraphs.length) sections.push(current);
  };

  for (const block of blocks) {
    const tag = block[1].toLowerCase();
    const raw = block[2];
    const text = htmlToText(raw);
    if (!text) continue;

    const isHeading = tag.startsWith("h") || isSectionLabel(raw, text);
    if (isHeading) {
      if (/^(minutes of|chapters$)/i.test(text)) continue;
      pushCurrent();
      current = { title: text, paragraphs: [] };
      continue;
    }

    if (text.length >= 40) current.paragraphs.push(text);
  }
  pushCurrent();
  return sections.filter((section) => section.paragraphs.length > 0);
}

function tokenCount(value: string) {
  return encode(value).length;
}

function splitByTokens(value: string, maximum: number) {
  const tokens = encode(value);
  if (tokens.length <= maximum) return [value];
  const parts: string[] = [];
  for (let index = 0; index < tokens.length; index += maximum) {
    parts.push(decode(tokens.slice(index, index + maximum)).trim());
  }
  return parts.filter(Boolean);
}

function recursiveSegments(text: string, maximum: number): string[] {
  if (tokenCount(text) <= maximum) return [text.trim()];

  const separators = [
    /\n\n+/,
    /(?<=[.!?])\s+(?=[A-Z0-9“"'])/,
    /(?<=[;:])\s+/,
    /\s+/,
  ];
  for (const separator of separators) {
    const parts = text.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length <= 1) continue;
    return parts.flatMap((part) => recursiveSegments(part, maximum));
  }
  return splitByTokens(text, maximum);
}

function overlapTail(value: string) {
  const tokens = encode(value);
  return decode(tokens.slice(-CHUNK_OVERLAP_TOKENS)).trim();
}

function chunkSection(section: FomcSection) {
  const segments = section.paragraphs.flatMap((paragraph) =>
    recursiveSegments(paragraph, CHUNK_TARGET_TOKENS),
  );
  const chunks: string[] = [];
  let current = "";

  for (const segment of segments) {
    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (tokenCount(candidate) <= CHUNK_MAX_TOKENS) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    const overlap = current ? overlapTail(current) : "";
    const withOverlap = overlap ? `${overlap}\n\n${segment}` : segment;
    current = tokenCount(withOverlap) <= CHUNK_MAX_TOKENS ? withOverlap : segment;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function chunkFomcSections(sections: FomcSection[]): FomcChunkDraft[] {
  return sections.flatMap((section, sectionIndex) =>
    chunkSection(section).map((content, chunkIndex) => ({
      sectionTitle: section.title,
      sectionIndex,
      chunkIndex,
      content,
      tokenCount: tokenCount(content),
    })),
  );
}

import { encode } from "gpt-tokenizer";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const CHUNKING_VERSION = "section-langchain-recursive-v2";
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

const sectionSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_TARGET_TOKENS,
  chunkOverlap: CHUNK_OVERLAP_TOKENS,
  keepSeparator: true,
  lengthFunction: tokenCount,
  separators: ["\n\n", "\n", ". ", "; ", ": ", " ", ""],
});

export async function chunkFomcSections(
  sections: FomcSection[],
): Promise<FomcChunkDraft[]> {
  const chunkedSections = await Promise.all(
    sections.map(async (section, sectionIndex) => {
      const chunks = await sectionSplitter.splitText(section.paragraphs.join("\n\n"));
      return chunks.map((content, chunkIndex) => ({
        sectionTitle: section.title,
        sectionIndex,
        chunkIndex,
        content,
        tokenCount: tokenCount(content),
      }));
    }),
  );
  return chunkedSections.flat().filter((chunk) => chunk.tokenCount <= CHUNK_MAX_TOKENS);
}

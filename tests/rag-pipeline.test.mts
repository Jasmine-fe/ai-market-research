import assert from "node:assert/strict";
import test from "node:test";
import {
  CHUNK_MAX_TOKENS,
  chunkFomcSections,
  extractFomcSections,
} from "../lib/fomc-chunking.ts";
import { fuseHybridRanks } from "../lib/hybrid-ranking.ts";
import { hasRetrievalCandidates } from "../lib/retrieval-availability.ts";
import {
  decideEvaluationRoute,
  type ResearchCheck,
} from "../lib/research-workflow-policy.ts";
import {
  failedCheckLabel,
  refusalReasonLabel,
} from "../lib/research-refusal-display.ts";

test("section-aware chunking never crosses section boundaries", async () => {
  const paragraph = "Financial conditions remained restrictive. ".repeat(180);
  const html = `
    <h3>Minutes of the Federal Open Market Committee</h3>
    <p><strong>Developments in Financial Markets</strong></p>
    <p>${paragraph}</p>
    <p><strong>Staff Economic Outlook</strong></p>
    <p>${"Inflation was expected to decline gradually. ".repeat(120)}</p>
  `;
  const sections = extractFomcSections(html);
  const chunks = await chunkFomcSections(sections);

  assert.deepEqual(sections.map((item) => item.title), [
    "Developments in Financial Markets",
    "Staff Economic Outlook",
  ]);
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((item) => item.tokenCount <= CHUNK_MAX_TOKENS));
  assert.ok(
    chunks.every((item) =>
      item.sectionTitle === "Developments in Financial Markets" ||
      item.sectionTitle === "Staff Economic Outlook",
    ),
  );
});

test("recursive chunking preserves a short section as one chunk", async () => {
  const chunks = await chunkFomcSections([
    { title: "Committee Policy Actions", paragraphs: ["The Committee maintained its target range."] },
  ]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].sectionTitle, "Committee Policy Actions");
});

test("hybrid RRF promotes chunks found by both searches", () => {
  const result = fuseHybridRanks(
    [
      { id: "semantic-only", documentId: "a", score: 0.9 },
      { id: "both", documentId: "b", score: 0.85 },
    ],
    [
      { id: "both", documentId: "b" },
      { id: "keyword-only", documentId: "c" },
    ],
  );
  assert.equal(result[0].id, "both");
  assert.equal(result[0].semanticRank, 2);
  assert.equal(result[0].keywordRank, 1);
});

test("hybrid results keep at most two chunks per document", () => {
  const semantic = Array.from({ length: 5 }, (_, index) => ({
    id: `same-${index}`,
    documentId: "same-document",
    score: 1 - index / 10,
  }));
  semantic.push({ id: "other", documentId: "other-document", score: 0.4 });
  const result = fuseHybridRanks(semantic, [], 6);
  assert.equal(result.filter((item) => item.documentId === "same-document").length, 2);
  assert.ok(result.some((item) => item.id === "other"));
});

test("retrieval remains available when either search path returns candidates", () => {
  assert.equal(
    hasRetrievalCandidates({ semanticCandidates: 3, keywordCandidates: 0 }),
    true,
  );
  assert.equal(
    hasRetrievalCandidates({ semanticCandidates: 0, keywordCandidates: 4 }),
    true,
  );
  assert.equal(
    hasRetrievalCandidates({ semanticCandidates: 0, keywordCandidates: 0 }),
    false,
  );
});

test("refusal details use clear Traditional Chinese labels", () => {
  assert.equal(
    refusalReasonLabel("OUTPUT_GUARDRAIL_REJECTED"),
    "回答未通過品質檢查",
  );
  assert.equal(
    failedCheckLabel("Citation support"),
    "引用原文無法直接支持結論",
  );
});

function workflowChecks(failures: string[] = []): ResearchCheck[] {
  return [
    "Retrieval availability",
    "Citation validity",
    "Citation support",
    "Temporal safety",
    "No trading instruction",
  ].map((name) => ({ name, passed: !failures.includes(name), detail: name }));
}

test("LangGraph accepts an answer when every evaluation passes", () => {
  assert.equal(decideEvaluationRoute(workflowChecks(), 0), "accept");
});

test("LangGraph corrects a citation failure only once", () => {
  const checks = workflowChecks(["Citation support"]);
  assert.equal(decideEvaluationRoute(checks, 0), "correct");
  assert.equal(decideEvaluationRoute(checks, 1), "refuse");
});

test("LangGraph refuses safety failures without another generation", () => {
  assert.equal(
    decideEvaluationRoute(workflowChecks(["No trading instruction"]), 0),
    "refuse",
  );
  assert.equal(
    decideEvaluationRoute(workflowChecks(["Temporal safety"]), 0),
    "refuse",
  );
});

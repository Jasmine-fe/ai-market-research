import type { Metadata } from "next";
import Link from "next/link";
import "./architecture.css";

export const metadata: Metadata = {
  title: "AI Engineering Architecture",
  description:
    "Architecture portfolio for the Market Memo FOMC RAG and hybrid retrieval system.",
};

const coreSkills = [
  {
    index: "01",
    name: "LLM Application",
    detail: "Query rewriting, structured outputs, grounded generation",
  },
  {
    index: "02",
    name: "Retrieval-Augmented Generation",
    detail: "Ten years of official FOMC minutes as the knowledge source",
  },
  {
    index: "03",
    name: "Hybrid Retrieval",
    detail: "Semantic cosine search + FTS5 / BM25 + RRF",
  },
  {
    index: "04",
    name: "Agent Workflow",
    detail: "A traceable sequence from question to evidence-backed answer",
  },
  {
    index: "05",
    name: "AI Evaluation",
    detail: "Citation support, safety checks, and fail-closed refusal",
  },
];

const systemNodes = [
  ["01", "Federal Reserve", "Official FOMC minutes"],
  ["02", "Ingestion Pipeline", "Discover · parse · chunk"],
  ["03", "OpenAI Embeddings", "256-dimensional vectors"],
  ["04", "Cloudflare D1", "Chunks · metadata · vectors · FTS5"],
  ["05", "Hybrid Retriever", "Cosine · BM25 · RRF"],
  ["06", "OpenAI Responses API", "Answer · citations · evaluation"],
  ["07", "Research Interface", "Evidence-first market research"],
];

const evaluationChecks = [
  ["Hybrid retrieval", "Both semantic and keyword retrieval return candidates."],
  ["Citation validity", "Every answer point references a retrieved chunk ID."],
  ["Citation support", "A second LLM pass verifies that evidence supports each claim."],
  ["Temporal safety", "No document published after the request date can be used."],
  ["No trading instruction", "The answer cannot prescribe trades or position sizing."],
];

export default function ArchitecturePage() {
  return (
    <main className="architecture-page">
      <header className="architecture-nav">
        <Link className="architecture-brand" href="/">
          <span>MM</span>
          <div>
            <strong>Market Memo</strong>
            <small>AI ENGINEERING PORTFOLIO</small>
          </div>
        </Link>
        <nav aria-label="Architecture navigation">
          <a href="#system">System</a>
          <a href="#retrieval">Retrieval</a>
          <a href="#quality">Quality</a>
          <a
            href="https://github.com/Jasmine-fe/ai-market-research"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>

      <section className="architecture-hero">
        <div className="architecture-hero__copy">
          <p className="architecture-kicker">AI ENGINEERING ARCHITECTURE / 2026</p>
          <h1>
            Evidence-first market research,
            <span> engineered as a traceable RAG system.</span>
          </h1>
          <p className="architecture-lede">
            A production-oriented portfolio of how Market Memo turns ten years of
            official FOMC minutes into cited research answers using hybrid retrieval,
            structured LLM workflows, guardrails, and evaluation.
          </p>
          <div className="architecture-actions">
            <a className="architecture-button architecture-button--primary" href="#system">
              Explore the architecture
            </a>
            <Link className="architecture-button" href="/">
              Open the product ↗
            </Link>
          </div>
        </div>
        <aside className="architecture-hero__stats" aria-label="System statistics">
          <div><strong>10</strong><span>years of FOMC minutes</span></div>
          <div><strong>79</strong><span>official documents</span></div>
          <div><strong>1,560</strong><span>section-aware chunks</span></div>
          <div><strong>5</strong><span>output quality gates</span></div>
        </aside>
      </section>

      <section className="architecture-skills" aria-labelledby="skills-heading">
        <div className="architecture-section-heading architecture-section-heading--compact">
          <p className="architecture-kicker">CORE AI ENGINEERING SKILLS</p>
          <h2 id="skills-heading">The system is designed around five capabilities.</h2>
        </div>
        <div className="architecture-skills__grid">
          {coreSkills.map((skill) => (
            <article key={skill.index}>
              <span>{skill.index}</span>
              <h3>{skill.name}</h3>
              <p>{skill.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-section" id="system">
        <div className="architecture-section-heading">
          <div>
            <p className="architecture-kicker">01 / SYSTEM ARCHITECTURE</p>
            <h2>From primary source to evaluated answer.</h2>
          </div>
          <p>
            The system separates ingestion, retrieval, generation, and evaluation so
            each stage can be inspected, tested, and replaced independently.
          </p>
        </div>

        <div className="system-flow" aria-label="End-to-end system flow">
          {systemNodes.map(([index, title, detail], nodeIndex) => (
            <div className="system-flow__item" key={index}>
              <article className={nodeIndex === 3 ? "system-flow__node system-flow__node--core" : "system-flow__node"}>
                <span>{index}</span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </article>
              {nodeIndex < systemNodes.length - 1 ? <b aria-hidden="true">→</b> : null}
            </div>
          ))}
        </div>

        <div className="service-map">
          <article>
            <span className="service-map__label">MODEL SERVICE</span>
            <h3>OpenAI API</h3>
            <p>Responses API for structured generation and evaluation; Embeddings API for semantic retrieval.</p>
          </article>
          <article>
            <span className="service-map__label">DATA SERVICE</span>
            <h3>Cloudflare D1</h3>
            <p>Persistent SQLite storage for documents, chunks, metadata, Float32 vectors, FTS5, and execution logs.</p>
          </article>
          <article>
            <span className="service-map__label">APPLICATION RUNTIME</span>
            <h3>OpenAI Sites</h3>
            <p>Managed Cloudflare Worker runtime for the React interface, API routes, secrets, and D1 binding.</p>
          </article>
          <article>
            <span className="service-map__label">SOURCE &amp; QUALITY</span>
            <h3>GitHub Actions</h3>
            <p>Public source control with automated lint, production build, and 16 regression tests on every change.</p>
          </article>
        </div>
      </section>

      <section className="architecture-section architecture-section--split" id="retrieval">
        <div className="architecture-section-heading architecture-section-heading--stacked">
          <p className="architecture-kicker">02 / KNOWLEDGE PIPELINE</p>
          <h2>Section-aware indexing preserves document meaning.</h2>
          <p>
            FOMC minutes are not split at arbitrary character boundaries. The pipeline
            recognizes document sections first, then recursively selects paragraph,
            sentence, punctuation, whitespace, and token boundaries.
          </p>
        </div>
        <div className="pipeline-panel">
          <div className="pipeline-panel__row">
            <span>01</span><strong>Discover</strong><p>Find official minutes from a rolling ten-year window.</p>
          </div>
          <div className="pipeline-panel__row">
            <span>02</span><strong>Parse</strong><p>Extract section titles and clean paragraph content.</p>
          </div>
          <div className="pipeline-panel__row">
            <span>03</span><strong>Chunk</strong><p>Target 500–700 tokens with 90-token overlap; never cross sections.</p>
          </div>
          <div className="pipeline-panel__row">
            <span>04</span><strong>Embed</strong><p>Create 256-dimensional vectors with text-embedding-3-small.</p>
          </div>
          <div className="pipeline-panel__row">
            <span>05</span><strong>Upsert</strong><p>Persist content, vector, metadata, and FTS index idempotently.</p>
          </div>
        </div>
      </section>

      <section className="architecture-section retrieval-section">
        <div className="architecture-section-heading">
          <div>
            <p className="architecture-kicker">03 / HYBRID RETRIEVAL</p>
            <h2>Meaning and exact language search together.</h2>
          </div>
          <p>
            Two independent rankers reduce the failure modes of using only keyword or
            only semantic search. Reciprocal Rank Fusion combines rank positions
            without forcing incomparable raw scores onto one scale.
          </p>
        </div>

        <div className="retrieval-grid">
          <article className="retrieval-card retrieval-card--semantic">
            <span>SEMANTIC SEARCH</span>
            <h3>Embedding + exact cosine similarity</h3>
            <p>Captures conceptual matches even when the user and FOMC use different words.</p>
            <div className="retrieval-card__code">query → embedding(256) → cosine → top 30</div>
          </article>
          <div className="retrieval-operator" aria-hidden="true">+</div>
          <article className="retrieval-card retrieval-card--keyword">
            <span>KEYWORD SEARCH</span>
            <h3>SQLite FTS5 + BM25 ranking</h3>
            <p>Recovers policy terms, named concepts, and phrases that semantic search may blur.</p>
            <div className="retrieval-card__code">keywords → FTS5 MATCH → BM25 → top 30</div>
          </article>
          <div className="retrieval-operator" aria-hidden="true">→</div>
          <article className="retrieval-card retrieval-card--fusion">
            <span>RANK FUSION</span>
            <h3>RRF + diversity constraint</h3>
            <p>Combines both rankings, limits two chunks per document, and selects six evidence chunks.</p>
            <div className="retrieval-card__code">RRF(k=60) → max 2 / document → top 6</div>
          </article>
        </div>

        <aside className="architecture-note">
          <div>
            <span>CURRENT TRADE-OFF</span>
            <strong>D1-backed vector storage, not a dedicated vector database.</strong>
          </div>
          <p>
            Embeddings are stored as Float32 BLOBs in D1. The application performs an
            exact scan across 1,560 chunks. This favors simplicity and exact results at
            the current corpus size; the retrieval boundary can later be replaced by a
            vector database without changing chunking, RRF, generation, or evaluation.
          </p>
        </aside>
      </section>

      <section className="architecture-section workflow-section">
        <div className="architecture-section-heading">
          <div>
            <p className="architecture-kicker">04 / LLM WORKFLOW</p>
            <h2>A bounded agent, not an open-ended chatbot.</h2>
          </div>
          <p>
            Every request follows a deterministic workflow. LLMs are used only where
            language understanding is necessary; data access, ranking, and safety
            decisions remain explicit application steps.
          </p>
        </div>
        <ol className="workflow-timeline">
          <li><span>01</span><div><strong>Rewrite query</strong><p>Map the question to an English semantic query and precise FOMC keywords.</p></div></li>
          <li><span>02</span><div><strong>Retrieve evidence</strong><p>Run semantic and keyword searches, fuse ranks, and apply source diversity.</p></div></li>
          <li><span>03</span><div><strong>Construct context</strong><p>Pass only selected excerpts, stable chunk IDs, dates, sections, and URLs.</p></div></li>
          <li><span>04</span><div><strong>Generate answer</strong><p>Produce strict JSON with concise answer points and required citation IDs.</p></div></li>
          <li><span>05</span><div><strong>Evaluate output</strong><p>Verify support and deterministic safety rules before returning any conclusion.</p></div></li>
        </ol>
      </section>

      <section className="architecture-section quality-section" id="quality">
        <div className="architecture-section-heading architecture-section-heading--stacked">
          <p className="architecture-kicker">05 / EVALUATION &amp; GUARDRAILS</p>
          <h2>Reliability is enforced after generation.</h2>
          <p>
            The output is not trusted because it came from an LLM. Every conclusion
            must pass retrieval, citation, temporal, and safety checks. A failed check
            returns a refusal instead of a partially grounded answer.
          </p>
        </div>
        <div className="quality-grid">
          {evaluationChecks.map(([title, detail], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <div><h3>{title}</h3><p>{detail}</p></div>
              <b>CHECK</b>
            </article>
          ))}
        </div>
        <div className="refusal-flow">
          <div><span>ALL CHECKS PASS</span><strong>Return cited research answer</strong></div>
          <b>OR</b>
          <div className="refusal-flow__blocked"><span>ANY CHECK FAILS</span><strong>Fail closed · show no conclusion</strong></div>
        </div>
      </section>

      <section className="architecture-section observability-section">
        <div className="architecture-section-heading">
          <div>
            <p className="architecture-kicker">06 / OBSERVABILITY</p>
            <h2>Each request leaves an inspectable trace.</h2>
          </div>
          <p>
            Persistent execution summaries help diagnose retrieval failures, model
            refusals, and evaluation regressions without storing secrets or complete
            source documents.
          </p>
        </div>
        <div className="log-window">
          <div className="log-window__bar"><i></i><i></i><i></i><span>market_brief_executions</span></div>
          <pre>{`{
  "requestId": "b8f1…",
  "status": "success",
  "model": "gpt-5-nano",
  "search": { "semantic": 30, "keyword": 30 },
  "retrievedChunks": ["chunk_…", "chunk_…"],
  "evaluation": { "passed": true, "checks": 5 },
  "steps": ["rewrite", "retrieve", "answer", "evaluate"],
  "durationMs": 17688
}`}</pre>
          <p>Excluded by design: API keys · full prompts · complete FOMC documents</p>
        </div>
      </section>

      <section className="architecture-section stack-section">
        <div className="architecture-section-heading architecture-section-heading--stacked">
          <p className="architecture-kicker">07 / TECHNOLOGY STACK</p>
          <h2>Tools grouped by engineering responsibility.</h2>
        </div>
        <div className="stack-grid">
          <article><span>LLM</span><p>OpenAI Responses API · Structured Outputs · GPT-5 nano</p></article>
          <article><span>RAG</span><p>OpenAI Embeddings · Recursive Chunking · RRF</p></article>
          <article><span>SEARCH</span><p>Exact Cosine Similarity · SQLite FTS5 · BM25</p></article>
          <article><span>DATA</span><p>Cloudflare D1 · SQLite · Drizzle ORM</p></article>
          <article><span>APPLICATION</span><p>TypeScript · React · Next.js · Cloudflare Workers</p></article>
          <article><span>QUALITY</span><p>Node Test Runner · ESLint · AI Evaluation · Guardrails</p></article>
          <article><span>DEVOPS</span><p>GitHub Actions · OpenAI Sites · Persistent Logs</p></article>
          <article><span>SOURCES</span><p>Federal Reserve · TradingView · Barchart</p></article>
        </div>
      </section>

      <footer className="architecture-footer">
        <div>
          <p className="architecture-kicker">AI MARKET RESEARCH</p>
          <h2>Built to make every answer traceable to evidence.</h2>
        </div>
        <div className="architecture-actions">
          <a className="architecture-button architecture-button--primary" href="https://github.com/Jasmine-fe/ai-market-research" target="_blank" rel="noreferrer">View source on GitHub ↗</a>
          <Link className="architecture-button" href="/">Open Market Memo ↗</Link>
        </div>
      </footer>
    </main>
  );
}

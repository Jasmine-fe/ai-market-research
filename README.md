# AI Market Research

[Live demo](https://us-market-breadth.jl5908766.chatgpt.site/) · An AI-powered US market breadth dashboard and FOMC research assistant.

The project combines an interactive market dashboard with a grounded RAG workflow over ten years of official FOMC minutes.

## RAG workflow

1. Discover and ingest official FOMC minutes.
2. Apply section-aware recursive chunking (500–700 tokens with overlap).
3. Generate OpenAI embeddings and persist chunks, metadata, and vectors in Cloudflare D1.
4. Retrieve evidence using semantic cosine search and FTS5/BM25 keyword search.
5. Fuse both rankings with Reciprocal Rank Fusion (RRF).
6. Generate a Traditional Chinese answer with source-level citations.
7. Evaluate citation validity, citation support, temporal safety, and trading-instruction guardrails.

## AI engineering highlights

- LLM query rewriting and structured outputs
- Section-aware recursive chunking and embedding generation
- Hybrid retrieval: semantic search + keyword search + RRF
- Grounded answers with official-source citations
- Guardrails, refusal strategy, and LLM-based citation evaluation
- Persistent execution traces for requests, retrieval, and evaluation results

## Execution log

Each research request stores a compact execution summary containing its request ID, duration, status, model, retrieved chunk IDs, search statistics, workflow steps, and evaluation results. Logs never store the API key, complete prompts, or full FOMC documents.

- The hosted site uses the D1 `market_brief_executions` table.
- Local previews use `.local-data/market-brief-executions.jsonl`, which is excluded from Git.

## Local development

Requires Node.js `>=22.13.0`.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local`. The key is server-side only and is never sent to the browser.

## Validation

```bash
npm run build
npm run lint
npm test
```

## Data sources

- TradingView: live/delayed market price cards
- Barchart: S&P 500, Nasdaq-100, and breadth history
- Federal Reserve: official FOMC minutes

Market data may be delayed. The project is for research and does not provide investment advice.

## Deployment

GitHub Actions validates every push and pull request. Production is hosted by OpenAI Sites, so publishing is a separate release step: push the validated commit to GitHub, save that same commit as a Sites version, and deploy it. This keeps the public repository and live website traceable to the same source revision.

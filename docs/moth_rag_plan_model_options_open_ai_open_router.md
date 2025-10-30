# MOTH → RAG Plan & Model Options

**Author:** Alienrobot LLC\
**Scope:** How to exploit two MOTH artifacts (summary + worklist) for maximum LLM impact, what DB/indexing to use, and which current models (OpenAI + OpenRouter) are best for long-context repo Q&A and refactor planning.

---

## 0) TL;DR Decisions

- **Persistence:** Use **SQLite** as the system-of-record keyed by the **manifest hash** (snapshot). Keep exporting `REPO.moth` (summary) + `worklist.moth` for portability.
- **Granularity:** Store **one row per file** (plus symbols) in DB; keep a *single* consolidated MOTH file for shipping/LLM bootstrap, but rely on the DB for fast queries and RAG packing.
- **Retrieval:** Hybrid pipeline = **graph filter (MOTH deps)** → **FTS5** → **vector rerank** → compact **context packer** with MOTH metrics + citations.
- **Models:** Use **OpenAI GPT‑5 / GPT‑4.1** or **Anthropic Claude Sonnet 4.x** for long-context reasoning; through **OpenRouter**, also consider **Gemini 2.5 (Pro/Flash)**, **DeepSeek V3**, **Grok Code Fast**, **Mistral Large 2** for cost/speed trade‑offs.

---

## 1) One big MOTH vs many per-file entries (and a DB)

### Options

1. **Single consolidated MOTH file**

   - **Pros:** Portable, deterministic, easy to attach to LLM calls, great for offline inspection.
   - **Cons:** Inefficient for random access; hard to diff/update incrementally; large token cost if pasted whole.

2. **Per-file MOTH entries (DB)**

   - **Pros:** Fast point lookups, incremental updates, easy diffs, ideal for RAG building; enables symbol-level indexing.
   - **Cons:** Requires DB APIs; not a single artifact you can email around.

### Recommended pattern (both):

- Keep **one canonical consolidated** `REPO.moth` per snapshot for provenance and bootstrap.
- Also persist **normalized per-file** rows in **SQLite** with auxiliary tables for deps/symbols/metrics.
- The UI + RAG pull from SQLite; the consolidated MOTH travels with the snapshot and seeds first LLM calls.

---

## 2) SQLite schema (minimal, high‑leverage)

```text
snapshots( id INTEGER PK, manifest_hash TEXT UNIQUE, project TEXT, created_at TEXT, meta_json TEXT )
files( id INTEGER PK, snapshot_id INT, path TEXT, content_hash TEXT, loc INT, size INT, mtime TEXT, doc_snippet TEXT )
metrics( file_id INT PK, complexity INT, fanin INT, fanout INT, depth INT, churn INT, coverage REAL )
deps( snapshot_id INT, src_file_id INT, dst_file_id INT, dst_external TEXT )
symbols( id INTEGER PK, file_id INT, kind TEXT, name TEXT, span_start INT, span_end INT )
positions( file_id INT PK, x REAL, y REAL, pinned INT )
worklist( id INTEGER PK, snapshot_id INT, file_id INT, issue_type TEXT, severity TEXT, notes TEXT )
fts_files( path, doc_snippet, content ) -- FTS5 virtual table
```

- **Immutable snapshots** keyed by `manifest_hash`.
- **FTS5** holds docstrings/README/optional source chunks for keyword search.
- **Vectors** (later): either sqlite-vec/vss ext or a sidecar FAISS/LanceDB with `chunk_id → file_id → snapshot_id`.

---

## 3) Retrieval flow (hybrid)

1. **Graph prefilter** using MOTH deps: N-hop neighborhood, or fanout/fanin/depth/churn thresholds.
2. **Text filter** via FTS5 (exact names, error codes, TODO text, API symbols).
3. **Vector rerank** on survivors (function‑level preferred chunks).
4. **Context packer** emits 3–8 chunks, each preceded by a one‑line **MOTH metrics header** and a **file****:path** citation.

**Packing rules:**

- Chunk ≤ 600–800 tokens; include top imports/exports and brief doc.
- Always attach MOTH metrics: `loc, complexity, fanout, depth, churn, coverage`.
- Enforce citations (path\:line) in LLM answers.

---

## 4) Prompt templates (concise)

**System (static):**

> You are RepoGPT. MOTH is a deterministic manifest with fields: path, loc, complexity, fanin, fanout, depth, churn, coverage. Answer concisely with concrete steps and cite files as `path:lines`.

**A. Explain subgraph**

- Context: N‑hop neighborhood nodes (metrics + snippets) and top worklist items.
- Ask: "Summarize behavior in 3 bullets; propose 2 refactors with effort (S/M/L) and tests. Cite files."

**B. Impact of change**

- Context: transitive dependents; show high fanout and high churn first.
- Ask: "If we rename `foo` in `src/x.ts`, list likely breakpoints and test plan. Cite files."

**C. Sprint plan from worklist**

- Context: top 10 worklist entries with metrics.
- Ask: "Create two-sprint plan with acceptance criteria and PR checklist."

---

## 5) Model menu (OpenAI + OpenRouter) — late‑2025 snapshot

> Choose **2 primaries** (deep reasoning, long‑context) + **1 cost saver** + **1 code specialist** per environment. Validate on your repo slice (MOTH‑seeded benchmarks).

**Primaries (reasoning + long context)**

- **OpenAI GPT‑5 / GPT‑5 Thinking**: strong reasoning/agents; long context; great for structured plans and refactors.
- **OpenAI GPT‑4.1 family**: large context variants useful for 100k–1M token scenarios; solid coding.
- **Anthropic Claude Sonnet 4.x**: hybrid reasoning, long context, very strong code & explanation quality.

**Through OpenRouter (breadth & pricing options)**

- **Google Gemini 2.5 (Pro/Flash)**: fast, long‑context options; cost‑effective for bulk Q&A.
- **DeepSeek V3 / R1‑distill variants**: aggressive price/perf for code tasks.
- **xAI Grok Code Fast**: performant coding focus; useful as a code specialist.
- **Mistral Large 2**: 128k context; good balance for multilingual/code; a strong cost‑saver.

**Heuristic pairing**

- **Design + refactor plans:** GPT‑5 or Claude Sonnet 4.x
- **Bulk triage / search Q&A:** Gemini 2.5 Flash (via OpenRouter) or GPT‑4.1 mini
- **Code transforms / fixes draft:** Grok Code Fast or DeepSeek (review with a primary)

> Note: keep a switchable **routing policy** (by prompt class + token budget + latency). OpenRouter’s routing/fallback can reduce downtime while you retain the option to call OpenAI directly for critical tasks.

---

## 6) Token strategy with MOTH

- Never paste the whole `REPO.moth`. **Pre-filter** with graph + FTS → pack ≤ 8 curated chunks.
- Use **worklist bias** to prioritize high-severity nodes.
- Keep a **"snapshot header"**: manifest hash + project + date + counts (fits in < 10 lines) at the top of every prompt for provenance.

---

## 7) Evaluation: quick harness

- Build a repo‑specific benchmark (10–20 questions): architecture, impact, location, test plan.
- Measure: answer correctness, citation validity, steps completeness, and token cost.
- Compare 3–4 model mixes; lock a default routing profile.

---

## 8) Roadmap

- **Now:** SQLite + FTS; AST parsing for JS/TS/Py; React Flow viewer wired to DB; hybrid retriever; prompt templates.
- **Next:** vector index + semantic rerank; two-snapshot diff mode; time‑slider for churn.
- **Later:** coverage ingestion; refactor recipes; auto‑PR drafts guarded by policy checks.

---

## 9) Open questions

- Thresholds for “hotspot” labels (p90 complexity? fanout>12?)
- How many context chunks per prompt for best ROI on your repos?
- Whether to embed commit messages for rationale retrieval.

---

## 10) Recommendation on artifact layout

- Keep **both**: a consolidated `REPO.moth` for provenance + **per-file** rows in **SQLite** for RAG.
- Generate a small **worklist.moth** view for immediate action prompts.
- The UI and LLM rely on SQLite; the MOTH files remain the portable, signed source of truth.

---

## 11) Repo Watcher & Incremental Update Loop

**Goal:** keep MOTH files and the SQLite DB up to date as the repo changes, without reprocessing everything.

**Event sources**

- **Local dev:** Git hooks (`pre-commit`, `post-merge`, `post-checkout`) → run `analyze.mjs --changed`.
- **CI/CD:** On PR open/sync/merge → run full `analyze.mjs`, write `REPO.moth` + `worklist.moth`, update DB.
- **Daemon watcher:** `chokidar`/`fswatch` watches `src/**` and enqueues changed paths.

**Incremental pipeline**

1. Detect changed files (git diff or watcher).
2. For each changed file:
   - Recompute metrics, AST deps, symbols.
   - Update `files`, `metrics`, `symbols`, `deps` in SQLite (same `snapshot_id` if using *live* mode; or create a new **immutable** snapshot for CI builds).
   - Re-embed changed chunks only (content-hash–keyed) and update vector index.
3. Recompute **derived** fields (e.g., fanin/depth for affected neighborhood only).
4. Regenerate `REPO.moth` (or only in CI) and store `manifest_hash`.
5. Emit `validation.log` and an optional `diff.moth` (added/removed/changed nodes/edges).

**Queueing & resilience**

- Use an in-memory queue (BullMQ if you adopt Redis; otherwise a simple JS queue) for bursty changes.
- Backoff on repeated failures; log file-level errors without halting the run.

**CLI flags (suggested)**

- `--all` (default CI): analyze entire repo, write `REPO.moth`.
- `--changed [base..head]` or `--watch`: only changed files; update DB + vector index.
- `--no-vectors` / `--no-fts`: skip heavy steps when not needed.

---

## 12) MOTH Onboarding Prompts (adaptable templates)

**A) PRD/Architecture Intake**

> You now understand MOTH (Minimal Overhead Technical Hierarchy)… (use your onboarding text). Convert the following PRD into a MOTH blueprint (100–200 lines). Only include details that change architecture. Emit `[FEATURES]`, `[SCHEMAS]`, `[WORKFLOWS]`, `[API]`, `[RISKS]`.

**B) Codebase Orientation**

> Using `REPO.moth` + `worklist.moth`, summarize the top 3 subsystems, their entrypoints, and coupling hotspots. Include citations (path\:lines) and a 7‑day refactor plan.

**C) Impact Analysis**

> Given file `X`, list transitive dependents (≤2 hops), high‑risk edges (fanout≥N or churn≥P90), and a test checklist. Cite files.

**D) Bug Hunt / Triage**

> From `worklist.moth`, choose the top 5 high‑severity items. For each, suggest a failing test, suspected root cause, and fix sketch (≤10 lines), with citations.

**E) Test Authoring**

> For module `Y`, propose a minimal test matrix to cover logic branches. Include file paths and function names; link to uncovered branches.

**F) PR Review Copilot**

> Given a PR diff and the current snapshot hash, assess risk by affected fanout/depth; propose targeted reviewers (owners of high‑churn dependents) and a checklist.

---

## 13) Model Comparison Matrix (late‑2025, high level)

| Model                                     | Context     | Strengths                 | Typical Use                   | Notes                         |
| ----------------------------------------- | ----------- | ------------------------- | ----------------------------- | ----------------------------- |
| **OpenAI GPT‑5 / GPT‑5 Thinking**         | Very long   | Deep reasoning, planning  | Architecture & refactor plans | Primary for high‑stakes tasks |
| **OpenAI GPT‑4.1 (large/mini)**           | Long        | Balanced code + reasoning | Bulk Q&A, summaries           | Cost tiered                   |
| **Anthropic Claude Sonnet 4.x**           | Long        | Explanations, safety      | Code tours, docs              | Excellent citations           |
| **Gemini 2.5 Pro/Flash (via OpenRouter)** | Long/Fast   | Speed, cost               | Bulk triage, search           | Good cost/latency             |
| **DeepSeek V3 / R1‑distill**              | Medium‑Long | Code transforms           | Draft fixes                   | Aggressive price/perf         |
| **Mistral Large 2**                       | Long        | Multilingual, steady      | General coding                | Good cost saver               |
| **xAI Grok Code Fast**                    | Medium      | Code specialization       | Quick patches                 | Pair with primary for review  |

> Keep a **routing matrix** by task: (Explain/Impact/Plan/Triage/Transform). Allow overrides per project.

---

## 14) OpenRouter & OpenAI Integration Notes

- Implement a **provider router**: `{ task, maxTokens, latency, costCap } → modelName`.
- Add **fall‑through** (if provider N/A, try next option) and **circuit‑breaker** on repeated errors.
- Log `(snapshot_hash, question_id, model, tokens_in/out, latency)` to evaluate models on your workload.

---

## 15) Next Actions

- Add `--watch` mode to `analyze.mjs` with `chokidar` and incremental AST parsing.
- Stand up SQLite with tables above; write a small `/api/search` that supports graph/fts/vector filters.
- Implement **moth→ReactFlow** adapter reading from SQLite; persist layout in `positions`.
- Land three prompt flows in UI: Explain Subgraph, Impact of Change, Sprint Plan from Worklist.
- Add model router config (OpenAI + OpenRouter) with task‑based defaults and cost guardrails.

---

## 16) SQLite DDL (runnable)

```sql
PRAGMA journal_mode=WAL;               -- concurrency-friendly
PRAGMA synchronous=NORMAL;             -- speed vs safety tradeoff
PRAGMA foreign_keys=ON;

-- Snapshots: one row per manifest, immutable
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY,
  manifest_hash TEXT UNIQUE NOT NULL,
  project TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  meta_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON snapshots(manifest_hash);

-- Files: one row per file per snapshot
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  loc INTEGER NOT NULL,
  size INTEGER NOT NULL,
  mtime TEXT,
  doc_snippet TEXT,
  UNIQUE(snapshot_id, path)
);
CREATE INDEX IF NOT EXISTS idx_files_snapshot ON files(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);

-- Metrics: 1:1 with files
CREATE TABLE IF NOT EXISTS metrics (
  file_id INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  complexity INTEGER NOT NULL,
  fanin INTEGER NOT NULL,
  fanout INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  churn INTEGER NOT NULL,
  coverage REAL
);

-- Deps: edges within a snapshot (internal) or external label
CREATE TABLE IF NOT EXISTS deps (
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  src_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  dst_file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  dst_external TEXT,                                  -- e.g. "@external:react"
  PRIMARY KEY (snapshot_id, src_file_id, dst_file_id, dst_external)
);
CREATE INDEX IF NOT EXISTS idx_deps_src ON deps(src_file_id);
CREATE INDEX IF NOT EXISTS idx_deps_dst ON deps(dst_file_id);

-- Symbols per file
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                                  -- func|class|type|enum|iface
  name TEXT NOT NULL,
  span_start INTEGER,
  span_end INTEGER
);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);

-- Layout persistence for React Flow
CREATE TABLE IF NOT EXISTS positions (
  file_id INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  x REAL,
  y REAL,
  pinned INTEGER DEFAULT 0
);

-- Worklist (hotspots/alerts)
CREATE TABLE IF NOT EXISTS worklist (
  id INTEGER PRIMARY KEY,
  snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,                              -- low|med|high|critical
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_worklist_snapshot ON worklist(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_worklist_severity ON worklist(severity);

-- FTS over docs/snippets (optional source chunks later)
CREATE VIRTUAL TABLE IF NOT EXISTS fts_files USING fts5(
  path, doc_snippet, content, content_rowid='id'
);

-- Convenience triggers to keep FTS in sync with files table (doc_snippet only here)
CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
  INSERT INTO fts_files(rowid, path, doc_snippet, content) VALUES (new.id, new.path, new.doc_snippet, '');
END;
CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
  INSERT INTO fts_files(fts_files, rowid, path, doc_snippet, content) VALUES ('delete', old.id, old.path, old.doc_snippet, '');
END;
CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE OF path, doc_snippet ON files BEGIN
  INSERT INTO fts_files(fts_files, rowid, path, doc_snippet, content) VALUES ('delete', old.id, old.path, old.doc_snippet, '');
  INSERT INTO fts_files(rowid, path, doc_snippet, content) VALUES (new.id, new.path, new.doc_snippet, '');
END;
```

**Indices to consider for graph queries:** `(fanin>k)`, `(fanout>k)`, `(depth>k)`, and compound `(snapshot_id, fanout DESC, churn DESC)` via a view.

---

## 17) `analyze.mjs --watch` patch (incremental updates)

> Add a watcher mode to update DB + vectors on change; regenerate `REPO.moth` in CI or periodically.

```js
// cli.ts (sketch)
import chokidar from 'chokidar';
import { analyzeFiles, updateDbForFiles, reembedChunks } from './pipeline.js';

const mode = process.argv.includes('--watch') ? 'watch' : 'all';
const base = process.env.BASE || 'origin/main';

if (mode === 'watch') {
  const q = new Set();
  const flush = async () => {
    const files = [...q]; q.clear();
    const results = await analyzeFiles(files);            // AST deps, symbols, metrics
    await updateDbForFiles(results);                      // upsert files/metrics/dep/symbols
    await reembedChunks(results.changedChunks);           // vectors only for changed
    console.log(`Updated ${files.length} files.`);
  };

  const debounced = debounce(flush, 400);
  chokidar.watch('src/**/*', { ignoreInitial: true }).on('all', (_evt, f) => {
    q.add(f); debounced();
  });
} else {
  // full run (CI)
  const results = await analyzeFiles(await listAllFiles());
  await rebuildSnapshot(results); // writes REPO.moth, worklist.moth, validation.log
}
```

```js
// pipeline.js (sketch)
export async function analyzeFiles(paths) {
  // For each file: read → AST parse → extract deps/symbols → compute metrics
  // Return structure keyed by content_hash for caching
}
export async function updateDbForFiles(results) {
  // Upsert into files/metrics/symbols; recompute affected fanin/depth neighborhood
}
export async function reembedChunks(changed) {
  // Chunk by function/class; embed; upsert into vectors store
}
```

---

## 18) RAG with embeddings & vector DB (go for it)

**YES** — implement now. Pair **hybrid retrieval** with a local vector index for best latency and control.

### Options

- **SQLite vector extensions**: `sqlite-vec` or `sqlite-vss` → keep everything in one file.
- **Sidecar**: **FAISS** or **LanceDB** → fast, easy to snapshot; store `chunk_id → file_id → snapshot_id` backrefs in SQLite.

### Chunking strategy

- Primary unit = **function/class** (preferred) or \~300–800 line file slices when unknown.
- Each chunk row stores: `snapshot_id, file_id, symbol, path, text, metrics_json, deps_topN, start_line..end_line, content_hash`.
- Precompute a **2–3 sentence summary** per chunk for cheap first-pass context.

### Retrieval pipeline (code sketch)

```js
const graph = await kHopNeighborhood(seedIds, { hops: 2, fanoutMax: 200 });
const fts = await ftsSearch(query, { within: graph.fileIds, limit: 200 });
const prelim = union(graph.fileIds, fts.fileIds);
const topK = await vectorSearch(emb(query), { within: prelim, k: 10 });
const chunks = await pack(topK, { includeMetrics: true, cite: true });
```

### Prompt guardrails

- Prepend **snapshot header** (manifest hash, date, counts).
- Enforce **source citations** in answers; reject unverifiable claims.
- Include **worklist biasing** to lift high‑severity areas.

---

## 19) Embedding + Vector Strategy (keep it simple)

### Embedding models

- **Primary (general/code mixed):** `voyage-3-large` — state-of-the-art retrieval quality, long input, multilingual. Use for code + doc chunks.
- **Fallback:** `text-embedding-3-large` (OpenAI) — reliable baseline, broad ecosystem support.
- **Alternates by task:**
  - `voyage-code-3` → for code-only symbol chunks.
  - `cohere-v3` → multilingual and cost-efficient.
  - **Open-source fallback:** `bge-base` or `e5-large` for air‑gapped local mode.

### Vector index

- Start **inside SQLite** using `sqlite-vss` (FAISS-backed) or `sqlite-vec` extension.
  - Vectors and metadata live side by side with MOTH tables.
  - Filter by `snapshot_id` and `path_prefix` directly in SQL.
- This gives ACID consistency and trivial snapshotting with minimal ops.
- You're still effectively **using FAISS under the hood** without extra services.

### Upgrade path

- If corpus > 5M chunks or you need multi-tenant serving:
  - **Qdrant** → production-grade, HNSW + payload filters.
  - **FAISS sidecar** → local, blazing fast, manual persistence.
- Keep SQLite as the system of record for all non-vector data.

### Implementation notes

- Embedding dimension = 1024; normalize for cosine.
- Cache vectors by `content_hash` across snapshots to avoid recomputation.
- Store chunks table: `(snapshot_id, file_id, chunk_id, text, vector, summary, metrics_json)`.
- Use hybrid retrieval (graph + FTS + vector) as before.

---

## 20) Risk Mitigations & Tunables

### Graph explosion guardrails
- Cap neighbors per hop: `maxNeighborsPerNode=50`, `maxSubgraph=600`.
- Priority score = `0.5*churn_norm + 0.3*worklist_severity + 0.2*fanout_norm`.
- Always include seed node + top `K=10` dependents by fanin.

### Chunking policy
- Prefer complete function/class chunks; allow 1.5× oversize (up to ~1200 tokens) to preserve semantics.
- Split only on statement boundaries (AST-level) and prepend 2–3 line summaries.
- Pack rule: max 8 chunks; one oversized + 4 normal allowed.

### Watcher noise control
- Drop live fs watcher for v1; rely on git hooks and CI.
- Optional debounce: 1000ms; skip reanalysis if content_hash unchanged.
- Recompute derived graph metrics only for affected neighborhood (2 hops).

### External dependency signals
- Tag files by imported libs (e.g., react, tensorflow, vite) in `files.tags`.
- Use tags as router hints (ML → Claude/GPT‑5; config → Gemini Flash).

### Embedding defaults
- Make `voyage-code-3` primary for code, `voyage-3-large` for docs/comments.
- Fallback: OpenAI `text-embedding-3-large`.
- Persist `embed_model` and version in each chunk row.

### Layout defaults
- Compute force-directed layout on snapshot create.
- Layer by `depth` (y‑axis), directory prefix (x‑axis); persist to `positions`.
- User pins override auto layout.

---

## 21) Model routing (final section) (final section)

Yes — section 20 currently serves as the last section and completes the plan. It ends with the model routing configuration and notes. You might optionally add a short 'Conclusion' or 'Next Steps Summary' afterward if you want a clear wrap-up point for future revisions. (task → provider)

```json
{
  "explain": { "primary": "openai:gpt-5-thinking", "fallback": ["anthropic:claude-sonnet-4", "openrouter:gemini-2.5-pro"] },
  "impact":  { "primary": "openai:gpt-5-thinking", "fallback": ["openrouter:mistral-large-2"] },
  "triage":  { "primary": "openrouter:gemini-2.5-flash", "fallback": ["openai:gpt-4.1-mini"] },
  "transform": { "primary": "openrouter:grok-code-fast", "fallback": ["openrouter:deepseek-v3"] }
}
```

- Add runtime knobs: `maxTokens`, `costCap`, `latencyTargetMs`.
- Log per-call metrics with `snapshot_hash` for later evaluation.


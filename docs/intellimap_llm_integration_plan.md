# IntelliMap — LLM Integration & MOTH Schema Plan

## 1. Objective

Enable IntelliMap to perform **semantic understanding, summarization, and reasoning** across entire codebases using LLMs (starting with GPT‑5, later local models). The system will compress repository data into a **MOTH (Meta‑Optimized Text Hierarchy)** format, enabling global analysis without token overload.

---

## 2. LLM Integration Goals

### 2.1 Functional Goals

- **Architectural reasoning** — Identify design flaws, duplication, coupling, missing abstraction layers.
- **Semantic summarization** — Produce natural language summaries for clusters, subsystems, and diffs.
- **Interactive query interface** — Answer user questions about architecture, runtime behavior, and tests.
- **Refactor guidance** — Generate actionable restructuring or modularization suggestions.
- **Continuous monitoring** — Compare successive runs and highlight regressions in structure or design quality.

### 2.2 Technical Goals

- Unified interface to multiple model providers (OpenAI, Anthropic, local Ollama/Llama, vLLM).
- Context compression through the MOTH schema.
- Efficient embedding search for local inference (pgvector/FAISS backend).
- API endpoint consistency across models.

---

## 3. MOTH Schema for Codebase Compaction

**Serialization rules (one-line safety):**
- **Encoding:** UTF-8.
- **Field separator:** `|` (pipe). Escape literal pipes inside fields as `\|`.
- **Braces & brackets:** if `{}`, `[]` appear inside string fields, escape as `\{`, `\}`, `\[`, `\]`.
- **Quotes & backslashes:** use double quotes for string fields; escape `"` and `\`.
- **Whitespace & newlines:** convert `
`, ``, `	` to single spaces; collapse multiple spaces.
- **Multiline docstrings:** normalize to one line (spaces only). No hard wraps.
- **Truncation:** `doc` ≤ 200 chars, `summary` ≤ 150 chars; Unicode‑aware grapheme truncation with terminal ellipsis `…`.
- **Control chars:** strip U+0000–U+001F.
- **Numbers & units:** integers/decimals only; sizes in bytes; hashes lowercase hex.
- **Paths:** POSIX `/`, no leading `./`; keep spaces as spaces (do not percent‑encode); escape only reserved characters per above.

**Escaping example:**
Input doc: `He said: "A | B"
Next line.` → Stored as: `"He said: \"A \| B\" Next line."`


### 3.1 Purpose

To encode an entire repository’s structural, semantic, and metric data into a compressed, line‑based format that can fit within an LLM context or be chunked intelligently.

### 3.2 Format

Optionally include global header and footer fields such as `@META` and `@INDEX` to support partial parsing and chunking in large manifests.

Each file summarized on a single line. Fields separated by `|` for easy parsing.

```
path | {metrics} | deps | symbols | doc | summary
```

### 3.3 Field Definitions

**Typing Rules:** Each field has an explicit expected type to ensure parser consistency and validation.
- **path:** *string* — normalized POSIX path.
- **metrics:** *object* — key:value pairs where values are numeric (integer/float).
- **deps:** *array[string]* — compact list of dependency identifiers.
- **symbols:** *array[string]* — exported function/class names.
- **doc:** *string* — escaped one-line string (≤200 chars).
- **summary:** *string* — escaped one-line LLM-generated summary (≤150 chars).

| Field         | Description                                                                    | Example                                    |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| **path**      | File path relative to repo root                                                | `src/utils/apiBase.ts`                     |
| **{metrics}** | JSON‑like inline object: `{fanin:X;fanout:Y;depth:Z;churn:N;loc:L;coverage:C}` | `{fanin:9;fanout:3;depth:2;churn:12}`      |
| **deps**      | Compact dependency list                                                        | `→[config,vault,auth]`                     |
| **symbols**   | Top‑level functions/classes                                                    | `fn:[getAuth,refreshToken]`                |
| **doc**       | Extracted docstring/comment summary (≤200 chars)                               | `"Handles API requests with retry logic."` |
| **summary**   | Optional LLM‑generated abstract (≤150 chars)                                   | `"Auth API wrapper with caching."`         |

### 3.4 Example Entry

```
src/utils/apiBase.ts | {fanin:9;fanout:3;depth:2;churn:12;coverage:88} | →[config,vault,auth] | fn:[getAuth,refreshToken] | "Utility for authenticated API fetch." | "Wraps fetch with auth and retry."
```

### 3.5 Repository Manifest Structure

**With versioning & checksums (preferred):**
```
#MOTH:repo
meta:{project:IntelliMap;version:1.2;date:2025-10-24;hash:sha256:aaaaaaaa...;parent:sha256:bbbbbbbb...}
@INDEX count:1042 checksum:sha1:cccccccc...
@FILES
<src entries>
@END
```
(See §12.4 for header & integrity field details.)

```
#MOTH:repo
meta:{project:IntelliMap;version:1.0;date:2025‑10‑24}
@FILES
<src entries>
@END
```

Compression target: ≤1 KB per file; 1 MB = \~1000 files.

---

## 4. LLM Analysis Modes

**Context limits & token targets (for batching/model selection):**
- **Summarize Architecture:** input 50–150k tokens via chunked MOTH (LITE/FULL) with map‑reduce; output 500–1000 tokens.
- **Smell Detection:** input 5–10k tokens per batch; output 200–600‑token JSON per batch (merge client‑side).
- **Change Impact Analysis:** input 2–8k tokens (diff + impacted MOTH slice); output 200–400 tokens.
- **Runtime Correlation:** input 4–12k tokens (trace + MOTH slice); output 200–500 tokens.
- **Interactive Q&A:** input 1–6k tokens (top‑k retrieved lines); output ≤300 tokens.

**Context‑window routing:**
- **≤8k tokens:** local Llama small/fast.
- **8–32k:** local Llama large or mid‑tier cloud.
- **32–200k:** GPT‑5 long‑context (single pass) or batched map‑reduce.
- **>200k:** batch + reducer prompt, then optional verifier pass.

| Mode                       | Input                   | Output                                     | Use Case                          |
| -------------------------- | ----------------------- | ------------------------------------------ | --------------------------------- |
| **Summarize Architecture** | Full MOTH manifest      | High‑level prose summary (500‑1000 tokens) | Readable overview for docs/review |
| **Smell Detection**        | MOTH + metrics          | Ranked list of anti‑patterns               | Refactor prioritization           |
| **Change Impact Analysis** | MOTH + diff manifest    | Impacted clusters & risk score             | PR evaluation                     |
| **Runtime Correlation**    | MOTH + run traces       | Narrative of actual behavior               | Profiling summary                 |
| **Interactive Q&A**        | User query + MOTH slice | Answer/explanation                         | Chat‑style interface              |

---

## 5. LLM API Integration

### 5.0 API Key Handling and Deployment
- During local development or internal deployment, use an `.env` file to store the OpenAI API key (`OPENAI_API_KEY`).
- In production builds, expose a configuration interface (settings page or modal) that allows users to **input and securely store their own API key**.
- The backend should detect and prefer the user-provided key at runtime, falling back to the system `.env` key if none is set.
- Ensure user keys are encrypted client-side before persistence (e.g., IndexedDB or localStorage with AES).
- Never log or transmit user API keys to analytics or telemetry endpoints.


### 5.1 Architecture

```
┌────────────────────────┐
│  IntelliMap Frontend   │
│(React + Cytoscape)     │
└────────────┬───────────┘
             │ REST/gRPC
┌────────────▼────────────┐
│   IntelliMap Backend    │
│ Node/Python FastAPI     │
├───────────┬─────────────┤
│  MOTH Gen │  LLM Router │
├───────────┼─────────────┤
│  SQLite   │  Vector DB  │
└───────────┴─────────────┘
```

### 5.2 Endpoints

| Endpoint   | Method | Input                     | Output                           |
| ---------- | ------ | ------------------------- | -------------------------------- |
| `/mothify` | POST   | repo path / graph JSON    | MOTH manifest                    |
| `/analyze` | POST   | MOTH manifest + mode      | JSON analysis / summary text     |
| `/query`   | POST   | natural language question | filtered graph nodes, LLM answer |
| `/embed`   | POST   | MOTH lines                | embeddings stored in pgvector    |
| `/compare` | POST   | two MOTH files            | diff summary & drift report      |

### 5.3 Provider Abstraction

```ts
interface LLMProvider {
  id: string;
  type: 'openai' | 'anthropic' | 'local';
  endpoint: string;
  apiKey?: string;
  contextLimit: number;
  embed(text: string[]): number[][];
  complete(prompt: string): string;
}
```

Switch providers dynamically per user preference or cost profile.

---

## 6. Prompt Design & Context Handling

### 6.1 Prompt Templates

**Architectural Summary Prompt**

```
You are an expert software architect. Given this MOTH manifest, summarize the architecture, primary subsystems, and major coupling risks in ≤800 tokens.
```

**Smell Detection Prompt**

```
Identify architectural problems (God files, cyclic deps, over‑coupled clusters, dead code). Output JSON with {issue,location,reason,severity}.
```

**Q&A Prompt**

```
You are an assistant for IntelliMap. Use the MOTH context below to answer the user query. Be concise and cite file paths when possible.
```

### 6.2 Context Management

- Split manifest into semantic chunks (by directory or cluster).
- Cache embeddings; retrieve top‑k relevant lines per query.
- Compress repeated tokens (path prefixes, metric labels) using shared dictionary.
- Stream results progressively for large queries.

---

## 7. Local Model Support

### 7.1 Supported Backends

- **Ollama** (Llama‑3, Mistral) via REST proxy.
- **vLLM / LM Studio** for GPU hosting.
- **OpenRouter** fallback for mixed model access.

### 7.2 Routing Logic

- GPT‑5 for large‑scale full‑repo reasoning.
- Local Llama for incremental summaries or developer‑side chat.
- Switch automatically by model availability and context size.

---

## 8. Integration with IntelliMap UI

### 8.1 New Panels

- **LLM Analysis Panel** – summary + recommendations.
- **Query Console** – chat interface linked to graph selection.
- **Compare View** – side‑by‑side LLM summaries of two commits.

### 8.2 Node Augmentations

- Hover → display LLM summary snippet.
- Right‑click → “Explain this module” → fetch GPT‑5 summary.
- Cluster badge → risk level or description from smell report.

---

## 9. Evaluation & Safety

| Aspect             | Metric                                           | Approach                      |
| ------------------ | ------------------------------------------------ | ----------------------------- |
| **Accuracy**       | Alignment between LLM summary and static metrics | Manual sample review          |
| **Latency**        | Avg response time per 1 MB MOTH manifest         | API logging                   |
| **Cost**           | Tokens per analysis                              | provider analytics            |
| **Data Privacy**   | Redaction of secrets and comments                | regex filters + entropy check |
| **Local fallback** | 100% offline operation with small models         | regression tests              |

---

## 10. Development Roadmap

| Phase       | Deliverables                                             |
| ----------- | -------------------------------------------------------- |
| **Phase 1** | MOTH generator + GPT‑5 backend integration               |
| **Phase 2** | Q&A and Smell Detection endpoints                        |
| **Phase 3** | Local model routing + embedding cache                    |
| **Phase 4** | Full UI integration (LLM Panel, Chat Console, Diff View) |
| **Phase 5** | Continuous Analysis + CI/CD architectural reports        |

---

## 11. Future Enhancements

- Train lightweight summarization LoRA on internal MOTH data.
- Support MOTH diff visualizations with natural language change logs.
- Integrate with runtime traces for behavior‑aware summaries.
- Add ranking system for LLM recommendations (voting from devs).
- Explore context‑graph compression via adaptive token dictionaries.

---

**Summary:**\
This plan defines a full LLM integration layer for IntelliMap—leveraging the compact MOTH representation to analyze entire codebases semantically, deliver natural‑language architectural insights, and support both cloud and local inference backends with uniform APIs.



---

## 12. MOTH v1.2 Specification Extension

### 12.1 Design Goals
Expand the MOTH schema from a simple file-summary format into a **universal codebase compaction layer** capable of representing hierarchical structures, semantic metadata, and cross-run consistency. The extended version preserves text compactness while supporting multi-language and runtime-linked data.

### 12.2 Structural Extensions
| Tag | Purpose | Example |
|-----|----------|----------|
| `@DIR ... @ENDDIR` | Group files by directory | `@DIR src/utils` ... `@ENDDIR` |
| `@MODULE ... @ENDMODULE` | Define logical subsystems or packages | `@MODULE api-service` ... `@ENDMODULE` |
| `@ASSET` | Represent non-code artifacts with hash & type | `@ASSET img/logo.png {type:image/png;size:40KB;sha1:...}` |
| `lang:` | Track language for metrics normalization | `{lang:py;fanin:3;fanout:1}` |
| `@RUNTRACE` | Link to runtime edges or coverage | `@RUNTRACE id:42 {edges_hit:1200;duration:340s}` |

### 12.3 Semantic Extensions
| Field | Description | Example |
|--------|-------------|----------|
| `emb:[id]` | Vector embedding identifier for retrieval | `emb:[hash_abcd123]` |
| `smell:{type;severity}` | Inline code-smell annotation | `smell:{cycle;3}` |
| `tags:[...]` | Developer or LLM-inferred labels | `tags:[ui,auth,cache]` |
| `doc:` and `sum:` | Separate raw docstring and LLM summary fields | `doc:"Parses tokens." sum:"Tokenizer for config files."` |

### 12.4 Manifest Header & Integrity Fields
```
#MOTH:repo
meta:{project:IntelliMap;version:1.2;date:2025-10-24;hash:sha256(...);parent:sha256(...)}
@INDEX count:1042 checksum:sha1(...)
```
This ensures version traceability, diff verification, and reproducibility between runs.

### 12.5 Compaction Modes
| Mode | Description | Content |
|------|--------------|----------|
| **MOTH-LITE** | Minimal metrics + deps for huge repos | ~0.3 KB/file |
| **MOTH-FULL** | Includes docs, summaries, and tags | ~1 KB/file |
| **MOTH-DIFF** | Only changed entries since last commit | variable |
| **MOTH-B** | Binary CBOR form for machine efficiency | N/A |
| **MOTH-SEG** | Chunked for streaming (≤10KB segments) | partial manifests |

### 12.6 Incremental Update Protocol
1. Compute hashes per entry (path+metrics+deps).
2. Compare to previous manifest for changed nodes.
3. Output `@DIFF` block with added/removed/changed entries.
4. Update header checksum.

### 12.7 Integration Benefits
- **Multi-language support:** consistent metrics schema (`lang`, `loc`, `complexity`).
- **Dynamic linkage:** runtime + LLM tags integrated inline.
- **Diff efficiency:** small patch updates between versions.
- **Embedding persistence:** stable IDs for local vector search.
- **Streaming support:** partial context feeds for large repos.

### 12.8 Future Expansion
- **MOTH-RUN**: attach detailed runtime event sequences.
- **MOTH-META**: embed organizational metadata (authors, ownership, CI links).
- **MOTH-PACK**: compressed archive variant bundling source + manifest.

This extended spec formalizes MOTH as a **portable semantic compression layer** suitable for cross-language analysis, local LLM ingestion, and incremental architectural diffing.


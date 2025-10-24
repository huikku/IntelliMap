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

### 3.1 Purpose

To encode an entire repository’s structural, semantic, and metric data into a compressed, line‑based format that can fit within an LLM context or be chunked intelligently.

### 3.2 Format

Each file summarized on a single line. Fields separated by `|` for easy parsing.

```
path | {metrics} | deps | symbols | doc | summary
```

### 3.3 Field Definitions

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

| Mode                       | Input                   | Output                                     | Use Case                          |
| -------------------------- | ----------------------- | ------------------------------------------ | --------------------------------- |
| **Summarize Architecture** | Full MOTH manifest      | High‑level prose summary (500‑1000 tokens) | Readable overview for docs/review |
| **Smell Detection**        | MOTH + metrics          | Ranked list of anti‑patterns               | Refactor prioritization           |
| **Change Impact Analysis** | MOTH + diff manifest    | Impacted clusters & risk score             | PR evaluation                     |
| **Runtime Correlation**    | MOTH + run traces       | Narrative of actual behavior               | Profiling summary                 |
| **Interactive Q&A**        | User query + MOTH slice | Answer/explanation                         | Chat‑style interface              |

---

## 5. LLM API Integration

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


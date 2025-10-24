# IntelliMap Runtime Analysis — Production-Grade Implementation Plan

## 1. Purpose
Deliver a **real runtime intelligence system** for IntelliMap that goes beyond coverage. The runtime layer will instrument apps in motion, detect real usage patterns, and surface actionable insights about dead code, performance bottlenecks, and runtime errors.

---

## 2. Core Objectives

- **Automatic instrumentation** — zero source edits via compiler hooks.
- **Behavioral visibility** — capture real runtime dependencies, timing, and errors.
- **Performance analysis** — record hot paths and latency outliers.
- **CI enforcement** — block merges on regressions (errors, coverage drops, latency spikes).
- **Data privacy and local-first storage** — never export unredacted runtime traces.

---

## 3. Architecture Overview
```
Browser/App  ─▶  Instrumentation Layer  ─▶  Event Bus  ─▶  ETL Worker  ─▶  DuckDB/SQLite
     ▲                    │                     │              │
     │                    └──▶  Collector API ───┘              └──▶ IntelliMap UI
```

**Key Properties:**
- No vendor lock-in (pure TypeScript + local DB).
- Designed for both dev & production mode with adjustable sampling.
- Modular: `plugins/vite-runtime-instrument`, `runtime/node-loader`, `runner/playwright`, `etl/runtime-merge`, `ui/runtime-overlay`.

---

## 4. Instrumentation Strategies

### 4.1 Frontend (Vite/React)
- **AST transform** via custom Vite plugin: wrap imports and functions with counters.
- **Dynamic import tracing**: intercept `import()` and log edges.
- **Web Performance API**: track LongTasks, TTFB, FCP, CLS.
- **Error tracking**: override `window.onerror`, `console.error`, `unhandledrejection`.
- **Optional OTel bridge**: lightweight span exporter (filesystem sink).

### 4.2 Backend (Node/Express)
- **Require/ESM loader hook**: wrap module resolution; log import edges.
- **Async hooks**: track async call chains and event loop delay.
- **Profiler integration**: V8 sampling, `perf_hooks` timer capture.
- **HTTP instrumentation**: patch `fetch`, `axios`, `pg`, `mongodb` for timing.

### 4.3 Dynamic Behavior Capture
- Instrumented `fetch()` → edge: `src → dst` (duration, status).
- Event-based aggregation (flush via Beacon or WebSocket).
- Adaptive sampling to stay <5% overhead.

---

## 5. Data Model

| Table | Fields | Description |
|--------|---------|-------------|
| `runs` | id, ts, env, branch, commit, flags | Run metadata |
| `edges_runtime` | run_id, src, dst, count, latency_p95 | Runtime call edges |
| `nodes_runtime` | run_id, path, hits, self_ms, total_ms | Node-level metrics |
| `errors` | run_id, path, message, count, stack | Captured exceptions |
| `resources` | run_id, url, type, bytes, ttfb, total_ms | Network & asset load data |

---

## 6. ETL + Aggregation

- Batched upload every 500 events (`sendBeacon` or `fetch`).
- Local aggregation with DuckDB/SQLite.
- Deduplication key: `src|dst|frame|flags`.
- Delta compression for repeated paths.
- Regression comparison per run: coverage, latency, error rate.

---

## 7. Analyses & Reports

| Report | Description | Visual |
|--------|--------------|--------|
| **Dead Code** | Files never executed in any run | Faded nodes |
| **Hot Paths** | Longest call chains by cumulative latency | Thick, red edges |
| **Broken Features** | Error signatures by module | Red icons in graph |
| **Unused Deps** | Static imports never executed | Dashed gray edges |
| **Flag Coverage** | Feature flag usage map | Gradient overlay |
| **Runtime Drift** | Change in edge count or latency vs last run | Diff view |

---

## 8. Quality Gates (CI)

- Fail merge if:
  - Runtime coverage < baseline.
  - Error count > threshold.
  - 95th percentile latency > +20% regression.
- Artifacts: JSON + HTML reports stored per build.
- CI runs scenario pack (Playwright or Puppeteer) to simulate user actions.

---

## 9. Security & Privacy

- PII scrub: remove tokens, emails, URLs with sensitive params.
- Local-only export by default.
- Optional signing: hash of `runs + aggregates` for provenance.
- No third-party endpoints; all telemetry stays local.

---

## 10. UI Integration

- **Runtime Overlay:** toggle on graph view to show executed edges and node heat.
- **Error Timeline:** chronological error chart per module.
- **Hot Path Player:** animate through recorded execution traces.
- **Diff View:** compare two runs (added/removed edges, latency drift).

---

## 11. Implementation Steps

1. Build `vite-runtime-instrument.ts` (AST transformer).
2. Build `node-loader.mjs` (require/import hook).
3. Implement collector endpoint + ETL worker.
4. Build scenario runner (Playwright).
5. Implement runtime overlay in Cytoscape.
6. Add CI job for regression gates.

---

## 12. Future Extensions

- Distributed tracing (OpenTelemetry-compatible).
- Replay system for deterministic regression reproduction.
- Auto-summarized runtime diffs via GPT‑5 integration.
- Heatmap aggregation over multiple runs.
- Live session replay integration with privacy scrubber.

---

**Summary:**  
This runtime plan turns IntelliMap into a behavioral analytics platform — combining static dependency maps with *actual* execution data to expose the living architecture of your system in real time.


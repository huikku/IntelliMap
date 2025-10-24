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

| Table           | Fields                                     | Description               |
| --------------- | ------------------------------------------ | ------------------------- |
| `runs`          | id, ts, env, branch, commit, flags         | Run metadata              |
| `edges_runtime` | run\_id, src, dst, count, latency\_p95     | Runtime call edges        |
| `nodes_runtime` | run\_id, path, hits, self\_ms, total\_ms   | Node-level metrics        |
| `errors`        | run\_id, path, message, count, stack       | Captured exceptions       |
| `resources`     | run\_id, url, type, bytes, ttfb, total\_ms | Network & asset load data |

---

## 6. ETL + Aggregation

- Batched upload every 500 events (`sendBeacon` or `fetch`).
- Local aggregation with DuckDB/SQLite.
- Deduplication key: `src|dst|frame|flags`.
- Delta compression for repeated paths.
- Regression comparison per run: coverage, latency, error rate.

---

## 7. Analyses & Reports

| Report              | Description                                 | Visual             |
| ------------------- | ------------------------------------------- | ------------------ |
| **Dead Code**       | Files never executed in any run             | Faded nodes        |
| **Hot Paths**       | Longest call chains by cumulative latency   | Thick, red edges   |
| **Broken Features** | Error signatures by module                  | Red icons in graph |
| **Unused Deps**     | Static imports never executed               | Dashed gray edges  |
| **Flag Coverage**   | Feature flag usage map                      | Gradient overlay   |
| **Runtime Drift**   | Change in edge count or latency vs last run | Diff view          |

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

**Summary:**\
This runtime plan turns IntelliMap into a behavioral analytics platform — combining static dependency maps with *actual* execution data to expose the living architecture of your system in real time.



---

## 13. V8 Integration (CPU, Coverage, Heap) — When & How

**Positioning:** Use V8 for **CPU sampling**, **precise coverage** (Chromium), and **heap snapshots**. Keep your **edge/flow capture** with the Vite/loader hooks; V8 does not provide module‑level dependency edges.

### 13.1 When to use V8 vs Custom Hooks

| Need                        | Best tool                | Reason                                                      |
| --------------------------- | ------------------------ | ----------------------------------------------------------- |
| Hot‑path detection          | **V8 CPU sampler**       | Low overhead, stack samples map to modules via source maps. |
| Precise coverage (frontend) | **CDP precise coverage** | Per‑function counts; complements executed‑edge overlay.     |
| Aggregate coverage (Node)   |                          |                                                             |

| ``                    | Cheap, continuous coverage aggregation. |                                     |
| --------------------- | --------------------------------------- | ----------------------------------- |
| Memory leak analysis  | **Heap snapshots**                      | Retaining paths and growth diffs.   |
| Dependency/call edges | **Your instrumentation**                | V8 lacks semantic module edge info. |
| HTTP/DB latency       | **Your timers/**``                      | Domain timing & tags needed.        |

### 13.2 Node (backend) — CPU profile + coverage

**CPU sampling (inspector API, outputs **``**):**

```js
// cpu-profiler.js
import fs from 'node:fs';
import inspector from 'node:inspector';

export async function withCpuProfile(runName, fn, samplingIntervalMicros = 5000) {
  const session = new inspector.Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', { interval: samplingIntervalMicros });
  await session.post('Profiler.start');
  try {
    return await fn();
  } finally {
    const { profile } = await new Promise((res, rej) =>
      session.post('Profiler.stop', (err, params) => err ? rej(err) : res(params))
    );
    fs.mkdirSync('.intellimap/profiles', { recursive: true });
    fs.writeFileSync(`.intellimap/profiles/${runName}.cpuprofile`, JSON.stringify(profile));
    session.disconnect();
  }
}
```

Wrap your scenario:

```js
import { withCpuProfile } from './cpu-profiler.js';
await withCpuProfile('auth_upload_generate', async () => {
  await runScenario();
});
```

**Aggregate coverage (cheap):**

```js
import v8 from 'node:v8';
v8.takeCoverage();           // start aggregation
// ... run scenarios ...
const coverage = v8.stopCoverage(); // [{url, functions:[{ranges:[{start,end,count}], isBlockCoverage}]}]
```

Store `coverage` into `coverage`/`nodes_runtime`; resolve `url` to sources via source maps.

### 13.3 Frontend (Chromium) — CDP profiling & precise coverage

Playwright sketch:

```ts
const client = await context.newCDPSession(page);
await client.send('Profiler.enable');
await client.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
// run user flows ...
const { result } = await client.send('Profiler.takePreciseCoverage');
await client.send('Profiler.stopPreciseCoverage');
await client.send('Profiler.disable');
```

Pipe `result` into your ETL to enrich `nodes_runtime` (per‑function execution) and coverage overlays.

### 13.4 Wiring V8 data into IntelliMap analyses

- **Hot Paths:** Import `.cpuprofile` into ETL, attribute samples to files (via source maps), widen edges by sample weight along observed paths.
- **Coverage Overlay:** Merge Node `stopCoverage()` + CDP precise coverage with executed‑edge data to color nodes/edges by execution.
- **CI Gates:** Compare p95 latency (timers) and CPU hotspots (samples); fail PRs on regressions.

### 13.5 Defaults, Overhead & Safety

- **Sampling interval:** start at **5000 μs** in CI (<5% overhead). Use **1000–2000 μs** only for deep investigations.
- **Warm‑up:** discard first minute or run a warm phase to stabilize JIT/caches.
- **Source maps:** build with inline sources; otherwise profiles/coverage map to bundles.
- **Production:** keep CPU sampling off by default; enable via flag with strict sampling budget.

### 13.6 Heap Snapshots (optional)

- Take `heapSnapshot` (CDP) or Node inspector snapshots pre/post scenario; diff retained sizes by constructor.
- Surface **leak suspects** as module badges; link to snapshot paths.

---

**Action:** Add a toggle in the Runtime Overlay: *CPU/Heap/Precise Coverage* ▢ — when enabled, IntelliMap fetches latest profiles/coverage for the selected run and re-renders widths/colors accordingly.


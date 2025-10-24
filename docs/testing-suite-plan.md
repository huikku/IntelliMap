# Implementation Plan — Novel Codebase Mapping Experiments (IntelliMap)

## Overview

This plan defines how to implement and compare multiple novel layout strategies for codebase visualization using React + Cytoscape + Vite + Tailwind. Each method integrates semantic, structural, and hierarchical data to make large code graphs interpretable.

---

## 1. Project Setup

* Framework: **React + TypeScript + Cytoscape.js + Vite + Tailwind**
* Data pipeline:

  * Static import/dependency graph (AST-based)
  * Optional embeddings + LLM tags (local Llama)
* UI:

  * Layout selector (Dropdown)
  * Metric selector (size/color encoding)
  * Toggle panels: Clusters ▢, Layers ▢, Changes ▢

---

## 2. Baseline Layouts (Existing)

### 2.1 Dagre

Deterministic top-down dependency layout.

* Use for reference (clarity benchmark)
* Evaluate with large graphs for overlap metrics

### 2.2 FCose

Physics-based layout with better clustering than basic force-directed.

* Use as base for hybrid experiments

---

## 3. Experimental Layouts

### 3.1 **Latent Semantic Embedding Layout**

**Goal:** Group modules by semantic similarity instead of folder structure.

**Pipeline:**

1. Embed each file/function with CodeBERT, Llama, or StarCoder-mini.
2. Reduce to 2D using **UMAP(n_neighbors=15, min_dist=0.2)**.
3. Assign (x, y) as Cytoscape positions.
4. Add import edges for context.

**Expected outcome:** Semantic regions (UI / API / Utils) emerge naturally.

---

### 3.2 **Hybrid Flow + Embedding Layout**

**Goal:** Combine architectural direction (X-axis) with semantic clustering (Y-axis).

**Pipeline:**

1. Compute import depth (from entrypoints → leaves).
2. Assign depth to X coordinate.
3. Use embeddings to determine Y.
4. Apply weak physics constraints to minimize edge overlap.

**Expected outcome:** Left-to-right data flow with vertical thematic grouping.

---

### 3.3 **Hierarchical Space-Filling Layout**

**Goal:** Visualize hierarchical structure without chaos.

**Pipeline:**

1. Compute directory tree.
2. Use **treemap or squarify algorithm** to allocate 2D space.
3. Run small internal force layout inside each region.
4. Maintain folder boundaries visually with Tailwind borders.

**Expected outcome:** Architectural map that preserves hierarchy + context.

---

### 3.4 **Temporal-Diff Layout**

**Goal:** Map evolution of codebase over time.

**Pipeline:**

1. Extract commit timestamps per file.
2. X = creation time, Y = dependency depth.
3. Animate commit sequence or overlay diff heatmap.

**Expected outcome:** Evolutionary timeline revealing refactors, bursts of activity.

---

### 3.5 **Energy-Field Layout**

**Goal:** Replace edge-based forces with field equations representing semantic attraction.

**Physics model:**

* Imports → Attractive field (spring-like)
* Directory → Gravitational center
* Unrelated modules → Coulombic repulsion

**Implementation:** Custom d3-force integrator:

```js
force('semantic', alpha => {
  nodes.forEach(n => {
    const field = getFieldVector(n, clusters, gravityCenters);
    n.vx += field.x * alpha;
    n.vy += field.y * alpha;
  });
});
```

**Expected outcome:** Organic convergence to semantic basins instead of tangled webs.

---

### 3.6 **LLM-Directed Macro Layout**

**Goal:** Let an LLM define macro-regions based on architecture.

**Pipeline:**

1. Feed file names + dependencies to Llama (local).
2. Prompt: “Group modules into logical regions (core, api, frontend, tests). Return JSON with region bounds.”
3. Use JSON to place cluster centroids.
4. Run local force layout within each region.

**Expected outcome:** LLM-guided architectural zoning; interpretable regions.

---

### 3.7 **3D Globe Layout (Experimental)**

**Goal:** Encode depth or importance as Z-axis, reduce overlap.

**Pipeline:**

* Use `react-three-fiber` + `three-forcegraph`.
* Core modules near poles, leaves at surface.
* Mouse orbit to navigate.

**Expected outcome:** Dense graphs visualized spatially; interactive exploration.

---

## 4. Evaluation Criteria

| Metric                  | Description                                  | Method                              |
| ----------------------- | -------------------------------------------- | ----------------------------------- |
| **Cognitive clarity**   | How easily a developer understands structure | User feedback / time-to-locate test |
| **Edge crossing count** | Visual clutter metric                        | Automated count                     |
| **Layout stability**    | Frame-to-frame stability                     | Node displacement variance          |
| **Computation time**    | Layout runtime                               | Profiling per graph size            |
| **Semantic coherence**  | Clustering of related modules                | Cosine similarity within clusters   |

---

## 5. Experiment Control Panel (UI Plan)

**Dropdowns:** Layout ▾ | Metric ▾ | Color ▾ | Node Size ▾
**Toggles:** Clusters ▢  Layers ▢  Timeline ▢  LLM Zones ▢ 3D Mode ▢
**Buttons:** [Recompute] [Randomize] [Export JSON]

Tailwind layout example:

```html
<header class="flex justify-between p-2 bg-gray-900 text-white">
  <select id="layout">...</select>
  <div class="space-x-2">
    <button>Recompute</button>
    <button>Export</button>
  </div>
</header>
```

---

## 6. Roadmap

| Phase       | Tasks                                   | Output                                     |
| ----------- | --------------------------------------- | ------------------------------------------ |
| **MVP**     | Dagre, FCose, ELK integration           | Baseline graph rendering                   |
| **Phase 1** | Semantic Embedding + Hybrid Flow Layout | Layout 2D JSON export                      |
| **Phase 2** | LLM Zoning + Temporal-Diff              | Cluster labeling + diff overlay            |
| **Phase 3** | Energy-Field Physics + 3D Globe         | Experimental physics + R3F view            |
| **Phase 4** | Comparative Evaluation                  | Benchmark metrics + visualization selector |

---

## 7. Integration Notes

* Use Web Workers for layout computation (prevent UI freeze)
* Cache embeddings in SQLite or localStorage
* Allow importing/exporting layout JSON for reproducibility
* Modularize each layout as plugin: `/layouts/semantic.ts`, `/layouts/energyField.ts` etc.

---

## 8. Deliverables

* `` folder with modular layout strategies
* `` interactive UI
* `` Llama-based cluster tagging
* **Evaluation report** comparing clarity, stability, and speed across methods

---

## 9. Problem‑Finding Reports (beyond cycles)

Actionable analyses that surface risky hotspots and architectural smells. Each item includes: **metric ⇒ how to compute ⇒ what to visualize ⇒ suggested fix**.

### 9.1 Dependency Health

* **Unstable Dependency** (Stable Abstractions Principle)

  * ⇒ *Instability* I = fan‑out / (fan‑in + fan‑out); flag modules with high I that many others depend on.
  * ⇒ Color nodes by I; thick red edges into unstable nodes.
  * ⇒ Extract interfaces, invert dependency, or split package.
* **Hub‑Like Dependency (HLD)**

  * ⇒ High betweenness centrality; routes many paths.
  * ⇒ Size by betweenness; tooltip shows path count.
  * ⇒ Introduce facades; reduce cross‑cutting imports.
* **Tangles / SCC Size > N**

  * ⇒ Strongly Connected Components > threshold.
  * ⇒ Outline SCCs; rank by size & change churn.
  * ⇒ Break by dependency inversion / module split.
* **Layering Violations**

  * ⇒ Edges that go “up” against declared layer order (UI→Service→Data).
  * ⇒ Render violating edges in orange dashed; report offenders.
  * ⇒ Move code or create boundary adapters.
* **Forbidden Imports** (rulesets)

  * ⇒ Regex rules (e.g., tests→src only; src↛tests).
  * ⇒ List violations with file/line anchors.

### 9.2 Complexity × Churn (Hotspots)

* **Hotspot Score**

  * ⇒ Normalize cyclomatic complexity × commit frequency (last 90d).
  * ⇒ Heatmap node fill; top‑k table.
  * ⇒ Refactor first (high churn + high complexity yields bugs).
* **Deep Dependency Chains**

  * ⇒ Longest path length from entrypoints.
  * ⇒ Label nodes with depth; warn > threshold.
  * ⇒ Flatten abstractions, cache results.
* **Temporal Coupling**

  * ⇒ Files that co‑change together (pairwise commit support & lift).
  * ⇒ Draw dotted edges between coupled files; opacity by lift.
  * ⇒ Consider grouping, extract shared module, or split responsibilities.

### 9.3 Code Quality & Maintainability

* **Clone/Copy‑Paste Detection**

  * ⇒ Token‑based (winnowing) or AST‑based clone finder.
  * ⇒ Link duplicates with gray edges; list families.
  * ⇒ DRY refactor, utility extraction.
* **Dead/Orphaned Modules**

  * ⇒ In‑degree=0 & not an entry/tool/test; cross‑check runtime refs.
  * ⇒ Fade or group in “Orphans” island.
  * ⇒ Delete or document as plugin.
* **Exception Swallowing / Broad Catches**

  * ⇒ AST rule: catch-all without rethrow/log.
  * ⇒ Flag per file; severity by count.
  * ⇒ Narrow exceptions, add telemetry.
* **Type Coverage Gaps**

  * ⇒ TS `any`/`unknown` density; Python `typing` hints coverage.
  * ⇒ Stripe border by gap %; table of worst files.
  * ⇒ Add types, introduce strict mode.

### 9.4 Testing & Quality Risk

* **Test Coverage Overlay**

  * ⇒ Merge coverage reports; map to nodes.
  * ⇒ Desaturate well‑covered, highlight low.
  * ⇒ Target high hotspot/low coverage first.
* **Flaky Test Detector**

  * ⇒ CI history variance & reruns.
  * ⇒ Red badge on test modules; link to logs.
  * ⇒ Stabilize fixtures, time controls.
* **Test Pyramid Shape**

  * ⇒ Count unit/integration/e2e ratio.
  * ⇒ Small stacked bar per cluster.
  * ⇒ Rebalance towards unit tests.

### 9.5 Security & Supply Chain

* **Secrets in Repo**

  * ⇒ TruffleHog/Gitleaks scan; recent commits focus.
  * ⇒ Danger icon per file; severity by match confidence.
  * ⇒ Rotate keys; add pre‑commit hooks.
* **Vulnerability Surface**

  * ⇒ Snyk/OSV advisories mapped to importers.
  * ⇒ Edge color by vulnerable path; node badge count.
  * ⇒ Upgrade, patch, or sandbox.
* **License Compliance**

  * ⇒ SPDX map for third‑party deps.
  * ⇒ Color external nodes by license risk.
  * ⇒ Replace problematic libs or add NOTICE.

### 9.6 Performance & Build Graph

* **Critical Path to Build/Bundle**

  * ⇒ Build graph; longest path & large assets.
  * ⇒ Highlight path; show total ms & size.
  * ⇒ Code split; lazy‑load; cache.
* **N+1 Query Risk (Backends)**

  * ⇒ Heuristics: ORM `for` loops with queries, missing joins.
  * ⇒ Flag modules & call sites.
  * ⇒ Batch queries, prefetch, pagination.
* **Cold‑Start Weight**

  * ⇒ Bytes reachable from entrypoints.
  * ⇒ Node label shows kb; warn > budget.

### 9.7 Ownership, Bus‑Factor, and Process

* **Bus Factor**

  * ⇒ Unique authors per file & concentration.
  * ⇒ Outline low‑author files (≤2) with warning.
  * ⇒ Spread ownership, add reviewers.
* **Code Ownership Drift**

  * ⇒ Compare CODEOWNERS vs recent authors.
  * ⇒ Badge mismatches; suggest updates.
* **PR Review Latency by Area**

  * ⇒ Median time to merge per cluster.
  * ⇒ Sparkline in cluster tooltip.

### 9.8 Report Outputs & UI Wiring

* **Reports Panel** with tabs: *Hotspots · Layer Violations · Forbidden Imports · Temporal Coupling · Clones · Coverage · Security · Build Path · Ownership*.
* Each tab provides: table (sortable), “focus in graph” button, and **Export CSV/JSON**.
* **Batch Rules Engine:** YAML config to turn checks on/off per repo.

### 9.9 Data Sources & Jobs

* AST parsers (TS/JS, Python), Git (churn, coupling), CI (flaky, latency), Coverage (lcov, pytest), SCA (OSV/Snyk), Clone detector, LLM tags (optional).
* Run in WebWorkers or background service; cache results in SQLite/localStorage; incremental updates on git diffs.

### 9.10 Priorities (MVP → v1)

* **MVP:** Hotspots, Layer Violations, Forbidden Imports, Orphans, SCC size, Coverage overlay.
* **v1:** Temporal Coupling, Clone detection, Bus factor, Critical build path, Vulnerability surface.
* **v2:** Flaky tests, N+1 risk, Ownership drift, Secrets scanner, Review latency.

---

## 10. Runtime Analysis Layer (Run-Based Testing)

### Purpose

Augment static dependency graphs with *observed runtime behavior* from test or production runs. Enables dynamic coverage visualization, performance hot-spot detection, and runtime validation of architectural rules.

### 10.1 Data Model

| Table           | Fields                                       | Description                                    |
| --------------- | -------------------------------------------- | ---------------------------------------------- |
| `runs`          | `id`, `timestamp`, `env`, `branch`, `commit` | Metadata for each instrumented run/test suite. |
| `edges_static`  | `src`, `dst`                                 | All import edges (from AST).                   |
| `edges_runtime` | `src`, `dst`, `run_id`, `count`, `time_ms`   | Observed call edges during execution.          |
| `coverage`      | `file`, `statements`, `covered`, `run_id`    | Per-file coverage summary.                     |

### 10.2 Instrumentation

* **JavaScript/TypeScript**: use `nyc`, `babel-plugin-istanbul`, or Node’s `v8-coverage` API.
* **Python**: use `coverage.py`, `sys.settrace`, or decorators for call logging.
* **Integration**: wrap CI test commands (e.g., `npm test`, `pytest`) to emit JSON traces to `/intellimap/runs/<id>/trace.json`.

Example edge event:

```json
{"run_id":42, "edges":[["src/api.js","src/db.js"],["src/app.js","src/auth.js"]], "metrics":{"src/api.js":12.4}}
```

### 10.3 Processing Pipeline

1. **Ingest** traces after each run; merge with existing SQLite DB.
2. **Normalize** file paths and deduplicate edges.
3. **Compare** static vs runtime → classify edges: `hit`, `missed`, `new`, `removed`.
4. **Compute Metrics:**

   * execution frequency
   * cumulative latency per edge
   * coverage % per node
   * unused code detection (never executed)

### 10.4 Visualizations

| Mode                | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Runtime Overlay** | Highlight edges/nodes actually executed. Faded gray = static only; bright cyan = active. |
| **Hot Path View**   | Width/color ∝ call frequency or latency; animatable over time.                           |
| **Coverage Map**    | Node color = coverage %; filter < threshold.                                             |
| **Run Selector**    | Dropdown to compare different runs (CI build, local test, prod trace).                   |
| **Diff View**       | Visual diff between two runs (added/removed edges, changed coverage).                    |

### 10.5 Reports Generated

* **Runtime vs Static Discrepancy:** edges declared but not observed; possible dead code.
* **Uncovered Files:** zero runtime hits; candidate for test addition.
* **Performance Hotspots:** top-k edges by cumulative time.
* **Regression Detection:** edges appearing/disappearing between runs.
* **Dynamic Cycle Detection:** cycles encountered at runtime only.

### 10.6 UI Integration

* Toggle button: *Runtime Overlay ▢* in Reports panel.
* Sub-tab under *Hotspots* → *Runtime Activity*.
* Hover tooltip: `count`, `avg_time`, `coverage%`, `last_run_id`.
* Export options: per-run JSON and CSV summaries.

### 10.7 Future Extensions

* **LLM-Assisted Summaries:** generate natural-language summaries of runtime gaps (e.g., “Auth middleware never executed in test suite”).
* **Animation Timeline:** play run sequence showing edge activations.
* **Anomaly Detection:** compare latency distributions over runs.
* **Integration with Coverage Badges:** auto-update README or dashboard.

### 10.8 Implementation Priorities

1. MVP: coverage ingestion + static vs runtime overlay.
2. Phase 2: hot path and latency visualization.
3. Phase 3: regression diff + LLM summary integration.

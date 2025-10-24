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

* **`/src/layouts/`** folder with modular layout strategies
* **`/src/components/LayoutSelector.tsx`** interactive UI
* **`/src/lib/llmClusterer.ts`** Llama-based cluster tagging
* **Evaluation report** comparing clarity, stability, and speed across methods

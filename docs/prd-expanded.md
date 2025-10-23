# PRD — IntelliMap (Personal App + Backend Architecture Visualizer)

## 1. Purpose

A local-only tool for visualizing **full-stack code structure** — both frontend and backend. It generates a live dependency graph for **JS/TS (frontend + Node)** and **Python (backend)** projects, combining static analysis from build metadata and AST parsing. The tool renders the resulting dependency map in Cytoscape.js. The goal: understand system-wide architecture, module dependencies, and change impact without relying on SaaS or IDE plugins.

### Core Question

> “How is my entire app — front to back — wired together, and what breaks when I change this file?”

---

## 2. Scope (MVP)

* **Single-user, local execution only**
* **Static import graph only** (no dynamic call graph)
* **Languages supported:**

  * JavaScript / TypeScript (frontend + Node backend)
  * Python 3.9+ (backend services, API layers, scripts)
* **Single repo or monorepo**

  * Supports JS workspace roots and Python package directories (e.g., `backend/`, `api/`)
* Outputs a unified self-contained JSON (`graph.json`) for visualization
* Lightweight React UI for graph navigation
* Optional: git diff overlay
* **Multiplanar 2D views only (no 3D, no LLM)**

---

## 3. Non-Goals

* Function-level call graphs or runtime tracing (reserved for hybrid mode)
* Multi-repo orchestration (future feature)
* Cloud-hosted or networked deployments
* Authentication, access control, or cloud sync
* 3D visualization or RAG/LLM integration (future-only)

---

## 4. System Overview

```
CLI (Node.js) → analyzers:{esbuild(JS/TS/Node), py-ast(Python)} → merge → graph.json → Express server → React (Cytoscape UI)
```

### Key Components

| Component                | Function                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **Indexer (JS/TS/Node)** | Uses `esbuild --metafile` to collect import and require relationships                  |
| **Indexer (Python)**     | Parses Python files with AST to extract `import` / `from ... import ...` relationships |
| **Merger**               | Normalizes and merges outputs into a unified schema tagged by language and environment |
| **Diff Engine**          | Marks changed nodes via `git diff`                                                     |
| **Server**               | Hosts static UI, serves `graph.json`, supports live reload                             |
| **UI (React)**           | Displays an interactive graph view (Cytoscape.js) with multiplanar modes               |

---

## 5. Core Features

### 5.1 Graph Generation

#### JS/TS/Node

* Uses `esbuild` with `--metafile` to extract dependency edges.
* Parses both `import` and `require()` statements.
* Handles path aliases, workspace references, and barrel exports.
* Marks entries as `env:node` for server code, or `env:frontend` when imported by browser bundles.

#### Python

* Walks the configured backend root (e.g., `backend/`).
* Uses `ast` to find all `Import` and `ImportFrom` nodes.
* Resolves local imports via `importlib.util.find_spec()`.
* Marks unresolved modules as external (`vendor:python`).
* Tags nodes as `{lang:'py', env:'backend'}`.

#### Merge Process

* Combines both graphs under a common schema.
* Deduplicates by normalized path.
* Annotates nodes with `{lang, env, pkg, folder, changed}`.
* Cross-language edges (e.g., API calls) are not inferred in MVP.

### 5.2 Visualization

* **Cytoscape.js** renderer
* Layouts: ELK (hierarchical), fcose (force-directed)
* Multiplanar 2D views:

  * Plane A: static architecture (all code)
  * Plane B: backend-only (Python/Node)
  * Plane C: diff overlay (changed files)
* Controls:

  * Search by file or module
  * Collapse/expand by folder or language
  * Filter by environment (frontend/backend)
  * Highlight changed or external nodes
* Styling:

  * Node color = language/env cluster
  * Changed = red border
  * Hover = highlight dependencies
  * Vendor modules = dimmed gray

### 5.3 Git Diff Overlay

* Runs `git diff --name-only base..head`
* Marks affected nodes as `{changed:true}`
* UI toggle: “Show changed only”

### 5.4 Live Reload

* Watches source directories for changes (`chokidar`)
* Reindexes automatically and emits refresh signal to UI via SSE

---

## 6. Technical Implementation

### 6.1 CLI

```
intellimap index \
  [--entry src/index.ts] \
  [--node-entry server/index.ts] \
  [--py-root backend/] \
  [--py-extra-path backend/.venv/lib/python3.11/site-packages] \
  [--out .intellimap/graph.json]

intellimap diff [base] [head]
intellimap serve [--port 7676] [--watch]
```

**Node-side dependencies:**

* `esbuild`, `fs-extra`, `fast-glob`, `commander`, `chokidar`, `simple-git`

**Python-side:**

* Requires Python ≥3.9
* Standard libraries only (`ast`, `importlib`, `pathlib`)

### Output Schema

```json
{
  "meta": {"repoRoot": "/repo", "generatedAt": 1730000000, "tool": "intellimap@0.1"},
  "nodes": [
    {"id": "src/App.tsx", "lang": "ts", "env": "frontend", "pkg": "app", "changed": false},
    {"id": "backend/api/server.py", "lang": "py", "env": "backend", "pkg": "backend", "changed": true}
  ],
  "edges": [
    {"from": "src/App.tsx", "to": "src/components/Header.tsx", "kind": "import"},
    {"from": "backend/api/server.py", "to": "backend/core/db.py", "kind": "import"}
  ]
}
```

### 6.2 Express Server

Serves both `graph.json` and static UI. Supports auto-refresh via SSE when graph updates.

### 6.3 React UI (Vite + Cytoscape.js + Tailwind + shadcn/ui)

Uses React + Vite for dev speed, Tailwind for styling, and shadcn/ui for polished components.

**Libraries:** `react`, `vite`, `cytoscape`, `cytoscape-elk`, `framer-motion`, `lucide-react`

**Filters:** `Language` (JS/TS, Python), `Environment` (frontend, backend)

**Main Components:**

| Component           | Description                          |
| ------------------- | ------------------------------------ |
| `<GraphView />`     | Cytoscape visualization layer        |
| `<Sidebar />`       | Search, filter, layout toggles       |
| `<Toolbar />`       | Graph control buttons                |
| `<Inspector />`     | Node detail + dependency info        |
| `<PlaneSwitcher />` | Plane selector (static/backend/diff) |

---

## 7. File Hierarchy

```
intellimap/
├── package.json
├── README.md
├── packages/
│   ├── cli/
│   │   ├── index.js
│   │   ├── esbuildGraph.js
│   │   ├── mergeGraphs.js
│   │   └── watcher.js
│   ├── py/
│   │   ├── indexer.py
│   │   ├── resolver.py
│   │   └── requirements.txt
│   ├── server/
│   │   ├── server.js
│   │   └── reload.js
│   └── ui/
│       ├── src/
│       │   ├── App.jsx
│       │   ├── components/
│       │   │   ├── GraphView.jsx
│       │   │   ├── Sidebar.jsx
│       │   │   ├── Toolbar.jsx
│       │   │   ├── Inspector.jsx
│       │   │   └── PlaneSwitcher.jsx
│       │   └── styles/theme.css
│       └── vite.config.js
└── .intellimap/
    ├── graph.json
    ├── js-graph.json
    ├── py-graph.json
    └── config.json
```

---

## 8. UI Overview (KablUI Summary)

```
@APP[theme:dark id:intellimap]
  @HEADER[h:48 bg:#1e1e1e]
    "IntelliMap" [Button Reload @click:RUN{index}] [Dropdown Plane: [Static|Backend|Diff]] [Dropdown Filter: [All|JS/TS|Python]]
  @SIDEBAR_LEFT[w:280 bg:#202020]
    §FILTERS
      [Checkbox ShowChanged]
      [Checkbox CollapseByFolder checked]
      [Dropdown Language items:[All|JS/TS|Python]]
      [Dropdown Env items:[All|frontend|backend]]
    §STRUCTURE
      @TREEVIEW
        @TREENODE[label:"frontend (JS/TS)"]
        @TREENODE[label:"backend (Python)"]
  @MAIN[bg:#0f0f0f]
    @TOOLBAR
      [Button Fit] [Button Center] [Dropdown Layout items:[elk|fcose]]
    @GRAPH_VIEW[plane:active]
  @SIDEBAR_RIGHT[w:320 bg:#202020]
    §DETAILS
      [Label] Path [Code]
      [Label] Language [Badge]
      [Label] Env [Badge]
      [Label] Imports [Badge]
      [Label] ImportedBy [Badge]
  @FOOTER[h:24 bg:#181818] "© 2025 IntelliMap"
```

---

## 9. Implementation Phases

| Phase | Deliverable               | Duration |
| ----- | ------------------------- | -------- |
| 1     | JS/TS indexer via esbuild | 0.5 day  |
| 2     | Python AST indexer        | 0.5 day  |
| 3     | Merge + unified schema    | 0.25 day |
| 4     | React UI (Cytoscape)      | 0.5 day  |
| 5     | Git diff + multiplanar UI | 0.25 day |
| 6     | Live reload + polish      | 0.25 day |

**Total:** ~2.25 days (AI-assisted development)

---

## 10. Future Extensions

* **Hybrid trace mode** — merge static graph with runtime data from Node inspector, `c8`, or Python `coverage.py`.
* **Cross-language call inference** (API-to-client path visualization).
* **Runtime heatmap overlay** (coverage intensity).
* **Optional 3D visualization** using WebGL (`three.js`).
* **Multi-repo project graphing.**
* **Persistent layout + custom tagging.**

# 🗺️ IntelliMap

Local-only full-stack code architecture visualizer for JavaScript/TypeScript and Python projects.

## Features

### Core Visualization
- 📊 **Static Import Graph** - Visualize dependencies in your codebase
- 🔍 **Multi-language Support** - JS/TS (frontend + Node) and Python (backend)
- 🎨 **Interactive Visualization** - Cytoscape.js with ELK/fcose layouts
- 🔄 **Git Diff Overlay** - See what changed in your PR
- 🎯 **Multiplanar Views** - Static, Backend-only, and Diff planes
- ⚡ **Live Reload** - Auto-refresh on file changes
- 🏠 **Local-only** - No cloud, no auth, no tracking

### Code Analysis
- 🔴 **Cycle Detection** - Find circular dependencies with Tarjan's algorithm
- 🏗️ **Architecture Analysis** - Detect god files, monolithic modules, unstable dependencies
- ⚡ **Runtime Analysis** - Merge test coverage with static graph for:
  - Coverage gaps (dead code detection)
  - Performance hotspots (slowest modules)
  - Dynamic dependencies (runtime-only imports)
  - Dead code analysis by directory

## Quick Start

### Installation

```bash
npm install
```

### Generate Graph

```bash
npm run index -- --entry src/index.ts --py-root backend/
```

### Start Server

```bash
npm run serve -- --port 7676 --watch
```

Then open http://localhost:7676 in your browser.

## Commands

### Index
Generate the architecture graph from your codebase.

```bash
npm run cli -- index \
  --entry src/index.ts \
  --node-entry server/index.ts \
  --py-root backend/ \
  --py-extra-path backend/.venv/lib/python3.11/site-packages \
  --out .intellimap/graph.json
```

### Serve
Start the visualization server with optional live reload.

```bash
npm run cli -- serve --port 7676 --watch
```

### Diff
Overlay git diff information on the graph.

```bash
npm run cli -- diff HEAD~1 HEAD
```

### Runtime Analysis (Run from the App!)
Collect **real** test coverage and analyze runtime behavior - **all from the browser!**

**In-App Workflow (Recommended):**
1. Start IntelliMap: `npm run serve`
2. Click **📊 Analysis** tab
3. Click **🔧 Setup Runtime** (one-time, ~30 seconds)
4. Click **📊 Collect Coverage** (runs your tests)
5. Click **⚡ View Analysis** (see results)

**CLI Workflow (Alternative):**
```bash
npm run runtime:setup    # One-time setup
npm run runtime:collect  # Collect coverage
npm run serve            # View in UI
```

**What You Get:**
- ✅ **Real coverage metrics** (edges & nodes from actual tests)
- ✅ **Performance hotspots** (top 10 slowest modules)
- ✅ **Dead code analysis** (files never executed)
- ✅ **Dynamic dependencies** (runtime-only imports)
- ✅ **Git integration** (branch, commit, timestamp)

**Supports:** Jest, Mocha, Vitest, pytest, unittest, and more!
**See:** `docs/IN-APP-RUNTIME-GUIDE.md` for the in-app guide
**See:** `docs/AUTOMATED-RUNTIME-ANALYSIS.md` for CLI automation

## Project Structure

```
intellimap/
├── packages/
│   ├── cli/          # CLI and indexers
│   ├── server/       # Express server
│   └── ui/           # React UI
├── .intellimap/      # Generated graphs
└── docs/             # Documentation
```

## Architecture

```
CLI → esbuild (JS/TS) + Python AST → Merge → graph.json → Express → React UI
```

## Graph Schema

The generated `graph.json` contains:

```json
{
  "nodes": [
    {
      "id": "src/index.ts",
      "lang": "ts",
      "env": "frontend",
      "pkg": "app",
      "folder": "src",
      "changed": false
    }
  ],
  "edges": [
    {
      "from": "src/index.ts",
      "to": "src/helper.ts",
      "kind": "import"
    }
  ],
  "metadata": {
    "repoRoot": "/path/to/repo",
    "generatedAt": "2025-10-23T12:00:00Z",
    "tool": "IntelliMap"
  }
}
```

**Node Properties:**
- `id` - File path relative to project root
- `lang` - Language: `ts`, `js`, or `py`
- `env` - Environment: `frontend` or `backend`
- `pkg` - Package name
- `folder` - Parent folder
- `changed` - Whether file was changed (from git diff)

**Edge Properties:**
- `from` - Source node ID
- `to` - Target node ID
- `kind` - Import type (always `import` for now)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build UI
npm run build

# Clean all outputs
npm run clean
```

## License

MIT


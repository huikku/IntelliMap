# 🗺️ IntelliMap

Local-only full-stack code architecture visualizer for JavaScript/TypeScript and Python projects.

## Features

- 📊 **Static Import Graph** - Visualize dependencies in your codebase
- 🔍 **Multi-language Support** - JS/TS (frontend + Node) and Python (backend)
- 🎨 **Interactive Visualization** - Cytoscape.js with ELK/fcose layouts
- 🔄 **Git Diff Overlay** - See what changed in your PR
- 🎯 **Multiplanar Views** - Static, Backend-only, and Diff planes
- ⚡ **Live Reload** - Auto-refresh on file changes
- 🏠 **Local-only** - No cloud, no auth, no tracking

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

```bash
# Index code and generate graph
npm run index [--entry src/index.ts] [--node-entry server/index.ts] [--py-root backend/] [--out .intellimap/graph.json]

# Compute diff between commits
npm run diff [base] [head]

# Start visualization server
npm run serve [--port 7676] [--watch]
```

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


# RAG Quick Start Guide

This guide will help you get started with the IntelliMap RAG system.

## Prerequisites

1. **API Keys**: You'll need at least one of these:
   ```bash
   export OPENAI_API_KEY="sk-..."
   export OPENROUTER_API_KEY="sk-or-..."  # Optional but recommended
   export ANTHROPIC_API_KEY="sk-ant-..."  # Optional
   export VOYAGE_API_KEY="pa-..."         # Optional for better embeddings
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Step-by-Step Tutorial

### 1. Index Your Repository

First, create a graph of your codebase:

```bash
# Index the current repository
npm run index

# Or index a specific repository
npm run cli -- index --entry src/index.js --out .intellimap/graph.json
```

### 2. Start the Server

```bash
npm run serve
```

The server will start on `http://localhost:7676`.

### 3. Create a Snapshot

Use curl or any HTTP client to create a snapshot:

```bash
curl -X POST http://localhost:7676/api/v1/snapshots
```

Response:
```json
{
  "success": true,
  "snapshot": {
    "id": 1,
    "manifest_hash": "abc123...",
    "project": "IntelliMap",
    "created_at": "2025-10-30T12:00:00Z",
    "meta": {
      "nodeCount": 150,
      "edgeCount": 200
    }
  }
}
```

### 4. Generate Embeddings

Embed all code chunks in the snapshot:

```bash
curl -X POST http://localhost:7676/api/v1/snapshots/1/embed \
  -H "Content-Type: application/json" \
  -d '{"type": "code"}'
```

This will take a few minutes depending on the size of your codebase. You'll see progress in the server logs.

### 5. Search for Code

Try a semantic search:

```bash
curl -X POST http://localhost:7676/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "graph visualization",
    "snapshot_id": 1,
    "topK": 5,
    "hybrid": true
  }'
```

Response:
```json
{
  "query": "graph visualization",
  "snapshot_id": 1,
  "results": [
    {
      "chunk_id": 42,
      "score": 0.89,
      "path": "packages/ui/src/components/GraphView.jsx",
      "start_line": 10,
      "end_line": 50,
      "text": "export default function GraphView({ graph, ... }) { ... }",
      "summary": "Main graph visualization component"
    }
  ]
}
```

### 6. Ask Questions

Now you can ask natural language questions about your codebase:

```bash
curl -X POST http://localhost:7676/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_id": 1,
    "question": "How does the graph visualization work?",
    "task": "explain"
  }'
```

Response:
```json
{
  "snapshot_id": 1,
  "question": "How does the graph visualization work?",
  "answer": "The graph visualization uses ReactFlow to render nodes and edges. The main component is GraphView.jsx:10-50, which receives the graph data and transforms it into ReactFlow format. The layout is computed using ELK in GraphView.jsx:100-150...",
  "citations": [
    { "path": "packages/ui/src/components/GraphView.jsx", "start_line": 10, "end_line": 50 },
    { "path": "packages/ui/src/components/GraphView.jsx", "start_line": 100, "end_line": 150 }
  ],
  "used_chunks": [...],
  "metadata": {
    "totalCandidates": 50,
    "rankedCount": 20,
    "packedCount": 8,
    "model": "gpt-4-turbo",
    "tokensIn": 1500,
    "tokensOut": 300,
    "cost": 0.045
  }
}
```

## Task Types

The RAG system supports different task types with optimized model routing:

### `explain` (Default)
Best for understanding how code works.

```bash
curl -X POST http://localhost:7676/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_id": 1,
    "question": "Explain how authentication works",
    "task": "explain"
  }'
```

### `impact`
Best for understanding the impact of changes.

```bash
curl -X POST http://localhost:7676/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_id": 1,
    "question": "What would break if I rename the User class?",
    "task": "impact"
  }'
```

### `triage`
Best for quick categorization and prioritization (uses fast, cheap models).

```bash
curl -X POST http://localhost:7676/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_id": 1,
    "question": "Which files handle user authentication?",
    "task": "triage"
  }'
```

### `transform`
Best for code transformation suggestions.

```bash
curl -X POST http://localhost:7676/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_id": 1,
    "question": "How can I refactor the authentication code to use async/await?",
    "task": "transform"
  }'
```

## Advanced Usage

### Pack Without Answering

If you just want to retrieve relevant chunks without generating an answer:

```bash
curl -X POST http://localhost:7676/api/v1/pack \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_id": 1,
    "question": "How does authentication work?",
    "worklist_bias": true
  }'
```

### Get Hotspots

Find the most complex/churned files:

```bash
curl http://localhost:7676/api/v1/hotspots?snapshot_id=1&limit=10
```

### Get Chunks for a File

```bash
curl "http://localhost:7676/api/v1/chunks?snapshot_id=1&path=src/auth/login.js"
```

## Tips

1. **First Run**: The first embedding run will be slow. Subsequent runs use cached embeddings.

2. **Cost Control**: Use `triage` task for quick/cheap queries, `explain` for detailed analysis.

3. **Worklist Bias**: Enable `worklist_bias: true` to prioritize files with known issues.

4. **Seed Paths**: Provide `seed_paths` in `/pack` or `/ask` to focus on specific directories.

5. **Model Selection**: The system automatically selects the best model for each task, but you can override with the `model` parameter.

## Troubleshooting

### "No embeddings found"
Make sure you ran the embed step: `POST /api/v1/snapshots/:id/embed`

### "API key not found"
Set the required environment variables before starting the server.

### "Too many tokens"
Reduce `maxChunks` in the pack policy:
```json
{
  "pack_policy": {
    "maxChunks": 5
  }
}
```

### "No results found"
Try:
- Using more general keywords
- Disabling hybrid search: `"hybrid": false`
- Checking if the snapshot was created correctly

## Next Steps

- Explore the full API documentation in `docs/RAG_IMPLEMENTATION.md`
- Set up incremental updates (Phase 6)
- Integrate with the ReactFlow UI (Phase 7)
- Create custom evaluation benchmarks (Phase 8)

## Example Workflow

Here's a complete workflow in a shell script:

```bash
#!/bin/bash

# 1. Index the repo
npm run index

# 2. Start server in background
npm run serve &
SERVER_PID=$!
sleep 3

# 3. Create snapshot
SNAPSHOT=$(curl -s -X POST http://localhost:7676/api/v1/snapshots | jq -r '.snapshot.id')
echo "Created snapshot: $SNAPSHOT"

# 4. Embed
curl -s -X POST http://localhost:7676/api/v1/snapshots/$SNAPSHOT/embed \
  -H "Content-Type: application/json" \
  -d '{"type": "code"}'

# 5. Ask questions
curl -s -X POST http://localhost:7676/api/v1/ask \
  -H "Content-Type: application/json" \
  -d "{
    \"snapshot_id\": $SNAPSHOT,
    \"question\": \"What are the main components of this codebase?\",
    \"task\": \"explain\"
  }" | jq '.answer'

# Cleanup
kill $SERVER_PID
```

Save this as `rag-demo.sh` and run with `bash rag-demo.sh`.


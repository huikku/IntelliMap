# IntelliMap RAG Implementation

This document describes the RAG (Retrieval-Augmented Generation) system implemented for IntelliMap, following the MOTH RAG plan.

## Overview

The RAG system enables natural language querying of code repositories with:
- **Hybrid retrieval**: Graph-based prefiltering + FTS + vector similarity
- **Multi-model routing**: OpenAI, OpenRouter, Anthropic with automatic fallbacks
- **Citation enforcement**: All answers must cite source code locations
- **Immutable snapshots**: Version-controlled code analysis
- **Cost optimization**: Smart model selection and token budgeting

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     IntelliMap RAG System                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Snapshot   │  │   Chunker    │  │  Embedding   │     │
│  │   Manager    │──│              │──│   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                                     │             │
│         ▼                                     ▼             │
│  ┌──────────────────────────────────────────────────┐      │
│  │            SQLite Database (rag.db)              │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ snapshots │ files │ chunks │ vectors │ metrics  │      │
│  └──────────────────────────────────────────────────┘      │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │          Retrieval Workflow                      │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ graph_prefilter → fts_filter → vector_rerank    │      │
│  │      → pack → answer (with citations)            │      │
│  └──────────────────────────────────────────────────┘      │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────┐      │
│  │            Model Router                          │      │
│  ├──────────────────────────────────────────────────┤      │
│  │ OpenAI │ OpenRouter │ Anthropic │ Fallbacks     │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Tables

- **snapshots**: Immutable project snapshots identified by manifest hash
- **files**: Source files with metadata (LOC, size, tags)
- **metrics**: Code quality metrics (complexity, fanin/fanout, churn, coverage)
- **deps**: Dependency relationships between files
- **symbols**: Functions, classes, variables with line spans
- **chunks**: Semantic code chunks (600-800 tokens) for RAG
- **vectors**: Embeddings for chunks (Float32Array stored as BLOB)
- **positions**: ReactFlow node positions (for UI integration)
- **worklist**: Issues and TODOs with severity levels

### Views

- **hotspots_by_snapshot**: Files ranked by fanout and churn

## API Endpoints

### Snapshot Management

#### `POST /api/v1/snapshots`
Create a snapshot from the current graph.

**Response:**
```json
{
  "success": true,
  "snapshot": {
    "id": 1,
    "manifest_hash": "abc123...",
    "project": "my-project",
    "created_at": "2025-10-30T12:00:00Z",
    "meta": { "nodeCount": 150, "edgeCount": 200 }
  }
}
```

#### `GET /api/v1/snapshots`
List all snapshots.

#### `GET /api/v1/snapshots/:id`
Get snapshot details with stats.

### Embedding

#### `POST /api/v1/snapshots/:id/embed`
Generate embeddings for all chunks in a snapshot.

**Request:**
```json
{
  "type": "code"  // or "docs"
}
```

**Response:**
```json
{
  "success": true,
  "snapshot_id": 1,
  "embedded_chunks": 250
}
```

### Search

#### `POST /api/v1/search`
Search for similar code chunks.

**Request:**
```json
{
  "query": "authentication logic",
  "snapshot_id": 1,
  "topK": 10,
  "type": "code",
  "hybrid": true
}
```

**Response:**
```json
{
  "query": "authentication logic",
  "snapshot_id": 1,
  "results": [
    {
      "chunk_id": 42,
      "score": 0.89,
      "path": "src/auth/login.js",
      "start_line": 10,
      "end_line": 35,
      "text": "function authenticate(user, password) { ... }",
      "summary": "User authentication function"
    }
  ]
}
```

### RAG Queries

#### `POST /api/v1/pack`
Retrieve and pack relevant chunks without generating an answer.

**Request:**
```json
{
  "snapshot_id": 1,
  "question": "How does authentication work?",
  "seed_paths": ["src/auth"],
  "worklist_bias": true
}
```

**Response:**
```json
{
  "snapshot_id": 1,
  "question": "How does authentication work?",
  "chunks": [...],
  "citations": [
    { "path": "src/auth/login.js", "start_line": 10, "end_line": 35 }
  ]
}
```

#### `POST /api/v1/ask`
Full RAG pipeline: retrieve, pack, and generate answer.

**Request:**
```json
{
  "snapshot_id": 1,
  "question": "How does authentication work?",
  "task": "explain",
  "pack_policy": {
    "maxChunks": 8,
    "worklistBias": true
  }
}
```

**Response:**
```json
{
  "snapshot_id": 1,
  "question": "How does authentication work?",
  "answer": "The authentication system uses JWT tokens...",
  "citations": [
    { "path": "src/auth/login.js", "start_line": 10, "end_line": 35 }
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

## Retrieval Workflow

The retrieval pipeline follows these steps:

1. **Seed Extraction**: Extract path hints, symbols, and keywords from the question
2. **Graph Prefilter**: Filter chunks by graph structure (paths, symbols, dependencies)
3. **FTS Filter**: Full-text search to narrow candidates
4. **Vector Rerank**: Semantic similarity ranking using embeddings
5. **Pack**: Select top chunks within token budget (max 8 chunks, 600-800 tokens each)
6. **Answer**: Generate answer with LLM and enforce citations

## Model Routing

The system routes requests to different models based on task type:

| Task      | Primary Model                    | Fallbacks                                    |
|-----------|----------------------------------|----------------------------------------------|
| explain   | OpenAI GPT-4 Turbo               | Claude Sonnet 4, Gemini 2.0 Flash            |
| impact    | OpenAI GPT-4 Turbo               | Mistral Large 2                              |
| triage    | Gemini 2.0 Flash (via OpenRouter)| GPT-4o Mini                                  |
| transform | DeepSeek Chat (via OpenRouter)   | DeepSeek V3                                  |

## Environment Variables

```bash
# Required for embeddings
OPENAI_API_KEY=sk-...

# Optional: Better embeddings
VOYAGE_API_KEY=pa-...

# Optional: Alternative embeddings
COHERE_API_KEY=...

# Required for model routing
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Usage Example

```javascript
// 1. Create a snapshot
const snapshot = await fetch('/api/v1/snapshots', { method: 'POST' });

// 2. Embed the snapshot
await fetch(`/api/v1/snapshots/${snapshot.id}/embed`, {
  method: 'POST',
  body: JSON.stringify({ type: 'code' })
});

// 3. Ask a question
const result = await fetch('/api/v1/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    snapshot_id: snapshot.id,
    question: 'How does the authentication system work?',
    task: 'explain'
  })
});

console.log(result.answer);
console.log(result.citations);
```

## Testing

Run the database tests:

```bash
npm test -- packages/server/rag/database.test.js
```

## Next Steps

- [ ] Implement incremental updates (Phase 6)
- [ ] Add ReactFlow integration (Phase 7)
- [ ] Create evaluation benchmark (Phase 8)
- [ ] Add authentication and rate limiting
- [ ] Implement FAISS/Qdrant upgrade path for large repos
- [ ] Add git hooks for automatic snapshot creation

## References

- MOTH RAG Plan: `docs/moth_rag_plan_model_options_open_ai_open_router.moth`
- Database Schema: `packages/server/rag/database.js`
- Retrieval Workflow: `packages/server/rag/retrieval-workflow.js`
- Model Router: `packages/server/rag/model-router.js`


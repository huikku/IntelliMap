# Runtime Analysis Guide

IntelliMap now supports **runtime analysis** to enrich static dependency graphs with actual execution data from your tests or production runs.

## Overview

Runtime analysis merges:
- **Static graph** (from AST parsing) - what *could* execute
- **Runtime trace** (from test coverage) - what *actually* executed

This reveals:
- 🎯 **Coverage gaps** - code that exists but never runs
- ⚡ **Performance hotspots** - slow modules and edges
- 🔗 **Dynamic dependencies** - runtime-only imports (reflection, lazy loading)
- 💀 **Dead code** - static imports never executed

---

## Quick Start

### 1. Generate a Sample Trace (for testing)

```bash
npm run generate-trace
```

This creates a sample runtime trace in `.intellimap/runtime/trace-{timestamp}.json` based on your static graph.

### 2. View Runtime Analysis

1. Start the server: `npm run serve`
2. Open http://localhost:7676
3. Click **📊 Analysis** tab in the left sidebar
4. Click **⚡ Runtime Analysis** button
5. View the report!

---

## Runtime Trace Format

Runtime traces are JSON files with this structure:

```json
{
  "metadata": {
    "timestamp": 1234567890,
    "branch": "main",
    "commit": "abc123",
    "runId": "test-run-1",
    "environment": "test"
  },
  "edges": [
    {
      "from": "src/app.js",
      "to": "src/utils.js",
      "count": 42,
      "totalTime": 125.5,
      "avgTime": 2.99
    }
  ],
  "nodes": [
    {
      "id": "src/app.js",
      "executionCount": 100,
      "totalTime": 500.0,
      "coverage": 85.5
    }
  ]
}
```

### Fields

**Metadata:**
- `timestamp` - Unix timestamp of the run
- `branch` - Git branch name
- `commit` - Git commit hash
- `runId` - Unique identifier for this run
- `environment` - "test", "staging", "production", etc.

**Edges:**
- `from` / `to` - File paths (must match static graph)
- `count` - Number of times this edge was traversed
- `totalTime` - Total time spent (milliseconds)
- `avgTime` - Average time per traversal

**Nodes:**
- `id` - File path (must match static graph)
- `executionCount` - Number of times this file was executed
- `totalTime` - Total time spent in this file
- `coverage` - Line coverage percentage (0-100)

---

## Generating Real Traces

### JavaScript/TypeScript

#### Option 1: NYC (Istanbul)

```bash
# Install
npm install --save-dev nyc

# Run tests with coverage
nyc --reporter=json npm test

# Convert coverage to IntelliMap trace format
node scripts/convert-nyc-to-trace.js
```

#### Option 2: V8 Coverage API

```javascript
const v8 = require('v8');
const { writeFileSync } = require('fs');

// Start coverage
v8.startCoverage();

// Run your code
require('./src/app.js');

// Stop and collect
const coverage = v8.stopCoverage();

// Convert to IntelliMap format
const trace = convertV8ToTrace(coverage);
writeFileSync('.intellimap/runtime/trace.json', JSON.stringify(trace, null, 2));
```

#### Option 3: Manual Instrumentation

```javascript
const trace = { edges: [], nodes: [] };

function recordEdge(from, to, time) {
  trace.edges.push({ from, to, count: 1, totalTime: time, avgTime: time });
}

// Instrument your imports
const originalRequire = require;
require = function(path) {
  const start = performance.now();
  const result = originalRequire(path);
  const time = performance.now() - start;
  recordEdge(module.filename, path, time);
  return result;
};
```

### Python

#### Using coverage.py

```bash
# Install
pip install coverage

# Run tests with coverage
coverage run -m pytest

# Generate JSON report
coverage json -o coverage.json

# Convert to IntelliMap format
python scripts/convert_coverage_to_trace.py
```

#### Using sys.settrace

```python
import sys
import json
import time

trace_data = {"edges": [], "nodes": []}
call_stack = []
timings = {}

def trace_calls(frame, event, arg):
    if event == 'call':
        filename = frame.f_code.co_filename
        start_time = time.time()
        
        if call_stack:
            caller = call_stack[-1]
            trace_data["edges"].append({
                "from": caller,
                "to": filename,
                "count": 1,
                "totalTime": 0,  # Will be updated
                "avgTime": 0
            })
        
        call_stack.append(filename)
        timings[filename] = start_time
        
    elif event == 'return':
        if call_stack:
            filename = call_stack.pop()
            elapsed = (time.time() - timings[filename]) * 1000
            
            trace_data["nodes"].append({
                "id": filename,
                "executionCount": 1,
                "totalTime": elapsed,
                "coverage": 100  # Simplified
            })
    
    return trace_calls

sys.settrace(trace_calls)

# Run your code
import my_app

sys.settrace(None)

# Save trace
with open('.intellimap/runtime/trace.json', 'w') as f:
    json.dump(trace_data, f, indent=2)
```

---

## API Endpoints

### Upload Runtime Trace

```bash
POST /api/runtime-trace
Content-Type: application/json

{
  "metadata": { ... },
  "trace": {
    "edges": [...],
    "nodes": [...]
  }
}
```

### Get Runtime Analysis

```bash
GET /api/runtime-analysis

Response:
{
  "graph": { ... },  // Merged graph with runtime annotations
  "runtime": {
    "metrics": {
      "edgeCoveragePercent": 75.5,
      "nodeCoveragePercent": 82.3,
      "deadEdges": 12,
      "deadNodes": 8,
      "runtimeOnlyEdges": 3
    }
  },
  "report": "# Runtime Analysis Report\n..."
}
```

### List Available Traces

```bash
GET /api/runtime-traces

Response:
{
  "traces": [
    {
      "file": "trace-1234567890.json",
      "timestamp": 1234567890,
      "branch": "main",
      "commit": "abc123"
    }
  ]
}
```

---

## Reports Generated

### 1. Runtime Coverage Report

Shows:
- Edge coverage % (executed vs static)
- Node coverage % (executed vs static)
- Dead edges and nodes
- Runtime-only edges (dynamic imports)

### 2. Performance Hotspots

Shows:
- Top 10 slowest modules
- Total time, execution count, average time
- Performance concentration (% of time in top 10)

### 3. Dead Code Analysis

Shows:
- Unexecuted modules grouped by directory
- Dead code ratio
- Recommendations for cleanup

---

## Best Practices

1. **Run traces regularly** - Capture traces from CI/CD pipelines
2. **Compare across branches** - Detect regressions in coverage
3. **Focus on hot paths** - Optimize modules with high total time
4. **Remove dead code** - Use dead code reports to guide refactoring
5. **Track dynamic imports** - Review runtime-only edges for unexpected behavior

---

## Future Enhancements

See `docs/Run-Based-Derived-Reports-Plan.md` for planned features:
- Cross-run drift analysis
- Git churn correlation
- Test effectiveness scoring
- Behavioral stability index
- Timeline animation of execution
- Graph overlays (color by coverage, size by performance)


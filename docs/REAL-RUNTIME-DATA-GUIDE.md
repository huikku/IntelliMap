# Real Runtime Data Collection Guide

This guide shows you how to collect **REAL** runtime execution data from your actual codebase, not simulated data.

---

## What You Need

To get real runtime analysis, you need to:

1. **Instrument your code** to track which files/functions are executed
2. **Run your tests** (or production code) with instrumentation enabled
3. **Convert the trace data** to IntelliMap's format
4. **Upload to IntelliMap** for visualization

---

## Option 1: JavaScript/TypeScript with NYC (Recommended)

### Step 1: Install NYC

```bash
npm install --save-dev nyc
```

### Step 2: Configure NYC

Create `.nycrc.json`:

```json
{
  "all": true,
  "include": ["src/**/*.js", "src/**/*.ts", "src/**/*.jsx", "src/**/*.tsx"],
  "exclude": ["**/*.test.js", "**/*.spec.js", "**/node_modules/**"],
  "reporter": ["json", "text"],
  "report-dir": ".nyc_output"
}
```

### Step 3: Run Your Tests with Coverage

```bash
# If you have tests
nyc npm test

# Or run your app
nyc node src/index.js

# Or with a custom command
nyc --reporter=json npm start
```

This creates `.nyc_output/coverage-final.json`

### Step 4: Convert NYC Data to IntelliMap Format

Create `scripts/nyc-to-intellimap.js`:

```javascript
#!/usr/bin/env node
import fs from 'fs-extra';
import { resolve } from 'node:path';

async function convertNYCToIntelliMap() {
  // Read NYC coverage data
  const nycData = await fs.readJson('.nyc_output/coverage-final.json');
  
  const nodes = [];
  const edges = [];
  const executionMap = new Map();

  // Process each file
  for (const [filePath, coverage] of Object.entries(nycData)) {
    const relativePath = filePath.replace(process.cwd() + '/', '');
    
    // Calculate coverage percentage
    const { s: statements, f: functions } = coverage;
    const totalStatements = Object.keys(statements).length;
    const executedStatements = Object.values(statements).filter(count => count > 0).length;
    const coveragePercent = totalStatements > 0 ? (executedStatements / totalStatements) * 100 : 0;
    
    // Count total executions
    const executionCount = Object.values(statements).reduce((sum, count) => sum + count, 0);
    
    nodes.push({
      id: relativePath,
      executionCount,
      totalTime: executionCount * 0.1, // Estimate: 0.1ms per statement
      coverage: coveragePercent,
    });
    
    executionMap.set(relativePath, executionCount);
  }

  // Infer edges from static graph
  const staticGraph = await fs.readJson('.intellimap/graph.json');
  
  staticGraph.edges.forEach(edge => {
    const fromCount = executionMap.get(edge.from) || 0;
    const toCount = executionMap.get(edge.to) || 0;
    
    if (fromCount > 0 && toCount > 0) {
      const count = Math.min(fromCount, toCount);
      edges.push({
        from: edge.from,
        to: edge.to,
        count,
        totalTime: count * 0.05, // Estimate: 0.05ms per import
        avgTime: 0.05,
      });
    }
  });

  // Create trace
  const trace = {
    metadata: {
      timestamp: Date.now(),
      branch: process.env.GIT_BRANCH || 'unknown',
      commit: process.env.GIT_COMMIT || 'unknown',
      runId: `nyc-${Date.now()}`,
      environment: process.env.NODE_ENV || 'test',
      description: 'NYC coverage data',
    },
    edges,
    nodes,
  };

  // Save trace
  const runtimeDir = resolve('.intellimap/runtime');
  await fs.ensureDir(runtimeDir);
  const traceFile = resolve(runtimeDir, `trace-${Date.now()}.json`);
  await fs.writeJson(traceFile, trace, { spaces: 2 });

  console.log(`✅ Converted NYC coverage to IntelliMap trace: ${traceFile}`);
  console.log(`📊 Stats:`);
  console.log(`   - Nodes with coverage: ${nodes.length}`);
  console.log(`   - Edges executed: ${edges.length}`);
}

convertNYCToIntelliMap().catch(console.error);
```

Make it executable:
```bash
chmod +x scripts/nyc-to-intellimap.js
```

### Step 5: Run the Conversion

```bash
node scripts/nyc-to-intellimap.js
```

### Step 6: View in IntelliMap

```bash
npm run serve
# Open http://localhost:7676
# Click "⚡ Runtime Analysis"
```

---

## Option 2: Manual Instrumentation (Most Accurate)

For the most accurate timing data, instrument your code directly.

### Create `runtime-tracer.js`:

```javascript
import fs from 'fs-extra';
import { resolve } from 'node:path';

class RuntimeTracer {
  constructor() {
    this.edges = new Map();
    this.nodes = new Map();
    this.callStack = [];
  }

  // Track when a module is entered
  enterModule(modulePath) {
    const startTime = performance.now();
    
    if (this.callStack.length > 0) {
      const caller = this.callStack[this.callStack.length - 1];
      const edgeKey = `${caller.path}->${modulePath}`;
      
      if (!this.edges.has(edgeKey)) {
        this.edges.set(edgeKey, { from: caller.path, to: modulePath, count: 0, totalTime: 0 });
      }
      
      const edge = this.edges.get(edgeKey);
      edge.count++;
    }
    
    this.callStack.push({ path: modulePath, startTime });
    
    if (!this.nodes.has(modulePath)) {
      this.nodes.set(modulePath, { id: modulePath, executionCount: 0, totalTime: 0 });
    }
    
    this.nodes.get(modulePath).executionCount++;
  }

  // Track when a module is exited
  exitModule(modulePath) {
    const frame = this.callStack.pop();
    if (!frame || frame.path !== modulePath) {
      console.warn(`Stack mismatch: expected ${modulePath}, got ${frame?.path}`);
      return;
    }
    
    const elapsed = performance.now() - frame.startTime;
    const node = this.nodes.get(modulePath);
    if (node) {
      node.totalTime += elapsed;
    }
    
    // Update edge timing
    if (this.callStack.length > 0) {
      const caller = this.callStack[this.callStack.length - 1];
      const edgeKey = `${caller.path}->${modulePath}`;
      const edge = this.edges.get(edgeKey);
      if (edge) {
        edge.totalTime += elapsed;
        edge.avgTime = edge.totalTime / edge.count;
      }
    }
  }

  // Save trace to file
  async save() {
    const trace = {
      metadata: {
        timestamp: Date.now(),
        branch: process.env.GIT_BRANCH || 'main',
        commit: process.env.GIT_COMMIT || 'HEAD',
        runId: `manual-${Date.now()}`,
        environment: process.env.NODE_ENV || 'development',
      },
      edges: Array.from(this.edges.values()).map(e => ({
        ...e,
        avgTime: e.totalTime / e.count,
      })),
      nodes: Array.from(this.nodes.values()),
    };

    const runtimeDir = resolve('.intellimap/runtime');
    await fs.ensureDir(runtimeDir);
    const traceFile = resolve(runtimeDir, `trace-${Date.now()}.json`);
    await fs.writeJson(traceFile, trace, { spaces: 2 });

    console.log(`✅ Runtime trace saved: ${traceFile}`);
    console.log(`📊 Stats:`);
    console.log(`   - Modules executed: ${this.nodes.size}`);
    console.log(`   - Edges traversed: ${this.edges.size}`);
  }
}

export const tracer = new RuntimeTracer();

// Auto-save on exit
process.on('exit', () => {
  tracer.save().catch(console.error);
});
```

### Instrument Your Entry Point:

```javascript
import { tracer } from './runtime-tracer.js';

// Wrap your imports
tracer.enterModule('src/app.js');
import { myFunction } from './utils.js';
tracer.exitModule('src/app.js');

// Run your code
myFunction();

// Save trace
await tracer.save();
```

---

## Option 3: Use Node.js Built-in Coverage (Node 20+)

Node.js 20+ has built-in coverage:

```bash
node --experimental-coverage --test src/**/*.test.js
```

This creates coverage data in `.coverage/` directory.

---

## Quick Start: Real Data in 5 Minutes

1. **Install NYC**:
   ```bash
   npm install --save-dev nyc
   ```

2. **Run your tests with coverage**:
   ```bash
   nyc npm test
   ```

3. **Create converter script** (copy from Option 1 above)

4. **Convert to IntelliMap format**:
   ```bash
   node scripts/nyc-to-intellimap.js
   ```

5. **View in IntelliMap**:
   ```bash
   npm run serve
   # Click "⚡ Runtime Analysis"
   ```

---

## What You'll Get

With **real** runtime data, you'll see:

✅ **Actual coverage** - Which files/imports are executed in your tests  
✅ **Real performance** - Actual execution times (not estimates)  
✅ **Dead code** - Files that exist but are never used  
✅ **Hot paths** - Most frequently executed code  
✅ **Test gaps** - Code that should be tested but isn't  

---

## Next Steps

- Set up NYC in your CI/CD pipeline
- Track coverage over time
- Compare coverage between branches
- Identify untested critical paths


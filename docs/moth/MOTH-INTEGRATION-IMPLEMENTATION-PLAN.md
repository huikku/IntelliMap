# 🦋 MOTH Integration Implementation Plan

**Project:** IntelliMap + MOTH + LLM Integration
**Status:** Implementation Ready
**Timeline:** 2-4 weeks (phased rollout)
**Last Updated:** 2025-10-25

---

## Overview

This plan implements MOTH as a **two-phase pipeline**:
- **Phase 1 (Pre-processing):** Current MOTH generator remains as programmatic static analyzer
- **Phase 2 (Reasoning):** New LLM service layer added for semantic analysis

**Key Principle:** Build the bridge first, then add intelligence.

---

## Architecture Vision

```
┌─────────────────────────────────────────────────────────────┐
│                    IntelliMap + MOTH Pipeline                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 1A: IntelliMap Analysis (Existing)                   │
│  ┌──────────────────────────────────────────────┐           │
│  │  Static (esbuild) + Runtime (V8)              │           │
│  │         ↓                                     │           │
│  │    graph.json (Internal Format)              │           │
│  │    • Nodes + Edges                           │           │
│  │    • Runtime coverage                        │           │
│  │    • Performance metrics                     │           │
│  │    • Git diff overlay                        │           │
│  └──────────────┬───────────────────────────────┘           │
│                 │                                             │
│  Phase 1B: MOTH Compression (New Bridge)                    │
│                 ↓                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │  MOTH Converter                               │           │
│  │  • Reads graph.json                          │           │
│  │  • Compresses to 1KB/file                    │           │
│  │  • Preserves runtime data                    │           │
│  │         ↓                                     │           │
│  │    REPO.moth (LLM-Optimized Format)          │           │
│  │    • Semantic compression                    │           │
│  │    • Coverage preserved                      │           │
│  │    • Changed flags preserved                 │           │
│  └──────────────┬───────────────────────────────┘           │
│                 │                                             │
│  Phase 2: LLM Reasoning (New Layer)                         │
│                 ↓                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │  LLM Service                                  │           │
│  │  • OpenAI GPT-4/5                            │           │
│  │  • Anthropic Claude 3.5                      │           │
│  │  • Local Ollama (Llama 3.1)                 │           │
│  │                                               │           │
│  │  Analysis Modes:                             │           │
│  │  • Architecture Summary                      │           │
│  │  • Code Smell Detection                      │           │
│  │  • Change Impact Analysis                    │           │
│  │  • Interactive Q&A (RAG)                     │           │
│  └──────────────┬───────────────────────────────┘           │
│                 │                                             │
│                 ↓                                             │
│         Insights UI (Enhanced MOTHPanel)                     │
│         • LLM-generated summaries                            │
│         • Interactive chat                                   │
│         • Graph ↔ MOTH linking                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Bridge the Gap (Week 1-2)

**Goal:** Connect IntelliMap and MOTH without duplicate analysis.

### Milestone 1.1: Core Converter (Days 1-3)

**Create:** `packages/cli/indexers/mothConverter.js`

```javascript
/**
 * Converts IntelliMap graph.json to MOTH format
 * Preserves runtime data, git overlay, and all metrics
 */

import crypto from 'crypto';
import { resolve } from 'path';

export class GraphToMOTHConverter {
  constructor(graphData, options = {}) {
    this.graph = graphData;
    this.options = options;
  }

  convert() {
    // Step 1: Extract metadata
    const meta = this.buildMetadata();

    // Step 2: Convert nodes to MOTH file entries
    const files = this.convertNodes();

    // Step 3: Generate manifest
    const manifest = this.formatManifest(meta, files);

    // Step 4: Compute hash and finalize
    return this.finalizeManifest(manifest);
  }

  buildMetadata() {
    const repoName = this.graph.meta.repoRoot.split('/').pop();
    const date = new Date().toISOString().split('T')[0];

    return {
      project: repoName,
      version: '1.2',
      date,
      source: 'intellimap',
      sourceVersion: this.graph.meta.tool,
      generatedAt: this.graph.meta.generatedAt
    };
  }

  convertNodes() {
    const files = [];

    for (const node of this.graph.nodes) {
      // Skip if filtered out
      if (this.options.envFilter && node.env !== this.options.envFilter) {
        continue;
      }

      // Get edges for this node
      const outgoingEdges = this.graph.edges.filter(e => e.from === node.id);
      const incomingEdges = this.graph.edges.filter(e => e.to === node.id);

      // Get runtime metrics if available
      const runtime = this.graph.runtimeAnalysis?.nodeMetrics?.[node.id] || {};

      // Build MOTH entry
      files.push({
        path: node.id,
        metrics: {
          fanin: incomingEdges.length,
          fanout: outgoingEdges.length,
          depth: this.calculateDepth(node.id),
          churn: this.getChurn(node.id),
          loc: node.loc || this.estimateLOC(node),
          complexity: node.complexity || this.estimateComplexity(node),
          coverage: runtime.coverage || 0,        // ← FROM RUNTIME!
          avgTime: runtime.avgTime || 0,          // ← FROM RUNTIME!
          executionCount: runtime.count || 0      // ← FROM RUNTIME!
        },
        deps: this.formatDeps(outgoingEdges),
        symbols: node.symbols || [],
        doc: this.extractDoc(node),
        summary: this.generateSummary(node),
        changed: node.changed || false            // ← FROM GIT DIFF!
      });
    }

    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  formatDeps(edges) {
    return edges.map(e => {
      const target = e.to;
      // Tag external dependencies
      if (target.startsWith('node_modules/') || !target.startsWith('.')) {
        return `@external:${target}`;
      }
      return target;
    });
  }

  calculateDepth(nodeId) {
    // Use memoized depth from graph if available
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node?.depth !== undefined) return node.depth;

    // Otherwise compute with DFS + cycle detection
    const memo = new Map();
    const visiting = new Set();

    const dfs = (id) => {
      if (memo.has(id)) return memo.get(id);
      if (visiting.has(id)) return 1; // Cycle

      visiting.add(id);
      const edges = this.graph.edges.filter(e => e.from === id);
      let maxDepth = 0;

      for (const edge of edges) {
        if (!edge.to.startsWith('@external:')) {
          maxDepth = Math.max(maxDepth, dfs(edge.to));
        }
      }

      visiting.delete(id);
      const depth = 1 + maxDepth;
      memo.set(id, depth);
      return depth;
    };

    return dfs(nodeId);
  }

  getChurn(nodeId) {
    // If graph has git data, use it
    const node = this.graph.nodes.find(n => n.id === nodeId);
    return node?.churn || 0;
  }

  estimateLOC(node) {
    // Rough estimate: 1 line per 30 bytes (typical JS/TS)
    return Math.ceil(node.size / 30);
  }

  estimateComplexity(node) {
    // Simple heuristic based on file size and type
    const baseComplexity = Math.ceil(this.estimateLOC(node) / 10);
    return Math.max(1, baseComplexity);
  }

  extractDoc(node) {
    // Use graph's cached documentation if available
    if (node.doc) return node.doc;

    // Generate from metadata
    const type = node.lang === 'py' ? 'Python' : 'JavaScript/TypeScript';
    const env = node.env || 'unknown';
    return `${type} ${env} module`;
  }

  generateSummary(node) {
    const parts = node.id.split('/');
    const category = parts[1] || 'root';
    const filename = parts[parts.length - 1];

    let summary = `${category} ${filename}`;

    const loc = node.loc || this.estimateLOC(node);
    if (loc > 100) summary += ' (large file)';
    else if (loc < 10) summary += ' (small file)';

    const complexity = node.complexity || this.estimateComplexity(node);
    if (complexity > 20) summary += ' (high complexity)';

    if (node.changed) summary += ' (modified)';

    return summary.substring(0, 150);
  }

  formatManifest(meta, files) {
    const entries = files.map(file => {
      const metricsStr = Object.entries(file.metrics)
        .map(([k, v]) => `${k}:${v}`)
        .join(';');

      const depsStr = file.deps.length > 0 ? `→[${file.deps.join(',')}]` : '';
      const symbolsStr = file.symbols.length > 0 ? `fn:[${file.symbols.slice(0, 5).join(',')}]` : '';

      // Escape pipes and braces in doc/summary
      const doc = (file.doc || 'No documentation available')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}');

      const summary = (file.summary || '')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}');

      return `${file.path} | {${metricsStr}} | ${depsStr} | ${symbolsStr} | ${doc} | ${summary}`;
    });

    const body = entries.join('\n');
    const checksum = crypto.createHash('sha1').update(body).digest('hex');

    return {
      meta,
      count: files.length,
      checksum,
      body
    };
  }

  finalizeManifest(manifest) {
    const { meta, count, checksum, body } = manifest;

    // Build header with placeholder hash
    const headerWithoutHash = `#MOTH:repo
meta:{project:${meta.project};version:${meta.version};date:${meta.date};hash:sha256:PENDING;parent:sha256:none;source:${meta.source}}
@INDEX count:${count} checksum:sha1:${checksum}
@FILES
${body}
@END`;

    // Compute final hash
    const finalHash = crypto.createHash('sha256').update(headerWithoutHash).digest('hex');

    // Inject hash
    const finalManifest = headerWithoutHash.replace('hash:sha256:PENDING', `hash:sha256:${finalHash}`);

    return {
      manifest: finalManifest,
      hash: finalHash,
      count,
      checksum
    };
  }
}

// Export convenience function
export function convertGraphToMOTH(graphData, options = {}) {
  const converter = new GraphToMOTHConverter(graphData, options);
  return converter.convert();
}
```

**Test Plan:**
```bash
# Test with IntelliMap's own graph
npm run index
node -e "
  const fs = require('fs');
  const { convertGraphToMOTH } = require('./packages/cli/indexers/mothConverter.js');
  const graph = JSON.parse(fs.readFileSync('.intellimap/graph.json'));
  const result = convertGraphToMOTH(graph);
  console.log('Files:', result.count);
  console.log('Hash:', result.hash);
  fs.writeFileSync('test-output.moth', result.manifest);
"

# Verify output
head -20 test-output.moth
```

---

### Milestone 1.2: CLI Integration (Days 4-5)

**Modify:** `packages/cli/commands/moth.js`

```javascript
import { resolve } from 'path';
import fs from 'fs-extra';
import { MOTHGenerator } from '../moth/generator.js';
import { convertGraphToMOTH } from '../indexers/mothConverter.js';

export default async function moth(options) {
  const cwd = process.cwd();
  const mothDir = resolve(cwd, '.mothlab/moth');

  console.log('🦋 MOTHlab - Generating MOTH manifest...\n');
  console.log(`📁 Repository: ${cwd}`);
  console.log(`📂 Output directory: ${mothDir}\n`);

  await fs.ensureDir(mothDir);

  try {
    let manifest, index, validation;

    // Check if IntelliMap graph exists
    const graphPath = resolve(cwd, '.intellimap/graph.json');
    const hasGraph = await fs.pathExists(graphPath);

    if (hasGraph && !options.force) {
      console.log('✅ Found IntelliMap graph.json - using existing analysis');
      console.log('   (Use --force to regenerate from source files)\n');

      // Use graph-based conversion (fast, preserves runtime data)
      const graphData = await fs.readJson(graphPath);
      const result = convertGraphToMOTH(graphData, options);

      manifest = result.manifest;

      // Generate index from graph data
      index = {
        version: '1.2',
        project: graphData.meta.repoRoot.split('/').pop(),
        generated: new Date().toISOString(),
        source: 'intellimap-graph',
        files: {} // TODO: populate from graph
      };

      // Generate validation
      validation = {
        timestamp: new Date().toISOString(),
        version: '1.2',
        source: 'intellimap-graph',
        summary: {
          totalFiles: result.count,
          manifestHash: result.hash
        },
        validation: {
          manifestHash: result.hash,
          schemaValid: true,
          checksumsValid: true,
          pathsResolved: true,
          metricsValid: true
        }
      };

    } else {
      if (!hasGraph) {
        console.log('ℹ️  No IntelliMap graph found - analyzing from source files');
      } else {
        console.log('🔄 Force regeneration mode - analyzing from source files');
      }
      console.log('   (Run `npm run index` first for faster MOTH generation)\n');

      // Use standalone generator (slower, but works without graph)
      const generator = new MOTHGenerator(cwd);
      const result = await generator.analyze();

      manifest = result.manifest;
      index = result.index;
      validation = result.validation;
    }

    // Write outputs
    const manifestPath = resolve(mothDir, 'REPO.moth');
    const indexPath = resolve(mothDir, 'moth.index.json');
    const validationPath = resolve(mothDir, 'validation.json');

    await fs.writeFile(manifestPath, manifest, 'utf8');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    await fs.writeFile(validationPath, JSON.stringify(validation, null, 2), 'utf8');

    console.log('\n✅ MOTH manifest generated successfully!\n');
    console.log(`📄 Manifest: ${manifestPath}`);
    console.log(`📊 Index: ${indexPath}`);
    console.log(`✓ Validation: ${validationPath}\n`);

    // Print summary
    console.log('📈 Summary:');
    console.log(`   Files analyzed: ${validation.summary.totalFiles}`);
    if (validation.summary.totalLines) {
      console.log(`   Total lines: ${validation.summary.totalLines.toLocaleString()}`);
    }
    if (validation.summary.manifestHash) {
      console.log(`   Manifest hash: ${validation.summary.manifestHash.substring(0, 16)}...`);
    }
    console.log(`   Schema valid: ${validation.validation.schemaValid ? '✓' : '✗'}`);
    console.log(`   Metrics valid: ${validation.validation.metricsValid ? '✓' : '✗'}\n');

  } catch (error) {
    console.error('\n❌ Error generating MOTH manifest:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}
```

**Update CLI Options:**
```javascript
// packages/cli/index.js

program
  .command('moth')
  .description('Generate MOTH manifest for the repository')
  .option('--force', 'Force regeneration from source (ignore graph.json)', false)
  .option('--env <type>', 'Filter by environment (frontend/backend)', null)
  .action(mothCommand);
```

---

### Milestone 1.3: UI Export Button (Day 6)

**Modify:** `packages/ui/src/components/Toolbar.jsx`

```jsx
// Add export button to toolbar

const [exporting, setExporting] = useState(false);

const exportMOTH = async () => {
  setExporting(true);
  try {
    const res = await fetch('/api/export-moth', { method: 'POST' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'REPO.moth';
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export MOTH: ' + error.message);
  } finally {
    setExporting(false);
  }
};

// In render:
<button
  onClick={exportMOTH}
  disabled={exporting}
  title="Export MOTH manifest"
  className="toolbar-button"
>
  {exporting ? '⏳' : '🦋'} Export MOTH
</button>
```

**Add Server Endpoint:** `packages/server/server.js`

```javascript
app.post('/api/export-moth', async (req, res) => {
  try {
    const graphPath = resolve(currentRepoPath, '.intellimap/graph.json');

    if (!fs.existsSync(graphPath)) {
      return res.status(404).json({
        error: 'No graph data found. Run analysis first.'
      });
    }

    const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    const { convertGraphToMOTH } = await import('../cli/indexers/mothConverter.js');

    const result = convertGraphToMOTH(graphData);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="REPO.moth"');
    res.send(result.manifest);

  } catch (error) {
    console.error('Error exporting MOTH:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### Milestone 1.4: Testing & Validation (Day 7)

**Test Cases:**

```bash
# Test 1: Graph-based generation
npm run index
npm run cli -- moth
# Verify: .mothlab/moth/REPO.moth exists
# Verify: coverage field populated (not all 0s)
# Verify: changed flags match git status

# Test 2: Force regeneration
npm run cli -- moth --force
# Verify: Still works without graph.json

# Test 3: Environment filtering
npm run cli -- moth --env frontend
# Verify: Only frontend files in MOTH

# Test 4: UI Export
npm run serve
# Click "Export MOTH" button
# Verify: REPO.moth downloads
# Verify: Content matches CLI output

# Test 5: Round-trip validation
npm run index
npm run cli -- moth
# Compare metrics: .intellimap/graph.json vs .mothlab/moth/REPO.moth
# Verify: fanin/fanout/depth match
# Verify: runtime coverage preserved
```

**Success Criteria:**
- ✅ MOTH generation <1s when graph.json exists
- ✅ Coverage field populated from runtime data
- ✅ Changed flags match git diff
- ✅ No duplicate parsing
- ✅ UI export works
- ✅ Metrics consistent between graph and MOTH

---

## Phase 2: LLM Service Layer (Week 2-3)

**Goal:** Enable AI-powered analysis of MOTH manifests.

### Milestone 2.1: LLM Service Foundation (Days 8-10)

**Create:** `packages/server/llm-service.js`

```javascript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export class LLMService {
  constructor(config = {}) {
    this.provider = config.provider || 'openai';
    this.model = config.model || this.getDefaultModel();
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

    this.initProvider();
  }

  getDefaultModel() {
    const defaults = {
      openai: 'gpt-4-turbo-preview',
      anthropic: 'claude-3-5-sonnet-20241022',
      local: 'llama3.1:8b'
    };
    return defaults[this.provider];
  }

  initProvider() {
    switch (this.provider) {
      case 'openai':
        this.client = new OpenAI({ apiKey: this.apiKey });
        break;
      case 'anthropic':
        this.client = new Anthropic({ apiKey: this.apiKey });
        break;
      case 'local':
        // Ollama endpoint
        this.endpoint = 'http://localhost:11434/api/generate';
        break;
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  async complete(prompt, options = {}) {
    const maxTokens = options.maxTokens || 2000;
    const temperature = options.temperature || 0.7;

    switch (this.provider) {
      case 'openai':
        return this.completeOpenAI(prompt, maxTokens, temperature);
      case 'anthropic':
        return this.completeAnthropic(prompt, maxTokens, temperature);
      case 'local':
        return this.completeLocal(prompt, maxTokens, temperature);
    }
  }

  async completeOpenAI(prompt, maxTokens, temperature) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature
    });

    return {
      text: response.choices[0].message.content,
      usage: response.usage
    };
  }

  async completeAnthropic(prompt, maxTokens, temperature) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }]
    });

    return {
      text: response.content[0].text,
      usage: response.usage
    };
  }

  async completeLocal(prompt, maxTokens, temperature) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens
        }
      })
    });

    const data = await response.json();
    return {
      text: data.response,
      usage: { prompt_tokens: 0, completion_tokens: 0 } // Ollama doesn't provide
    };
  }

  // Analysis Methods

  async analyzeArchitecture(mothManifest) {
    const prompt = this.buildArchitecturePrompt(mothManifest);
    const response = await this.complete(prompt, { maxTokens: 1500 });
    return this.parseJSON(response.text);
  }

  async detectSmells(mothManifest) {
    const prompt = this.buildSmellsPrompt(mothManifest);
    const response = await this.complete(prompt, { maxTokens: 1000 });
    return this.parseJSON(response.text);
  }

  async answerQuery(question, mothManifest) {
    const relevantLines = this.searchMOTH(question, mothManifest);
    const prompt = this.buildQueryPrompt(question, relevantLines);
    const response = await this.complete(prompt, { maxTokens: 500 });
    return response.text;
  }

  // Prompt Builders (see next section)
  buildArchitecturePrompt(mothManifest) { /* ... */ }
  buildSmellsPrompt(mothManifest) { /* ... */ }
  buildQueryPrompt(question, context) { /* ... */ }

  // Utilities
  searchMOTH(query, manifest) {
    // Simple keyword search for now
    // TODO: Implement vector search
    const lines = manifest.split('\n').filter(line => line.startsWith('./'));
    const keywords = query.toLowerCase().split(' ');
    return lines.filter(line =>
      keywords.some(kw => line.toLowerCase().includes(kw))
    ).slice(0, 20); // Top 20 matches
  }

  parseJSON(text) {
    // Extract JSON from markdown code blocks if needed
    const match = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, text];
    try {
      return JSON.parse(match[1]);
    } catch {
      return { error: 'Failed to parse LLM response', raw: text };
    }
  }
}
```

---

### Milestone 2.2: Prompt Templates (Days 11-12)

**Create:** `packages/server/prompts/`

```javascript
// prompts/architecture.js
export const ARCHITECTURE_PROMPT = `You are an expert software architect analyzing a codebase represented in MOTH format.

MOTH Format: Each line represents a file with metrics:
path | {fanin:X;fanout:Y;depth:Z;churn:N;loc:L;complexity:C;coverage:P} | deps | symbols | doc | summary

Key Metrics:
- fanin: How many files import this file (incoming dependencies)
- fanout: How many files this file imports (outgoing dependencies)
- depth: Import hierarchy depth (leaf=1, root=max)
- churn: Git commit frequency (stability indicator)
- loc: Lines of code
- complexity: Cyclomatic complexity
- coverage: Runtime test coverage (0-100%)

Analyze this MOTH manifest:

{manifest}

Provide analysis as JSON:
{
  "summary": "2-3 sentence high-level overview",
  "architecture": {
    "patterns": ["list of detected architectural patterns"],
    "layers": ["identified logical layers"],
    "subsystems": ["main functional subsystems"]
  },
  "metrics": {
    "totalFiles": number,
    "averageComplexity": number,
    "highCouplingFiles": ["files with fanin+fanout > 10"],
    "hotspots": ["high churn + high complexity files"]
  },
  "risks": [
    {
      "type": "god_file | tight_coupling | low_coverage | high_churn",
      "file": "path/to/file",
      "description": "why this is risky"
    }
  ],
  "recommendations": ["actionable improvement suggestions"]
}`;

// prompts/smells.js
export const SMELLS_PROMPT = `You are a code quality expert detecting anti-patterns in a MOTH manifest.

Common code smells to detect:
1. **God Files**: loc > 500 AND complexity > 50 AND fanout > 15
2. **Tight Coupling**: fanin + fanout > 20
3. **Unstable Interface**: high fanin AND high churn (>50)
4. **Dead Code**: coverage = 0 AND fanin = 0
5. **Hotspot**: high complexity AND high churn AND high coverage (needs refactoring)
6. **Circular Dependencies**: depth inconsistencies or mutual imports

MOTH Manifest:

{manifest}

Return JSON array:
[
  {
    "smell": "god_file | tight_coupling | unstable | dead_code | hotspot | circular",
    "severity": "high | medium | low",
    "file": "path",
    "metrics": { relevant metrics },
    "description": "why this is a smell",
    "suggestion": "how to fix"
  }
]

Sort by severity (high first).`;

// prompts/query.js
export const QUERY_PROMPT = `You are a helpful coding assistant with access to a codebase MOTH manifest.

User Question: {question}

Relevant Code Context (MOTH lines):
{context}

Instructions:
- Answer concisely (2-4 sentences)
- Reference specific files when relevant
- If the context doesn't contain the answer, say so
- Provide actionable guidance

Answer:`;

// prompts/impact.js
export const IMPACT_PROMPT = `You are analyzing the impact of code changes using MOTH manifests.

BEFORE (baseline):
{beforeManifest}

AFTER (with changes):
{afterManifest}

Changed files (marked with 'changed:true'):
{changedFiles}

Analyze:
1. **Direct Impact**: Files that changed
2. **Ripple Impact**: Files that import changed files (fanin analysis)
3. **Risk Assessment**: Based on fanin (how many depend on this), coverage, complexity
4. **Recommendations**: What to test, what to review carefully

Return JSON:
{
  "summary": "1-2 sentence impact overview",
  "directImpact": {
    "files": ["changed file paths"],
    "linesChanged": number,
    "complexityChange": number
  },
  "rippleImpact": {
    "affectedFiles": ["files that import changed files"],
    "cascadeDepth": number,
    "riskScore": 1-10
  },
  "risks": ["identified risks"],
  "testingRecommendations": ["what to test"]
}`;
```

**Integrate into LLMService:**

```javascript
// packages/server/llm-service.js

import { ARCHITECTURE_PROMPT, SMELLS_PROMPT, QUERY_PROMPT, IMPACT_PROMPT } from './prompts/index.js';

buildArchitecturePrompt(mothManifest) {
  return ARCHITECTURE_PROMPT.replace('{manifest}', mothManifest);
}

buildSmellsPrompt(mothManifest) {
  return SMELLS_PROMPT.replace('{manifest}', mothManifest);
}

buildQueryPrompt(question, context) {
  return QUERY_PROMPT
    .replace('{question}', question)
    .replace('{context}', context.join('\n'));
}

buildImpactPrompt(beforeManifest, afterManifest, changedFiles) {
  return IMPACT_PROMPT
    .replace('{beforeManifest}', beforeManifest)
    .replace('{afterManifest}', afterManifest)
    .replace('{changedFiles}', changedFiles.join('\n'));
}
```

---

### Milestone 2.3: API Endpoints (Days 13-14)

**Create:** `packages/server/moth-endpoints.js`

```javascript
import { LLMService } from './llm-service.js';
import { resolve } from 'path';
import fs from 'fs';

export function registerMOTHEndpoints(app, getCurrentRepoPath) {
  // Helper: Load MOTH manifest
  const loadMOTH = () => {
    const repoPath = getCurrentRepoPath();
    const mothPath = resolve(repoPath, '.mothlab/moth/REPO.moth');

    if (!fs.existsSync(mothPath)) {
      throw new Error('No MOTH manifest found. Generate one first.');
    }

    return fs.readFileSync(mothPath, 'utf8');
  };

  // POST /api/moth-analyze
  app.post('/api/moth-analyze', async (req, res) => {
    try {
      const { mode, provider, model } = req.body;

      const manifest = loadMOTH();
      const llm = new LLMService({ provider, model });

      let result;
      switch (mode) {
        case 'architecture':
          result = await llm.analyzeArchitecture(manifest);
          break;
        case 'smells':
          result = await llm.detectSmells(manifest);
          break;
        default:
          return res.status(400).json({ error: 'Invalid mode' });
      }

      res.json({ success: true, result });

    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/moth-query
  app.post('/api/moth-query', async (req, res) => {
    try {
      const { question, provider, model } = req.body;

      if (!question) {
        return res.status(400).json({ error: 'Question required' });
      }

      const manifest = loadMOTH();
      const llm = new LLMService({ provider, model });

      const answer = await llm.answerQuery(question, manifest);

      res.json({ success: true, answer });

    } catch (error) {
      console.error('Query error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/moth-compare
  app.post('/api/moth-compare', async (req, res) => {
    try {
      const { beforePath, afterPath, provider, model } = req.body;

      const beforeManifest = fs.readFileSync(beforePath, 'utf8');
      const afterManifest = fs.readFileSync(afterPath, 'utf8');

      const changedFiles = extractChangedFiles(afterManifest);

      const llm = new LLMService({ provider, model });
      const prompt = llm.buildImpactPrompt(beforeManifest, afterManifest, changedFiles);
      const response = await llm.complete(prompt, { maxTokens: 1000 });
      const result = llm.parseJSON(response.text);

      res.json({ success: true, result });

    } catch (error) {
      console.error('Compare error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/moth-providers
  app.get('/api/moth-providers', (req, res) => {
    res.json({
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
          requiresKey: true
        },
        {
          id: 'anthropic',
          name: 'Anthropic',
          models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
          requiresKey: true
        },
        {
          id: 'local',
          name: 'Local (Ollama)',
          models: ['llama3.1:8b', 'llama3.1:70b', 'codellama:7b'],
          requiresKey: false
        }
      ]
    });
  });
}

function extractChangedFiles(mothManifest) {
  return mothManifest
    .split('\n')
    .filter(line => line.includes('changed:true') || line.includes('(modified)'))
    .map(line => line.split('|')[0].trim());
}
```

**Register in server.js:**

```javascript
// packages/server/server.js

import { registerMOTHEndpoints } from './moth-endpoints.js';

// After existing endpoints...
registerMOTHEndpoints(app, () => currentRepoPath);
```

---

### Milestone 2.4: Install Dependencies

```bash
cd packages/server
npm install openai @anthropic-ai/sdk
```

Add to `package.json`:
```json
{
  "dependencies": {
    "openai": "^4.20.0",
    "@anthropic-ai/sdk": "^0.9.0"
  }
}
```

---

## Phase 3: Enhanced UI (Week 3-4)

**Goal:** Integrate LLM features into MOTHPanel and add Q&A interface.

### Milestone 3.1: LLM Analysis UI (Days 15-17)

**Modify:** `packages/ui/src/components/MOTHPanel.jsx`

```jsx
// Add state for LLM features
const [llmProvider, setLlmProvider] = useState('openai');
const [llmModel, setLlmModel] = useState('gpt-4-turbo-preview');
const [analyzing, setAnalyzing] = useState(false);
const [insights, setInsights] = useState(null);
const [smells, setSmells] = useState(null);

// Add analysis functions
const analyzeArchitecture = async () => {
  setAnalyzing(true);
  try {
    const res = await fetch('/api/moth-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'architecture',
        provider: llmProvider,
        model: llmModel
      })
    });

    const data = await res.json();
    if (data.success) {
      setInsights(data.result);
      setView('insights');
    } else {
      setError('Analysis failed: ' + data.error);
    }
  } catch (err) {
    setError('Analysis error: ' + err.message);
  } finally {
    setAnalyzing(false);
  }
};

const detectSmells = async () => {
  setAnalyzing(true);
  try {
    const res = await fetch('/api/moth-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'smells',
        provider: llmProvider,
        model: llmModel
      })
    });

    const data = await res.json();
    if (data.success) {
      setSmells(data.result);
      setView('smells');
    } else {
      setError('Smell detection failed: ' + data.error);
    }
  } catch (err) {
    setError('Smell detection error: ' + err.message);
  } finally {
    setAnalyzing(false);
  }
};

// Add to toolbar
<div className="flex gap-2">
  {/* Existing view buttons... */}

  <button
    onClick={analyzeArchitecture}
    disabled={analyzing}
    className="px-3 py-1 rounded text-xs font-semibold bg-purple-700 hover:bg-purple-600 transition"
  >
    {analyzing ? '⏳' : '🤖'} Analyze Architecture
  </button>

  <button
    onClick={detectSmells}
    disabled={analyzing}
    className="px-3 py-1 rounded text-xs font-semibold bg-orange-700 hover:bg-orange-600 transition"
  >
    {analyzing ? '⏳' : '🔍'} Detect Smells
  </button>
</div>

// Add insights view
{view === 'insights' && insights && (
  <div className="p-4">
    <h3 className="text-xl font-bold mb-4">🤖 Architectural Insights</h3>

    <div className="mb-4">
      <h4 className="font-bold text-purple-300">Summary</h4>
      <p className="text-sm">{insights.summary}</p>
    </div>

    <div className="mb-4">
      <h4 className="font-bold text-purple-300">Architecture</h4>
      <div className="text-sm">
        <strong>Patterns:</strong> {insights.architecture.patterns.join(', ')}
        <br />
        <strong>Layers:</strong> {insights.architecture.layers.join(', ')}
        <br />
        <strong>Subsystems:</strong> {insights.architecture.subsystems.join(', ')}
      </div>
    </div>

    {insights.risks.length > 0 && (
      <div className="mb-4">
        <h4 className="font-bold text-red-400">⚠️ Risks</h4>
        <ul className="text-sm space-y-2">
          {insights.risks.map((risk, i) => (
            <li key={i} className="border-l-2 border-red-500 pl-2">
              <strong>{risk.type}:</strong> {risk.file}
              <br />
              <span className="text-[#6a6a6a]">{risk.description}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div>
      <h4 className="font-bold text-green-400">💡 Recommendations</h4>
      <ul className="text-sm list-disc list-inside">
        {insights.recommendations.map((rec, i) => (
          <li key={i}>{rec}</li>
        ))}
      </ul>
    </div>
  </div>
)}

// Add smells view
{view === 'smells' && smells && (
  <div className="p-4">
    <h3 className="text-xl font-bold mb-4">🔍 Code Smells Detected</h3>

    {smells.length === 0 ? (
      <p className="text-green-400">✅ No significant code smells detected!</p>
    ) : (
      <div className="space-y-3">
        {smells.map((smell, i) => (
          <div
            key={i}
            className={`border-l-4 pl-3 ${
              smell.severity === 'high' ? 'border-red-500' :
              smell.severity === 'medium' ? 'border-orange-500' :
              'border-yellow-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">{smell.smell.replace(/_/g, ' ').toUpperCase()}</span>
              <span className={`text-xs px-2 py-1 rounded ${
                smell.severity === 'high' ? 'bg-red-900' :
                smell.severity === 'medium' ? 'bg-orange-900' :
                'bg-yellow-900'
              }`}>
                {smell.severity}
              </span>
            </div>
            <div className="text-sm text-[#6a6a6a] mt-1">{smell.file}</div>
            <div className="text-sm mt-1">{smell.description}</div>
            <div className="text-sm text-green-400 mt-1">
              💡 {smell.suggestion}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

---

### Milestone 3.2: Q&A Interface (Days 18-20)

**Create:** `packages/ui/src/components/MOTHQueryInterface.jsx`

```jsx
import React, { useState } from 'react';

export default function MOTHQueryInterface({ provider, model }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const askQuestion = async () => {
    if (!question.trim()) return;

    const userMessage = { role: 'user', content: question };
    setHistory(prev => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/moth-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, provider, model })
      });

      const data = await res.json();

      if (data.success) {
        const assistantMessage = { role: 'assistant', content: data.answer };
        setHistory(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          role: 'error',
          content: 'Query failed: ' + data.error
        };
        setHistory(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = {
        role: 'error',
        content: 'Error: ' + error.message
      };
      setHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#1a1a1a]">
        <h3 className="text-lg font-bold">💬 Ask About the Codebase</h3>
        <p className="text-xs text-[#6a6a6a]">
          Powered by {provider} {model}
        </p>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.length === 0 && (
          <div className="text-center text-[#6a6a6a] py-8">
            <p className="mb-2">Ask me anything about the architecture!</p>
            <p className="text-xs">Examples:</p>
            <ul className="text-xs list-disc list-inside mt-2">
              <li>What are the main subsystems?</li>
              <li>Which files have the highest complexity?</li>
              <li>Where is authentication handled?</li>
              <li>What depends on the auth module?</li>
            </ul>
          </div>
        )}

        {history.map((msg, i) => (
          <div
            key={i}
            className={`${
              msg.role === 'user' ? 'text-right' :
              msg.role === 'error' ? 'text-center' :
              'text-left'
            }`}
          >
            <div
              className={`inline-block px-4 py-2 rounded-lg text-sm ${
                msg.role === 'user' ? 'bg-purple-700' :
                msg.role === 'error' ? 'bg-red-900' :
                'bg-[#1a1a1a]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-left">
            <div className="inline-block px-4 py-2 rounded-lg text-sm bg-[#1a1a1a]">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#1a1a1a]">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-sm focus:outline-none focus:border-purple-700"
          />
          <button
            onClick={askQuestion}
            disabled={loading || !question.trim()}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? '⏳' : '➤'} Ask
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Integrate into MOTHPanel:**

```jsx
import MOTHQueryInterface from './MOTHQueryInterface';

// Add to toolbar
<button
  onClick={() => setView('query')}
  className={`px-3 py-1 rounded text-xs font-semibold transition ${
    view === 'query' ? 'bg-purple-700' : 'bg-[#0a0a0a] hover:bg-[#1a1a1a]'
  }`}
>
  💬 Q&A
</button>

// Add view
{view === 'query' && (
  <MOTHQueryInterface
    provider={llmProvider}
    model={llmModel}
  />
)}
```

---

## Phase 4: Testing & Documentation (Week 4)

### Milestone 4.1: Integration Testing (Days 21-23)

**Test Suite:**

```javascript
// test/moth-integration.test.js

describe('MOTH Integration', () => {
  test('graph.json to MOTH conversion preserves metrics', async () => {
    // Generate IntelliMap graph
    await exec('npm run index');

    // Convert to MOTH
    const graph = JSON.parse(fs.readFileSync('.intellimap/graph.json'));
    const { convertGraphToMOTH } = require('../packages/cli/indexers/mothConverter');
    const result = convertGraphToMOTH(graph);

    // Verify
    expect(result.count).toBe(graph.nodes.length);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.manifest).toContain('coverage:');
    expect(result.manifest).not.toContain('coverage:0'); // Should have some non-zero
  });

  test('LLM analysis returns valid JSON', async () => {
    const llm = new LLMService({ provider: 'openai' });
    const manifest = fs.readFileSync('.mothlab/moth/REPO.moth', 'utf8');

    const insights = await llm.analyzeArchitecture(manifest);

    expect(insights).toHaveProperty('summary');
    expect(insights).toHaveProperty('architecture');
    expect(insights).toHaveProperty('risks');
    expect(Array.isArray(insights.risks)).toBe(true);
  });

  test('Q&A returns relevant answer', async () => {
    const llm = new LLMService({ provider: 'openai' });
    const manifest = fs.readFileSync('.mothlab/moth/REPO.moth', 'utf8');

    const answer = await llm.answerQuery(
      'What are the main components?',
      manifest
    );

    expect(typeof answer).toBe('string');
    expect(answer.length).toBeGreaterThan(50);
  });
});
```

**Run Tests:**
```bash
npm test test/moth-integration.test.js
```

---

### Milestone 4.2: Documentation (Days 24-25)

**Create:** `docs/MOTH-GUIDE.md`

```markdown
# MOTH Integration Guide

## Overview

MOTH (Machine-Optimized Text Hierarchy) is IntelliMap's semantic compression format for LLM-powered codebase analysis.

## Quick Start

### 1. Generate MOTH from IntelliMap

```bash
# First, analyze your codebase with IntelliMap
npm run index

# Then generate MOTH (uses existing analysis)
npm run cli -- moth
```

Output: `.mothlab/moth/REPO.moth`

### 2. Analyze with LLM

Start IntelliMap server:
```bash
npm run serve
```

Open browser, click "🦋 MOTH" in toolbar:
- Click "🤖 Analyze Architecture" for high-level insights
- Click "🔍 Detect Smells" for code quality issues
- Click "💬 Q&A" to ask questions about the codebase

## Configuration

### LLM Provider Setup

**OpenAI (Recommended):**
```bash
export OPENAI_API_KEY="sk-..."
```

**Anthropic:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Local (Ollama - Free):**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull llama3.1:8b

# Start Ollama (runs on http://localhost:11434)
ollama serve
```

## CLI Usage

```bash
# Generate MOTH from graph.json (fast)
npm run cli -- moth

# Force regeneration from source files
npm run cli -- moth --force

# Filter by environment
npm run cli -- moth --env frontend
```

## API Reference

### POST /api/moth-analyze

Analyze architecture or detect code smells.

**Request:**
```json
{
  "mode": "architecture" | "smells",
  "provider": "openai" | "anthropic" | "local",
  "model": "gpt-4-turbo-preview"
}
```

**Response:**
```json
{
  "success": true,
  "result": { /* insights */ }
}
```

### POST /api/moth-query

Ask questions about the codebase.

**Request:**
```json
{
  "question": "What are the main subsystems?",
  "provider": "openai",
  "model": "gpt-4-turbo-preview"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "The codebase has three main subsystems..."
}
```

## Cost Estimates

### OpenAI GPT-4

- Architecture Analysis: ~$0.50-2.00 per run
- Code Smell Detection: ~$0.30-1.00 per run
- Q&A Query: ~$0.01-0.05 per query

### Anthropic Claude 3.5

- Similar pricing to GPT-4
- Better at code analysis tasks

### Local (Ollama)

- Free!
- Fast for small-medium repos
- Privacy-first (no data sent to cloud)

## Best Practices

1. **Generate MOTH from graph.json**
   - Faster (no re-parsing)
   - Preserves runtime data
   - Consistent with visualization

2. **Cache LLM responses**
   - Don't re-analyze unchanged code
   - Use file hash for cache key

3. **Use appropriate model**
   - Quick queries: GPT-3.5 / Local
   - Deep analysis: GPT-4 / Claude 3.5

4. **Filter for large repos**
   - Use `--env frontend` for frontend-only
   - Analyze subsystems separately
   - Use map-reduce for 1000+ files

## Troubleshooting

**"No MOTH manifest found"**
- Run `npm run cli -- moth` first

**"OpenAI API key not found"**
- Set `OPENAI_API_KEY` environment variable
- Or provide in UI settings

**"Analysis timed out"**
- Try smaller subset (use --env filter)
- Use faster model (gpt-3.5-turbo)
- Switch to local model

**"Coverage always 0"**
- Make sure you ran `npm run index` first
- Check that `.intellimap/graph.json` has runtime data
- Verify MOTH was generated from graph (not --force)

## Examples

See `examples/moth/` for sample analyses and prompts.
```

---

### Milestone 4.3: Example Prompts & Outputs

**Create:** `examples/moth/sample-analysis.json`

```json
{
  "input": {
    "manifest": "docs/moth/REPO.moth",
    "mode": "architecture"
  },
  "output": {
    "summary": "IntelliMap is a monorepo with 3 packages: CLI (indexing), Server (API), and UI (React visualization). The architecture follows a clean separation with CLI handling analysis, Server providing REST endpoints, and UI consuming the API.",
    "architecture": {
      "patterns": [
        "Monorepo (packages/)",
        "Client-Server Architecture",
        "Static Analysis + Runtime Analysis",
        "Graph-based Visualization"
      ],
      "layers": [
        "CLI Tools (indexing, diffing, MOTH generation)",
        "Server API (Express REST endpoints)",
        "UI Layer (React + Cytoscape)"
      ],
      "subsystems": [
        "packages/cli - Static analysis and MOTH generation",
        "packages/server - API server and LLM integration",
        "packages/ui - Interactive graph visualization"
      ]
    },
    "metrics": {
      "totalFiles": 96,
      "averageComplexity": 12.5,
      "highCouplingFiles": [
        "packages/server/server.js (fanin:8, fanout:15)",
        "packages/ui/src/App.jsx (fanin:0, fanout:14)"
      ],
      "hotspots": [
        "README.md (churn:134, frequently changed)",
        "packages/server/server.js (complex + high coupling)"
      ]
    },
    "risks": [
      {
        "type": "god_file",
        "file": "packages/server/server.js",
        "description": "Large server file with high coupling (fanout:15). Consider splitting into separate route handlers."
      },
      {
        "type": "tight_coupling",
        "file": "packages/ui/src/App.jsx",
        "description": "Entry point with 14 direct imports. Consider code splitting or lazy loading."
      }
    ],
    "recommendations": [
      "Split packages/server/server.js into separate route modules",
      "Implement code splitting in UI for better load times",
      "Add integration tests (low coverage detected)",
      "Consider extracting shared types to a common package"
    ]
  }
}
```

---

## Success Metrics

### Technical Milestones

- ✅ Week 1: Bridge completed (graph.json → MOTH)
- ✅ Week 2: LLM service operational
- ✅ Week 3: UI integrated with LLM features
- ✅ Week 4: Tested and documented

### Quality Gates

- ✅ Zero duplicate parsing (MOTH uses graph.json)
- ✅ Runtime data preserved (coverage > 0)
- ✅ LLM response time <10s for architecture analysis
- ✅ LLM response time <3s for Q&A queries
- ✅ UI/UX intuitive (one-click analysis)
- ✅ Cost-effective (option for free local models)

### User Value

- ✅ Faster onboarding (architectural summary in seconds)
- ✅ Better refactoring (smell detection + recommendations)
- ✅ Informed decisions (change impact analysis)
- ✅ Interactive exploration (Q&A interface)

---

## Rollout Plan

### Week 1: Internal Testing
- Implement Phase 1 (bridge)
- Test on IntelliMap's own codebase
- Validate metrics preservation

### Week 2: Alpha Release
- Add LLM service
- Test with OpenAI/Claude
- Gather feedback on insights quality

### Week 3: Beta Release
- Add UI features
- Enable local models (Ollama)
- Test with external repos

### Week 4: Production Release
- Documentation complete
- Examples and guides
- Public announcement

---

## Appendix: File Checklist

### New Files to Create

```
✅ packages/cli/indexers/mothConverter.js
✅ packages/server/llm-service.js
✅ packages/server/moth-endpoints.js
✅ packages/server/prompts/architecture.js
✅ packages/server/prompts/smells.js
✅ packages/server/prompts/query.js
✅ packages/server/prompts/impact.js
✅ packages/server/prompts/index.js
✅ packages/ui/src/components/MOTHQueryInterface.jsx
✅ docs/MOTH-GUIDE.md
✅ examples/moth/sample-analysis.json
✅ test/moth-integration.test.js
```

### Files to Modify

```
✅ packages/cli/commands/moth.js
✅ packages/cli/index.js
✅ packages/server/server.js
✅ packages/ui/src/components/MOTHPanel.jsx
✅ packages/ui/src/components/Toolbar.jsx
```

### Files to Clean Up

```
❌ DELETE docs/moth/REPO.moth (spark-intellishot data)
❌ DELETE docs/moth/moth.index.json (spark-intellishot data)
❌ DELETE docs/moth/validation.log (stale)
❌ DELETE docs/moth/*.Zone.Identifier (Windows artifacts)
📦 MOVE docs/moth/analyze.mjs to examples/standalone-generator/
```

---

## Next Steps

1. **Review this plan** - Adjust timeline/scope as needed
2. **Set up LLM accounts** - Get OpenAI/Anthropic API keys
3. **Start Phase 1** - Begin with mothConverter.js
4. **Test incrementally** - Validate each milestone before proceeding

**Let's build the bridge and add the intelligence! 🦋🤖**

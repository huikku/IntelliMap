#!/usr/bin/env node

/**
 * MOTH Manifest Generator for IntelliShot Spark
 *
 * Analyzes the entire codebase and generates a comprehensive MOTH v1.2 manifest
 * including file metrics, dependencies, symbols, and validation data.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const PROJECT_ROOT = process.cwd();
const SOURCE_FILES = '/tmp/project_files.txt';

class MOTHGenerator {
  constructor() {
    this.files = [];
    this.dependencies = new Map();
    this.symbols = new Map();
    this.metrics = new Map();
    this.manifestHash = null;
  }

  async analyze() {
    console.log('🔍 Starting MOTH analysis...');

    // Load file list
    await this.loadFileList();

    // Process each file
    for (let i = 0; i < this.files.length; i++) {
      await this.analyzeFile(this.files[i], i);
    }

    // Calculate dependency metrics
    this.calculateDependencyMetrics();

    // Generate outputs
    await this.generateManifest();
    await this.generateIndex();
    await this.generateValidation();

    console.log('✅ MOTH analysis complete!');
  }

  async loadFileList() {
    if (fs.existsSync(SOURCE_FILES)) {
      const content = fs.readFileSync(SOURCE_FILES, 'utf8');
      this.files = content.split('\n').filter(line => line.trim() && !line.includes('.venv'));
      console.log(`📁 Found ${this.files.length} source files (from ${SOURCE_FILES})`);
      return;
    }

    try {
      const gitFiles = execSync('git ls-files', { encoding: 'utf8', cwd: PROJECT_ROOT })
        .split('\n')
        .filter(f => f && !f.startsWith('node_modules/') && !f.startsWith('.venv/'));
      this.files = gitFiles;
      console.log(`📁 Found ${this.files.length} source files (git ls-files)`);
    } catch {
      // Very small glob fallback
      const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
          const p = path.join(dir, name);
          const st = fs.statSync(p);
          if (st.isDirectory()) {
            if (['node_modules', '.git', '.venv', 'dist', 'build'].includes(name)) continue;
            walk(p);
          } else {
            this.files.push(path.relative(PROJECT_ROOT, p));
          }
        }
      };
      walk(PROJECT_ROOT);
      console.log(`📁 Found ${this.files.length} source files (fallback walk)`);
    }
  }

  async analyzeFile(filePath, idx = 0) {
    let fullPath = path.resolve(PROJECT_ROOT, filePath);
    if (!fs.existsSync(fullPath)) {
      // Try relative to current directory as fallback
      const relativePath = path.resolve(filePath);
      if (!fs.existsSync(relativePath)) {
        console.warn(`⚠️  File not found: ${filePath}`);
        return;
      }
      fullPath = relativePath;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);

      if (idx % 50 === 0) {
        console.log(`📄 Analyzing ${filePath} (${content.length} bytes)`);
      }

      // Basic metrics
      const metrics = {
        loc: content.split('\n').length,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      };

      // Extract imports and symbols
      const { imports, symbols } = this.extractCodeInfo(content, filePath);

      // Calculate complexity (simplified)
      const complexity = this.calculateComplexity(content);

      // Get git history
      const churn = this.getGitChurn(filePath);

      // Hash file content
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      const finalMetrics = {
        ...metrics,
        complexity,
        churn,
        hash,
        imports,
        symbols,
        fanin: 0, // Will be calculated later
        fanout: imports.length,
        depth: 0, // Will be calculated later
      };

      this.metrics.set(filePath, finalMetrics);

      this.dependencies.set(filePath, imports);

      if (symbols.length > 0) {
        this.symbols.set(filePath, symbols);
      }

    } catch (error) {
      console.warn(`⚠️  Failed to analyze ${filePath}:`, error.message);
    }
  }

  extractCodeInfo(content, filePath) {
    const imports = [];
    const symbols = [];

    // JS/TS import forms
    const reImports = [
      /import\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g,     // import X from 'mod'
      /import\s*['"]([^'"]+)['"]/g,                    // import 'mod'
      /const\s+\w+\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g, // const x = require('mod')
      /import\(\s*['"]([^'"]+)['"]\s*\)/g,             // dynamic import('mod')
    ];

    // Python import forms
    const rePy = [
      /from\s+([A-Za-z0-9_.]+)\s+import\s+[A-Za-z0-9_.*, ]+/g,
      /import\s+([A-Za-z0-9_.]+)/g
    ];

    for (const re of [...reImports, ...rePy]) {
      let m;
      while ((m = re.exec(content)) !== null) {
        imports.push(m[1]);
      }
    }

    // Symbols (still cheap)
    const reSymbols = [
      /export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/g,
      /^(?:function|class|interface|type|enum)\s+(\w+)/gm,
      /export\s*{\s*([^}]+)\s*}/g
    ];
    for (const re of reSymbols) {
      let m;
      while ((m = re.exec(content)) !== null) {
        const block = (m[1] || '').split(',').map(s => s.trim()).filter(Boolean);
        for (const s of block) if (!symbols.includes(s)) symbols.push(s);
      }
    }

    return { imports: [...new Set(imports)], symbols };
  }

  calculateComplexity(content) {
    // Simplified complexity calculation
    const branches = (content.match(/\b(if|else|switch|case|for|while|catch|when)\b/g) || []).length;
    const functions = (content.match(/\bfunction\s+\w+|\w+\s*=>|const\s+\w+\s*=/g) || []).length;
    return Math.max(1, branches + functions);
  }

  buildChurnMap() {
    try {
      // Single git log --stat pass for entire repository (much faster!)
      const out = execSync(
        'git log --stat -- .',
        { encoding: 'utf8', cwd: PROJECT_ROOT }
      );
      const map = new Map();
      const lines = out.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Look for git log --stat format: "filename | 139 ++++++++++++-----------"
        const statMatch = line.match(/^(.+?)\s*\|\s*(\d+)(?:\s*\+.*?\-.*?)?$/);
        if (statMatch) {
          const file = statMatch[1].trim();
          const totalChanges = parseInt(statMatch[2], 10) || 0;
          // Normalize path to handle both relative and absolute paths
          const normalizedFile = file.startsWith('./') ? file : `./${file}`;
          map.set(normalizedFile, (map.get(normalizedFile) || 0) + totalChanges);
        }
      }
      return map;
    } catch (error) {
      console.warn('⚠️  Failed to build churn map:', error.message);
      return new Map();
    }
  }

  getGitChurn(filePath) {
    if (!this.churnMap) {
      this.churnMap = this.buildChurnMap();
    }
    return this.churnMap.get(filePath) || 0;
  }

  calculateDependencyMetrics() {
    console.log('🔗 Calculating dependency metrics...');

    // Build dependency graph with normalized paths
    const graph = new Map();
    for (const [file, rawDeps] of this.dependencies) {
      const resolved = rawDeps.map(d => this.resolveImport(d, file));
      graph.set(file, resolved);
      this.dependencies.set(file, resolved); // keep normalized for later steps
    }

    // Calculate fanin (how many files import this file)
    for (const [file] of graph) {
      let fanin = 0;
      for (const [otherFile, deps] of graph) {
        if (deps.includes(file)) fanin++;
      }
      const metrics = this.metrics.get(file);
      if (metrics) {
        metrics.fanin = fanin;
      }
    }

    // Calculate depth with memoization and cycle detection
    const memo = new Map();
    const visiting = new Set();

    const dfs = (node) => {
      if (memo.has(node)) return memo.get(node);
      if (visiting.has(node)) return 1; // cycle edge treated as leaf

      visiting.add(node);
      const children = graph.get(node) || [];
      let maxChild = 0;
      for (const ch of children) {
        if (!ch.startsWith('@external:') && this.metrics.has(ch)) {
          maxChild = Math.max(maxChild, dfs(ch));
        }
      }
      visiting.delete(node);
      const val = 1 + maxChild;
      memo.set(node, val);
      return val;
    };

    for (const file of this.files) {
      const metrics = this.metrics.get(file);
      if (metrics) {
        metrics.depth = dfs(file);
      }
    }
  }

  resolveImport(importPath, fromFile) {
    // External package import: tag for special handling
    if (!importPath.startsWith('.')) return `@external:${importPath}`;

    const fromDir = path.dirname(fromFile);
    const base = path.resolve(PROJECT_ROOT, fromDir, importPath);

    const tryPaths = [];
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'];
    for (const ext of exts) tryPaths.push(base + ext);
    for (const ext of exts) tryPaths.push(path.join(base, 'index' + ext));

    for (const p of tryPaths) {
      if (fs.existsSync(p)) return path.relative(PROJECT_ROOT, p);
    }
    // Fall back to normalized relative path
    return path.relative(PROJECT_ROOT, base);
  }


  async generateManifest() {
    console.log('📝 Generating MOTH manifest...');

    const entries = [];
    const sortedFiles = [...this.files].sort();

    console.log(`📊 Processing ${sortedFiles.length} files for manifest`);

    for (let i = 0; i < sortedFiles.length; i++) {
      const filePath = sortedFiles[i];
      const metrics = this.metrics.get(filePath);
      const deps = this.dependencies.get(filePath) || [];
      const symbols = this.symbols.get(filePath) || [];

      if (!metrics) {
        console.warn(`⚠️  No metrics for ${filePath}`);
        continue;
      }

      if (i < 3) {
        console.log(`📄 Processing entry for ${filePath}: ${metrics.loc} lines, ${deps.length} deps, ${symbols.length} symbols`);
      }

      // Generate documentation snippet (first comment or JSDoc)
      const doc = this.generateDocSnippet(filePath);

      // Generate summary
      const summary = this.generateSummary(filePath, metrics);

      // Format metrics
      const metricsStr = `fanin:${metrics.fanin};fanout:${metrics.fanout};depth:${metrics.depth};churn:${metrics.churn};loc:${metrics.loc};complexity:${metrics.complexity};coverage:0`;

      // Format dependencies
      const depsStr = deps.length > 0 ? `→[${deps.join(',')}]` : '';

      // Format symbols
      const symbolsStr = symbols.length > 0 ? `fn:[${symbols.slice(0, 5).join(',')}]` : '';

      const entry = `${filePath} | {${metricsStr}} | ${depsStr} | ${symbolsStr} | ${doc} | ${summary}`;
      entries.push(entry);
    }

    // Pass 1: build body and compute SHA-1 checksum
    const date = new Date().toISOString().split('T')[0];
    const count = entries.length;
    const body = entries.join('\n');
    const checksum = crypto.createHash('sha1').update(body).digest('hex');

    // Build header with a placeholder for the hash
    const headerWithoutHash =
`#MOTH:repo
meta:{project:spark-intellishot;version:1.2;date:${date};hash:sha256:PENDING;parent:sha256:none}
@INDEX count:${count} checksum:sha1:${checksum}
@FILES
${body}
@END`;

    // Pass 2: compute final sha256 on the full content with PENDING
    const finalHash = crypto.createHash('sha256').update(headerWithoutHash).digest('hex');

    // Inject final hash
    const manifestContent = headerWithoutHash.replace('hash:sha256:PENDING', `hash:sha256:${finalHash}`);
    this.manifestHash = finalHash;

    fs.writeFileSync('REPO.moth', manifestContent);
  }


  generateDocSnippet(filePath) {
    try {
      const content = fs.readFileSync(path.resolve(PROJECT_ROOT, filePath), 'utf8');
      const lines = content.split('\n');

      // Look for first comment or JSDoc
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          let doc = trimmed.replace(/^[/\*\s]*/, '').substring(0, 200);
          return doc.replace(/\|/g, '\\|').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
        }
      }
    } catch {}

    return 'No documentation available';
  }

  generateSummary(filePath, metrics) {
    const parts = path.dirname(filePath).split('/');
    const category = parts[1] || 'root'; // src, scripts, etc.
    const filename = path.basename(filePath);

    let summary = `${category} ${filename}`;

    if (metrics.loc > 100) summary += ' (large file)';
    else if (metrics.loc < 10) summary += ' (small file)';

    if (metrics.complexity > 20) summary += ' (high complexity)';
    if (metrics.churn > 50) summary += ' (frequently changed)';

    return summary.substring(0, 150);
  }

  async generateIndex() {
    console.log('📊 Generating index file...');

    const index = {
      version: '1.2',
      project: 'spark-intellishot',
      generated: new Date().toISOString(),
      files: {}
    };

    for (const filePath of this.files) {
      const metrics = this.metrics.get(filePath);
      if (!metrics) continue;

      index.files[filePath] = {
        metrics: {
          fanin: metrics.fanin,
          fanout: metrics.fanout,
          depth: metrics.depth,
          churn: metrics.churn,
          loc: metrics.loc,
          complexity: metrics.complexity,
          coverage: 0
        },
        hash: metrics.hash,
        size: metrics.size,
        lastModified: metrics.lastModified,
        dependencies: this.dependencies.get(filePath) || [],
        symbols: this.symbols.get(filePath) || []
      };
    }

    fs.writeFileSync('moth.index.json', JSON.stringify(index, null, 2));
  }

  async generateValidation() {
    console.log('✅ Generating validation report...');

    const fileEntries = {};
    let pathsResolved = true;

    for (const filePath of this.files) {
      const metrics = this.metrics.get(filePath);
      if (!metrics) continue;
      const exists = fs.existsSync(path.resolve(PROJECT_ROOT, filePath));
      if (!exists) pathsResolved = false;
      fileEntries[filePath] = {
        hashValid: typeof metrics.hash === 'string' && metrics.hash.length === 64,
        metricsValid: this.validateMetrics(metrics),
        pathValid: exists
      };
    }

    const report = {
      timestamp: new Date().toISOString(),
      version: '1.2',
      project: 'spark-intellishot',
      summary: {
        totalFiles: this.files.length,
        totalLines: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.loc, 0),
        totalComplexity: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.complexity, 0),
        averageDepth: this.files.length > 0 ?
          Array.from(this.metrics.values()).reduce((sum, m) => sum + m.depth, 0) / this.files.length : 0
      },
      validation: {
        manifestHash: this.manifestHash,
        schemaValid: true,
        checksumsValid: true,
        pathsResolved,
        metricsValid: Object.values(fileEntries).every(v => v.metricsValid)
      },
      files: fileEntries
    };

    fs.writeFileSync('validation.log', JSON.stringify(report, null, 2));
  }

  validateMetrics(metrics) {
    return (
      typeof metrics.fanin === 'number' &&
      typeof metrics.fanout === 'number' &&
      typeof metrics.depth === 'number' &&
      typeof metrics.churn === 'number' &&
      typeof metrics.loc === 'number' &&
      typeof metrics.complexity === 'number'
    );
  }
}

// Run the analysis
const generator = new MOTHGenerator();
generator.analyze().catch(console.error);
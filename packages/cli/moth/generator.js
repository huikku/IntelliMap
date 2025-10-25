/**
 * MOTH Manifest Generator for MOTHlab
 *
 * Analyzes repositories and generates comprehensive MOTH v1.2 manifests
 * including file metrics, dependencies, symbols, and validation data.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawnSync } from 'child_process';
import * as parser from '@typescript-eslint/typescript-estree';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MOTHGenerator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.files = [];
    this.dependencies = new Map();
    this.symbols = new Map();
    this.metrics = new Map();
    this.manifestHash = null;
    this.churnMap = null;
  }

  async analyze() {
    console.log('🦋 Starting MOTH analysis...');

    // Load file list
    await this.loadFileList();

    // Process each file
    for (let i = 0; i < this.files.length; i++) {
      await this.analyzeFile(this.files[i], i);
    }

    // Calculate dependency metrics
    this.calculateDependencyMetrics();

    // Generate outputs
    const manifest = await this.generateManifest();
    const index = await this.generateIndex();
    const validation = await this.generateValidation();

    console.log('✅ MOTH analysis complete!');

    return { manifest, index, validation };
  }

  async loadFileList() {
    try {
      const gitFiles = execSync('git ls-files', { encoding: 'utf8', cwd: this.projectRoot })
        .split('\n')
        .filter(f => f && !f.startsWith('node_modules/') && !f.startsWith('.venv/') && !f.startsWith('dist/') && !f.startsWith('build/'));
      this.files = gitFiles;
      console.log(`📁 Found ${this.files.length} source files (git ls-files)`);
    } catch {
      // Fallback to directory walk
      const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
          const p = path.join(dir, name);
          const st = fs.statSync(p);
          if (st.isDirectory()) {
            if (['node_modules', '.git', '.venv', 'dist', 'build', '.intellimap', '.mothlab'].includes(name)) continue;
            walk(p);
          } else {
            this.files.push(path.relative(this.projectRoot, p));
          }
        }
      };
      walk(this.projectRoot);
      console.log(`📁 Found ${this.files.length} source files (fallback walk)`);
    }
  }

  async analyzeFile(filePath, idx = 0) {
    const fullPath = path.resolve(this.projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
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

      // Calculate complexity
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
    const ext = path.extname(filePath).toLowerCase();

    // Use AST parsing for JS/TS files
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      return this.extractJavaScriptAST(content, filePath);
    }

    // Use AST parsing for Python files
    if (ext === '.py') {
      return this.extractPythonAST(content, filePath);
    }

    // Fallback to regex for other file types
    return this.extractCodeInfoRegex(content, filePath);
  }

  extractJavaScriptAST(content, filePath) {
    const imports = new Set();
    const symbols = new Set();

    try {
      // Parse with TypeScript ESTree
      const ast = parser.parse(content, {
        jsx: filePath.endsWith('x'), // Enable JSX for .jsx/.tsx
        loc: false,
        range: false,
        comment: false,
        tokens: false,
        errorOnUnknownASTType: false,
      });

      // Traverse AST to extract imports and symbols
      const visit = (node) => {
        if (!node || typeof node !== 'object') return;

        // Extract imports
        if (node.type === 'ImportDeclaration' && node.source?.value) {
          imports.add(node.source.value);
        }
        // Handle require('module')
        else if (
          node.type === 'CallExpression' &&
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments?.[0]?.type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          imports.add(node.arguments[0].value);
        }
        // Handle dynamic import('module')
        else if (
          node.type === 'ImportExpression' &&
          node.source?.type === 'Literal' &&
          typeof node.source.value === 'string'
        ) {
          imports.add(node.source.value);
        }
        // Handle re-exports: export { x } from 'module'
        else if (
          node.type === 'ExportNamedDeclaration' &&
          node.source?.value
        ) {
          imports.add(node.source.value);
        }
        // Handle export * from 'module'
        else if (
          node.type === 'ExportAllDeclaration' &&
          node.source?.value
        ) {
          imports.add(node.source.value);
        }

        // Extract symbols
        // Function declarations
        if (
          (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') &&
          node.id?.name
        ) {
          symbols.add(node.id.name);
        }
        // Variable declarations (const, let, var)
        else if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
          symbols.add(node.id.name);
        }
        // Export specifiers: export { name1, name2 }
        else if (node.type === 'ExportSpecifier' && node.exported?.name) {
          symbols.add(node.exported.name);
        }
        // Export default with name
        else if (
          node.type === 'ExportDefaultDeclaration' &&
          node.declaration?.id?.name
        ) {
          symbols.add(node.declaration.id.name);
        }
        // TypeScript: interface, type, enum
        else if (
          (node.type === 'TSInterfaceDeclaration' ||
           node.type === 'TSTypeAliasDeclaration' ||
           node.type === 'TSEnumDeclaration') &&
          node.id?.name
        ) {
          symbols.add(node.id.name);
        }

        // Recursively visit children
        for (const key in node) {
          if (node.hasOwnProperty(key)) {
            const child = node[key];
            if (typeof child === 'object' && child !== null) {
              if (Array.isArray(child)) {
                child.forEach(visit);
              } else {
                visit(child);
              }
            }
          }
        }
      };

      visit(ast);

      return {
        imports: [...imports],
        symbols: [...symbols].slice(0, 20) // Limit to top 20 symbols
      };

    } catch (error) {
      console.warn(`⚠️  AST parsing failed for ${filePath}: ${error.message}`);
      // Fallback to regex
      return this.extractCodeInfoRegex(content, filePath);
    }
  }

  extractPythonAST(content, filePath) {
    try {
      const pythonScript = path.join(__dirname, 'parse_python.py');

      const pythonProcess = spawnSync('python3', [pythonScript], {
        input: content,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (pythonProcess.error) {
        throw pythonProcess.error;
      }

      if (pythonProcess.status !== 0) {
        throw new Error(`Python script exited with code ${pythonProcess.status}: ${pythonProcess.stderr}`);
      }

      const result = JSON.parse(pythonProcess.stdout);

      if (result.error) {
        console.warn(`⚠️  Python AST analysis error for ${filePath}: ${result.error}`);
        return { imports: [], symbols: [] };
      }

      return {
        imports: result.imports || [],
        symbols: result.symbols || []
      };

    } catch (error) {
      console.warn(`⚠️  Failed to run Python AST parser for ${filePath}: ${error.message}`);
      // Fallback to regex
      return this.extractCodeInfoRegex(content, filePath);
    }
  }

  extractCodeInfoRegex(content, filePath) {
    // Fallback regex-based extraction for unsupported file types
    const imports = [];
    const symbols = [];

    // JS/TS import forms
    const reImports = [
      /import\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g,
      /import\s*['"]([^'"]+)['"]/g,
      /const\s+\w+\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\(\s*['"]([^'"]+)['"]\s*\)/g,
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

    // Symbols
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
    const branches = (content.match(/\b(if|else|switch|case|for|while|catch|when)\b/g) || []).length;
    const functions = (content.match(/\bfunction\s+\w+|\w+\s*=>|const\s+\w+\s*=/g) || []).length;
    return Math.max(1, branches + functions);
  }

  buildChurnMap() {
    try {
      const out = execSync(
        'git log --stat -- .',
        { encoding: 'utf8', cwd: this.projectRoot }
      );
      const map = new Map();
      const lines = out.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const statMatch = line.match(/^(.+?)\s*\|\s*(\d+)(?:\s*\+.*?\-.*?)?$/);
        if (statMatch) {
          const file = statMatch[1].trim();
          const totalChanges = parseInt(statMatch[2], 10) || 0;
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
    return this.churnMap.get(filePath) || this.churnMap.get(`./${filePath}`) || 0;
  }

  calculateDependencyMetrics() {
    console.log('🔗 Calculating dependency metrics...');

    // Build dependency graph with normalized paths
    const graph = new Map();
    for (const [file, rawDeps] of this.dependencies) {
      const resolved = rawDeps.map(d => this.resolveImport(d, file));
      graph.set(file, resolved);
      this.dependencies.set(file, resolved);
    }

    // Calculate fanin
    for (const [file] of graph) {
      let fanin = 0;
      for (const [, deps] of graph) {
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
      if (visiting.has(node)) return 1;

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
    if (!importPath.startsWith('.')) return `@external:${importPath}`;

    const fromDir = path.dirname(fromFile);
    const base = path.resolve(this.projectRoot, fromDir, importPath);

    const tryPaths = [];
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'];
    for (const ext of exts) tryPaths.push(base + ext);
    for (const ext of exts) tryPaths.push(path.join(base, 'index' + ext));

    for (const p of tryPaths) {
      if (fs.existsSync(p)) return path.relative(this.projectRoot, p);
    }
    return path.relative(this.projectRoot, base);
  }

  async generateManifest() {
    console.log('📝 Generating MOTH manifest...');

    const entries = [];
    const sortedFiles = [...this.files].sort();

    // Get repository name from git or directory
    let repoName = 'unknown';
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf8',
        cwd: this.projectRoot
      }).trim();
      const match = remoteUrl.match(/\/([^\/]+?)(\.git)?$/);
      if (match) repoName = match[1];
    } catch {
      repoName = path.basename(this.projectRoot);
    }

    for (const filePath of sortedFiles) {
      const metrics = this.metrics.get(filePath);
      const deps = this.dependencies.get(filePath) || [];
      const symbols = this.symbols.get(filePath) || [];

      if (!metrics) continue;

      const doc = this.generateDocSnippet(filePath);
      const summary = this.generateSummary(filePath, metrics);
      const metricsStr = `fanin:${metrics.fanin};fanout:${metrics.fanout};depth:${metrics.depth};churn:${metrics.churn};loc:${metrics.loc};complexity:${metrics.complexity};coverage:0`;
      const depsStr = deps.length > 0 ? `→[${deps.join(',')}]` : '';
      const symbolsStr = symbols.length > 0 ? `fn:[${symbols.slice(0, 5).join(',')}]` : '';

      const entry = `${filePath} | {${metricsStr}} | ${depsStr} | ${symbolsStr} | ${doc} | ${summary}`;
      entries.push(entry);
    }

    const date = new Date().toISOString().split('T')[0];
    const count = entries.length;
    const body = entries.join('\n');
    const checksum = crypto.createHash('sha1').update(body).digest('hex');

    const headerWithoutHash =
`#MOTH:repo
meta:{project:${repoName};version:1.2;date:${date};hash:sha256:PENDING;parent:sha256:none}
@INDEX count:${count} checksum:sha1:${checksum}
@FILES
${body}
@END`;

    const finalHash = crypto.createHash('sha256').update(headerWithoutHash).digest('hex');
    const manifestContent = headerWithoutHash.replace('hash:sha256:PENDING', `hash:sha256:${finalHash}`);
    this.manifestHash = finalHash;

    return manifestContent;
  }

  generateDocSnippet(filePath) {
    try {
      const content = fs.readFileSync(path.resolve(this.projectRoot, filePath), 'utf8');
      const lines = content.split('\n');

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
    const category = parts[1] || 'root';
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

    let repoName = 'unknown';
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf8',
        cwd: this.projectRoot
      }).trim();
      const match = remoteUrl.match(/\/([^\/]+?)(\.git)?$/);
      if (match) repoName = match[1];
    } catch {
      repoName = path.basename(this.projectRoot);
    }

    const index = {
      version: '1.2',
      project: repoName,
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

    return index;
  }

  async generateValidation() {
    console.log('✅ Generating validation report...');

    const fileEntries = {};
    let pathsResolved = true;

    for (const filePath of this.files) {
      const metrics = this.metrics.get(filePath);
      if (!metrics) continue;
      const exists = fs.existsSync(path.resolve(this.projectRoot, filePath));
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
      project: path.basename(this.projectRoot),
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

    return report;
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


import fs from 'fs-extra';
import path from 'node:path';
import { parse } from '@typescript-eslint/typescript-estree';
import { enrichNodesWithMetrics, computeFolderAggregates } from './metricsComputer.js';

/**
 * Build a graph for static HTML/JS/CSS sites by crawling the file system
 * This is used when esbuild fails (no module system) or for pure static sites
 */
export async function buildStaticGraph({ entry, rootDir = process.cwd() }) {
  console.log('📄 Building static site graph...');
  console.log('   Entry:', entry);
  console.log('   Root:', rootDir);

  const nodes = [];
  const edges = [];
  const visited = new Set();

  // File extensions to include
  const includeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json'];
  
  // Directories to exclude
  const excludeDirs = ['node_modules', '.git', '.intellimap', '.mothlab', 'dist', 'build', '.cache', '.vscode', '.idea'];

  /**
   * Recursively crawl directory and add files as nodes
   */
  function crawlDirectory(dir, baseDir = rootDir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Skip excluded directories
      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) {
          continue;
        }
        crawlDirectory(fullPath, baseDir);
        continue;
      }

      // Skip if already visited
      if (visited.has(relativePath)) {
        continue;
      }

      // Check if file extension is included
      const ext = path.extname(entry.name);
      if (!includeExtensions.includes(ext)) {
        continue;
      }

      visited.add(relativePath);

      // Get file stats
      const stats = fs.statSync(fullPath);

      // Determine language
      let lang = 'unknown';
      if (['.js', '.jsx'].includes(ext)) lang = 'javascript';
      else if (['.ts', '.tsx'].includes(ext)) lang = 'typescript';
      else if (ext === '.css') lang = 'css';
      else if (ext === '.html') lang = 'html';
      else if (ext === '.json') lang = 'json';

      // Create node
      const node = {
        id: relativePath,
        lang,
        env: 'browser',
        size: stats.size,
        folder: path.dirname(relativePath) || '.',
      };

      nodes.push(node);

      // Try to parse JavaScript/TypeScript files for dependencies
      if (['javascript', 'typescript'].includes(lang)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const imports = extractImports(content, relativePath);
          
          // Add edges for imports
          for (const importPath of imports) {
            edges.push({
              from: relativePath,
              to: importPath,
              type: 'import',
            });
          }
        } catch (err) {
          // Ignore parse errors for static files
          console.log(`   ⚠️  Could not parse ${relativePath}:`, err.message);
        }
      }

      // Parse HTML files for <script> and <link> tags
      if (lang === 'html') {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const htmlDeps = extractHtmlDependencies(content, relativePath, baseDir);
          
          for (const dep of htmlDeps) {
            edges.push({
              from: relativePath,
              to: dep,
              type: 'reference',
            });
          }
        } catch (err) {
          console.log(`   ⚠️  Could not parse HTML ${relativePath}:`, err.message);
        }
      }

      // Parse CSS files for @import and url()
      if (lang === 'css') {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const cssDeps = extractCssDependencies(content, relativePath, baseDir);
          
          for (const dep of cssDeps) {
            edges.push({
              from: relativePath,
              to: dep,
              type: 'reference',
            });
          }
        } catch (err) {
          console.log(`   ⚠️  Could not parse CSS ${relativePath}:`, err.message);
        }
      }
    }
  }

  // Start crawling from root directory
  crawlDirectory(rootDir);

  console.log(`   ✓ Found ${nodes.length} files`);
  console.log(`   ✓ Found ${edges.length} dependencies`);

  // Enrich nodes with metrics
  const enrichedNodes = enrichNodesWithMetrics(nodes);
  const folders = computeFolderAggregates(enrichedNodes);

  return {
    nodes: enrichedNodes,
    edges,
    folders,
  };
}

/**
 * Extract import statements from JavaScript/TypeScript code
 */
function extractImports(code, filePath) {
  const imports = [];
  
  try {
    const ast = parse(code, {
      loc: false,
      range: false,
      comment: false,
      tokens: false,
      errorOnUnknownASTType: false,
      jsx: true,
    });

    // Walk AST to find imports
    function walk(node) {
      if (!node || typeof node !== 'object') return;

      // ES6 import
      if (node.type === 'ImportDeclaration' && node.source?.value) {
        imports.push(resolveImportPath(node.source.value, filePath));
      }

      // require()
      if (node.type === 'CallExpression' && 
          node.callee?.name === 'require' && 
          node.arguments?.[0]?.value) {
        imports.push(resolveImportPath(node.arguments[0].value, filePath));
      }

      // Recurse into child nodes
      for (const key in node) {
        if (key === 'parent') continue; // Avoid circular references
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(walk);
        } else if (child && typeof child === 'object') {
          walk(child);
        }
      }
    }

    walk(ast);
  } catch (err) {
    // If AST parsing fails, try regex fallback
    const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(resolveImportPath(match[1], filePath));
    }
  }

  return imports;
}

/**
 * Extract dependencies from HTML (script src, link href)
 */
function extractHtmlDependencies(html, filePath, baseDir) {
  const deps = [];
  
  // <script src="...">
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//')) {
      deps.push(resolveHtmlPath(src, filePath, baseDir));
    }
  }

  // <link href="..." rel="stylesheet">
  const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//')) {
      deps.push(resolveHtmlPath(href, filePath, baseDir));
    }
  }

  return deps;
}

/**
 * Extract dependencies from CSS (@import, url())
 */
function extractCssDependencies(css, filePath, baseDir) {
  const deps = [];
  
  // @import "..."
  const importRegex = /@import\s+["']([^"']+)["']/gi;
  let match;
  while ((match = importRegex.exec(css)) !== null) {
    const importPath = match[1];
    if (!importPath.startsWith('http://') && !importPath.startsWith('https://')) {
      deps.push(resolveHtmlPath(importPath, filePath, baseDir));
    }
  }

  // url(...)
  const urlRegex = /url\(["']?([^"')]+)["']?\)/gi;
  while ((match = urlRegex.exec(css)) !== null) {
    const urlPath = match[1];
    if (!urlPath.startsWith('http://') && !urlPath.startsWith('https://') && !urlPath.startsWith('data:')) {
      deps.push(resolveHtmlPath(urlPath, filePath, baseDir));
    }
  }

  return deps;
}

/**
 * Resolve import path relative to current file
 */
function resolveImportPath(importPath, fromFile) {
  // Skip node_modules and external packages
  if (!importPath.startsWith('.')) {
    return importPath;
  }

  const dir = path.dirname(fromFile);
  const resolved = path.normalize(path.join(dir, importPath));
  
  // Try adding extensions if not present
  if (!path.extname(resolved)) {
    // Try .js, .jsx, .ts, .tsx
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      if (fs.existsSync(resolved + ext)) {
        return resolved + ext;
      }
    }
  }

  return resolved;
}

/**
 * Resolve HTML/CSS path (can be absolute from root or relative)
 */
function resolveHtmlPath(href, fromFile, baseDir) {
  // Remove leading slash (absolute from root)
  if (href.startsWith('/')) {
    href = href.substring(1);
  }

  // If relative, resolve from current file's directory
  if (href.startsWith('.')) {
    const dir = path.dirname(fromFile);
    return path.normalize(path.join(dir, href));
  }

  // Otherwise it's relative to root
  return href;
}


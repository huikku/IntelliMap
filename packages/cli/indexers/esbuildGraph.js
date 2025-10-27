import * as esbuild from 'esbuild';
import fs from 'fs-extra';
import path from 'node:path';
import { globSync } from 'glob';
import { enrichNodesWithMetrics, computeFolderAggregates } from './metricsComputer.js';
import { buildStaticGraph } from './staticGraph.js';

/**
 * Scan backend directory for all JS/TS files
 */
function scanBackendFiles(backendDir) {
  const nodes = [];
  const nodeMap = new Map();

  try {
    // Find all JS/TS files in backend directory
    const patterns = [
      `${backendDir}/**/*.js`,
      `${backendDir}/**/*.ts`,
      `${backendDir}/**/*.cjs`,
      `${backendDir}/**/*.mjs`,
    ];

    for (const pattern of patterns) {
      const files = globSync(pattern, { ignore: ['**/node_modules/**', '**/.git/**'] });
      for (const file of files) {
        if (!nodeMap.has(file)) {
          nodeMap.set(file, true);
          const isTS = file.endsWith('.ts');

          // Get file size in bytes
          let size = 0;
          try {
            const stats = fs.statSync(file);
            size = stats.size;
          } catch (e) {
            // If file doesn't exist, size stays 0
          }

          nodes.push({
            id: file,
            lang: isTS ? 'ts' : 'js',
            env: 'backend',
            pkg: 'root',
            folder: file.split('/')[0],
            changed: false,
            size: size,
          });
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Error scanning backend files:', error.message);
  }

  return nodes;
}

/**
 * Build JS/TS dependency graph using esbuild metafile
 */
export async function buildJSGraph(options) {
  const { entry = 'src/index.ts', nodeEntry = null } = options;

  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  const edgeSet = new Set();

  try {
    // Collect entry points
    const entryPoints = [];
    console.log('🔍 Looking for entry points:', { entry, nodeEntry });
    console.log('📁 Current directory:', process.cwd());

    if (fs.existsSync(entry)) {
      console.log('✓ Found entry:', entry);
      // Ensure entry point starts with ./ for esbuild
      const normalizedEntry = entry.startsWith('./') ? entry : `./${entry}`;
      entryPoints.push(normalizedEntry);
    } else {
      console.log('✗ Entry not found:', entry);
    }

    if (nodeEntry && fs.existsSync(nodeEntry)) {
      console.log('✓ Found nodeEntry:', nodeEntry);
      const normalizedNodeEntry = nodeEntry.startsWith('./') ? nodeEntry : `./${nodeEntry}`;
      entryPoints.push(normalizedNodeEntry);
    }

    if (entryPoints.length === 0) {
      console.warn('⚠️  No entry points found');
      return { nodes: [], edges: [] };
    }

    // Check if this is a static site (no package.json or no dependencies)
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const isStaticSite = !fs.existsSync(packageJsonPath);

    if (isStaticSite) {
      console.log('📄 Detected static site (no package.json), using file crawler...');
      return await buildStaticGraph({
        entry: entryPoints[0]?.replace(/^\.\//, ''),
        rootDir: process.cwd()
      });
    }

    // Build with esbuild to get metafile
    console.log('🔨 Building with esbuild, entryPoints:', entryPoints);

    // Build frontend and backend separately to avoid conflicts
    // Backend: .cjs, .mjs, or files with 'server' in the path/name
    const isBackendFile = (ep) => {
      return ep.endsWith('.cjs') ||
             ep.endsWith('.mjs') ||
             ep.includes('server') ||
             ep.includes('backend') ||
             ep.includes('api/');
    };

    const backendEntries = entryPoints.filter(isBackendFile);
    const frontendEntries = entryPoints.filter(ep => !isBackendFile(ep));

    let metafile = { inputs: {} };

    // Build frontend if present
    if (frontendEntries.length > 0) {
      try {
        console.log('🔨 Building frontend with esbuild');
        const frontendResult = await esbuild.build({
          entryPoints: frontendEntries,
          bundle: true,
          metafile: true,
          write: false,
          outdir: '/tmp/intellimap-esbuild-frontend',
          external: [],
          logLevel: 'silent',
          platform: 'browser',
          target: 'es2020',
          format: 'iife', // Use IIFE for static sites (more compatible)
          jsx: 'automatic',
          jsxImportSource: 'react',
          absWorkingDir: process.cwd(),
          resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
          loader: {
            '.ts': 'ts',
            '.tsx': 'tsx',
            '.js': 'js',
            '.jsx': 'jsx',
            '.svg': 'dataurl',
            '.png': 'dataurl',
            '.jpg': 'dataurl',
            '.jpeg': 'dataurl',
            '.gif': 'dataurl',
            '.webp': 'dataurl',
            '.mp4': 'dataurl',
            '.webm': 'dataurl',
            '.mp3': 'dataurl',
            '.wav': 'dataurl',
            '.woff': 'dataurl',
            '.woff2': 'dataurl',
            '.ttf': 'dataurl',
            '.eot': 'dataurl',
          },
        });
        metafile.inputs = { ...metafile.inputs, ...frontendResult.metafile.inputs };
      } catch (error) {
        console.warn('⚠️  Frontend build failed:', error.message);
        console.log('📄 Falling back to static site crawler...');

        // Fallback: Use static site crawler to find all files
        try {
          const staticGraph = await buildStaticGraph({
            entry: frontendEntries[0]?.replace(/^\.\//, ''),
            rootDir: process.cwd()
          });

          // Return the static graph directly instead of trying to merge with metafile
          console.log(`   ✓ Static crawler found ${staticGraph.nodes.length} files`);
          return staticGraph;
        } catch (staticError) {
          console.error('❌ Static crawler also failed:', staticError.message);
          // Last resort: just return the entry file
          for (const entryPoint of frontendEntries) {
            const normalizedPath = entryPoint.replace(/^\.\//, '');
            const absolutePath = path.resolve(process.cwd(), normalizedPath);

            if (fs.existsSync(absolutePath)) {
              const stats = fs.statSync(absolutePath);
              metafile.inputs[absolutePath] = {
                bytes: stats.size,
                imports: [],
              };
              console.log(`   ✓ Added static file: ${normalizedPath}`);
            }
          }
        }
      }
    }

    // Build backend if present
    if (backendEntries.length > 0) {
      console.log('🔨 Building backend with esbuild');
      const nodeBuiltins = [
        'fs', 'path', 'crypto', 'events', 'stream', 'util', 'os', 'http', 'https',
        'net', 'url', 'querystring', 'zlib', 'buffer', 'child_process', 'cluster',
        'dgram', 'dns', 'domain', 'http2', 'inspector', 'module', 'perf_hooks',
        'process', 'punycode', 'readline', 'repl', 'tls', 'tty', 'v8', 'vm',
        'worker_threads', 'assert', 'async_hooks', 'console', 'constants', 'debugger',
        'errors', 'fs/promises', 'string_decoder', 'timers', 'timers/promises',
        'node:fs', 'node:path', 'node:crypto', 'node:events',
        'node:stream', 'node:util', 'node:os', 'node:http', 'node:https', 'node:net',
        'node:url', 'node:querystring', 'node:zlib', 'node:buffer', 'node:child_process',
        'node:cluster', 'node:dgram', 'node:dns', 'node:domain', 'node:http2',
        'node:inspector', 'node:module', 'node:perf_hooks', 'node:process', 'node:punycode',
        'node:readline', 'node:repl', 'node:tls', 'node:tty', 'node:v8', 'node:vm',
        'node:worker_threads', 'node:assert', 'node:async_hooks', 'node:console',
        'node:constants', 'node:debugger', 'node:errors', 'node:fs/promises',
        'node:string_decoder', 'node:timers', 'node:timers/promises',
      ];

      let backendResult;
      try {
        backendResult = await esbuild.build({
          entryPoints: backendEntries,
          bundle: true,
          metafile: true,
          write: false,
          outdir: '/tmp/intellimap-esbuild-backend',
          external: nodeBuiltins,
          logLevel: 'silent', // Suppress all messages
          platform: 'node', // Use node platform to properly handle node_modules
          target: 'es2020',
          format: 'esm',
          jsx: 'automatic',
          jsxImportSource: 'react',
          absWorkingDir: process.cwd(),
          packages: 'external', // Don't bundle any node_modules packages
          resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.cjs', '.mjs', '.json'],
          loader: {
            '.ts': 'ts',
            '.tsx': 'tsx',
            '.js': 'js',
            '.jsx': 'jsx',
            '.cjs': 'js',
            '.mjs': 'js',
            '.svg': 'dataurl',
            '.png': 'dataurl',
            '.jpg': 'dataurl',
            '.jpeg': 'dataurl',
            '.gif': 'dataurl',
            '.webp': 'dataurl',
            '.mp4': 'dataurl',
            '.webm': 'dataurl',
            '.mp3': 'dataurl',
            '.wav': 'dataurl',
            '.woff': 'dataurl',
            '.woff2': 'dataurl',
            '.ttf': 'dataurl',
            '.eot': 'dataurl',
          },
        });
      } catch (error) {
        // esbuild throws even with logLevel: silent if there are errors
        // Try to get the metafile from the error object
        if (error.metafile) {
          console.log('📊 Backend build had errors, using partial metafile');
          backendResult = error;
        } else {
          console.warn('⚠️  Backend build failed:', error.message);
        }
      }

      if (backendResult?.metafile?.inputs) {
        console.log(`📊 Backend metafile has ${Object.keys(backendResult.metafile.inputs).length} files`);
        metafile.inputs = { ...metafile.inputs, ...backendResult.metafile.inputs };
      }
    }

    // If no metafile was generated, return empty graph
    if (!metafile || !metafile.inputs || Object.keys(metafile.inputs).length === 0) {
      console.warn('⚠️  No files analyzed, returning empty graph');
      return { nodes: [], edges: [] };
    }

    // Parse inputs from metafile
    for (const [inputPath, inputData] of Object.entries(metafile.inputs)) {
      if (inputPath.includes('node_modules')) continue;

      const nodeId = inputPath;
      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, true);

        // Determine language and environment
        const isTS = inputPath.endsWith('.ts') || inputPath.endsWith('.tsx');

        // Check if this file is from the backend entry point
        let isBackend = false;
        if (nodeEntry && entry) {
          // Get the directory containing each entry point
          const backendDir = nodeEntry.split('/').slice(0, -1).join('/');
          const frontendDir = entry.split('/').slice(0, -1).join('/');

          // Check which entry point's directory this file belongs to
          if (backendDir && inputPath.startsWith(backendDir + '/')) {
            isBackend = true;
          } else if (frontendDir && inputPath.startsWith(frontendDir + '/')) {
            isBackend = false;
          } else {
            // Fallback: check path-based heuristics
            if (inputPath.includes('/server/') || inputPath.includes('/cli/') || inputPath.includes('/backend/')) {
              isBackend = true;
            } else if (inputPath.includes('/ui/') || inputPath.includes('/frontend/') || inputPath.includes('/client/')) {
              isBackend = false;
            } else {
              // Default to backend for ambiguous files
              isBackend = true;
            }
          }
        }

        // Get file size in bytes
        let size = 0;
        try {
          const stats = fs.statSync(inputPath);
          size = stats.size;
        } catch (e) {
          // If file doesn't exist, size stays 0
        }

        nodes.push({
          id: nodeId,
          lang: isTS ? 'ts' : 'js',
          env: isBackend ? 'backend' : 'frontend',
          pkg: 'root',
          folder: inputPath.split('/')[0],
          changed: false,
          size: size,
        });
      }

      // Parse imports from input
      if (inputData.imports) {
        for (const imp of inputData.imports) {
          if (!imp.path.includes('node_modules')) {
            const edgeKey = `${nodeId}→${imp.path}`;
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              edges.push({
                from: nodeId,
                to: imp.path,
                kind: 'import',
              });
            }
          }
        }
      }
    }

    // Add backend files from filesystem scan if nodeEntry is provided
    if (nodeEntry) {
      // Get the directory containing the nodeEntry file
      // If nodeEntry is 'server.cjs', scan the root directory
      // If nodeEntry is 'backend/server.js', scan the 'backend' directory
      const nodeEntryDir = nodeEntry.includes('/') ? nodeEntry.split('/')[0] : '.';
      const backendNodes = scanBackendFiles(nodeEntryDir);

      // Add backend nodes that aren't already in the graph
      for (const backendNode of backendNodes) {
        if (!nodeMap.has(backendNode.id)) {
          nodeMap.set(backendNode.id, true);
          nodes.push(backendNode);
        }
      }
    }

    // Enrich nodes with LOC and complexity metrics
    const enrichedNodes = enrichNodesWithMetrics(nodes);

    // Compute folder aggregates
    const folders = computeFolderAggregates(enrichedNodes);

    return {
      nodes: enrichedNodes,
      edges,
      folders, // Include folder aggregates for compound nodes
    };

  } catch (error) {
    console.error('Error building JS graph:', error.message);
    return { nodes: [], edges: [], folders: [] };
  }
}


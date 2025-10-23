import * as esbuild from 'esbuild';
import fs from 'fs-extra';
import { globSync } from 'glob';

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
          nodes.push({
            id: file,
            lang: isTS ? 'ts' : 'js',
            env: 'backend',
            pkg: 'root',
            folder: file.split('/')[0],
            changed: false,
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

    // Build with esbuild to get metafile
    console.log('🔨 Building with esbuild, entryPoints:', entryPoints);
    const result = await esbuild.build({
      entryPoints,
      bundle: true,
      metafile: true,
      write: false,
      external: [],
      logLevel: 'error',
      platform: 'browser',
      target: 'es2020',
      format: 'esm',
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

    const metafile = result.metafile;

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
        if (nodeEntry) {
          const nodeEntryDir = nodeEntry.includes('/') ? nodeEntry.split('/')[0] : '.';
          isBackend = inputPath.startsWith(nodeEntryDir + '/') || inputPath === nodeEntryDir || inputPath.startsWith('./');
        }

        nodes.push({
          id: nodeId,
          lang: isTS ? 'ts' : 'js',
          env: isBackend ? 'backend' : 'frontend',
          pkg: 'root',
          folder: inputPath.split('/')[0],
          changed: false,
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

    return { nodes, edges };

  } catch (error) {
    console.error('Error building JS graph:', error.message);
    return { nodes: [], edges: [] };
  }
}


import * as esbuild from 'esbuild';
import { readFileSync } from 'fs-extra';
import { resolve } from 'path';

/**
 * Build JS/TS dependency graph using esbuild metafile
 */
export async function buildJSGraph(options) {
  const { entry = 'src/index.ts', nodeEntry = null } = options;
  
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  
  try {
    // Build with esbuild to get metafile
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      metafile: true,
      write: false,
      external: ['node_modules'],
      logLevel: 'silent',
    });
    
    const metafile = result.metafile;
    
    // Parse inputs from metafile
    for (const [inputPath, inputData] of Object.entries(metafile.inputs)) {
      if (inputPath.includes('node_modules')) continue;
      
      const nodeId = inputPath;
      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, true);
        nodes.push({
          id: nodeId,
          lang: inputPath.endsWith('.ts') || inputPath.endsWith('.tsx') ? 'ts' : 'js',
          env: nodeEntry && inputPath.includes('server') ? 'backend' : 'frontend',
          pkg: 'root',
          folder: inputPath.split('/')[0],
          changed: false,
        });
      }
      
      // Parse imports from input
      if (inputData.imports) {
        for (const imp of inputData.imports) {
          if (!imp.path.includes('node_modules')) {
            edges.push({
              from: nodeId,
              to: imp.path,
              kind: 'import',
            });
          }
        }
      }
    }
    
    return { nodes, edges };
    
  } catch (error) {
    console.error('Error building JS graph:', error.message);
    return { nodes: [], edges: [] };
  }
}


import chokidar from 'chokidar';
import { buildJSGraph } from './indexers/esbuildGraph.js';
import { buildPythonGraph } from './indexers/pythonGraph.js';
import { mergeGraphs } from './indexers/mergeGraphs.js';
import fs from 'fs-extra';
import { dirname } from 'node:path';

/**
 * Watch for file changes and rebuild graph
 */
export async function watchAndRebuild(options, onUpdate) {
  const { entry = 'src/index.ts', nodeEntry = null, pyRoot = null, out = '.intellimap/graph.json' } = options;
  
  // Determine watch paths
  const watchPaths = [];
  if (entry) {
    const entryDir = entry.split('/')[0];
    watchPaths.push(entryDir);
  }
  if (nodeEntry) {
    const nodeDir = nodeEntry.split('/')[0];
    watchPaths.push(nodeDir);
  }
  if (pyRoot) {
    watchPaths.push(pyRoot);
  }
  
  if (watchPaths.length === 0) {
    console.warn('⚠️  No watch paths configured');
    return;
  }
  
  console.log(`👀 Watching for changes in: ${watchPaths.join(', ')}`);
  
  const watcher = chokidar.watch(watchPaths, {
    ignored: /(node_modules|\.git|__pycache__|\.venv)/,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });
  
  let isRebuilding = false;
  
  const rebuild = async () => {
    if (isRebuilding) return;
    isRebuilding = true;
    
    try {
      console.log('🔄 Rebuilding graph...');
      
      const graphs = {};
      
      // Build JS/TS graph
      if (entry || nodeEntry) {
        graphs.js = await buildJSGraph({
          entry,
          nodeEntry,
        });
      }
      
      // Build Python graph
      if (pyRoot) {
        graphs.py = await buildPythonGraph({
          root: pyRoot,
        });
      }
      
      // Merge graphs
      const merged = mergeGraphs(graphs);
      
      // Write output
      fs.ensureDirSync(dirname(out));
      fs.writeFileSync(out, JSON.stringify(merged, null, 2));
      
      console.log(`✅ Graph rebuilt: ${merged.nodes.length} nodes, ${merged.edges.length} edges`);
      
      // Notify listeners
      if (onUpdate) {
        onUpdate(merged);
      }
    } catch (error) {
      console.error('❌ Error rebuilding graph:', error.message);
    } finally {
      isRebuilding = false;
    }
  };
  
  // Debounce rebuilds
  let rebuildTimeout;
  watcher.on('change', () => {
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(rebuild, 500);
  });
  
  watcher.on('add', () => {
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(rebuild, 500);
  });
  
  watcher.on('unlink', () => {
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(rebuild, 500);
  });
  
  return watcher;
}


import { buildJSGraph } from '../indexers/esbuildGraph.js';
import { buildPythonGraph } from '../indexers/pythonGraph.js';
import { mergeGraphs } from '../indexers/mergeGraphs.js';
import fs from 'fs-extra';
import { dirname } from 'node:path';

export async function indexCommand(options) {
  console.log('🔍 IntelliMap: Indexing code architecture...');
  
  try {
    const graphs = {};
    
    // Build JS/TS graph
    if (options.entry || options.nodeEntry) {
      console.log('📦 Indexing JS/TS code...');
      graphs.js = await buildJSGraph({
        entry: options.entry,
        nodeEntry: options.nodeEntry,
      });
      console.log(`   ✓ Found ${graphs.js.nodes.length} JS/TS nodes`);
    }
    
    // Build Python graph
    if (options.pyRoot) {
      console.log('🐍 Indexing Python code...');
      graphs.py = await buildPythonGraph({
        root: options.pyRoot,
        extraPath: options.pyExtraPath,
      });
      console.log(`   ✓ Found ${graphs.py.nodes.length} Python nodes`);
    }
    
    // Merge graphs
    console.log('🔗 Merging graphs...');
    const merged = mergeGraphs(graphs);
    console.log(`   ✓ Merged: ${merged.nodes.length} nodes, ${merged.edges.length} edges`);
    
    // Write output
    fs.ensureDirSync(dirname(options.out));
    fs.writeFileSync(options.out, JSON.stringify(merged, null, 2));
    console.log(`✅ Graph saved to ${options.out}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}


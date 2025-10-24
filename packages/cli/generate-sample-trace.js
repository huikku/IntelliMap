#!/usr/bin/env node

/**
 * Sample Runtime Trace Generator
 * 
 * This script generates a sample runtime trace file for testing.
 * In production, you would instrument your code with coverage tools like:
 * - JavaScript/TypeScript: nyc, istanbul, c8, or V8 coverage API
 * - Python: coverage.py, sys.settrace
 * 
 * Usage:
 *   node packages/cli/generate-sample-trace.js
 */

import fs from 'fs-extra';
import { resolve } from 'node:path';

async function generateSampleTrace() {
  console.log('🔬 Generating sample runtime trace...');

  // Load the static graph to base our trace on
  const graphPath = resolve(process.cwd(), '.intellimap/graph.json');
  
  if (!fs.existsSync(graphPath)) {
    console.error('❌ No static graph found. Run `npm run index` first.');
    process.exit(1);
  }

  const staticGraph = await fs.readJson(graphPath);
  
  // Simulate runtime execution by randomly selecting edges and nodes
  // In real usage, this data comes from actual test/production runs
  
  const executedEdges = [];
  const executedNodes = new Map();

  // Simulate 70% edge coverage
  staticGraph.edges.forEach(edge => {
    if (Math.random() < 0.7) {
      const count = Math.floor(Math.random() * 100) + 1;
      const avgTime = Math.random() * 10; // 0-10ms
      
      executedEdges.push({
        from: edge.from,
        to: edge.to,
        count,
        totalTime: count * avgTime,
        avgTime,
      });

      // Track node executions
      [edge.from, edge.to].forEach(nodeId => {
        if (!executedNodes.has(nodeId)) {
          executedNodes.set(nodeId, {
            id: nodeId,
            executionCount: 0,
            totalTime: 0,
          });
        }
        const node = executedNodes.get(nodeId);
        node.executionCount += count;
        node.totalTime += avgTime * count;
      });
    }
  });

  // Calculate coverage for each node
  const nodes = Array.from(executedNodes.values()).map(node => ({
    ...node,
    coverage: Math.random() * 100, // Simulated line coverage %
  }));

  // Add some dynamic edges (runtime-only, not in static graph)
  const dynamicEdges = [];
  if (staticGraph.nodes.length > 5) {
    for (let i = 0; i < 3; i++) {
      const from = staticGraph.nodes[Math.floor(Math.random() * staticGraph.nodes.length)].id;
      const to = staticGraph.nodes[Math.floor(Math.random() * staticGraph.nodes.length)].id;
      
      if (from !== to) {
        dynamicEdges.push({
          from,
          to,
          count: Math.floor(Math.random() * 20) + 1,
          totalTime: Math.random() * 50,
          avgTime: Math.random() * 5,
        });
      }
    }
  }

  const trace = {
    metadata: {
      timestamp: Date.now(),
      branch: 'main',
      commit: 'abc123',
      runId: `sample-${Date.now()}`,
      environment: 'test',
      description: 'Sample runtime trace for testing',
    },
    edges: [...executedEdges, ...dynamicEdges],
    nodes,
  };

  // Save trace file
  const runtimeDir = resolve(process.cwd(), '.intellimap/runtime');
  await fs.ensureDir(runtimeDir);
  
  const traceFile = resolve(runtimeDir, `trace-${Date.now()}.json`);
  await fs.writeJson(traceFile, trace, { spaces: 2 });

  console.log(`✅ Sample trace generated: ${traceFile}`);
  console.log(`📊 Stats:`);
  console.log(`   - Executed edges: ${executedEdges.length}/${staticGraph.edges.length} (${((executedEdges.length / staticGraph.edges.length) * 100).toFixed(1)}%)`);
  console.log(`   - Executed nodes: ${nodes.length}/${staticGraph.nodes.length} (${((nodes.length / staticGraph.nodes.length) * 100).toFixed(1)}%)`);
  console.log(`   - Dynamic edges: ${dynamicEdges.length}`);
  console.log('');
  console.log('💡 Now run the server and click "⚡ Runtime Analysis" in the UI!');
}

generateSampleTrace().catch(console.error);


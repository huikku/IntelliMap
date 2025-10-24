#!/usr/bin/env node

/**
 * Convert NYC/Istanbul coverage data to IntelliMap runtime trace format
 * 
 * Usage:
 *   1. Run tests with coverage: nyc npm test
 *   2. Run this script: node scripts/nyc-to-intellimap.js
 *   3. View in IntelliMap: npm run serve → click "⚡ Runtime Analysis"
 */

import fs from 'fs-extra';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';

async function convertNYCToIntelliMap() {
  console.log('🔬 Converting NYC coverage to IntelliMap runtime trace...');

  // Check if NYC coverage exists
  const nycCoveragePath = resolve('.nyc_output/coverage-final.json');
  if (!fs.existsSync(nycCoveragePath)) {
    console.error('❌ No NYC coverage found at .nyc_output/coverage-final.json');
    console.error('   Run your tests with coverage first: nyc npm test');
    process.exit(1);
  }

  // Check if static graph exists
  const graphPath = resolve('.intellimap/graph.json');
  if (!fs.existsSync(graphPath)) {
    console.error('❌ No static graph found at .intellimap/graph.json');
    console.error('   Run indexing first: npm run index');
    process.exit(1);
  }

  // Read NYC coverage data
  const nycData = await fs.readJson(nycCoveragePath);
  const staticGraph = await fs.readJson(graphPath);
  
  const nodes = [];
  const edges = [];
  const executionMap = new Map();
  const cwd = process.cwd();

  console.log(`📊 Processing ${Object.keys(nycData).length} files from NYC coverage...`);

  // Process each file in coverage
  for (const [filePath, coverage] of Object.entries(nycData)) {
    // Convert to relative path
    let relativePath = filePath;
    if (filePath.startsWith(cwd)) {
      relativePath = relative(cwd, filePath);
    }
    
    // Calculate coverage percentage
    const { s: statements, f: functions, b: branches } = coverage;
    
    const totalStatements = Object.keys(statements || {}).length;
    const executedStatements = Object.values(statements || {}).filter(count => count > 0).length;
    
    const totalFunctions = Object.keys(functions || {}).length;
    const executedFunctions = Object.values(functions || {}).filter(count => count > 0).length;
    
    const totalBranches = Object.keys(branches || {}).length;
    const executedBranches = Object.values(branches || {}).filter(counts => counts.some(c => c > 0)).length;
    
    // Overall coverage (weighted average)
    const total = totalStatements + totalFunctions + totalBranches;
    const executed = executedStatements + executedFunctions + executedBranches;
    const coveragePercent = total > 0 ? (executed / total) * 100 : 0;
    
    // Count total executions (sum of all statement hits)
    const executionCount = Object.values(statements || {}).reduce((sum, count) => sum + count, 0);
    
    // Estimate execution time (very rough: 0.01ms per statement execution)
    const totalTime = executionCount * 0.01;
    
    nodes.push({
      id: relativePath,
      executionCount,
      totalTime,
      coverage: coveragePercent,
    });
    
    executionMap.set(relativePath, executionCount);
  }

  console.log(`✅ Processed ${nodes.length} nodes with coverage data`);

  // Infer edges from static graph + execution data
  console.log('🔗 Inferring edge execution from static graph...');
  
  staticGraph.edges.forEach(edge => {
    const fromCount = executionMap.get(edge.from) || 0;
    const toCount = executionMap.get(edge.to) || 0;
    
    // If both files were executed, assume the edge was traversed
    if (fromCount > 0 && toCount > 0) {
      // Estimate: edge traversed = min of the two execution counts
      const count = Math.min(fromCount, toCount);
      const avgTime = 0.001; // 0.001ms per import (very fast)
      
      edges.push({
        from: edge.from,
        to: edge.to,
        count,
        totalTime: count * avgTime,
        avgTime,
      });
    }
  });

  console.log(`✅ Inferred ${edges.length} executed edges`);

  // Get git metadata
  let branch = 'unknown';
  let commit = 'unknown';
  
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (err) {
    console.warn('⚠️  Could not get git metadata:', err.message);
  }

  // Create trace
  const trace = {
    metadata: {
      timestamp: Date.now(),
      branch,
      commit,
      runId: `nyc-${Date.now()}`,
      environment: process.env.NODE_ENV || 'test',
      description: 'NYC/Istanbul coverage data',
      source: 'nyc',
    },
    edges,
    nodes,
  };

  // Save trace
  const runtimeDir = resolve('.intellimap/runtime');
  await fs.ensureDir(runtimeDir);
  const traceFile = resolve(runtimeDir, `trace-${Date.now()}.json`);
  await fs.writeJson(traceFile, trace, { spaces: 2 });

  console.log('');
  console.log(`✅ Converted NYC coverage to IntelliMap trace!`);
  console.log(`📁 Saved to: ${traceFile}`);
  console.log('');
  console.log('📊 Stats:');
  console.log(`   - Nodes with coverage: ${nodes.length}`);
  console.log(`   - Edges executed: ${edges.length}`);
  console.log(`   - Branch: ${branch}`);
  console.log(`   - Commit: ${commit}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Start server: npm run serve');
  console.log('   2. Open http://localhost:7676');
  console.log('   3. Click "⚡ Runtime Analysis" in the Analysis tab');
  console.log('');
}

convertNYCToIntelliMap().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});


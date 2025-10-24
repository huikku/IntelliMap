#!/usr/bin/env node

/**
 * Convert V8 coverage to IntelliMap runtime trace format
 * 
 * Usage:
 *   node scripts/v8-to-intellimap.js [coverage-dir] [output-dir]
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertV8Coverage(coverageDir, runtimeDir, cwd) {
  console.log('📊 Converting V8 coverage to IntelliMap format...');

  // Find all coverage files
  const files = await fs.readdir(coverageDir);
  const coverageFiles = files.filter(f => f.startsWith('coverage-') && f.endsWith('.json'));

  if (coverageFiles.length === 0) {
    throw new Error('No coverage data found. Make sure your app actually ran.');
  }

  console.log(`📂 Found ${coverageFiles.length} coverage files`);

  // Merge all coverage data
  const allCoverage = [];
  for (const file of coverageFiles) {
    const data = await fs.readJson(path.join(coverageDir, file));
    if (data.result) {
      allCoverage.push(...data.result);
    }
  }

  console.log(`📊 Processing ${allCoverage.length} files...`);

  // Load static graph
  const graphPath = path.join(cwd, '.intellimap', 'graph.json');
  if (!await fs.pathExists(graphPath)) {
    throw new Error('No static graph found. Run "npm run index" first.');
  }
  const staticGraph = await fs.readJson(graphPath);

  // Get git metadata
  let branch = 'unknown';
  let commit = 'unknown';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
    commit = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch (e) {
    // Not a git repo or git not available
  }

  // Process coverage data
  const nodes = [];
  const executionMap = new Map();

  for (const fileCoverage of allCoverage) {
    const url = fileCoverage.url;
    if (!url || url.startsWith('node:') || url.includes('node_modules')) {
      continue; // Skip internal modules
    }

    // Convert file:// URL to relative path
    let filePath = url;
    if (url.startsWith('file://')) {
      filePath = fileURLToPath(url);
    }
    
    // Make relative to cwd
    const relativePath = path.relative(cwd, filePath);
    if (relativePath.startsWith('..')) {
      continue; // Skip files outside project
    }

    // Calculate coverage from V8 ranges
    let totalChars = 0;
    let coveredChars = 0;
    
    for (const func of fileCoverage.functions || []) {
      for (const range of func.ranges || []) {
        const rangeSize = range.endOffset - range.startOffset;
        totalChars += rangeSize;
        if (range.count > 0) {
          coveredChars += rangeSize;
        }
      }
    }

    const coverage = totalChars > 0 ? (coveredChars / totalChars) * 100 : 0;
    const executionCount = fileCoverage.functions?.[0]?.ranges?.[0]?.count || 0;

    executionMap.set(relativePath, {
      executionCount,
      coverage: Math.round(coverage * 100) / 100,
    });

    console.log(`  ✓ ${relativePath}: ${executionCount} executions, ${coverage.toFixed(2)}% coverage`);
  }

  console.log(`✅ Found execution data for ${executionMap.size} files`);

  // Create nodes from static graph with execution data
  for (const node of staticGraph.nodes) {
    // Try exact match first
    let execData = executionMap.get(node.id);

    // If no exact match, try matching by filename (for cases where paths differ)
    if (!execData) {
      for (const [execPath, data] of executionMap.entries()) {
        if (node.id.endsWith(execPath) || execPath.endsWith(node.id)) {
          execData = data;
          console.log(`  📍 Matched ${node.id} with ${execPath}`);
          break;
        }
      }
    }

    nodes.push({
      id: node.id,
      executionCount: execData?.executionCount || 0,
      totalTime: 0, // V8 coverage doesn't provide timing
      coverage: execData?.coverage || 0,
    });
  }

  // Create runtime trace
  const trace = {
    metadata: {
      timestamp: Date.now(),
      branch,
      commit,
      runId: `runtime-${Date.now()}`,
      environment: 'runtime',
      description: 'V8 runtime coverage from actual app execution',
      source: 'v8-runtime',
    },
    edges: [], // We'll infer edges from static graph
    nodes,
  };

  // Save trace
  const traceFile = path.join(runtimeDir, `trace-${Date.now()}.json`);
  await fs.writeJson(traceFile, trace, { spaces: 2 });

  console.log(`✅ Processed ${nodes.filter(n => n.executionCount > 0).length} executed files`);
  console.log(`📁 Saved to: ${traceFile}`);
  
  return traceFile;
}

// Main
async function main() {
  const cwd = process.cwd();
  const coverageDir = process.argv[2] || path.join(cwd, '.intellimap', 'v8-coverage');
  const runtimeDir = process.argv[3] || path.join(cwd, '.intellimap', 'runtime');
  const graphPath = process.argv[4]; // Optional: specific graph path

  try {
    await fs.ensureDir(runtimeDir);
    const traceFile = await convertV8Coverage(coverageDir, runtimeDir, cwd);
    
    console.log('');
    console.log('✅ Runtime analysis complete!');
    console.log('');
    console.log('📊 Next steps:');
    console.log('   1. npm run serve');
    console.log('   2. Open http://localhost:7676');
    console.log('   3. Click "⚡ Runtime Analysis"');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


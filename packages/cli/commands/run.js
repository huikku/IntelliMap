#!/usr/bin/env node

/**
 * Run command - Execute your app with runtime analysis
 * 
 * This command runs your application with V8 coverage enabled,
 * capturing actual runtime execution data (not just test coverage).
 * 
 * Usage:
 *   intellimap run <command>
 *   intellimap run "npm start"
 *   intellimap run "node server.js"
 *   intellimap run "npm run dev"
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { convertV8ToRuntime } from '../runtime/enhanced-v8-converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run user's app with V8 coverage enabled
 */
export async function runWithCoverage(command, options = {}) {
  const cwd = options.cwd || process.cwd();
  const coverageDir = path.join(cwd, '.intellimap', 'v8-coverage');
  const runtimeDir = path.join(cwd, '.intellimap', 'runtime');

  // Ensure directories exist
  await fs.ensureDir(coverageDir);
  await fs.ensureDir(runtimeDir);

  console.log('🚀 Starting your app with runtime analysis...');
  console.log(`📂 Runtime data will be saved to: ${runtimeDir}`);
  console.log(`📊 Command: ${command}`);
  console.log('');
  console.log('💡 Instrumentation will track:');
  console.log('   - Module loads (which files are imported)');
  console.log('   - Runtime errors (exceptions, rejections)');
  console.log('   - Performance (load times)');
  console.log('');
  console.log('💡 Use your app normally, then press Ctrl+C to stop');
  console.log('');

  // Parse command (handle quoted commands like "npm start")
  const isQuoted = command.startsWith('"') || command.startsWith("'");
  let cmd, args;
  
  if (isQuoted) {
    // Remove quotes and split
    const cleaned = command.replace(/^["']|["']$/g, '');
    const parts = cleaned.split(' ');
    cmd = parts[0];
    args = parts.slice(1);
  } else {
    const parts = command.split(' ');
    cmd = parts[0];
    args = parts.slice(1);
  }

  // Use V8 coverage (reliable and works with all Node.js apps)
  const env = {
    ...process.env,
    NODE_V8_COVERAGE: coverageDir,
  };

  // Spawn the user's app
  const child = spawn(cmd, args, {
    cwd,
    env,
    stdio: 'inherit', // Pass through stdin/stdout/stderr
    shell: true,
  });

  // Handle process exit
  let exitCode = 0;
  
  const cleanup = async () => {
    console.log('');
    console.log('🛑 Stopping app and processing runtime data...');

    // Send SIGINT to child process (allows graceful shutdown)
    child.kill('SIGINT');

    // Wait for V8 coverage to be written
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Convert V8 coverage to enhanced runtime trace
    try {
      const staticGraphPath = path.join(cwd, '.intellimap', 'graph.json');
      await convertV8ToRuntime(coverageDir, runtimeDir, cwd, staticGraphPath);

      console.log('✅ Runtime analysis complete!');
      console.log('');
      console.log('📊 Next steps:');
      console.log('   1. npm run serve');
      console.log('   2. Open http://localhost:7676');
      console.log('   3. Click "⚡ Runtime Analysis"');
      console.log('');
    } catch (error) {
      console.error('❌ Error processing runtime data:', error.message);
      exitCode = 1;
    }

    process.exit(exitCode);
  };

  // Handle Ctrl+C
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Handle child process exit
  child.on('exit', async (code) => {
    if (code !== null && code !== 0) {
      console.error(`❌ App exited with code ${code}`);
      exitCode = code;
    }
    await cleanup();
  });

  child.on('error', (error) => {
    console.error('❌ Error running app:', error.message);
    exitCode = 1;
  });
}

/**
 * Convert V8 coverage to IntelliMap runtime trace format
 */
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
    throw new Error('No static graph found. Run "intellimap index" first.');
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
  }

  // Create nodes from static graph with execution data
  for (const node of staticGraph.nodes) {
    const execData = executionMap.get(node.id);
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
}

/**
 * CLI handler
 */
export async function runCommand(args) {
  const command = args.join(' ');
  
  if (!command) {
    console.error('❌ No command specified');
    console.error('');
    console.error('Usage:');
    console.error('  intellimap run <command>');
    console.error('');
    console.error('Examples:');
    console.error('  intellimap run "npm start"');
    console.error('  intellimap run "node server.js"');
    console.error('  intellimap run "npm run dev"');
    process.exit(1);
  }

  await runWithCoverage(command);
}


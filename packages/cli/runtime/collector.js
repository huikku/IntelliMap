/**
 * IntelliMap Runtime Data Collector
 * 
 * Collects runtime data from the instrumentation layer and saves it to disk.
 * Handles batching, error tracking, and graceful shutdown.
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import async_hooks from 'async_hooks';

// Access runtime data from loader
const getRuntimeData = () => global.__intellimap_runtime || {
  modules: new Map(),
  edges: new Map(),
  errors: [],
  startTime: Date.now(),
};

// Performance tracking
const perfData = {
  asyncOps: new Map(), // asyncId -> { type, startTime, parentId }
  eventLoopLag: [],
};

// Track async operations
const asyncHook = async_hooks.createHook({
  init(asyncId, type, triggerAsyncId) {
    perfData.asyncOps.set(asyncId, {
      type,
      startTime: performance.now(),
      parentId: triggerAsyncId,
    });
  },
  destroy(asyncId) {
    perfData.asyncOps.delete(asyncId);
  },
});

// Enable async tracking
asyncHook.enable();

// Track event loop lag
let lastCheck = performance.now();
setInterval(() => {
  const now = performance.now();
  const lag = now - lastCheck - 100; // Expected 100ms interval
  if (lag > 10) { // Only track significant lag
    perfData.eventLoopLag.push({
      timestamp: Date.now(),
      lag,
    });
  }
  lastCheck = now;
}, 100);

// Track uncaught exceptions
process.on('uncaughtException', (error, origin) => {
  const runtimeData = getRuntimeData();
  runtimeData.errors.push({
    type: 'uncaught_exception',
    origin,
    message: error.message,
    stack: error.stack,
    timestamp: Date.now(),
  });
  
  console.error('💥 Uncaught exception captured:', error.message);
  
  // Save data before crashing
  saveRuntimeDataSync();
  
  // Re-throw to maintain normal error behavior
  throw error;
});

// Track unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  const runtimeData = getRuntimeData();
  runtimeData.errors.push({
    type: 'unhandled_rejection',
    message: reason?.message || String(reason),
    stack: reason?.stack,
    timestamp: Date.now(),
  });
  
  console.error('💥 Unhandled rejection captured:', reason);
});

// Track warnings
process.on('warning', (warning) => {
  const runtimeData = getRuntimeData();
  runtimeData.errors.push({
    type: 'warning',
    name: warning.name,
    message: warning.message,
    stack: warning.stack,
    timestamp: Date.now(),
  });
});

/**
 * Save runtime data synchronously (for process exit)
 */
function saveRuntimeDataSync() {
  try {
    const cwd = process.cwd();
    const runtimeDir = path.join(cwd, '.intellimap', 'runtime');
    fs.ensureDirSync(runtimeDir);
    
    const runtimeData = getRuntimeData();
    
    // Get git metadata
    let branch = 'unknown';
    let commit = 'unknown';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
      commit = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8' }).trim();
    } catch (e) {
      // Not a git repo
    }
    
    // Calculate event loop lag stats
    const lagStats = perfData.eventLoopLag.length > 0 ? {
      count: perfData.eventLoopLag.length,
      max: Math.max(...perfData.eventLoopLag.map(l => l.lag)),
      avg: perfData.eventLoopLag.reduce((sum, l) => sum + l.lag, 0) / perfData.eventLoopLag.length,
    } : null;
    
    // Create trace
    const trace = {
      metadata: {
        timestamp: Date.now(),
        startTime: runtimeData.startTime,
        duration: Date.now() - runtimeData.startTime,
        branch,
        commit,
        runId: `runtime-${Date.now()}`,
        environment: 'runtime-instrumented',
        source: 'esm-loader',
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
      },
      modules: Array.from(runtimeData.modules.values()),
      edges: Array.from(runtimeData.edges.values()),
      errors: runtimeData.errors,
      performance: {
        eventLoopLag: lagStats,
        asyncOpsActive: perfData.asyncOps.size,
      },
    };
    
    const traceFile = path.join(runtimeDir, `trace-${Date.now()}.json`);
    fs.writeJsonSync(traceFile, trace, { spaces: 2 });
    
    console.log('');
    console.log('📊 Runtime instrumentation data saved!');
    console.log(`📁 ${traceFile}`);
    console.log('');
    console.log('📈 Summary:');
    console.log(`   - Modules loaded: ${runtimeData.modules.size}`);
    console.log(`   - Import edges: ${runtimeData.edges.size}`);
    console.log(`   - Errors captured: ${runtimeData.errors.length}`);
    if (lagStats) {
      console.log(`   - Event loop lag: max ${lagStats.max.toFixed(2)}ms, avg ${lagStats.avg.toFixed(2)}ms`);
    }
    console.log('');
    
    return traceFile;
  } catch (error) {
    console.error('❌ Error saving runtime data:', error.message);
    return null;
  }
}

/**
 * Save runtime data asynchronously
 */
async function saveRuntimeData() {
  return saveRuntimeDataSync();
}

// Save on exit
process.on('exit', () => {
  saveRuntimeDataSync();
});

// Save on SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Stopping runtime instrumentation...');
  saveRuntimeDataSync();
  process.exit(0);
});

// Save on SIGTERM
process.on('SIGTERM', () => {
  console.log('');
  console.log('🛑 Stopping runtime instrumentation...');
  saveRuntimeDataSync();
  process.exit(0);
});

// Export for testing
export { saveRuntimeData, saveRuntimeDataSync };

console.log('📊 Runtime data collector active');
console.log('   Tracking: errors, performance, event loop lag');


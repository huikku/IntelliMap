/**
 * Runtime Instrumentation for Node.js
 * 
 * This module instruments Node.js applications to capture:
 * - Module loads (which files are actually imported)
 * - Function executions (which functions are called)
 * - Errors (runtime exceptions)
 * - Performance (execution times)
 * 
 * Based on the IntelliMap Runtime Analysis Plan
 */

import Module from 'module';
import fs from 'fs-extra';
import path from 'path';
import { performance } from 'perf_hooks';

// Runtime data collection
const runtimeData = {
  metadata: {
    startTime: Date.now(),
    pid: process.pid,
  },
  modules: new Map(), // path -> { loadTime, execCount, errors: [] }
  edges: new Map(),   // from|to -> { count, totalTime }
  errors: [],
};

// Track current module being executed
let currentModule = null;

/**
 * Instrument module loading
 */
const originalRequire = Module.prototype.require;
Module.prototype.require = function instrumentedRequire(id) {
  const parentModule = this.filename;
  const startTime = performance.now();
  
  try {
    // Call original require
    const result = originalRequire.apply(this, arguments);
    
    // Get the resolved module path
    const resolvedPath = Module._resolveFilename(id, this);
    
    // Skip node_modules and built-in modules
    if (!resolvedPath.includes('node_modules') && !resolvedPath.startsWith('node:')) {
      const loadTime = performance.now() - startTime;
      
      // Track module load
      if (!runtimeData.modules.has(resolvedPath)) {
        runtimeData.modules.set(resolvedPath, {
          loadTime,
          execCount: 0,
          errors: [],
          firstLoad: Date.now(),
        });
      }
      
      // Track edge (import relationship)
      if (parentModule && !parentModule.includes('node_modules')) {
        const edgeKey = `${parentModule}|${resolvedPath}`;
        if (!runtimeData.edges.has(edgeKey)) {
          runtimeData.edges.set(edgeKey, {
            count: 0,
            totalTime: 0,
          });
        }
        const edge = runtimeData.edges.get(edgeKey);
        edge.count++;
        edge.totalTime += loadTime;
      }
    }
    
    return result;
  } catch (error) {
    // Track error
    runtimeData.errors.push({
      type: 'module_load_error',
      module: id,
      parent: parentModule,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });
    throw error;
  }
};

/**
 * Track uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  runtimeData.errors.push({
    type: 'uncaught_exception',
    module: currentModule,
    message: error.message,
    stack: error.stack,
    timestamp: Date.now(),
  });
  
  // Don't prevent the error from crashing the app
  // Just log it and re-throw
  console.error('💥 Runtime error captured:', error.message);
  throw error;
});

/**
 * Track unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  runtimeData.errors.push({
    type: 'unhandled_rejection',
    module: currentModule,
    message: reason?.message || String(reason),
    stack: reason?.stack,
    timestamp: Date.now(),
  });
  
  console.error('💥 Unhandled rejection captured:', reason);
});

/**
 * Save runtime data on exit
 */
async function saveRuntimeData() {
  const cwd = process.cwd();
  const runtimeDir = path.join(cwd, '.intellimap', 'runtime');
  await fs.ensureDir(runtimeDir);
  
  // Convert Maps to arrays for JSON
  const trace = {
    metadata: {
      ...runtimeData.metadata,
      endTime: Date.now(),
      duration: Date.now() - runtimeData.metadata.startTime,
      environment: 'runtime-instrumented',
      source: 'node-instrumentation',
    },
    modules: Array.from(runtimeData.modules.entries()).map(([path, data]) => ({
      path,
      ...data,
    })),
    edges: Array.from(runtimeData.edges.entries()).map(([key, data]) => {
      const [from, to] = key.split('|');
      return {
        from,
        to,
        ...data,
      };
    })),
    errors: runtimeData.errors,
  };
  
  const traceFile = path.join(runtimeDir, `trace-instrumented-${Date.now()}.json`);
  await fs.writeJson(traceFile, trace, { spaces: 2 });
  
  console.log('');
  console.log('📊 Runtime instrumentation data saved!');
  console.log(`📁 ${traceFile}`);
  console.log('');
  console.log('📈 Summary:');
  console.log(`   - Modules loaded: ${runtimeData.modules.size}`);
  console.log(`   - Import edges: ${runtimeData.edges.size}`);
  console.log(`   - Errors captured: ${runtimeData.errors.length}`);
  console.log('');
}

process.on('exit', () => {
  // Synchronous save on exit
  const cwd = process.cwd();
  const runtimeDir = path.join(cwd, '.intellimap', 'runtime');
  fs.ensureDirSync(runtimeDir);
  
  const trace = {
    metadata: {
      ...runtimeData.metadata,
      endTime: Date.now(),
      duration: Date.now() - runtimeData.metadata.startTime,
      environment: 'runtime-instrumented',
      source: 'node-instrumentation',
    },
    modules: Array.from(runtimeData.modules.entries()).map(([path, data]) => ({
      path,
      ...data,
    })),
    edges: Array.from(runtimeData.edges.entries()).map(([key, data]) => {
      const [from, to] = key.split('|');
      return {
        from,
        to,
        ...data,
      };
    })),
    errors: runtimeData.errors,
  };
  
  const traceFile = path.join(runtimeDir, `trace-instrumented-${Date.now()}.json`);
  fs.writeJsonSync(traceFile, trace, { spaces: 2 });
  
  console.log('');
  console.log('📊 Runtime instrumentation data saved!');
  console.log(`📁 ${traceFile}`);
  console.log('');
  console.log('📈 Summary:');
  console.log(`   - Modules loaded: ${runtimeData.modules.size}`);
  console.log(`   - Import edges: ${runtimeData.edges.size}`);
  console.log(`   - Errors captured: ${runtimeData.errors.length}`);
});

process.on('SIGINT', async () => {
  await saveRuntimeData();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await saveRuntimeData();
  process.exit(0);
});

console.log('🔬 IntelliMap runtime instrumentation active');
console.log('   Tracking: module loads, errors, performance');
console.log('');


/**
 * IntelliMap Runtime Instrumentation Loader
 * 
 * This is a Node.js ESM loader hook that instruments module loading
 * to capture runtime behavior without modifying source code.
 * 
 * Usage:
 *   node --loader ./packages/cli/runtime/loader.js your-app.js
 * 
 * Based on: https://nodejs.org/api/esm.html#loaders
 */

import { fileURLToPath } from 'url';
import { dirname, relative } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Runtime data collection (shared with collector)
const runtimeData = {
  modules: new Map(),
  edges: new Map(),
  errors: [],
  startTime: Date.now(),
};

// Export for collector to access
global.__intellimap_runtime = runtimeData;

/**
 * Resolve hook - intercept module resolution
 */
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  
  // Track the import edge
  if (context.parentURL && result.url) {
    try {
      const parentPath = fileURLToPath(context.parentURL);
      const childPath = fileURLToPath(result.url);
      
      // Skip node_modules and built-ins
      if (!parentPath.includes('node_modules') && 
          !childPath.includes('node_modules') &&
          !result.url.startsWith('node:')) {
        
        const cwd = process.cwd();
        const from = relative(cwd, parentPath);
        const to = relative(cwd, childPath);
        
        const edgeKey = `${from}|${to}`;
        if (!runtimeData.edges.has(edgeKey)) {
          runtimeData.edges.set(edgeKey, {
            from,
            to,
            count: 0,
            firstSeen: Date.now(),
          });
        }
        runtimeData.edges.get(edgeKey).count++;
      }
    } catch (e) {
      // Ignore errors (e.g., non-file URLs)
    }
  }
  
  return result;
}

/**
 * Load hook - intercept module loading
 */
export async function load(url, context, nextLoad) {
  const startTime = performance.now();
  
  try {
    const result = await nextLoad(url, context);
    
    // Track module load
    if (url.startsWith('file://')) {
      try {
        const filePath = fileURLToPath(url);
        
        // Skip node_modules and built-ins
        if (!filePath.includes('node_modules')) {
          const cwd = process.cwd();
          const relativePath = relative(cwd, filePath);
          
          if (!relativePath.startsWith('..')) {
            const loadTime = performance.now() - startTime;
            
            if (!runtimeData.modules.has(relativePath)) {
              runtimeData.modules.set(relativePath, {
                path: relativePath,
                loadTime,
                loadCount: 0,
                firstLoad: Date.now(),
                size: 0,
              });
              
              // Get file size
              try {
                const stats = fs.statSync(filePath);
                runtimeData.modules.get(relativePath).size = stats.size;
              } catch (e) {
                // Ignore
              }
            }
            
            const module = runtimeData.modules.get(relativePath);
            module.loadCount++;
            module.loadTime = Math.max(module.loadTime, loadTime);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    return result;
  } catch (error) {
    // Track load error
    runtimeData.errors.push({
      type: 'module_load_error',
      url,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });
    throw error;
  }
}

console.log('🔬 IntelliMap runtime instrumentation active (ESM loader)');


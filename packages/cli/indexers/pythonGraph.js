import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichNodesWithMetrics, computeFolderAggregates } from './metricsComputer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Build Python dependency graph by spawning Python indexer script
 */
export async function buildPythonGraph(options) {
  const { root = 'backend', extraPath = null } = options;

  return new Promise((resolve, reject) => {
    const pythonScript = join(__dirname, 'python_indexer.py');

    const args = [pythonScript, '--root', root];
    if (extraPath) {
      args.push('--extra-path', extraPath);
    }

    const python = spawn('python3', args);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python indexer failed: ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);

          // Enrich nodes with LOC and complexity metrics
          const enrichedNodes = enrichNodesWithMetrics(result.nodes || []);

          // Compute folder aggregates
          const folders = computeFolderAggregates(enrichedNodes);

          resolve({
            nodes: enrichedNodes,
            edges: result.edges || [],
            folders,
          });
        } catch (error) {
          reject(new Error(`Failed to parse Python indexer output: ${error.message}`));
        }
      }
    });
  });
}

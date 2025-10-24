import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupSSE, notifyClients } from './reload.js';
import { buildJSGraph } from '../cli/indexers/esbuildGraph.js';
import { buildPythonGraph } from '../cli/indexers/pythonGraph.js';
import { mergeGraphs } from '../cli/indexers/mergeGraphs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 7676;
const watch = process.env.WATCH === 'true';

// Setup SSE for live reload
setupSSE(app);

app.use(cors());
app.use(express.json());

// Serve graph.json
app.get('/graph', (req, res) => {
  try {
    const graphPath = resolve(process.cwd(), '.intellimap/graph.json');
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    res.json(graph);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load graph', message: error.message });
  }
});

// Browse directories
app.get('/api/browse', (req, res) => {
  try {
    const path = req.query.path || '/';
    const fullPath = resolve(path);

    // Check if path exists and is a directory
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const items = fs.readdirSync(fullPath, { withFileTypes: true })
      .filter(item => {
        // Skip hidden files and system files
        if (item.name.startsWith('.')) return false;
        return true;
      })
      .map(item => {
        try {
          return {
            name: item.name,
            path: join(fullPath, item.name),
            isDirectory: item.isDirectory(),
            isFile: item.isFile(),
          };
        } catch {
          return null;
        }
      })
      .filter(item => item !== null)
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return b.isDirectory - a.isDirectory;
        return a.name.localeCompare(b.name);
      });

    res.json({ path: fullPath, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to browse directory', message: error.message });
  }
});

// Detect entry points in a repository
app.get('/api/detect-entry-points', (req, res) => {
  try {
    const repoPath = req.query.path;
    if (!repoPath) {
      return res.status(400).json({ error: 'path is required' });
    }

    const fullPath = resolve(repoPath);

    // Check if path exists and is a directory
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const detected = {
      entry: null,
      nodeEntry: null,
      pyRoot: null,
      pyExtraPath: null,
    };

    // Look for common frontend entry points (including monorepo patterns)
    const frontendCandidates = [
      'src/main.tsx',
      'src/main.ts',
      'src/main.jsx',
      'src/main.js',
      'src/index.tsx',
      'src/index.ts',
      'src/index.jsx',
      'src/index.js',
      'index.tsx',
      'index.ts',
      'index.jsx',
      'index.js',
      // Monorepo patterns
      'packages/ui/src/main.tsx',
      'packages/ui/src/main.ts',
      'packages/ui/src/main.jsx',
      'packages/ui/src/main.js',
      'packages/ui/src/index.tsx',
      'packages/ui/src/index.ts',
      'packages/ui/src/index.jsx',
      'packages/ui/src/index.js',
      'packages/frontend/src/main.tsx',
      'packages/frontend/src/main.ts',
      'packages/frontend/src/main.jsx',
      'packages/frontend/src/main.js',
      'packages/client/src/main.tsx',
      'packages/client/src/main.ts',
      'packages/client/src/main.jsx',
      'packages/client/src/main.js',
    ];

    for (const candidate of frontendCandidates) {
      const candidatePath = join(fullPath, candidate);
      if (fs.existsSync(candidatePath)) {
        detected.entry = candidate;
        break;
      }
    }

    // Look for common Node.js entry points (including monorepo patterns)
    const nodeCandidates = [
      'server.cjs',
      'server.js',
      'server.ts',
      'index.cjs',
      'index.js',
      'index.ts',
      'app.cjs',
      'app.js',
      'app.ts',
      'src/server.cjs',
      'src/server.js',
      'src/server.ts',
      'src/index.cjs',
      'src/index.js',
      'src/index.ts',
      'src/app.cjs',
      'src/app.js',
      'src/app.ts',
      // Monorepo patterns
      'packages/server/server.cjs',
      'packages/server/server.js',
      'packages/server/server.ts',
      'packages/server/index.cjs',
      'packages/server/index.js',
      'packages/server/index.ts',
      'packages/backend/server.cjs',
      'packages/backend/server.js',
      'packages/backend/server.ts',
      'packages/backend/index.cjs',
      'packages/backend/index.js',
      'packages/backend/index.ts',
      'packages/api/server.cjs',
      'packages/api/server.js',
      'packages/api/server.ts',
      'packages/api/index.cjs',
      'packages/api/index.js',
      'packages/api/index.ts',
    ];

    for (const candidate of nodeCandidates) {
      const candidatePath = join(fullPath, candidate);
      if (fs.existsSync(candidatePath)) {
        detected.nodeEntry = candidate;
        break;
      }
    }

    // Look for Python
    const pythonCandidates = [
      'main.py',
      'app.py',
      'src/main.py',
      'src/app.py',
    ];

    for (const candidate of pythonCandidates) {
      const candidatePath = join(fullPath, candidate);
      if (fs.existsSync(candidatePath)) {
        detected.pyRoot = '.';
        break;
      }
    }

    res.json(detected);
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect entry points', message: error.message });
  }
});

// Index a repository
app.post('/api/index', express.json(), async (req, res) => {
  try {
    const { repoPath, entry, nodeEntry, pyRoot, pyExtraPath } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'repoPath is required' });
    }

    const fullPath = resolve(repoPath);

    // Check if path exists and is a directory
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    // Change to repo directory
    const originalCwd = process.cwd();
    process.chdir(fullPath);

    try {
      const graphs = {};

      // Build JS/TS graph
      if (entry || nodeEntry) {
        try {
          graphs.js = await buildJSGraph({ entry, nodeEntry });
        } catch (err) {
          console.error('Error building JS graph:', err.message);
          // Continue even if JS graph fails
        }
      }

      // Build Python graph
      if (pyRoot) {
        try {
          graphs.py = await buildPythonGraph({ root: pyRoot, extraPath: pyExtraPath });
        } catch (err) {
          console.error('Error building Python graph:', err.message);
          // Continue even if Python graph fails
        }
      }

      // Merge graphs
      const merged = mergeGraphs(graphs);

      // Write to repo's .intellimap directory
      const intellimapDir = join(fullPath, '.intellimap');
      fs.ensureDirSync(intellimapDir);
      fs.writeFileSync(join(intellimapDir, 'graph.json'), JSON.stringify(merged, null, 2));

      // Update current working directory for graph serving
      process.chdir(fullPath);

      res.json({
        success: true,
        message: 'Repository indexed successfully',
        graph: merged,
        repoPath: fullPath,
      });
    } catch (error) {
      console.error('Error indexing repository:', error);
      res.status(500).json({ error: 'Failed to index repository', message: error.message });
    } finally {
      process.chdir(originalCwd);
    }
  } catch (error) {
    console.error('Error in /api/index:', error);
    res.status(500).json({ error: 'Failed to index repository', message: error.message });
  }
});

// Get file content for preview
app.get('/api/file-content', (req, res) => {
  try {
    const { repo, file } = req.query;

    if (!repo || !file) {
      return res.status(400).json({ error: 'Missing repo or file parameter' });
    }

    // Normalize paths
    const repoPath = resolve(repo);
    const fullPath = resolve(repoPath, file);

    // Security: ensure the file is within the repo directory
    if (!fullPath.startsWith(repoPath + '/') && fullPath !== repoPath) {
      console.error(`Security: Attempted access outside repo: ${fullPath} not in ${repoPath}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      return res.status(404).json({ error: 'File not found', path: fullPath });
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      console.error(`Not a file: ${fullPath}`);
      return res.status(400).json({ error: 'Path is not a file' });
    }

    // Limit file size to 1MB for preview
    if (stats.size > 1024 * 1024) {
      return res.status(413).json({ error: 'File too large for preview (max 1MB)' });
    }

    // Read file content
    const content = fs.readFileSync(fullPath, 'utf-8');

    res.json({
      content,
      size: stats.size,
      path: file,
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file', message: error.message });
  }
});

// Serve static UI from dist
const uiDistPath = join(__dirname, '../ui/dist');
if (fs.existsSync(uiDistPath)) {
  app.use(express.static(uiDistPath));

  // SPA fallback
  app.get('/', (req, res) => {
    res.sendFile(join(uiDistPath, 'index.html'));
  });
} else {
  // Fallback UI if dist doesn't exist
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>IntelliMap</title>
          <style>
            body { font-family: sans-serif; margin: 0; padding: 20px; background: #101010; color: #fff; }
            h1 { color: #4ade80; }
            .status { background: #202020; padding: 10px; border-radius: 4px; margin: 10px 0; }
            .ready { color: #4ade80; }
            .loading { color: #fbbf24; }
          </style>
        </head>
        <body>
          <h1>🗺️ IntelliMap</h1>
          <div class="status">
            <p class="loading">⏳ React UI needs to be built...</p>
            <p>Run: <code>npm run build -w @intellimap/ui</code></p>
            <p>Server is running on port ${port}</p>
            <p>Graph endpoint: <code>GET /graph</code></p>
          </div>
        </body>
      </html>
    `);
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port });
});

const server = app.listen(port, () => {
  console.log(`✅ IntelliMap server running on http://localhost:${port}`);
  if (watch) {
    console.log('👀 Watch mode enabled - will auto-reload on changes');
  }
});

export { server, notifyClients };


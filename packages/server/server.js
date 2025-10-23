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
        graphs.js = await buildJSGraph({ entry, nodeEntry });
      }

      // Build Python graph
      if (pyRoot) {
        graphs.py = await buildPythonGraph({ root: pyRoot, extraPath: pyExtraPath });
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
    } finally {
      process.chdir(originalCwd);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to index repository', message: error.message });
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


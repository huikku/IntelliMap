import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 7676;
const watch = process.env.WATCH === 'true';

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

app.listen(port, () => {
  console.log(`✅ IntelliMap server running on http://localhost:${port}`);
  if (watch) {
    console.log('👀 Watch mode enabled - will auto-reload on changes');
  }
});


import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupSSE, notifyClients } from './reload.js';
import { buildJSGraph } from '../cli/indexers/esbuildGraph.js';
import { buildPythonGraph } from '../cli/indexers/pythonGraph.js';
import { mergeGraphs } from '../cli/indexers/mergeGraphs.js';
import { mergeRuntimeData, generateRuntimeReport } from './runtime-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 7676;
const watch = process.env.WATCH === 'true';

// Track current repository path (defaults to server's working directory)
let currentRepoPath = process.cwd();

// IntelliMap's installation directory (where scripts are located)
const intellimapRoot = resolve(__dirname, '../..');

// Setup SSE for live reload
setupSSE(app);

app.use(cors());
app.use(express.json());

// Debug endpoint to check current repo
app.get('/api/debug-cwd', (req, res) => {
  res.json({
    currentRepoPath,
    processCwd: process.cwd(),
  });
});

// Serve graph.json
app.get('/graph', (req, res) => {
  try {
    const graphPath = resolve(currentRepoPath, '.intellimap/graph.json');
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    // Include the repo path so the UI knows where files are located
    res.json({
      ...graph,
      repoPath: currentRepoPath,
    });
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

    // Look for HTML files with <script> tags (static sites)
    const htmlCandidates = ['index.html', 'public/index.html', 'dist/index.html'];
    for (const htmlFile of htmlCandidates) {
      const htmlPath = join(fullPath, htmlFile);
      if (fs.existsSync(htmlPath)) {
        try {
          const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
          // Parse <script src="..."> tags
          const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
          let match;
          const scripts = [];
          while ((match = scriptRegex.exec(htmlContent)) !== null) {
            let scriptSrc = match[1];
            // Skip external URLs
            if (scriptSrc.startsWith('http://') || scriptSrc.startsWith('https://') || scriptSrc.startsWith('//')) {
              continue;
            }
            // Remove leading slash
            if (scriptSrc.startsWith('/')) {
              scriptSrc = scriptSrc.substring(1);
            }
            scripts.push(scriptSrc);
          }

          if (scripts.length > 0) {
            // Use the first local script as entry point
            detected.entry = scripts[0];
            console.log(`📄 Detected HTML entry point: ${htmlFile} → ${scripts[0]}`);
            break;
          }
        } catch (err) {
          console.error(`Error parsing ${htmlFile}:`, err.message);
        }
      }
    }

    // If no HTML entry found, look for common frontend entry points (including monorepo patterns)
    if (!detected.entry) {
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

      // Update current repo path (don't use process.chdir - it's global state!)
      currentRepoPath = fullPath;
      console.log(`📂 Current repo set to: ${currentRepoPath}`);

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
      return res.status(413).json({
        error: 'File too large for preview',
        message: `This file is ${(stats.size / 1024 / 1024).toFixed(2)} MB. Preview is limited to 1 MB.`,
        reason: 'too_large',
      });
    }

    // Check if file is binary or minified
    const isBinaryExt = /\.(jpg|jpeg|png|gif|bmp|ico|pdf|zip|tar|gz|exe|dll|so|dylib|wasm)$/i.test(file);
    const isMinified = /\.min\.(js|css)$/i.test(file) || file.includes('/dist/') || file.includes('/build/');

    if (isBinaryExt) {
      return res.status(415).json({
        error: 'Cannot preview binary file',
        message: 'This is a binary file (image, archive, executable, etc.) and cannot be displayed as text.',
        reason: 'binary',
      });
    }

    // Read file content
    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch (readError) {
      // If UTF-8 fails, it's likely a binary file
      return res.status(415).json({
        error: 'Cannot preview binary file',
        message: 'This file contains binary data and cannot be displayed as text.',
        reason: 'binary',
      });
    }

    // Warn if file is minified/bundled
    let warning = null;
    if (isMinified) {
      warning = 'This is a minified/bundled build artifact. It contains compressed code that is not human-readable. Check the source files in src/ instead.';
    }

    res.json({
      content,
      size: stats.size,
      path: file,
      warning,
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file', message: error.message });
  }
});

// Runtime status check
app.get('/api/runtime-status', async (req, res) => {
  try {
    const runtimeDir = resolve(currentRepoPath, '.intellimap/runtime');
    const nycrcPath = resolve(currentRepoPath, '.nycrc.json');
    const venvPath = resolve(currentRepoPath, '.venv-intellimap');

    const setupComplete = fs.existsSync(nycrcPath) || fs.existsSync(venvPath);
    const hasData = fs.existsSync(runtimeDir) &&
                    (await fs.readdir(runtimeDir)).some(f => f.startsWith('trace-'));

    // Detect suggested command to run
    let suggestedCommand = 'npm start';
    try {
      const packageJsonPath = resolve(currentRepoPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const scripts = packageJson.scripts || {};

        // Prefer these commands in order
        if (scripts.dev) suggestedCommand = 'npm run dev';
        else if (scripts.start) suggestedCommand = 'npm start';
        else if (scripts.serve) suggestedCommand = 'npm run serve';
        else if (scripts['start:dev']) suggestedCommand = 'npm run start:dev';
      }
    } catch (e) {
      // Ignore errors, use default
    }

    res.json({
      setupComplete,
      hasData,
      repoPath: currentRepoPath,
      suggestedCommand,
    });
  } catch (error) {
    res.json({
      setupComplete: false,
      hasData: false,
      repoPath: currentRepoPath,
      suggestedCommand: 'npm start',
    });
  }
});

// Runtime setup endpoint
app.post('/api/runtime-setup', async (req, res) => {
  try {
    const { spawn } = await import('node:child_process');
    // Use IntelliMap's setup script, but run it in the target repo
    const setupScript = resolve(intellimapRoot, 'scripts/setup-runtime.js');

    console.log(`🚀 Running runtime setup for ${currentRepoPath}...`);
    console.log(`   Using script: ${setupScript}`);

    const child = spawn('node', [setupScript], {
      cwd: currentRepoPath,
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Runtime setup complete');
        res.json({ success: true, output });
      } else {
        console.error('❌ Runtime setup failed');
        res.status(500).json({ success: false, error: errorOutput || 'Setup failed', output });
      }
    });

    child.on('error', (error) => {
      console.error('❌ Failed to start setup:', error);
      res.status(500).json({ success: false, error: error.message });
    });
  } catch (error) {
    console.error('Error running setup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Runtime capture endpoint - runs app with V8 coverage
app.post('/api/runtime-capture', async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ success: false, error: 'No command provided' });
    }

    const { spawn } = await import('node:child_process');
    const coverageDir = resolve(currentRepoPath, '.intellimap/v8-coverage');

    // Ensure coverage directory exists
    await fs.ensureDir(coverageDir);

    console.log(`🎬 Starting runtime capture for ${currentRepoPath}...`);
    console.log(`   Command: ${command}`);
    console.log(`   Coverage dir: ${coverageDir}`);

    // Parse command
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = parts[0];
    const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));

    // Start the process with V8 coverage
    const child = spawn(cmd, args, {
      cwd: currentRepoPath,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_V8_COVERAGE: coverageDir,
      },
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString());
    });

    // Send back the process info immediately so UI can show it's running
    res.json({
      success: true,
      message: 'Runtime capture started. The app is now running with V8 coverage enabled.',
      command,
      coverageDir,
    });

    // When process exits, convert the coverage
    child.on('exit', async (code) => {
      console.log(`\n⏹️  App stopped (exit code: ${code})`);
      console.log('🔄 Converting V8 coverage to IntelliMap format...\n');

      try {
        const converterPath = resolve(intellimapRoot, 'packages/cli/runtime/enhanced-v8-converter.js');
        const { default: convertV8Coverage } = await import(converterPath);
        await convertV8Coverage(coverageDir, currentRepoPath);
        console.log('✅ Runtime capture complete!\n');
      } catch (error) {
        console.error('❌ Error converting coverage:', error.message);
      }
    });

  } catch (error) {
    console.error('Error starting runtime capture:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Runtime collection endpoint (deprecated - use /api/runtime-capture instead)
app.post('/api/runtime-collect', async (req, res) => {
  try {
    const { spawn } = await import('node:child_process');
    // Use IntelliMap's collection script, but run it in the target repo
    const collectScript = resolve(intellimapRoot, 'scripts/collect-runtime.js');

    console.log(`📊 Running runtime collection for ${currentRepoPath}...`);
    console.log(`   Using script: ${collectScript}`);

    const child = spawn('node', [collectScript], {
      cwd: currentRepoPath,
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Runtime collection complete');
        res.json({ success: true, output });
      } else {
        console.error('❌ Runtime collection failed');
        res.status(500).json({ success: false, error: errorOutput || 'Collection failed', output });
      }
    });

    child.on('error', (error) => {
      console.error('❌ Failed to start collection:', error);
      res.status(500).json({ success: false, error: error.message });
    });
  } catch (error) {
    console.error('Error running collection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Runtime trace upload endpoint
app.post('/api/runtime-trace', async (req, res) => {
  try {
    const { trace, metadata } = req.body;

    if (!trace) {
      return res.status(400).json({ error: 'No trace data provided' });
    }

    // Save runtime trace
    const runtimeDir = resolve(currentRepoPath, '.intellimap/runtime');
    await fs.ensureDir(runtimeDir);

    const timestamp = Date.now();
    const traceFile = join(runtimeDir, `trace-${timestamp}.json`);

    await fs.writeJson(traceFile, {
      metadata: {
        ...metadata,
        timestamp,
        uploadedAt: new Date().toISOString(),
      },
      ...trace,
    }, { spaces: 2 });

    console.log(`✅ Runtime trace saved: ${traceFile}`);
    res.json({ success: true, file: traceFile, timestamp });
  } catch (error) {
    console.error('Error saving runtime trace:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get runtime analysis
app.get('/api/runtime-analysis', async (req, res) => {
  try {
    // Load static graph from current repo
    const graphPath = resolve(currentRepoPath, '.intellimap/graph.json');
    if (!fs.existsSync(graphPath)) {
      return res.status(404).json({
        error: 'No static graph found. Run indexing first.',
        repoPath: currentRepoPath,
      });
    }

    const staticGraph = await fs.readJson(graphPath);

    // Load latest runtime trace from current repo
    const runtimeDir = resolve(currentRepoPath, '.intellimap/runtime');
    if (!fs.existsSync(runtimeDir)) {
      return res.json({
        graph: staticGraph,
        runtime: null,
        report: generateRuntimeReport({ ...staticGraph, runtime: null }),
        repoPath: currentRepoPath,
      });
    }

    const traceFiles = (await fs.readdir(runtimeDir))
      .filter(f => f.startsWith('trace-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (traceFiles.length === 0) {
      return res.json({
        graph: staticGraph,
        runtime: null,
        report: generateRuntimeReport({ ...staticGraph, runtime: null }),
        repoPath: currentRepoPath,
      });
    }

    // Load latest trace
    const latestTrace = await fs.readJson(join(runtimeDir, traceFiles[0]));

    // Merge runtime data with static graph
    const mergedGraph = mergeRuntimeData(staticGraph, latestTrace);

    // Generate report
    const report = generateRuntimeReport(mergedGraph);

    res.json({
      graph: mergedGraph,
      runtime: mergedGraph.runtime,
      report,
      traceFile: traceFiles[0],
      repoPath: currentRepoPath,
    });
  } catch (error) {
    console.error('Error generating runtime analysis:', error);
    res.status(500).json({ error: error.message, repoPath: currentRepoPath });
  }
});

// List available runtime traces
app.get('/api/runtime-traces', async (req, res) => {
  try {
    const runtimeDir = resolve(currentRepoPath, '.intellimap/runtime');
    if (!fs.existsSync(runtimeDir)) {
      return res.json({ traces: [], repoPath: currentRepoPath });
    }

    const traceFiles = (await fs.readdir(runtimeDir))
      .filter(f => f.startsWith('trace-') && f.endsWith('.json'))
      .sort()
      .reverse();

    const traces = await Promise.all(
      traceFiles.map(async (file) => {
        const trace = await fs.readJson(join(runtimeDir, file));
        return {
          file,
          timestamp: trace.metadata?.timestamp,
          branch: trace.metadata?.branch,
          commit: trace.metadata?.commit,
          runId: trace.metadata?.runId,
        };
      })
    );

    res.json({ traces });
  } catch (error) {
    console.error('Error listing runtime traces:', error);
    res.status(500).json({ error: error.message });
  }
});

// MOTH generation endpoint
app.post('/api/moth-generate', async (req, res) => {
  try {
    const { spawn } = await import('node:child_process');
    const mothScript = resolve(intellimapRoot, 'packages/cli/index.js');

    console.log(`🦋 Generating MOTH manifest for ${currentRepoPath}...`);

    const child = spawn('node', [mothScript, 'moth'], {
      cwd: currentRepoPath,
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          message: 'MOTH manifest generated successfully',
          output
        });
      } else {
        res.status(500).json({
          success: false,
          error: `MOTH generation failed with code ${code}`,
          output: errorOutput
        });
      }
    });

  } catch (error) {
    console.error('Error generating MOTH manifest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get MOTH manifest
app.get('/api/moth-manifest', async (req, res) => {
  try {
    const mothPath = resolve(currentRepoPath, '.mothlab/moth/REPO.moth');

    if (!fs.existsSync(mothPath)) {
      return res.status(404).json({
        error: 'No MOTH manifest found. Generate one first.',
        repoPath: currentRepoPath,
      });
    }

    const manifest = await fs.readFile(mothPath, 'utf8');
    res.type('text/plain').send(manifest);

  } catch (error) {
    console.error('Error loading MOTH manifest:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get MOTH index
app.get('/api/moth-index', async (req, res) => {
  try {
    const indexPath = resolve(currentRepoPath, '.mothlab/moth/moth.index.json');

    if (!fs.existsSync(indexPath)) {
      return res.status(404).json({
        error: 'No MOTH index found. Generate one first.',
        repoPath: currentRepoPath,
      });
    }

    const index = await fs.readJson(indexPath);
    res.json(index);

  } catch (error) {
    console.error('Error loading MOTH index:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get MOTH validation
app.get('/api/moth-validation', async (req, res) => {
  try {
    const validationPath = resolve(currentRepoPath, '.mothlab/moth/validation.json');

    if (!fs.existsSync(validationPath)) {
      return res.status(404).json({
        error: 'No MOTH validation found. Generate one first.',
        repoPath: currentRepoPath,
      });
    }

    const validation = await fs.readJson(validationPath);
    res.json(validation);

  } catch (error) {
    console.error('Error loading MOTH validation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port });
});

// Serve static UI from dist
const uiDistPath = join(__dirname, '../ui/dist');
if (fs.existsSync(uiDistPath)) {
  // Disable caching for development
  app.use(express.static(uiDistPath, {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
  }));

  // SPA fallback - only for non-API routes
  app.get('*', (req, res, next) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/graph') || req.path.startsWith('/health')) {
      return next();
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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

const server = app.listen(port, () => {
  console.log(`✅ IntelliMap server running on http://localhost:${port}`);
  if (watch) {
    console.log('👀 Watch mode enabled - will auto-reload on changes');
  }
});

export { server, notifyClients };


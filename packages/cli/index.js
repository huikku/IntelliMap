#!/usr/bin/env node

import { Command } from 'commander';
import { indexCommand } from './commands/index.js';
import { diffCommand } from './commands/diff.js';
import { serveCommand } from './commands/serve.js';
import { runCommand } from './commands/run.js';
import captureCommand from './commands/capture.js';
import mothCommand from './commands/moth.js';

const program = new Command();

program
  .name('intellimap')
  .description('Local-only full-stack code architecture visualizer')
  .version('0.1.0');

program
  .command('index')
  .description('Generate dependency graph from JS/TS and Python code')
  .option('--entry <path>', 'Entry point for JS/TS (default: src/index.ts)', 'src/index.ts')
  .option('--node-entry <path>', 'Entry point for Node backend (optional)')
  .option('--py-root <path>', 'Root directory for Python code (optional)')
  .option('--py-extra-path <path>', 'Extra Python path for imports (optional)')
  .option('--out <path>', 'Output graph.json path (default: .intellimap/graph.json)', '.intellimap/graph.json')
  .action(indexCommand);

program
  .command('diff')
  .description('Mark changed nodes based on git diff')
  .argument('[base]', 'Base commit (default: HEAD~1)', 'HEAD~1')
  .argument('[head]', 'Head commit (default: HEAD)', 'HEAD')
  .action(diffCommand);

program
  .command('serve')
  .description('Start Express server to visualize graph')
  .option('--port <number>', 'Server port (default: 7676)', '7676')
  .option('--watch', 'Enable live reload on file changes', false)
  .action(serveCommand);

program
  .command('run')
  .description('Run your app with runtime analysis (captures actual execution)')
  .argument('<command...>', 'Command to run (e.g., "npm start", "node server.js")')
  .action((command) => runCommand(command));

program
  .command('capture')
  .description('Capture runtime execution by running your app with V8 coverage')
  .argument('<command>', 'Command to run (e.g., "npm start", "node server.js")')
  .action(captureCommand);

program
  .command('moth')
  .description('Generate MOTH manifest for the repository')
  .action(mothCommand);

program.parse(process.argv);


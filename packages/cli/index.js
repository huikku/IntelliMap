#!/usr/bin/env node

import { Command } from 'commander';
import { indexCommand } from './commands/index.js';
import { diffCommand } from './commands/diff.js';
import { serveCommand } from './commands/serve.js';

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

program.parse(process.argv);


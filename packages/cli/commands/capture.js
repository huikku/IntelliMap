#!/usr/bin/env node

/**
 * Capture runtime execution data by running your app with V8 coverage
 * 
 * Usage:
 *   intellimap capture "npm start"
 *   intellimap capture "node server.js"
 *   intellimap capture "python app.py"
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function capture(command) {
  const cwd = process.cwd();
  const coverageDir = resolve(cwd, '.intellimap/v8-coverage');
  
  console.log('🎬 IntelliMap Runtime Capture\n');
  console.log(`📂 Repository: ${cwd}`);
  console.log(`🚀 Command: ${command}`);
  console.log(`📊 Coverage output: ${coverageDir}\n`);
  
  // Ensure coverage directory exists
  await fs.ensureDir(coverageDir);
  
  console.log('▶️  Starting your app with V8 coverage enabled...\n');
  console.log('━'.repeat(60));
  
  // Parse command (handle quoted strings)
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const cmd = parts[0];
  const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));
  
  // Run the command with V8 coverage
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_V8_COVERAGE: coverageDir,
    },
  });
  
  // Handle process exit
  child.on('exit', async (code) => {
    console.log('\n' + '━'.repeat(60));
    console.log(`\n⏹️  App stopped (exit code: ${code})\n`);
    
    // Convert V8 coverage to IntelliMap format
    console.log('🔄 Converting V8 coverage to IntelliMap format...\n');
    
    const converterPath = resolve(__dirname, '../runtime/enhanced-v8-converter.js');
    
    try {
      const { default: convertV8Coverage } = await import(converterPath);
      await convertV8Coverage(coverageDir, cwd);
      
      console.log('\n✅ Runtime capture complete!\n');
      console.log('📖 Next steps:');
      console.log('   1. Open IntelliMap UI: npm run serve');
      console.log('   2. Click "⚡ Runtime Analysis" to view results\n');
    } catch (error) {
      console.error('❌ Error converting coverage:', error.message);
      console.error('\nYou can manually convert with:');
      console.error(`   node ${converterPath} ${coverageDir} ${cwd}\n`);
      process.exit(1);
    }
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n⏸️  Stopping app...');
    child.kill('SIGINT');
  });
}


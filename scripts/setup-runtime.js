#!/usr/bin/env node

/**
 * Setup Runtime Analysis Environment
 * 
 * This script:
 * 1. Installs NYC/c8 for JavaScript coverage
 * 2. Sets up Python virtual environment
 * 3. Installs coverage.py for Python coverage
 * 4. Creates configuration files
 */

import fs from 'fs-extra';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const VENV_PATH = resolve('.venv-intellimap');

function run(command, options = {}) {
  console.log(`  $ ${command}`);
  try {
    execSync(command, { 
      stdio: 'inherit',
      ...options 
    });
    return true;
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
    return false;
  }
}

async function setupJavaScript() {
  console.log('\n📦 Setting up JavaScript/TypeScript coverage...');
  
  // NYC is already in package.json devDependencies
  console.log('  ✅ NYC and c8 are already in package.json');
  
  // Create .nycrc.json if it doesn't exist
  const nycrcPath = resolve('.nycrc.json');
  if (!fs.existsSync(nycrcPath)) {
    console.log('  📝 Creating .nycrc.json configuration...');
    const nycConfig = {
      all: true,
      include: [
        'src/**/*.js',
        'src/**/*.ts',
        'src/**/*.jsx',
        'src/**/*.tsx',
        'packages/*/src/**/*.js',
        'packages/*/src/**/*.ts',
        'packages/*/src/**/*.jsx',
        'packages/*/src/**/*.tsx'
      ],
      exclude: [
        '**/*.test.js',
        '**/*.spec.js',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.venv*/**'
      ],
      reporter: ['json', 'text', 'html'],
      'report-dir': '.nyc_output',
      'temp-dir': '.nyc_output/.cache'
    };
    
    await fs.writeJson(nycrcPath, nycConfig, { spaces: 2 });
    console.log('  ✅ Created .nycrc.json');
  } else {
    console.log('  ✅ .nycrc.json already exists');
  }
  
  // Create c8 config
  const c8ConfigPath = resolve('.c8rc.json');
  if (!fs.existsSync(c8ConfigPath)) {
    console.log('  📝 Creating .c8rc.json configuration...');
    const c8Config = {
      all: true,
      include: [
        'src/**/*.js',
        'src/**/*.ts',
        'packages/*/src/**/*.js',
        'packages/*/src/**/*.ts'
      ],
      exclude: [
        '**/*.test.js',
        '**/*.spec.js',
        '**/node_modules/**',
        '**/dist/**'
      ],
      reporter: ['json', 'text', 'html'],
      'reports-dir': '.c8_output'
    };
    
    await fs.writeJson(c8ConfigPath, c8Config, { spaces: 2 });
    console.log('  ✅ Created .c8rc.json');
  } else {
    console.log('  ✅ .c8rc.json already exists');
  }
}

async function setupPython() {
  console.log('\n🐍 Setting up Python coverage...');
  
  // Check if Python is available
  try {
    execSync('python3 --version', { stdio: 'pipe' });
  } catch (err) {
    console.log('  ⚠️  Python3 not found, skipping Python setup');
    return;
  }
  
  // Create virtual environment if it doesn't exist
  if (!fs.existsSync(VENV_PATH)) {
    console.log(`  📦 Creating Python virtual environment at ${VENV_PATH}...`);
    if (!run(`python3 -m venv ${VENV_PATH}`)) {
      console.log('  ⚠️  Failed to create virtual environment');
      return;
    }
  } else {
    console.log(`  ✅ Virtual environment already exists at ${VENV_PATH}`);
  }
  
  // Install coverage.py in venv
  console.log('  📦 Installing coverage.py in virtual environment...');
  const pipCmd = process.platform === 'win32' 
    ? `${VENV_PATH}\\Scripts\\pip.exe`
    : `${VENV_PATH}/bin/pip`;
  
  if (!run(`${pipCmd} install coverage`)) {
    console.log('  ⚠️  Failed to install coverage.py');
    return;
  }
  
  // Create .coveragerc if it doesn't exist
  const coveragercPath = resolve('.coveragerc');
  if (!fs.existsSync(coveragercPath)) {
    console.log('  📝 Creating .coveragerc configuration...');
    const coverageConfig = `[run]
source = .
omit =
    */tests/*
    */test_*
    */.venv*/*
    */node_modules/*
    */dist/*
    */build/*

[report]
precision = 2

[json]
output = .coverage.json
`;
    
    await fs.writeFile(coveragercPath, coverageConfig);
    console.log('  ✅ Created .coveragerc');
  } else {
    console.log('  ✅ .coveragerc already exists');
  }
}

async function createHelperScripts() {
  console.log('\n📝 Creating helper scripts...');
  
  // Create Python coverage converter
  const pythonConverterPath = resolve('scripts/coverage-to-intellimap.py');
  if (!fs.existsSync(pythonConverterPath)) {
    console.log('  📝 Creating Python coverage converter...');
    const pythonConverter = `#!/usr/bin/env python3
"""
Convert coverage.py data to IntelliMap runtime trace format
"""

import json
import os
import subprocess
from pathlib import Path
from datetime import datetime

def get_git_info():
    try:
        branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], 
                                        stderr=subprocess.DEVNULL).decode().strip()
        commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'],
                                        stderr=subprocess.DEVNULL).decode().strip()
        return branch, commit
    except:
        return 'unknown', 'unknown'

def convert_coverage():
    print('🔬 Converting coverage.py data to IntelliMap runtime trace...')
    
    # Check if coverage data exists
    if not os.path.exists('.coverage.json'):
        print('❌ No coverage data found at .coverage.json')
        print('   Run: coverage run -m pytest')
        print('   Then: coverage json')
        return
    
    with open('.coverage.json', 'r') as f:
        coverage_data = json.load(f)
    
    nodes = []
    files = coverage_data.get('files', {})
    
    for filepath, file_data in files.items():
        # Get relative path
        rel_path = os.path.relpath(filepath)
        
        # Calculate coverage
        summary = file_data.get('summary', {})
        total_statements = summary.get('num_statements', 0)
        covered_statements = summary.get('covered_lines', 0)
        coverage_percent = (covered_statements / total_statements * 100) if total_statements > 0 else 0
        
        # Estimate execution count from covered lines
        execution_count = len(file_data.get('executed_lines', []))
        
        nodes.append({
            'id': rel_path,
            'executionCount': execution_count,
            'totalTime': execution_count * 0.01,  # Estimate
            'coverage': coverage_percent
        })
    
    # Get git info
    branch, commit = get_git_info()
    
    # Create trace
    trace = {
        'metadata': {
            'timestamp': int(datetime.now().timestamp() * 1000),
            'branch': branch,
            'commit': commit,
            'runId': f'coverage-{int(datetime.now().timestamp())}',
            'environment': os.getenv('ENVIRONMENT', 'test'),
            'description': 'coverage.py data',
            'source': 'coverage.py'
        },
        'edges': [],  # Will be inferred from static graph
        'nodes': nodes
    }
    
    # Save trace
    runtime_dir = Path('.intellimap/runtime')
    runtime_dir.mkdir(parents=True, exist_ok=True)
    
    trace_file = runtime_dir / f'trace-{int(datetime.now().timestamp() * 1000)}.json'
    with open(trace_file, 'w') as f:
        json.dump(trace, f, indent=2)
    
    print(f'✅ Converted coverage.py data to IntelliMap trace!')
    print(f'📁 Saved to: {trace_file}')
    print(f'📊 Stats: {len(nodes)} files with coverage')

if __name__ == '__main__':
    convert_coverage()
`;
    
    await fs.writeFile(pythonConverterPath, pythonConverter);
    await fs.chmod(pythonConverterPath, 0o755);
    console.log('  ✅ Created scripts/coverage-to-intellimap.py');
  } else {
    console.log('  ✅ scripts/coverage-to-intellimap.py already exists');
  }
}

async function updateGitignore() {
  console.log('\n📝 Updating .gitignore...');
  
  const gitignorePath = resolve('.gitignore');
  const entries = [
    '.nyc_output/',
    '.c8_output/',
    'coverage/',
    '.coverage',
    '.coverage.*',
    '.venv-intellimap/',
    '.intellimap/runtime/'
  ];
  
  let gitignore = '';
  if (fs.existsSync(gitignorePath)) {
    gitignore = await fs.readFile(gitignorePath, 'utf8');
  }
  
  let updated = false;
  for (const entry of entries) {
    if (!gitignore.includes(entry)) {
      gitignore += `\n${entry}`;
      updated = true;
    }
  }
  
  if (updated) {
    await fs.writeFile(gitignorePath, gitignore);
    console.log('  ✅ Updated .gitignore');
  } else {
    console.log('  ✅ .gitignore already up to date');
  }
}

async function main() {
  console.log('🚀 IntelliMap Runtime Analysis Setup\n');
  console.log('This will set up everything needed for runtime analysis:');
  console.log('  - JavaScript/TypeScript coverage (NYC, c8)');
  console.log('  - Python coverage (coverage.py in venv)');
  console.log('  - Configuration files');
  console.log('  - Helper scripts');
  
  await setupJavaScript();
  await setupPython();
  await createHelperScripts();
  await updateGitignore();
  
  console.log('\n✅ Setup complete!\n');
  console.log('📖 Next steps:');
  console.log('  1. Run: npm run runtime:collect');
  console.log('  2. View: npm run serve → click "⚡ Runtime Analysis"');
  console.log('');
  console.log('💡 Or run everything at once: npm run runtime:all');
}

main().catch(err => {
  console.error('❌ Setup failed:', err);
  process.exit(1);
});


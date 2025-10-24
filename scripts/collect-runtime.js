#!/usr/bin/env node

/**
 * Collect Runtime Coverage Data
 * 
 * This script automatically:
 * 1. Detects your test framework (Jest, Mocha, Vitest, pytest, etc.)
 * 2. Runs tests with coverage enabled
 * 3. Converts coverage data to IntelliMap format
 */

import fs from 'fs-extra';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

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

async function detectTestFramework() {
  console.log('🔍 Detecting test framework...');
  
  const packageJsonPath = resolve('package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('  ⚠️  No package.json found');
    return null;
  }
  
  const packageJson = await fs.readJson(packageJsonPath);
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  // Check for test frameworks
  if (deps.vitest) {
    console.log('  ✅ Detected: Vitest');
    return 'vitest';
  }
  if (deps.jest || deps['@jest/core']) {
    console.log('  ✅ Detected: Jest');
    return 'jest';
  }
  if (deps.mocha) {
    console.log('  ✅ Detected: Mocha');
    return 'mocha';
  }
  if (deps.ava) {
    console.log('  ✅ Detected: AVA');
    return 'ava';
  }
  
  // Check for test script
  if (packageJson.scripts?.test) {
    console.log('  ✅ Found test script in package.json');
    return 'npm-test';
  }
  
  console.log('  ⚠️  No test framework detected');
  return null;
}

async function runJavaScriptCoverage(framework) {
  console.log('\n📊 Running JavaScript/TypeScript coverage...');
  
  let success = false;
  
  switch (framework) {
    case 'vitest':
      console.log('  Using Vitest with coverage...');
      success = run('npx vitest run --coverage');
      break;
      
    case 'jest':
      console.log('  Using Jest with coverage...');
      success = run('npm run test:coverage');
      break;
      
    case 'mocha':
      console.log('  Using NYC + Mocha...');
      success = run('npx nyc mocha');
      break;
      
    case 'ava':
      console.log('  Using NYC + AVA...');
      success = run('npx nyc ava');
      break;
      
    case 'npm-test':
      console.log('  Using NYC + npm test...');
      success = run('npx nyc npm test');
      break;
      
    default:
      console.log('  ⚠️  Unknown framework, trying nyc npm test...');
      success = run('npx nyc npm test');
  }
  
  if (!success) {
    console.log('  ⚠️  Coverage collection failed or no tests found');
    return false;
  }
  
  // Check if coverage was generated
  const nycOutput = resolve('.nyc_output/coverage-final.json');
  const c8Output = resolve('coverage/coverage-final.json');
  
  if (fs.existsSync(nycOutput)) {
    console.log('  ✅ NYC coverage data generated');
    return 'nyc';
  } else if (fs.existsSync(c8Output)) {
    console.log('  ✅ c8 coverage data generated');
    // Copy to .nyc_output for compatibility
    await fs.ensureDir('.nyc_output');
    await fs.copy(c8Output, nycOutput);
    return 'c8';
  } else {
    console.log('  ⚠️  No coverage data found');
    return false;
  }
}

async function runPythonCoverage() {
  console.log('\n🐍 Running Python coverage...');
  
  // Check if Python files exist
  const hasPython = fs.existsSync('setup.py') || 
                    fs.existsSync('pyproject.toml') ||
                    fs.existsSync('requirements.txt') ||
                    fs.readdirSync('.').some(f => f.endsWith('.py'));
  
  if (!hasPython) {
    console.log('  ⚠️  No Python files detected, skipping');
    return false;
  }
  
  // Check if venv exists
  const venvPath = resolve('.venv-intellimap');
  if (!fs.existsSync(venvPath)) {
    console.log('  ⚠️  Virtual environment not found');
    console.log('  Run: npm run runtime:setup');
    return false;
  }
  
  const pythonCmd = process.platform === 'win32'
    ? `${venvPath}\\Scripts\\python.exe`
    : `${venvPath}/bin/python`;
  
  const coverageCmd = process.platform === 'win32'
    ? `${venvPath}\\Scripts\\coverage.exe`
    : `${venvPath}/bin/coverage`;
  
  // Detect test framework
  let testCmd = null;
  if (fs.existsSync('pytest.ini') || fs.existsSync('pyproject.toml')) {
    testCmd = `${pythonCmd} -m pytest`;
  } else if (fs.existsSync('tests') || fs.existsSync('test')) {
    testCmd = `${pythonCmd} -m unittest discover`;
  }
  
  if (!testCmd) {
    console.log('  ⚠️  No Python test framework detected');
    return false;
  }
  
  console.log('  Running coverage...');
  if (!run(`${coverageCmd} run -m ${testCmd.split(' -m ')[1]}`)) {
    console.log('  ⚠️  Coverage collection failed');
    return false;
  }
  
  console.log('  Generating JSON report...');
  if (!run(`${coverageCmd} json`)) {
    console.log('  ⚠️  Failed to generate JSON report');
    return false;
  }
  
  if (fs.existsSync('.coverage.json')) {
    console.log('  ✅ Python coverage data generated');
    return true;
  }
  
  return false;
}

async function convertCoverage(jsType, pySuccess) {
  console.log('\n🔄 Converting coverage data to IntelliMap format...');
  
  let converted = false;
  
  // Convert JavaScript coverage
  if (jsType) {
    console.log('  Converting JavaScript coverage...');
    if (run('node scripts/nyc-to-intellimap.js')) {
      converted = true;
    }
  }
  
  // Convert Python coverage
  if (pySuccess) {
    console.log('  Converting Python coverage...');
    const venvPath = resolve('.venv-intellimap');
    const pythonCmd = process.platform === 'win32'
      ? `${venvPath}\\Scripts\\python.exe`
      : `${venvPath}/bin/python`;
    
    if (run(`${pythonCmd} scripts/coverage-to-intellimap.py`)) {
      converted = true;
    }
  }
  
  return converted;
}

async function main() {
  console.log('🚀 IntelliMap Runtime Coverage Collection\n');
  
  // Detect and run JavaScript tests
  const framework = await detectTestFramework();
  let jsType = false;
  if (framework) {
    jsType = await runJavaScriptCoverage(framework);
  } else {
    console.log('⚠️  No JavaScript test framework detected');
    console.log('   You can manually run: nyc npm test');
  }
  
  // Run Python tests
  const pySuccess = await runPythonCoverage();
  
  // Convert coverage data
  if (jsType || pySuccess) {
    const converted = await convertCoverage(jsType, pySuccess);
    
    if (converted) {
      console.log('\n✅ Coverage collection complete!\n');
      console.log('📖 Next steps:');
      console.log('  1. Start server: npm run serve');
      console.log('  2. Open http://localhost:7676');
      console.log('  3. Click "⚡ Runtime Analysis" in the Analysis tab');
      console.log('');
    } else {
      console.log('\n⚠️  Coverage data collected but conversion failed');
      console.log('   Check the error messages above');
    }
  } else {
    console.log('\n⚠️  No coverage data collected');
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('  1. Make sure you have tests: npm test');
    console.log('  2. Run setup first: npm run runtime:setup');
    console.log('  3. Check test framework is installed');
    console.log('');
  }
}

main().catch(err => {
  console.error('❌ Collection failed:', err);
  process.exit(1);
});


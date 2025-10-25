/**
 * MOTH command - Generate MOTH manifests for repositories
 */

import { resolve } from 'path';
import fs from 'fs-extra';
import { MOTHGenerator } from '../moth/generator.js';

export default async function moth(options) {
  const cwd = process.cwd();
  const mothDir = resolve(cwd, '.mothlab/moth');
  
  console.log('🦋 MOTHlab - Generating MOTH manifest...\n');
  console.log(`📁 Repository: ${cwd}`);
  console.log(`📂 Output directory: ${mothDir}\n`);

  // Ensure output directory exists
  await fs.ensureDir(mothDir);

  try {
    // Create MOTH generator
    const generator = new MOTHGenerator(cwd);

    // Run analysis
    const { manifest, index, validation } = await generator.analyze();

    // Write outputs
    const manifestPath = resolve(mothDir, 'REPO.moth');
    const indexPath = resolve(mothDir, 'moth.index.json');
    const validationPath = resolve(mothDir, 'validation.json');

    await fs.writeFile(manifestPath, manifest, 'utf8');
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    await fs.writeFile(validationPath, JSON.stringify(validation, null, 2), 'utf8');

    console.log('\n✅ MOTH manifest generated successfully!\n');
    console.log(`📄 Manifest: ${manifestPath}`);
    console.log(`📊 Index: ${indexPath}`);
    console.log(`✓ Validation: ${validationPath}\n`);

    // Print summary
    console.log('📈 Summary:');
    console.log(`   Files analyzed: ${validation.summary.totalFiles}`);
    console.log(`   Total lines: ${validation.summary.totalLines.toLocaleString()}`);
    console.log(`   Total complexity: ${validation.summary.totalComplexity.toLocaleString()}`);
    console.log(`   Average depth: ${validation.summary.averageDepth.toFixed(2)}`);
    console.log(`   Manifest hash: ${validation.validation.manifestHash.substring(0, 16)}...`);
    console.log(`   Schema valid: ${validation.validation.schemaValid ? '✓' : '✗'}`);
    console.log(`   Paths resolved: ${validation.validation.pathsResolved ? '✓' : '✗'}`);
    console.log(`   Metrics valid: ${validation.validation.metricsValid ? '✓' : '✗'}\n`);

  } catch (error) {
    console.error('\n❌ Error generating MOTH manifest:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}


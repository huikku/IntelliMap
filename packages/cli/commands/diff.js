import fs from 'fs-extra';
import { simpleGit } from 'simple-git';

export async function diffCommand(base, head) {
  console.log(`📊 Computing diff between ${base} and ${head}...`);
  
  try {
    const git = simpleGit();
    
    // Get list of changed files
    const diff = await git.diff([`${base}...${head}`, '--name-only']);
    const changedFiles = diff.split('\n').filter(f => f.trim());
    
    console.log(`   ✓ Found ${changedFiles.length} changed files`);
    
    // Read current graph
    const graphPath = '.intellimap/graph.json';
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    
    // Mark changed nodes
    let markedCount = 0;
    for (const node of graph.nodes) {
      if (changedFiles.some(f => node.id.includes(f) || f.includes(node.id))) {
        node.changed = true;
        markedCount++;
      }
    }
    
    console.log(`   ✓ Marked ${markedCount} nodes as changed`);
    
    // Write updated graph
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
    console.log(`✅ Diff overlay applied to ${graphPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}


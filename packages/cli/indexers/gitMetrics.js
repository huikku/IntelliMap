import { execSync } from 'node:child_process';

/**
 * Check if we're in a git repository
 */
export function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get git churn (number of commits) for a file
 */
export function getChurn(filePath) {
  try {
    const result = execSync(`git log --follow --oneline -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    });
    const lines = result.trim().split('\n').filter(line => line.length > 0);
    return lines.length;
  } catch (error) {
    return 0;
  }
}

/**
 * Get days since last commit for a file
 */
export function getAge(filePath) {
  try {
    const result = execSync(`git log -1 --format=%ct -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const timestamp = Number.parseInt(result.trim(), 10);
    if (isNaN(timestamp)) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    const ageInSeconds = now - timestamp;
    const ageInDays = Math.floor(ageInSeconds / 86400);
    return ageInDays;
  } catch (error) {
    return 0;
  }
}

/**
 * Get unique author count for a file
 */
export function getAuthors(filePath) {
  try {
    const result = execSync(`git log --follow --format=%ae -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const emails = result.trim().split('\n').filter(line => line.length > 0);
    const uniqueAuthors = new Set(emails);
    return uniqueAuthors.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Get all git metrics for a file at once (more efficient)
 */
export function getGitMetrics(filePath) {
  try {
    // Get commit log with timestamp and author email
    const result = execSync(`git log --follow --format="%ct|%ae" -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    
    const lines = result.trim().split('\n').filter(line => line.length > 0);
    
    if (lines.length === 0) {
      return { churn: 0, age: 0, authors: 0 };
    }
    
    // Churn = number of commits
    const churn = lines.length;
    
    // Age = days since last commit (first line is most recent)
    const [lastTimestamp] = lines[0].split('|');
    const timestamp = Number.parseInt(lastTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const ageInDays = Math.floor((now - timestamp) / 86400);
    
    // Authors = unique email addresses
    const emails = lines.map(line => line.split('|')[1]);
    const uniqueAuthors = new Set(emails);
    
    return {
      churn,
      age: ageInDays,
      authors: uniqueAuthors.size,
    };
  } catch (error) {
    return { churn: 0, age: 0, authors: 0 };
  }
}

/**
 * Enrich nodes with git-based behavioral metrics
 */
export function enrichNodesWithGitMetrics(nodes) {
  if (!isGitRepo()) {
    console.log('⚠️  Not a git repository, skipping git metrics');
    return nodes;
  }
  
  console.log('📊 Computing git-based behavioral metrics...');
  
  const enrichedNodes = nodes.map((node, index) => {
    // Show progress for large repos
    if (index % 50 === 0 && index > 0) {
      console.log(`   Processing ${index}/${nodes.length} files...`);
    }
    
    const gitMetrics = getGitMetrics(node.id);
    
    return {
      ...node,
      churn: gitMetrics.churn,
      age: gitMetrics.age,
      authors: gitMetrics.authors,
    };
  });
  
  console.log(`✅ Enriched ${enrichedNodes.length} nodes with git metrics`);
  
  return enrichedNodes;
}

/**
 * Calculate hotspot score (complexity × churn)
 * Higher score = higher risk (complex code that changes frequently)
 */
export function calculateHotspotScore(complexity, churn) {
  // Normalize to prevent extreme values
  // Use log scale for churn to prevent files with 1000+ commits from dominating
  const normalizedChurn = churn > 0 ? Math.log10(churn + 1) : 0;
  const normalizedComplexity = Math.log10(complexity + 1);
  
  return normalizedComplexity * normalizedChurn;
}

/**
 * Add hotspot scores to nodes
 */
export function enrichNodesWithHotspots(nodes) {
  console.log('🔥 Computing hotspot scores...');
  
  const enrichedNodes = nodes.map(node => {
    const hotspot = calculateHotspotScore(
      node.complexity || 1,
      node.churn || 0
    );
    
    return {
      ...node,
      hotspot,
    };
  });
  
  // Compute hotspot quantiles (1-5)
  const hotspotValues = enrichedNodes.map(n => n.hotspot || 0).filter(v => v > 0);
  
  const nodesWithHotspotQuantiles = enrichedNodes.map(node => {
    const hotspot_q = computeQuantile(node.hotspot || 0, hotspotValues);
    
    return {
      ...node,
      hotspot_q,
    };
  });
  
  console.log(`✅ Computed hotspot scores for ${nodesWithHotspotQuantiles.length} nodes`);
  
  return nodesWithHotspotQuantiles;
}

/**
 * Compute quantile bucket (1-5) for a value given all values
 */
function computeQuantile(value, allValues) {
  if (allValues.length === 0) return 3;
  
  const sorted = [...allValues].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  const percentile = index / sorted.length;
  
  if (percentile <= 0.2) return 1;
  if (percentile <= 0.4) return 2;
  if (percentile <= 0.6) return 3;
  if (percentile <= 0.8) return 4;
  return 5;
}


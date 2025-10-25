import fs from 'fs-extra';

/**
 * Compute LOC (lines of code) for a file
 */
export function computeLOC(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

/**
 * Compute cyclomatic complexity for a file
 * Simple heuristic: count branches + functions
 */
export function computeComplexity(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const branches = (content.match(/\b(if|else|switch|case|for|while|catch|when|&&|\|\||\?)\b/g) || []).length;
    const functions = (content.match(/\bfunction\s+\w+|\w+\s*=>|const\s+\w+\s*=|def\s+\w+|class\s+\w+/g) || []).length;
    return Math.max(1, branches + functions);
  } catch (error) {
    return 1;
  }
}

/**
 * Compute quantile bucket (1-5) for a value given all values
 */
export function computeQuantile(value, allValues) {
  if (allValues.length === 0) return 3;
  
  const sorted = [...allValues].sort((a, b) => a - b);
  const index = sorted.indexOf(value);
  const percentile = index / sorted.length;
  
  if (percentile <= 0.2) return 1;
  if (percentile <= 0.4) return 2;
  if (percentile <= 0.6) return 3;
  if (percentile <= 0.8) return 4;
  return 5;
}

/**
 * Compute quantile buckets for all nodes
 */
export function computeQuantiles(nodes) {
  // Extract all LOC and complexity values
  const locValues = nodes.map(n => n.loc || 0).filter(v => v > 0);
  const cxValues = nodes.map(n => n.complexity || 1).filter(v => v > 0);
  
  // Compute quantiles for each node
  return nodes.map(node => {
    const loc_q = computeQuantile(node.loc || 0, locValues);
    const cx_q = computeQuantile(node.complexity || 1, cxValues);
    
    return {
      ...node,
      loc_q,
      cx_q,
    };
  });
}

/**
 * Enrich nodes with LOC and complexity metrics
 */
export function enrichNodesWithMetrics(nodes) {
  console.log('📊 Computing LOC and complexity metrics...');
  
  // Compute LOC and complexity for each node
  const enrichedNodes = nodes.map(node => {
    const loc = computeLOC(node.id);
    const complexity = computeComplexity(node.id);
    
    return {
      ...node,
      loc,
      complexity,
    };
  });
  
  // Compute quantiles
  const nodesWithQuantiles = computeQuantiles(enrichedNodes);
  
  console.log(`✅ Enriched ${nodesWithQuantiles.length} nodes with metrics`);
  
  return nodesWithQuantiles;
}

/**
 * Compute folder/package aggregates
 */
export function computeFolderAggregates(nodes) {
  const folderMap = new Map();
  
  for (const node of nodes) {
    const folder = node.folder || 'root';
    
    if (!folderMap.has(folder)) {
      folderMap.set(folder, {
        id: folder,
        type: 'folder',
        files: [],
        agg_loc: 0,
        agg_cx: 0,
        count: 0,
      });
    }
    
    const folderData = folderMap.get(folder);
    folderData.files.push(node.id);
    folderData.agg_loc += node.loc || 0;
    folderData.agg_cx += node.complexity || 1;
    folderData.count += 1;
  }
  
  // Compute quantiles for folder aggregates
  const folders = Array.from(folderMap.values());
  const folderLocValues = folders.map(f => f.agg_loc);
  const folderCxValues = folders.map(f => f.agg_cx / f.count); // Average complexity
  
  const foldersWithQuantiles = folders.map(folder => {
    const agg_loc_q = computeQuantile(folder.agg_loc, folderLocValues);
    const avg_cx = folder.agg_cx / folder.count;
    const agg_cx_q = computeQuantile(avg_cx, folderCxValues);
    
    return {
      ...folder,
      agg_loc_q,
      agg_cx_q,
      avg_cx,
    };
  });
  
  return foldersWithQuantiles;
}


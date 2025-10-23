/**
 * Merge JS and Python graphs into unified schema
 */
export function mergeGraphs(graphs) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  
  // Merge nodes
  for (const [lang, graph] of Object.entries(graphs)) {
    if (!graph) continue;
    
    for (const node of graph.nodes) {
      const key = node.id;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, true);
        nodes.push(node);
      }
    }
  }
  
  // Merge edges
  for (const [lang, graph] of Object.entries(graphs)) {
    if (!graph) continue;
    
    for (const edge of graph.edges) {
      edges.push(edge);
    }
  }
  
  // Remove duplicate edges
  const edgeSet = new Set();
  const uniqueEdges = [];
  for (const edge of edges) {
    const key = `${edge.from}→${edge.to}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      uniqueEdges.push(edge);
    }
  }
  
  return {
    meta: {
      repoRoot: process.cwd(),
      generatedAt: Date.now(),
      tool: 'intellimap@0.1.0',
    },
    nodes,
    edges: uniqueEdges,
  };
}


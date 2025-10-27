/**
 * Adapter to convert IntelliMap graph data to React Flow format
 */

/**
 * Convert IntelliMap graph structure to React Flow nodes and edges
 * @param {Object} graphData - IntelliMap graph with nodes and edges
 * @returns {Object} { nodes, edges } in React Flow format
 */
export function convertToReactFlow(graphData) {
  if (!graphData || !graphData.nodes) {
    return { nodes: [], edges: [] };
  }

  // Convert nodes
  const nodes = graphData.nodes.map(node => {
    const nodeData = node.data || node;

    return {
      id: nodeData.id,
      type: nodeData.isCluster ? 'clusterNode' : 'codeNode',
      position: { x: 0, y: 0 }, // Will be set by layout algorithm
      data: {
        // Identity
        id: nodeData.id,
        label: nodeData.id.split('/').pop(),
        fullPath: nodeData.id,

        // Language & Environment
        lang: nodeData.lang,
        env: nodeData.env,

        // Status flags
        changed: nodeData.changed || false,
        isCluster: nodeData.isCluster || false,

        // Metrics
        metrics: {
          loc: nodeData.loc || nodeData.fileSize / 30 || 50,
          complexity: nodeData.complexity || (nodeData.cx_q || 0) * 20 || 20,
          coverage: nodeData.coverage || 0,
          fanin: 0,  // Will be calculated from edges
          fanout: 0, // Will be calculated from edges
          depth: nodeData.depth || 0,
        },

        // Runtime data (if available)
        runtime: nodeData.runtime || null,

        // Timeseries data (will be populated later)
        timeseries: nodeData.timeseries || null,

        // Original data for Inspector
        _original: nodeData,
      },
    };
  });

  // Calculate fanin/fanout from edges
  const edgeList = graphData.edges || [];
  const faninMap = new Map();
  const fanoutMap = new Map();

  edgeList.forEach(edge => {
    const edgeData = edge.data || edge;
    const source = edgeData.source || edgeData.from;
    const target = edgeData.target || edgeData.to;

    faninMap.set(target, (faninMap.get(target) || 0) + 1);
    fanoutMap.set(source, (fanoutMap.get(source) || 0) + 1);
  });

  // Update nodes with fanin/fanout
  nodes.forEach(node => {
    node.data.metrics.fanin = faninMap.get(node.id) || 0;
    node.data.metrics.fanout = fanoutMap.get(node.id) || 0;
  });

  // Convert edges
  const edges = edgeList.map((edge, index) => {
    const edgeData = edge.data || edge;
    const source = edgeData.source || edgeData.from;
    const target = edgeData.target || edgeData.to;

    return {
      id: `e${index}-${source}-${target}`,
      source,
      target,
      type: edgeData.changed ? 'smoothstep' : 'default',
      animated: edgeData.changed || false,
      style: {
        stroke: edgeData.changed ? '#667eea' : '#666',
        strokeWidth: edgeData.changed ? 3 : 2,
      },
      data: {
        changed: edgeData.changed || false,
        _original: edgeData,
      },
    };
  });

  return { nodes, edges };
}

/**
 * Generate stable mock timeseries data based on node ID
 * TODO: Replace with real data from graph.json
 */
export function generateMockTimeseries(nodeId) {
  // Create deterministic random based on node ID
  const seed = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (index) => {
    const x = Math.sin(seed + index) * 10000;
    return Math.abs(x - Math.floor(x));
  };

  return {
    churn: Array.from({ length: 8 }, (_, i) => Math.floor(random(i) * 10)),
    complexity: Array.from({ length: 5 }, (_, i) => Math.floor(random(i + 10) * 100)),
    coverage: Array.from({ length: 4 }, (_, i) => Math.floor(random(i + 20) * 100)),
  };
}

/**
 * Enrich nodes with timeseries data
 */
export function enrichNodesWithTimeseries(nodes) {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      timeseries: node.data.timeseries || generateMockTimeseries(node.id),
    },
  }));
}

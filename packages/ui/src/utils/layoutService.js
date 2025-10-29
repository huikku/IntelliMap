/**
 * Layout service for React Flow graphs
 * Supports ELK and Dagre layout algorithms
 */

import dagre from 'dagre';

/**
 * Apply layout algorithm to nodes
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {string} algorithm - 'elk' or 'dagre'
 * @param {string} direction - 'RIGHT', 'DOWN', 'LEFT', 'UP' for ELK or 'LR', 'TB', 'RL', 'BT' for Dagre
 * @returns {Array} Nodes with updated positions
 */
export async function layoutGraph(nodes, edges, algorithm = 'elk', direction = 'RIGHT') {
  if (algorithm === 'elk') {
    return await layoutWithELK(nodes, edges, direction);
  } else if (algorithm === 'dagre') {
    return layoutWithDagre(nodes, edges, direction);
  }

  // No layout, return nodes unchanged
  return nodes;
}

/**
 * Layout with ELK (Eclipse Layout Kernel)
 */
async function layoutWithELK(nodes, edges, direction = 'RIGHT') {
  try {
    // Separate connected and isolated nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    const connectedNodeIds = new Set();

    edges.forEach(edge => {
      if (nodeIds.has(edge.source)) connectedNodeIds.add(edge.source);
      if (nodeIds.has(edge.target)) connectedNodeIds.add(edge.target);
    });

    const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
    const isolatedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));

    console.log(`📊 Layout: ${connectedNodes.length} connected, ${isolatedNodes.length} isolated nodes`);

    // Layout connected nodes with ELK
    let layoutedNodes = [];

    if (connectedNodes.length > 0) {
      const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
      const elk = new ELK();

      const graph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': direction,
          'elk.spacing.nodeNode': '80',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
          'elk.layered.spacing.edgeEdgeBetweenLayers': '30',
          'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
          'elk.padding': '[top=50,left=50,bottom=50,right=50]',
        },
        children: connectedNodes.map(node => ({
          id: node.id,
          width: getNodeWidth(node),
          height: getNodeHeight(node),
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      };

      const layout = await elk.layout(graph);

      layoutedNodes = connectedNodes.map(node => {
        const layoutNode = layout.children.find(n => n.id === node.id);
        if (!layoutNode) return node;

        return {
          ...node,
          position: {
            x: layoutNode.x || 0,
            y: layoutNode.y || 0,
          },
        };
      });
    }

    // Layout isolated nodes in a grid to the right of the main graph
    if (isolatedNodes.length > 0) {
      const cols = Math.min(8, Math.ceil(Math.sqrt(isolatedNodes.length)));
      const nodeWidth = 200;
      const nodeHeight = 150;
      const spacingX = 100;
      const spacingY = 80;

      // Calculate bounds of connected graph to position isolated nodes to the right
      let maxX = 0;
      let minY = 0;

      if (layoutedNodes.length > 0) {
        maxX = Math.max(...layoutedNodes.map(n => n.position.x + getNodeWidth(n)));
        minY = Math.min(...layoutedNodes.map(n => n.position.y));
      }

      // Position isolated nodes to the right of the main graph with padding
      const startX = maxX + 200; // 200px padding from main graph
      const startY = minY || 50;

      const isolatedLayouted = isolatedNodes.map((node, index) => ({
        ...node,
        position: {
          x: startX + (index % cols) * (nodeWidth + spacingX),
          y: startY + Math.floor(index / cols) * (nodeHeight + spacingY),
        },
      }));

      layoutedNodes = [...layoutedNodes, ...isolatedLayouted];
    }

    return layoutedNodes;
  } catch (error) {
    console.error('ELK layout failed:', error);
    return fallbackLayout(nodes);
  }
}

/**
 * Layout with Dagre
 */
function layoutWithDagre(nodes, edges, direction = 'LR') {
  // Separate connected and isolated nodes
  const nodeIds = new Set(nodes.map(n => n.id));
  const connectedNodeIds = new Set();

  edges.forEach(edge => {
    if (nodeIds.has(edge.source)) connectedNodeIds.add(edge.source);
    if (nodeIds.has(edge.target)) connectedNodeIds.add(edge.target);
  });

  const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
  const isolatedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));

  console.log(`📊 Dagre Layout: ${connectedNodes.length} connected, ${isolatedNodes.length} isolated nodes`);

  let layoutedNodes = [];

  // Layout connected nodes with Dagre
  if (connectedNodes.length > 0) {
    const g = new dagre.graphlib.Graph();

    g.setGraph({
      rankdir: direction,
      nodesep: 80,
      ranksep: 100,
      marginx: 50,
      marginy: 50,
    });

    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to graph
    connectedNodes.forEach(node => {
      g.setNode(node.id, {
        width: getNodeWidth(node),
        height: getNodeHeight(node),
      });
    });

    // Add edges to graph
    edges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });

    try {
      dagre.layout(g);

      layoutedNodes = connectedNodes.map(node => {
        const position = g.node(node.id);
        if (!position) return node;

        return {
          ...node,
          position: {
            x: position.x - position.width / 2,
            y: position.y - position.height / 2,
          },
        };
      });
    } catch (error) {
      console.error('Dagre layout failed:', error);
      layoutedNodes = connectedNodes;
    }
  }

  // Layout isolated nodes in a grid to the right of the main graph
  if (isolatedNodes.length > 0) {
    const cols = Math.min(8, Math.ceil(Math.sqrt(isolatedNodes.length)));
    const nodeWidth = 200;
    const nodeHeight = 150;
    const spacingX = 100;
    const spacingY = 80;

    // Calculate bounds of connected graph to position isolated nodes to the right
    let maxX = 0;
    let minY = 0;

    if (layoutedNodes.length > 0) {
      maxX = Math.max(...layoutedNodes.map(n => n.position.x + getNodeWidth(n)));
      minY = Math.min(...layoutedNodes.map(n => n.position.y));
    }

    // Position isolated nodes to the right of the main graph with padding
    const startX = maxX + 200; // 200px padding from main graph
    const startY = minY || 50;

    const isolatedLayouted = isolatedNodes.map((node, index) => ({
      ...node,
      position: {
        x: startX + (index % cols) * (nodeWidth + spacingX),
        y: startY + Math.floor(index / cols) * (nodeHeight + spacingY),
      },
    }));

    layoutedNodes = [...layoutedNodes, ...isolatedLayouted];
  }

  return layoutedNodes.length > 0 ? layoutedNodes : fallbackLayout(nodes);
}

/**
 * Get node width based on type and zoom level
 */
function getNodeWidth(node) {
  if (node.data?.isCluster) {
    return 220;
  }

  // Standard code node width (updated to match CSS)
  return 200;
}

/**
 * Get node height based on type and content
 */
function getNodeHeight(node) {
  if (node.data?.isCluster) {
    return 120;
  }

  // Standard code node height (accounts for title + metrics + health bars)
  // Base: 32 (title) + 60 (metrics) + 60 (health bars)
  return 150;
}

/**
 * Fallback layout: simple grid
 */
function fallbackLayout(nodes) {
  const cols = Math.ceil(Math.sqrt(nodes.length));

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % cols) * 250,
      y: Math.floor(index / cols) * 150,
    },
  }));
}

/**
 * Detect port direction from layout configuration
 */
export function getPortDirection(algorithm, direction) {
  if (algorithm === 'elk') {
    return (direction === 'RIGHT' || direction === 'LEFT') ? 'horizontal' : 'vertical';
  }

  if (algorithm === 'dagre') {
    return (direction === 'LR' || direction === 'RL') ? 'horizontal' : 'vertical';
  }

  return 'horizontal';
}

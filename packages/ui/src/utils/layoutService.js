/**
 * Layout service for React Flow graphs
 * Supports ELK and Dagre layout algorithms
 */

import ELK from 'elkjs';
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
  const elk = new ELK();

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '50',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: nodes.map(node => ({
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

  try {
    const layout = await elk.layout(graph);

    return nodes.map(node => {
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
  } catch (error) {
    console.error('ELK layout failed:', error);
    return fallbackLayout(nodes);
  }
}

/**
 * Layout with Dagre
 */
function layoutWithDagre(nodes, edges, direction = 'LR') {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 50,
    marginx: 20,
    marginy: 20,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to graph
  nodes.forEach(node => {
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

    return nodes.map(node => {
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
    return fallbackLayout(nodes);
  }
}

/**
 * Get node width based on type and zoom level
 */
function getNodeWidth(node) {
  if (node.data?.isCluster) {
    return 200;
  }

  // Standard code node width
  return 180;
}

/**
 * Get node height based on type and content
 */
function getNodeHeight(node) {
  if (node.data?.isCluster) {
    return 100;
  }

  // Standard code node height
  return 80;
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

/**
 * GraphView with LiteGraph-Style Node Rendering
 *
 * This file shows the changes needed to integrate the litegraphStyleRenderer
 * into the existing GraphView.jsx
 *
 * INTEGRATION INSTRUCTIONS:
 * 1. Add the import at the top of GraphView.jsx
 * 2. Replace the node style configuration (around line 310-426)
 * 3. Add zoom listener to update node rendering
 * 4. Add layout detection to set port direction
 */

// =======================
// 1. ADD THIS IMPORT
// =======================
import { nodeRenderer } from '../utils/litegraphStyleRenderer';

// =======================
// 2. ADD THIS HELPER FUNCTION
// (Place after getNodeColor function, around line 62)
// =======================

/**
 * Detect port direction from layout configuration
 */
function getPortDirection(layoutConfig) {
  const layoutName = layoutConfig.name;

  // ELK layout
  if (layoutName === 'elk') {
    const direction = layoutConfig.elk?.['elk.direction'] || 'DOWN';
    // RIGHT/LEFT = horizontal = left/right ports
    // DOWN/UP = vertical = top/bottom ports
    return (direction === 'RIGHT' || direction === 'LEFT') ? 'horizontal' : 'vertical';
  }

  // Dagre layout
  if (layoutName === 'dagre') {
    const rankDir = layoutConfig.rankDir || 'TB';
    // LR/RL = horizontal, TB/BT = vertical
    return (rankDir === 'LR' || rankDir === 'RL') ? 'horizontal' : 'vertical';
  }

  // Force layouts (fcose, cola, euler) - assume vertical
  return 'vertical';
}

/**
 * Generate mock timeseries data for testing
 * TODO: Replace with real data from graph.json
 */
function generateMockTimeseries(nodeId) {
  // Generate random but consistent data based on node ID
  const seed = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (index) => {
    const x = Math.sin(seed + index) * 10000;
    return Math.abs(x - Math.floor(x));
  };

  return {
    churn: Array.from({ length: 8 }, (_, i) => Math.floor(random(i) * 10)),
    complexity: Array.from({ length: 5 }, (_, i) => Math.floor(random(i + 10) * 100)),
    coverage: Array.from({ length: 4 }, (_, i) => Math.floor(random(i + 20) * 100))
  };
}

// =======================
// 3. REPLACE THE NODE STYLE IN CYTOSCAPE INITIALIZATION
// (Replace the entire 'node' selector block starting at line 310)
// =======================

// Inside cytoscape({...}), replace the style array with:
const style = [
  // LiteGraph-Style Nodes
  {
    selector: 'node',
    style: {
      // Use canvas-rendered image
      'width': 240,
      'height': 120,
      'shape': 'roundrectangle',
      'background-fit': 'cover',
      'background-clip': 'none',
      'background-image': (node) => {
        if (node.data('isCluster')) {
          // Keep cluster nodes simple for now
          return '';
        }

        // Enhance node data with metrics and timeseries
        const enhancedData = {
          id: node.data('id'),
          label: node.data('label'),
          lang: node.data('lang'),
          env: node.data('env'),
          changed: node.data('changed'),
          metrics: {
            loc: node.data('loc') || node.data('fileSize') / 30 || 50,
            complexity: node.data('complexity') || node.data('cx_q') * 20 || 20,
            coverage: Math.floor(Math.random() * 100), // TODO: Get from graph
            fanin: 0, // TODO: Calculate from edges
            fanout: 0, // TODO: Calculate from edges
            depth: 0,
            avgTime: Math.random() > 0.7 ? Math.floor(Math.random() * 500) : 0
          },
          timeseries: generateMockTimeseries(node.data('id')),
          status: {
            hotspot: node.data('complexity') > 75 || (node.data('complexity') > 50 && node.data('changed')),
            lowCoverage: Math.random() < 0.2,
            needsRefactor: node.data('cx_q') > 4
          }
        };

        const zoom = cy.zoom();
        return nodeRenderer.render(enhancedData, zoom);
      },
      'background-opacity': 1,
      'border-width': 0, // Border is part of canvas image

      // Cluster nodes (keep original style)
      'background-color': node => {
        if (node.data('isCluster')) return '#1f2937';
        return 'transparent';
      },
      'label': node => {
        if (node.data('isCluster')) return node.data('label');
        return ''; // Labels are rendered in canvas
      },
      'font-family': 'Barlow Condensed, sans-serif',
      'font-size': 12,
      'font-weight': 'bold',
      'color': '#fff',
      'text-valign': 'top',
      'text-halign': 'center',
      'padding': node => (node.data('isCluster') ? 15 : 0),
      'compound-sizing-wrt-labels': 'include',
    },
  },

  // Selected Node
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#8b7355',
      'border-style': 'solid',
    },
  },

  // Edge Styles (keep original, but adjust for fixed connection points)
  {
    selector: 'edge',
    style: {
      'line-color': 'data(edgeColor)',
      'target-arrow-color': 'data(edgeColor)',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 1.5,
      'width': 'data(edgeWidth)',
      'curve-style': 'bezier',
      'opacity': 'data(edgeOpacity)',

      // Connection points - adjust based on port direction
      // These will be set dynamically after detecting layout
      'source-endpoint': '0deg 50%', // Will be updated
      'target-endpoint': '180deg 50%', // Will be updated

      'source-distance-from-node': 5,
      'target-distance-from-node': 5,

      'label': edge => {
        const from = edge.data('source');
        const to = edge.data('target');
        const parallelEdges = edge.cy().edges().filter(e =>
          (e.data('source') === from && e.data('target') === to) ||
          (e.data('source') === to && e.data('target') === from)
        );
        return parallelEdges.length > 1 ? `${parallelEdges.length}` : '';
      },
      'font-size': 10,
      'font-family': 'Barlow Condensed, sans-serif',
      'text-background-color': '#000',
      'text-background-opacity': 0.9,
      'text-background-padding': 2,
      'color': '#b8b8b8',
    },
  },

  // Edge Selected
  {
    selector: 'edge:selected',
    style: {
      'line-color': '#a0a0a0',
      'target-arrow-color': '#a0a0a0',
      'width': 3,
      'opacity': 1,
    },
  },

  // Keep all other selectors (search-highlight, in-cycle, highlighted, etc.)
  // ... (copy from original)
];

// =======================
// 4. AFTER CREATING CYTOSCAPE INSTANCE (after line 542)
// Add this code to detect layout and update port direction
// =======================

// Detect and set port direction based on layout
const layoutConfig = {
  name: 'elk',
  elk: {
    algorithm: 'layered',
    'elk.direction': 'RIGHT', // Change this based on your layout preference
    'elk.spacing.nodeNode': 50,
    'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
  },
};

const portDirection = getPortDirection(layoutConfig);
console.log(`🔌 Port direction: ${portDirection} (based on layout: ${layoutConfig.name})`);

// Set port direction in renderer
nodeRenderer.setPortDirection(portDirection);

// Update edge endpoints based on port direction
if (portDirection === 'horizontal') {
  // Horizontal layout: input on left (180deg), output on right (0deg)
  cy.style()
    .selector('edge')
    .style({
      'source-endpoint': '0deg 50%', // Right side (output)
      'target-endpoint': '180deg 50%', // Left side (input)
    })
    .update();
} else {
  // Vertical layout: input on top (180deg), output on bottom (0deg)
  cy.style()
    .selector('edge')
    .style({
      'source-endpoint': '0deg 50%', // Bottom (output)
      'target-endpoint': '180deg 50%', // Top (input)
    })
    .update();
}

// =======================
// 5. ADD ZOOM LISTENER (after line 584)
// =======================

// Update node rendering on zoom
cy.on('zoom', () => {
  const zoom = cy.zoom();

  // Only update if zoom changed significantly (reduce unnecessary renders)
  const zoomKey = Math.round(zoom * 10) / 10;
  if (cy._lastZoomKey === zoomKey) return;
  cy._lastZoomKey = zoomKey;

  console.log(`🔍 Zoom changed to ${zoom.toFixed(2)}, updating node rendering...`);

  // Re-render all nodes with new zoom level
  cy.nodes().forEach(node => {
    if (node.data('isCluster')) return; // Skip cluster nodes

    const enhancedData = {
      id: node.data('id'),
      label: node.data('label'),
      lang: node.data('lang'),
      env: node.data('env'),
      changed: node.data('changed'),
      metrics: {
        loc: node.data('loc') || node.data('fileSize') / 30 || 50,
        complexity: node.data('complexity') || node.data('cx_q') * 20 || 20,
        coverage: Math.floor(Math.random() * 100),
        fanin: 0,
        fanout: 0,
        depth: 0,
        avgTime: Math.random() > 0.7 ? Math.floor(Math.random() * 500) : 0
      },
      timeseries: generateMockTimeseries(node.data('id')),
      status: {
        hotspot: node.data('complexity') > 75,
        lowCoverage: Math.random() < 0.2
      }
    };

    node.style('background-image', nodeRenderer.render(enhancedData, zoom));
  });
});

// =======================
// 6. OPTIONAL: ADD LAYOUT SWITCHER
// This allows users to change between vertical/horizontal layouts
// =======================

// Add this as a method you can call from Toolbar or controls
function switchLayout(newLayout) {
  const layoutConfigs = {
    'elk-vertical': {
      name: 'elk',
      elk: {
        algorithm: 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': 80,
        'elk.layered.spacing.nodeNodeBetweenLayers': 100,
      },
    },
    'elk-horizontal': {
      name: 'elk',
      elk: {
        algorithm: 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': 50,
        'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
      },
    },
    'dagre-vertical': {
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 80,
      rankSep: 100,
    },
    'dagre-horizontal': {
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 50,
      rankSep: 80,
    },
    'fcose': {
      name: 'fcose',
      quality: 'default',
      randomize: false,
      animate: true,
      animationDuration: 1000,
    },
  };

  const layoutConfig = layoutConfigs[newLayout] || layoutConfigs['elk-horizontal'];
  const portDirection = getPortDirection(layoutConfig);

  console.log(`🔄 Switching to layout: ${newLayout}, port direction: ${portDirection}`);

  // Update port direction
  nodeRenderer.setPortDirection(portDirection);

  // Update edge endpoints
  if (portDirection === 'horizontal') {
    cy.style()
      .selector('edge')
      .style({
        'source-endpoint': '0deg 50%',
        'target-endpoint': '180deg 50%',
      })
      .update();
  } else {
    cy.style()
      .selector('edge')
      .style({
        'source-endpoint': '0deg 50%',
        'target-endpoint': '180deg 50%',
      })
      .update();
  }

  // Re-render all nodes with new port direction
  cy.nodes().forEach(node => {
    if (node.data('isCluster')) return;

    const enhancedData = {
      id: node.data('id'),
      label: node.data('label'),
      lang: node.data('lang'),
      env: node.data('env'),
      changed: node.data('changed'),
      metrics: {
        loc: node.data('loc') || 50,
        complexity: node.data('complexity') || 20,
        coverage: Math.floor(Math.random() * 100),
        fanin: 0,
        fanout: 0,
        depth: 0
      },
      timeseries: generateMockTimeseries(node.data('id')),
      status: {
        hotspot: false,
        lowCoverage: false
      }
    };

    node.style('background-image', nodeRenderer.render(enhancedData, cy.zoom()));
  });

  // Apply new layout
  cy.layout(layoutConfig).run();
}

// =======================
// SUMMARY OF CHANGES:
// =======================
/*
1. Import nodeRenderer from '../utils/litegraphStyleRenderer'

2. Add getPortDirection() helper function

3. Replace node style configuration to use:
   - 'background-image': nodeRenderer.render(enhancedData, zoom)
   - width: 240, height: 120
   - shape: 'roundrectangle'

4. After cy initialization:
   - Detect port direction from layout config
   - Set port direction in renderer
   - Update edge endpoints based on direction

5. Add zoom listener to re-render nodes

6. Optional: Add switchLayout() function for dynamic layout changes

TEST IT:
- Nodes should now have colored title bars
- Nodes should show sparklines and metrics
- Ports should appear on correct sides based on layout
- Everything should work with existing features (selection, hover, etc.)
*/

export { getPortDirection, generateMockTimeseries, switchLayout };

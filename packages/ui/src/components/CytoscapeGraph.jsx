import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import cytoscapeNavigator from 'cytoscape-navigator';
import 'cytoscape-navigator/cytoscape.js-navigator.css';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import euler from 'cytoscape-euler';
import cola from 'cytoscape-cola';
import { nodeRenderer } from '../utils/litegraphStyleRenderer';

// Import elk separately to handle dynamic require issue
import cytoscapeElk from 'cytoscape-elk';
import ELK from 'elkjs/lib/elk.bundled.js';

// Register elk with the bundled ELK instance
cytoscape.use(cytoscapeElk);
cytoscape.use(dagre);
cytoscape.use(fcose);
cytoscape.use(euler);
cytoscape.use(cola);
cytoscape.use(cytoscapeNavigator);

// Helper to classify node type based on filename
function getNodeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const typeMap = {
    'jsx': 'component',
    'tsx': 'component',
    'js': 'module',
    'ts': 'module',
    'py': 'module',
    'css': 'style',
    'scss': 'style',
    'json': 'config',
    'md': 'doc',
  };
  return typeMap[ext] || 'file';
}

/**
 * CytoscapeGraph - Cytoscape.js renderer component
 * Separated from GraphView to avoid React hooks violations
 */
export function CytoscapeGraph({
  filteredNodes,
  filteredEdges,
  selectedNode,
  setSelectedNode,
  cyRef,
  clustering,
  setCyInstance,
  edgeOpacity,
  curveStyle,
  navigationMode,
  layout,
}) {
  const containerRef = useRef(null);
  const edgeOpacityRef = useRef(edgeOpacity);
  const curveStyleRef = useRef(curveStyle);

  // Keep refs in sync with props
  useEffect(() => {
    edgeOpacityRef.current = edgeOpacity;
  }, [edgeOpacity]);

  useEffect(() => {
    curveStyleRef.current = curveStyle;
  }, [curveStyle]);

  // Main Cytoscape initialization effect
  useEffect(() => {
    if (!filteredNodes || !containerRef.current) {
      console.log('CytoscapeGraph: Skipping render - nodes:', !!filteredNodes, 'container:', !!containerRef.current);
      return;
    }

    console.log('🎨 CytoscapeGraph rendering with', filteredNodes.length, 'nodes');

    // Pre-compute node data ONCE before creating Cytoscape
    console.log('⚡ Pre-computing node data...');
    const nodeDataMap = new Map();
    
    filteredNodes.forEach(node => {
      const nodeId = node.id;
      const fanin = filteredEdges.filter(e => e.to === nodeId).length;
      const fanout = filteredEdges.filter(e => e.from === nodeId).length;
      
      nodeDataMap.set(nodeId, {
        fanin,
        fanout,
        coverage: node.coverage || 0,
        complexity: node.complexity || 0,
        loc: node.loc || 0,
        churn: node.churn || [],
      });
    });

    const cyInstance = cytoscape({
      container: containerRef.current,
      elements: [
        ...filteredNodes.map(n => ({
          data: {
            id: n.id,
            label: n.label || n.id,
            ...n,
            // Add pre-computed data
            ...nodeDataMap.get(n.id),
          },
        })),
        ...filteredEdges.map(e => ({
          data: {
            id: `${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            ...e,
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'width': 180,
            'height': 80,
            'shape': 'rectangle',
            'background-color': '#1e1e1e',
            'border-width': 2,
            'border-color': (node) => {
              const data = node.data();
              if (data.changed) return '#ff6b6b';
              if (data.env === 'backend') return '#4ecdc4';
              return '#667eea';
            },
            'label': 'data(label)',
            'color': '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 12,
            'font-family': 'Barlow Condensed, sans-serif',
            'background-image': (node) => {
              const enhancedData = node.data();
              // Use default zoom 1.0 for initial render (will be updated by zoom handler)
              return nodeRenderer.render(enhancedData, 1.0);
            },
            'background-fit': 'contain',
            'background-clip': 'none',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#ffd93d',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#3a3a3a',
            'target-arrow-color': '#3a3a3a',
            'target-arrow-shape': 'triangle',
            'curve-style': () => curveStyleRef.current || 'bezier',
            'opacity': () => edgeOpacityRef.current || 1.0,
            'arrow-scale': 1.5,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#ffd93d',
            'target-arrow-color': '#ffd93d',
            'width': 3,
          },
        },
      ],
      layout: {
        name: layout || 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '50',
          'elk.layered.spacing.nodeNodeBetweenLayers': '50',
        },
      },
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2,
      // Enable user interaction
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    // Store instance in ref
    cyRef.current = cyInstance;
    if (setCyInstance) {
      setCyInstance(cyInstance);
    }

    // Add navigator with visible container
    const navContainer = document.createElement('div');
    navContainer.id = 'cy-navigator';
    navContainer.style.position = 'absolute';
    navContainer.style.bottom = '20px';
    navContainer.style.right = '20px';
    navContainer.style.width = '200px';
    navContainer.style.height = '200px';
    navContainer.style.border = '2px solid #2F5060';
    navContainer.style.borderRadius = '8px';
    navContainer.style.overflow = 'hidden';
    navContainer.style.backgroundColor = 'rgba(35, 60, 75, 0.9)';
    navContainer.style.zIndex = '1000';
    containerRef.current.appendChild(navContainer);

    cyInstance.navigator({
      container: navContainer,
      viewLiveFramerate: 30,
      thumbnailEventFramerate: 30,
      thumbnailLiveFramerate: 30,
      dblClickDelay: 200,
      removeCustomContainer: false,
      rerenderDelay: 100,
    });

    // Add zoom event handler to update node rendering
    let zoomTimeout;
    cyInstance.on('zoom', () => {
      // Debounce zoom updates to avoid excessive re-rendering
      clearTimeout(zoomTimeout);
      zoomTimeout = setTimeout(() => {
        const zoom = cyInstance.zoom();
        const zoomKey = Math.round(zoom * 4) / 4; // Update every 0.25 zoom change

        if (cyInstance._lastZoomKey === zoomKey) return;
        cyInstance._lastZoomKey = zoomKey;

        console.log(`🔍 Zoom changed to ${zoom.toFixed(2)}, updating node rendering...`);

        // Batch update all nodes
        cyInstance.batch(() => {
          cyInstance.nodes().forEach(node => {
            if (node.data('isCluster')) return;

            const enhancedData = node.data();
            if (!enhancedData) return;

            // Re-render with new zoom level
            const newImage = nodeRenderer.render(enhancedData, zoom);
            node.style('background-image', newImage);
          });
        });
      }, 150); // Wait 150ms after last zoom event
    });

    // Node selection handler
    cyInstance.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNode(node.data());
    });

    // Cleanup
    return () => {
      clearTimeout(zoomTimeout);
      if (cyInstance) {
        cyInstance.destroy();
      }
      if (navContainer && navContainer.parentNode) {
        navContainer.parentNode.removeChild(navContainer);
      }
      cyRef.current = null;
    };
  }, [filteredNodes, filteredEdges, clustering, layout, cyRef, setCyInstance, setSelectedNode]);

  // Separate effect for edge opacity
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.edges().style({
      'opacity': edgeOpacity,
    });
  }, [edgeOpacity, cyRef]);

  // Separate effect for curve style
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.edges().style({
      'curve-style': curveStyle,
    });
  }, [curveStyle, cyRef]);

  // Separate effect for navigation mode
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !navigationMode || !selectedNode || !selectedNode.id) {
      // Reset all nodes to normal if no navigation mode
      if (cy) {
        cy.nodes().removeClass('faded highlighted');
        cy.edges().removeClass('faded highlighted');
      }
      return;
    }

    const nodeId = selectedNode.id;
    let relevantNodeIds = new Set([nodeId]);
    let relevantEdgeIds = new Set();

    // Determine which nodes and edges to highlight based on navigation mode
    if (navigationMode === 'upstream' || navigationMode === 'parents') {
      // Show all nodes that this node depends on (incoming edges)
      cy.edges().forEach(edge => {
        if (edge.data('target') === nodeId) {
          relevantNodeIds.add(edge.data('source'));
          relevantEdgeIds.add(edge.id());
        }
      });
    } else if (navigationMode === 'downstream' || navigationMode === 'children') {
      // Show all nodes that depend on this node (outgoing edges)
      cy.edges().forEach(edge => {
        if (edge.data('source') === nodeId) {
          relevantNodeIds.add(edge.data('target'));
          relevantEdgeIds.add(edge.id());
        }
      });
    }

    // Apply highlighting
    cy.nodes().forEach(node => {
      if (relevantNodeIds.has(node.id())) {
        node.addClass('highlighted');
        node.removeClass('faded');
      } else {
        node.addClass('faded');
        node.removeClass('highlighted');
      }
    });

    cy.edges().forEach(edge => {
      if (relevantEdgeIds.has(edge.id())) {
        edge.addClass('highlighted');
        edge.removeClass('faded');
      } else {
        edge.addClass('faded');
        edge.removeClass('highlighted');
      }
    });

    console.log(`✅ Highlighted ${relevantNodeIds.size} nodes and ${relevantEdgeIds.size} edges`);
  }, [navigationMode, selectedNode, cyRef]);

  return (
    <div className="relative w-full h-full">
      <style>{`
        .faded {
          opacity: 0.2 !important;
        }
        .highlighted {
          opacity: 1 !important;
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}


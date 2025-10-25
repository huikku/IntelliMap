import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';
import cytoscapeNavigator from 'cytoscape-navigator';
import 'cytoscape-navigator/cytoscape.js-navigator.css';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import euler from 'cytoscape-euler';
import cola from 'cytoscape-cola';
import GraphHUD from './GraphHUD';

cytoscape.use(elk);
cytoscape.use(dagre);
cytoscape.use(fcose);
cytoscape.use(euler);
cytoscape.use(cola);
cytoscape.use(cytoscapeNavigator);

// Helper to classify node type based on filename
function getNodeType(filename) {
  if (filename.includes('component') || filename.includes('Component')) return 'component';
  if (filename.includes('hook') || filename.includes('Hook')) return 'hook';
  if (filename.includes('util') || filename.includes('helper') || filename.includes('Util')) return 'util';
  if (filename.includes('config') || filename.includes('Config')) return 'config';
  if (filename.includes('test') || filename.includes('spec')) return 'test';
  if (filename.includes('type') || filename.includes('interface')) return 'type';
  if (filename.includes('index')) return 'index';
  if (filename.includes('api') || filename.includes('service')) return 'service';
  return 'module';
}

// Helper to get shape based on node type
// Only use Cytoscape-supported shapes: rectangle, roundrectangle, ellipse, triangle, diamond, pentagon, hexagon, heptagon, octagon, star, vee, rhomboid, polygon
function getNodeShape(nodeType) {
  const shapes = {
    component: 'ellipse',
    hook: 'diamond',
    util: 'rectangle',
    config: 'roundrectangle',
    test: 'triangle',
    type: 'pentagon',
    index: 'star',
    service: 'hexagon',
    module: 'ellipse',
  };
  return shapes[nodeType] || 'ellipse';
}

// Helper to get color based on language and type - Nostromo Monochrome Palette
function getNodeColor(lang, nodeType, changed) {
  if (changed) return '#8b7355'; // Muted amber for changed

  // Monochrome palette with subtle variations
  const colorMap = {
    ts: { component: '#5a5a5a', hook: '#6a6a6a', util: '#4a4a4a', config: '#3a3a3a', service: '#2a2a2a', default: '#5a5a5a' },
    js: { component: '#6a6a6a', hook: '#7a7a7a', util: '#5a5a5a', config: '#4a4a4a', service: '#3a3a3a', default: '#6a6a6a' },
    py: { component: '#4a5a4a', hook: '#5a6a5a', util: '#3a4a3a', config: '#2a3a2a', service: '#1a2a1a', default: '#4a5a4a' },
  };

  const langColors = colorMap[lang] || colorMap.ts;
  return langColors[nodeType] || langColors.default;
}

export default function GraphView({ graph, plane, filters, selectedNode, setSelectedNode, cyRef, clustering = false, setCyInstance, edgeOpacity = 1.0, curveStyle = 'bezier-tight', navigationMode = null }) {
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

  useEffect(() => {
    if (!graph || !containerRef.current) {
      console.log('GraphView: Skipping render - graph:', !!graph, 'container:', !!containerRef.current);
      return;
    }

    console.log('🎨 GraphView rendering with', graph.nodes?.length || 0, 'nodes');
    console.log('📊 Graph object:', graph);
    console.log('📊 Plane:', plane, 'Filters:', filters);

    // Filter nodes based on plane and filters
    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;

    // Filter by plane (static/backend/diff)
    if (plane === 'backend') {
      filteredNodes = graph.nodes.filter(n => n.env === 'backend');
    } else if (plane === 'diff') {
      filteredNodes = graph.nodes.filter(n => n.changed);
    }

    // Apply additional filters
    if (filters.language !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.lang === filters.language);
    }

    if (filters.env !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.env === filters.env);
    }

    if (filters.showChanged) {
      filteredNodes = filteredNodes.filter(n => n.changed);
    }

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

    console.log('🔍 After filtering: nodes=', filteredNodes.length, 'edges=', filteredEdges.length);

    // Build node map for quick lookup
    const nodeMap = new Map();
    filteredNodes.forEach(n => {
      nodeMap.set(n.id, n);
    });

    // Detect unconnected nodes (nodes with no edges)
    const connectedNodeIds = new Set();
    filteredEdges.forEach(e => {
      connectedNodeIds.add(e.from);
      connectedNodeIds.add(e.to);
    });

    // Build Cytoscape elements with enhanced metadata
    let elements = [
      ...filteredNodes.map(n => {
        const filename = n.id.split('/').pop();
        const nodeType = getNodeType(filename);
        const isUnconnected = !connectedNodeIds.has(n.id);

        // Split filename and extension for multi-line label
        const lastDot = filename.lastIndexOf('.');
        const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename;
        const ext = lastDot > 0 ? filename.substring(lastDot) : '';

        return {
          data: {
            id: n.id,
            label: filename,
            baseName: baseName,
            ext: ext,
            lang: n.lang,
            env: n.env,
            changed: n.changed,
            nodeType,
            folder: n.folder,
            pkg: n.pkg,
            fileSize: n.size || 0,
            isUnconnected,
            // Metrics for visual encoding
            loc: n.loc || 50, // Lines of code
            complexity: n.complexity || 1, // Cyclomatic complexity
            loc_q: n.loc_q || 3, // LOC quantile (1-5)
            cx_q: n.cx_q || 3, // Complexity quantile (1-5)
            // parent will be set later if clustering is enabled
          },
        };
      }),
      ...filteredEdges.map((e, idx) => {
        // Calculate edge color based on source and target nodes
        const sourceNode = nodeMap.get(e.from);
        const targetNode = nodeMap.get(e.to);

        let edgeColor = '#6b7280'; // default gray
        let edgeWidth = 2;
        let edgeOpacity = 0.5; // default medium opacity
        let importance = 1; // 1-5 scale

        if (sourceNode && targetNode) {
          const sourceLang = sourceNode.lang;
          const targetLang = targetNode.lang;
          const sourceEnv = sourceNode.env;
          const targetEnv = targetNode.env;
          const isChanged = sourceNode.changed || targetNode.changed;

          // Frontend → Backend (API boundary) - VERY IMPORTANT
          if (sourceEnv === 'frontend' && targetEnv === 'backend') {
            edgeColor = isChanged ? '#fbbf24' : '#f59e0b'; // amber
            importance = 5; // API boundaries are critical
            edgeOpacity = 1.0;
          }
          // Backend → Frontend (unusual) - VERY IMPORTANT (potential issue)
          else if (sourceEnv === 'backend' && targetEnv === 'frontend') {
            edgeColor = isChanged ? '#f87171' : '#ef4444'; // red
            importance = 5; // Reverse dependencies are critical
            edgeOpacity = 1.0;
          }
          // Cross-language - IMPORTANT
          else if (sourceLang !== targetLang) {
            edgeColor = isChanged ? '#a78bfa' : '#8b5cf6'; // violet
            importance = 4; // Cross-language is important
            edgeOpacity = 0.8;
          }
          // Changed files - IMPORTANT
          else if (isChanged) {
            importance = 4; // Changed files are important
            edgeOpacity = 0.8;

            // TypeScript
            if (sourceLang === 'ts' || sourceLang === 'tsx') {
              edgeColor = '#60a5fa'; // blue
            }
            // JavaScript
            else if (sourceLang === 'js' || sourceLang === 'jsx') {
              edgeColor = '#fbbf24'; // yellow
            }
            // Python
            else if (sourceLang === 'py') {
              edgeColor = '#34d399'; // emerald
            }
          }
          // TypeScript - NORMAL
          else if (sourceLang === 'ts' || sourceLang === 'tsx') {
            edgeColor = '#3b82f6'; // blue
            importance = 2;
            edgeOpacity = 0.5;
          }
          // JavaScript - NORMAL
          else if (sourceLang === 'js' || sourceLang === 'jsx') {
            edgeColor = '#eab308'; // yellow
            importance = 2;
            edgeOpacity = 0.5;
          }
          // Python - NORMAL
          else if (sourceLang === 'py') {
            edgeColor = '#10b981'; // emerald
            importance = 2;
            edgeOpacity = 0.5;
          }

          edgeWidth = isChanged ? 2.5 : 2;

          // Debug logging for first few edges
          if (idx < 3) {
            console.log(`🎨 Edge ${e.from} → ${e.to}: lang=${sourceLang}→${targetLang}, env=${sourceEnv}→${targetEnv}, color=${edgeColor}, importance=${importance}, opacity=${edgeOpacity}`);
          }
        }

        return {
          data: {
            id: `${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            kind: e.kind || 'import',
            edgeColor: edgeColor,
            edgeWidth: edgeWidth,
            edgeOpacity: edgeOpacity,
            importance: importance,
          },
        };
      }),
    ];

    // Add cluster nodes if clustering is enabled
    if (clustering) {
      // Use parent directory (more granular than root folder)
      const parentDirs = new Set();
      filteredNodes.forEach(n => {
        const parts = n.id.split('/');
        if (parts.length > 1) {
          // Use parent directory (e.g., "src/components" instead of "src")
          const parentDir = parts.slice(0, -1).join('/');
          parentDirs.add(parentDir);
        }
      });

      const clusterElements = Array.from(parentDirs).map(dir => ({
        data: {
          id: `cluster-${dir}`,
          label: dir,
          isCluster: true,
        },
      }));

      // Update node parents to use parent directory
      elements = elements.map(el => {
        if (el.data.id && !el.data.isCluster) {
          const parts = el.data.id.split('/');
          if (parts.length > 1) {
            const parentDir = parts.slice(0, -1).join('/');
            return {
              ...el,
              data: {
                ...el.data,
                parent: `cluster-${parentDir}`,
              },
            };
          }
        }
        return el;
      });

      elements = [...clusterElements, ...elements];
    }

    console.log('🎨 Creating Cytoscape with', elements.length, 'elements');
    console.log('📊 First 3 elements:', elements.slice(0, 3));

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': node => {
              if (node.data('isCluster')) return '#1f2937';

              // Darken unconnected nodes
              const isUnconnected = node.data('isUnconnected');

              // Color code by file extension
              const ext = node.data('ext') || '';
              const extColors = {
                // JavaScript/TypeScript
                '.js': '#f7df1e',
                '.jsx': '#61dafb',
                '.ts': '#3178c6',
                '.tsx': '#3178c6',
                '.mjs': '#f7df1e',
                '.cjs': '#f7df1e',
                // Python
                '.py': '#3776ab',
                '.pyx': '#3776ab',
                '.pyi': '#3776ab',
                // Web
                '.html': '#e34c26',
                '.css': '#264de4',
                '.scss': '#cc6699',
                '.sass': '#cc6699',
                '.less': '#1d365d',
                // Config/Data
                '.json': '#5a5a5a',
                '.yaml': '#cb171e',
                '.yml': '#cb171e',
                '.toml': '#9c4221',
                '.xml': '#e34c26',
                // Markdown/Docs
                '.md': '#083fa1',
                '.mdx': '#083fa1',
                '.txt': '#6b7280',
                // Other
                '.sh': '#89e051',
                '.bash': '#89e051',
                '.zsh': '#89e051',
                '.rs': '#ce422b',
                '.go': '#00add8',
                '.java': '#b07219',
                '.c': '#555555',
                '.cpp': '#f34b7d',
                '.h': '#555555',
                '.hpp': '#f34b7d',
              };

              let color = extColors[ext.toLowerCase()] || getNodeColor(node.data('lang'), node.data('nodeType'), node.data('changed'));

              // Darken unconnected nodes by reducing brightness
              if (isUnconnected) {
                // Convert hex to RGB, reduce brightness by 50%, convert back
                const hex = color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);

                const darkenedR = Math.floor(r * 0.4);
                const darkenedG = Math.floor(g * 0.4);
                const darkenedB = Math.floor(b * 0.4);

                color = `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`;
              }

              return color;
            },
            'shape': node => {
              if (node.data('isCluster')) return 'rectangle';
              // Canonical shape: rectangle for all nodes
              return 'rectangle';
            },
            'label': node => {
              if (node.data('isCluster')) return node.data('label');
              // Single-line label: just the filename
              return node.data('label') || '';
            },
            'text-valign': 'center',
            'text-halign': 'center',
            'font-family': 'Barlow Condensed, sans-serif',
            'font-size': node => {
              if (node.data('isCluster')) return 12;
              // Larger font to fill the box better
              return 11;
            },
            'font-weight': node => (node.data('isCluster') ? 'bold' : 'normal'),
            'color': '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 1.5,
            'border-width': node => {
              if (node.data('isCluster')) return 2;
              // Border thickness encodes complexity quantile (1-5 → 1-4px)
              const cx_q = node.data('cx_q') || 3;
              return Math.max(1, Math.min(4, cx_q));
            },
            'border-color': node => {
              if (node.data('isCluster')) return '#4b5563';
              // Changed files get amber border
              return node.data('changed') ? '#8b7355' : '#3a3a3a';
            },
            'border-style': node => (node.data('isCluster') ? 'dashed' : 'solid'),
            'width': 150, // RECTANGLES: Fixed width
            'height': 30, // RECTANGLES: Fixed height (5:1 ratio)
            'padding': node => (node.data('isCluster') ? 15 : 4),
            'text-wrap': 'ellipsis', // Truncate with ... if too long
            'text-max-width': node => {
              if (node.data('isCluster')) return 200;
              // Text should fill almost the entire width (minus padding)
              const width = node.width ? node.width() : 150;
              return width - 8; // Leave 4px padding on each side
            },
            'compound-sizing-wrt-labels': 'include',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#fbbf24',
            'background-color': node => {
              if (node.data('isCluster')) return '#2d3748';
              return getNodeColor(node.data('lang'), node.data('nodeType'), node.data('changed'));
            },
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': 'data(edgeColor)',
            'target-arrow-color': 'data(edgeColor)',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.5,
            'width': 'data(edgeWidth)',
            'curve-style': 'unbundled-bezier',
            'control-point-distances': [40, -40],
            'control-point-weights': [0.25, 0.75],
            'opacity': 'data(edgeOpacity)', // Use importance-based opacity
            'label': edge => {
              // Count parallel edges between same nodes
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
            'text-outline-width': 0,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#a0a0a0',
            'target-arrow-color': '#a0a0a0',
            'width': 3,
            'opacity': 1,
          },
        },
        {
          selector: '.search-highlight',
          style: {
            'border-width': 4,
            'border-color': '#a0a0a0',
            'border-opacity': 1,
            'background-color': '#6a6a6a',
            'transition-property': 'border-width, border-color, background-color',
            'transition-duration': '0.3s',
          },
        },
        {
          selector: 'node.in-cycle',
          style: {
            'border-width': 3,
            'border-color': '#8b7355',
            'border-opacity': 1,
            'background-color': '#5a4a3a',
          },
        },
        {
          selector: 'edge.in-cycle',
          style: {
            'line-color': '#8b7355',
            'target-arrow-color': '#8b7355',
            'width': 3,
            'opacity': 1,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 4,
            'border-color': '#4a5a4a',
            'border-opacity': 1,
            'background-color': '#2a3a2a',
            'z-index': 999,
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#4a5a4a',
            'target-arrow-color': '#4a5a4a',
            'width': 3,
            'opacity': 1,
            'z-index': 999,
          },
        },
      ],
      layout: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': 50,
          'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
        },
      },
      // Zoom configuration
      wheelSensitivity: 0.2, // Reduce mouse wheel zoom speed (default is 1)
      minZoom: 0.1,
      maxZoom: 3,
    });

    cy.on('tap', 'node', e => {
      setSelectedNode(e.target.data());
    });

    // Handle edge clicks
    cy.on('tap', 'edge', e => {
      const edgeData = e.target.data();
      setSelectedNode({
        from: edgeData.source,
        to: edgeData.target,
        type: edgeData.type,
      });
    });

    // Handle edge hover - manually apply styles since :hover pseudo-selector doesn't work
    cy.on('mouseover', 'edge', e => {
      const edge = e.target;
      edge.data('originalWidth', edge.style('width'));
      edge.style({
        'line-color': '#6a6a6a',
        'target-arrow-color': '#6a6a6a',
        'width': 3,
        'opacity': 1,
      });
    });

    cy.on('mouseout', 'edge', e => {
      const edge = e.target;
      const originalWidth = edge.data('originalWidth') || edge.data('edgeWidth') || 2;
      const baseOpacity = edge.data('edgeOpacity') || 0.5;
      // Apply the current opacity multiplier when restoring
      const originalOpacity = baseOpacity * edgeOpacity;
      edge.style({
        'line-color': edge.data('edgeColor'),
        'target-arrow-color': edge.data('edgeColor'),
        'width': originalWidth,
        'opacity': originalOpacity, // Restore importance-based opacity with current multiplier
      });
    });

    cyRef.current = cy;

    // Apply initial edge opacity using ref (won't trigger re-render)
    console.log(`🔗 Initial edge opacity multiplier: ${edgeOpacityRef.current}`);
    cy.edges().forEach(edge => {
      const baseOpacity = edge.data('edgeOpacity') || 0.5;
      const newOpacity = baseOpacity * edgeOpacityRef.current;
      edge.style('opacity', newOpacity);
    });

    // Initial curve style will be applied by the separate effect
    console.log(`📐 Initial curve style: ${curveStyleRef.current}`);

    // Debug: Check edge colors
    console.log('🔍 Checking edge colors in Cytoscape:');
    cy.edges().slice(0, 3).forEach(edge => {
      const data = edge.data();
      const computedColor = edge.style('line-color');
      console.log(`  Edge ${data.source} → ${data.target}:`);
      console.log(`    - edgeColor data: ${data.edgeColor}`);
      console.log(`    - computed line-color: ${computedColor}`);
    });

    // Notify parent that cy instance has changed
    if (setCyInstance) {
      setCyInstance(cy);
    }

    // Initialize minimap navigator
    let nav = null;
    try {
      nav = cy.navigator({
        container: false, // Use default container
        viewLiveFramerate: 0, // Update on graph changes
        thumbnailEventFramerate: 30,
        thumbnailLiveFramerate: false,
        dblClickDelay: 200,
        removeCustomContainer: true,
        rerenderDelay: 100,
      });
      console.log('🗺️ Minimap navigator initialized');
    } catch (error) {
      console.error('❌ Failed to initialize navigator:', error);
    }

    return () => {
      if (nav && nav.destroy) {
        nav.destroy();
      }
      cy.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, plane, filters, setSelectedNode, clustering, setCyInstance]);

  // Separate effect for edge opacity - updates without recreating the graph
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    console.log(`🔗 Applying edge opacity multiplier: ${edgeOpacity}`);
    cy.edges().forEach(edge => {
      const baseOpacity = edge.data('edgeOpacity') || 0.5;
      const newOpacity = baseOpacity * edgeOpacity;
      edge.style('opacity', newOpacity);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeOpacity]);

  // Separate effect for curve style - updates without recreating the graph
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    console.log(`📐 Applying curve style: ${curveStyle}`);
    if (curveStyle === 'straight') {
      cy.style().selector('edge').style({
        'curve-style': 'straight',
      }).update();
    } else if (curveStyle === 'bezier-smooth') {
      cy.style().selector('edge').style({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': edge => {
          const source = edge.source().position();
          const target = edge.target().position();
          const dx = Math.abs(target.x - source.x);
          const dy = Math.abs(target.y - source.y);
          const offset = Math.min(dx, dy) * 0.3;
          return [offset, -offset];
        },
        'control-point-weights': [0.25, 0.75],
      }).update();
    } else if (curveStyle === 'bezier-tight') {
      cy.style().selector('edge').style({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': edge => {
          const source = edge.source().position();
          const target = edge.target().position();
          const dx = Math.abs(target.x - source.x);
          const dy = Math.abs(target.y - source.y);
          const offset = Math.min(dx, dy) * 0.15;
          return [offset, -offset];
        },
        'control-point-weights': [0.25, 0.75],
      }).update();
    } else if (curveStyle === 'taxi') {
      cy.style().selector('edge').style({
        'curve-style': 'taxi',
        'taxi-direction': 'auto',
        'taxi-turn': 20,
        'taxi-turn-min-distance': 10,
      }).update();
    } else if (curveStyle === 'segments-ortho') {
      cy.style().selector('edge').style({
        'curve-style': 'segments',
        'segment-distances': edge => {
          const source = edge.source().position();
          const target = edge.target().position();
          const dx = target.x - source.x;
          const dy = target.y - source.y;

          if (Math.abs(dx) > Math.abs(dy)) {
            return [dy / 2, -dy / 2];
          } else {
            return [dx / 2, -dx / 2];
          }
        },
        'segment-weights': [0.33, 0.67],
      }).update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curveStyle]);

  // Separate effect for navigation mode - highlights/fades nodes based on dependencies
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !navigationMode || !selectedNode || !selectedNode.id) {
      // Reset all nodes and edges to normal when no navigation mode
      if (cy && !navigationMode) {
        cy.nodes().removeClass('faded highlighted');
        cy.edges().removeClass('faded highlighted');
        cy.nodes().style('opacity', 1);
        cy.edges().forEach(edge => {
          const baseOpacity = edge.data('edgeOpacity') || 0.5;
          edge.style('opacity', baseOpacity * edgeOpacityRef.current);
        });
      }
      return;
    }

    console.log(`🧭 Applying navigation mode: ${navigationMode} for node ${selectedNode.id}`);

    const targetNode = cy.getElementById(selectedNode.id);
    if (!targetNode || targetNode.length === 0) {
      console.warn('Selected node not found in graph');
      return;
    }

    let relevantNodes;
    let relevantEdges;

    switch (navigationMode) {
      case 'upstream':
        // All nodes that depend on this node (incoming edges, recursively)
        relevantNodes = targetNode.predecessors('node');
        relevantEdges = targetNode.predecessors('edge');
        break;

      case 'downstream':
        // All nodes this node depends on (outgoing edges, recursively)
        relevantNodes = targetNode.successors('node');
        relevantEdges = targetNode.successors('edge');
        break;

      case 'parents':
        // Direct parents only (1 level up)
        relevantNodes = targetNode.incomers('node');
        relevantEdges = targetNode.incomers('edge');
        break;

      case 'children':
        // Direct children only (1 level down)
        relevantNodes = targetNode.outgoers('node');
        relevantEdges = targetNode.outgoers('edge');
        break;

      case 'focus': {
        // Focus mode: Show all reachable nodes (both upstream and downstream)
        const downstream = targetNode.successors();
        const upstream = targetNode.predecessors();
        relevantNodes = downstream.union(upstream).nodes();
        relevantEdges = downstream.union(upstream).edges();
        break;
      }

      default:
        return;
    }

    // Add the selected node itself to relevant nodes
    relevantNodes = relevantNodes.union(targetNode);

    // Fade all nodes and edges
    cy.nodes().style('opacity', 0.15);
    cy.edges().style('opacity', 0.05);

    // Highlight relevant nodes and edges
    relevantNodes.style('opacity', 1);
    relevantEdges.forEach(edge => {
      const baseOpacity = edge.data('edgeOpacity') || 0.5;
      edge.style('opacity', baseOpacity * edgeOpacityRef.current);
    });

    // Make the selected node stand out even more
    targetNode.style('opacity', 1);

    console.log(`✅ Highlighted ${relevantNodes.length} nodes and ${relevantEdges.length} edges`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationMode, selectedNode]);

  return (
    <div className="relative w-full h-full">
      <style>{`
        /* Style the cytoscape navigator minimap */
        .cytoscape-navigator {
          position: absolute !important;
          bottom: 20px !important;
          left: 20px !important;
          top: auto !important;
          right: auto !important;
          width: 200px !important;
          height: 200px !important;
          background: rgba(17, 24, 39, 0.95) !important;
          border: 1px solid #374151 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
          z-index: 10 !important;
        }

        .cytoscape-navigator > canvas {
          background: #1f2937 !important;
          border-radius: 6px !important;
        }

        .cytoscape-navigatorView {
          border: 2px solid #3b82f6 !important;
          background: rgba(59, 130, 246, 0.1) !important;
        }

        .cytoscape-navigatorOverlay {
          background: rgba(17, 24, 39, 0.7) !important;
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full bg-dark-900" />
      <GraphHUD cyRef={cyRef} graph={graph} />
    </div>
  );
}


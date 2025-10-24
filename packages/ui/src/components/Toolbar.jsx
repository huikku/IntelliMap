import { useState, useEffect } from 'react';
import CycleModal from './CycleModal';

export default function Toolbar({ cy, layout, setLayout, clustering, setClustering, edgeOpacity, setEdgeOpacity, curveStyle, setCurveStyle, sizing, setSizing, sizeExaggeration, setSizeExaggeration, currentRepo }) {
  const [nodeSpacing, setNodeSpacing] = useState(50);
  const [autoPack, setAutoPack] = useState(true);
  const [cycleModalData, setCycleModalData] = useState(null);

  // Apply node sizing whenever cy, sizing, or sizeExaggeration changes
  useEffect(() => {
    if (!cy) {
      console.log('⏸️ No cy instance yet');
      return;
    }

    // Apply current sizing
    console.log('🔄 Applying sizing:', sizing, 'exaggeration:', sizeExaggeration);
    updateNodeSizes(sizing, sizeExaggeration, cy);

    // Auto-pack to remove overlaps after sizing change
    if (autoPack && sizing !== 'uniform') {
      console.log('📦 Auto-packing to remove overlaps...');
      setTimeout(() => {
        removeOverlaps(cy);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cy, sizing, sizeExaggeration, autoPack]);

  const handleFit = () => {
    if (cy) cy.fit();
  };

  const handleCenter = () => {
    if (cy) cy.center();
  };

  const handleSizingChange = (newSizing) => {
    console.log('🔄 Sizing change requested:', newSizing);
    setSizing(newSizing);
  };

  const handleSizeExaggeration = (value) => {
    setSizeExaggeration(value);
  };

  const handleNodeSpacing = (value) => {
    const oldSpacing = nodeSpacing;
    setNodeSpacing(value);

    // Scale node positions to adjust spacing
    if (cy && oldSpacing > 0) {
      const scaleFactor = value / oldSpacing;
      console.log(`📏 Scaling graph by ${scaleFactor.toFixed(2)}x (${oldSpacing}px → ${value}px)`);

      // Save current zoom and pan
      const currentZoom = cy.zoom();
      const currentPan = cy.pan();

      // Get the center of the viewport (not the graph)
      const viewportCenterX = currentPan.x + (cy.width() / 2) / currentZoom;
      const viewportCenterY = currentPan.y + (cy.height() / 2) / currentZoom;

      // Scale all node positions relative to viewport center
      cy.nodes().forEach(node => {
        const pos = node.position();
        const newX = viewportCenterX + (pos.x - viewportCenterX) * scaleFactor;
        const newY = viewportCenterY + (pos.y - viewportCenterY) * scaleFactor;
        node.position({ x: newX, y: newY });
      });

      // Keep the same zoom level - don't auto-fit
      // This ensures nodes stay the same visual size
    }
  };

  const handleEdgeOpacity = (value) => {
    setEdgeOpacity(value);

    if (cy) {
      console.log(`🔗 Setting edge opacity scale to ${value}`);
      // Scale opacity while preserving relative importance
      // Formula: newOpacity = baseOpacity * value
      // But ensure minimum visibility when slider > 0.1
      cy.edges().forEach(edge => {
        const baseOpacity = edge.data('edgeOpacity') || 0.5;
        // Scale the base opacity by the slider value
        // This preserves the relative differences between important and unimportant edges
        const newOpacity = baseOpacity * value;
        edge.style('opacity', newOpacity);
      });
    }
  };

  const handleCurveStyle = (style) => {
    setCurveStyle(style);

    if (cy) {
      console.log(`📐 Setting curve style to ${style}`);

      if (style === 'straight') {
        cy.style().selector('edge').style({
          'curve-style': 'straight',
        }).update();
      } else if (style === 'bezier-smooth') {
        // Relaxed orthogonal-style bezier - like a smooth version of right angles
        // Uses vertical offset to create natural horizontal-then-vertical flow
        cy.style().selector('edge').style({
          'curve-style': 'unbundled-bezier',
          'control-point-distances': edge => {
            const source = edge.source().position();
            const target = edge.target().position();
            const dx = Math.abs(target.x - source.x);
            const dy = Math.abs(target.y - source.y);
            // Use perpendicular offset based on distance
            const offset = Math.min(dx, dy) * 0.3;
            return [offset, -offset];
          },
          'control-point-weights': [0.25, 0.75],
        }).update();
      } else if (style === 'bezier-tight') {
        // Tighter version - more subtle curves
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
      } else if (style === 'taxi') {
        // Taxi-style right angles - orthogonal routing (horizontal/vertical only)
        cy.style().selector('edge').style({
          'curve-style': 'taxi',
          'taxi-direction': 'auto',
          'taxi-turn': 20,
          'taxi-turn-min-distance': 10,
        }).update();
      } else if (style === 'segments-ortho') {
        // Manual orthogonal segments - creates L or Z shapes
        cy.style().selector('edge').style({
          'curve-style': 'segments',
          'segment-distances': edge => {
            const source = edge.source().position();
            const target = edge.target().position();
            const dx = target.x - source.x;
            const dy = target.y - source.y;

            // Create 3-segment path: horizontal, vertical, horizontal
            // or vertical, horizontal, vertical depending on direction
            if (Math.abs(dx) > Math.abs(dy)) {
              // More horizontal - go horizontal first
              return [dy / 2, -dy / 2];
            } else {
              // More vertical - go vertical first
              return [dx / 2, -dx / 2];
            }
          },
          'segment-weights': [0.33, 0.67],
        }).update();
      }
    }
  };

  const removeOverlaps = (cyInstance) => {
    if (!cyInstance) return;

    console.log('📦 Removing overlaps by shifting nodes...');

    const nodes = cyInstance.nodes().filter(n => !n.data('isCluster'));
    const padding = nodeSpacing / 4; // Minimum spacing between nodes

    // Simple iterative overlap removal
    let iterations = 0;
    const maxIterations = 50;
    let hasOverlap = true;

    while (hasOverlap && iterations < maxIterations) {
      hasOverlap = false;
      iterations++;

      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        const posA = nodeA.position();
        const sizeA = Math.max(nodeA.width(), nodeA.height()) / 2;

        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          const posB = nodeB.position();
          const sizeB = Math.max(nodeB.width(), nodeB.height()) / 2;

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = sizeA + sizeB + padding;

          if (distance < minDistance && distance > 0) {
            hasOverlap = true;

            // Calculate push vector
            const overlap = minDistance - distance;
            const pushX = (dx / distance) * overlap * 0.5;
            const pushY = (dy / distance) * overlap * 0.5;

            // Move both nodes apart
            nodeA.position({
              x: posA.x - pushX,
              y: posA.y - pushY
            });
            nodeB.position({
              x: posB.x + pushX,
              y: posB.y + pushY
            });
          }
        }
      }
    }

    console.log(`✅ Overlaps removed in ${iterations} iterations`);
    cyInstance.fit(null, 50);
  };

  const updateNodeSizes = (sizeMode, exaggeration, cyInstance) => {
    console.log('📐 updateNodeSizes called:', { sizeMode, exaggeration });
    if (!cyInstance) {
      console.error('❌ No cyInstance in updateNodeSizes');
      return;
    }

    // Check if cyInstance is destroyed or invalid
    try {
      const nodeCount = cyInstance.nodes().length;
      console.log(`📊 Cytoscape instance has ${nodeCount} nodes`);
      if (nodeCount === 0) {
        console.warn('⚠️ Cytoscape instance has no nodes, skipping sizing update');
        return;
      }
    } catch (err) {
      console.error('❌ Cytoscape instance is invalid:', err);
      return;
    }

    if (sizeMode === 'uniform') {
      // Reset to uniform sizing
      const baseSize = 45 * exaggeration;
      cyInstance.style().selector('node').style({
        'width': node => (node.data('isCluster') ? 'label' : baseSize),
        'height': node => (node.data('isCluster') ? 'label' : baseSize),
      }).update();

      // Force font size recalculation
      cyInstance.nodes().forEach(n => n.updateStyle());

      console.log('✅ Uniform sizing applied');
    } else if (sizeMode === 'degree') {
      // Size by degree (number of connections)
      cyInstance.nodes().forEach(n => {
        if (!n.data('isCluster')) {
          n.data('degree', n.degree());
        }
      });
      cyInstance.style().selector('node').style({
        'width': node => {
          if (node.data('isCluster')) return 'label';
          const degree = node.data('degree') || 0;
          const size = Math.max(30, Math.min(100, 30 + (degree * 3))) * exaggeration;
          return size;
        },
        'height': node => {
          if (node.data('isCluster')) return 'label';
          const degree = node.data('degree') || 0;
          const size = Math.max(30, Math.min(100, 30 + (degree * 3))) * exaggeration;
          return size;
        },
      }).update();

      // Force font size recalculation
      cyInstance.nodes().forEach(n => n.updateStyle());

      console.log('✅ Degree sizing applied');
    } else if (sizeMode === 'filesize') {
      console.log('📁 Starting filesize mode');
      // Size by file size using logarithmic scale for better variance
      const nodes = cyInstance.nodes();
      console.log(`📊 Total nodes: ${nodes.length}`);

      // Collect all file sizes (excluding clusters)
      const fileSizes = [];
      nodes.forEach(n => {
        if (!n.data('isCluster')) {
          const fileSize = n.data('fileSize') || 0;
          if (fileSize > 0) {
            fileSizes.push(fileSize);
          }
        }
      });

      if (fileSizes.length === 0) {
        console.warn('⚠️ No file sizes found');
        return;
      }

      // Use logarithmic scale for better variance
      const logSizes = fileSizes.map(s => Math.log10(s + 1));
      const minLog = Math.min(...logSizes);
      const maxLog = Math.max(...logSizes);
      const logRange = maxLog - minLog || 1;

      console.log(`📏 File size range: ${Math.min(...fileSizes)} - ${Math.max(...fileSizes)} bytes`);
      console.log(`📊 Log scale range: ${minLog.toFixed(2)} - ${maxLog.toFixed(2)}`);
      console.log('🎨 Applying filesize styles with logarithmic scale...');

      try {
        cyInstance.style().selector('node').style({
        'width': node => {
          if (node.data('isCluster')) return 'label';
          const fileSize = node.data('fileSize') || 0;
          if (fileSize === 0) return 25 * exaggeration;

          // Logarithmic normalization
          const logSize = Math.log10(fileSize + 1);
          const normalized = (logSize - minLog) / logRange;

          // Wider size range: 25px to 200px
          const size = Math.max(25, Math.min(200, 25 + (normalized * 175))) * exaggeration;
          return size;
        },
        'height': node => {
          if (node.data('isCluster')) return 'label';
          const fileSize = node.data('fileSize') || 0;
          if (fileSize === 0) return 25 * exaggeration;

          // Logarithmic normalization
          const logSize = Math.log10(fileSize + 1);
          const normalized = (logSize - minLog) / logRange;

          // Wider size range: 25px to 200px
          const size = Math.max(25, Math.min(200, 25 + (normalized * 175))) * exaggeration;
          return size;
        },
      }).update();

      // Force font size recalculation
      cyInstance.nodes().forEach(n => n.updateStyle());

      console.log('✅ Filesize styles applied successfully');
    } catch (err) {
      console.error('❌ Error applying filesize styles:', err);
      console.error('Stack:', err.stack);
    }
    } else if (sizeMode === 'centrality') {
      const nodes = cyInstance.nodes().filter(n => !n.data('isCluster'));
      const nodeCount = nodes.length;

      console.log(`⭐ Starting centrality mode for ${nodeCount} nodes`);

      // Warn if graph is large (centrality is O(n³))
      if (nodeCount > 100) {
        const estimated = Math.round((nodeCount ** 3) / 1000000);
        console.warn(`⚠️ Large graph detected (${nodeCount} nodes). Centrality calculation may take ~${estimated}s...`);
      }

      const centralities = new Map();

      // Use degree centrality instead of betweenness for large graphs (much faster)
      if (nodeCount > 100) {
        console.log('📊 Using degree centrality (fast approximation)');
        nodes.forEach(node => {
          // Degree centrality = number of connections (in + out)
          const degree = node.degree(false); // false = don't include loops
          centralities.set(node.id(), degree);
          node.data('centrality', degree);
        });
      } else {
        // Use betweenness centrality for smaller graphs (more accurate but slower)
        console.log('📊 Using betweenness centrality (accurate but slow)');

        // Calculate betweenness centrality for all nodes
        nodes.forEach((node, idx) => {
          if (idx % 10 === 0) {
            console.log(`⭐ Processing node ${idx + 1}/${nodeCount}...`);
          }

          let betweenness = 0;

          // For each other pair of nodes
          nodes.forEach(source => {
            if (source === node) return;

            nodes.forEach(target => {
              if (target === node || target === source) return;

              // Find all shortest paths from source to target
              const dijkstra = cyInstance.elements().dijkstra(source, () => 1);
              const pathToTarget = dijkstra.pathTo(target);

              // Check if our node is on this path
              if (pathToTarget && pathToTarget.contains(node)) {
                betweenness += 1;
              }
            });
          });

          centralities.set(node.id(), betweenness);
          node.data('centrality', betweenness);
        });
      }

      // Normalize centralities
      const centralityValues = Array.from(centralities.values());
      const minCentrality = Math.min(...centralityValues);
      const maxCentrality = Math.max(...centralityValues);
      const centralityRange = maxCentrality - minCentrality || 1;

      console.log(`⭐ Centrality range: ${minCentrality} - ${maxCentrality}`);

      // Apply sizing based on centrality
      cyInstance.style().selector('node').style({
        'width': node => {
          if (node.data('isCluster')) return 'label';
          const centrality = node.data('centrality') || 0;
          const normalized = (centrality - minCentrality) / centralityRange;
          const size = Math.max(30, Math.min(150, 30 + (normalized * 120))) * exaggeration;
          return size;
        },
        'height': node => {
          if (node.data('isCluster')) return 'label';
          const centrality = node.data('centrality') || 0;
          const normalized = (centrality - minCentrality) / centralityRange;
          const size = Math.max(30, Math.min(150, 30 + (normalized * 120))) * exaggeration;
          return size;
        },
      }).update();

      // Force font size recalculation
      cyInstance.nodes().forEach(n => n.updateStyle());

      console.log('✅ Centrality sizing applied');
    }
  };

  const handleLayoutChange = (newLayout) => {
    if (!cy) return;
    setLayout(newLayout);

    const layoutOptions = {
      elk: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': nodeSpacing,
          'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
        },
        fit: false, // Don't auto-fit - preserve zoom
      },
      elkDown: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': nodeSpacing,
          'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
        },
        fit: false,
      },
      elkTree: {
        name: 'elk',
        elk: {
          algorithm: 'mrtree',
          'elk.spacing.nodeNode': nodeSpacing,
        },
        fit: false,
      },
      grid: {
        name: 'grid',
        rows: Math.ceil(Math.sqrt(cy.nodes().length)),
        cols: Math.ceil(Math.sqrt(cy.nodes().length)),
        spacingFactor: nodeSpacing / 50, // Scale based on spacing slider
        fit: false,
      },
      dagre: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: nodeSpacing * 1.6,
        edgeSep: nodeSpacing,
        rankSep: nodeSpacing * 3,
        padding: 10,
        fit: false,
      },
      dagreDown: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: nodeSpacing * 1.6,
        edgeSep: nodeSpacing,
        rankSep: nodeSpacing * 3,
        padding: 10,
        fit: false,
      },
      fcose: {
        name: 'fcose',
        quality: 'default',
        randomize: true,
        animate: false,
        nodeSeparation: nodeSpacing * 1.6,
        idealEdgeLength: nodeSpacing * 2,
        gravity: 0.25,
        nodeRepulsion: 4500,
        nestingFactor: 0.8,
        packComponents: true,
        fit: false,
      },
      euler: {
        name: 'euler',
        springLength: nodeSpacing * 1.6,
        springCoeff: 0.0008,
        mass: node => 2 + node.degree(false),
        gravity: -1.2,
        pull: 0.002,
        timeStep: 10,
        refresh: 20,
        fit: false,
      },
      cola: {
        name: 'cola',
        animate: false,
        nodeSpacing: nodeSpacing,
        edgeLengthVal: nodeSpacing * 2,
        flow: { axis: 'x', minSeparation: nodeSpacing * 1.2 },
        clustering: true,
        randomize: false,
        fit: false,
      },
    };

    const layoutInstance = cy.layout(layoutOptions[newLayout]);

    // Run layout and reapply styles after completion
    layoutInstance.on('layoutstop', () => {
      console.log('🎨 Layout complete, reapplying sizing...');
      // Reapply node sizing to ensure it persists
      updateNodeSizes(sizing, sizeExaggeration, cy);
      // Fit to view after layout
      cy.fit();
    });

    layoutInstance.run();
  };

  const handleExportPNG = () => {
    if (!cy) return;

    const png = cy.png({
      output: 'blob',
      bg: '#111827', // gray-900
      full: true,
      scale: 2, // 2x resolution for better quality
    });

    // Generate filename: repo_intellimap_timestamp.png
    const repoName = currentRepo ? currentRepo.split('/').pop() : 'unknown';
    const timestamp = Date.now();
    const filename = `${repoName}_intellimap_${timestamp}.png`;

    const url = URL.createObjectURL(png);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    console.log(`📸 Graph exported as PNG: ${filename}`);
  };

  const handleExportJSON = () => {
    if (!cy) return;

    const data = cy.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

    // Generate filename: repo_intellimap_timestamp.json
    const repoName = currentRepo ? currentRepo.split('/').pop() : 'unknown';
    const timestamp = Date.now();
    const filename = `${repoName}_intellimap_${timestamp}.json`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    console.log(`💾 Graph exported as JSON: ${filename}`);
  };

  const handleDetectCycles = () => {
    if (!cy) return;

    // Reset previous cycle highlighting
    cy.nodes().removeClass('in-cycle');
    cy.edges().removeClass('in-cycle');

    // Find strongly connected components (SCCs)
    // A cycle exists if an SCC has more than one node
    const components = [];
    const visited = new Set();
    const stack = [];
    const lowLink = new Map();
    const index = new Map();
    let currentIndex = 0;

    const strongConnect = (node) => {
      index.set(node.id(), currentIndex);
      lowLink.set(node.id(), currentIndex);
      currentIndex++;
      stack.push(node);
      visited.add(node.id());

      // Visit successors
      node.outgoers('node').forEach(successor => {
        if (!index.has(successor.id())) {
          strongConnect(successor);
          lowLink.set(node.id(), Math.min(lowLink.get(node.id()), lowLink.get(successor.id())));
        } else if (stack.includes(successor)) {
          lowLink.set(node.id(), Math.min(lowLink.get(node.id()), index.get(successor.id())));
        }
      });

      // If node is a root node, pop the stack and create an SCC
      if (lowLink.get(node.id()) === index.get(node.id())) {
        const component = [];
        let w;
        do {
          w = stack.pop();
          component.push(w);
        } while (w !== node);

        if (component.length > 1) {
          components.push(component);
        }
      }
    };

    // Run Tarjan's algorithm on all nodes
    cy.nodes().forEach(node => {
      if (!visited.has(node.id())) {
        strongConnect(node);
      }
    });

    // Highlight cycles
    let totalCycleNodes = 0;
    let cycleNodes = cy.collection();
    let cycleEdges = cy.collection();

    components.forEach(component => {
      component.forEach(node => {
        node.addClass('in-cycle');
        cycleNodes = cycleNodes.union(node);
        totalCycleNodes++;

        // Highlight edges within the cycle
        node.outgoers('edge').forEach(edge => {
          if (component.includes(edge.target())) {
            edge.addClass('in-cycle');
            cycleEdges = cycleEdges.union(edge);
          }
        });
      });
    });

    if (components.length > 0) {
      console.log(`🔴 Found ${components.length} cycles with ${totalCycleNodes} nodes`);

      // Fade all nodes and edges
      cy.nodes().style('opacity', 0.15);
      cy.edges().style('opacity', 0.05);

      // Highlight cycle nodes and edges
      cycleNodes.style('opacity', 1);
      cycleEdges.style('opacity', 0.8);

      // Fit viewport to show all cycles
      cy.animate({
        fit: {
          eles: cycleNodes,
          padding: 50,
        },
      }, {
        duration: 500,
      });

      // Convert components to cycle paths (list of file IDs)
      const cycleDetails = components.map(component => {
        return component.map(node => node.id());
      });

      // Show modal with cycle details
      setCycleModalData({
        cycleCount: components.length,
        nodeCount: totalCycleNodes,
        cycles: cycleDetails,
      });
    } else {
      console.log('✅ No cycles detected');
      // Show modal
      setCycleModalData({ cycleCount: 0, nodeCount: 0, cycles: [] });
    }
  };

  return (
    <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center gap-2 px-4">
      <button
        onClick={handleFit}
        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
        title="Fit graph to view"
      >
        📐 Fit
      </button>
      <button
        onClick={handleCenter}
        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
        title="Center view"
      >
        ⊙ Center
      </button>
      <button
        onClick={handleExportPNG}
        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
        title="Export graph as PNG"
      >
        📸 PNG
      </button>
      <button
        onClick={handleExportJSON}
        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
        title="Export graph as JSON"
      >
        💾 JSON
      </button>
      <button
        onClick={handleDetectCycles}
        className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm transition"
        title="Detect circular dependencies"
      >
        🔴 Cycles
      </button>

      <div className="ml-2 flex items-center gap-2">
        <label className="text-xs text-gray-400 font-mono">Layout:</label>
        <select
          value={layout}
          onChange={e => handleLayoutChange(e.target.value)}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700 transition font-mono"
        >
          <optgroup label="ELK (Hierarchical)">
            <option value="elk">📊 ELK Right</option>
            <option value="elkDown">📊 ELK Down</option>
            <option value="elkTree">🌳 ELK Tree</option>
          </optgroup>
          <optgroup label="Hierarchical">
            <option value="dagre">🧠 Dagre (LR)</option>
            <option value="dagreDown">🧠 Dagre (TB)</option>
          </optgroup>
          <optgroup label="Force-Directed">
            <option value="fcose">🌐 fcose (Organic)</option>
            <option value="euler">🌀 Euler (Physics)</option>
            <option value="cola">🎯 Cola (Flow)</option>
          </optgroup>
          <optgroup label="Other">
            <option value="grid">📋 Grid Layout</option>
          </optgroup>
        </select>
      </div>

      <button
        onClick={() => setClustering(!clustering)}
        className={`px-3 py-1 rounded text-sm transition ${
          clustering
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
        }`}
        title="Toggle folder clustering"
      >
        📦 Cluster
      </button>

      <div className="ml-2 flex items-center gap-2">
        <label className="text-xs text-gray-400 font-mono">Size:</label>
        <select
          value={sizing}
          onChange={e => handleSizingChange(e.target.value)}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700 transition font-mono"
        >
          <option value="uniform">📏 Uniform</option>
          <option value="degree">🔗 By Degree</option>
          <option value="filesize">📁 By File Size</option>
          <option value="centrality">⭐ By Centrality</option>
        </select>

        <input
          type="range"
          min="0.5"
          max="8"
          step="0.1"
          value={sizeExaggeration}
          onChange={e => handleSizeExaggeration(parseFloat(e.target.value))}
          className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          title={`Size exaggeration: ${sizeExaggeration.toFixed(1)}x`}
        />
        <span className="text-xs text-gray-400 font-mono w-8">{sizeExaggeration.toFixed(1)}x</span>
      </div>

      <div className="ml-2 flex items-center gap-2">
        <label className="text-xs text-gray-400 font-mono">Spacing:</label>
        <input
          type="range"
          min="20"
          max="150"
          step="10"
          value={nodeSpacing}
          onChange={e => handleNodeSpacing(parseInt(e.target.value))}
          className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          title={`Node spacing: ${nodeSpacing}px`}
        />
        <span className="text-xs text-gray-400 font-mono w-10">{nodeSpacing}px</span>
      </div>

      <div className="ml-2 flex items-center gap-2">
        <label className="text-xs text-gray-400 font-mono">Edges:</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={edgeOpacity}
          onChange={e => handleEdgeOpacity(parseFloat(e.target.value))}
          className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          title={`Edge opacity: ${(edgeOpacity * 100).toFixed(0)}%`}
        />
        <span className="text-xs text-gray-400 font-mono w-10">{(edgeOpacity * 100).toFixed(0)}%</span>
      </div>

      <div className="ml-2 flex items-center gap-2">
        <label className="text-xs text-gray-400 font-mono">Curve:</label>
        <select
          value={curveStyle}
          onChange={e => handleCurveStyle(e.target.value)}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700 transition font-mono"
        >
          <option value="straight">━ Straight</option>
          <option value="taxi">⌐ Right Angles (Auto)</option>
          <option value="segments-ortho">⌐ Orthogonal</option>
          <option value="bezier-tight">〰 Bezier (Tight)</option>
          <option value="bezier-smooth">🌊 Bezier (Smooth)</option>
        </select>
      </div>

      <button
        onClick={() => removeOverlaps(cy)}
        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
        title="Remove overlaps by repacking nodes"
        disabled={!cy}
      >
        📦 Pack
      </button>

      <button
        onClick={() => setAutoPack(!autoPack)}
        className={`px-3 py-1 rounded text-sm transition ${
          autoPack
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-800 hover:bg-gray-700'
        }`}
        title={`Auto-pack: ${autoPack ? 'ON' : 'OFF'} - Automatically remove overlaps when changing node sizes`}
      >
        {autoPack ? '✓' : '○'} Auto
      </button>

      <div className="ml-auto text-xs text-gray-500">
        ✓ Ready
      </div>

      {/* Cycle Detection Modal */}
      {cycleModalData && (
        <CycleModal
          cycleCount={cycleModalData.cycleCount}
          nodeCount={cycleModalData.nodeCount}
          cycles={cycleModalData.cycles}
          onClose={() => setCycleModalData(null)}
        />
      )}
    </div>
  );
}


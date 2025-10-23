import { useState, useRef, useEffect } from 'react';
import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import euler from 'cytoscape-euler';
import cola from 'cytoscape-cola';
import LayoutSpinner from './LayoutSpinner';
import LayoutProgressModal from './LayoutProgressModal';

// Register layout plugins for background instance
cytoscape.use(elk);
cytoscape.use(dagre);
cytoscape.use(fcose);
cytoscape.use(euler);
cytoscape.use(cola);

export default function Toolbar({ cy, layout, setLayout, clustering, setClustering }) {
  const [isLayouting, setIsLayouting] = useState(false);
  const [sizing, setSizing] = useState('uniform');
  const [sizeExaggeration, setSizeExaggeration] = useState(1);
  const [progressModal, setProgressModal] = useState({
    isVisible: false,
    layoutName: '',
    progress: 0,
    message: '',
    details: '',
  });
  const layoutCacheRef = useRef({});
  const bgLayoutTimeoutRef = useRef(null);
  const bgLayoutIntervalRef = useRef(null);
  const bgCyRef = useRef(null);
  const lastGraphIdRef = useRef(null);
  const layoutStartTimeRef = useRef(null);
  const layoutStatsRef = useRef({});

  // Precompute layouts in background using hidden Cytoscape instance
  useEffect(() => {
    if (!cy) return;

    // Get a unique identifier for the current graph
    const graphId = cy.nodes().length + '-' + cy.edges().length;

    // If graph changed, clear cache and restart
    if (graphId !== lastGraphIdRef.current) {
      console.log('📊 New graph detected, clearing layout cache');
      layoutCacheRef.current = {};
      lastGraphIdRef.current = graphId;

      // Destroy old background instance
      if (bgCyRef.current) {
        bgCyRef.current.destroy();
        bgCyRef.current = null;
      }
    }

    // Clear any pending background layout
    if (bgLayoutTimeoutRef.current) {
      clearTimeout(bgLayoutTimeoutRef.current);
    }
    if (bgLayoutIntervalRef.current) {
      clearInterval(bgLayoutIntervalRef.current);
    }

    // Start precomputing other layouts after a delay
    bgLayoutTimeoutRef.current = setTimeout(() => {
      // Create hidden background Cytoscape instance
      if (!bgCyRef.current) {
        console.log('🔧 Creating background Cytoscape instance');
        const container = document.createElement('div');
        container.style.display = 'none';
        document.body.appendChild(container);

        bgCyRef.current = cytoscape({
          container: container,
          elements: cy.elements().jsons(),
          style: cy.style().json(),
        });
      }

      const layoutsToPrecompute = ['dagre', 'dagreDown', 'fcose', 'euler', 'cola', 'elkDown', 'elkTree', 'grid'];
      let index = 0;
      layoutStatsRef.current = {};

      bgLayoutIntervalRef.current = setInterval(() => {
        if (index >= layoutsToPrecompute.length) {
          clearInterval(bgLayoutIntervalRef.current);
          console.log('✅ All layouts precomputed');
          setProgressModal(prev => ({ ...prev, isVisible: false }));
          return;
        }

        const layoutName = layoutsToPrecompute[index];
        if (!layoutCacheRef.current[layoutName]) {
          layoutStartTimeRef.current = performance.now();
          console.log(`🔄 Precomputing layout: ${layoutName}`);

          const nodeCount = bgCyRef.current.nodes().length;
          const edgeCount = bgCyRef.current.edges().length;

          setProgressModal(prev => ({
            ...prev,
            isVisible: true,
            layoutName: layoutName,
            progress: (index / layoutsToPrecompute.length),
            message: `Computing ${layoutName} layout...`,
            details: `Nodes: ${nodeCount} | Edges: ${edgeCount}\nQueue: ${index + 1}/${layoutsToPrecompute.length}`,
          }));

          const layoutOptions = getLayoutOptions(layoutName, bgCyRef.current);
          const bgLayout = bgCyRef.current.layout(layoutOptions);

          bgLayout.on('layoutstop', () => {
            const elapsed = performance.now() - layoutStartTimeRef.current;
            layoutStatsRef.current[layoutName] = elapsed;

            // Save the positions
            const positions = {};
            bgCyRef.current.nodes().forEach(n => {
              positions[n.id()] = { x: n.position('x'), y: n.position('y') };
            });
            layoutCacheRef.current[layoutName] = positions;
            console.log(`✓ Cached layout: ${layoutName} (${elapsed.toFixed(0)}ms)`);

            setProgressModal(prev => ({
              ...prev,
              message: `✓ Completed ${layoutName} (${elapsed.toFixed(0)}ms)`,
            }));
          });

          bgLayout.run();
        }
        index++;
      }, 500); // Stagger by 500ms
    }, 2000); // Wait 2 seconds after initial render

    return () => {
      if (bgLayoutTimeoutRef.current) {
        clearTimeout(bgLayoutTimeoutRef.current);
      }
      if (bgLayoutIntervalRef.current) {
        clearInterval(bgLayoutIntervalRef.current);
      }
    };
  }, [cy]);

  const handleFit = () => {
    if (cy) cy.fit();
  };

  const handleCenter = () => {
    if (cy) cy.center();
  };

  const getLayoutOptions = (layoutName, cyInstance) => {
    const layoutOptions = {
      elk: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': 50,
          'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
        },
      },
      elkDown: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': 50,
          'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
        },
      },
      elkTree: {
        name: 'elk',
        elk: {
          algorithm: 'mrtree',
          'elk.spacing.nodeNode': 50,
        },
      },
      grid: {
        name: 'grid',
        rows: Math.ceil(Math.sqrt(cyInstance.nodes().length)),
        cols: Math.ceil(Math.sqrt(cyInstance.nodes().length)),
        spacingFactor: 1.5,
      },
      dagre: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 80,
        edgeSep: 50,
        rankSep: 150,
        padding: 10,
      },
      dagreDown: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 80,
        edgeSep: 50,
        rankSep: 150,
        padding: 10,
      },
      fcose: {
        name: 'fcose',
        quality: 'default',
        randomize: true,
        animate: false,
        nodeSeparation: 80,
        idealEdgeLength: 100,
        gravity: 0.25,
        nodeRepulsion: 4500,
        nestingFactor: 0.8,
        packComponents: true,
      },
      euler: {
        name: 'euler',
        springLength: 80,
        springCoeff: 0.0008,
        mass: node => 2 + node.degree(false),
        gravity: -1.2,
        pull: 0.002,
        timeStep: 10,
        refresh: 20,
      },
      cola: {
        name: 'cola',
        animate: false,
        nodeSpacing: 50,
        edgeLengthVal: 100,
        flow: { axis: 'x', minSeparation: 60 },
        clustering: true,
        randomize: false,
      },
    };
    return layoutOptions[layoutName];
  };

  const handleSizingChange = (newSizing) => {
    if (!cy) return;
    setSizing(newSizing);
    updateNodeSizes(newSizing, sizeExaggeration, cy);
  };

  const handleSizeExaggeration = (value) => {
    setSizeExaggeration(value);
    updateNodeSizes(sizing, value, cy);
  };

  const updateNodeSizes = (sizeMode, exaggeration, cyInstance) => {
    if (!cyInstance) return;

    if (sizeMode === 'uniform') {
      // Reset to uniform sizing
      const baseSize = 45 * exaggeration;
      cyInstance.style().selector('node').style({
        'width': node => (node.data('isCluster') ? 'label' : baseSize),
        'height': node => (node.data('isCluster') ? 'label' : baseSize),
      }).update();
    } else if (sizeMode === 'degree') {
      // Size by degree (number of connections)
      cyInstance.nodes().forEach(n => {
        n.data('degree', n.degree());
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
    } else if (sizeMode === 'filesize') {
      // Size by file size
      // Find min and max file sizes for normalization
      let minSize = Infinity;
      let maxSize = 0;
      cyInstance.nodes().forEach(n => {
        const fileSize = n.data('fileSize') || 0;
        if (fileSize > 0) {
          minSize = Math.min(minSize, fileSize);
          maxSize = Math.max(maxSize, fileSize);
        }
      });

      if (minSize === Infinity) minSize = 0;
      const range = maxSize - minSize || 1;

      cyInstance.style().selector('node').style({
        'width': node => {
          if (node.data('isCluster')) return 'label';
          const fileSize = node.data('fileSize') || 0;
          const normalized = (fileSize - minSize) / range;
          const size = Math.max(30, Math.min(120, 30 + (normalized * 90))) * exaggeration;
          return size;
        },
        'height': node => {
          if (node.data('isCluster')) return 'label';
          const fileSize = node.data('fileSize') || 0;
          const normalized = (fileSize - minSize) / range;
          const size = Math.max(30, Math.min(120, 30 + (normalized * 90))) * exaggeration;
          return size;
        },
      }).update();
    }

    // Run a layout to prevent overlaps
    if (cyInstance.elements().length > 0) {
      const currentLayout = cyInstance.layout({ name: 'fcose', animate: true, animationDuration: 300 });
      currentLayout.run();
    }
  };

  const handleLayoutChange = (newLayout) => {
    if (!cy) return;
    setLayout(newLayout);
    setIsLayouting(true);

    // Check if layout is cached
    if (layoutCacheRef.current[newLayout]) {
      console.log(`⚡ Using cached layout: ${newLayout}`);
      // Restore cached positions
      const positions = layoutCacheRef.current[newLayout];
      cy.nodes().forEach(n => {
        if (positions[n.id()]) {
          n.position(positions[n.id()]);
        }
      });
      setIsLayouting(false);
    } else {
      console.log(`🔄 Computing layout: ${newLayout}`);
      layoutStartTimeRef.current = performance.now();

      const nodeCount = cy.nodes().length;
      const edgeCount = cy.edges().length;

      setProgressModal(prev => ({
        ...prev,
        isVisible: true,
        layoutName: newLayout,
        progress: 0.5,
        message: `Computing ${newLayout} layout...`,
        details: `Nodes: ${nodeCount} | Edges: ${edgeCount}\nThis layout is being computed on-demand`,
      }));

      const layoutOptions = getLayoutOptions(newLayout, cy);
      const layout = cy.layout(layoutOptions);

      layout.on('layoutstop', () => {
        const elapsed = performance.now() - layoutStartTimeRef.current;

        // Cache the positions
        const positions = {};
        cy.nodes().forEach(n => {
          positions[n.id()] = { x: n.position('x'), y: n.position('y') };
        });
        layoutCacheRef.current[newLayout] = positions;

        console.log(`✓ Layout computed: ${newLayout} (${elapsed.toFixed(0)}ms)`);

        setProgressModal(prev => ({
          ...prev,
          message: `✓ Completed ${newLayout} (${elapsed.toFixed(0)}ms)`,
          progress: 1,
        }));

        setTimeout(() => {
          setProgressModal(prev => ({ ...prev, isVisible: false }));
          setIsLayouting(false);
        }, 500);
      });

      layout.run();
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

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 font-mono">Size:</label>
        <select
          value={sizing}
          onChange={e => handleSizingChange(e.target.value)}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700 transition font-mono"
        >
          <option value="uniform">📏 Uniform</option>
          <option value="degree">🔗 By Degree</option>
          <option value="filesize">📁 By File Size</option>
        </select>

        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={sizeExaggeration}
          onChange={e => handleSizeExaggeration(parseFloat(e.target.value))}
          className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          title={`Size exaggeration: ${sizeExaggeration.toFixed(1)}x`}
        />
        <span className="text-xs text-gray-400 font-mono w-8">{sizeExaggeration.toFixed(1)}x</span>
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

      <div className="ml-auto text-xs text-gray-500">
        {isLayouting ? '⏳ Layouting...' : '✓ Ready'}
      </div>

      <LayoutSpinner isVisible={isLayouting} />
      <LayoutProgressModal
        isVisible={progressModal.isVisible}
        layoutName={progressModal.layoutName}
        progress={progressModal.progress}
        message={progressModal.message}
        details={progressModal.details}
      />
    </div>
  );
}


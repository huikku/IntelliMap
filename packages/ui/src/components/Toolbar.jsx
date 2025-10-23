import { useState, useRef, useEffect } from 'react';
import LayoutSpinner from './LayoutSpinner';

export default function Toolbar({ cy, layout, setLayout, clustering, setClustering }) {
  const [isLayouting, setIsLayouting] = useState(false);
  const [sizing, setSizing] = useState('uniform');
  const layoutCacheRef = useRef({});
  const bgLayoutTimeoutRef = useRef(null);

  // Precompute layouts in background
  useEffect(() => {
    if (!cy) return;

    // Clear any pending background layout
    if (bgLayoutTimeoutRef.current) {
      clearTimeout(bgLayoutTimeoutRef.current);
    }

    // Start precomputing other layouts after a delay
    bgLayoutTimeoutRef.current = setTimeout(() => {
      const layoutsToPrecompute = ['dagre', 'dagreDown', 'fcose', 'euler', 'cola', 'elkDown', 'elkTree', 'grid'];

      layoutsToPrecompute.forEach((layoutName, index) => {
        // Stagger the precomputation to avoid blocking
        setTimeout(() => {
          if (!layoutCacheRef.current[layoutName]) {
            console.log(`🔄 Precomputing layout: ${layoutName}`);
            const layoutOptions = getLayoutOptions(layoutName, cy);
            const layout = cy.layout(layoutOptions);

            layout.on('layoutstop', () => {
              // Save the positions
              const positions = {};
              cy.nodes().forEach(n => {
                positions[n.id()] = { x: n.position('x'), y: n.position('y') };
              });
              layoutCacheRef.current[layoutName] = positions;
              console.log(`✓ Cached layout: ${layoutName}`);
            });

            layout.run();
          }
        }, index * 500); // Stagger by 500ms
      });
    }, 2000); // Wait 2 seconds after initial render

    return () => {
      if (bgLayoutTimeoutRef.current) {
        clearTimeout(bgLayoutTimeoutRef.current);
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

    if (newSizing === 'uniform') {
      // Reset to uniform sizing
      cy.style().selector('node').style({
        'width': node => (node.data('isCluster') ? 'label' : 45),
        'height': node => (node.data('isCluster') ? 'label' : 45),
      }).update();
    } else if (newSizing === 'degree') {
      // Size by degree (number of connections)
      cy.nodes().forEach(n => {
        n.data('degree', n.degree());
      });
      cy.style().selector('node').style({
        'width': node => {
          if (node.data('isCluster')) return 'label';
          const degree = node.data('degree') || 0;
          return Math.max(30, Math.min(100, 30 + (degree * 3)));
        },
        'height': node => {
          if (node.data('isCluster')) return 'label';
          const degree = node.data('degree') || 0;
          return Math.max(30, Math.min(100, 30 + (degree * 3)));
        },
      }).update();
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
      const layoutOptions = getLayoutOptions(newLayout, cy);
      const layout = cy.layout(layoutOptions);

      layout.on('layoutstop', () => {
        // Cache the positions
        const positions = {};
        cy.nodes().forEach(n => {
          positions[n.id()] = { x: n.position('x'), y: n.position('y') };
        });
        layoutCacheRef.current[newLayout] = positions;
        setIsLayouting(false);
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

      <div className="ml-auto text-xs text-gray-500">
        {isLayouting ? '⏳ Layouting...' : '✓ Ready'}
      </div>

      <LayoutSpinner isVisible={isLayouting} />
    </div>
  );
}


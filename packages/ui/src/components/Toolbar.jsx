export default function Toolbar({ cy, layout, setLayout, clustering, setClustering }) {
  const handleFit = () => {
    if (cy) cy.fit();
  };

  const handleCenter = () => {
    if (cy) cy.center();
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
        rows: Math.ceil(Math.sqrt(cy.nodes().length)),
        cols: Math.ceil(Math.sqrt(cy.nodes().length)),
        spacingFactor: 1.5,
      },
    };

    cy.layout(layoutOptions[newLayout]).run();
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
          <option value="elk">📊 Hierarchical (Right)</option>
          <option value="elkDown">📊 Hierarchical (Down)</option>
          <option value="elkTree">🌳 Tree Layout</option>
          <option value="grid">📋 Grid Layout</option>
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
        ✓ Ready
      </div>
    </div>
  );
}


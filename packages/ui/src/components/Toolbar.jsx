export default function Toolbar({ 
  reactFlowInstance, 
  layout, 
  setLayout, 
  clustering, 
  setClustering, 
  edgeOpacity, 
  setEdgeOpacity, 
  curveStyle, 
  setCurveStyle, 
  sizing, 
  setSizing, 
  sizeExaggeration, 
  setSizeExaggeration, 
  currentRepo 
}) {
  const handleFit = () => {
    if (reactFlowInstance?.current) {
      reactFlowInstance.current.fitView({ padding: 0.2, duration: 500 });
    }
  };

  const handleCenter = () => {
    if (reactFlowInstance?.current) {
      reactFlowInstance.current.fitView({ padding: 0.2, duration: 500 });
    }
  };

  const handleZoomIn = () => {
    if (reactFlowInstance?.current) {
      reactFlowInstance.current.zoomIn({ duration: 200 });
    }
  };

  const handleZoomOut = () => {
    if (reactFlowInstance?.current) {
      reactFlowInstance.current.zoomOut({ duration: 200 });
    }
  };

  const handleExportPNG = () => {
    console.log('📸 PNG export not yet implemented for React Flow');
    // TODO: Implement PNG export for React Flow
  };

  const handleExportJSON = () => {
    console.log('💾 JSON export not yet implemented');
    // TODO: Implement JSON export
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
  };

  const handleSizingChange = (newSizing) => {
    setSizing(newSizing);
  };

  const handleSizeExaggeration = (value) => {
    setSizeExaggeration(value);
  };

  const handleEdgeOpacity = (value) => {
    setEdgeOpacity(value);
  };

  const handleCurveStyle = (value) => {
    setCurveStyle(value);
  };

  return (
    <div className="min-h-10 bg-navy border-b border-slate flex flex-wrap items-center gap-2 px-4 py-2">
      {/* View Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleFit}
          className="px-3 py-1 bg-slate hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-sm transition text-cream whitespace-nowrap"
          title="Fit graph to view"
        >
          📐 Fit
        </button>
        <button
          onClick={handleCenter}
          className="px-3 py-1 bg-slate hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-sm transition text-cream whitespace-nowrap"
          title="Center view"
        >
          ⊙ Center
        </button>
        <button
          onClick={handleZoomIn}
          className="px-3 py-1 bg-slate hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-sm transition text-cream whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom in"
          disabled={!reactFlowInstance?.current}
        >
          ➕
        </button>
        <button
          onClick={handleZoomOut}
          className="px-3 py-1 bg-slate hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-sm transition text-cream whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          title="Zoom out"
          disabled={!reactFlowInstance?.current}
        >
          ➖
        </button>
        <button
          onClick={handleExportPNG}
          className="px-3 py-1 bg-slate hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-sm transition text-cream whitespace-nowrap"
          title="Export graph as PNG"
        >
          📸 PNG
        </button>
        <button
          onClick={handleExportJSON}
          className="px-3 py-1 bg-slate hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-sm transition text-cream whitespace-nowrap"
          title="Export graph as JSON"
        >
          💾 JSON
        </button>
      </div>

      {/* Layout Controls */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-mint font-mono">Layout:</label>
        <select
          value={layout}
          onChange={e => handleLayoutChange(e.target.value)}
          className="px-2 py-1 bg-navy border border-teal/30 rounded text-sm hover:bg-teal/20 hover:border-teal transition font-mono text-cream"
          style={{ colorScheme: 'dark' }}
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
        </select>
      </div>

      <button
        onClick={() => setClustering(!clustering)}
        className={`px-3 py-1 rounded text-sm transition border whitespace-nowrap ${
          clustering
            ? 'bg-teal hover:bg-teal/80 text-white border-teal'
            : 'bg-slate hover:bg-teal/20 text-cream border-teal/30 hover:border-teal'
        }`}
        title="Toggle folder clustering"
      >
        📦 Cluster
      </button>

      {/* Node Size Controls */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-mint font-mono whitespace-nowrap">Size:</label>
        <select
          value={sizing}
          onChange={e => handleSizingChange(e.target.value)}
          className="px-2 py-1 bg-navy border border-teal/30 rounded text-sm hover:bg-teal/20 hover:border-teal transition font-mono text-cream"
          style={{ colorScheme: 'dark' }}
        >
          <option value="uniform">📏 Uniform</option>
        </select>

        <input
          type="range"
          min="0.5"
          max="8"
          step="0.1"
          value={sizeExaggeration}
          onChange={e => handleSizeExaggeration(parseFloat(e.target.value))}
          className="w-24 h-1 bg-slate rounded-lg appearance-none cursor-pointer"
          title={`Size exaggeration: ${sizeExaggeration.toFixed(1)}x`}
        />
        <span className="text-xs text-mint font-mono w-8">{sizeExaggeration.toFixed(1)}x</span>
      </div>

      {/* Edge Controls */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-mint font-mono whitespace-nowrap">Edges:</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={edgeOpacity}
          onChange={e => handleEdgeOpacity(parseFloat(e.target.value))}
          className="w-24 h-1 bg-slate rounded-lg appearance-none cursor-pointer"
          title={`Edge opacity: ${(edgeOpacity * 100).toFixed(0)}%`}
        />
        <span className="text-xs text-mint font-mono w-10">{(edgeOpacity * 100).toFixed(0)}%</span>
      </div>

      {/* Curve Style Controls */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-mint font-mono whitespace-nowrap">Curve:</label>
        <select
          value={curveStyle}
          onChange={e => handleCurveStyle(e.target.value)}
          className="px-2 py-1 bg-navy border border-teal/30 rounded text-sm hover:bg-teal/20 hover:border-teal transition font-mono text-cream"
          style={{ colorScheme: 'dark' }}
        >
          <option value="straight">━ Straight</option>
          <option value="bezier-tight">〰 Bezier (Tight)</option>
          <option value="bezier-smooth">🌊 Bezier (Smooth)</option>
        </select>
      </div>

      {/* Status */}
      <div className="ml-auto text-xs text-mint whitespace-nowrap">
        ✓ React Flow
      </div>
    </div>
  );
}


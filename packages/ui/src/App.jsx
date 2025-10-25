import { useState, useEffect, useRef } from 'react';
import GraphView from './components/GraphView';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import Inspector from './components/Inspector';
import PlaneSwitcher from './components/PlaneSwitcher';
import RepoLoader from './components/RepoLoader';
import SearchBox from './components/SearchBox';

export default function App() {
  // Load persisted settings from localStorage
  const loadPersistedSettings = () => {
    try {
      const saved = localStorage.getItem('intellimap-settings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load settings:', e);
      return {};
    }
  };

  const persistedSettings = loadPersistedSettings();

  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [plane, setPlane] = useState(persistedSettings.plane || 'static');
  const [layout, setLayout] = useState(persistedSettings.layout || 'elk');
  const [clustering, setClustering] = useState(persistedSettings.clustering || false);
  const [currentRepo, setCurrentRepo] = useState(null);
  const [showRepoLoader, setShowRepoLoader] = useState(false);
  const [filters, setFilters] = useState({
    language: 'all',
    env: 'all', // Always default to 'all' to avoid filtering out nodes
    showChanged: false,
    collapseByFolder: true,
  });
  const cyRef = useRef(null);
  const selectedNodeRef = useRef(null);
  const [cyInstance, setCyInstance] = useState(null);

  // Edge and curve settings that should persist across view changes
  const [edgeOpacity, setEdgeOpacity] = useState(persistedSettings.edgeOpacity || 1.0);
  const [curveStyle, setCurveStyle] = useState(persistedSettings.curveStyle || 'bezier-tight');

  // Node sizing settings that should persist across view changes
  const [sizing, setSizing] = useState(persistedSettings.sizing || 'uniform');
  const [sizeExaggeration, setSizeExaggeration] = useState(persistedSettings.sizeExaggeration || 1);

  // Dependency navigation state
  const [navigationMode, setNavigationMode] = useState(null); // 'upstream', 'downstream', 'parents', 'children', or null

  // Keep selectedNodeRef in sync with selectedNode
  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    const settings = {
      plane,
      layout,
      clustering,
      filters,
      edgeOpacity,
      curveStyle,
      sizing,
      sizeExaggeration,
    };

    try {
      localStorage.setItem('intellimap-settings', JSON.stringify(settings));
      console.log('💾 Settings saved to localStorage');
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [plane, layout, clustering, filters, edgeOpacity, curveStyle, sizing, sizeExaggeration]);

  // Persist zoom and pan when cy instance changes
  useEffect(() => {
    if (!cyInstance) return;

    const saveViewport = () => {
      try {
        const viewport = {
          zoom: cyInstance.zoom(),
          pan: cyInstance.pan(),
        };
        localStorage.setItem('intellimap-viewport', JSON.stringify(viewport));
      } catch (e) {
        console.error('Failed to save viewport:', e);
      }
    };

    // Save viewport on zoom/pan changes (debounced)
    let timeout;
    const handleViewportChange = () => {
      clearTimeout(timeout);
      timeout = setTimeout(saveViewport, 500);
    };

    cyInstance.on('zoom pan', handleViewportChange);

    // Restore viewport on mount, but only if graph hasn't changed
    try {
      const saved = localStorage.getItem('intellimap-viewport');
      const savedGraphId = localStorage.getItem('intellimap-graph-id');
      const currentGraphId = graph ? `${graph.nodes?.length || 0}-${graph.edges?.length || 0}` : null;

      if (saved && savedGraphId === currentGraphId) {
        const viewport = JSON.parse(saved);
        cyInstance.zoom(viewport.zoom);
        cyInstance.pan(viewport.pan);
        console.log('📍 Viewport restored from localStorage');
      } else {
        // New graph or first load - fit to view
        cyInstance.fit(undefined, 50);
        console.log('📍 Fitting to new graph');

        // Save the new graph ID
        if (currentGraphId) {
          localStorage.setItem('intellimap-graph-id', currentGraphId);
        }
      }
    } catch (e) {
      console.error('Failed to restore viewport:', e);
      // Fallback to fit
      cyInstance.fit(undefined, 50);
    }

    return () => {
      cyInstance.off('zoom pan', handleViewportChange);
      clearTimeout(timeout);
    };
  }, [cyInstance]);

  // Handle dependency navigation
  const handleNavigate = (mode) => {
    if (mode === 'reset') {
      setNavigationMode(null);
      return;
    }

    if (!selectedNode || !selectedNode.id) {
      console.warn('No node selected for navigation');
      return;
    }

    setNavigationMode(mode);
    console.log(`🧭 Navigation mode: ${mode} for node ${selectedNode.id}`);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Press 'f' to focus/fit all visible nodes (or selected node if none are highlighted)
      if (e.key === 'f' && cyRef.current) {
        e.preventDefault();
        const cy = cyRef.current;

        // Get all visible nodes (opacity > 0.5 means highlighted, not faded)
        // This works with both class-based fading and opacity-based highlighting
        const visibleNodes = cy.nodes().filter(node => {
          const opacity = node.style('opacity');
          return opacity > 0.5; // Highlighted nodes have opacity 1, faded have 0.15
        });

        if (visibleNodes.length > 0 && visibleNodes.length < cy.nodes().length) {
          // Fit to highlighted nodes (not all nodes)
          cy.animate({
            fit: {
              eles: visibleNodes,
              padding: 50,
            },
          }, {
            duration: 500,
          });
          console.log(`🔍 Fitted to ${visibleNodes.length} highlighted nodes`);
        } else if (selectedNodeRef.current) {
          // Fallback: if no filtering active, zoom to selected node
          const nodeElement = cy.getElementById(selectedNodeRef.current.id);
          if (nodeElement.length > 0) {
            cy.animate({
              fit: {
                eles: nodeElement,
                padding: 100,
              },
            }, {
              duration: 500,
            });
            console.log(`🔍 Fitted to selected node: ${selectedNodeRef.current.id}`);
          }
        } else {
          // No selection, fit all nodes
          cy.fit(cy.nodes(), 50);
          console.log(`🔍 Fitted to all nodes`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchGraph();

    // Setup SSE listener for live reload
    const eventSource = new EventSource('/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          console.log('✓ Connected to live reload');
        } else if (data.type === 'graph-updated') {
          console.log('🔄 Graph updated, refreshing...');
          fetchGraph();
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = () => {
      console.warn('⚠️ Live reload connection lost');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const response = await fetch('/graph');
      if (!response.ok) throw new Error('Failed to load graph');
      const data = await response.json();
      setGraph(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error loading graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadRepo = async () => {
    if (!currentRepo) {
      // No repo loaded, just reload the default graph
      fetchGraph();
      return;
    }

    // Re-index the current repository
    try {
      setLoading(true);
      console.log('🔄 Reloading repository:', currentRepo);

      // Trigger re-indexing by calling the index endpoint
      const response = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentRepo,
          // Use the same config that was used to load it
          // (we could store this in state if needed)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reload repository');
      }

      const data = await response.json();
      setGraph(data);
      setError(null);
      console.log('✅ Repository reloaded successfully');
    } catch (err) {
      setError(err.message);
      console.error('Error reloading repository:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <img src="/logo-mono.png" alt="MOTH" className="w-24 h-24 mx-auto mb-4 opacity-60" />
          <h1 className="text-2xl font-bold mb-2 text-[#b8b8b8]" style={{ fontFamily: "'Poppins', sans-serif" }}>MOTHlab</h1>
          <p className="text-[#6a6a6a] text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>INITIALIZING ARCHITECTURE GRAPH...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <div className="text-4xl mb-4 text-[#8b7355]">⚠</div>
          <h1 className="text-2xl font-bold mb-2 text-[#8b7355]" style={{ fontFamily: "'Poppins', sans-serif" }}>SYSTEM ERROR</h1>
          <p className="text-[#6a6a6a] mb-4 text-sm font-mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{error}</p>
          <button
            onClick={fetchGraph}
            className="px-6 py-3 bg-white text-black rounded hover:opacity-90 transition font-semibold"
            style={{ fontFamily: "'Barlow Semi Condensed', sans-serif" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleRepoLoaded = (newGraph, repoPath) => {
    console.log('📁 Loading repository:', repoPath);
    console.log('📊 Graph data:', newGraph);
    console.log('📍 Nodes:', newGraph.nodes?.length || 0);
    console.log('🔗 Edges:', newGraph.edges?.length || 0);
    setGraph(newGraph);
    setCurrentRepo(repoPath);
    setSelectedNode(null);
    setPlane('static');
  };

  return (
    <div className="flex flex-col h-screen bg-black text-[#b8b8b8]">
      {/* Header - Nostromo Cockpit Style */}
      <header className="h-16 bg-[#0a0a0a] border-b border-[#3a3a3a]/30 flex items-center justify-between px-6 gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo-mono.png" alt="MOTH" className="w-8 h-8 opacity-80" />
          <div>
            <h1 className="text-lg font-bold text-[#d4d4d4] tracking-wide" style={{ fontFamily: "'Poppins', sans-serif" }}>
              MOTHlab
            </h1>
            <p className="text-[9px] text-[#6a6a6a] uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              ARCHITECTURE VISUALIZER
            </p>
          </div>
        </div>
        <SearchBox graph={graph} cyRef={cyRef} onSearch={setSelectedNode} />
        <div className="flex items-center gap-3">
          {currentRepo && (
            <div className="text-xs text-[#6a6a6a] font-mono max-w-xs truncate">
              {currentRepo}
            </div>
          )}
          <button
            onClick={() => setShowRepoLoader(true)}
            className="px-3 py-1.5 bg-[#1a1a1a] text-[#a0a0a0] border border-[#3a3a3a] rounded hover:border-[#5a5a5a] hover:bg-[#2a2a2a] transition text-xs"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            title="Open a different repository"
          >
            BROWSE
          </button>
          <button
            onClick={handleReloadRepo}
            className="px-3 py-1.5 bg-[#1a1a1a] text-[#a0a0a0] border border-[#3a3a3a] rounded hover:border-[#5a5a5a] hover:bg-[#2a2a2a] transition text-xs"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            title={currentRepo ? `Reload ${currentRepo.split('/').pop()}` : 'Reload current graph'}
          >
            RELOAD
          </button>
          <PlaneSwitcher plane={plane} setPlane={setPlane} />
        </div>
      </header>

      {showRepoLoader && (
        <RepoLoader
          onRepoLoaded={handleRepoLoaded}
          onClose={() => setShowRepoLoader(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar - Fixed width */}
        <div className="flex-shrink-0">
          <Sidebar filters={filters} setFilters={setFilters} graph={graph} cy={cyInstance} />
        </div>

        {/* Main Content - Fills remaining space */}
        <main className="flex-1 flex flex-col min-w-0">
          <Toolbar
            cy={cyInstance}
            layout={layout}
            setLayout={setLayout}
            clustering={clustering}
            setClustering={setClustering}
            edgeOpacity={edgeOpacity}
            setEdgeOpacity={setEdgeOpacity}
            curveStyle={curveStyle}
            setCurveStyle={setCurveStyle}
            sizing={sizing}
            setSizing={setSizing}
            sizeExaggeration={sizeExaggeration}
            setSizeExaggeration={setSizeExaggeration}
            currentRepo={currentRepo}
          />
          <GraphView
            graph={graph}
            plane={plane}
            filters={filters}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            cyRef={cyRef}
            clustering={clustering}
            setCyInstance={setCyInstance}
            edgeOpacity={edgeOpacity}
            curveStyle={curveStyle}
            navigationMode={navigationMode}
          />
        </main>

        {/* Right Sidebar - Resizable, positioned absolutely won't affect left */}
        <div className="flex-shrink-0">
          <Inspector
            selectedNode={selectedNode}
            graph={graph}
            currentRepo={currentRepo}
            onNavigate={handleNavigate}
          />
        </div>
      </div>

      {/* Footer - Nostromo Style */}
      <footer className="h-8 bg-[#0a0a0a] border-t border-[#3a3a3a]/30 flex items-center justify-between px-6 text-[10px] text-[#6a6a6a] flex-shrink-0">
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="uppercase tracking-wider">
          © 2025 MOTHlab • <a href="https://www.alienrobot.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#a0a0a0] transition">Alienrobot LLC</a>
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="uppercase tracking-wider">
          {graph?.nodes?.length || 0} NODES • {graph?.edges?.length || 0} EDGES
        </span>
      </footer>
    </div>
  );
}


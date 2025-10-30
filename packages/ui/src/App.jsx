import { useState, useEffect, useRef } from 'react';
import GraphView from './components/GraphView';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import Inspector from './components/Inspector';
import PlaneSwitcher from './components/PlaneSwitcher';
import SettingsModal from './components/SettingsModal';
import RepoLoader from './components/RepoLoader';
import SearchBox from './components/SearchBox';

export default function App() {
  console.log('🚀 IntelliMap App loaded - React Flow ONLY (no Cytoscape)');

  // Load persisted settings from localStorage
  const loadPersistedSettings = () => {
    try {
      const saved = localStorage.getItem('intellimap-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        // Remove deprecated 'renderer' setting (we only use React Flow now)
        if ('renderer' in settings) {
          console.log('🧹 Removing deprecated renderer setting from localStorage');
          delete settings.renderer;
          localStorage.setItem('intellimap-settings', JSON.stringify(settings));
        }
        return settings;
      }
      return {};
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
  const [showSettings, setShowSettings] = useState(false);
  const [filters, setFilters] = useState({
    language: 'all',
    env: 'all', // Always default to 'all' to avoid filtering out nodes
    showChanged: false,
    collapseByFolder: true,
  });
  const selectedNodeRef = useRef(null);
  const reactFlowInstanceRef = useRef(null); // Ref for React Flow instance

  // Edge and curve settings that should persist across view changes
  const [edgeOpacity, setEdgeOpacity] = useState(persistedSettings.edgeOpacity || 1.0);
  const [curveStyle, setCurveStyle] = useState(persistedSettings.curveStyle || 'bezier-tight');

  // Node sizing settings that should persist across view changes
  const [sizing, setSizing] = useState(persistedSettings.sizing || 'uniform');
  const [sizeExaggeration, setSizeExaggeration] = useState(persistedSettings.sizeExaggeration || 1);

  // RAG highlighting state
  const [highlightedPaths, setHighlightedPaths] = useState([]);

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

  // Handle RAG node highlighting
  const handleHighlightNodes = (paths) => {
    setHighlightedPaths(paths);
    console.log(`🔍 Highlighting ${paths.length} nodes:`, paths);
  };

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

  // Handle keyboard shortcuts - only when graph is focused
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only trigger 'f' hotkey when focus is on the graph container or body
      // Ignore if user is typing in an input, textarea, or contenteditable
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      // Press 'f' to focus/fit view (only when not typing)
      if (e.key === 'f' && !isTyping) {
        e.preventDefault();
        console.log('🔍 F key pressed, attempting to fit view...');

        if (reactFlowInstanceRef.current) {
          const instance = reactFlowInstanceRef.current;
          console.log('✅ ReactFlow instance found:', instance);
          instance.fitView({ padding: 0.2, duration: 500 });
          console.log('🔍 Fitted view');
        } else {
          console.warn('⚠️ ReactFlow instance not available');
        }
      } else if (e.key === 'f' && isTyping) {
        console.log('⌨️ F key pressed but user is typing in:', activeElement.tagName);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlowInstanceRef]);

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

      // Extract repo path if provided
      const { repoPath, ...graphData } = data;
      setGraph(graphData);
      if (repoPath) {
        setCurrentRepo(repoPath);
        console.log('📁 Repository path:', repoPath);
      }
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
    setShowRepoLoader(false); // Close the modal
    console.log('✅ Repository loaded, modal should close');
  };

  return (
    <div className="flex flex-col h-screen bg-black text-cream">
      {/* Header - Nostromo Cockpit Style */}
      <header className="h-16 bg-navy border-b border-slate/50 flex items-center justify-between px-6 gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo-mono.png" alt="MOTH" className="w-8 h-8 opacity-80" />
          <div>
            <h1 className="text-lg font-bold text-cream tracking-wide" style={{ fontFamily: "'Poppins', sans-serif" }}>
              MOTHlab
            </h1>
            <p className="text-[9px] text-teal uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              ARCHITECTURE VISUALIZER
            </p>
          </div>
        </div>
        <SearchBox graph={graph} onSearch={setSelectedNode} />
        <div className="flex items-center gap-3">
          {currentRepo && (
            <div className="text-xs text-mint font-mono max-w-xs truncate">
              {currentRepo}
            </div>
          )}
          <button
            onClick={() => setShowRepoLoader(true)}
            className="px-3 py-1.5 bg-slate text-cream border border-teal/30 rounded hover:border-teal hover:bg-teal/20 transition text-xs"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            title="Open a different repository"
          >
            BROWSE
          </button>
          <button
            onClick={handleReloadRepo}
            className="px-3 py-1.5 bg-slate text-cream border border-teal/30 rounded hover:border-teal hover:bg-teal/20 transition text-xs"
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

      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar - Fixed width */}
        <div className="flex-shrink-0">
          <Sidebar
            filters={filters}
            setFilters={setFilters}
            graph={graph}
            currentRepo={currentRepo}
            onHighlightNodes={handleHighlightNodes}
          />
        </div>

        {/* Main Content - Fills remaining space */}
        <main className="flex-1 flex flex-col min-w-0">
          <Toolbar
            reactFlowInstance={reactFlowInstanceRef}
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
            onSettingsClick={() => setShowSettings(true)}
          />
          <GraphView
            graph={graph}
            plane={plane}
            filters={filters}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            clustering={clustering}
            edgeOpacity={edgeOpacity}
            curveStyle={curveStyle}
            navigationMode={navigationMode}
            layout={layout}
            reactFlowInstanceRef={reactFlowInstanceRef}
            currentRepo={currentRepo}
            highlightedPaths={highlightedPaths}
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


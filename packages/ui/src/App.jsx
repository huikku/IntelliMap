import { useState, useEffect, useRef } from 'react';
import GraphView from './components/GraphView';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import Inspector from './components/Inspector';
import PlaneSwitcher from './components/PlaneSwitcher';
import RepoLoader from './components/RepoLoader';

export default function App() {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [plane, setPlane] = useState('static');
  const [layout, setLayout] = useState('elk');
  const [clustering, setClustering] = useState(false);
  const [currentRepo, setCurrentRepo] = useState(null);
  const [showRepoLoader, setShowRepoLoader] = useState(false);
  const [filters, setFilters] = useState({
    language: 'all',
    env: 'all',
    showChanged: false,
    collapseByFolder: true,
  });
  const cyRef = useRef(null);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-900 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">🗺️ IntelliMap</h1>
          <p className="text-gray-400">Loading architecture graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-900 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-red-500">❌ Error</h1>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={fetchGraph}
            className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
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
    <div className="flex flex-col h-screen bg-dark-900 text-white">
      {/* Header */}
      <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">🗺️ IntelliMap</h1>
          {currentRepo && (
            <span className="text-xs text-gray-400 truncate max-w-xs">
              {currentRepo.split('/').pop()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRepoLoader(true)}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm"
            title="Open repository"
          >
            📁 Open Repo
          </button>
          <button
            onClick={fetchGraph}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            title="Reindex"
          >
            ⟳ Reload
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar filters={filters} setFilters={setFilters} graph={graph} />

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          <Toolbar cy={cyRef.current} layout={layout} setLayout={setLayout} clustering={clustering} setClustering={setClustering} />
          <GraphView
            graph={graph}
            plane={plane}
            filters={filters}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            cyRef={cyRef}
            clustering={clustering}
          />
        </main>

        {/* Right Sidebar */}
        <Inspector selectedNode={selectedNode} graph={graph} />
      </div>

      {/* Footer */}
      <footer className="h-6 bg-gray-950 border-t border-gray-800 flex items-center justify-between px-4 text-xs text-gray-500">
        <span>© 2025 IntelliMap</span>
        <span>
          {graph?.nodes?.length || 0} nodes • {graph?.edges?.length || 0} edges
        </span>
      </footer>
    </div>
  );
}


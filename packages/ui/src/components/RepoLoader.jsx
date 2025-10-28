import { useState, useEffect } from 'react';

export default function RepoLoader({ onRepoLoaded, onClose }) {
  const [currentPath, setCurrentPath] = useState(process.env.HOME || '/home/john');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [indexing, setIndexing] = useState(false);
  const [pathInput, setPathInput] = useState('');

  // Load directory on mount
  useEffect(() => {
    if (currentPath) {
      browsePath(currentPath);
    }
  }, []);

  const browsePath = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to browse directory');
      }
      const data = await response.json();
      setCurrentPath(data.path);
      setItems(data.items);
      setSelectedRepo(null); // Clear selection when browsing
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    browsePath(parentPath);
  };

  const handleOpenRepo = async () => {
    if (!selectedRepo) return;

    setIndexing(true);
    setError(null);

    try {
      // Step 1: Detect entry points
      console.log('🔍 Detecting entry points for:', selectedRepo);
      const detectResponse = await fetch(`/api/detect-entry-points?path=${encodeURIComponent(selectedRepo)}`);

      if (!detectResponse.ok) {
        const data = await detectResponse.json();
        throw new Error(data.message || 'Failed to detect entry points');
      }

      const entryPoints = await detectResponse.json();
      console.log('📍 Detected entry points:', entryPoints);

      // Step 2: Index the repository with detected entry points
      console.log('📦 Indexing repository...');
      const response = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: selectedRepo,
          ...entryPoints, // Include detected entry points
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to index repository');
      }

      const data = await response.json();
      console.log('✅ Repository indexed:', data);
      console.log('🔍 Checking graph data...');
      console.log('  - data.graph exists?', !!data.graph);
      console.log('  - data.graph.nodes exists?', !!data.graph?.nodes);
      console.log('  - data.graph.nodes.length:', data.graph?.nodes?.length);

      // Check if graph is empty
      if (!data.graph || !data.graph.nodes || data.graph.nodes.length === 0) {
        console.log('❌ Graph is empty, showing error');
        setError('⚠️ No code found in this repository. Try selecting a different folder with JavaScript, TypeScript, or Python files.');
        setIndexing(false);
        return;
      }

      console.log('📊 Calling onRepoLoaded with graph:', data.graph.nodes.length, 'nodes');
      onRepoLoaded(data.graph, selectedRepo);
      console.log('🚪 Calling onClose');
      onClose();
    } catch (err) {
      console.error('Error indexing repo:', err);
      setError(err.message);
    } finally {
      setIndexing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-navy border-2 border-teal rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-slate">
          <h2 className="text-xl font-bold text-cream">📁 Open Repository</h2>
          <button
            onClick={onClose}
            className="text-mint hover:text-cream text-2xl transition"
          >
            ✕
          </button>
        </div>

        {/* Path Navigation */}
        <div className="p-3 bg-slate border-b border-teal/30">
          <div className="flex gap-2">
            <button
              onClick={goUp}
              disabled={currentPath === '/'}
              className="px-3 py-2 bg-navy hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-sm transition text-cream disabled:opacity-50 disabled:cursor-not-allowed"
              title="Go up one level"
            >
              ↑ Up
            </button>
            <input
              type="text"
              value={pathInput || currentPath}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && pathInput.trim()) {
                  browsePath(pathInput.trim());
                  setPathInput('');
                }
              }}
              placeholder="Type path and press Enter..."
              className="flex-1 px-3 py-2 bg-navy border border-teal/30 rounded text-sm font-mono text-cream focus:border-teal focus:outline-none"
              style={{ colorScheme: 'dark' }}
            />
            <button
              onClick={() => {
                if (pathInput.trim()) {
                  browsePath(pathInput.trim());
                  setPathInput('');
                }
              }}
              className="px-4 py-2 bg-teal hover:bg-teal/80 text-white rounded text-sm font-semibold transition"
            >
              Go
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-rust/20 border-b border-rust text-sm text-cream">
            ⚠️ {error}
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-mint">
              <div className="text-center">
                <div className="text-2xl mb-2">⏳</div>
                <div>Loading...</div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-mint">
              <div className="text-center">
                <div className="text-2xl mb-2">📭</div>
                <div>Empty directory</div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate">
              {items.map(item => (
                <div
                  key={item.path}
                  className={`flex items-center hover:bg-slate/50 transition ${
                    selectedRepo === item.path ? 'bg-teal/20' : ''
                  }`}
                >
                  <button
                    onClick={() => {
                      if (item.isDirectory) {
                        browsePath(item.path);
                      } else {
                        setSelectedRepo(item.path);
                      }
                    }}
                    className="flex-1 text-left px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-lg">
                      {item.isDirectory ? '📁' : '📄'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-cream">{item.name}</div>
                      {item.isDirectory && (
                        <div className="text-xs text-mint truncate">{item.path}</div>
                      )}
                    </div>
                  </button>
                  {!item.isDirectory && (
                    <button
                      onClick={() => setSelectedRepo(item.path)}
                      className={`px-4 py-3 transition ${
                        selectedRepo === item.path
                          ? 'text-teal'
                          : 'text-mint hover:text-cream'
                      }`}
                      title="Select this folder as repository"
                    >
                      {selectedRepo === item.path ? '✓' : '○'}
                    </button>
                  )}
                  {item.isDirectory && (
                    <button
                      onClick={() => setSelectedRepo(item.path)}
                      className={`px-4 py-3 transition ${
                        selectedRepo === item.path
                          ? 'text-teal'
                          : 'text-mint hover:text-cream'
                      }`}
                      title="Select this folder as repository"
                    >
                      {selectedRepo === item.path ? '✓' : '○'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t-2 border-slate bg-slate">
          <button
            onClick={handleOpenRepo}
            disabled={!selectedRepo || indexing}
            className="flex-1 px-4 py-3 bg-teal hover:bg-teal/80 disabled:bg-slate disabled:text-mint disabled:cursor-not-allowed rounded text-white font-semibold transition"
          >
            {indexing ? '🔄 Indexing...' : '→ Open & Index Repository'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-navy hover:bg-teal/20 border border-teal/30 hover:border-teal rounded text-cream transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


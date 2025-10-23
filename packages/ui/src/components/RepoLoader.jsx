import { useState } from 'react';

const QUICK_PATHS = [
  { name: '📁 Home', path: process.env.HOME || '/home/john' },
  { name: '💻 Root', path: '/' },
  { name: '📂 Desktop', path: `${process.env.HOME || '/home/john'}/Desktop` },
  { name: '📥 Downloads', path: `${process.env.HOME || '/home/john'}/Downloads` },
  { name: '🖥️ /opt', path: '/opt' },
  { name: '📦 /usr', path: '/usr' },
];

export default function RepoLoader({ onRepoLoaded, onClose }) {
  const [currentPath, setCurrentPath] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [indexing, setIndexing] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [indexConfig, setIndexConfig] = useState({
    entry: '',
    nodeEntry: '',
    pyRoot: '',
    pyExtraPath: '',
  });

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIndexRepo = async () => {
    if (!selectedRepo) return;
    
    setIndexing(true);
    setError(null);
    try {
      const response = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: selectedRepo,
          ...indexConfig,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to index repository');
      }
      
      const data = await response.json();
      console.log('✓ Repository indexed successfully');
      console.log('Graph:', data.graph);
      console.log('Nodes:', data.graph.nodes?.length || 0);
      console.log('Edges:', data.graph.edges?.length || 0);

      // Check if graph is empty
      if (!data.graph.nodes || data.graph.nodes.length === 0) {
        setError('⚠️ No code found! Check your entry points:\n- Frontend: ' + (indexConfig.entry || 'not set') + '\n- Node.js: ' + (indexConfig.nodeEntry || 'not set') + '\n- Python: ' + (indexConfig.pyRoot || 'not set'));
        setIndexing(false);
        return;
      }

      onRepoLoaded(data.graph, selectedRepo);
      onClose();
    } catch (err) {
      console.error('Error indexing repo:', err);
      setError(err.message);
    } finally {
      setIndexing(false);
    }
  };

  // Initialize with root directory
  if (!currentPath) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-96 flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold">📁 Open Repository</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-6">Select a location to start browsing</p>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_PATHS.map(({ name, path }) => (
                  <button
                    key={path}
                    onClick={() => browsePath(path)}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded text-left transition"
                  >
                    <div className="font-semibold">{name}</div>
                    <div className="text-xs text-gray-500">{path}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handlePathInputChange = (e) => {
    setPathInput(e.target.value);
  };

  const handlePathInputSubmit = (e) => {
    if (e.key === 'Enter' && pathInput.trim()) {
      browsePath(pathInput.trim());
      setPathInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
          <h2 className="text-lg font-bold">📁 Open Repository</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Address Bar */}
        <div className="p-3 border-b border-gray-700 bg-gray-800">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
                if (parent !== currentPath) browsePath(parent);
              }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              title="Go up one level"
            >
              ↑
            </button>
            <input
              type="text"
              value={pathInput || currentPath}
              onChange={handlePathInputChange}
              onKeyPress={handlePathInputSubmit}
              placeholder="Type path and press Enter..."
              className="flex-1 px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm font-mono"
            />
            <button
              onClick={() => browsePath(pathInput || currentPath)}
              className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm"
            >
              Go
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-900 text-red-200 text-sm border-b border-red-800">
            ⚠️ {error}
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-gray-800 border-r border-gray-700 overflow-y-auto">
            <div className="p-3 space-y-1">
              <div className="text-xs font-bold text-gray-400 px-2 py-1">QUICK ACCESS</div>
              {QUICK_PATHS.map(({ name, path }) => (
                <button
                  key={path}
                  onClick={() => browsePath(path)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 rounded transition"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-2xl mb-2">⏳</div>
                  <div>Loading...</div>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-2xl mb-2">📭</div>
                  <div>Empty directory</div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {items.map(item => (
                  <div key={item.path} className="flex items-center">
                    <button
                      onClick={() => {
                        if (item.isDirectory) {
                          browsePath(item.path);
                        }
                      }}
                      className="flex-1 text-left px-4 py-3 hover:bg-gray-800 transition flex items-center gap-3"
                    >
                      <span className="text-lg">
                        {item.isDirectory ? '📁' : '📄'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-gray-500 truncate">{item.path}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedRepo(item.path)}
                      className={`px-4 py-3 transition ${
                        selectedRepo === item.path
                          ? 'bg-blue-900 text-blue-400'
                          : 'hover:bg-gray-800 text-gray-400'
                      }`}
                      title={`Select ${item.isDirectory ? 'folder' : 'file'} as repository`}
                    >
                      {selectedRepo === item.path ? '✓' : '○'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Config Panel */}
        {selectedRepo && (
          <div className="border-t border-gray-700 bg-gray-800 p-4 max-h-48 overflow-y-auto">
            <div className="text-sm font-bold mb-3">📋 Index Configuration</div>
            <div className="space-y-2 text-sm">
              <div>
                <label className="text-xs text-gray-400">Selected Repository</label>
                <div className="px-2 py-1 bg-gray-900 rounded text-xs font-mono truncate">
                  {selectedRepo}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">Frontend Entry Point (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., src/index.ts or src/main.jsx"
                  value={indexConfig.entry}
                  onChange={e => setIndexConfig({ ...indexConfig, entry: e.target.value })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Node.js Entry Point (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., server/index.js or index.js"
                  value={indexConfig.nodeEntry}
                  onChange={e => setIndexConfig({ ...indexConfig, nodeEntry: e.target.value })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Python Root (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., . or backend/ or src/"
                  value={indexConfig.pyRoot}
                  onChange={e => setIndexConfig({ ...indexConfig, pyRoot: e.target.value })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Python Extra Path (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., .venv/lib/python3.11/site-packages"
                  value={indexConfig.pyExtraPath}
                  onChange={e => setIndexConfig({ ...indexConfig, pyExtraPath: e.target.value })}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-700 bg-gray-800">
          <button
            onClick={handleIndexRepo}
            disabled={!selectedRepo || indexing}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-white font-medium transition"
          >
            {indexing ? '⏳ Indexing...' : '✓ Load Repository'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


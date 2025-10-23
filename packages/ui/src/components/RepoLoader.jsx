import { useState } from 'react';

export default function RepoLoader({ onRepoLoaded, onClose }) {
  const [currentPath, setCurrentPath] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [indexing, setIndexing] = useState(false);
  const [indexConfig, setIndexConfig] = useState({
    entry: 'src/index.ts',
    nodeEntry: '',
    pyRoot: '',
    pyExtraPath: '',
  });

  const browsePath = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error('Failed to browse directory');
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
      onRepoLoaded(data.graph, selectedRepo);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIndexing(false);
    }
  };

  // Initialize with home directory
  if (!currentPath) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-96 flex flex-col">
          <h2 className="text-xl font-bold mb-4">📁 Load Repository</h2>
          <button
            onClick={() => browsePath(process.env.HOME || '/home')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
          >
            Browse Home Directory
          </button>
          <button
            onClick={onClose}
            className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-3xl w-full max-h-96 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">📁 Load Repository</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 text-red-200 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-2">Current: {currentPath}</p>
          <div className="flex gap-2">
            <button
              onClick={() => browsePath(currentPath.split('/').slice(0, -1).join('/') || '/')}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              ↑ Up
            </button>
            <button
              onClick={() => browsePath(process.env.HOME || '/home')}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              🏠 Home
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 border border-gray-700 rounded">
          {loading ? (
            <div className="p-4 text-gray-400">Loading...</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {items.map(item => (
                <button
                  key={item.path}
                  onClick={() => {
                    if (item.isDirectory) {
                      browsePath(item.path);
                    } else {
                      setSelectedRepo(item.path);
                    }
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-800 transition ${
                    selectedRepo === item.path ? 'bg-blue-900' : ''
                  }`}
                >
                  <span className="mr-2">{item.isDirectory ? '📁' : '📄'}</span>
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedRepo && (
          <div className="mb-4 p-3 bg-gray-800 rounded">
            <p className="text-sm text-gray-300 mb-3">
              Selected: <code className="text-xs bg-gray-900 px-2 py-1 rounded">{selectedRepo}</code>
            </p>
            <div className="space-y-2 text-sm">
              <input
                type="text"
                placeholder="Entry point (e.g., src/index.ts)"
                value={indexConfig.entry}
                onChange={e => setIndexConfig({ ...indexConfig, entry: e.target.value })}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
              />
              <input
                type="text"
                placeholder="Node entry (optional, e.g., server/index.ts)"
                value={indexConfig.nodeEntry}
                onChange={e => setIndexConfig({ ...indexConfig, nodeEntry: e.target.value })}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
              />
              <input
                type="text"
                placeholder="Python root (optional, e.g., backend/)"
                value={indexConfig.pyRoot}
                onChange={e => setIndexConfig({ ...indexConfig, pyRoot: e.target.value })}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
              />
              <input
                type="text"
                placeholder="Python extra path (optional)"
                value={indexConfig.pyExtraPath}
                onChange={e => setIndexConfig({ ...indexConfig, pyExtraPath: e.target.value })}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleIndexRepo}
            disabled={!selectedRepo || indexing}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-white"
          >
            {indexing ? '⏳ Indexing...' : '✓ Load Repository'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


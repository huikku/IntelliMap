import { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

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
  const [step, setStep] = useState('select'); // 'select' or 'configure'
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

  const detectEntryPoints = async (repoPath) => {
    try {
      const response = await fetch(`/api/detect-entry-points?path=${encodeURIComponent(repoPath)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Detected entry points:', data);
        return data;
      }
    } catch (err) {
      console.error('Error detecting entry points:', err);
    }
    return null;
  };

  const handleSelectRepo = async () => {
    if (!selectedRepo) return;

    // Auto-detect entry points
    setLoading(true);
    const detected = await detectEntryPoints(selectedRepo);
    setLoading(false);

    if (detected) {
      setIndexConfig({
        entry: detected.entry || '',
        nodeEntry: detected.nodeEntry || '',
        pyRoot: detected.pyRoot || '',
        pyExtraPath: detected.pyExtraPath || '',
      });
    }

    setStep('configure');
    setError(null);
  };

  const handleIndexRepo = async () => {
    if (!selectedRepo) return;

    // Check if at least one entry point is set
    if (!indexConfig.entry && !indexConfig.nodeEntry && !indexConfig.pyRoot) {
      setError('❌ No entry points found. Try manually specifying one:\n- Frontend (e.g., src/main.tsx)\n- Node.js (e.g., server.js)\n- Python (e.g., .)');
      return;
    }

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
        <div className="bg-[#000000] rounded-lg w-full max-w-4xl max-h-96 flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-[#2a2a2a]">
            <h2 className="text-lg font-bold">📁 Open Repository</h2>
            <button
              onClick={onClose}
              className="text-[#6a6a6a] hover:text-[#d4d4d4] text-2xl"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[#6a6a6a] mb-6">Select a location to start browsing</p>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_PATHS.map(({ name, path }) => (
                  <button
                    key={path}
                    onClick={() => browsePath(path)}
                    className="px-4 py-3 bg-[#0a0a0a] hover:bg-[#1a1a1a] rounded text-left transition"
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
    <>
      {indexing && <LoadingSpinner message="Indexing repository and building dependency graph..." />}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#000000] rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          <h2 className="text-lg font-bold">📁 Open Repository</h2>
          <button
            onClick={onClose}
            className="text-[#6a6a6a] hover:text-[#d4d4d4] text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Address Bar */}
        <div className="p-3 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
                if (parent !== currentPath) browsePath(parent);
              }}
              className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded text-sm"
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
              className="flex-1 px-3 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-sm font-mono"
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
        {step === 'select' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-[#0a0a0a] border-r border-[#2a2a2a] overflow-y-auto">
            <div className="p-3 space-y-1">
              <div className="text-xs font-bold text-[#6a6a6a] px-2 py-1">QUICK ACCESS</div>
              {QUICK_PATHS.map(({ name, path }) => (
                <button
                  key={path}
                  onClick={() => browsePath(path)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#1a1a1a] rounded transition"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full text-[#6a6a6a]">
                <div className="text-center">
                  <div className="text-2xl mb-2">⏳</div>
                  <div>Loading...</div>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#6a6a6a]">
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
                      className="flex-1 text-left px-4 py-3 hover:bg-[#0a0a0a] transition flex items-center gap-3"
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
                          : 'hover:bg-[#0a0a0a] text-[#6a6a6a]'
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
        ) : (
        <div className="flex-1 overflow-auto p-6 bg-[#000000]">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-4">⚙️ Configure Entry Points</h3>
            <p className="text-[#6a6a6a] mb-4">Repository: <span className="font-mono text-blue-400">{selectedRepo}</span></p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Frontend Entry Point</label>
                <p className="text-xs text-[#6a6a6a] mb-2">Auto-detected: {indexConfig.entry || 'None found'}</p>
                <input
                  type="text"
                  placeholder="e.g., src/main.tsx or src/index.js"
                  value={indexConfig.entry}
                  onChange={e => setIndexConfig({ ...indexConfig, entry: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Node.js Entry Point</label>
                <p className="text-xs text-[#6a6a6a] mb-2">Auto-detected: {indexConfig.nodeEntry || 'None found'}</p>
                <input
                  type="text"
                  placeholder="e.g., server/index.js or index.js"
                  value={indexConfig.nodeEntry}
                  onChange={e => setIndexConfig({ ...indexConfig, nodeEntry: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Python Root</label>
                <p className="text-xs text-[#6a6a6a] mb-2">Auto-detected: {indexConfig.pyRoot || 'None found'}</p>
                <input
                  type="text"
                  placeholder="e.g., . or backend/ or src/"
                  value={indexConfig.pyRoot}
                  onChange={e => setIndexConfig({ ...indexConfig, pyRoot: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Python Extra Path</label>
                <p className="text-xs text-[#6a6a6a] mb-2">Auto-detected: {indexConfig.pyExtraPath || 'None found'}</p>
                <input
                  type="text"
                  placeholder="e.g., .venv/lib/python3.11/site-packages"
                  value={indexConfig.pyExtraPath}
                  onChange={e => setIndexConfig({ ...indexConfig, pyExtraPath: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900 border border-red-700 rounded text-sm text-red-200 whitespace-pre-wrap">
                {error}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Config Panel - OLD - REMOVE */}
        {false /* eslint-disable-line no-constant-binary-expression */ && selectedRepo && (
          <div className="border-t border-[#2a2a2a] bg-[#0a0a0a] p-4">
            <div className="text-sm font-bold mb-2">📋 Index Configuration</div>
            <div className="space-y-2 text-sm">
              <div>
                <label className="text-xs text-[#6a6a6a]">Selected Repository</label>
                <div className="px-2 py-1 bg-[#000000] rounded text-xs font-mono truncate">
                  {selectedRepo}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#6a6a6a]">Frontend Entry Point <span className="text-gray-500">(or set Node.js/Python)</span></label>
                <input
                  type="text"
                  placeholder="e.g., src/main.tsx or src/index.js"
                  value={indexConfig.entry}
                  onChange={e => {
                    console.log('Frontend entry changed to:', e.target.value);
                    setIndexConfig({ ...indexConfig, entry: e.target.value });
                  }}
                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-[#6a6a6a]">Node.js Entry Point (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., server/index.js or index.js"
                  value={indexConfig.nodeEntry}
                  onChange={e => setIndexConfig({ ...indexConfig, nodeEntry: e.target.value })}
                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-[#6a6a6a]">Python Root (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., . or backend/ or src/"
                  value={indexConfig.pyRoot}
                  onChange={e => setIndexConfig({ ...indexConfig, pyRoot: e.target.value })}
                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-[#6a6a6a]">Python Extra Path (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., .venv/lib/python3.11/site-packages"
                  value={indexConfig.pyExtraPath}
                  onChange={e => setIndexConfig({ ...indexConfig, pyExtraPath: e.target.value })}
                  className="w-full px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-[#2a2a2a] bg-[#0a0a0a]">
          {step === 'select' ? (
            <>
              <button
                onClick={handleSelectRepo}
                disabled={!selectedRepo || loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-[#2a2a2a] rounded text-white font-medium transition"
              >
                {loading ? '🔍 Detecting...' : '→ Next: Configure'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded text-white transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded text-white transition"
              >
                ← Back
              </button>
              <button
                onClick={handleIndexRepo}
                disabled={indexing}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-[#2a2a2a] rounded text-white font-medium transition"
              >
                {indexing ? '⏳ Indexing...' : '✓ Load Repository'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded text-white transition"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}


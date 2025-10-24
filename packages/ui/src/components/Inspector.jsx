import { useState, useRef, useEffect } from 'react';

export default function Inspector({ selectedNode, graph, currentRepo, onNavigate }) {
  const [width, setWidth] = useState(320); // 80 * 4 = 320px (w-80)
  const [isResizing, setIsResizing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const resizeRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 800) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!selectedNode) {
    return (
      <aside
        style={{ width: `${width}px` }}
        className="h-full bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden relative"
      >
        {/* Resize handle */}
        <div
          ref={resizeRef}
          onMouseDown={() => setIsResizing(true)}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
          title="Drag to resize"
        />
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-sm font-heading font-bold text-gray-300 mb-4">DETAILS</h2>
          <p className="text-xs text-gray-500">Select a node or edge to view details</p>
        </div>
      </aside>
    );
  }

  // Check if this is an edge (has 'from' and 'to' properties)
  const isEdge = selectedNode.from && selectedNode.to;

  if (isEdge) {
    // Edge details
    const fromNode = graph?.nodes?.find(n => n.id === selectedNode.from);
    const toNode = graph?.nodes?.find(n => n.id === selectedNode.to);

    // Calculate edge color and type
    let edgeColor = '#6b7280'; // default gray
    let edgeType = 'Same Language';
    let connectionType = 'Internal';

    if (fromNode && toNode) {
      const sourceLang = fromNode.lang;
      const targetLang = toNode.lang;
      const sourceEnv = fromNode.env;
      const targetEnv = toNode.env;
      const isChanged = fromNode.changed || toNode.changed;

      // Frontend → Backend (API boundary)
      if (sourceEnv === 'frontend' && targetEnv === 'backend') {
        edgeColor = isChanged ? '#fbbf24' : '#f59e0b'; // amber
        edgeType = 'Frontend → Backend';
        connectionType = 'API Call';
      }
      // Backend → Frontend (unusual)
      else if (sourceEnv === 'backend' && targetEnv === 'frontend') {
        edgeColor = isChanged ? '#f87171' : '#ef4444'; // red
        edgeType = 'Backend → Frontend';
        connectionType = 'Reverse Dependency';
      }
      // Cross-language
      else if (sourceLang !== targetLang) {
        edgeColor = isChanged ? '#a78bfa' : '#8b5cf6'; // violet
        edgeType = 'Cross-Language';
        connectionType = 'Interop';
      }
      // TypeScript
      else if (sourceLang === 'ts' || sourceLang === 'tsx') {
        edgeColor = isChanged ? '#60a5fa' : '#3b82f6'; // blue
        edgeType = 'TypeScript';
        connectionType = 'Import';
      }
      // JavaScript
      else if (sourceLang === 'js' || sourceLang === 'jsx') {
        edgeColor = isChanged ? '#fbbf24' : '#eab308'; // yellow
        edgeType = 'JavaScript';
        connectionType = 'Import';
      }
      // Python
      else if (sourceLang === 'py') {
        edgeColor = isChanged ? '#34d399' : '#10b981'; // emerald
        edgeType = 'Python';
        connectionType = 'Import';
      }
    }

    return (
      <aside
        style={{ width: `${width}px` }}
        className="h-full bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden relative"
      >
        {/* Resize handle */}
        <div
          ref={resizeRef}
          onMouseDown={() => setIsResizing(true)}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
          title="Drag to resize"
        />
        <div className="flex-shrink-0 p-4 overflow-y-auto max-h-[50vh]">
          <h2 className="text-sm font-heading font-bold text-gray-300 mb-4">CONNECTION</h2>

          <div className="space-y-3 text-sm">
            {/* Edge Color Preview */}
            <div>
              <label className="text-xs text-gray-400 font-condensed">Edge Color</label>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-16 h-6 rounded border border-gray-700"
                  style={{ backgroundColor: edgeColor }}
                />
                <code className="text-xs text-gray-400 font-mono">{edgeColor}</code>
              </div>
            </div>

            {/* Connection Type */}
            <div>
              <label className="text-xs text-gray-400 font-condensed">Connection Type</label>
              <span className="block mt-1">
                <span className="px-2 py-1 bg-purple-900 text-purple-200 rounded text-xs font-mono">
                  {connectionType}
                </span>
              </span>
            </div>

            {/* Edge Type */}
            <div>
              <label className="text-xs text-gray-400 font-condensed">Edge Type</label>
              <span className="block mt-1">
                <span className="px-2 py-1 bg-indigo-900 text-indigo-200 rounded text-xs font-mono">
                  {edgeType}
                </span>
              </span>
            </div>

            <div className="border-t border-gray-800 pt-3">
              <label className="text-xs text-gray-400 font-condensed">From</label>
              <code className="block bg-gray-800 p-2 rounded text-xs mt-1 break-all font-mono">
                {selectedNode.from}
              </code>
            </div>

            <div className="text-center text-gray-500 text-2xl">↓</div>

            <div>
              <label className="text-xs text-gray-400 font-condensed">To</label>
              <code className="block bg-gray-800 p-2 rounded text-xs mt-1 break-all font-mono">
                {selectedNode.to}
              </code>
            </div>

            {selectedNode.type && (
              <div>
                <label className="text-xs text-gray-400 font-condensed">Import Type</label>
                <span className="block mt-1">
                  <span className="px-2 py-1 bg-green-900 text-green-200 rounded text-xs font-mono">
                    {selectedNode.type}
                  </span>
                </span>
              </div>
            )}

            {fromNode && (
              <div>
                <label className="text-xs text-gray-400 font-condensed">Source Language</label>
                <span className="block mt-1">
                  <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs font-mono">
                    {fromNode.lang?.toUpperCase()}
                  </span>
                </span>
              </div>
            )}

            {toNode && (
              <div>
                <label className="text-xs text-gray-400 font-condensed">Target Language</label>
                <span className="block mt-1">
                  <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs font-mono">
                    {toNode.lang?.toUpperCase()}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // Node details
  const outgoing = graph?.edges?.filter(e => e.from === selectedNode.id) || [];
  const incoming = graph?.edges?.filter(e => e.to === selectedNode.id) || [];

  return (
    <>
      <aside
        style={{ width: `${width}px` }}
        className="h-full bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden relative"
      >
        {/* Resize handle */}
        <div
          ref={resizeRef}
          onMouseDown={() => setIsResizing(true)}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
          title="Drag to resize"
        />

        {/* Top section - Details (auto-sized) */}
        <div className="flex-shrink-0 p-4 overflow-y-auto max-h-[50vh]">
          <h2 className="text-sm font-heading font-bold text-gray-300 mb-4">DETAILS</h2>

        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-gray-400 font-condensed">Path</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 bg-gray-800 p-2 rounded text-xs break-all font-mono">
                {selectedNode.id}
              </code>
              <button
                onClick={() => {
                  const fullPath = currentRepo ? `${currentRepo}/${selectedNode.id}` : selectedNode.id;
                  window.location.href = `vscode://file/${fullPath}`;
                  console.log(`🚀 Opening in VS Code: ${fullPath}`);
                }}
                className="px-2 py-1.5 bg-blue-800 hover:bg-blue-700 rounded text-xs transition flex-shrink-0"
                title="Open file in VS Code"
              >
                📝 VS Code
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400">Language</label>
            <span className="block mt-1">
              <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs">
                {selectedNode.lang?.toUpperCase()}
              </span>
            </span>
          </div>

          <div>
            <label className="text-xs text-gray-400">Environment</label>
            <span className="block mt-1">
              <span className="px-2 py-1 bg-purple-900 text-purple-200 rounded text-xs">
                {selectedNode.env}
              </span>
            </span>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="text-xs text-gray-400">Imports</label>
              <span className="block mt-1 text-lg font-bold">{outgoing.length}</span>
            </div>
            <div>
              <label className="text-xs text-gray-400">Imported by</label>
              <span className="block mt-1 text-lg font-bold">{incoming.length}</span>
            </div>
          </div>

          {selectedNode.changed && (
            <div className="p-2 bg-red-900 text-red-200 rounded text-xs">
              ⚠️ This file has changed
            </div>
          )}

          {/* Dependency Navigation Buttons */}
          <div className="pt-3 border-t border-gray-800">
            <label className="text-xs text-gray-400 font-condensed mb-2 block">NAVIGATE DEPENDENCIES</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate && onNavigate('upstream')}
                className="px-2 py-1.5 bg-blue-800 hover:bg-blue-700 rounded text-xs transition flex items-center justify-center gap-1"
                title="Show all nodes that depend on this file (incoming edges)"
              >
                ⬆️ Upstream
              </button>
              <button
                onClick={() => onNavigate && onNavigate('downstream')}
                className="px-2 py-1.5 bg-green-800 hover:bg-green-700 rounded text-xs transition flex items-center justify-center gap-1"
                title="Show all nodes this file depends on (outgoing edges)"
              >
                ⬇️ Downstream
              </button>
              <button
                onClick={() => onNavigate && onNavigate('parents')}
                className="px-2 py-1.5 bg-purple-800 hover:bg-purple-700 rounded text-xs transition flex items-center justify-center gap-1"
                title="Show direct parents (1 level up)"
              >
                ↑ Parents
              </button>
              <button
                onClick={() => onNavigate && onNavigate('children')}
                className="px-2 py-1.5 bg-indigo-800 hover:bg-indigo-700 rounded text-xs transition flex items-center justify-center gap-1"
                title="Show direct children (1 level down)"
              >
                ↓ Children
              </button>
              <button
                onClick={() => onNavigate && onNavigate('focus')}
                className="px-2 py-1.5 bg-yellow-800 hover:bg-yellow-700 rounded text-xs transition flex items-center justify-center gap-1 col-span-2"
                title="Focus mode: Show this node and all reachable nodes"
              >
                🎯 Focus Mode
              </button>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('reset')}
              className="w-full mt-2 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs transition"
              title="Reset to full graph view"
            >
              🔄 Reset View
            </button>
          </div>
        </div>

        {outgoing.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-heading font-bold text-gray-300 mb-2">OUTGOING ({outgoing.length})</h3>
            <ul className="space-y-1 text-xs font-mono">
              {outgoing.slice(0, 5).map(e => (
                <li key={e.to} className="text-gray-400 truncate">
                  → {e.to.split('/').pop()}
                </li>
              ))}
              {outgoing.length > 5 && (
                <li className="text-gray-500">... and {outgoing.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {incoming.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-heading font-bold text-gray-300 mb-2">INCOMING ({incoming.length})</h3>
            <ul className="space-y-1 text-xs font-mono">
              {incoming.slice(0, 5).map(e => (
                <li key={e.from} className="text-gray-400 truncate">
                  ← {e.from.split('/').pop()}
                </li>
              ))}
              {incoming.length > 5 && (
                <li className="text-gray-500">... and {incoming.length - 5} more</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom section - File Preview (fills remaining space) */}
      <div className="flex-1 border-t border-gray-800 flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between p-2 border-b border-gray-800">
          <h3 className="text-xs font-heading font-bold text-gray-300">FILE PREVIEW</h3>
          <button
            onClick={() => setShowModal(true)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition flex items-center gap-1"
            title="Expand preview"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
        </div>
        <FilePreview filePath={selectedNode.id} currentRepo={currentRepo} />
      </div>
    </aside>

    {/* Modal for expanded file preview */}
    {showModal && (
      <div
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8"
        onClick={() => setShowModal(false)}
      >
        <div
          className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div>
              <h2 className="text-lg font-heading font-bold text-gray-300">File Preview</h2>
              <p className="text-xs text-gray-500 font-mono mt-1">{selectedNode.id}</p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
              title="Close"
            >
              ✕ Close
            </button>
          </div>

          {/* Modal content */}
          <div className="flex-1 overflow-hidden">
            <FilePreview filePath={selectedNode.id} currentRepo={currentRepo} maxLines={10000} />
          </div>
        </div>
      </div>
    )}
  </>
  );
}


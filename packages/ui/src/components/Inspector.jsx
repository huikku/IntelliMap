export default function Inspector({ selectedNode, graph }) {
  if (!selectedNode) {
    return (
      <aside className="w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
        <h2 className="text-sm font-bold text-gray-300 mb-4">DETAILS</h2>
        <p className="text-xs text-gray-500">Select a node to view details</p>
      </aside>
    );
  }

  // Find incoming and outgoing edges
  const outgoing = graph?.edges?.filter(e => e.from === selectedNode.id) || [];
  const incoming = graph?.edges?.filter(e => e.to === selectedNode.id) || [];

  return (
    <aside className="w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
      <h2 className="text-sm font-bold text-gray-300 mb-4">DETAILS</h2>

      <div className="space-y-3 text-sm">
        <div>
          <label className="text-xs text-gray-400">Path</label>
          <code className="block bg-gray-800 p-2 rounded text-xs mt-1 break-all">
            {selectedNode.id}
          </code>
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
      </div>

      {outgoing.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-gray-300 mb-2">OUTGOING ({outgoing.length})</h3>
          <ul className="space-y-1 text-xs">
            {outgoing.slice(0, 10).map(e => (
              <li key={e.to} className="text-gray-400 truncate">
                → {e.to.split('/').pop()}
              </li>
            ))}
            {outgoing.length > 10 && (
              <li className="text-gray-500">... and {outgoing.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-gray-300 mb-2">INCOMING ({incoming.length})</h3>
          <ul className="space-y-1 text-xs">
            {incoming.slice(0, 10).map(e => (
              <li key={e.from} className="text-gray-400 truncate">
                ← {e.from.split('/').pop()}
              </li>
            ))}
            {incoming.length > 10 && (
              <li className="text-gray-500">... and {incoming.length - 10} more</li>
            )}
          </ul>
        </div>
      )}
    </aside>
  );
}


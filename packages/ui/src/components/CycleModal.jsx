export default function CycleModal({ cycleCount, nodeCount, onClose }) {
  if (cycleCount === null) return null;

  const hasCycles = cycleCount > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-lg shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${hasCycles ? 'border-red-800 bg-red-950' : 'border-green-800 bg-green-950'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {hasCycles ? '🔴' : '✅'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {hasCycles ? 'Circular Dependencies Found' : 'No Cycles Detected'}
                </h2>
                <p className="text-sm text-gray-300 mt-1">
                  {hasCycles 
                    ? 'Your codebase has circular import dependencies'
                    : 'Your dependency graph is acyclic'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {hasCycles ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-red-400">{cycleCount}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      {cycleCount === 1 ? 'Cycle' : 'Cycles'}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{nodeCount}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      {nodeCount === 1 ? 'File' : 'Files'} Involved
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="text-sm text-gray-300 space-y-2">
                <p>
                  <strong className="text-white">What are circular dependencies?</strong>
                </p>
                <p className="text-gray-400">
                  Files that import each other in a loop (A → B → C → A). This can cause:
                </p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-2">
                  <li>Initialization order issues</li>
                  <li>Runtime errors or undefined values</li>
                  <li>Harder to understand and maintain code</li>
                  <li>Bundler warnings or failures</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="bg-blue-950 border border-blue-800 rounded-lg p-3">
                <div className="text-xs text-blue-200">
                  <strong>💡 Next Steps:</strong>
                  <ul className="mt-2 space-y-1 ml-4 list-disc">
                    <li>Cycles are highlighted in <span className="text-red-400 font-semibold">red</span> on the graph</li>
                    <li>Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono">f</kbd> to re-focus on cycles</li>
                    <li>Consider extracting shared code to break cycles</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success message */}
              <div className="bg-green-950 border border-green-800 rounded-lg p-4">
                <p className="text-green-200 text-sm">
                  🎉 <strong>Great news!</strong> Your codebase has no circular dependencies. 
                  This means your imports form a clean, directed acyclic graph (DAG).
                </p>
              </div>

              {/* Benefits */}
              <div className="text-sm text-gray-300 space-y-2">
                <p>
                  <strong className="text-white">Benefits of an acyclic graph:</strong>
                </p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-2">
                  <li>Clear initialization order</li>
                  <li>Easier to understand dependencies</li>
                  <li>Better tree-shaking and bundling</li>
                  <li>Simpler testing and mocking</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded font-semibold transition ${
              hasCycles
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-green-700 hover:bg-green-600 text-white'
            }`}
          >
            {hasCycles ? 'View Cycles' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}


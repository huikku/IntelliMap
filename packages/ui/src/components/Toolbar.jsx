export default function Toolbar() {
  return (
    <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center gap-2 px-4">
      <button
        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
        title="Fit to view"
      >
        Fit
      </button>
      <button
        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
        title="Center view"
      >
        Center
      </button>

      <div className="ml-2">
        <label className="text-xs text-gray-400 mr-2">Layout:</label>
        <select className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm">
          <option value="elk">ELK (Hierarchical)</option>
          <option value="fcose">fcose (Force-directed)</option>
        </select>
      </div>

      <div className="ml-auto text-xs text-gray-500">
        Ready
      </div>
    </div>
  );
}


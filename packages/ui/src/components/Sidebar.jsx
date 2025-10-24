export default function Sidebar({ filters, setFilters, graph }) {
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <aside className="w-64 h-full bg-gray-900 border-r border-gray-800 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-4">FILTERS</h2>

        {/* Show Changed Only */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showChanged}
            onChange={e => handleFilterChange('showChanged', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Show changed only</span>
        </label>

        {/* Collapse by Folder */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.collapseByFolder}
            onChange={e => handleFilterChange('collapseByFolder', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Collapse by folder</span>
        </label>

        {/* Language Filter */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 block mb-2">Language</label>
          <select
            value={filters.language}
            onChange={e => handleFilterChange('language', e.target.value)}
            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
          >
            <option value="all">All</option>
            <option value="js">JavaScript</option>
            <option value="ts">TypeScript</option>
            <option value="py">Python</option>
          </select>
        </div>

        {/* Environment Filter */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 block mb-2">Environment</label>
          <select
            value={filters.env}
            onChange={e => handleFilterChange('env', e.target.value)}
            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
          >
            <option value="all">All</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
          </select>
        </div>

        {/* Stats */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <h3 className="text-xs text-gray-400 mb-2">STATS</h3>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Nodes: {graph?.nodes?.length || 0}</p>
            <p>Edges: {graph?.edges?.length || 0}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}


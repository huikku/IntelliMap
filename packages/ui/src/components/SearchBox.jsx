import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';

export default function SearchBox({ graph, onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Create fuzzy search index
  const fuse = useMemo(() => {
    if (!graph || !graph.nodes) return null;

    return new Fuse(graph.nodes, {
      keys: ['id', 'name', 'folder'],
      threshold: 0.3, // Lower = more strict matching
      includeScore: true,
      includeMatches: true,
    });
  }, [graph]);

  useEffect(() => {
    if (!fuse || !searchTerm.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    const fuzzyResults = fuse.search(searchTerm);
    const matches = fuzzyResults.map(result => result.item);

    setResults(matches.slice(0, 10)); // Limit to 10 results
    setSelectedIndex(-1);
  }, [searchTerm, fuse]);

  const handleSelectResult = (node) => {
    // Call onSearch callback to select the node
    onSearch?.(node);

    // Clear search
    setSearchTerm('');
    setResults([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < results.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
      setResults([]);
    }
  };

  return (
    <div className="relative w-64">
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Search files..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 bg-slate border border-teal/30 rounded text-sm text-cream placeholder-mint/60 focus:outline-none focus:border-teal"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setResults([]);
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#6a6a6a] hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((node, index) => (
            <button
              key={node.id}
              onClick={() => handleSelectResult(node)}
              className={`w-full text-left px-3 py-2 text-sm transition ${
                index === selectedIndex
                  ? 'bg-blue-600 text-white'
                  : 'text-[#a0a0a0] hover:bg-[#1a1a1a]'
              }`}
            >
              <div className="truncate font-mono text-xs">{node.id}</div>
              <div className="text-xs text-[#6a6a6a]">
                {node.lang} • {node.env}
              </div>
            </button>
          ))}
        </div>
      )}

      {searchTerm && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-[#6a6a6a]">
          No results found
        </div>
      )}
    </div>
  );
}


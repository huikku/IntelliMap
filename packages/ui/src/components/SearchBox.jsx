import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';

export default function SearchBox({ graph, cyRef, onSearch }) {
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
    if (!cyRef.current) return;

    const cy = cyRef.current;
    const nodeElement = cy.getElementById(node.id);

    if (nodeElement.length > 0) {
      // Select the node
      cy.elements().unselect();
      nodeElement.select();

      // Highlight the node with a temporary glow effect
      nodeElement.addClass('search-highlight');
      setTimeout(() => {
        nodeElement.removeClass('search-highlight');
      }, 2000);

      // Animate to node position with smooth zoom
      const pos = nodeElement.position();
      const w = cy.width();
      const h = cy.height();
      const targetZoom = 2.5;
      const pan = {
        x: w / 2 - pos.x * targetZoom,
        y: h / 2 - pos.y * targetZoom,
      };

      cy.animate({
        pan: pan,
        zoom: targetZoom,
      }, {
        duration: 600,
        easing: 'ease-in-out-cubic',
      });

      onSearch?.(node);
    }

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
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setResults([]);
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((node, index) => (
            <button
              key={node.id}
              onClick={() => handleSelectResult(node)}
              className={`w-full text-left px-3 py-2 text-sm transition ${
                index === selectedIndex
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="truncate font-mono text-xs">{node.id}</div>
              <div className="text-xs text-gray-400">
                {node.lang} • {node.env}
              </div>
            </button>
          ))}
        </div>
      )}

      {searchTerm && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-400">
          No results found
        </div>
      )}
    </div>
  );
}


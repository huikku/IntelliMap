import { useState, useEffect } from 'react';

export default function SearchBox({ graph, cyRef, onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!graph || !searchTerm.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    const term = searchTerm.toLowerCase();
    const matches = graph.nodes.filter(node =>
      node.id.toLowerCase().includes(term)
    );

    setResults(matches);
    setSelectedIndex(-1);
  }, [searchTerm, graph]);

  const handleSelectResult = (node) => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    const nodeElement = cy.getElementById(node.id);

    if (nodeElement.length > 0) {
      // Select the node
      cy.elements().unselect();
      nodeElement.select();

      // Animate to node position
      const pos = nodeElement.position();
      cy.animate({
        center: pos,
        zoom: 2,
      }, {
        duration: 500,
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


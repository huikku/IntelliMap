import { useState, useEffect, useRef } from 'react';

export default function GraphHUD({ cyRef, graph }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nodeCount, setNodeCount] = useState(0);
  const updateIntervalRef = useRef(null);

  useEffect(() => {
    if (!cyRef?.current) return;

    const cy = cyRef.current;

    // Update zoom and pan on any change
    const updateHUD = () => {
      setZoom(cy.zoom());
      setPan(cy.pan());
    };

    // Listen to zoom and pan events
    cy.on('zoom pan', updateHUD);

    // Also poll for updates in case events don't fire
    updateIntervalRef.current = setInterval(updateHUD, 100);

    // Initial update
    updateHUD();

    return () => {
      cy.off('zoom pan', updateHUD);
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [cyRef?.current]);

  useEffect(() => {
    if (graph?.nodes) {
      setNodeCount(graph.nodes.length);
    }
  }, [graph]);

  return (
    <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-80 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 font-mono space-y-1 pointer-events-none">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">🔍</span>
        <span>Zoom: <span className="text-orange-400 font-bold">{zoom.toFixed(2)}x</span></span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">📍</span>
        <span>Pan: <span className="text-blue-400 font-bold">{pan.x.toFixed(0)}, {pan.y.toFixed(0)}</span></span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">📊</span>
        <span>Nodes: <span className="text-green-400 font-bold">{nodeCount}</span></span>
      </div>
      <div className="text-gray-500 text-xs mt-2 pt-1 border-t border-gray-700">
        Press <span className="text-yellow-400">F</span> to focus
      </div>
    </div>
  );
}


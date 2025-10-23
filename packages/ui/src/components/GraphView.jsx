import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';

cytoscape.use(elk);

export default function GraphView({ graph, plane, filters, selectedNode, setSelectedNode }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!graph || !containerRef.current) return;

    // Filter nodes based on plane and filters
    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;

    if (plane === 'backend') {
      filteredNodes = graph.nodes.filter(n => n.env === 'backend');
    } else if (plane === 'diff') {
      filteredNodes = graph.nodes.filter(n => n.changed);
    }

    if (filters.language !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.lang === filters.language);
    }

    if (filters.env !== 'all') {
      filteredNodes = filteredNodes.filter(n => n.env === filters.env);
    }

    if (filters.showChanged) {
      filteredNodes = filteredNodes.filter(n => n.changed);
    }

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

    // Build Cytoscape elements
    const elements = [
      ...filteredNodes.map(n => ({
        data: {
          id: n.id,
          label: n.id.split('/').pop(),
          lang: n.lang,
          env: n.env,
          changed: n.changed,
        },
      })),
      ...filteredEdges.map(e => ({
        data: {
          id: `${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
        },
      })),
    ];

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': node => {
              const lang = node.data('lang');
              const env = node.data('env');
              if (lang === 'py') return '#3b82f6';
              if (env === 'backend') return '#8b5cf6';
              return '#10b981';
            },
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 10,
            'color': '#fff',
            'border-width': node => (node.data('changed') ? 2 : 0),
            'border-color': '#ef4444',
            'width': 30,
            'height': 30,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#666',
            'target-arrow-color': '#666',
            'target-arrow-shape': 'triangle',
            'width': 1,
          },
        },
      ],
      layout: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'RIGHT',
        },
      },
    });

    cy.on('tap', 'node', e => {
      setSelectedNode(e.target.data());
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graph, plane, filters, setSelectedNode]);

  return <div ref={containerRef} className="w-full h-full bg-dark-900" />;
}


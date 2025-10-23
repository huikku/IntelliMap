import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';

cytoscape.use(elk);

export default function GraphView({ graph, plane, filters, selectedNode, setSelectedNode, cyRef }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!graph || !containerRef.current) {
      console.log('GraphView: Skipping render - graph:', !!graph, 'container:', !!containerRef.current);
      return;
    }

    console.log('🎨 GraphView rendering with', graph.nodes?.length || 0, 'nodes');

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
              if (lang === 'py') return '#3b82f6';
              if (lang === 'ts') return '#ef5350';
              return '#10b981';
            },
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 11,
            'color': '#fff',
            'border-width': node => (node.data('changed') ? 3 : 1),
            'border-color': node => (node.data('changed') ? '#ef4444' : '#444'),
            'width': 40,
            'height': 40,
            'padding': 5,
            'text-wrap': 'wrap',
            'text-max-width': 35,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#fbbf24',
            'box-shadow': '0 0 10px rgba(251, 191, 36, 0.5)',
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#555',
            'target-arrow-color': '#555',
            'target-arrow-shape': 'triangle',
            'width': 1.5,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24',
            'width': 2.5,
          },
        },
      ],
      layout: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': 50,
          'elk.layered.spacing.edgeEdgeBetweenLayers': 20,
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


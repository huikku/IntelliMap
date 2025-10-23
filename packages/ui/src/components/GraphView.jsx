import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';

cytoscape.use(elk);

// Helper to classify node type based on filename
function getNodeType(filename) {
  if (filename.includes('component') || filename.includes('Component')) return 'component';
  if (filename.includes('hook') || filename.includes('Hook')) return 'hook';
  if (filename.includes('util') || filename.includes('helper') || filename.includes('Util')) return 'util';
  if (filename.includes('config') || filename.includes('Config')) return 'config';
  if (filename.includes('test') || filename.includes('spec')) return 'test';
  if (filename.includes('type') || filename.includes('interface')) return 'type';
  if (filename.includes('index')) return 'index';
  if (filename.includes('api') || filename.includes('service')) return 'service';
  return 'module';
}

// Helper to get shape based on node type
function getNodeShape(nodeType) {
  const shapes = {
    component: 'ellipse',
    hook: 'diamond',
    util: 'rectangle',
    config: 'square',
    test: 'triangle',
    type: 'pentagon',
    index: 'star',
    service: 'hexagon',
    module: 'circle',
  };
  return shapes[nodeType] || 'circle';
}

// Helper to get color based on language and type
function getNodeColor(lang, nodeType, changed) {
  if (changed) return '#dc2626'; // Red for changed

  const colorMap = {
    ts: { component: '#3b82f6', hook: '#06b6d4', util: '#0ea5e9', config: '#1e40af', service: '#1e3a8a', default: '#2563eb' },
    js: { component: '#f59e0b', hook: '#fbbf24', util: '#fcd34d', config: '#d97706', service: '#b45309', default: '#f97316' },
    py: { component: '#10b981', hook: '#14b8a6', util: '#06d6a0', config: '#059669', service: '#047857', default: '#34d399' },
  };

  const langColors = colorMap[lang] || colorMap.ts;
  return langColors[nodeType] || langColors.default;
}

export default function GraphView({ graph, plane, filters, selectedNode, setSelectedNode, cyRef, clustering = false }) {
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

    // Build Cytoscape elements with enhanced metadata
    let elements = [
      ...filteredNodes.map(n => {
        const filename = n.id.split('/').pop();
        const nodeType = getNodeType(filename);
        return {
          data: {
            id: n.id,
            label: filename,
            lang: n.lang,
            env: n.env,
            changed: n.changed,
            nodeType,
            folder: n.folder,
            pkg: n.pkg,
            parent: clustering ? n.folder : undefined,
          },
        };
      }),
      ...filteredEdges.map(e => ({
        data: {
          id: `${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
        },
      })),
    ];

    // Add cluster nodes if clustering is enabled
    if (clustering) {
      const folders = new Set(filteredNodes.map(n => n.folder));
      const clusterElements = Array.from(folders).map(folder => ({
        data: {
          id: folder,
          label: folder,
          isCluster: true,
        },
      }));
      elements = [...clusterElements, ...elements];
    }

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': node => {
              if (node.data('isCluster')) return '#1f2937';
              return getNodeColor(node.data('lang'), node.data('nodeType'), node.data('changed'));
            },
            'shape': node => {
              if (node.data('isCluster')) return 'rectangle';
              return getNodeShape(node.data('nodeType'));
            },
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': node => (node.data('isCluster') ? 12 : 10),
            'font-weight': node => (node.data('isCluster') ? 'bold' : 'normal'),
            'color': '#fff',
            'border-width': node => {
              if (node.data('isCluster')) return 2;
              return node.data('changed') ? 3 : 1;
            },
            'border-color': node => {
              if (node.data('isCluster')) return '#4b5563';
              return node.data('changed') ? '#fca5a5' : '#333';
            },
            'border-style': node => (node.data('isCluster') ? 'dashed' : 'solid'),
            'width': node => (node.data('isCluster') ? 'label' : 45),
            'height': node => (node.data('isCluster') ? 'label' : 45),
            'padding': node => (node.data('isCluster') ? 15 : 5),
            'text-wrap': 'wrap',
            'text-max-width': 40,
            'text-background-color': '#000',
            'text-background-opacity': 0.7,
            'text-background-padding': 2,
            'compound-sizing-wrt-labels': 'include',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#fbbf24',
            'shadow-blur': 15,
            'shadow-color': '#fbbf24',
            'shadow-opacity': 0.8,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#444',
            'target-arrow-color': '#444',
            'target-arrow-shape': 'triangle',
            'width': 1.5,
            'curve-style': 'bezier',
            'opacity': 0.6,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24',
            'width': 2.5,
            'opacity': 1,
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
  }, [graph, plane, filters, setSelectedNode, clustering]);

  return <div ref={containerRef} className="w-full h-full bg-dark-900" />;
}


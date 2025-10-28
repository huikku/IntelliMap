import { lazy, Suspense } from 'react';
import GraphHUD from './GraphHUD';
import { ReactFlowGraph } from './ReactFlowGraph';

// Lazy load CytoscapeGraph to avoid loading Cytoscape when using React Flow
const CytoscapeGraph = lazy(() => import('./CytoscapeGraph').then(module => ({ default: module.CytoscapeGraph })));

/**
 * GraphView - Main graph visualization router component
 * Routes to either Cytoscape or React Flow renderer based on `renderer` prop
 */
export default function GraphView({
  graph,
  plane,
  filters,
  selectedNode,
  setSelectedNode,
  cyRef,
  clustering = false,
  setCyInstance,
  edgeOpacity = 1.0,
  curveStyle = 'bezier-tight',
  navigationMode = null,
  renderer = 'cytoscape',
  layout = 'elk',
  reactFlowInstanceRef = null, // Ref for React Flow instance
}) {
  // Early return for no graph data
  if (!graph) {
    return <div className="w-full h-full flex items-center justify-center text-gray-500">No graph data</div>;
  }

  // Filter nodes based on plane and filters
  let filteredNodes = graph.nodes || [];
  let filteredEdges = graph.edges || [];

  // Filter by plane (static/backend/diff)
  if (plane === 'backend') {
    filteredNodes = filteredNodes.filter(n => n.env === 'backend');
  } else if (plane === 'diff') {
    filteredNodes = filteredNodes.filter(n => n.changed);
  }

  // Apply additional filters
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

  // Route to React Flow renderer
  if (renderer === 'react-flow') {
    // Map layout options to React Flow algorithm and direction
    let layoutAlgorithm = 'elk';
    let layoutDirection = 'RIGHT';

    switch (layout) {
      case 'dagre':
        layoutAlgorithm = 'dagre';
        layoutDirection = 'LR';
        break;
      case 'dagreDown':
        layoutAlgorithm = 'dagre';
        layoutDirection = 'TB';
        break;
      case 'elk':
      case 'elkRight':
        layoutAlgorithm = 'elk';
        layoutDirection = 'RIGHT';
        break;
      case 'elkDown':
        layoutAlgorithm = 'elk';
        layoutDirection = 'DOWN';
        break;
      case 'elkTree':
        layoutAlgorithm = 'elk';
        layoutDirection = 'DOWN';
        break;
      case 'fcose':
      case 'euler':
      case 'cola':
      case 'grid':
        // These don't have direct equivalents in React Flow
        // Fall back to ELK
        layoutAlgorithm = 'elk';
        layoutDirection = 'RIGHT';
        console.log(`⚠️ Layout "${layout}" not supported in React Flow, using ELK`);
        break;
      default:
        layoutAlgorithm = 'elk';
        layoutDirection = 'RIGHT';
    }

    const filteredGraphData = {
      nodes: filteredNodes,
      edges: filteredEdges,
    };

    return (
      <div className="relative w-full h-full">
        <ReactFlowGraph
          graphData={filteredGraphData}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
          layoutAlgorithm={layoutAlgorithm}
          layoutDirection={layoutDirection}
          edgeOpacity={edgeOpacity}
          curveStyle={curveStyle}
          reactFlowInstanceRef={reactFlowInstanceRef}
        />
      </div>
    );
  }

  // Route to Cytoscape renderer (default)
  // Use Suspense to lazy load CytoscapeGraph only when needed
  return (
    <div className="relative w-full h-full">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center text-gray-500">
          Loading graph renderer...
        </div>
      }>
        <CytoscapeGraph
          filteredNodes={filteredNodes}
          filteredEdges={filteredEdges}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          cyRef={cyRef}
          clustering={clustering}
          setCyInstance={setCyInstance}
          edgeOpacity={edgeOpacity}
          curveStyle={curveStyle}
          navigationMode={navigationMode}
          layout={layout}
        />
      </Suspense>
      <GraphHUD cyRef={cyRef} graph={graph} />
    </div>
  );
}

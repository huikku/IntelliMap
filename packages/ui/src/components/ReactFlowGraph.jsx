import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CodeNode from './nodes/CodeNode';
import { convertToReactFlow, enrichNodesWithTimeseries } from '../utils/reactFlowAdapter';
import { layoutGraph, getPortDirection } from '../utils/layoutService';

import './ReactFlowGraph.css';

// Register custom node types
const nodeTypes = {
  codeNode: CodeNode,
};

/**
 * ReactFlowGraph - Main graph visualization component using React Flow
 */
export function ReactFlowGraph({
  graphData,
  selectedNode,
  onNodeSelect,
  layoutAlgorithm = 'elk',
  layoutDirection = 'RIGHT',
}) {
  const [isLayouting, setIsLayouting] = useState(true);

  // Convert IntelliMap data to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graphData || !graphData.nodes) {
      return { initialNodes: [], initialEdges: [] };
    }

    const { nodes, edges } = convertToReactFlow(graphData);
    const enrichedNodes = enrichNodesWithTimeseries(nodes);

    return { initialNodes: enrichedNodes, initialEdges: edges };
  }, [graphData]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Apply layout when data changes
  useEffect(() => {
    async function applyLayout() {
      if (initialNodes.length === 0) {
        setIsLayouting(false);
        return;
      }

      setIsLayouting(true);

      try {
        const layoutedNodes = await layoutGraph(
          initialNodes,
          initialEdges,
          layoutAlgorithm,
          layoutDirection
        );

        setNodes(layoutedNodes);
        setEdges(initialEdges);
      } catch (error) {
        console.error('Layout failed:', error);
        setNodes(initialNodes);
        setEdges(initialEdges);
      } finally {
        setIsLayouting(false);
      }
    }

    applyLayout();
  }, [initialNodes, initialEdges, layoutAlgorithm, layoutDirection, setNodes, setEdges]);

  // Handle node click
  const onNodeClick = useCallback(
    (event, node) => {
      if (onNodeSelect) {
        onNodeSelect(node.data._original || node.data);
      }
    },
    [onNodeSelect]
  );

  // Handle edge connection (if needed for future features)
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Get minimap node color
  const getMinimapNodeColor = useCallback((node) => {
    if (node.selected) return '#667eea';
    if (node.data?.changed) return '#f5576c';
    if (node.data?.metrics?.complexity > 75) return '#f093fb';
    return '#444';
  }, []);

  // Detect port direction for edge styling
  const portDirection = useMemo(
    () => getPortDirection(layoutAlgorithm, layoutDirection),
    [layoutAlgorithm, layoutDirection]
  );

  return (
    <div className="react-flow-wrapper">
      {isLayouting && (
        <div className="react-flow-loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Calculating layout...</div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={3}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
        // Performance optimizations
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        // Only render visible elements for performance
        onlyRenderVisibleElements={true}
      >
        {/* Graph background pattern */}
        <Background
          color="#333"
          gap={16}
          size={1}
          variant="dots"
        />

        {/* Zoom/pan controls */}
        <Controls
          showInteractive={false}
          style={{
            background: 'rgba(30, 30, 30, 0.9)',
            border: '1px solid #444',
            borderRadius: '8px',
          }}
        />

        {/* Minimap */}
        <MiniMap
          nodeColor={getMinimapNodeColor}
          nodeStrokeWidth={3}
          nodeBorderRadius={4}
          maskColor="rgba(0, 0, 0, 0.7)"
          style={{
            background: 'rgba(30, 30, 30, 0.9)',
            border: '1px solid #444',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  );
}

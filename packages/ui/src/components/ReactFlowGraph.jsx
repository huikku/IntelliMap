import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
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
 * Inner component that has access to useReactFlow hook
 */
function ReactFlowInner({
  graphData,
  selectedNode,
  onNodeSelect,
  layoutAlgorithm,
  layoutDirection,
  edgeOpacity,
  curveStyle,
  reactFlowInstanceRef,
  currentRepo,
  highlightedPaths = [],
}) {
  const reactFlowInstance = useReactFlow(); // Get React Flow instance
  const [isLayouting, setIsLayouting] = useState(true);
  const [hasLayouted, setHasLayouted] = useState(false);
  const lastLayoutRef = useRef({ algorithm: layoutAlgorithm, direction: layoutDirection });

  // Expose React Flow instance to parent via ref
  useEffect(() => {
    if (reactFlowInstanceRef) {
      reactFlowInstanceRef.current = reactFlowInstance;
    }
  }, [reactFlowInstance, reactFlowInstanceRef]);

  // Convert IntelliMap data to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graphData || !graphData.nodes) {
      return { initialNodes: [], initialEdges: [] };
    }

    const { nodes, edges } = convertToReactFlow(graphData);
    const enrichedNodes = enrichNodesWithTimeseries(nodes);

    // Add currentRepo to all nodes
    const nodesWithRepo = enrichedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        _original: {
          ...node.data._original,
          repoPath: currentRepo,
        },
      },
    }));

    return { initialNodes: nodesWithRepo, initialEdges: edges };
  }, [graphData, currentRepo]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Check if layout algorithm or direction changed
  const layoutChanged = useMemo(() => {
    return lastLayoutRef.current.algorithm !== layoutAlgorithm ||
           lastLayoutRef.current.direction !== layoutDirection;
  }, [layoutAlgorithm, layoutDirection]);

  // Apply layout only when data changes or layout settings change
  useEffect(() => {
    async function applyLayout() {
      // Only re-layout if:
      // 1. Never layouted before, OR
      // 2. Layout algorithm/direction changed, OR
      // 3. Graph data changed (initialNodes changed)
      if (!hasLayouted || layoutChanged) {
        if (initialNodes.length === 0) {
          setIsLayouting(false);
          return;
        }

        setIsLayouting(true);
        console.log('🎨 Applying layout:', layoutAlgorithm, layoutDirection);

        try {
          const layoutedNodes = await layoutGraph(
            initialNodes,
            initialEdges,
            layoutAlgorithm,
            layoutDirection
          );

          // Apply edge styling with proper type mapping
          const getCurveType = (style) => {
            // Map Cytoscape curve styles to React Flow edge types
            const typeMap = {
              'straight': 'straight',
              'bezier': 'default',
              'bezier-tight': 'default',
              'smoothstep': 'smoothstep',
              'step': 'step',
            };
            return typeMap[style] || 'smoothstep';
          };

          const styledEdges = initialEdges.map(edge => ({
            ...edge,
            type: getCurveType(curveStyle),
            style: {
              ...edge.style,
              opacity: edgeOpacity,
              strokeWidth: edge.style?.strokeWidth || 2,
            },
          }));

          // Add layout direction to node data so CodeNode can position handles correctly
          const nodesWithLayoutInfo = layoutedNodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              layoutDirection,
            },
          }));

          setNodes(nodesWithLayoutInfo);
          setEdges(styledEdges);
          setHasLayouted(true);
          lastLayoutRef.current = { algorithm: layoutAlgorithm, direction: layoutDirection };
        } catch (error) {
          console.error('Layout failed:', error);
          setNodes(initialNodes);
          setEdges(initialEdges);
        } finally {
          setIsLayouting(false);
        }
      }
    }

    applyLayout();
  }, [initialNodes, initialEdges, layoutAlgorithm, layoutDirection, hasLayouted, layoutChanged, edgeOpacity, curveStyle, setNodes, setEdges]);

  // Update edge styles independently without triggering layout
  useEffect(() => {
    if (hasLayouted && !layoutChanged) {
      const getCurveType = (style) => {
        const typeMap = {
          'straight': 'straight',
          'bezier': 'default',
          'bezier-tight': 'default',
          'smoothstep': 'smoothstep',
          'step': 'step',
        };
        return typeMap[style] || 'smoothstep';
      };

      setEdges(edges => edges.map(edge => ({
        ...edge,
        type: getCurveType(curveStyle),
        style: {
          ...edge.style,
          opacity: edgeOpacity,
          strokeWidth: edge.style?.strokeWidth || 2,
        },
      })));
    }
  }, [edgeOpacity, curveStyle, hasLayouted, layoutChanged, setEdges]);

  // Apply RAG highlighting to nodes
  useEffect(() => {
    if (!hasLayouted || highlightedPaths.length === 0) {
      // Clear all highlights
      setNodes(nodes => nodes.map(node => ({
        ...node,
        className: node.className?.replace('rag-highlighted', '').replace('rag-faded', '').trim() || '',
        style: {
          ...node.style,
          opacity: 1,
        },
      })));
      return;
    }

    // Normalize paths for comparison (remove leading ./)
    const normalizedHighlights = highlightedPaths.map(p => p.replace(/^\.\//, ''));

    setNodes(nodes => nodes.map(node => {
      const nodePath = node.data?._original?.id || node.id;
      const normalizedNodePath = nodePath.replace(/^\.\//, '');

      const isHighlighted = normalizedHighlights.some(hp =>
        normalizedNodePath === hp || normalizedNodePath.endsWith(hp) || hp.endsWith(normalizedNodePath)
      );

      if (isHighlighted) {
        return {
          ...node,
          className: 'rag-highlighted',
          style: {
            ...node.style,
            opacity: 1,
          },
        };
      } else {
        return {
          ...node,
          className: 'rag-faded',
          style: {
            ...node.style,
            opacity: 0.2,
          },
        };
      }
    }));
  }, [highlightedPaths, hasLayouted, setNodes]);

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

  // Get minimap node color using muted palette
  const getMinimapNodeColor = useCallback((node) => {
    if (node.selected) return '#5F9B8C'; // Teal
    if (node.data?.changed) return '#FF7D2D'; // Orange
    if (node.data?.metrics?.complexity > 75) return '#FF9A4A'; // Peach
    return '#1a2830'; // Darker slate
  }, []);

  // Detect port direction for edge styling
  const portDirection = useMemo(
    () => getPortDirection(layoutAlgorithm, layoutDirection),
    [layoutAlgorithm, layoutDirection]
  );

  return (
    <div id="react-flow-container" className="react-flow-wrapper">
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
        // Zoom and pan controls
        panOnDrag={true}
        panOnScroll={false} // Disable pan on scroll so mouse wheel zooms instead
        zoomOnScroll={true} // Enable zoom on scroll (mouse wheel)
        zoomOnPinch={true} // Enable pinch-to-zoom on trackpad
        zoomOnDoubleClick={false} // Disable double-click zoom (can be annoying)
        selectionOnDrag={false}
      >
        {/* Graph background pattern */}
        <Background
          color="#1a2830"
          gap={16}
          size={1}
          variant="dots"
        />

        {/* Zoom/pan controls */}
        <Controls
          showInteractive={false}
          style={{
            background: 'rgba(15, 28, 36, 0.95)',
            border: '1px solid #1a2830',
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
            background: 'rgba(15, 28, 36, 0.95)',
            border: '1px solid #1a2830',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  );
}

/**
 * ReactFlowGraph - Wrapper component with ReactFlowProvider
 */
export function ReactFlowGraph({
  graphData,
  selectedNode,
  onNodeSelect,
  layoutAlgorithm = 'elk',
  layoutDirection = 'RIGHT',
  edgeOpacity = 1.0,
  curveStyle = 'smoothstep',
  reactFlowInstanceRef = null,
  currentRepo = null,
  highlightedPaths = [],
}) {
  return (
    <ReactFlowProvider>
      <ReactFlowInner
        graphData={graphData}
        selectedNode={selectedNode}
        onNodeSelect={onNodeSelect}
        layoutAlgorithm={layoutAlgorithm}
        layoutDirection={layoutDirection}
        edgeOpacity={edgeOpacity}
        curveStyle={curveStyle}
        reactFlowInstanceRef={reactFlowInstanceRef}
        currentRepo={currentRepo}
        highlightedPaths={highlightedPaths}
      />
    </ReactFlowProvider>
  );
}

# React Flow (xyflow) Migration Plan

## 🎯 Why React Flow Solves Our Problems

### Current Issues with Canvas Approach
1. **Clunky performance** - Style functions re-render 60fps during pan/zoom
2. **Poor scaling** - Title bars disappear when zoomed out, pixelated when zoomed in
3. **Wrong abstraction** - Fighting Cytoscape's canvas rendering with more canvas rendering
4. **Information density** - Same level of detail at all zoom levels

### How React Flow Fixes This

**1. Native React Integration**
```jsx
// Nodes are actual React components, not images
function CodeNode({ data }) {
  return (
    <div className="code-node">
      <div className="title-bar" style={{ background: data.color }}>
        {data.icon} {data.label}
      </div>
      <div className="metrics">
        <Sparkline data={data.churnHistory} />
        <ProgressBar value={data.coverage} />
      </div>
    </div>
  );
}
```
- ✅ **No canvas rendering** - HTML/CSS directly
- ✅ **React's virtual DOM** - Efficient updates
- ✅ **CSS scaling** - Crisp at all zoom levels
- ✅ **Real components** - Can use any React library

**2. Built-in Performance Optimizations**
- **Virtualization** - Only renders visible nodes (not all 500)
- **Free zooming** - Just CSS transform, no re-render
- **React.memo** - Nodes only update when their data changes
- **Concurrent rendering** - React 18 automatic batching

**3. Level of Detail (LOD) is Natural**
```jsx
function CodeNode({ data }) {
  const zoom = useStore(state => state.transform[2]); // Current zoom

  return (
    <div className="code-node">
      <div className="title-bar">
        {data.icon} {data.label}
      </div>

      {zoom > 0.5 && (
        <div className="metrics">
          <Sparkline data={data.churnHistory} />
        </div>
      )}

      {zoom > 1.0 && (
        <div className="details">
          <div>LOC: {data.loc}</div>
          <div>Complexity: {data.complexity}</div>
        </div>
      )}
    </div>
  );
}
```
- ✅ **React conditionals** - Show/hide based on zoom
- ✅ **Always crisp** - SVG/HTML scales perfectly
- ✅ **Smooth** - React handles efficient updates

---

## 📊 React Flow vs Current Approach

| Aspect | Current (Cytoscape + Canvas) | React Flow (xyflow) |
|--------|------------------------------|---------------------|
| **Rendering** | Canvas images as backgrounds | Native HTML/SVG nodes |
| **Performance** | 60fps style function calls | Virtualized, only visible nodes |
| **Zoom quality** | Pixelated/blurry at extremes | Crisp at all zoom levels |
| **Customization** | Canvas drawing code | React components + CSS |
| **React integration** | Fight React's model | Native React components |
| **Information density** | Fixed canvas image | Conditional rendering by zoom |
| **Node interactivity** | Limited | Full HTML events |
| **Visual quality** | ⚠️ Depends on canvas size | ✅✅✅ Perfect |
| **Development speed** | Slow (canvas drawing) | Fast (React components) |
| **Maintainability** | Complex canvas code | Simple React code |

---

## 🎨 Visual Comparison

### Current Canvas Approach
```
Zoom Out (0.3x):
  ┌─────────┐
  │ ░░░░░░░ │  ← Title bar too small to read
  │ ░░░░░░░ │  ← Metrics invisible
  └─────────┘

Zoom In (2x):
  ┌───────────────────┐
  │  A  p  p  .  j  s │  ← Pixelated text
  │  ▂▃▅▇▆▄▃▂         │  ← Low resolution
  └───────────────────┘
```

### React Flow Approach
```
Zoom Out (0.3x):
  ┌──────────────┐
  │ App.jsx      │  ← Title crisp and readable
  │ (hidden)     │  ← Metrics hidden by zoom
  └──────────────┘

Zoom In (2x):
  ┌─────────────────────────┐
  │ 🎨 App.jsx         🔥  │  ← Title perfect
  ├─────────────────────────┤
  │ ▂▃▅▇▆▄▃▂ Churn         │  ← Sparklines crisp
  │ ████████░ Complexity    │  ← Bars smooth
  │ ✓━━━━━━━━ Coverage      │
  │ LOC: 1234  Cx: 42       │  ← Text sharp
  └─────────────────────────┘
```

---

## 🚀 Migration Plan

### Phase 1: Setup & Basic Graph (Week 1, Days 1-2)

**1.1 Install React Flow**
```bash
npm install @xyflow/react
```

**1.2 Create Basic ReactFlowGraph Component**
```jsx
// packages/ui/src/components/ReactFlowGraph.jsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export function ReactFlowGraph({ nodes, edges }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

**1.3 Convert Graph Data Format**
```javascript
// Current IntelliMap format:
{
  nodes: [{ data: { id: 'file.js', lang: 'js', ... } }],
  edges: [{ data: { source: 'a', target: 'b' } }]
}

// React Flow format:
{
  nodes: [
    {
      id: 'file.js',
      type: 'codeNode',
      position: { x: 100, y: 200 },
      data: { label: 'file.js', lang: 'js', ... }
    }
  ],
  edges: [
    {
      id: 'e1-2',
      source: 'a',
      target: 'b'
    }
  ]
}
```

**1.4 Integration Helper**
```javascript
// packages/ui/src/utils/reactFlowAdapter.js
export function convertToReactFlow(intellimapGraph) {
  const nodes = intellimapGraph.nodes.map(node => ({
    id: node.data.id,
    type: 'codeNode',
    position: { x: 0, y: 0 }, // Will be laid out
    data: {
      ...node.data,
      label: node.data.id.split('/').pop(),
    }
  }));

  const edges = intellimapGraph.edges.map((edge, i) => ({
    id: `e${i}`,
    source: edge.data.source,
    target: edge.data.target,
    animated: edge.data.changed || false,
  }));

  return { nodes, edges };
}
```

---

### Phase 2: Custom Node Component (Week 1, Days 3-4)

**2.1 Create CodeNode Component**
```jsx
// packages/ui/src/components/nodes/CodeNode.jsx
import { Handle, Position, useStore } from '@xyflow/react';
import { memo } from 'react';
import './CodeNode.css';

const CodeNode = memo(({ data }) => {
  // Get current zoom level
  const zoom = useStore(state => state.transform[2]);

  // Determine view mode based on zoom
  const viewMode = zoom < 0.5 ? 'compact' : zoom < 1.2 ? 'standard' : 'expanded';

  return (
    <div className={`code-node ${viewMode}`}>
      {/* Input handles (connections) */}
      <Handle type="target" position={Position.Left} />

      {/* Title bar */}
      <div
        className="title-bar"
        style={{ background: getTitleColor(data) }}
      >
        <span className="icon">{getIcon(data)}</span>
        <span className="label">{data.label}</span>
        {data.status?.hotspot && <span className="badge">🔥</span>}
      </div>

      {/* Metrics - only show if not compact */}
      {viewMode !== 'compact' && (
        <div className="metrics">
          <Sparkline data={data.timeseries?.churn} height={20} />
          <ProgressBar
            label="Complexity"
            value={data.metrics?.complexity || 0}
            max={100}
          />
          <ProgressBar
            label="Coverage"
            value={data.metrics?.coverage || 0}
            max={100}
          />
        </div>
      )}

      {/* Detailed metrics - only show when expanded */}
      {viewMode === 'expanded' && (
        <div className="details">
          <div className="metric">
            <span className="metric-label">LOC:</span>
            <span className="metric-value">{data.metrics?.loc || 0}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Complexity:</span>
            <span className="metric-value">{data.metrics?.complexity || 0}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Fanin:</span>
            <span className="metric-value">{data.metrics?.fanin || 0}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Fanout:</span>
            <span className="metric-value">{data.metrics?.fanout || 0}</span>
          </div>
        </div>
      )}

      {/* Output handles */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

function getTitleColor(data) {
  const key = `${data.lang || 'unknown'}-${data.env || 'unknown'}`;
  const colors = {
    'ts-frontend': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'ts-backend': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'js-frontend': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'js-backend': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'py-backend': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'unknown': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  };
  return colors[key] || colors.unknown;
}

function getIcon(data) {
  if (data.env === 'frontend') return '🎨';
  if (data.env === 'backend') return '⚙️';
  if (data.env === 'test') return '🧪';
  return '📄';
}

export default CodeNode;
```

**2.2 CodeNode Styles**
```css
/* packages/ui/src/components/nodes/CodeNode.css */
.code-node {
  background: #1e1e1e;
  border-radius: 8px;
  border: 1px solid #333;
  overflow: hidden;
  font-family: 'Barlow Condensed', sans-serif;
  transition: all 0.2s ease;
}

/* Compact mode: 60x30 (zoomed out) */
.code-node.compact {
  width: 60px;
  height: 30px;
}

/* Standard mode: 180x80 */
.code-node.standard {
  width: 180px;
  height: auto;
  min-height: 80px;
}

/* Expanded mode: 240x150 (zoomed in) */
.code-node.expanded {
  width: 240px;
  height: auto;
  min-height: 150px;
}

.code-node:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* Title bar */
.code-node .title-bar {
  padding: 6px 10px;
  color: white;
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.code-node.compact .title-bar {
  font-size: 10px;
  padding: 4px 6px;
}

.code-node .title-bar .icon {
  font-size: 14px;
}

.code-node .title-bar .label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-node .title-bar .badge {
  font-size: 12px;
}

/* Metrics section */
.code-node .metrics {
  padding: 8px;
  background: #252525;
}

.code-node .details {
  padding: 8px;
  background: #2a2a2a;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  font-size: 11px;
}

.code-node .details .metric {
  display: flex;
  justify-content: space-between;
  color: #aaa;
}

.code-node .details .metric-value {
  color: #fff;
  font-weight: 600;
}

/* Handles (connection points) */
.react-flow__handle {
  width: 10px;
  height: 10px;
  background: #667eea;
  border: 2px solid #1e1e1e;
}

.react-flow__handle:hover {
  background: #00f2fe;
}
```

**2.3 Register Custom Node**
```jsx
// In ReactFlowGraph.jsx
import CodeNode from './nodes/CodeNode';

const nodeTypes = {
  codeNode: CodeNode,
};

export function ReactFlowGraph({ nodes, edges }) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}  // Register custom node
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

---

### Phase 3: Layout Integration (Week 1, Days 4-5)

**3.1 Install Layout Libraries**
```bash
npm install elkjs dagre
```

**3.2 Create Layout Service**
```javascript
// packages/ui/src/utils/layoutService.js
import ELK from 'elkjs';
import dagre from 'dagre';

export async function layoutGraph(nodes, edges, algorithm = 'elk', direction = 'RIGHT') {
  if (algorithm === 'elk') {
    return await layoutWithELK(nodes, edges, direction);
  } else if (algorithm === 'dagre') {
    return layoutWithDagre(nodes, edges, direction);
  }
  return nodes; // Return unchanged if no layout
}

async function layoutWithELK(nodes, edges, direction = 'RIGHT') {
  const elk = new ELK();

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '20',
    },
    children: nodes.map(node => ({
      id: node.id,
      width: getNodeWidth(node),
      height: getNodeHeight(node),
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layout = await elk.layout(graph);

  return nodes.map(node => {
    const layoutNode = layout.children.find(n => n.id === node.id);
    return {
      ...node,
      position: {
        x: layoutNode.x,
        y: layoutNode.y,
      },
    };
  });
}

function layoutWithDagre(nodes, edges, direction = 'LR') {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(node => {
    g.setNode(node.id, {
      width: getNodeWidth(node),
      height: getNodeHeight(node)
    });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map(node => {
    const position = g.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - position.width / 2,
        y: position.y - position.height / 2,
      },
    };
  });
}

function getNodeWidth(node) {
  // Return width based on node type/zoom
  return 180;
}

function getNodeHeight(node) {
  return 80;
}
```

**3.3 Use in Component**
```jsx
// In App.jsx or GraphView.jsx
import { layoutGraph } from '../utils/layoutService';

const [nodes, setNodes] = useState([]);
const [edges, setEdges] = useState([]);

useEffect(() => {
  async function loadAndLayoutGraph() {
    const { nodes: rawNodes, edges: rawEdges } = convertToReactFlow(graphData);
    const layoutedNodes = await layoutGraph(rawNodes, rawEdges, 'elk', 'RIGHT');
    setNodes(layoutedNodes);
    setEdges(rawEdges);
  }

  loadAndLayoutGraph();
}, [graphData]);
```

---

### Phase 4: Features Parity (Week 2)

**4.1 Node Selection & Inspector**
```jsx
const [selectedNode, setSelectedNode] = useState(null);

function onNodeClick(event, node) {
  setSelectedNode(node);
}

<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodeClick={onNodeClick}
>
  {/* ... */}
</ReactFlow>

{selectedNode && (
  <Inspector node={selectedNode} />
)}
```

**4.2 Filtering**
```javascript
const filteredNodes = nodes.filter(node => {
  if (filters.lang && node.data.lang !== filters.lang) return false;
  if (filters.env && node.data.env !== filters.env) return false;
  if (filters.changed && !node.data.changed) return false;
  return true;
});
```

**4.3 Search & Highlight**
```jsx
const [searchTerm, setSearchTerm] = useState('');

const processedNodes = nodes.map(node => ({
  ...node,
  className: node.data.label.includes(searchTerm) ? 'highlighted' : '',
}));
```

**4.4 Minimap with Node Colors**
```jsx
<MiniMap
  nodeColor={(node) => {
    if (node.className === 'highlighted') return '#667eea';
    return '#333';
  }}
  nodeStrokeWidth={3}
/>
```

---

### Phase 5: Advanced Features (Week 3)

**5.1 Sparkline Component**
```jsx
// packages/ui/src/components/visualizations/Sparkline.jsx
import { useRef, useEffect } from 'react';

export function Sparkline({ data, height = 20, color = '#667eea' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const max = Math.max(...data);
    const width = canvas.offsetWidth;
    const barWidth = width / data.length;

    ctx.fillStyle = color;
    data.forEach((value, i) => {
      const barHeight = (value / max) * height;
      ctx.fillRect(
        i * barWidth,
        height - barHeight,
        barWidth - 1,
        barHeight
      );
    });
  }, [data, height, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className="sparkline"
    />
  );
}
```

**5.2 ProgressBar Component**
```jsx
// packages/ui/src/components/visualizations/ProgressBar.jsx
export function ProgressBar({ label, value, max = 100, color }) {
  const percentage = (value / max) * 100;

  const getColor = () => {
    if (color) return color;
    if (percentage < 30) return '#f5576c';
    if (percentage < 70) return '#f093fb';
    return '#43e97b';
  };

  return (
    <div className="progress-bar-container">
      {label && <div className="progress-label">{label}</div>}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${percentage}%`,
            background: getColor(),
          }}
        />
      </div>
      <div className="progress-value">{value}%</div>
    </div>
  );
}
```

**5.3 Edge Styling**
```jsx
const edgeTypes = {
  default: {
    style: {
      stroke: '#666',
      strokeWidth: 2,
    },
  },
  changed: {
    style: {
      stroke: '#667eea',
      strokeWidth: 3,
    },
    animated: true,
  },
};

const processedEdges = edges.map(edge => ({
  ...edge,
  type: edge.data?.changed ? 'changed' : 'default',
}));
```

---

### Phase 6: Performance Optimization (Week 3)

**6.1 Memoize Node Component**
```jsx
// Already using memo in CodeNode
const CodeNode = memo(({ data }) => {
  // ...
}, (prev, next) => {
  // Custom comparison: only re-render if data actually changed
  return JSON.stringify(prev.data) === JSON.stringify(next.data);
});
```

**6.2 Virtualization Settings**
```jsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  // Only render visible nodes + buffer
  onlyRenderVisibleElements={true}
  // Disable automatic updates when possible
  nodesDraggable={false}
  nodesConnectable={false}
  elementsSelectable={true}
>
  {/* ... */}
</ReactFlow>
```

**6.3 Lazy Load Metrics**
```jsx
const CodeNode = memo(({ data }) => {
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const isVisible = useIsVisible(); // Custom hook

  useEffect(() => {
    if (isVisible && !metricsLoaded) {
      // Load expensive metrics only when visible
      loadDetailedMetrics(data.id).then(() => setMetricsLoaded(true));
    }
  }, [isVisible, data.id, metricsLoaded]);

  // ...
});
```

---

## 📊 Performance Expectations

### React Flow Performance with 500 Nodes

**Rendering:**
- Initial render: ~200-300ms (with layout)
- Zoom/pan: 60fps (smooth)
- Node updates: Only changed nodes re-render
- Virtualization: Only renders visible nodes (~50-100 at a time)

**Memory:**
- 500 nodes: ~50-80MB
- Edges: Minimal overhead
- Canvas elements (sparklines): ~5KB per node

**Comparison to Current:**
| Metric | Current (Cytoscape + Canvas) | React Flow |
|--------|------------------------------|------------|
| Initial load | ⚠️ 500-1000ms | ✅ 200-300ms |
| Pan/zoom smoothness | ❌ Clunky, stutters | ✅ 60fps smooth |
| Zoom quality | ❌ Blurry/pixelated | ✅ Always crisp |
| Node updates | ❌ Re-render all | ✅ Only changed |
| Memory usage | ✅ ~40MB | ⚠️ ~80MB |

---

## 🎯 Implementation Timeline

### Week 1: Core Migration (5 days)
- **Day 1**: Install React Flow, create basic component
- **Day 2**: Data converter, basic graph rendering
- **Day 3**: Custom CodeNode component with styling
- **Day 4**: Layout integration (ELK + Dagre)
- **Day 5**: Testing & debugging

### Week 2: Feature Parity (5 days)
- **Day 6-7**: Node selection, Inspector integration
- **Day 8**: Filtering (language, env, changed)
- **Day 9**: Search & highlighting
- **Day 10**: Minimap, controls, background patterns

### Week 3: Polish & Performance (5 days)
- **Day 11-12**: Sparklines and visual metrics
- **Day 13**: Edge styling, animations
- **Day 14**: Performance optimization, virtualization
- **Day 15**: Testing with real data, bug fixes

**Total: ~3 weeks for complete migration**

---

## ✅ Advantages of React Flow

1. **Native React** - No fighting the framework
2. **HTML/CSS** - Crisp rendering at all zoom levels
3. **Component-based** - Easy to maintain and extend
4. **Conditional rendering** - Natural LOD implementation
5. **Performance** - Virtualization built-in
6. **Flexibility** - Full control over node appearance
7. **Rich ecosystem** - React component libraries work out-of-box
8. **Better UX** - Smooth, responsive, professional feel

---

## ⚠️ Considerations

**1. Performance with 1000+ Nodes**
- React Flow handles this but may need extra optimization
- Virtualization becomes critical
- Consider progressive loading

**2. Learning Curve**
- Different API from Cytoscape
- Need to learn React Flow patterns
- Layout algorithms work differently

**3. Migration Effort**
- ~3 weeks full-time work
- Need to reimplement all features
- Potential bugs during transition

**4. Bundle Size**
- React Flow: ~150KB (gzipped)
- Cytoscape: ~200KB (gzipped)
- Similar size, not a concern

---

## 🎨 Visual Quality Comparison

### Current Approach
```
Problems:
❌ Title bars invisible when zoomed out
❌ Pixelated text when zoomed in
❌ Canvas artifacts during zoom
❌ Inconsistent visual quality
❌ Fighting React's rendering model
```

### React Flow Approach
```
Benefits:
✅ Perfect text rendering at all zooms
✅ Smooth CSS-based scaling
✅ No canvas artifacts
✅ Consistent, professional appearance
✅ Works WITH React, not against it
```

---

## 🚀 Recommendation

**Switch to React Flow.** Here's why:

1. **Solves the root problem** - No more canvas rendering issues
2. **Better long-term** - Easier to maintain and extend
3. **Professional UX** - Smooth, crisp, responsive
4. **React-native** - Works with React ecosystem
5. **3 weeks** - Reasonable timeline for complete migration

**Next Steps:**
1. Create feature branch: `feature/react-flow-migration`
2. Start with Phase 1 (basic graph)
3. Incrementally add features
4. Test with your repo
5. Merge when at parity

---

## 📝 Migration Checklist

### Setup
- [ ] Install @xyflow/react
- [ ] Install elkjs and dagre
- [ ] Create ReactFlowGraph component
- [ ] Create data converter utility

### Core Features
- [ ] Custom CodeNode component
- [ ] Title bar with gradients
- [ ] Icons per node type
- [ ] Status badges (hotspot, changed)
- [ ] Dynamic port positioning

### Visualizations
- [ ] Sparkline component
- [ ] ProgressBar component
- [ ] Embedded metrics display
- [ ] LOD based on zoom level

### Graph Features
- [ ] ELK layout integration
- [ ] Dagre layout integration
- [ ] Node selection
- [ ] Edge styling
- [ ] Animated edges for changed files

### UI Integration
- [ ] Inspector panel
- [ ] Filters (language, env, changed)
- [ ] Search & highlight
- [ ] Minimap
- [ ] Controls (zoom, fit view)

### Performance
- [ ] Memoized components
- [ ] Virtualization enabled
- [ ] Lazy load metrics
- [ ] Test with 500+ nodes

### Polish
- [ ] Dark theme styling
- [ ] Hover effects
- [ ] Smooth transitions
- [ ] Loading states

---

## 💡 Quick Start

Want to see it in action first? I can create a minimal proof-of-concept in ~1 hour:

1. Install React Flow
2. Create basic CodeNode with title bar + metrics
3. Convert 10 nodes from your current graph
4. Show side-by-side comparison

This will let you SEE the difference before committing to full migration.

**Ready to start?**

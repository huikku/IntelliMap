# React Flow Proof-of-Concept - 1 Hour Setup

## Goal
Create a minimal working example using React Flow with your actual IntelliMap data to see if it solves the canvas rendering issues.

## What You'll Get
- Side-by-side comparison: Current approach vs React Flow
- Real visual quality difference at different zoom levels
- Performance comparison with your actual repo
- Decision data: Is 3-week migration worth it?

---

## Step 1: Install React Flow (2 minutes)

```bash
cd /home/john/IntelliMap/packages/ui
npm install @xyflow/react
```

---

## Step 2: Create Minimal CodeNode Component (10 minutes)

Create: `packages/ui/src/components/nodes/CodeNodeReactFlow.jsx`

```jsx
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const CodeNodeReactFlow = memo(({ data }) => {
  // Get title color
  const getTitleColor = () => {
    const key = `${data.lang || 'unknown'}-${data.env || 'unknown'}`;
    const colors = {
      'ts-frontend': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'ts-backend': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'js-frontend': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'js-backend': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'py-backend': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    };
    return colors[key] || 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
  };

  // Get icon
  const getIcon = () => {
    if (data.env === 'frontend') return '🎨';
    if (data.env === 'backend') return '⚙️';
    if (data.env === 'test') return '🧪';
    return '📄';
  };

  return (
    <div
      style={{
        background: '#1e1e1e',
        borderRadius: '8px',
        border: '1px solid #333',
        overflow: 'hidden',
        width: '180px',
        minHeight: '80px',
        fontFamily: 'Barlow Condensed, sans-serif',
      }}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Left} />

      {/* Title bar */}
      <div
        style={{
          background: getTitleColor(),
          padding: '6px 10px',
          color: 'white',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{getIcon()}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.label}
        </span>
        {data.changed && <span>🔥</span>}
      </div>

      {/* Metrics */}
      <div
        style={{
          padding: '8px',
          background: '#252525',
          fontSize: '11px',
          color: '#aaa',
        }}
      >
        <div>LOC: {data.loc || 0}</div>
        <div>Complexity: {data.complexity || 0}</div>
        {data.coverage !== undefined && <div>Coverage: {data.coverage}%</div>}
      </div>

      {/* Output handle */}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

CodeNodeReactFlow.displayName = 'CodeNodeReactFlow';

export default CodeNodeReactFlow;
```

---

## Step 3: Create React Flow Wrapper Component (10 minutes)

Create: `packages/ui/src/components/ReactFlowComparison.jsx`

```jsx
import { useCallback, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CodeNodeReactFlow from './nodes/CodeNodeReactFlow';

const nodeTypes = {
  codeNode: CodeNodeReactFlow,
};

export function ReactFlowComparison({ graphData }) {
  // Convert IntelliMap data to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graphData) return { initialNodes: [], initialEdges: [] };

    // Take first 20 nodes for POC
    const nodes = graphData.nodes.slice(0, 20).map((node, index) => ({
      id: node.data.id,
      type: 'codeNode',
      position: {
        x: (index % 5) * 250,
        y: Math.floor(index / 5) * 150,
      },
      data: {
        label: node.data.id.split('/').pop(),
        lang: node.data.lang,
        env: node.data.env,
        changed: node.data.changed,
        loc: node.data.loc || node.data.fileSize / 30 || 50,
        complexity: node.data.complexity || node.data.cx_q * 20 || 20,
        coverage: node.data.coverage,
      },
    }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graphData.edges
      .filter(e => nodeIds.has(e.data.source) && nodeIds.has(e.data.target))
      .map((edge, i) => ({
        id: `e${i}`,
        source: edge.data.source,
        target: edge.data.target,
        animated: edge.data.changed || false,
        style: {
          stroke: edge.data.changed ? '#667eea' : '#666',
          strokeWidth: edge.data.changed ? 3 : 2,
        },
      }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [graphData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={3}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background color="#333" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.changed) return '#667eea';
            return '#444';
          }}
          nodeStrokeWidth={3}
        />
      </ReactFlow>
    </div>
  );
}
```

---

## Step 4: Add Toggle to GraphView (15 minutes)

Update: `packages/ui/src/components/GraphView.jsx`

Add imports at top:
```jsx
import { ReactFlowComparison } from './ReactFlowComparison';
```

Add state variable (around line 100):
```jsx
const [useReactFlow, setUseReactFlow] = useState(false);
```

Add toggle button in the toolbar area (around line 800, near other controls):
```jsx
<button
  onClick={() => setUseReactFlow(!useReactFlow)}
  style={{
    padding: '8px 16px',
    background: useReactFlow ? '#667eea' : '#333',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'Barlow Condensed',
    fontWeight: 600,
  }}
>
  {useReactFlow ? 'Using React Flow' : 'Using Cytoscape'} - Click to toggle
</button>
```

Wrap the Cytoscape container to conditionally render (around line 850):
```jsx
{!useReactFlow ? (
  <div
    ref={cyContainerRef}
    style={{
      width: '100%',
      height: 'calc(100% - 120px)',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
    }}
  />
) : (
  <div style={{ width: '100%', height: 'calc(100% - 120px)' }}>
    <ReactFlowComparison graphData={{ nodes: filteredNodes, edges: filteredEdges }} />
  </div>
)}
```

---

## Step 5: Test and Compare (20 minutes)

### Run the app:
```bash
npm run dev
```

### Comparison Checklist:

**Test 1: Initial Load**
- [ ] How fast does each render?
- [ ] Which looks more professional?
- [ ] Can you read the title bars?

**Test 2: Zoom Out (0.1x - 0.3x)**
Current Cytoscape:
- Are title bars visible?
- Can you read any text?
- Is it pixelated?

React Flow:
- Are title bars crisp?
- Is text readable?
- How does it look?

**Test 3: Zoom In (2x - 3x)**
Current Cytoscape:
- Is text pixelated?
- Are edges smooth?
- Does it look professional?

React Flow:
- How's the text quality?
- Are gradients smooth?
- Overall appearance?

**Test 4: Pan/Zoom Performance**
Current Cytoscape:
- Does it stutter?
- How smooth is it?
- Any lag?

React Flow:
- Smooth 60fps?
- Responsive?
- Any issues?

**Test 5: Visual Quality**
Take screenshots at different zoom levels:
1. Overview (0.2x zoom)
2. Normal (1x zoom)
3. Detail (2x zoom)

Compare side-by-side.

---

## Step 6: Decision Matrix (5 minutes)

Fill this out after testing:

| Aspect | Current (Cytoscape + Canvas) | React Flow | Winner |
|--------|------------------------------|------------|--------|
| **Initial load speed** | ___ seconds | ___ seconds | ? |
| **Pan/zoom smoothness** | Clunky / OK / Smooth | Clunky / OK / Smooth | ? |
| **Text quality at 0.2x zoom** | Readable / Blurry / Invisible | Readable / Blurry / Invisible | ? |
| **Text quality at 2x zoom** | Sharp / Pixelated | Sharp / Pixelated | ? |
| **Title bar visibility** | Always / Sometimes / Never | Always / Sometimes / Never | ? |
| **Professional appearance** | 1-10 | 1-10 | ? |
| **Overall feel** | 1-10 | 1-10 | ? |

**Migration worth it?** YES / NO / MAYBE

---

## Expected Results

Based on the issues you reported and React Flow's architecture:

### Current Approach (Predicted)
- ❌ Title bars disappear below 0.5x zoom
- ❌ Text pixelated above 1.5x zoom
- ❌ Stutters during pan/zoom
- ⚠️ Inconsistent visual quality

### React Flow (Predicted)
- ✅ Title bars always crisp and readable
- ✅ Perfect text at all zoom levels
- ✅ Smooth 60fps pan/zoom
- ✅ Consistent professional appearance

---

## Quick Customization Options

Want to tweak the POC? Here's how:

### Change Node Size
In `CodeNodeReactFlow.jsx`, change the style:
```jsx
width: '240px',    // Change from 180px
minHeight: '120px', // Change from 80px
```

### Add More Nodes
In `ReactFlowComparison.jsx`, change:
```jsx
const nodes = graphData.nodes.slice(0, 50).map(...)  // Try 50 instead of 20
```

### Add Layout (ELK)
```bash
npm install elkjs
```

```jsx
import ELK from 'elkjs';

const elk = new ELK();

// In ReactFlowComparison.jsx:
useEffect(() => {
  async function layoutNodes() {
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
      },
      children: nodes.map(n => ({ id: n.id, width: 180, height: 80 })),
      edges: edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    };

    const layout = await elk.layout(graph);

    setNodes(nodes.map(node => {
      const layoutNode = layout.children.find(n => n.id === node.id);
      return { ...node, position: { x: layoutNode.x, y: layoutNode.y } };
    }));
  }

  if (nodes.length > 0) {
    layoutNodes();
  }
}, []);
```

---

## Troubleshooting

**Issue: "Module not found: @xyflow/react"**
```bash
# Make sure you're in the right directory
cd /home/john/IntelliMap/packages/ui
npm install @xyflow/react
```

**Issue: "Toggle button doesn't appear"**
- Check console for errors
- Make sure you added the button in the right place
- Try adding it at the very top of the return statement

**Issue: "Nodes don't render"**
- Check if graphData is being passed correctly
- Open browser console and check for errors
- Verify nodes array has data: `console.log(initialNodes)`

**Issue: "Can't see the difference"**
- Make sure you toggled between the two views
- Try zooming in and out significantly (0.2x to 3x)
- Take screenshots to compare closely

---

## After Testing: Next Steps

### If React Flow is CLEARLY better:
1. Create feature branch: `git checkout -b feature/react-flow-migration`
2. Follow the full migration plan (3 weeks)
3. Keep POC as reference

### If React Flow is SLIGHTLY better:
1. Consider hybrid approach instead (Cytoscape + HTML overlays)
2. Implement from `graph-visualization-rethink.md` Option C
3. Takes only 1 day vs 3 weeks

### If BOTH have issues:
1. Try Option A from rethink doc (native Cytoscape with LOD)
2. Remove canvas rendering entirely
3. Use zoom-dependent native styles

### If STUCK:
- Share screenshots of both at different zoom levels
- I can help debug or suggest alternatives

---

## POC Completion Checklist

- [ ] Installed @xyflow/react
- [ ] Created CodeNodeReactFlow component
- [ ] Created ReactFlowComparison component
- [ ] Added toggle button to GraphView
- [ ] Tested at multiple zoom levels
- [ ] Took comparison screenshots
- [ ] Filled out decision matrix
- [ ] Made decision on next steps

---

## Estimated Time

- Setup: 10 minutes
- Coding: 30 minutes
- Testing: 15 minutes
- Decision: 5 minutes

**Total: ~1 hour**

---

## Questions to Ask Yourself After Testing

1. **Is the visual quality difference significant enough?**
2. **Is the performance improvement noticeable?**
3. **Is 3 weeks of migration work justified?**
4. **Could simpler fixes to Cytoscape work instead?**
5. **Do the crisp title bars and smooth zoom solve your main issues?**

If you answer YES to questions 1, 2, 3, and 5 → **Migrate to React Flow**

If you answer NO to questions 1 or 2 → **Try hybrid approach or native Cytoscape LOD**

If you answer NO to question 3 → **Explore 1-day solutions first**

---

## Example: What Success Looks Like

After POC, you should be able to say:

> "Yes, React Flow's HTML-based nodes stay crisp at all zoom levels. The title bars are always readable, even when zoomed out to see 500 files. Pan and zoom are smooth 60fps. This looks professional and solves the canvas rendering issues. The 3-week migration is worth it."

OR

> "React Flow is better, but not dramatically. The 3-week migration isn't justified. I'll try the 1-day hybrid approach instead."

---

Ready to start? The POC will give you clear visual proof of which direction to go.

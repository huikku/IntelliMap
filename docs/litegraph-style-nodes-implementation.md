# LiteGraph-Style Node Design for IntelliMap

**Goal:** Adopt LiteGraph's visual design patterns while keeping Cytoscape's analytical power.

---

## 🎯 Key Features to Adopt

### 1. Title Bar at Top (LiteGraph Style)
```
┌─────────────────────────┐
│ 📄 App.jsx         [●]  │ ← Colored title bar (like LiteGraph)
├─────────────────────────┤
│                         │
│ ▂▃▅▇▆▄▃▂ Churn         │ ← Content area
│ ████████░ Complexity    │
│                         │
└─────────────────────────┘
```

### 2. Fixed Connection Points (LiteGraph Style)
```
        ● Input port
        │
    ┌───┴──────────┐
    │   Node       │
    └───┬──────────┘
        │
        ● Output port
```

**Benefits:**
- ✅ Clearer visual hierarchy (title vs content)
- ✅ Easier to identify node type at a glance
- ✅ Connections attach to specific points (not random edges)
- ✅ Professional, polished look

---

## 📐 Implementation Approach

### Option A: Canvas Rendering (Recommended - Fastest)

**Render entire node as canvas image with title bar + connection dots**

```javascript
// packages/ui/src/utils/litegraphStyleRenderer.js

export class LiteGraphStyleNodeRenderer {
  constructor(width = 240, height = 120) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.titleHeight = 30;
  }

  render(nodeData, zoomLevel) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw title bar
    this.drawTitleBar(nodeData);

    // Draw content area
    this.drawContent(nodeData, zoomLevel);

    // Draw connection points
    this.drawConnectionPoints(nodeData);

    return this.canvas.toDataURL();
  }

  drawTitleBar(data) {
    // Title bar background (colored by node type)
    const titleColor = this.getTitleColor(data);
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.titleHeight);
    gradient.addColorStop(0, titleColor);
    gradient.addColorStop(1, this.darken(titleColor, 0.2));

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.titleHeight);

    // Title bar border
    this.ctx.strokeStyle = this.darken(titleColor, 0.3);
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.canvas.width, this.titleHeight);

    // Icon
    this.ctx.font = '16px Arial';
    this.ctx.fillStyle = '#ffffff';
    const icon = this.getIcon(data);
    this.ctx.fillText(icon, 8, 20);

    // Title text
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(data.label, 32, 20);

    // Status indicators (top-right)
    if (data.status?.hotspot) {
      this.ctx.fillText('🔥', this.canvas.width - 25, 20);
    }
    if (data.changed) {
      this.ctx.fillText('📝', this.canvas.width - 45, 20);
    }
  }

  drawContent(data, zoomLevel) {
    const contentY = this.titleHeight;
    const contentHeight = this.canvas.height - this.titleHeight;

    // Background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, contentY, this.canvas.width, contentHeight);

    // Content border
    this.ctx.strokeStyle = '#2a2a2a';
    this.ctx.strokeRect(0, contentY, this.canvas.width, contentHeight);

    // Render metrics based on zoom
    if (zoomLevel < 0.5) {
      this.renderCompactContent(data, contentY);
    } else if (zoomLevel < 1.5) {
      this.renderStandardContent(data, contentY);
    } else {
      this.renderExpandedContent(data, contentY);
    }
  }

  drawConnectionPoints(data) {
    const inputCount = data.metrics.fanin;
    const outputCount = data.metrics.fanout;

    // Input ports (top edge)
    for (let i = 0; i < Math.min(inputCount, 5); i++) {
      const x = this.canvas.width * (i + 1) / (Math.min(inputCount, 5) + 1);
      this.drawPort(x, 0, 'input', inputCount > 5 ? '...' : null);
    }

    // Output ports (bottom edge)
    for (let i = 0; i < Math.min(outputCount, 5); i++) {
      const x = this.canvas.width * (i + 1) / (Math.min(outputCount, 5) + 1);
      this.drawPort(x, this.canvas.height, 'output', outputCount > 5 ? '...' : null);
    }
  }

  drawPort(x, y, type, label = null) {
    const isInput = type === 'input';
    const portSize = 10;

    // Port circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, portSize / 2, 0, 2 * Math.PI);
    this.ctx.fillStyle = isInput ? '#4a9eff' : '#4ade80';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Label (if overflow indicator)
    if (label) {
      this.ctx.fillStyle = '#6a6a6a';
      this.ctx.font = '10px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(label, x, y + (isInput ? 15 : -8));
    }
  }

  renderStandardContent(data, startY) {
    const padding = 10;
    let y = startY + padding;

    // Churn sparkline
    if (data.timeseries?.churn) {
      this.ctx.fillStyle = '#6a6a6a';
      this.ctx.font = '9px monospace';
      this.ctx.fillText('Churn (7d)', padding, y + 8);

      this.drawSparkline(
        data.timeseries.churn,
        padding,
        y + 12,
        this.canvas.width - padding * 2,
        15,
        '#8b7355'
      );
      y += 30;
    }

    // Complexity bar
    this.ctx.fillStyle = '#6a6a6a';
    this.ctx.font = '9px monospace';
    this.ctx.fillText(`Complexity: ${data.metrics.complexity}/100`, padding, y + 8);

    this.drawBar(
      data.metrics.complexity,
      100,
      padding,
      y + 12,
      this.canvas.width - padding * 2,
      8,
      '#4a9eff',
      '#0a0a0a'
    );
    y += 24;

    // Coverage bar
    this.ctx.fillStyle = '#6a6a6a';
    this.ctx.font = '9px monospace';
    this.ctx.fillText(`Coverage: ${data.metrics.coverage}%`, padding, y + 8);

    this.drawBar(
      data.metrics.coverage,
      100,
      padding,
      y + 12,
      this.canvas.width - padding * 2,
      8,
      '#4ade80',
      '#0a0a0a'
    );
  }

  getTitleColor(data) {
    // Color based on language/environment
    const colors = {
      'ts-frontend': '#5a5a8a',
      'ts-backend': '#4a6a5a',
      'js-frontend': '#7a7a5a',
      'js-backend': '#5a7a5a',
      'py-backend': '#5a5a6a',
      'default': '#4a4a4a'
    };

    const key = `${data.lang}-${data.env}`;
    return colors[key] || colors.default;
  }

  getIcon(data) {
    const icons = {
      'frontend': '🎨',
      'backend': '⚙️',
      'test': '🧪',
      'config': '📝',
      'util': '🔧'
    };

    return icons[data.env] || '📄';
  }

  darken(color, amount) {
    // Darken hex color by amount (0-1)
    const num = parseInt(color.slice(1), 16);
    const r = Math.max(0, (num >> 16) - Math.floor(255 * amount));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.floor(255 * amount));
    const b = Math.max(0, (num & 0x0000FF) - Math.floor(255 * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  // Helper methods (sparkline, bar, etc.)
  drawSparkline(values, x, y, width, height, color) {
    if (!values || values.length < 2) return;

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();

    values.forEach((value, i) => {
      const px = x + i * stepX;
      const py = y + height - ((value - min) / range) * height;

      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    });

    this.ctx.stroke();
  }

  drawBar(value, max, x, y, width, height, fillColor, bgColor) {
    // Background
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(x, y, width, height);

    // Filled portion
    const fillWidth = (value / max) * width;
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x, y, fillWidth, height);

    // Border
    this.ctx.strokeStyle = '#3a3a3a';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);
  }

  // Additional methods for compact/expanded rendering...
  renderCompactContent(data, startY) {
    // Minimal view for low zoom
    const padding = 5;
    this.ctx.fillStyle = '#6a6a6a';
    this.ctx.font = '8px monospace';
    this.ctx.fillText(`LOC: ${data.metrics.loc}`, padding, startY + 15);
  }

  renderExpandedContent(data, startY) {
    // Full details for high zoom
    // Similar to renderStandardContent but with more info
  }
}

export const litegraphStyleRenderer = new LiteGraphStyleNodeRenderer();
```

---

## 🔌 Fixed Connection Points Implementation

### Strategy: Style Edge Endpoints

Cytoscape edges connect to node boundaries, but we can:
1. Show visual port indicators on nodes
2. Style edge endpoints to look like they snap to ports
3. Use edge control points to route through specific positions

```javascript
// packages/ui/src/components/GraphView.jsx

const style = [
  // Node style with title bar and ports
  {
    selector: 'node',
    style: {
      'width': 240,
      'height': 120,
      'shape': 'roundrectangle',
      'background-image': (node) => {
        return litegraphStyleRenderer.render(node.data(), cy.zoom());
      },
      'background-fit': 'cover',
      'border-width': 0, // Border is part of canvas image
    }
  },

  // Edge styling (connection lines)
  {
    selector: 'edge',
    style: {
      'width': 3,
      'line-color': '#4a4a4a',
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#4ade80',
      'arrow-scale': 1.5,

      // Source endpoint (output port)
      'source-endpoint': '0deg 50%', // Bottom center
      'source-distance-from-node': 5,

      // Target endpoint (input port)
      'target-endpoint': '180deg 50%', // Top center
      'target-distance-from-node': 5,

      // Smooth curves
      'control-point-step-size': 40,
      'edge-distances': 'node-position'
    }
  },

  // Highlighted edges
  {
    selector: 'edge.highlighted',
    style: {
      'line-color': '#4a9eff',
      'target-arrow-color': '#4a9eff',
      'width': 4,
      'z-index': 999
    }
  },

  // Selected node edges
  {
    selector: 'edge.selected',
    style: {
      'line-color': '#8b7355',
      'target-arrow-color': '#8b7355',
      'width': 4
    }
  }
];
```

---

## 🎨 Advanced: Dynamic Connection Points

For nodes with many connections, distribute connection points intelligently:

```javascript
// Calculate optimal connection point based on edge direction
function getOptimalConnectionPoint(sourceNode, targetNode, isSource) {
  const sourcePos = sourceNode.position();
  const targetPos = targetNode.position();

  // Calculate angle between nodes
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  if (isSource) {
    // Source (output) - bottom of node
    if (angle > -45 && angle < 45) return '0deg 70%'; // Bottom-right
    if (angle > 45 && angle < 135) return '0deg 50%'; // Bottom-center
    if (angle > 135 || angle < -135) return '0deg 30%'; // Bottom-left
    return '0deg 50%'; // Default bottom
  } else {
    // Target (input) - top of node
    if (angle > -45 && angle < 45) return '180deg 30%'; // Top-left
    if (angle > 45 && angle < 135) return '180deg 50%'; // Top-center
    if (angle > 135 || angle < -135) return '180deg 70%'; // Top-right
    return '180deg 50%'; // Default top
  }
}

// Apply to edges dynamically
cy.edges().forEach(edge => {
  const source = edge.source();
  const target = edge.target();

  edge.style({
    'source-endpoint': getOptimalConnectionPoint(source, target, true),
    'target-endpoint': getOptimalConnectionPoint(source, target, false)
  });
});
```

---

## 🎭 Alternative: HTML Overlay Approach

**For even richer control (but slower performance):**

```javascript
// Use cytoscape-node-html-label extension
import nodeHtmlLabel from 'cytoscape-node-html-label';

cytoscape.use(nodeHtmlLabel);

cy.nodeHtmlLabel([{
  query: 'node',
  halign: 'center',
  valign: 'center',
  halignBox: 'center',
  valignBox: 'center',
  tpl: (data) => {
    return `
      <div class="litegraph-node">
        <!-- Title Bar -->
        <div class="node-title-bar" style="background: ${getTitleColor(data)}">
          <span class="node-icon">${getIcon(data)}</span>
          <span class="node-label">${data.label}</span>
          ${data.status?.hotspot ? '<span class="node-badge">🔥</span>' : ''}
        </div>

        <!-- Content Area -->
        <div class="node-content">
          <div class="node-metric">
            <span class="metric-label">Churn (7d)</span>
            <svg class="sparkline" width="200" height="20">
              ${renderSparklineSVG(data.timeseries?.churn)}
            </svg>
          </div>

          <div class="node-metric">
            <span class="metric-label">Complexity: ${data.metrics.complexity}/100</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${data.metrics.complexity}%"></div>
            </div>
          </div>
        </div>

        <!-- Connection Points -->
        <div class="node-ports">
          ${renderInputPorts(data.metrics.fanin)}
          ${renderOutputPorts(data.metrics.fanout)}
        </div>
      </div>
    `;
  }
}]);
```

**With CSS:**

```css
/* packages/ui/src/styles/litegraph-nodes.css */

.litegraph-node {
  width: 240px;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.node-title-bar {
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  color: white;
  font-weight: bold;
  font-size: 12px;
  background: linear-gradient(180deg, #5a5a8a 0%, #4a4a6a 100%);
  border-bottom: 2px solid rgba(0, 0, 0, 0.3);
}

.node-icon {
  margin-right: 8px;
  font-size: 16px;
}

.node-badge {
  margin-left: auto;
  font-size: 16px;
}

.node-content {
  padding: 10px;
}

.node-metric {
  margin-bottom: 12px;
}

.metric-label {
  display: block;
  font-size: 9px;
  color: #6a6a6a;
  margin-bottom: 4px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #0a0a0a;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #3a3a3a;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a9eff 0%, #2a6eaf 100%);
  transition: width 0.3s ease;
}

/* Connection Ports */
.node-ports {
  position: relative;
}

.port {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid white;
  background: #4a9eff;
}

.port.input {
  top: -5px;
  background: #4a9eff;
}

.port.output {
  bottom: -5px;
  background: #4ade80;
}

/* Sparkline SVG styling */
.sparkline path {
  stroke: #8b7355;
  stroke-width: 2;
  fill: none;
}
```

---

## 🔧 Integration with Existing GraphView

**Modify:** `packages/ui/src/components/GraphView.jsx`

```javascript
import { litegraphStyleRenderer } from '../utils/litegraphStyleRenderer';

export default function GraphView({ graph, plane, filters, selectedNode, setSelectedNode, cyRef }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!graph || !containerRef.current) return;

    // Filter nodes...
    const filteredNodes = filterNodes(graph.nodes, plane, filters);
    const filteredEdges = filterEdges(graph.edges, filteredNodes);

    // Create Cytoscape instance with LiteGraph-style nodes
    const cy = cytoscape({
      container: containerRef.current,
      elements: {
        nodes: filteredNodes.map(node => ({
          data: {
            id: node.id,
            label: node.id.split('/').pop(),
            ...node,
            // Add timeseries data if available
            timeseries: {
              churn: generateMockChurn(), // TODO: Get from graph.json
              complexity: generateMockComplexity()
            }
          }
        })),
        edges: filteredEdges.map(edge => ({
          data: {
            id: `${edge.from}-${edge.to}`,
            source: edge.from,
            target: edge.to
          }
        }))
      },
      style: [
        // LiteGraph-style nodes
        {
          selector: 'node',
          style: {
            'width': 240,
            'height': 120,
            'shape': 'roundrectangle',
            'background-image': (node) => {
              const zoom = cy.zoom();
              return litegraphStyleRenderer.render(node.data(), zoom);
            },
            'background-fit': 'cover',
            'background-clip': 'none',
            'border-width': 0
          }
        },

        // Selected node
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#8b7355',
            'border-style': 'solid'
          }
        },

        // Edges with fixed endpoints
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#4a4a4a',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#4ade80',
            'arrow-scale': 1.5,

            // Fixed connection points
            'source-endpoint': '0deg 50%', // Bottom center
            'target-endpoint': '180deg 50%', // Top center

            'source-distance-from-node': 5,
            'target-distance-from-node': 5,

            'opacity': 0.6,
            'transition-property': 'line-color, opacity',
            'transition-duration': '0.2s'
          }
        },

        // Hover effect
        {
          selector: 'edge:active',
          style: {
            'line-color': '#4a9eff',
            'target-arrow-color': '#4a9eff',
            'opacity': 1,
            'width': 4
          }
        }
      ],
      layout: {
        name: 'elk',
        elk: {
          algorithm: 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': 80,
          'elk.layered.spacing.nodeNodeBetweenLayers': 100
        }
      },
      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    // Update node rendering on zoom
    cy.on('zoom', () => {
      const zoom = cy.zoom();
      cy.nodes().forEach(node => {
        node.style({
          'background-image': litegraphStyleRenderer.render(node.data(), zoom)
        });
      });
    });

    // Highlight connected edges on node hover
    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      node.connectedEdges().addClass('highlighted');
    });

    cy.on('mouseout', 'node', (event) => {
      const node = event.target;
      node.connectedEdges().removeClass('highlighted');
    });

    // Store reference
    if (cyRef) {
      cyRef.current = cy;
    }

    return () => {
      cy.destroy();
    };

  }, [graph, plane, filters]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <GraphHUD cy={cyRef?.current} />
    </div>
  );
}
```

---

## 🎨 Color Schemes for Title Bars

### Language-Based Colors (LiteGraph Style)

```javascript
const titleColors = {
  // TypeScript
  'ts-frontend': {
    base: '#5a7a9a',
    gradient: ['#5a7a9a', '#4a6a8a']
  },
  'ts-backend': {
    base: '#4a7a6a',
    gradient: ['#4a7a6a', '#3a6a5a']
  },

  // JavaScript
  'js-frontend': {
    base: '#9a9a5a',
    gradient: ['#9a9a5a', '#8a8a4a']
  },
  'js-backend': {
    base: '#7a9a5a',
    gradient: ['#7a9a5a', '#6a8a4a']
  },

  // Python
  'py-backend': {
    base: '#5a6a9a',
    gradient: ['#5a6a9a', '#4a5a8a']
  },

  // Special types
  'test': {
    base: '#9a5a7a',
    gradient: ['#9a5a7a', '#8a4a6a']
  },
  'config': {
    base: '#6a6a6a',
    gradient: ['#6a6a6a', '#5a5a5a']
  }
};
```

---

## 📊 Comparison: Before vs After

### Before (Simple Cytoscape)
```
    ●
  (just a dot)
```

### After (LiteGraph Style)
```
┌─────────────────────────┐
│ 🎨 App.jsx         🔥  │ ← Title bar (colored)
├─────────────────────────┤
│ ● ● ●                   │ ← Input ports (top)
│                         │
│ ▂▃▅▇▆▄▃▂ Churn         │
│ ████████░ Complexity    │
│ ✓━━━━━━ Coverage        │
│                         │
│                   ● ● ● │ ← Output ports (bottom)
└─────────────────────────┘
```

**Improvements:**
- ✅ Clear title bar with icon and status
- ✅ Visual connection points
- ✅ Professional appearance
- ✅ Better information hierarchy
- ✅ Easier to scan at a glance

---

## 🚀 Implementation Checklist

### Week 1: Title Bar + Canvas Rendering
- [ ] Create `litegraphStyleRenderer.js`
- [ ] Implement title bar drawing with gradients
- [ ] Add icon mapping by node type
- [ ] Add status badges (hotspot, changed)
- [ ] Integrate with GraphView

### Week 2: Connection Points
- [ ] Add port drawing to canvas renderer
- [ ] Calculate port positions based on fanin/fanout
- [ ] Style edge endpoints to snap to ports
- [ ] Add dynamic port positioning for optimal routing

### Week 3: Polish & Interactivity
- [ ] Add hover effects on ports
- [ ] Highlight connected edges on node hover
- [ ] Add smooth transitions
- [ ] Test with various graph sizes
- [ ] Optimize rendering performance

---

## 🎯 Performance Considerations

### Canvas Rendering Performance

**Cache rendered node images:**
```javascript
const renderCache = new Map();

function getCachedNodeImage(nodeData, zoom) {
  const cacheKey = `${nodeData.id}_${Math.floor(zoom * 10) / 10}`;

  if (renderCache.has(cacheKey)) {
    return renderCache.get(cacheKey);
  }

  const image = litegraphStyleRenderer.render(nodeData, zoom);
  renderCache.set(cacheKey, image);

  // Limit cache size
  if (renderCache.size > 1000) {
    const firstKey = renderCache.keys().next().value;
    renderCache.delete(firstKey);
  }

  return image;
}
```

### Edge Rendering Optimization

**Simplify edges at low zoom:**
```javascript
{
  selector: 'edge',
  style: {
    'opacity': (edge) => {
      const zoom = edge.cy().zoom();
      return zoom < 0.3 ? 0.1 : zoom < 0.6 ? 0.4 : 0.8;
    },
    'width': (edge) => {
      const zoom = edge.cy().zoom();
      return zoom < 0.3 ? 1 : zoom < 0.6 ? 2 : 3;
    }
  }
}
```

---

## 📝 Next Steps

1. **Implement basic title bar** (canvas renderer)
2. **Add fixed connection points** (visual indicators)
3. **Test with sample graph**
4. **Iterate on colors and styling**
5. **Add hover interactions**

Would you like me to:
- **Create the full `litegraphStyleRenderer.js`** implementation?
- **Build a working prototype** with sample data?
- **Show examples** with different node types?

This will give you ComfyUI's polished look while keeping Cytoscape's power! 🎨✨

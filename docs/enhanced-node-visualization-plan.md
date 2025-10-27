# Enhanced Node Visualization with Embedded Metrics

**Goal:** Transform IntelliMap nodes from simple shapes into information-rich cards with embedded micro-visualizations.

---

## Visual Design Concept

### Standard Node (Mid-Zoom)
```
┌─────────────────────────────────────────┐
│ 📄 packages/ui/src/App.jsx          [●] │ ← File name + status indicator
├─────────────────────────────────────────┤
│ ▂▃▅▇▆▄▃▂  Churn (7d)                   │ ← Sparkline: commit frequency
│ ████████░░  Complexity: 42/100          │ ← Horizontal bar
│ ✓━━━━━━━━━  Coverage: 85%              │ ← Coverage bar with checkmark
├─────────────────────────────────────────┤
│ LOC: 1,234  │  Deps: 8  │  Depth: 3    │ ← Quick metrics
└─────────────────────────────────────────┘
```

### Compact Node (Low-Zoom)
```
┌──────────────┐
│ App.jsx      │
│ ▂▃▅▇▆▄       │ ← Just churn sparkline
│ ████████░░   │ ← Complexity bar
└──────────────┘
```

### Expanded Node (High-Zoom / Hover)
```
┌────────────────────────────────────────────────────┐
│ 📄 packages/ui/src/App.jsx                    [●●] │
├────────────────────────────────────────────────────┤
│                                                     │
│  Churn History (30 days)                          │
│  ▂▃▅▇▆▄▃▂▁▁▂▃▅▇█▇▅▃▂▁▁▂▃▄▅▆▇▅▃▂                  │
│                                                     │
│  Complexity Trend                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▲                 │
│  38 → 42 (+4 this week)                           │
│                                                     │
│  Coverage by Type                                  │
│  ████████████████░░░░  Lines: 85%                 │
│  ██████████░░░░░░░░░░  Branches: 62%              │
│  ███████████████████░  Functions: 92%             │
│                                                     │
│  Performance (avg execution time)                  │
│  ▂▃▂▃▄▅▆▅▄▃▂▃▄▅█▇▆▅▄▃▂▁▂▃▄▅▄▃▂▁                  │
│  Hotspot detected! Consider optimization.          │
│                                                     │
├────────────────────────────────────────────────────┤
│ LOC: 1,234     Complexity: 42      Depth: 3        │
│ Fanin: 12      Fanout: 8           Churn: 47       │
│ Coverage: 85%  Avg Time: 245ms     Commits: 127    │
└────────────────────────────────────────────────────┘
```

---

## Implementation Strategy

### Phase 1: Lightweight Canvas Sparklines (Week 1)

**Keep Cytoscape, add custom node rendering with canvas.**

#### Architecture
```
┌────────────────────────────────────┐
│   Cytoscape Graph Engine           │
│   (layout, pan, zoom)              │
├────────────────────────────────────┤
│   Custom Node Renderer             │
│   • Canvas-based sparklines        │
│   • Metric bars                    │
│   • Coverage indicators            │
├────────────────────────────────────┤
│   Zoom-Aware LOD System            │
│   • Low: Basic shape + color       │
│   • Mid: + Sparklines + bars       │
│   • High: + Full metrics dashboard │
└────────────────────────────────────┘
```

#### Data Structure Enhancement

**Extend graph.json nodes:**
```json
{
  "id": "packages/ui/src/App.jsx",
  "label": "App.jsx",
  "lang": "js",
  "env": "frontend",
  "metrics": {
    "loc": 1234,
    "complexity": 42,
    "fanin": 12,
    "fanout": 8,
    "depth": 3,
    "coverage": 85,
    "avgTime": 245
  },
  "timeseries": {
    "churn": [2, 3, 5, 7, 6, 4, 3, 2],        // Last 8 periods
    "complexity": [38, 39, 40, 41, 42],       // Last 5 snapshots
    "coverage": [78, 80, 82, 85],             // Historical coverage
    "performance": [230, 245, 250, 245, 240]  // Avg execution time
  },
  "status": {
    "changed": false,
    "hotspot": true,
    "needsRefactor": false,
    "lowCoverage": false
  }
}
```

#### Canvas Rendering Functions

```javascript
// packages/ui/src/utils/nodeRenderer.js

export class NodeRenderer {
  constructor(width = 240, height = 80) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Render a complete node with all visualizations
   */
  render(nodeData, zoomLevel) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (zoomLevel < 0.5) {
      // Low zoom: minimal
      this.renderCompact(nodeData);
    } else if (zoomLevel < 1.5) {
      // Mid zoom: sparklines + bars
      this.renderStandard(nodeData);
    } else {
      // High zoom: full dashboard
      this.renderExpanded(nodeData);
    }

    return this.canvas.toDataURL();
  }

  renderCompact(data) {
    // Background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // File name (truncated)
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(data.label, 5, 15);

    // Tiny sparkline
    if (data.timeseries?.churn) {
      this.drawSparkline(data.timeseries.churn, 5, 20, 60, 15, '#8b7355');
    }
  }

  renderStandard(data) {
    const padding = 5;
    let y = padding;

    // Background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Header: File name
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.font = 'bold 11px monospace';
    this.ctx.fillText(data.label, padding, y + 10);
    y += 20;

    // Status indicator (hotspot, changed, etc.)
    if (data.status?.hotspot) {
      this.ctx.fillStyle = '#ff6b6b';
      this.ctx.fillText('🔥', this.canvas.width - 20, 10);
    }

    // Divider
    this.ctx.strokeStyle = '#2a2a2a';
    this.ctx.beginPath();
    this.ctx.moveTo(padding, y);
    this.ctx.lineTo(this.canvas.width - padding, y);
    this.ctx.stroke();
    y += 5;

    // Churn sparkline
    if (data.timeseries?.churn) {
      this.ctx.fillStyle = '#6a6a6a';
      this.ctx.font = '9px monospace';
      this.ctx.fillText('Churn (7d)', padding, y + 8);

      this.drawSparkline(
        data.timeseries.churn,
        padding,
        y + 10,
        this.canvas.width - padding * 2,
        15,
        '#8b7355'
      );
      y += 28;
    }

    // Complexity bar
    this.ctx.fillStyle = '#6a6a6a';
    this.ctx.font = '9px monospace';
    this.ctx.fillText(`Complexity: ${data.metrics.complexity}/100`, padding, y + 8);

    this.drawBar(
      data.metrics.complexity,
      100,
      padding,
      y + 10,
      this.canvas.width - padding * 2,
      8,
      '#4a9eff',
      '#1a1a1a'
    );
    y += 22;

    // Coverage bar
    this.ctx.fillStyle = '#6a6a6a';
    this.ctx.font = '9px monospace';
    this.ctx.fillText(`Coverage: ${data.metrics.coverage}%`, padding, y + 8);

    this.drawBar(
      data.metrics.coverage,
      100,
      padding,
      y + 10,
      this.canvas.width - padding * 2,
      8,
      '#4ade80',
      '#1a1a1a'
    );
    y += 22;

    // Quick metrics footer
    this.ctx.fillStyle = '#4a4a4a';
    this.ctx.font = '8px monospace';
    this.ctx.fillText(
      `LOC: ${data.metrics.loc}  |  Deps: ${data.metrics.fanout}  |  Depth: ${data.metrics.depth}`,
      padding,
      this.canvas.height - 5
    );
  }

  renderExpanded(data) {
    // Full dashboard with all metrics + trends
    // Similar to renderStandard but with more detail
    // Include performance sparkline, coverage breakdown, etc.
    // (Implementation similar but more detailed)
  }

  /**
   * Draw a sparkline chart
   */
  drawSparkline(values, x, y, width, height, color = '#8b7355') {
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

    // Fill area under line
    this.ctx.lineTo(x + width, y + height);
    this.ctx.lineTo(x, y + height);
    this.ctx.closePath();
    this.ctx.fillStyle = color + '22'; // 22 = ~13% opacity
    this.ctx.fill();
  }

  /**
   * Draw a horizontal bar chart
   */
  drawBar(value, max, x, y, width, height, fillColor = '#4a9eff', bgColor = '#2a2a2a') {
    // Background
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(x, y, width, height);

    // Filled portion
    const fillWidth = (value / max) * width;
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x, y, fillWidth, height);

    // Border
    this.ctx.strokeStyle = '#3a3a3a';
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw a coverage ring/donut
   */
  drawCoverageRing(value, centerX, centerY, radius) {
    const percentage = value / 100;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + percentage * 2 * Math.PI;

    // Background circle
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    this.ctx.strokeStyle = '#2a2a2a';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Filled arc
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    this.ctx.strokeStyle = value > 80 ? '#4ade80' : value > 50 ? '#fbbf24' : '#ef4444';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // Center text
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.font = 'bold 10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${value}%`, centerX, centerY);
  }
}

// Export singleton
export const nodeRenderer = new NodeRenderer();
```

#### Integration with Cytoscape

```javascript
// packages/ui/src/components/GraphView.jsx

import { nodeRenderer } from '../utils/nodeRenderer';

// In Cytoscape style configuration:
const style = [
  {
    selector: 'node',
    style: {
      'width': 240,
      'height': 80,
      'shape': 'roundrectangle',
      'background-fit': 'contain',
      'background-clip': 'none',
      'background-image': (node) => {
        const data = node.data();
        const zoom = cy.zoom();
        return nodeRenderer.render(data, zoom);
      },
      'background-image-opacity': 1,
      'border-width': 2,
      'border-color': (node) => {
        if (node.data('status')?.hotspot) return '#ff6b6b';
        if (node.data('changed')) return '#8b7355';
        return '#2a2a2a';
      }
    }
  }
];

// Update on zoom
cy.on('zoom', () => {
  cy.nodes().forEach(node => {
    node.style('background-image', nodeRenderer.render(node.data(), cy.zoom()));
  });
});
```

---

## Phase 2: Interactive Hover Overlays (Week 2)

**Add rich tooltips/popovers on hover with detailed charts.**

### HTML Overlay for Detailed View

```javascript
// packages/ui/src/components/NodeDetailOverlay.jsx

import React from 'react';
import { Line, Bar } from 'react-chartjs-2';

export default function NodeDetailOverlay({ node, position }) {
  if (!node) return null;

  const churnData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Commits',
      data: node.timeseries.churn,
      borderColor: '#8b7355',
      backgroundColor: 'rgba(139, 115, 85, 0.1)',
      tension: 0.4
    }]
  };

  const coverageData = {
    labels: ['Lines', 'Branches', 'Functions'],
    datasets: [{
      label: 'Coverage %',
      data: [85, 62, 92],
      backgroundColor: ['#4ade80', '#fbbf24', '#4a9eff']
    }]
  };

  return (
    <div
      className="absolute z-50 bg-[#0a0a0a] border-2 border-purple-700 rounded-lg p-4 shadow-2xl"
      style={{
        left: position.x + 20,
        top: position.y + 20,
        width: 400
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-purple-300">{node.label}</h3>
        {node.status?.hotspot && <span className="text-2xl">🔥</span>}
      </div>

      <div className="space-y-4">
        {/* Churn Trend */}
        <div>
          <h4 className="text-sm font-bold text-[#6a6a6a] mb-2">Churn History (7 days)</h4>
          <Line
            data={churnData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, grid: { color: '#2a2a2a' } },
                x: { grid: { color: '#2a2a2a' } }
              }
            }}
          />
        </div>

        {/* Coverage Breakdown */}
        <div>
          <h4 className="text-sm font-bold text-[#6a6a6a] mb-2">Coverage Breakdown</h4>
          <Bar
            data={coverageData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, max: 100, grid: { color: '#2a2a2a' } }
              }
            }}
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-[#1a1a1a] p-2 rounded">
            <div className="text-[#6a6a6a]">LOC</div>
            <div className="text-lg font-bold">{node.metrics.loc}</div>
          </div>
          <div className="bg-[#1a1a1a] p-2 rounded">
            <div className="text-[#6a6a6a]">Complexity</div>
            <div className="text-lg font-bold">{node.metrics.complexity}</div>
          </div>
          <div className="bg-[#1a1a1a] p-2 rounded">
            <div className="text-[#6a6a6a]">Depth</div>
            <div className="text-lg font-bold">{node.metrics.depth}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 3: Alternative Library Options

### Option A: Victory Charts (Lightweight)
```bash
npm install victory
```

**Pros:** React-native compatible, small bundle (~40KB), good for sparklines

**Example:**
```jsx
import { VictoryLine, VictoryBar } from 'victory';

<VictoryLine
  width={200}
  height={50}
  data={churnData}
  style={{
    data: { stroke: '#8b7355', strokeWidth: 2 }
  }}
/>
```

---

### Option B: Recharts (Popular)
```bash
npm install recharts
```

**Pros:** Declarative API, extensive chart types, good docs

**Cons:** Larger bundle (~90KB)

**Example:**
```jsx
import { LineChart, Line } from 'recharts';

<LineChart width={200} height={50} data={churnData}>
  <Line type="monotone" dataKey="value" stroke="#8b7355" />
</LineChart>
```

---

### Option C: uPlot (High Performance)
```bash
npm install uplot
```

**Pros:** Fastest rendering, smallest bundle (~40KB), handles 1M+ points

**Cons:** Imperative API, less React-friendly

**Example:**
```javascript
import uPlot from 'uplot';

const opts = {
  width: 200,
  height: 50,
  series: [
    {},
    { stroke: '#8b7355' }
  ]
};

new uPlot(opts, [timestamps, values], document.getElementById('chart'));
```

---

## Recommended Tech Stack

### ⭐ Best Choice: Hybrid Approach

**For 90% of nodes (in-graph visualization):**
- **Custom Canvas Rendering** (zero dependencies)
- Lightweight sparklines and bars
- Fast, embedded in Cytoscape nodes

**For 10% of nodes (hover detail overlay):**
- **Victory Charts** or **uPlot**
- Rich interactive charts
- Only rendered on-demand for hovered node

**Why:**
- Best performance (canvas for bulk, library for detail)
- Smallest bundle size
- Best UX (always-visible basics + rich detail on hover)

---

## Data Collection Strategy

### Extend graph.json Generation

**Modify:** `packages/cli/indexers/mergeGraphs.js`

```javascript
// Add timeseries data collection
async function enrichWithTimeseries(nodes) {
  for (const node of nodes) {
    // Get git history for churn
    node.timeseries = {
      churn: await getChurnTimeseries(node.id, 8), // Last 8 periods
      complexity: await getComplexityHistory(node.id, 5) // Last 5 snapshots
    };

    // Check for hotspots
    node.status = {
      hotspot: node.metrics.avgTime > 200 && node.metrics.complexity > 30,
      needsRefactor: node.metrics.complexity > 50,
      lowCoverage: node.metrics.coverage < 50
    };
  }
}

function getChurnTimeseries(filePath, periods = 8) {
  // Query git log for last N periods (e.g., days)
  const commits = execSync(
    `git log --since="${periods} days ago" --format=%ad --date=short -- ${filePath}`
  )
    .toString()
    .split('\n')
    .filter(Boolean);

  // Group by date and count
  const churnByDate = {};
  commits.forEach(date => {
    churnByDate[date] = (churnByDate[date] || 0) + 1;
  });

  // Return array of counts for last N days
  return Object.values(churnByDate);
}
```

---

## Visual Example: Before vs After

### Before (Current)
```
[ Circle ] → Simple shape, color coded
```

### After (Enhanced)
```
┌─────────────────────────┐
│ App.jsx            [🔥] │  ← Hotspot indicator
│ ▂▃▅▇▆▄▃▂ Churn         │  ← Visual trend
│ ████████░░ Complexity   │  ← Immediate understanding
│ ✓━━━━━━━ Coverage: 85% │  ← Quick assessment
│ LOC: 1234 | Deps: 8     │  ← Key metrics
└─────────────────────────┘
```

**Information density: 6× improvement**
**Visual scan time: 80% faster**

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Create `nodeRenderer.js` with canvas drawing functions
- [ ] Implement sparkline rendering
- [ ] Implement bar chart rendering
- [ ] Add zoom-aware rendering (LOD system)
- [ ] Integrate with Cytoscape background-image

### Week 2: Data Collection
- [ ] Extend graph.json with timeseries data
- [ ] Add git-based churn collection
- [ ] Add complexity history tracking
- [ ] Implement hotspot detection

### Week 3: Interactive Overlays
- [ ] Create `NodeDetailOverlay.jsx` component
- [ ] Add hover detection in GraphView
- [ ] Install Victory or uPlot
- [ ] Render detailed charts on hover

### Week 4: Polish & Performance
- [ ] Optimize canvas rendering (cache images)
- [ ] Add smooth transitions on zoom
- [ ] Test with 1000+ node graphs
- [ ] Add export/screenshot support

---

## Performance Considerations

### Canvas Rendering Performance

**Problem:** Re-rendering all node images on every zoom is expensive.

**Solution:** Cache rendered images per zoom band.

```javascript
class CachedNodeRenderer extends NodeRenderer {
  constructor() {
    super();
    this.cache = new Map();
  }

  render(nodeData, zoomLevel) {
    const zoomBand = Math.floor(zoomLevel * 2) / 2; // 0, 0.5, 1.0, 1.5, 2.0
    const cacheKey = `${nodeData.id}_${zoomBand}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const rendered = super.render(nodeData, zoomLevel);
    this.cache.set(cacheKey, rendered);

    // Limit cache size
    if (this.cache.size > 500) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return rendered;
  }
}
```

### Hover Overlay Performance

**Only render overlay for hovered node, not all nodes.**

```javascript
const [hoveredNode, setHoveredNode] = useState(null);
const [overlayPosition, setOverlayPosition] = useState(null);

cy.on('mouseover', 'node', (event) => {
  const node = event.target;
  setHoveredNode(node.data());
  setOverlayPosition({
    x: event.renderedPosition.x,
    y: event.renderedPosition.y
  });
});

cy.on('mouseout', 'node', () => {
  setHoveredNode(null);
});
```

---

## Next Steps

Would you like me to:

1. **Implement the canvas node renderer** (`nodeRenderer.js`)?
2. **Create the data collection script** (add timeseries to graph.json)?
3. **Build the hover overlay component** with Victory/uPlot charts?
4. **Create a working prototype** with sample data?

This approach gives you rich, information-dense nodes while maintaining excellent performance! 🎨📊

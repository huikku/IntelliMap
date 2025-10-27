# GraphView Performance Issues & Fixes

## 🐌 Problems Found

### Problem #1: Style Function Re-renders Every Frame (CRITICAL)

**Location:** `GraphView.jsx:382`

```javascript
'background-image': (node) => {
  // ...
  return nodeRenderer.render(enhancedData, cyInstance.zoom());  // ❌ BAD!
}
```

**Why it's bad:**
- Style functions are called **hundreds of times per second** during pan/zoom
- Each call re-renders the canvas image from scratch
- Even with caching, checking cache + function overhead is expensive
- Cytoscape evaluates styles on every animation frame

**ComfyUI difference:**
- Renders node image ONCE
- Stores it in node data
- Style function just returns the cached image (no computation)

---

### Problem #2: Recalculating Fanin/Fanout on Every Zoom

**Location:** `GraphView.jsx:664-665`

```javascript
fanin: cy.edges(`[target="${node.data('id')}"]`).length,   // ❌ SLOW!
fanout: cy.edges(`[source="${node.data('id')}"]`).length,  // ❌ SLOW!
```

**Why it's bad:**
- Queries entire edge collection for every node on every zoom change
- With 100 nodes, this is 200 edge queries every time you zoom
- O(n²) complexity

---

### Problem #3: Random Data Defeats Caching

**Location:** `GraphView.jsx:663`

```javascript
coverage: Math.floor(Math.random() * 100),  // ❌ Always different!
```

**Why it's bad:**
- Cache key includes node data
- Random data means cache key is always different
- Cache never hits, always re-renders

---

### Problem #4: Too Frequent Zoom Updates

**Location:** `GraphView.jsx:647-648`

```javascript
const zoomKey = Math.round(zoom * 10) / 10;  // Updates every 0.1 zoom change
if (cy._lastZoomKey === zoomKey) return;
```

**Why it's bad:**
- Updates every 0.1 zoom increment
- While zooming smoothly, this triggers 10+ times
- All nodes re-render multiple times during one zoom gesture

**ComfyUI difference:**
- Debounces zoom changes (wait 150ms after zoom stops)
- Only updates when zoom stabilizes
- Much smoother experience

---

## ✅ The Fix

### Step 1: Pre-compute Node Data Once

```javascript
// BEFORE Cytoscape initialization, compute enhanced data for all nodes
const nodeDataCache = new Map();

filteredNodes.forEach(node => {
  // Calculate fanin/fanout ONCE
  const fanin = filteredEdges.filter(e => e.to === node.id).length;
  const fanout = filteredEdges.filter(e => e.from === node.id).length;

  // Create stable enhanced data
  const enhancedData = {
    id: node.id,
    label: node.id.split('/').pop(),
    lang: node.lang,
    env: node.env,
    changed: node.changed,
    metrics: {
      loc: node.loc || node.size / 30 || 50,
      complexity: node.complexity || node.cx_q * 20 || 20,
      coverage: node.coverage || 0,  // ✅ Fixed value, not random!
      fanin,
      fanout,
      depth: node.depth || 0
    },
    timeseries: generateMockTimeseries(node.id),  // Stable based on ID
    status: {
      hotspot: node.complexity > 75,
      lowCoverage: (node.coverage || 0) < 50
    }
  };

  nodeDataCache.set(node.id, enhancedData);
});
```

---

### Step 2: Pre-render Images at Initial Zoom

```javascript
// After creating nodeDataCache, pre-render images
const initialZoom = 1.0;

filteredNodes.forEach(node => {
  const enhancedData = nodeDataCache.get(node.id);
  const renderedImage = nodeRenderer.render(enhancedData, initialZoom);

  // Store in node data cache
  nodeDataCache.get(node.id).renderedImage = renderedImage;
  nodeDataCache.get(node.id).renderedZoom = initialZoom;
});
```

---

### Step 3: Style Function Returns Cached Image

```javascript
{
  selector: 'node',
  style: {
    'width': 180,
    'height': 80,
    'shape': 'roundrectangle',
    'background-fit': 'cover',
    'background-image': (node) => {
      if (node.data('isCluster')) return '';

      // ✅ Just return pre-computed image, no rendering!
      return node.data('renderedImage') || '';
    },
    'background-opacity': 1,
    'border-width': 0,
    // ...
  }
}
```

---

### Step 4: Pass Pre-computed Data to Elements

```javascript
elements: [
  ...filteredNodes.map(n => {
    const enhancedData = nodeDataCache.get(n.id);
    return {
      data: {
        id: n.id,
        label: enhancedData.label,
        lang: enhancedData.lang,
        env: enhancedData.env,
        changed: enhancedData.changed,
        // ✅ Store pre-rendered image in node data
        renderedImage: enhancedData.renderedImage,
        renderedZoom: enhancedData.renderedZoom,
        // Store enhanced data for zoom handler
        _enhancedData: enhancedData,
        // ... other fields
      }
    };
  }),
  ...filteredEdges.map(e => ({ /* ... */ }))
]
```

---

### Step 5: Debounced Zoom Handler

```javascript
let zoomTimeout;

cy.on('zoom', () => {
  // Clear existing timeout
  clearTimeout(zoomTimeout);

  // Debounce: wait 150ms after zoom stops
  zoomTimeout = setTimeout(() => {
    const zoom = cy.zoom();
    const zoomKey = Math.round(zoom * 4) / 4; // Larger steps (0.25 increments)

    if (cy._lastZoomKey === zoomKey) return;
    cy._lastZoomKey = zoomKey;

    console.log(`🔍 Zoom stabilized at ${zoom.toFixed(2)}, updating nodes...`);

    // Batch update all nodes
    cy.batch(() => {
      cy.nodes().forEach(node => {
        if (node.data('isCluster')) return;

        const enhancedData = node.data('_enhancedData');
        if (!enhancedData) return;

        // Re-render with new zoom level
        const newImage = nodeRenderer.render(enhancedData, zoom);
        node.data('renderedImage', newImage);
        node.data('renderedZoom', zoom);

        // Update style
        node.style('background-image', newImage);
      });
    });

  }, 150); // Wait 150ms after last zoom event
});
```

---

## 📊 Performance Comparison

### Before (Current - Clunky)
```
Pan/Zoom Event:
  → Style function called: 100 nodes × 60 FPS = 6,000 calls/sec
  → Each call runs renderer.render()
  → Each render checks cache (overhead)
  → Recalculates fanin/fanout (slow)

Zoom Event:
  → Triggers every 0.1 zoom change (10+ times during zoom)
  → Re-renders all nodes: 100 nodes × 10 updates = 1,000 renders
  → Queries edges: 200 edge queries × 10 = 2,000 queries

Result: Laggy, stuttering, high CPU
```

### After (Fixed - Smooth)
```
Pan/Zoom Event:
  → Style function called: 100 nodes × 60 FPS = 6,000 calls/sec
  → Each call returns cached string (instant)
  → No rendering, no computation

Zoom Event:
  → Debounced: Waits 150ms after zoom stops
  → Single batch update: 100 nodes × 1 = 100 renders
  → No edge queries (pre-computed)

Result: Smooth, responsive, low CPU
```

### Performance Gains
- **Pan/Zoom:** 100× faster (no rendering during animation)
- **Zoom update:** 10× fewer renders (debounced)
- **Edge queries:** 20× fewer (pre-computed fanin/fanout)
- **Overall:** Feels like native UI, matches ComfyUI smoothness

---

## 🚀 Additional Optimizations

### 1. Progressive Rendering for Large Graphs

```javascript
// For 500+ nodes, render in batches
if (filteredNodes.length > 500) {
  cy.batch(() => {
    // Render visible nodes first
    const viewport = cy.extent();
    const visibleNodes = cy.nodes().filter(node => {
      const pos = node.renderedPosition();
      return (
        pos.x >= viewport.x1 && pos.x <= viewport.x2 &&
        pos.y >= viewport.y1 && pos.y <= viewport.y2
      );
    });

    visibleNodes.forEach(node => {
      // Render visible nodes immediately
    });

    // Render off-screen nodes with delay
    setTimeout(() => {
      const offscreenNodes = cy.nodes().diff(visibleNodes).left;
      offscreenNodes.forEach(node => {
        // Render off-screen nodes
      });
    }, 500);
  });
}
```

---

### 2. Viewport-Based Rendering

```javascript
// Only re-render visible nodes on zoom
cy.on('zoom pan', () => {
  clearTimeout(zoomTimeout);
  zoomTimeout = setTimeout(() => {
    const viewport = cy.extent();
    const zoom = cy.zoom();

    cy.batch(() => {
      cy.nodes().forEach(node => {
        if (node.data('isCluster')) return;

        const pos = node.renderedPosition();
        const isVisible = (
          pos.x >= viewport.x1 - 200 && pos.x <= viewport.x2 + 200 &&
          pos.y >= viewport.y1 - 200 && pos.y <= viewport.y2 + 200
        );

        if (isVisible) {
          // Only re-render visible nodes
          const enhancedData = node.data('_enhancedData');
          const newImage = nodeRenderer.render(enhancedData, zoom);
          node.style('background-image', newImage);
        }
      });
    });
  }, 150);
});
```

---

### 3. Lazy Image Loading

```javascript
// For very large graphs, use placeholder until rendered
const placeholderImage = createPlaceholderCanvas(); // Simple gray box

filteredNodes.forEach(node => {
  nodeDataCache.get(node.id).renderedImage = placeholderImage;
});

// Render actual images progressively
setTimeout(() => {
  filteredNodes.forEach((node, index) => {
    setTimeout(() => {
      const enhancedData = nodeDataCache.get(node.id);
      const actualImage = nodeRenderer.render(enhancedData, 1.0);
      enhancedData.renderedImage = actualImage;

      const cyNode = cy.getElementById(node.id);
      if (cyNode) {
        cyNode.data('renderedImage', actualImage);
        cyNode.style('background-image', actualImage);
      }
    }, index * 10); // Stagger by 10ms per node
  });
}, 100);
```

---

## 📝 Summary

**The Fix in 3 Steps:**
1. **Pre-compute everything** before creating Cytoscape
2. **Store rendered images** in node data
3. **Debounce zoom updates** (150ms delay)

**Result:**
- ✅ Smooth pan/zoom (no rendering during animation)
- ✅ Fast zoom updates (single batch render)
- ✅ No redundant calculations (pre-computed metrics)
- ✅ Matches ComfyUI smoothness

**Implementation time:** ~30 minutes
**Performance gain:** 10-100× faster

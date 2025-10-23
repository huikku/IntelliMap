Here are **five layout algorithms** you can plug directly into your React + Cytoscape + Vite + Tailwind app to give users layout options for visualizing large codebase graphs. Each has a distinct visual logic, computational profile, and tuning parameters.

---

## 🧠 1. **Dagre (Hierarchical Layout)**

**Use when:** You want a clear *top-to-bottom dependency tree* — e.g., module import hierarchies.

**Plugin:** [`cytoscape-dagre`](https://github.com/cytoscape/cytoscape.js-dagre)

**Code:**

```ts
const dagreLayout = {
  name: 'dagre',
  rankDir: 'LR', // or 'TB' for vertical
  nodeSep: 80,
  edgeSep: 50,
  rankSep: 150,
  padding: 10
};
```

**Strengths:** Directional clarity, good for dependency trees.
**Weakness:** Requires near-DAG; circular dependencies make it jittery.

---

## 🌐 2. **COSE / fcose (Force-Directed with Constraints)**

**Use when:** You want a “natural” physics layout but with less chaos.

**Plugin:** [`cytoscape-fcose`](https://github.com/iVis-at-Bilkent/cytoscape.js-fcose)

**Code:**

```ts
const fcoseLayout = {
  name: 'fcose',
  quality: 'default',
  randomize: true,
  animate: false,
  nodeSeparation: 80,
  idealEdgeLength: 100,
  gravity: 0.25,
  nodeRepulsion: 4500,
  nestingFactor: 0.8,
  packComponents: true
};
```

**Strengths:** Organic layout, self-organizing clusters.
**Weakness:** No semantic hierarchy; heavy for 1k+ nodes.

---

## 🌀 3. **euler (Physics Simulation)**

**Use when:** You want dynamic rearrangement / drag stability.

**Plugin:** [`cytoscape-euler`](https://github.com/cytoscape/cytoscape.js-euler)

**Code:**

```ts
const eulerLayout = {
  name: 'euler',
  springLength: 80,
  springCoeff: 0.0008,
  mass: node => 2 + node.degree(false),
  gravity: -1.2,
  pull: 0.002,
  timeStep: 10,
  refresh: 20
};
```

**Strengths:** Smooth physics, stable clusters.
**Weakness:** Still purely force-based — messy for big graphs.

---

## 🌙 4. **ELK (Eclipse Layout Kernel)**

**Use when:** You want *professional graph layout* similar to Graphviz.

**Plugin:** [`cytoscape-elk`](https://github.com/cytoscape/cytoscape.js-elk)

**Code:**

```ts
const elkLayout = {
  name: 'elk',
  elk: {
    algorithm: 'layered', // 'radial', 'mrtree', etc.
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': 80,
    'elk.layered.spacing.nodeNodeBetweenLayers': 120
  },
  fit: true,
  padding: 20
};
```

**Strengths:** Clean, production-quality layout.
**Weakness:** Slightly slower; async compute.

---

## 🔮 5. **Spread / Cola (Cluster Aware)**

**Use when:** You want *semantic grouping* (e.g., files within folders).

**Plugin:** [`cytoscape-cola`](https://github.com/cytoscape/cytoscape.js-cola)

**Code:**

```ts
const colaLayout = {
  name: 'cola',
  animate: false,
  nodeSpacing: 50,
  edgeLengthVal: 100,
  flow: { axis: 'x', minSeparation: 60 },
  clustering: true,
  randomize: false
};
```

**Strengths:** Combines physics with flow direction, good for modular codebases.
**Weakness:** Sometimes over-compresses clusters.

---

## 🧩 Implementation Suggestion (React)

Add a layout picker dropdown in your header:

```tsx
<Dropdown
  title="Layout"
  items={['dagre', 'fcose', 'euler', 'elk', 'cola']}
  onChange={layout => cy.layout(layoutOptions[layout]).run()}
/>
```

Where `layoutOptions` maps to the configs above.

---

## 🔧 Optional Enhancements

* Auto-select layout by repo size:

  * `< 200 nodes → euler`
  * `200–1000 → fcose`
  * `>1000 → elk (layered)`
* Cache positions per layout type (`cy.json()` snapshot).
* Offer “cluster collapse” toggle using directory names.

---

Would you like me to give you a compact **kablUI block** version of the layout selector UI (to drop into your IntelliMap header)?

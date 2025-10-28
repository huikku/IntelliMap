# How to Test React Flow Migration 🚀

## Quick Start (30 seconds)

1. **Open your browser:** http://localhost:5173/
2. **Look for the toggle button** in the top-right header (says "CYTOSCAPE")
3. **Click the button** → It changes to "REACT FLOW" and turns purple
4. **The graph re-renders** with React Flow instead of Cytoscape

That's it! You're now viewing React Flow.

---

## What to Look For

### ✅ Visual Quality Comparison

**Zoom Out (0.2x - 0.4x)**
- Can you read the title bars?
- Is the text crisp or blurry?
- Are the color gradients smooth?

**Normal Zoom (1x)**
- How does the overall appearance compare?
- Are nodes well-defined?
- Do edges look clean?

**Zoom In (2x - 3x)**
- Is the text sharp or pixelated?
- Do gradients look smooth?
- Overall quality impression?

### ✅ Performance Comparison

**Pan/Zoom Smoothness:**
- Cytoscape: Does it stutter or lag?
- React Flow: Is it smooth 60fps?

**Initial Load:**
- How long does layout calculation take?
- Any visible delays?

**Node Selection:**
- Click different nodes
- Is the response instant?

### ✅ Features to Test

**Working Now:**
- ✅ Node display (title, icon, badges)
- ✅ Metrics display (LOC, complexity, fanin, fanout)
- ✅ Node selection (click to select)
- ✅ Inspector panel integration
- ✅ MiniMap (bottom-right)
- ✅ Zoom controls (bottom-left)
- ✅ Pan (click and drag)
- ✅ Zoom (mouse wheel)

**Not Working Yet (Expected):**
- ⏳ Filters (language/env don't affect React Flow)
- ⏳ Search (doesn't highlight React Flow nodes)
- ⏳ Sparklines (just text metrics for now)
- ⏳ Progress bars (just text percentages)
- ⏳ Zoom-based LOD (same info at all zooms)

---

## Step-by-Step Testing Guide

### Test 1: Basic Rendering
1. Switch to React Flow
2. Check: Do all nodes appear?
3. Check: Are edges connected correctly?
4. Check: Do colors make sense?
5. Check: Can you see the MiniMap?

**Expected:** All nodes visible with colored title bars

### Test 2: Zoom Quality
1. Zoom out to 0.2x (mouse wheel down)
2. Check: Can you still read file names?
3. Zoom in to 2.5x (mouse wheel up)
4. Check: Is text still crisp and sharp?
5. Compare to Cytoscape at same zoom levels

**Expected:** Text stays crisp at all zoom levels

### Test 3: Performance
1. Pan around the graph (click and drag)
2. Check: Is it smooth or laggy?
3. Zoom in and out rapidly
4. Check: Does it keep up or stutter?
5. Select different nodes rapidly
6. Check: Instant response?

**Expected:** 60fps smooth performance

### Test 4: Node Interaction
1. Click a node
2. Check: Does it highlight (blue border)?
3. Check: Does Inspector panel update?
4. Check: Correct data shown?
5. Click different nodes
6. Check: Selection updates properly?

**Expected:** Instant selection with visual feedback

### Test 5: Layout Comparison
1. Switch back to Cytoscape
2. Note the layout
3. Switch to React Flow
4. Check: Is layout similar?
5. Check: Same general structure?

**Expected:** Similar layout (both use ELK)

---

## What to Report Back

### If It's Working Great
Tell me:
- "React Flow looks amazing!"
- "Text is crisp at all zoom levels"
- "Much smoother than Cytoscape"
- Screenshot comparison (optional but helpful)

### If You Find Issues
Tell me:
- Which browser (Chrome, Firefox, etc.)
- What action caused the issue
- Number of nodes in your graph
- Screenshot if possible
- Error messages from browser console (F12)

### Performance Observations
- How many nodes in your graph?
- Initial layout time? (fast/slow?)
- Pan/zoom smoothness? (smooth/laggy?)
- Any delays or stuttering?

---

## Common Issues & Fixes

### Issue: "Toggle button doesn't appear"
**Fix:** Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: "Nodes don't show up in React Flow"
**Fix:**
1. Open browser console (F12)
2. Look for errors
3. Report any red error messages

### Issue: "Layout looks weird"
**Fix:** Try changing layout in Toolbar:
- Click layout dropdown
- Try "ELK" or "Dagre"
- See which looks better

### Issue: "It's slow/laggy"
**Fix:**
- Report your node count
- We'll add performance optimizations in Week 3

### Issue: "Can't switch back to Cytoscape"
**Fix:** Click the purple "REACT FLOW" button again

---

## Browser Console Tips

### How to Open Console
- **Chrome/Edge:** Press F12 or Ctrl+Shift+J
- **Firefox:** Press F12 or Ctrl+Shift+K
- **Safari:** Cmd+Option+I

### What to Look For
- **Red errors:** Copy the full error message
- **Warnings:** Usually OK, but note any "React" warnings
- **Console logs:** Look for "🔍 Zoom..." or "✅ ..." messages

### Useful Console Commands
```javascript
// Check how many nodes React Flow is rendering
document.querySelectorAll('.code-node').length

// Check current zoom level
// (only works if you click in the graph area first)
```

---

## Comparison Checklist

Print this and fill it out:

### Visual Quality
| Zoom Level | Cytoscape | React Flow | Winner |
|------------|-----------|------------|--------|
| 0.2x (far) | □ Crisp □ Blurry | □ Crisp □ Blurry | □ Cyto □ React |
| 1.0x (normal) | □ Crisp □ Blurry | □ Crisp □ Blurry | □ Cyto □ React |
| 2.5x (close) | □ Crisp □ Blurry | □ Crisp □ Blurry | □ Cyto □ React |

### Performance
| Action | Cytoscape | React Flow | Winner |
|--------|-----------|------------|--------|
| Pan (drag) | □ Smooth □ Laggy | □ Smooth □ Laggy | □ Cyto □ React |
| Zoom (wheel) | □ Smooth □ Laggy | □ Smooth □ Laggy | □ Cyto □ React |
| Click node | □ Fast □ Slow | □ Fast □ Slow | □ Cyto □ React |

### Overall
| Aspect | Cytoscape | React Flow | Winner |
|--------|-----------|------------|--------|
| Appearance | 1-10: ___ | 1-10: ___ | □ Cyto □ React |
| Feel | 1-10: ___ | 1-10: ___ | □ Cyto □ React |
| Professionalism | 1-10: ___ | 1-10: ___ | □ Cyto □ React |

**Final Verdict:** □ Keep Cytoscape  □ Migrate to React Flow  □ Undecided

---

## Quick Feedback Template

Copy and paste this to give me feedback:

```
## React Flow Test Results

**Browser:** [Chrome/Firefox/Safari/Edge]
**Node Count:** [number]
**Edge Count:** [number]

**Visual Quality:** [Excellent/Good/OK/Poor]
- Zoom out: [Can read / Can't read]
- Zoom in: [Sharp / Pixelated]

**Performance:** [Excellent/Good/OK/Poor]
- Pan/Zoom: [Smooth / Laggy]
- Selection: [Instant / Delayed]

**Comparison to Cytoscape:**
- Better: [what's better?]
- Worse: [what's worse?]
- Same: [what's the same?]

**Issues Found:**
- [list any issues]

**Overall Impression:**
[your thoughts]

**Should we continue migration?** [YES/NO/MAYBE]
```

---

## Next Steps Based on Your Feedback

### If You Say "This is amazing, much better!"
→ I'll continue with Week 2 features (filtering, search)

### If You Say "Better, but..."
→ I'll fix the specific issues first

### If You Say "Not seeing much difference"
→ I'll add visual enhancements (sparklines, bars) to make it more obvious

### If You Say "It's worse"
→ We'll diagnose the issues and either fix or reconsider

---

## Remember

This is **Week 1, Day 1** progress. Many features aren't implemented yet:
- No sparklines
- No progress bars
- No zoom-based LOD
- Filters don't work yet
- Search doesn't work yet

**But the foundation is solid!**

The core question is: **Does the HTML/CSS rendering look and feel better than canvas rendering?**

That's what we're testing now. Everything else we can add later.

---

## Ready to Test?

1. Open http://localhost:5173/
2. Click the toggle button
3. Test the checklist above
4. Report back your findings

I'm waiting for your feedback! 🚀

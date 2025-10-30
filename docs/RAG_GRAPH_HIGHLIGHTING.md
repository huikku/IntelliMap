# RAG Graph Highlighting Feature

This document describes the RAG-powered graph highlighting feature that allows you to visually identify relevant files in your codebase based on AI-generated answers.

## Overview

When you ask questions in the RAG Chat, the AI not only provides answers but also cites the specific files it used. These citations are automatically highlighted in the graph visualization, making it easy to:

- **Identify refactoring targets** - "Which files should I refactor?"
- **Locate feature implementations** - "Where is authentication handled?"
- **Find related components** - "What files are involved in user management?"
- **Understand dependencies** - "Show me all files that import this module"

## How It Works

### 1. Ask a Question

In the **RAG Chat** tab (left sidebar):
1. Create a snapshot (if you haven't already)
2. Select a task type:
   - 💡 **Explain** - Understand how code works
   - ⚡ **Impact** - Analyze change impact
   - 🎯 **Triage** - Quick categorization (fast & free!)
   - 🔄 **Transform** - Get refactoring suggestions
3. Type your question and press Enter

### 2. View Citations

The AI response includes:
- **Answer text** - Natural language explanation
- **Citations** - List of files referenced (e.g., `src/auth/login.js:10-35`)
- **Metadata** - Model used, tokens, cost
- **Highlight button** - Toggle graph highlighting

### 3. Highlight Nodes

Click the **🔍 Highlight** button next to citations to:
- **Highlight cited files** - Nodes glow with teal border and shadow
- **Fade other nodes** - Non-cited nodes become 20% opacity
- **Focus attention** - Easily spot relevant files in large graphs

### 4. Clear Highlights

- Click **🔆 Clear** on any message to toggle off that message's highlights
- Click **🔆 Clear** in the chat header to clear all highlights
- Highlights automatically update when you ask a new question

## Visual Indicators

### Highlighted Nodes
- **Teal glow** - `drop-shadow(0 0 8px #5F9B8C)`
- **Thick border** - 3px teal border
- **Full opacity** - 100% visible
- **Elevated z-index** - Appears above other nodes

### Faded Nodes
- **Low opacity** - 20% visible
- **Normal styling** - No special effects
- **Background context** - Still visible but de-emphasized

## Example Use Cases

### 🔧 Refactoring
```
You: "Which files have high complexity and should be refactored?"

AI: "Based on the metrics, these files have high complexity:
     - src/utils/parser.js:1-500 (complexity: 85)
     - src/core/engine.js:1-800 (complexity: 92)
     
     Consider breaking these into smaller modules."

[Click 🔍 Highlight]
→ Graph highlights parser.js and engine.js with teal glow
```

### 🔍 Feature Location
```
You: "Where is user authentication implemented?"

AI: "User authentication is handled in:
     - src/auth/login.js:10-150
     - src/auth/session.js:20-80
     - src/middleware/auth.js:5-45"

[Click 🔍 Highlight]
→ Graph highlights all 3 auth-related files
```

### 📊 Dependency Analysis
```
You: "What files depend on the database module?"

AI: "The following files import the database module:
     - src/models/user.js:1-5
     - src/models/post.js:1-5
     - src/services/data.js:1-10"

[Click 🔍 Highlight]
→ Graph highlights all database consumers
```

### 🐛 Bug Investigation
```
You: "Which files handle error logging?"

AI: "Error logging is implemented in:
     - src/utils/logger.js:1-100
     - src/middleware/errorHandler.js:10-50
     - src/services/monitoring.js:20-60"

[Click 🔍 Highlight]
→ Graph highlights error handling infrastructure
```

## Technical Details

### Path Matching

The system uses smart path matching to handle different path formats:

```javascript
// All of these will match:
"src/auth/login.js"
"./src/auth/login.js"
"auth/login.js"
"/path/to/project/src/auth/login.js"
```

The matcher:
1. Normalizes paths (removes leading `./`)
2. Checks for exact matches
3. Checks if node path ends with citation path
4. Checks if citation path ends with node path

### Highlight State Management

```javascript
// State flow:
User asks question
  → RAG API returns citations
  → Extract file paths from citations
  → Update highlightedPaths state
  → ReactFlow updates node styles
  → Nodes with matching paths get 'rag-highlighted' class
  → Other nodes get 'rag-faded' class
```

### CSS Styling

```css
/* Highlighted nodes */
.react-flow__node.rag-highlighted {
  filter: drop-shadow(0 0 8px #5F9B8C) drop-shadow(0 0 16px #5F9B8C);
  z-index: 1000 !important;
}

/* Faded nodes */
.react-flow__node.rag-faded {
  opacity: 0.2 !important;
}

/* Enhanced border for highlighted nodes */
.react-flow__node.rag-highlighted .code-node {
  border-color: #5F9B8C !important;
  border-width: 3px !important;
  box-shadow: 0 0 12px rgba(95, 155, 140, 0.6) !important;
}
```

## Keyboard Shortcuts

- **Enter** - Send message
- **Shift+Enter** - New line in input
- **f** - Fit view (when graph is focused)

## Tips

1. **Use Triage for Quick Queries** - It's free and fast (uses Gemini 2.0 Flash via OpenRouter)
2. **Multiple Highlights** - You can toggle highlights from different messages to compare
3. **Combine with Search** - Use the search box to find specific nodes, then ask RAG for context
4. **Zoom In** - After highlighting, zoom in on highlighted nodes to see details
5. **Export Results** - Copy citations from the chat to document your findings

## Limitations

- **Path Matching** - May not match if file paths are significantly different
- **Large Graphs** - Highlighting many nodes (>50) may impact performance
- **Citation Accuracy** - Highlights are only as good as the RAG citations
- **No Partial Matches** - Currently only highlights exact file matches, not partial paths

## Future Enhancements

- [ ] Click citation to jump to file in graph
- [ ] Highlight connected edges between cited files
- [ ] Color-code highlights by citation type (primary/secondary)
- [ ] Animate highlight transitions
- [ ] Export highlighted subgraph
- [ ] Save highlight sets for later
- [ ] Highlight by line number ranges (zoom to specific functions)

## API Integration

The highlighting feature integrates with these RAG endpoints:

- **POST /api/v1/ask** - Returns answer with citations
- **POST /api/v1/pack** - Returns chunks without answer (also has citations)
- **POST /api/v1/search** - Returns similar chunks (can be used for highlighting)

Example response:
```json
{
  "answer": "Authentication is handled in...",
  "citations": [
    { "path": "src/auth/login.js", "start_line": 10, "end_line": 35 },
    { "path": "src/auth/session.js", "start_line": 20, "end_line": 80 }
  ],
  "metadata": {
    "model": "gpt-4-turbo",
    "tokensIn": 1500,
    "tokensOut": 300,
    "cost": 0.045
  }
}
```

## Troubleshooting

### Highlights Not Showing
- Check that citations are present in the response
- Verify file paths match graph node IDs
- Try clearing and re-applying highlights
- Check browser console for errors

### Wrong Nodes Highlighted
- Verify citation paths are correct
- Check for duplicate file names in different directories
- Use more specific paths in your questions

### Performance Issues
- Reduce number of highlighted nodes
- Clear highlights when not needed
- Use filters to reduce graph size before highlighting

## Related Features

- **Search Box** - Find nodes by name
- **Inspector** - View node details
- **Filters** - Filter by language, environment, changes
- **Navigation Modes** - Explore dependencies

## Feedback

This is a new feature! If you have suggestions or find issues, please:
1. Check the browser console for errors
2. Note the question asked and files highlighted
3. Report via GitHub issues or feedback channel


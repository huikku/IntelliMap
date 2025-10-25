# Runtime Analysis - Quick Start

**No tests required!** Just run your app and see what code actually executes.

---

## 🚀 How It Works

Runtime analysis captures **which code runs** when you use your application. This helps you:
- Find **dead code** (code that never executes)
- Identify **broken features** (code paths that should run but don't)
- See **hot paths** (frequently executed code)
- Understand **actual usage patterns**

---

## 📖 Two Ways to Capture Runtime Data

### Option 1: Using the `capture` Command (Easiest)

```bash
cd /path/to/your/repo

# Run your app with runtime capture
npx intellimap capture "npm start"

# Or for Node.js apps:
npx intellimap capture "node server.js"

# Or for Python apps:
npx intellimap capture "python app.py"
```

**What happens:**
1. Your app starts with V8 coverage enabled
2. Use your app normally (click around, test features, etc.)
3. Press `Ctrl+C` to stop
4. Coverage data is automatically converted to IntelliMap format
5. Open the UI and click "⚡ Runtime Analysis" to see results

---

### Option 2: Manual Capture (More Control)

```bash
cd /path/to/your/repo

# 1. Start your app with V8 coverage
NODE_V8_COVERAGE=.intellimap/v8-coverage npm start

# 2. Use your app (click around, test features)
# 3. Stop the app (Ctrl+C)

# 4. Convert V8 coverage to IntelliMap format
node /path/to/intellimap/packages/cli/runtime/enhanced-v8-converter.js \
  .intellimap/v8-coverage \
  .

# 5. View in UI
npm run serve
# Click "⚡ Runtime Analysis"
```

---

## 🎯 Example: Analyzing IntelliMap Itself

```bash
cd /home/john/IntelliMap

# Capture runtime data while running the server
npx intellimap capture "npm run serve"

# In another terminal, open http://localhost:7676
# Click around the UI, load graphs, change layouts, etc.

# Go back to the first terminal and press Ctrl+C

# Now refresh the browser and click "⚡ Runtime Analysis"
# You'll see which IntelliMap code actually ran!
```

---

## 🎯 Example: Analyzing Your Own App

```bash
cd /home/john/spark-intellishot

# Index the repository first (one-time)
npx intellimap index --entry src/main.tsx --node-entry server.cjs

# Capture runtime data
npx intellimap capture "npm start"

# Use your app for a bit, then Ctrl+C

# View results
npx intellimap serve
# Open http://localhost:7676
# Click "⚡ Runtime Analysis"
```

---

## 📊 What You'll See

The runtime analysis report shows:

### Coverage Metrics
- **Node Coverage**: % of files that executed
- **Edge Coverage**: % of imports that were used
- **Dead Code**: Files that never ran

### Dead Code Analysis
Lists all files that were indexed but never executed, grouped by directory:
```
packages/ui/src/components/ (11 files)
- GraphView.jsx
- Sidebar.jsx
...
```

### Repository Info
- **Repository**: Name of the repo being analyzed
- **Timestamp**: When the data was captured
- **Branch**: Git branch
- **Commit**: Git commit hash

---

## 🔍 Understanding the Results

### High Coverage (>80%)
✅ Most of your code is being used - good!

### Medium Coverage (40-80%)
⚠️ Some code isn't running. Could be:
- Unused features
- Error handling paths
- Edge cases not tested

### Low Coverage (<40%)
❌ Lots of dead code. Could be:
- Build artifacts (dist/, node_modules/)
- Config files
- Unused dependencies

---

## 💡 Tips

### 1. Capture Different Scenarios
Run multiple captures for different use cases:
```bash
# Scenario 1: Admin user
npx intellimap capture "npm start"
# Log in as admin, use admin features, Ctrl+C

# Scenario 2: Regular user
npx intellimap capture "npm start"
# Log in as regular user, use normal features, Ctrl+C
```

Each capture creates a new trace file. The UI shows the **latest** one.

### 2. Compare Static vs Runtime
- **Static graph** (from `intellimap index`): Shows all possible code paths
- **Runtime data** (from `intellimap capture`): Shows which paths actually ran

The difference reveals dead code!

### 3. Focus on Your Code
The analysis includes **all** code (including node_modules). To focus on your code:
- Look at the "Dead Code Analysis" section
- Ignore `node_modules/`, `dist/`, etc.
- Focus on your `src/`, `lib/`, `packages/` directories

---

## 🐛 Troubleshooting

### "No runtime data found"
You haven't captured any runtime data yet. Run:
```bash
npx intellimap capture "npm start"
```

### "Repository: IntelliMap" (but I'm analyzing a different repo)
The server is still pointing to IntelliMap. In the UI:
1. Click "📁 Open Repo"
2. Browse to your repo
3. Click "Index Repository"
4. Now click "⚡ Runtime Analysis"

### Coverage shows 0%
Your app might not be a Node.js app, or V8 coverage isn't working. Check:
- Is it a JavaScript/TypeScript app?
- Did the app actually start and run?
- Try the manual capture method to see error messages

---

## 🎓 Advanced: Multiple Repositories

IntelliMap can analyze multiple repositories. Each repo has its own:
- Static graph (`.intellimap/graph.json`)
- Runtime traces (`.intellimap/runtime/trace-*.json`)

To switch between repos in the UI:
1. Click "📁 Open Repo"
2. Browse to the repo
3. Click "Index Repository"
4. Click "⚡ Runtime Analysis"

The server tracks which repo you're currently viewing and loads the correct data.

---

## 📚 Next Steps

- **Integrate with CI**: Run `intellimap capture` in your CI pipeline to track coverage over time
- **Find broken features**: Look for code that should run but doesn't
- **Remove dead code**: Delete files with 0% coverage (after verifying they're truly unused)
- **Optimize hot paths**: Focus performance improvements on frequently executed code


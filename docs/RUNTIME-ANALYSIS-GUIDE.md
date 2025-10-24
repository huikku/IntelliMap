# Runtime Analysis Guide

**Analyze what code actually executes when you run your app!**

Unlike test coverage (which shows what code is executed during tests), runtime analysis shows what code executes when you **actually use your application**.

---

## 🎯 What is Runtime Analysis?

Runtime analysis captures execution data from your **running application** to help you:

1. **Find Dead Code** - Code that's never executed in real usage
2. **Detect Broken Features** - Features that throw errors at runtime
3. **Identify Performance Bottlenecks** - Slow code paths
4. **Understand Usage Patterns** - Which features are actually used

## 🚀 Quick Start

### 1. Index Your Codebase

First, create a static dependency graph:

```bash
npm run index -- --entry src/index.js
```

### 2. Run Your App with Analysis

Run your app normally, but with runtime tracking enabled:

```bash
npm run run -- "npm start"
# or
npm run run -- "node server.js"
# or
npm run run -- "npm run dev"
```

### 3. Use Your App

**This is the key step!** Actually use your application:
- Click around the UI
- Call API endpoints
- Exercise different features
- Try different user flows

The more you use, the better the analysis!

### 4. Stop and Generate Report

Press **Ctrl+C** to stop the app. IntelliMap will automatically:
- Process the runtime coverage data
- Merge it with the static graph
- Generate a runtime analysis report

### 5. View Results

```bash
npm run serve
# Open http://localhost:7676
# Click "⚡ Runtime Analysis"
```

---

## 📊 What You'll See

### Coverage Metrics
- **Node Coverage**: % of files that were executed
- **Edge Coverage**: % of imports that were used
- **Dead Code**: Files that were never executed

### Execution Data
- Which files were executed
- How many times each file was loaded
- Which imports were actually used

### Dead Code Detection
- Files that exist but were never executed
- Imports that were never used
- Features that might be broken or unused

---

## 💡 Use Cases

### 1. Find Unused Features

Run your app through typical usage scenarios, then check the runtime analysis:

```bash
# Start your app with tracking
npm run run -- "npm start"

# Use your app normally for 5-10 minutes
# Click through all the main features

# Stop with Ctrl+C
# View the report to see what wasn't executed
```

**Dead code = potentially unused features you can remove!**

### 2. Verify New Features Work

After adding a new feature:

```bash
# Run with tracking
npm run run -- "npm start"

# Test the new feature thoroughly
# Try all the new code paths

# Stop and check coverage
# Make sure the new code shows as executed
```

**If the new code shows 0% coverage, it might be broken!**

### 3. Find Performance Issues

The runtime analysis shows which modules are loaded:

```bash
# Run your app
npm run run -- "npm start"

# Use the slow feature
# Stop and check the report

# Look for:
# - Modules that shouldn't be loaded
# - Unexpected dependencies
# - Large files being imported
```

### 4. Compare Different Usage Patterns

Run multiple sessions to compare:

```bash
# Session 1: Admin user
npm run run -- "npm start"
# Use admin features, then Ctrl+C

# Session 2: Regular user  
npm run run -- "npm start"
# Use regular features, then Ctrl+C

# Compare the two reports to see differences
```

---

## 🔧 How It Works

### V8 Coverage

IntelliMap uses Node.js's built-in V8 coverage engine:

1. **No Code Modification** - Your code runs unchanged
2. **Native Performance** - V8 tracks execution natively
3. **Accurate Data** - Captures actual runtime behavior

### The Process

```
Your App (with NODE_V8_COVERAGE)
    ↓
V8 Coverage Data (.intellimap/v8-coverage/)
    ↓
IntelliMap Converter
    ↓
Runtime Trace (.intellimap/runtime/trace-*.json)
    ↓
Merged with Static Graph
    ↓
Runtime Analysis Report
```

---

## 📝 Examples

### Example 1: Express API

```bash
# Index the API
npm run index -- --entry server.js

# Run with tracking
npm run run -- "node server.js"

# In another terminal, call your endpoints:
curl http://localhost:3000/api/users
curl http://localhost:3000/api/products
curl http://localhost:3000/api/orders

# Stop the server (Ctrl+C)
# View the report - see which routes were hit!
```

### Example 2: React App

```bash
# Index the app
npm run index -- --entry src/index.jsx

# Run with tracking
npm run run -- "npm start"

# Use the app in your browser:
# - Click through all pages
# - Try all features
# - Fill out forms
# - Test error cases

# Stop (Ctrl+C)
# View the report - see which components were rendered!
```

### Example 3: CLI Tool

```bash
# Index the CLI
npm run index -- --entry bin/cli.js

# Run with tracking
npm run run -- "node bin/cli.js --help"
npm run run -- "node bin/cli.js process file.txt"
npm run run -- "node bin/cli.js analyze data.json"

# Each run adds to the coverage data
# View the report - see which commands were used!
```

---

## 🎓 Best Practices

### 1. Exercise All Features

The more you use your app, the better the analysis:
- ✅ Click every button
- ✅ Visit every page
- ✅ Try every API endpoint
- ✅ Test error cases
- ✅ Use different user roles

### 2. Run Multiple Sessions

Different usage patterns reveal different insights:
- Session 1: Happy path (everything works)
- Session 2: Error cases (trigger errors)
- Session 3: Edge cases (unusual inputs)

### 3. Compare Before/After

Run analysis before and after changes:
- Before: Baseline coverage
- Make changes
- After: New coverage
- Compare: What changed?

### 4. Automate Common Flows

Create scripts to exercise your app:

```bash
#!/bin/bash
# test-flow.sh

# Start app with tracking
npm run run -- "npm start" &
APP_PID=$!

# Wait for app to start
sleep 5

# Exercise the app
curl http://localhost:3000/
curl http://localhost:3000/users
curl http://localhost:3000/products

# Stop the app
kill $APP_PID
```

---

## 🆚 Runtime Analysis vs Test Coverage

| Feature | Test Coverage | Runtime Analysis |
|---------|--------------|------------------|
| **What it measures** | Code executed during tests | Code executed during actual usage |
| **When to use** | Development, CI/CD | Production-like scenarios |
| **Best for** | Finding untested code | Finding unused features |
| **Requires** | Test suite | Running application |
| **Coverage type** | Theoretical (what could work) | Actual (what does work) |

**Use both!**
- Test coverage: Ensure code is tested
- Runtime analysis: Ensure code is used

---

## 🐛 Troubleshooting

### No coverage data generated

**Problem**: Report shows 0% coverage

**Solutions**:
1. Make sure you actually used the app before stopping
2. Check that `.intellimap/v8-coverage/` has files
3. Verify your app actually started and ran

### Coverage files but no data

**Problem**: Coverage files exist but show no execution

**Solutions**:
1. Make sure you're running a Node.js app (V8 coverage only works with Node.js)
2. Check that the app didn't crash immediately
3. Verify the command is correct

### Missing files in report

**Problem**: Some files don't appear in the report

**Solutions**:
1. Make sure you indexed the codebase first (`npm run index`)
2. Check that the files are actually imported by your app
3. Verify the entry point is correct

---

## 🚀 Next Steps

1. **Try the demo**: Run `test-app/demo.sh` to see it in action
2. **Analyze your app**: Use runtime analysis on your own project
3. **Find dead code**: Look for 0% coverage files
4. **Optimize**: Remove unused code, fix broken features

Happy analyzing! 🎉


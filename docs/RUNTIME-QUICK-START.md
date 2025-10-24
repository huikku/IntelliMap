# Runtime Analysis - Quick Start

Get **real** test coverage data in 3 commands!

---

## 🚀 The 3-Command Workflow

### Command 1: Setup (One-Time)
```bash
npm run runtime:setup
```

**What it does:**
```
🚀 IntelliMap Runtime Analysis Setup

✅ Installing NYC and c8 for JavaScript/TypeScript
✅ Creating Python virtual environment (.venv-intellimap)
✅ Installing coverage.py in venv
✅ Creating configuration files:
   - .nycrc.json
   - .c8rc.json
   - .coveragerc
✅ Updating .gitignore

✅ Setup complete!
```

**Time:** ~30 seconds  
**Run:** Once per project

---

### Command 2: Collect Coverage
```bash
npm run runtime:collect
```

**What it does:**
```
🚀 IntelliMap Runtime Coverage Collection

🔍 Detecting test framework...
   ✅ Detected: Jest (or Mocha, Vitest, pytest, etc.)

📊 Running JavaScript/TypeScript coverage...
   $ npx jest --coverage
   ✅ All tests passed
   ✅ Coverage data generated

🔄 Converting coverage data to IntelliMap format...
   ✅ Converted NYC coverage to IntelliMap trace!
   📁 Saved to: .intellimap/runtime/trace-1234567890.json
   📊 Stats:
      - Nodes with coverage: 42
      - Edges executed: 38
      - Branch: main
      - Commit: abc123

✅ Coverage collection complete!
```

**Time:** Depends on your test suite  
**Run:** After every code change

---

### Command 3: View Results
```bash
npm run serve
```

Then:
1. Open http://localhost:7676
2. Click **📊 Analysis** tab (left sidebar)
3. Click **⚡ Runtime Analysis** button
4. See your **real** coverage data!

---

## ⚡ Even Faster: One Command

```bash
npm run runtime:all
```

This runs all 3 steps:
1. Setup (if needed)
2. Collect coverage
3. Convert to IntelliMap format

Then just:
```bash
npm run serve
# Click "⚡ Runtime Analysis"
```

---

## 📊 What You'll See

### Coverage Metrics
```
## Coverage Metrics

### Edge Coverage
- Total Static Edges: 50
- Executed Edges: 38
- Coverage: 76.0%
- Dead Edges: 12
- Runtime-Only Edges: 2

### Node Coverage
- Total Nodes: 45
- Executed Nodes: 42
- Coverage: 93.3%
- Dead Nodes: 3
```

### Performance Hotspots
```
## Performance Hotspots

Performance Concentration: 85.2% of time in top 10 modules

### Top 10 Slowest Modules

1. src/app.js
   - Total Time: 1250.50ms
   - Executions: 450
   - Avg Time: 2.78ms

2. src/utils.js
   - Total Time: 890.25ms
   - Executions: 320
   - Avg Time: 2.78ms
...
```

### Dead Code Analysis
```
## Dead Code Analysis

Dead Code Ratio: 6.7%

### Unexecuted Modules (3)

src/legacy/ (2 files)
- src/legacy/old-feature.js
- src/legacy/deprecated.js

config/ (1 files)
- config/unused-config.js
```

---

## 🎯 Real vs Sample Data

| Feature | Sample Data | Real Data |
|---------|-------------|-----------|
| **Command** | `npm run generate-trace` | `npm run runtime:collect` |
| **Source** | Random simulation | Actual test execution |
| **Coverage** | ~70% (random) | Your actual test coverage |
| **Accuracy** | Demo only | Production-ready |
| **Use Case** | Testing the UI | Real analysis |

**Always use `runtime:collect` for real analysis!**

---

## 🔄 Typical Workflow

### Day 1: Initial Setup
```bash
npm run runtime:setup
npm run runtime:collect
npm run serve
# Click "⚡ Runtime Analysis"
# Review coverage, identify gaps
```

### Day 2: After Adding Tests
```bash
npm run runtime:collect
npm run serve
# Click "⚡ Runtime Analysis"
# See improved coverage!
```

### Day 3: Before Committing
```bash
npm run runtime:collect
npm run serve
# Click "⚡ Runtime Analysis"
# Verify all new code is tested
```

---

## 🛠️ Supported Frameworks

### JavaScript/TypeScript
- ✅ Jest
- ✅ Mocha
- ✅ Vitest
- ✅ AVA
- ✅ Any framework with `npm test`

### Python
- ✅ pytest
- ✅ unittest
- ✅ nose2

**Auto-detected!** No configuration needed.

---

## 💡 Pro Tips

### 1. Run Before Every Commit
```bash
# Add to your pre-commit hook
npm run runtime:collect
```

### 2. Track Coverage Over Time
```bash
# Coverage data includes git metadata
git checkout main
npm run runtime:collect  # Baseline

git checkout feature/new-feature
npm run runtime:collect  # Compare
```

### 3. CI/CD Integration
```yaml
# .github/workflows/coverage.yml
- run: npm run runtime:setup
- run: npm run runtime:collect
- uses: actions/upload-artifact@v3
  with:
    name: runtime-trace
    path: .intellimap/runtime/
```

### 4. Focus on Dead Code
```bash
npm run runtime:collect
npm run serve
# Click "⚡ Runtime Analysis"
# Scroll to "Dead Code Analysis"
# Delete unused files!
```

---

## 🐛 Troubleshooting

### "No test framework detected"
**Fix:** Add a test script to `package.json`:
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

### "No coverage data found"
**Fix:** Make sure tests run successfully:
```bash
npm test  # Should pass
```

### "Virtual environment not found"
**Fix:** Run setup first:
```bash
npm run runtime:setup
```

---

## 📚 More Information

- **Full Guide:** `docs/AUTOMATED-RUNTIME-ANALYSIS.md`
- **Manual Setup:** `docs/REAL-RUNTIME-DATA-GUIDE.md`
- **API Details:** `docs/runtime-analysis-guide.md`

---

## ✅ Summary

**3 commands to real coverage:**

```bash
npm run runtime:setup    # One-time
npm run runtime:collect  # After changes
npm run serve            # View results
```

**Or just:**

```bash
npm run runtime:all && npm run serve
```

That's it! 🎉


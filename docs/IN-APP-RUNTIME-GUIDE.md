# In-App Runtime Analysis Guide

**Run everything from the browser - no terminal commands needed!**

---

## 🎯 Overview

Runtime analysis is now **fully integrated** into the IntelliMap UI. You can:
- ✅ Setup coverage tools with one click
- ✅ Collect coverage data from your tests
- ✅ View analysis reports
- ✅ Track progress in real-time

**No terminal commands required!**

---

## 🚀 Quick Start (3 Clicks)

### Step 1: Open the Analysis Tab

1. Start IntelliMap: `npm run serve`
2. Open http://localhost:7676
3. Click **📊 Analysis** tab in the left sidebar

You'll see the **Runtime Analysis** section with three buttons:

```
┌─────────────────────────────────────┐
│ RUNTIME ANALYSIS                    │
├─────────────────────────────────────┤
│ 🔧 Setup Runtime                    │
│ 📊 Collect Coverage                 │
│ ⚡ View Analysis                    │
└─────────────────────────────────────┘
```

---

### Step 2: Setup (One-Time)

Click **🔧 Setup Runtime**

**What happens:**
```
⏳ Setting up...

🚀 IntelliMap Runtime Analysis Setup
✅ Installing NYC and c8 for JavaScript/TypeScript
✅ Creating Python virtual environment (.venv-intellimap)
✅ Installing coverage.py in venv
✅ Creating configuration files
✅ Updating .gitignore

✅ Setup complete! Ready to collect coverage.
```

**Time:** ~30 seconds  
**Run:** Once per project

The button will show:
- `⏳ Setting up...` while running
- Green success message when complete
- Red error message if something fails

---

### Step 3: Collect Coverage

Click **📊 Collect Coverage**

**What happens:**
```
⏳ Collecting...

🚀 IntelliMap Runtime Coverage Collection
🔍 Detecting test framework...
   ✅ Detected: Jest

📊 Running JavaScript/TypeScript coverage...
   $ npx jest --coverage
   ✅ All tests passed
   ✅ Coverage data generated

🔄 Converting coverage data to IntelliMap format...
   ✅ Converted to IntelliMap trace!
   📁 Saved to: .intellimap/runtime/trace-1234567890.json

✅ Coverage collected! Click "View Analysis" to see results.
```

**Time:** Depends on your test suite  
**Run:** After every code change

The button will show:
- `⏳ Collecting...` while running
- Green success message when complete
- Red error message if tests fail

---

### Step 4: View Results

Click **⚡ View Analysis**

**What you see:**
```
# Runtime Analysis Report

## Run Information
- Timestamp: 10/24/2025, 2:30:45 PM
- Branch: main
- Commit: abc123
- Run ID: coverage-1234567890

## Coverage Metrics

### Edge Coverage
- Total Static Edges: 50
- Executed Edges: 42
- Coverage: 84.0%
- Dead Edges: 8

### Node Coverage
- Total Nodes: 45
- Executed Nodes: 43
- Coverage: 95.6%
- Dead Nodes: 2

## Performance Hotspots
...

## Dead Code Analysis
...

## Recommendations
✅ Good edge coverage (84.0%)
⚠️ 2 modules never executed - consider removing
```

---

## 🎨 UI Features

### Smart Button States

**Before Setup:**
```
🔧 Setup Runtime       ← Click here first
📊 Collect Coverage    (disabled - setup required)
⚡ View Analysis       (disabled - no data)
```

**After Setup:**
```
🔧 Setup Runtime       ✅ Setup complete!
📊 Collect Coverage    ← Click here next
⚡ View Analysis       (disabled - no data)
```

**After Collection:**
```
🔧 Setup Runtime       ✅ Setup complete!
📊 Collect Coverage    ✅ Coverage collected!
⚡ View Analysis       ← Click to view results
```

---

### Real-Time Feedback

**Success Messages (Green):**
```
✅ Setup complete! Ready to collect coverage.
✅ Coverage collected! Click "View Analysis" to see results.
```

**Error Messages (Red):**
```
❌ Setup failed: Python not found
❌ Collection failed: No tests found
```

**Progress Indicators:**
```
⏳ Setting up...
⏳ Collecting...
```

---

## 🔄 Typical Workflow

### Day 1: Initial Setup
1. Open IntelliMap: `npm run serve`
2. Click **📊 Analysis** tab
3. Click **🔧 Setup Runtime** (wait ~30 seconds)
4. Click **📊 Collect Coverage** (runs your tests)
5. Click **⚡ View Analysis** (see results)

**Result:** You now know your test coverage!

---

### Day 2: After Adding Tests
1. Open IntelliMap: `npm run serve`
2. Click **📊 Analysis** tab
3. Click **📊 Collect Coverage** (setup already done!)
4. Click **⚡ View Analysis** (see improved coverage)

**Result:** Track coverage improvements!

---

### Day 3: Before Committing
1. Open IntelliMap: `npm run serve`
2. Click **📊 Analysis** tab
3. Click **📊 Collect Coverage**
4. Click **⚡ View Analysis**
5. Verify all new code is tested

**Result:** Confident commits with verified coverage!

---

## 🛠️ Troubleshooting

### "Setup failed: Python not found"

**Solution:** Install Python 3:
```bash
# Ubuntu/Debian
sudo apt install python3 python3-venv

# macOS
brew install python3

# Windows
# Download from python.org
```

Then click **🔧 Setup Runtime** again.

---

### "Collection failed: No tests found"

**Solution:** Make sure you have a test script in `package.json`:
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

Then click **📊 Collect Coverage** again.

---

### "Collection failed: Tests failed"

**Solution:** Fix your failing tests first:
```bash
npm test  # Should pass
```

Then click **📊 Collect Coverage** again.

---

### Button is Disabled

**Reason:** Prerequisites not met.

**Solutions:**
- **Collect Coverage disabled?** → Click **🔧 Setup Runtime** first
- **View Analysis disabled?** → Click **📊 Collect Coverage** first

---

## 💡 Pro Tips

### 1. Keep the Browser Open
Leave IntelliMap open while developing:
1. Make code changes
2. Click **📊 Collect Coverage**
3. Click **⚡ View Analysis**
4. See updated coverage instantly!

---

### 2. Watch for Status Messages
The colored status boxes tell you what's happening:
- **Green** = Success, ready for next step
- **Red** = Error, check the message
- **No message** = Waiting for action

---

### 3. Re-run Anytime
You can click **📊 Collect Coverage** as many times as you want:
- After adding tests
- After changing code
- Before committing
- During code review

---

### 4. Setup is One-Time
Once you click **🔧 Setup Runtime**, you never need to do it again (unless you delete the config files).

---

## 📊 What You Get

### Real Coverage Data
- **Edge coverage %** - Which imports are executed
- **Node coverage %** - Which files are tested
- **Dead code** - Files that exist but are never used
- **Performance hotspots** - Slowest modules

### Git Integration
- Automatically captures branch name
- Includes commit hash
- Timestamps each run
- Perfect for tracking coverage over time

### Actionable Insights
- ✅ Good coverage areas
- ⚠️ Coverage gaps
- 🔴 Dead code to remove
- ⚡ Performance bottlenecks

---

## 🎁 Benefits

✅ **No terminal commands** - Everything in the browser  
✅ **Real-time feedback** - See progress as it happens  
✅ **Smart button states** - Can't click wrong buttons  
✅ **Error handling** - Clear error messages  
✅ **One-click workflow** - Setup → Collect → View  
✅ **Persistent state** - Setup remembered across sessions  

---

## 🚀 Summary

**Old Way (Terminal):**
```bash
npm run runtime:setup
npm run runtime:collect
npm run serve
# Click "⚡ Runtime Analysis"
```

**New Way (In-App):**
```
1. npm run serve
2. Click 🔧 Setup Runtime
3. Click 📊 Collect Coverage
4. Click ⚡ View Analysis
```

**Even better:** Steps 2-4 are just clicks in the browser!

---

## 📚 More Information

- **Automated CLI:** `docs/AUTOMATED-RUNTIME-ANALYSIS.md`
- **Quick Start:** `docs/RUNTIME-QUICK-START.md`
- **Manual Setup:** `docs/REAL-RUNTIME-DATA-GUIDE.md`

---

## ✅ Try It Now!

```bash
npm run serve
# Open http://localhost:7676
# Click "📊 Analysis" tab
# Click "🔧 Setup Runtime"
# Click "📊 Collect Coverage"
# Click "⚡ View Analysis"
```

**That's it!** 🎉

No terminal commands, no configuration files, no confusion.  
Just click and analyze! 🚀


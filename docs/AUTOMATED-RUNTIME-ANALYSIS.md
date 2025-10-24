# Automated Runtime Analysis

**100% automated** - no manual setup required!

---

## 🚀 Quick Start (3 Commands)

### 1. Setup (One-Time)
```bash
npm run runtime:setup
```

This automatically:
- ✅ Installs NYC and c8 for JavaScript/TypeScript coverage
- ✅ Creates Python virtual environment (`.venv-intellimap`)
- ✅ Installs `coverage.py` in the venv
- ✅ Creates all configuration files (`.nycrc.json`, `.c8rc.json`, `.coveragerc`)
- ✅ Updates `.gitignore`

### 2. Collect Coverage
```bash
npm run runtime:collect
```

This automatically:
- ✅ Detects your test framework (Jest, Mocha, Vitest, pytest, etc.)
- ✅ Runs tests with coverage enabled
- ✅ Converts coverage data to IntelliMap format
- ✅ Saves runtime trace to `.intellimap/runtime/`

### 3. View Results
```bash
npm run serve
# Open http://localhost:7676
# Click "⚡ Runtime Analysis"
```

---

## ⚡ One-Command Workflow

Run everything at once:

```bash
npm run runtime:all
```

This runs:
1. `runtime:setup` - Install dependencies and create configs
2. `runtime:collect` - Run tests with coverage
3. `runtime:convert` - Convert to IntelliMap format

Then just:
```bash
npm run serve
# Click "⚡ Runtime Analysis"
```

---

## 📊 What You Get

### Real Coverage Data
- **Edge coverage %** - Which imports are actually executed
- **Node coverage %** - Which files are actually tested
- **Dead code detection** - Files that exist but are never used
- **Performance hotspots** - Slowest modules (estimated from execution counts)

### Detailed Reports
- Coverage metrics (edges & nodes)
- Top 10 slowest modules
- Dead code by directory
- Actionable recommendations

### Git Integration
- Automatically captures branch name
- Includes commit hash
- Timestamps each run
- Perfect for tracking coverage over time

---

## 🔧 Supported Test Frameworks

### JavaScript/TypeScript
- ✅ **Vitest** - Detected and configured automatically
- ✅ **Jest** - Detected and configured automatically
- ✅ **Mocha** - Uses NYC wrapper
- ✅ **AVA** - Uses NYC wrapper
- ✅ **Any framework** - Falls back to `nyc npm test`

### Python
- ✅ **pytest** - Detected from `pytest.ini` or `pyproject.toml`
- ✅ **unittest** - Detected from `tests/` or `test/` directory
- ✅ **Any framework** - Uses `coverage.py` wrapper

---

## 📁 What Gets Created

### Configuration Files
```
.nycrc.json          # NYC configuration
.c8rc.json           # c8 configuration (alternative to NYC)
.coveragerc          # Python coverage.py configuration
```

### Virtual Environment
```
.venv-intellimap/    # Python virtual environment
  ├── bin/
  │   ├── python
  │   ├── pip
  │   └── coverage
  └── lib/
```

### Coverage Data
```
.nyc_output/         # NYC coverage data
  └── coverage-final.json

.coverage.json       # Python coverage data

.intellimap/runtime/ # IntelliMap runtime traces
  └── trace-{timestamp}.json
```

All of these are automatically added to `.gitignore`!

---

## 🎯 Example Workflow

### For a JavaScript Project

```bash
# 1. One-time setup
npm run runtime:setup

# 2. Run your tests with coverage
npm run runtime:collect

# 3. View in IntelliMap
npm run serve
# Click "⚡ Runtime Analysis"
```

### For a Python Project

```bash
# 1. One-time setup (creates venv, installs coverage.py)
npm run runtime:setup

# 2. Run your tests with coverage
npm run runtime:collect

# 3. View in IntelliMap
npm run serve
# Click "⚡ Runtime Analysis"
```

### For a Monorepo (JS + Python)

```bash
# 1. One-time setup (handles both!)
npm run runtime:setup

# 2. Run all tests with coverage
npm run runtime:collect

# 3. View combined results
npm run serve
# Click "⚡ Runtime Analysis"
```

---

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Runtime Analysis

on: [push, pull_request]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Setup runtime analysis
        run: npm run runtime:setup
      
      - name: Collect coverage
        run: npm run runtime:collect
      
      - name: Upload runtime trace
        uses: actions/upload-artifact@v3
        with:
          name: runtime-trace
          path: .intellimap/runtime/
```

### GitLab CI

```yaml
coverage:
  script:
    - npm install
    - npm run runtime:setup
    - npm run runtime:collect
  artifacts:
    paths:
      - .intellimap/runtime/
```

---

## 🛠️ Manual Commands

If you need more control:

### Setup Only
```bash
npm run runtime:setup
```

### Collect Only
```bash
npm run runtime:collect
```

### Convert Only
```bash
npm run runtime:convert
```

### JavaScript Only
```bash
npx nyc npm test
node scripts/nyc-to-intellimap.js
```

### Python Only
```bash
.venv-intellimap/bin/coverage run -m pytest
.venv-intellimap/bin/coverage json
.venv-intellimap/bin/python scripts/coverage-to-intellimap.py
```

---

## 🐛 Troubleshooting

### "No test framework detected"
**Solution:** Make sure you have a test script in `package.json`:
```json
{
  "scripts": {
    "test": "jest"  // or mocha, vitest, etc.
  }
}
```

### "No coverage data found"
**Solution:** Make sure your tests actually run:
```bash
npm test  # Should pass
```

### "Virtual environment not found"
**Solution:** Run setup first:
```bash
npm run runtime:setup
```

### "Python not found"
**Solution:** Install Python 3:
```bash
# Ubuntu/Debian
sudo apt install python3 python3-venv

# macOS
brew install python3

# Windows
# Download from python.org
```

---

## 📈 Tracking Coverage Over Time

### Save Traces by Branch
```bash
# Automatically includes branch name and commit hash
npm run runtime:collect

# Traces are saved with timestamp
ls .intellimap/runtime/
# trace-1234567890.json
```

### Compare Runs
```bash
# Run on main branch
git checkout main
npm run runtime:collect

# Run on feature branch
git checkout feature/new-feature
npm run runtime:collect

# View both in IntelliMap
npm run serve
# Use the trace selector (future feature)
```

---

## 🎁 Benefits

✅ **Zero manual configuration** - Everything is automated  
✅ **Works with any test framework** - Auto-detection  
✅ **Isolated Python environment** - No system pollution  
✅ **Git integration** - Automatic branch/commit tracking  
✅ **CI/CD ready** - Easy to integrate  
✅ **Cross-platform** - Works on Linux, macOS, Windows  

---

## 🚀 Next Steps

1. **Run setup**: `npm run runtime:setup`
2. **Collect coverage**: `npm run runtime:collect`
3. **View results**: `npm run serve` → click "⚡ Runtime Analysis"
4. **Iterate**: Run `runtime:collect` after every code change
5. **Track progress**: Compare coverage over time

Happy analyzing! 🎉


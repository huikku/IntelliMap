# MOTH Code Analysis Report

Generated: 2025-10-30T02:57:41.927Z
Repository: cli

---

## Summary

- **Total Files**: 24
- **Code Files**: 24
- **Binary Files**: 0
- **Total Lines of Code**: 4,095
- **Total Complexity**: 941
- **Average Complexity**: 39.21

## 🔥 Top 10 Most Complex Files

High complexity indicates files that may be difficult to understand and maintain.

1. **moth/generator.js**
   - Complexity: 241
   - LOC: 855
   - Churn: 0 commits

2. **indexers/staticGraph.js**
   - Complexity: 102
   - LOC: 311
   - Churn: 0 commits

3. **indexers/esbuildGraph.js**
   - Complexity: 91
   - LOC: 395
   - Churn: 0 commits

4. **indexers/gitMetrics.js**
   - Complexity: 71
   - LOC: 206
   - Churn: 0 commits

5. **indexers/metricsComputer.js**
   - Complexity: 66
   - LOC: 149
   - Churn: 0 commits

6. **commands/run.js**
   - Complexity: 55
   - LOC: 277
   - Churn: 0 commits

7. **runtime/enhanced-v8-converter.js**
   - Complexity: 50
   - LOC: 244
   - Churn: 0 commits

8. **runtime/loader.js**
   - Complexity: 32
   - LOC: 137
   - Churn: 0 commits

9. **generate-sample-trace.js**
   - Complexity: 28
   - LOC: 123
   - Churn: 0 commits

10. **runtime-instrument.js**
   - Complexity: 26
   - LOC: 226
   - Churn: 0 commits

## 📝 Top 10 Most Changed Files

High churn indicates files that change frequently, which may indicate instability or active development.

1. **commands/capture.js**
   - Churn: 0 commits
   - Complexity: 12
   - LOC: 83

2. **commands/diff.js**
   - Churn: 0 commits
   - Complexity: 11
   - LOC: 41

3. **commands/index.js**
   - Churn: 0 commits
   - Complexity: 6
   - LOC: 49

4. **commands/moth.js**
   - Churn: 0 commits
   - Complexity: 10
   - LOC: 62

5. **commands/run.js**
   - Churn: 0 commits
   - Complexity: 55
   - LOC: 277

6. **commands/serve.js**
   - Churn: 0 commits
   - Complexity: 10
   - LOC: 56

7. **generate-sample-trace.js**
   - Churn: 0 commits
   - Complexity: 28
   - LOC: 123

8. **index.js**
   - Churn: 0 commits
   - Complexity: 6
   - LOC: 61

9. **indexers/esbuildGraph.js**
   - Churn: 0 commits
   - Complexity: 91
   - LOC: 395

10. **indexers/gitMetrics.js**
   - Churn: 0 commits
   - Complexity: 71
   - LOC: 206

## 📏 Top 10 Largest Files

Large files may be candidates for refactoring or splitting into smaller modules.

1. **moth/generator.js**
   - LOC: 855
   - Complexity: 241
   - Churn: 0 commits

2. **indexers/esbuildGraph.js**
   - LOC: 395
   - Complexity: 91
   - Churn: 0 commits

3. **indexers/staticGraph.js**
   - LOC: 311
   - Complexity: 102
   - Churn: 0 commits

4. **commands/run.js**
   - LOC: 277
   - Complexity: 55
   - Churn: 0 commits

5. **runtime/enhanced-v8-converter.js**
   - LOC: 244
   - Complexity: 50
   - Churn: 0 commits

6. **runtime-instrument.js**
   - LOC: 226
   - Complexity: 26
   - Churn: 0 commits

7. **runtime/collector.js**
   - LOC: 213
   - Complexity: 23
   - Churn: 0 commits

8. **indexers/gitMetrics.js**
   - LOC: 206
   - Complexity: 71
   - Churn: 0 commits

9. **indexers/metricsComputer.js**
   - LOC: 149
   - Complexity: 66
   - Churn: 0 commits

10. **indexers/mergeGraphs.test.js**
   - LOC: 141
   - Complexity: 18
   - Churn: 0 commits

## 🔗 Top 10 Most Coupled Files (Dependencies)

High fanout indicates files that depend on many other files, which may indicate tight coupling.

1. **index.js**
   - Dependencies (fanout): 7
   - Dependents (fanin): 0
   - Complexity: 6

2. **runtime-instrument.js**
   - Dependencies (fanout): 7
   - Dependents (fanin): 0
   - Complexity: 26

3. **indexers/esbuildGraph.js**
   - Dependencies (fanout): 6
   - Dependents (fanin): 2
   - Complexity: 91

4. **moth/generator.js**
   - Dependencies (fanout): 6
   - Dependents (fanin): 1
   - Complexity: 241

5. **watcher.js**
   - Dependencies (fanout): 6
   - Dependents (fanin): 1
   - Complexity: 19

6. **commands/index.js**
   - Dependencies (fanout): 5
   - Dependents (fanin): 1
   - Complexity: 6

7. **commands/run.js**
   - Dependencies (fanout): 5
   - Dependents (fanin): 1
   - Complexity: 55

8. **indexers/python_indexer.py**
   - Dependencies (fanout): 5
   - Dependents (fanin): 0
   - Complexity: 21

9. **runtime/collector.js**
   - Dependencies (fanout): 5
   - Dependents (fanin): 0
   - Complexity: 23

10. **commands/capture.js**
   - Dependencies (fanout): 4
   - Dependents (fanin): 1
   - Complexity: 12

## 🎯 Top 10 Most Depended Upon Files

High fanin indicates files that many other files depend on. Changes to these files have wide impact.

1. **indexers/mergeGraphs.js**
   - Dependents (fanin): 3
   - Dependencies (fanout): 0
   - Complexity: 24

2. **indexers/metricsComputer.js**
   - Dependents (fanin): 3
   - Dependencies (fanout): 2
   - Complexity: 66

3. **indexers/esbuildGraph.js**
   - Dependents (fanin): 2
   - Dependencies (fanout): 6
   - Complexity: 91

4. **indexers/pythonGraph.js**
   - Dependents (fanin): 2
   - Dependencies (fanout): 4
   - Complexity: 13

5. **commands/capture.js**
   - Dependents (fanin): 1
   - Dependencies (fanout): 4
   - Complexity: 12

6. **commands/diff.js**
   - Dependents (fanin): 1
   - Dependencies (fanout): 2
   - Complexity: 11

7. **commands/index.js**
   - Dependents (fanin): 1
   - Dependencies (fanout): 5
   - Complexity: 6

8. **commands/moth.js**
   - Dependents (fanin): 1
   - Dependencies (fanout): 3
   - Complexity: 10

9. **commands/run.js**
   - Dependents (fanin): 1
   - Dependencies (fanout): 5
   - Complexity: 55

10. **commands/serve.js**
   - Dependents (fanin): 1
   - Dependencies (fanout): 4
   - Complexity: 10

---

*Generated by IntelliMap MOTH Generator*
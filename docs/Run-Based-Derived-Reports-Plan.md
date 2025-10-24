# **Run-Based & Derived Reports Plan**

## **1. Objective**

Enrich static codebase graphs with runtime, coverage, and version-control intelligence.
Expose dynamic behavior, fragility, and inefficiencies directly in IntelliMap or in CI pipelines.

---

## **2. Data Inputs**

| Source                  | Format                              | Example Tool                                       |
| ----------------------- | ----------------------------------- | -------------------------------------------------- |
| **Static Graph**        | edges_static.json                   | From your AST parser (current output)              |
| **Runtime Trace**       | edges_runtime.json                  | `nyc`, `coverage.py`, V8 hooks, or trace decorator |
| **Coverage Report**     | lcov.json or coverage.json          | Istanbul, Coverage.py                              |
| **Performance Metrics** | trace events (start–end timestamps) | Chrome trace API, OpenTelemetry                    |
| **Git Metadata**        | commits, churn, authorship          | `git log --numstat --name-only --date=iso`         |
| **CI Context**          | build ID, branch, run ID            | GitHub Actions, local run metadata                 |

All normalized into a SQLite or DuckDB store for joins.

---

## **3. Core Derived Datasets**

### **3.1 Static vs Runtime Matrix**

Join `edges_static` and `edges_runtime`:

| Edge | Static | Runtime | Count | Δ                  |
| ---- | ------ | ------- | ----- | ------------------ |
| a→b  | ✅      | ✅       | 133   | —                  |
| a→c  | ✅      | ❌       | —     | *dead*             |
| d→e  | ❌      | ✅       | 2     | *new dynamic edge* |

Derivations:

* **Coverage % of dependencies**
* **Runtime-only edges** (dynamic loading, reflection, late bindings)
* **Dead imports** (never executed)

---

### **3.2 Module Execution Profile**

Aggregate runtime edge data per node:

| Module | Calls In | Calls Out | Avg Latency | Total Time | Coverage % |
| ------ | -------- | --------- | ----------- | ---------- | ---------- |
| api.ts | 120      | 34        | 5.2ms       | 620ms      | 89%        |

Derivations:

* **Hot modules** (high total time)
* **Brittle hubs** (many calls, high latency variance)
* **Cold abstractions** (never executed)

---

### **3.3 Temporal Change Correlation**

Combine Git + runtime data:

| File    | Churn (90d) | Runtime Frequency | Risk Index = churn × freq |
| ------- | ----------- | ----------------- | ------------------------- |
| app.cjs | 83          | 129               | **10,707**                |

→ Highlights *actively changing, frequently executed* code (prime regression targets).

---

### **3.4 Cross-Run Drift Analysis**

Compare two runtime snapshots (e.g., `main` vs `feature/refactor`):

| Edge         | Run A Count | Run B Count | Δ%    | Status      |
| ------------ | ----------- | ----------- | ----- | ----------- |
| auth→session | 120         | 0           | −100% | **Missing** |
| new→cache    | 0           | 33          | +∞    | **New**     |

Detects regressions and untested new paths.

---

## **4. Reports to Generate**

### **4.1 Runtime Coverage**

* Percentage of static edges exercised at least once.
* Nodes colored by coverage %.
* Unexecuted nodes faded or grayed out.

### **4.2 Performance Hotspots**

* Top 10 edges and nodes by cumulative latency.
* Width ∝ time; color heatmap (blue→red).
* Derived “Critical Path” view (topological sort by latency sum).

### **4.3 Runtime Drift Report**

* Compare last two runs per branch.
* Summarize new, missing, and degraded edges.
* Output JSON + HTML diff (for CI comment).

### **4.4 Behavioral Stability Index**

`(executed_edges_shared / executed_edges_total)` between successive runs
→ quantifies how predictable runtime structure is.

### **4.5 Dead or Unused Code Audit**

* `static-only edges` + `unexecuted nodes` → confirm orphaned or unreachable code.

### **4.6 Test Effectiveness**

* For each test suite, list files and edges it covers.
* Identify modules with **zero test hits** but high runtime risk.

---

## **5. Scoring and Prioritization**

| Composite Metric              | Formula                                      | Meaning                         |
| ----------------------------- | -------------------------------------------- | ------------------------------- |
| **Hotspot Risk**              | `complexity × churn × runtime_freq`          | Change-heavy + complex + active |
| **Stability Score**           | `1 − (Δedges_runtime / edges_runtime_total)` | Lower = volatile                |
| **Coverage Integrity**        | `runtime_edges / static_edges`               | Architectural coverage ratio    |
| **Dead Code Ratio**           | `unexecuted_nodes / total_nodes`             | Refactor signal                 |
| **Performance Concentration** | `Σ(top10_latency) / Σ(total_latency)`        | Indicates bottleneck locality   |

---

## **6. UI & Visualization Extensions**

### **Graph View**

* **Edge color:** runtime activity (blue=light, red=hot).
* **Node size:** execution count or total latency.
* **Opacity:** coverage.
* **Toggle:** “Show only executed edges” vs “Full architecture.”
* **Timeline slider:** animate execution over test duration.

### **Report Panel**

Tabs:
`Runtime Coverage · Performance Hotspots · Drift · Dead Code · Test Effectiveness · Change Correlation`

Each shows:

* sortable table
* “focus in graph” button
* diff export (JSON, CSV)

---

## **7. Integration & Pipeline**

1. **Capture Phase**

   * Hook test runs and CI pipelines.
   * Write runtime traces to `/intellimap/runs/<commit>.json`.

2. **Ingest Phase**

   * Merge static + runtime + git metadata into SQLite.
   * Run ETL job: derive matrices + metrics.

3. **Report Generation**

   * Use Python or Node CLI:
     `intellimap analyze --runs latest --format html,json`
   * Produce static report or push to dashboard.

4. **Visualization Phase**

   * Cytoscape overlay or web dashboard.
   * Local dev: toggle overlays interactively.
   * CI: attach HTML/JSON summary artifact.

---

## **8. Implementation Timeline**

| Phase               | Duration                                   | Deliverables                        |
| ------------------- | ------------------------------------------ | ----------------------------------- |
| **Phase 1 (2 wks)** | Build runtime trace ingestion + edge merge | basic runtime coverage report       |
| **Phase 2 (3 wks)** | Add performance + drift analysis           | Hotspot + regression reports        |
| **Phase 3 (2 wks)** | Integrate Git metadata + composite scoring | Risk & stability dashboards         |
| **Phase 4 (2 wks)** | LLM summaries + CI publishing              | Human-readable architecture reviews |

---

## **9. Optional Future Work**

* **Distributed Trace Integration:** ingest OpenTelemetry spans for microservice graphs.
* **Anomaly Detection:** unsupervised learning on latency + change drift.
* **LLM Summarization Layer:** “Describe the most unstable subsystems over the last 10 runs.”
* **Predictive Modeling:** regression on drift metrics to forecast architectural decay.

---

Do you want me to extend your IntelliMap canvas doc with this plan as **Section 11: Run-Based & Derived Reports** (matching your existing numbering)?

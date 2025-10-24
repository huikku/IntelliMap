import { useState } from 'react';

export default function Sidebar({ filters, setFilters, graph, cy }) {
  const [activeSection, setActiveSection] = useState('filters');
  const [analysisReport, setAnalysisReport] = useState('');
  const [cycleReport, setCycleReport] = useState('');
  const [reportType, setReportType] = useState('cycles');

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const runCycleDetection = () => {
    if (!cy) {
      setAnalysisReport('⚠️ Graph not loaded yet');
      return;
    }

    // Reset previous cycle highlighting
    cy.nodes().removeClass('in-cycle');
    cy.edges().removeClass('in-cycle');

    // Find strongly connected components (SCCs) using Tarjan's algorithm
    const components = [];
    const visited = new Set();
    const stack = [];
    const lowLink = new Map();
    const index = new Map();
    let currentIndex = 0;

    const strongConnect = (node) => {
      index.set(node.id(), currentIndex);
      lowLink.set(node.id(), currentIndex);
      currentIndex++;
      stack.push(node);
      visited.add(node.id());

      node.outgoers('node').forEach(successor => {
        if (!index.has(successor.id())) {
          strongConnect(successor);
          lowLink.set(node.id(), Math.min(lowLink.get(node.id()), lowLink.get(successor.id())));
        } else if (stack.includes(successor)) {
          lowLink.set(node.id(), Math.min(lowLink.get(node.id()), index.get(successor.id())));
        }
      });

      if (lowLink.get(node.id()) === index.get(node.id())) {
        const component = [];
        let w;
        do {
          w = stack.pop();
          component.push(w);
        } while (w !== node);

        if (component.length > 1) {
          components.push(component);
        }
      }
    };

    cy.nodes().forEach(node => {
      if (!visited.has(node.id())) {
        strongConnect(node);
      }
    });

    // Highlight cycles
    let totalCycleNodes = 0;
    let cycleNodes = cy.collection();
    let cycleEdges = cy.collection();

    components.forEach(component => {
      component.forEach(node => {
        node.addClass('in-cycle');
        cycleNodes = cycleNodes.union(node);
        totalCycleNodes++;

        node.outgoers('edge').forEach(edge => {
          if (component.includes(edge.target())) {
            edge.addClass('in-cycle');
            cycleEdges = cycleEdges.union(edge);
          }
        });
      });
    });

    // Generate report
    let report = `# Circular Dependency Analysis\n\n`;

    if (components.length > 0) {
      report += `## Summary\n🔴 **${components.length} circular ${components.length === 1 ? 'dependency' : 'dependencies'} detected**\n`;
      report += `📊 **${totalCycleNodes} ${totalCycleNodes === 1 ? 'file' : 'files'} involved**\n\n`;

      report += `## Detected Cycles\n\n`;
      components.forEach((component, idx) => {
        const cycleFiles = component.map(n => n.id());
        report += `### Cycle ${idx + 1} (${cycleFiles.length} files)\n\n\`\`\`\n`;
        cycleFiles.forEach((file, i) => {
          report += `${file}\n`;
          if (i < cycleFiles.length - 1) {
            report += '  ↓ imports\n';
          } else {
            report += '  ↓ imports (back to start)\n';
          }
        });
        report += `${cycleFiles[0]}\n\`\`\`\n\n`;
      });

      report += `## Recommendations\n\n`;
      report += `1. **Extract Shared Code**: Move common functionality to a separate module\n`;
      report += `2. **Dependency Inversion**: Use interfaces or abstract classes\n`;
      report += `3. **Merge Files**: If tightly coupled, consider merging\n`;
      report += `4. **Lazy Loading**: Use dynamic imports to break cycles\n`;

      // Fade all nodes and edges, highlight cycles
      cy.nodes().style('opacity', 0.15);
      cy.edges().style('opacity', 0.05);
      cycleNodes.style('opacity', 1);
      cycleEdges.style('opacity', 0.8);

      cy.animate({
        fit: { eles: cycleNodes, padding: 50 },
      }, { duration: 500 });
    } else {
      report += `## Summary\n✅ **No circular dependencies detected**\n\n`;
      report += `Your codebase has a clean, acyclic dependency graph.\n\n`;
      report += `## Benefits\n`;
      report += `- Clear initialization order\n`;
      report += `- Easier to understand dependencies\n`;
      report += `- Better tree-shaking and bundling\n`;
      report += `- Simpler testing and mocking\n`;
    }

    setCycleReport(report);
    setReportType('cycles');
    setActiveSection('analysis');
  };

  const runCodeAnalysis = () => {
    if (!cy) {
      setAnalysisReport('⚠️ Graph not loaded yet');
      return;
    }

    const nodes = cy.nodes();
    const edges = cy.edges();

    // Calculate metrics
    const nodeMetrics = nodes.map(node => ({
      id: node.id(),
      inDegree: node.indegree(),
      outDegree: node.outdegree(),
      totalDegree: node.degree(),
    }));

    const totalNodes = nodes.length;
    const totalEdges = edges.length;
    const avgDependencies = totalNodes > 0 ? totalEdges / totalNodes : 0;

    // Find orphan nodes (no connections)
    const orphanNodes = nodeMetrics.filter(n => n.totalDegree === 0);

    // Find hub nodes (high fan-out, imports many files)
    const hubNodes = nodeMetrics
      .filter(n => n.outDegree >= 5)
      .sort((a, b) => b.outDegree - a.outDegree)
      .slice(0, 10);

    // Find leaf nodes (high fan-in, imported by many files)
    const leafNodes = nodeMetrics
      .filter(n => n.inDegree >= 5)
      .sort((a, b) => b.inDegree - a.inDegree)
      .slice(0, 10);

    // Find god files (high fan-in AND fan-out)
    const godFiles = nodeMetrics
      .filter(n => n.inDegree >= 3 && n.outDegree >= 3)
      .sort((a, b) => b.totalDegree - a.totalDegree)
      .slice(0, 10);

    // Find unused files (exports but never imported)
    const unusedFiles = nodeMetrics.filter(n => n.inDegree === 0 && n.outDegree > 0);

    // Calculate max depth (longest path)
    let maxDepth = 0;
    nodes.forEach(node => {
      const bfs = cy.elements().bfs({
        root: node,
        directed: true,
      });
      if (bfs.path.length > maxDepth) {
        maxDepth = bfs.path.length;
      }
    });

    // Generate report
    let report = `# Code Architecture Analysis\n\n`;
    report += `## Overview\n`;
    report += `- **Total Files**: ${totalNodes}\n`;
    report += `- **Total Dependencies**: ${totalEdges}\n`;
    report += `- **Average Dependencies per File**: ${avgDependencies.toFixed(2)}\n`;
    report += `- **Maximum Dependency Depth**: ${Math.floor(maxDepth / 2)}\n\n`;

    report += `## Architecture Metrics\n\n`;

    report += `### Hub Files (High Fan-out)\n`;
    report += `Files that import many other files:\n\n`;
    if (hubNodes.length > 0) {
      hubNodes.forEach(node => {
        report += `- **${node.id}** (${node.outDegree} dependencies)\n`;
      });
    } else {
      report += `✅ No hub files detected\n`;
    }

    report += `\n### Leaf Files (High Fan-in)\n`;
    report += `Files imported by many other files:\n\n`;
    if (leafNodes.length > 0) {
      leafNodes.forEach(node => {
        report += `- **${node.id}** (imported by ${node.inDegree} files)\n`;
      });
    } else {
      report += `✅ No heavily-used leaf files\n`;
    }

    report += `\n## Potential Issues\n\n`;

    report += `### God Files (High Complexity)\n`;
    report += `Files with both high fan-in and fan-out:\n\n`;
    if (godFiles.length > 0) {
      godFiles.forEach(node => {
        report += `- **${node.id}**\n`;
        report += `  - Imports: ${node.outDegree} files\n`;
        report += `  - Imported by: ${node.inDegree} files\n`;
      });
      report += `\n⚠️ Consider splitting these files into smaller modules.\n`;
    } else {
      report += `✅ No god files detected\n`;
    }

    report += `\n### Orphan Files (Disconnected)\n`;
    if (orphanNodes.length > 0) {
      orphanNodes.forEach(node => {
        report += `- ${node.id}\n`;
      });
      report += `\n⚠️ These files may be unused, test files, or entry points.\n`;
    } else {
      report += `✅ No orphan files\n`;
    }

    report += `\n### Unused Exports\n`;
    if (unusedFiles.length > 0) {
      unusedFiles.forEach(node => {
        report += `- ${node.id}\n`;
      });
      report += `\n⚠️ Consider removing or making these entry points.\n`;
    } else {
      report += `✅ All files are used\n`;
    }

    setAnalysisReport(report);
    setReportType('analysis');
    setActiveSection('analysis');
  };

  const copyReport = () => {
    const report = reportType === 'cycles' ? cycleReport : analysisReport;
    navigator.clipboard.writeText(report);
  };

  return (
    <aside className="w-80 h-full bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Section Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveSection('filters')}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition ${
            activeSection === 'filters'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🔍 Filters
        </button>
        <button
          onClick={() => setActiveSection('analysis')}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition ${
            activeSection === 'analysis'
              ? 'bg-gray-800 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📊 Analysis
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === 'filters' && (
          <>
            <h2 className="text-sm font-bold text-gray-300 mb-4">FILTERS</h2>

            {/* Show Changed Only */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showChanged}
                onChange={e => handleFilterChange('showChanged', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Show changed only</span>
            </label>

            {/* Collapse by Folder */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.collapseByFolder}
                onChange={e => handleFilterChange('collapseByFolder', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Collapse by folder</span>
            </label>

            {/* Language Filter */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">Language</label>
              <select
                value={filters.language}
                onChange={e => handleFilterChange('language', e.target.value)}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
              >
                <option value="all">All</option>
                <option value="js">JavaScript</option>
                <option value="ts">TypeScript</option>
                <option value="py">Python</option>
              </select>
            </div>

            {/* Environment Filter */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-2">Environment</label>
              <select
                value={filters.env}
                onChange={e => handleFilterChange('env', e.target.value)}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
              >
                <option value="all">All</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
              </select>
            </div>

            {/* Stats */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <h3 className="text-xs text-gray-400 mb-2">STATS</h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Nodes: {graph?.nodes?.length || 0}</p>
                <p>Edges: {graph?.edges?.length || 0}</p>
              </div>
            </div>
          </>
        )}

        {activeSection === 'analysis' && (
          <>
            <h2 className="text-sm font-bold text-gray-300 mb-4">CODE ANALYSIS</h2>

            {/* Analysis Buttons */}
            <div className="space-y-2 mb-4">
              <button
                onClick={runCycleDetection}
                className="w-full px-3 py-2 bg-red-800 hover:bg-red-700 rounded text-sm font-semibold transition flex items-center justify-center gap-2"
                title="Detect circular dependencies"
              >
                🔴 Detect Cycles
              </button>
              <button
                onClick={runCodeAnalysis}
                className="w-full px-3 py-2 bg-blue-800 hover:bg-blue-700 rounded text-sm font-semibold transition flex items-center justify-center gap-2"
                title="Analyze code architecture"
              >
                📊 Architecture Analysis
              </button>
            </div>

            {/* Report Display */}
            {(analysisReport || cycleReport) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs text-gray-400 font-semibold">
                    {reportType === 'cycles' ? '🔴 Cycle Report' : '📊 Analysis Report'}
                  </h3>
                  <button
                    onClick={copyReport}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
                    title="Copy report to clipboard"
                  >
                    📋 Copy
                  </button>
                </div>
                <textarea
                  readOnly
                  value={reportType === 'cycles' ? cycleReport : analysisReport}
                  className="w-full h-96 p-3 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300 resize-none"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            )}

            {!analysisReport && !cycleReport && (
              <div className="text-xs text-gray-500 text-center py-8">
                <p className="mb-2">📊</p>
                <p>Run an analysis to see results here</p>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}


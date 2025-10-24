import { useState, useRef, useEffect } from 'react';
import ReportViewer from './ReportViewer';

export default function Sidebar({ filters, setFilters, graph, cy }) {
  const [activeSection, setActiveSection] = useState('filters');
  const [analysisReport, setAnalysisReport] = useState('');
  const [cycleReport, setCycleReport] = useState('');
  const [reportType, setReportType] = useState('cycles');
  const [showReportModal, setShowReportModal] = useState(false);
  const [width, setWidth] = useState(320); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  // Store analysis data for interactive file lists
  const [analysisData, setAnalysisData] = useState(null);
  const [cycleData, setCycleData] = useState(null);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= 280 && newWidth <= 600) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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
    setCycleData({
      cycles: components.map(comp => comp.map(n => n.id())),
      totalFiles: new Set(components.flat().map(n => n.id())).size,
    });
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

    // Detect monolithic files (large files that should be refactored)
    // Get file sizes from graph data if available
    const monolithicFiles = [];
    if (graph?.nodes) {
      graph.nodes.forEach(node => {
        const nodeData = nodeMetrics.find(n => n.id === node.id);
        if (!nodeData) return;

        // A file is monolithic if it has:
        // 1. High total degree (>10 connections)
        // 2. Both imports and exports (not just a hub or leaf)
        // 3. Optionally: large file size (if available in metadata)
        const isMonolithic =
          nodeData.totalDegree > 10 &&
          nodeData.inDegree >= 3 &&
          nodeData.outDegree >= 3;

        if (isMonolithic) {
          monolithicFiles.push({
            id: node.id,
            totalDegree: nodeData.totalDegree,
            inDegree: nodeData.inDegree,
            outDegree: nodeData.outDegree,
            size: node.size || null, // File size if available
          });
        }
      });
    }

    // Sort by total degree (most connected first)
    monolithicFiles.sort((a, b) => b.totalDegree - a.totalDegree);
    const topMonolithic = monolithicFiles.slice(0, 10);

    // Calculate instability metric (I = fan-out / (fan-in + fan-out))
    // High instability (close to 1) = many dependencies, few dependents = risky
    const instabilityMetrics = nodeMetrics
      .filter(n => n.totalDegree > 0)
      .map(n => ({
        id: n.id,
        instability: n.totalDegree > 0 ? n.outDegree / n.totalDegree : 0,
        inDegree: n.inDegree,
        outDegree: n.outDegree,
      }));

    // Find unstable dependencies (high instability + high fan-in = risky)
    const unstableDeps = instabilityMetrics
      .filter(n => n.instability > 0.7 && n.inDegree >= 3)
      .sort((a, b) => b.instability - a.instability)
      .slice(0, 10);

    // Calculate dependency depth for each node (longest path from any root)
    const depthMap = new Map();

    // Find root nodes (no incoming edges)
    const rootNodes = nodes.filter(n => n.indegree() === 0);

    // BFS from each root to calculate depths
    rootNodes.forEach(root => {
      const bfs = cy.elements().bfs({
        root: root,
        directed: true,
        visit: (v, e, u, i, depth) => {
          const currentDepth = depthMap.get(v.id()) || 0;
          depthMap.set(v.id(), Math.max(currentDepth, depth));
        },
      });
    });

    // Find deep dependency chains
    const deepChains = Array.from(depthMap.entries())
      .map(([id, depth]) => ({ id, depth }))
      .filter(n => n.depth >= 5)
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 10);

    const maxDepth = Math.max(...Array.from(depthMap.values()), 0);

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

    report += `\n### Unstable Dependencies (High Risk)\n`;
    report += `Files with high instability that many others depend on:\n\n`;
    if (unstableDeps.length > 0) {
      unstableDeps.forEach(node => {
        report += `- **${node.id}**\n`;
        report += `  - Instability: ${(node.instability * 100).toFixed(1)}%\n`;
        report += `  - Imports: ${node.outDegree} files\n`;
        report += `  - Imported by: ${node.inDegree} files\n`;
      });
      report += `\n⚠️ **High instability + high fan-in = risky!** Consider:\n`;
      report += `- Extract interfaces to invert dependencies\n`;
      report += `- Split into stable core + unstable adapters\n`;
      report += `- Reduce coupling by introducing facades\n`;
    } else {
      report += `✅ No unstable dependencies detected\n`;
    }

    report += `\n### Monolithic Files (Should Be Refactored)\n`;
    report += `Large, highly-connected files that do too much:\n\n`;
    if (topMonolithic.length > 0) {
      topMonolithic.forEach(node => {
        report += `- **${node.id}**\n`;
        report += `  - Total connections: ${node.totalDegree}\n`;
        report += `  - Imports: ${node.outDegree} files\n`;
        report += `  - Imported by: ${node.inDegree} files\n`;
        if (node.size) {
          report += `  - Size: ${(node.size / 1024).toFixed(1)} KB\n`;
        }
      });
      report += `\n⚠️ **Monolithic files are hard to maintain and test.** Consider:\n`;
      report += `- Split by responsibility (Single Responsibility Principle)\n`;
      report += `- Extract reusable utilities to separate modules\n`;
      report += `- Separate concerns (UI, logic, data access)\n`;
      report += `- Create smaller, focused modules\n`;
    } else {
      report += `✅ No monolithic files detected\n`;
    }

    report += `\n### Deep Dependency Chains\n`;
    report += `Files with long import paths (potential fragility):\n\n`;
    if (deepChains.length > 0) {
      deepChains.forEach(node => {
        report += `- **${node.id}** (depth: ${node.depth} levels)\n`;
      });
      report += `\n⚠️ **Deep chains increase fragility.** Consider:\n`;
      report += `- Flatten abstractions\n`;
      report += `- Cache intermediate results\n`;
      report += `- Introduce direct dependencies where appropriate\n`;
    } else {
      report += `✅ No excessively deep chains\n`;
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
    setAnalysisData({
      hubNodes: hubNodes.map(n => n.id),
      leafNodes: leafNodes.map(n => n.id),
      godFiles: godFiles.map(n => n.id),
      monolithicFiles: topMonolithic.map(n => n.id),
      unstableDeps: unstableDeps.map(n => n.id),
      deepChains: deepChains.map(n => n.id),
      orphanNodes: orphanNodes.map(n => n.id),
      unusedFiles: unusedFiles.map(n => n.id),
    });
    setReportType('analysis');
    setActiveSection('analysis');
  };

  const copyReport = () => {
    const report = reportType === 'cycles' ? cycleReport : analysisReport;
    navigator.clipboard.writeText(report);
  };

  // Highlight and focus on a file in the graph
  const highlightFile = (fileId) => {
    if (!cy) return;

    // Reset all highlighting
    cy.nodes().removeClass('highlighted');
    cy.edges().removeClass('highlighted');

    // Find and highlight the node
    const node = cy.getElementById(fileId);
    if (node.length > 0) {
      node.addClass('highlighted');

      // Highlight connected edges
      node.connectedEdges().addClass('highlighted');

      // Center on the node
      cy.animate({
        center: { eles: node },
        zoom: 1.5,
        duration: 500,
      });
    }
  };

  // Highlight multiple files
  const highlightFiles = (fileIds) => {
    if (!cy) return;

    // Reset all highlighting
    cy.nodes().removeClass('highlighted');
    cy.edges().removeClass('highlighted');

    // Highlight all nodes
    fileIds.forEach(fileId => {
      const node = cy.getElementById(fileId);
      if (node.length > 0) {
        node.addClass('highlighted');
        node.connectedEdges().addClass('highlighted');
      }
    });

    // Fit to highlighted nodes
    const highlightedNodes = cy.nodes('.highlighted');
    if (highlightedNodes.length > 0) {
      cy.animate({
        fit: { eles: highlightedNodes, padding: 50 },
        duration: 500,
      });
    }
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="h-full bg-gray-900 border-r border-gray-800 flex flex-col relative"
    >
      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={() => setIsResizing(true)}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors z-10"
        title="Drag to resize"
      />

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
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs transition"
                      title="Expand report in modal"
                    >
                      ⛶ Expand
                    </button>
                    <button
                      onClick={copyReport}
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition"
                      title="Copy report to clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={reportType === 'cycles' ? cycleReport : analysisReport}
                  className="w-full h-64 p-3 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300 resize-none"
                  style={{ fontFamily: 'monospace' }}
                />

                {/* Interactive File Lists */}
                {reportType === 'analysis' && analysisData && (
                  <div className="space-y-3 mt-4">
                    <h3 className="text-xs text-gray-400 font-semibold">📍 AFFECTED FILES (Click to view in graph)</h3>

                    {analysisData.monolithicFiles?.length > 0 && (
                      <div className="bg-gray-800 border border-orange-900 rounded p-2">
                        <div className="text-xs font-semibold text-orange-400 mb-1">
                          🏗️ Monolithic Files ({analysisData.monolithicFiles.length})
                        </div>
                        <div className="space-y-1">
                          {analysisData.monolithicFiles.slice(0, 5).map(fileId => (
                            <button
                              key={fileId}
                              onClick={() => highlightFile(fileId)}
                              className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded transition truncate"
                              title={`Click to view ${fileId} in graph`}
                            >
                              {fileId}
                            </button>
                          ))}
                          {analysisData.monolithicFiles.length > 5 && (
                            <button
                              onClick={() => highlightFiles(analysisData.monolithicFiles)}
                              className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              + {analysisData.monolithicFiles.length - 5} more (click to view all)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {analysisData.godFiles?.length > 0 && (
                      <div className="bg-gray-800 border border-red-900 rounded p-2">
                        <div className="text-xs font-semibold text-red-400 mb-1">
                          ⚠️ God Files ({analysisData.godFiles.length})
                        </div>
                        <div className="space-y-1">
                          {analysisData.godFiles.slice(0, 5).map(fileId => (
                            <button
                              key={fileId}
                              onClick={() => highlightFile(fileId)}
                              className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded transition truncate"
                              title={`Click to view ${fileId} in graph`}
                            >
                              {fileId}
                            </button>
                          ))}
                          {analysisData.godFiles.length > 5 && (
                            <button
                              onClick={() => highlightFiles(analysisData.godFiles)}
                              className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              + {analysisData.godFiles.length - 5} more (click to view all)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {analysisData.unstableDeps?.length > 0 && (
                      <div className="bg-gray-800 border border-yellow-900 rounded p-2">
                        <div className="text-xs font-semibold text-yellow-400 mb-1">
                          ⚡ Unstable Dependencies ({analysisData.unstableDeps.length})
                        </div>
                        <div className="space-y-1">
                          {analysisData.unstableDeps.slice(0, 5).map(fileId => (
                            <button
                              key={fileId}
                              onClick={() => highlightFile(fileId)}
                              className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded transition truncate"
                              title={`Click to view ${fileId} in graph`}
                            >
                              {fileId}
                            </button>
                          ))}
                          {analysisData.unstableDeps.length > 5 && (
                            <button
                              onClick={() => highlightFiles(analysisData.unstableDeps)}
                              className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              + {analysisData.unstableDeps.length - 5} more (click to view all)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {analysisData.deepChains?.length > 0 && (
                      <div className="bg-gray-800 border border-purple-900 rounded p-2">
                        <div className="text-xs font-semibold text-purple-400 mb-1">
                          🔗 Deep Chains ({analysisData.deepChains.length})
                        </div>
                        <div className="space-y-1">
                          {analysisData.deepChains.slice(0, 5).map(fileId => (
                            <button
                              key={fileId}
                              onClick={() => highlightFile(fileId)}
                              className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded transition truncate"
                              title={`Click to view ${fileId} in graph`}
                            >
                              {fileId}
                            </button>
                          ))}
                          {analysisData.deepChains.length > 5 && (
                            <button
                              onClick={() => highlightFiles(analysisData.deepChains)}
                              className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              + {analysisData.deepChains.length - 5} more (click to view all)
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {reportType === 'cycles' && cycleData && cycleData.cycles?.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <h3 className="text-xs text-gray-400 font-semibold">📍 AFFECTED FILES (Click to view in graph)</h3>

                    {cycleData.cycles.map((cycle, idx) => (
                      <div key={idx} className="bg-gray-800 border border-red-900 rounded p-2">
                        <div className="text-xs font-semibold text-red-400 mb-1">
                          🔴 Cycle {idx + 1} ({cycle.length} files)
                        </div>
                        <div className="space-y-1">
                          {cycle.slice(0, 3).map(fileId => (
                            <button
                              key={fileId}
                              onClick={() => highlightFile(fileId)}
                              className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded transition truncate"
                              title={`Click to view ${fileId} in graph`}
                            >
                              {fileId}
                            </button>
                          ))}
                          {cycle.length > 3 && (
                            <button
                              onClick={() => highlightFiles(cycle)}
                              className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              + {cycle.length - 3} more (click to view all)
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Report Viewer Modal */}
      {showReportModal && (
        <ReportViewer
          report={reportType === 'cycles' ? cycleReport : analysisReport}
          reportType={reportType}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </aside>
  );
}


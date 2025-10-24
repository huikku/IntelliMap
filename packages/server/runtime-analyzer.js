/**
 * Runtime Analysis Module
 * Processes runtime traces and merges with static graph data
 */

/**
 * Merge static graph with runtime trace data
 * @param {Object} staticGraph - The static dependency graph
 * @param {Object} runtimeTrace - Runtime execution trace
 * @returns {Object} Merged graph with runtime annotations
 */
function mergeRuntimeData(staticGraph, runtimeTrace) {
  if (!runtimeTrace || !runtimeTrace.edges) {
    return {
      ...staticGraph,
      runtime: null,
    };
  }

  // Create maps for quick lookup
  const runtimeEdgeMap = new Map();
  const runtimeNodeMap = new Map();

  // Process runtime edges
  runtimeTrace.edges?.forEach(edge => {
    const key = `${edge.from}->${edge.to}`;
    runtimeEdgeMap.set(key, {
      count: edge.count || 1,
      totalTime: edge.totalTime || 0,
      avgTime: edge.avgTime || 0,
    });
  });

  // Process runtime node metrics
  runtimeTrace.nodes?.forEach(node => {
    runtimeNodeMap.set(node.id, {
      executionCount: node.executionCount || 0,
      totalTime: node.totalTime || 0,
      coverage: node.coverage || 0,
    });
  });

  // Annotate static edges with runtime data
  const annotatedEdges = staticGraph.edges.map(edge => {
    const key = `${edge.from}->${edge.to}`;
    const runtimeData = runtimeEdgeMap.get(key);
    
    return {
      ...edge,
      runtime: runtimeData || null,
      executed: !!runtimeData,
    };
  });

  // Annotate static nodes with runtime data
  const annotatedNodes = staticGraph.nodes.map(node => {
    const runtimeData = runtimeNodeMap.get(node.id);
    
    return {
      ...node,
      runtime: runtimeData || null,
      executed: runtimeData ? runtimeData.executionCount > 0 : false,
      coverage: runtimeData?.coverage || 0,
    };
  });

  // Calculate runtime-only edges (dynamic imports, reflection, etc.)
  const staticEdgeKeys = new Set(staticGraph.edges.map(e => `${e.from}->${e.to}`));
  const runtimeOnlyEdges = [];
  
  runtimeEdgeMap.forEach((data, key) => {
    if (!staticEdgeKeys.has(key)) {
      const [from, to] = key.split('->');
      runtimeOnlyEdges.push({
        from,
        to,
        type: 'dynamic',
        runtime: data,
        executed: true,
      });
    }
  });

  // Calculate metrics
  const totalStaticEdges = staticGraph.edges.length;
  const executedEdges = annotatedEdges.filter(e => e.executed).length;
  const coveragePercent = totalStaticEdges > 0 ? (executedEdges / totalStaticEdges) * 100 : 0;

  const totalNodes = staticGraph.nodes.length;
  const executedNodes = annotatedNodes.filter(n => n.executed).length;
  const nodeCoveragePercent = totalNodes > 0 ? (executedNodes / totalNodes) * 100 : 0;

  return {
    nodes: annotatedNodes,
    edges: [...annotatedEdges, ...runtimeOnlyEdges],
    runtime: {
      metadata: runtimeTrace.metadata || {},
      metrics: {
        totalStaticEdges,
        executedEdges,
        runtimeOnlyEdges: runtimeOnlyEdges.length,
        edgeCoveragePercent: coveragePercent,
        totalNodes,
        executedNodes,
        nodeCoveragePercent,
        deadEdges: totalStaticEdges - executedEdges,
        deadNodes: totalNodes - executedNodes,
      },
    },
  };
}

/**
 * Analyze performance hotspots from runtime data
 * @param {Object} graph - Graph with runtime annotations
 * @returns {Object} Hotspot analysis
 */
function analyzePerformanceHotspots(graph) {
  if (!graph.runtime) {
    return null;
  }

  // Find hot edges (by total time)
  const hotEdges = graph.edges
    .filter(e => e.runtime && e.runtime.totalTime > 0)
    .map(e => ({
      from: e.from,
      to: e.to,
      totalTime: e.runtime.totalTime,
      avgTime: e.runtime.avgTime,
      count: e.runtime.count,
    }))
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 20);

  // Find hot nodes (by total time)
  const hotNodes = graph.nodes
    .filter(n => n.runtime && n.runtime.totalTime > 0)
    .map(n => ({
      id: n.id,
      totalTime: n.runtime.totalTime,
      executionCount: n.runtime.executionCount,
      avgTime: n.runtime.executionCount > 0 ? n.runtime.totalTime / n.runtime.executionCount : 0,
    }))
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 20);

  // Calculate total time
  const totalTime = hotNodes.reduce((sum, n) => sum + n.totalTime, 0);

  // Calculate performance concentration (top 10 vs total)
  const top10Time = hotNodes.slice(0, 10).reduce((sum, n) => sum + n.totalTime, 0);
  const concentration = totalTime > 0 ? (top10Time / totalTime) * 100 : 0;

  return {
    hotEdges,
    hotNodes,
    totalTime,
    concentration,
  };
}

/**
 * Identify dead code (static but never executed)
 * @param {Object} graph - Graph with runtime annotations
 * @returns {Object} Dead code analysis
 */
function analyzeDeadCode(graph) {
  if (!graph.runtime) {
    return null;
  }

  const deadEdges = graph.edges.filter(e => !e.executed && e.type !== 'dynamic');
  const deadNodes = graph.nodes.filter(n => !n.executed);

  // Group dead nodes by directory
  const deadByDirectory = {};
  deadNodes.forEach(node => {
    const parts = node.id.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    if (!deadByDirectory[dir]) {
      deadByDirectory[dir] = [];
    }
    deadByDirectory[dir].push(node.id);
  });

  return {
    deadEdges: deadEdges.map(e => ({ from: e.from, to: e.to })),
    deadNodes: deadNodes.map(n => n.id),
    deadByDirectory,
    deadEdgeCount: deadEdges.length,
    deadNodeCount: deadNodes.length,
    deadCodeRatio: graph.nodes.length > 0 ? (deadNodes.length / graph.nodes.length) * 100 : 0,
  };
}

/**
 * Generate runtime coverage report
 * @param {Object} graph - Graph with runtime annotations
 * @returns {String} Markdown report
 */
function generateRuntimeReport(graph) {
  if (!graph.runtime) {
    return '# Runtime Analysis\n\n⚠️ No runtime data available.\n\nTo enable runtime analysis:\n1. Run your tests with coverage enabled\n2. Upload the trace file to IntelliMap\n3. Refresh the analysis';
  }

  const { metrics } = graph.runtime;
  const hotspots = analyzePerformanceHotspots(graph);
  const deadCode = analyzeDeadCode(graph);

  let report = '# Runtime Analysis Report\n\n';
  
  // Metadata
  if (graph.runtime.metadata) {
    report += `## Run Information\n`;
    if (graph.runtime.metadata.timestamp) {
      report += `- **Timestamp**: ${new Date(graph.runtime.metadata.timestamp).toLocaleString()}\n`;
    }
    if (graph.runtime.metadata.branch) {
      report += `- **Branch**: ${graph.runtime.metadata.branch}\n`;
    }
    if (graph.runtime.metadata.commit) {
      report += `- **Commit**: ${graph.runtime.metadata.commit}\n`;
    }
    if (graph.runtime.metadata.runId) {
      report += `- **Run ID**: ${graph.runtime.metadata.runId}\n`;
    }
    report += '\n';
  }

  // Coverage metrics
  report += `## Coverage Metrics\n\n`;
  report += `### Edge Coverage\n`;
  report += `- **Total Static Edges**: ${metrics.totalStaticEdges}\n`;
  report += `- **Executed Edges**: ${metrics.executedEdges}\n`;
  report += `- **Coverage**: ${metrics.edgeCoveragePercent.toFixed(1)}%\n`;
  report += `- **Dead Edges**: ${metrics.deadEdges}\n`;
  report += `- **Runtime-Only Edges**: ${metrics.runtimeOnlyEdges}\n\n`;

  report += `### Node Coverage\n`;
  report += `- **Total Nodes**: ${metrics.totalNodes}\n`;
  report += `- **Executed Nodes**: ${metrics.executedNodes}\n`;
  report += `- **Coverage**: ${metrics.nodeCoveragePercent.toFixed(1)}%\n`;
  report += `- **Dead Nodes**: ${metrics.deadNodes}\n\n`;

  // Performance hotspots
  if (hotspots && hotspots.hotNodes.length > 0) {
    report += `## Performance Hotspots\n\n`;
    report += `**Performance Concentration**: ${hotspots.concentration.toFixed(1)}% of time in top 10 modules\n\n`;
    
    report += `### Top 10 Slowest Modules\n\n`;
    hotspots.hotNodes.slice(0, 10).forEach((node, idx) => {
      report += `${idx + 1}. **${node.id}**\n`;
      report += `   - Total Time: ${node.totalTime.toFixed(2)}ms\n`;
      report += `   - Executions: ${node.executionCount}\n`;
      report += `   - Avg Time: ${node.avgTime.toFixed(2)}ms\n`;
    });
    report += '\n';
  }

  // Dead code
  if (deadCode && deadCode.deadNodeCount > 0) {
    report += `## Dead Code Analysis\n\n`;
    report += `**Dead Code Ratio**: ${deadCode.deadCodeRatio.toFixed(1)}%\n\n`;
    report += `### Unexecuted Modules (${deadCode.deadNodeCount})\n\n`;
    
    Object.entries(deadCode.deadByDirectory).forEach(([dir, files]) => {
      report += `**${dir}/** (${files.length} files)\n`;
      files.slice(0, 5).forEach(file => {
        report += `- ${file}\n`;
      });
      if (files.length > 5) {
        report += `- ... and ${files.length - 5} more\n`;
      }
      report += '\n';
    });
  }

  report += `## Recommendations\n\n`;
  if (metrics.edgeCoveragePercent < 70) {
    report += `⚠️ **Low edge coverage (${metrics.edgeCoveragePercent.toFixed(1)}%)** - Add more tests\n`;
  }
  if (deadCode && deadCode.deadCodeRatio > 20) {
    report += `⚠️ **High dead code ratio (${deadCode.deadCodeRatio.toFixed(1)}%)** - Consider removing unused code\n`;
  }
  if (hotspots && hotspots.concentration > 80) {
    report += `⚠️ **High performance concentration (${hotspots.concentration.toFixed(1)}%)** - Optimize top modules\n`;
  }
  if (metrics.runtimeOnlyEdges > 0) {
    report += `⚠️ **${metrics.runtimeOnlyEdges} dynamic edges detected** - Review dynamic imports and reflection\n`;
  }

  return report;
}

export {
  mergeRuntimeData,
  analyzePerformanceHotspots,
  analyzeDeadCode,
  generateRuntimeReport,
};


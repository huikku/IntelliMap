import { describe, test, expect } from '@jest/globals';
import {
  mergeRuntimeData,
  analyzePerformanceHotspots,
  analyzeDeadCode,
  generateRuntimeReport
} from './runtime-analyzer.js';

describe('Runtime Analyzer', () => {
  describe('mergeRuntimeData', () => {
    test('merges static graph with runtime trace', () => {
      const staticGraph = {
        nodes: [
          { id: 'a.js', lang: 'js', env: 'frontend' },
          { id: 'b.js', lang: 'js', env: 'frontend' }
        ],
        edges: [
          { from: 'a.js', to: 'b.js', kind: 'import' }
        ]
      };

      const runtimeTrace = {
        metadata: { timestamp: Date.now(), branch: 'main' },
        nodes: [
          { id: 'a.js', executionCount: 10, totalTime: 100, coverage: 0.8 }
        ],
        edges: [
          { from: 'a.js', to: 'b.js', count: 5, totalTime: 50 }
        ]
      };

      const result = mergeRuntimeData(staticGraph, runtimeTrace);

      expect(result.runtime).toBeDefined();
      expect(result.runtime.metadata).toEqual(runtimeTrace.metadata);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    test('handles missing runtime data', () => {
      const staticGraph = {
        nodes: [{ id: 'a.js' }],
        edges: []
      };

      const result = mergeRuntimeData(staticGraph, null);

      expect(result.runtime).toBeNull();
    });
  });



  describe('analyzePerformanceHotspots', () => {
    test('identifies slowest modules', () => {
      const graph = {
        nodes: Array.from({ length: 15 }, (_, i) => ({
          id: `file${i}.js`,
          runtime: { totalTime: (15 - i) * 10 }
        })),
        edges: [],
        runtime: { metadata: {} } // Need runtime object
      };

      const hotspots = analyzePerformanceHotspots(graph);

      expect(hotspots).not.toBeNull();
      expect(hotspots.hotNodes).toBeDefined();
      expect(Array.isArray(hotspots.hotNodes)).toBe(true);
      expect(hotspots.hotNodes.length).toBeGreaterThan(0);
    });

    test('returns null when no runtime data', () => {
      const graph = {
        nodes: [{ id: 'a.js' }],
        edges: []
      };

      const hotspots = analyzePerformanceHotspots(graph);

      expect(hotspots).toBeNull();
    });
  });

  describe('analyzeDeadCode', () => {
    test('identifies unexecuted modules', () => {
      const graph = {
        nodes: [
          { id: 'src/a.js', executed: true },
          { id: 'src/b.js', executed: false },
          { id: 'lib/c.js', executed: false }
        ],
        edges: [],
        runtime: { metadata: {} } // Need runtime object
      };

      const deadCode = analyzeDeadCode(graph);

      expect(deadCode).not.toBeNull();
      expect(deadCode.deadNodes).toBeDefined();
      expect(Array.isArray(deadCode.deadNodes)).toBe(true);
      expect(deadCode.deadCodeRatio).toBeGreaterThan(0);
    });

    test('returns null when no runtime data', () => {
      const graph = {
        nodes: [{ id: 'a.js' }],
        edges: []
      };

      const deadCode = analyzeDeadCode(graph);

      expect(deadCode).toBeNull();
    });
  });

  describe('generateRuntimeReport', () => {
    test('generates report with coverage data', () => {
      const graph = {
        nodes: [{ id: 'a.js' }, { id: 'b.js' }],
        edges: [{ from: 'a.js', to: 'b.js' }],
        runtime: {
          metadata: {
            timestamp: Date.now(),
            branch: 'main',
            commit: 'abc123'
          },
          nodeExecution: new Map([
            ['a.js', { executionCount: 10, totalTime: 100 }]
          ]),
          edgeExecution: new Map([
            ['a.js->b.js', { count: 5 }]
          ]),
          metrics: {
            totalNodes: 2,
            executedNodes: 1,
            nodeCoveragePercent: 50,
            totalStaticEdges: 1,
            executedEdges: 1,
            edgeCoveragePercent: 100
          }
        }
      };

      const report = generateRuntimeReport(graph);

      expect(report).toContain('# Runtime Analysis Report');
      expect(report).toContain('**Branch**: main');
      expect(report).toContain('**Commit**: abc123');
      expect(report).toContain('Node Coverage');
      expect(report).toContain('50.0%');
    });

    test('generates helpful message when no coverage found', () => {
      const graph = {
        nodes: [{ id: 'a.js' }],
        edges: [],
        runtime: {
          metadata: { timestamp: Date.now() },
          nodeExecution: new Map(),
          edgeExecution: new Map(),
          metrics: {
            totalNodes: 1,
            executedNodes: 0,
            nodeCoveragePercent: 0,
            totalStaticEdges: 0,
            executedEdges: 0,
            edgeCoveragePercent: 0
          }
        }
      };

      const report = generateRuntimeReport(graph);

      expect(report).toContain('⚠️ No Test Coverage Found');
      expect(report).toContain('Possible Reasons');
      expect(report).toContain('How to Fix');
      expect(report).toContain('npm install --save-dev jest');
    });

    test('returns message when no runtime data', () => {
      const graph = {
        nodes: [{ id: 'a.js' }],
        edges: []
      };

      const report = generateRuntimeReport(graph);

      expect(report).toContain('⚠️ No runtime data available');
    });
  });
});


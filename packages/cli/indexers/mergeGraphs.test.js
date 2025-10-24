import { describe, test, expect } from '@jest/globals';
import { mergeGraphs } from './mergeGraphs.js';

describe('mergeGraphs', () => {
  test('merges two empty graphs', () => {
    const graphs = {
      js: { nodes: [], edges: [] },
      py: { nodes: [], edges: [] }
    };

    const result = mergeGraphs(graphs);

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.meta).toBeDefined();
  });

  test('merges graphs with unique nodes', () => {
    const graphs = {
      js: {
        nodes: [{ id: 'a.js', lang: 'js', env: 'frontend' }],
        edges: []
      },
      py: {
        nodes: [{ id: 'b.py', lang: 'py', env: 'backend' }],
        edges: []
      }
    };

    const result = mergeGraphs(graphs);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map(n => n.id)).toContain('a.js');
    expect(result.nodes.map(n => n.id)).toContain('b.py');
  });

  test('deduplicates nodes with same id', () => {
    const graphs = {
      js: {
        nodes: [{ id: 'a.js', lang: 'js', env: 'frontend', size: 100 }],
        edges: []
      },
      ts: {
        nodes: [{ id: 'a.js', lang: 'js', env: 'frontend', size: 200 }],
        edges: []
      }
    };

    const result = mergeGraphs(graphs);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('a.js');
    // Should keep first occurrence
    expect(result.nodes[0].size).toBe(100);
  });

  test('merges edges from both graphs', () => {
    const graphs = {
      js: {
        nodes: [{ id: 'a.js' }, { id: 'b.js' }],
        edges: [{ from: 'a.js', to: 'b.js', kind: 'import' }]
      },
      py: {
        nodes: [{ id: 'b.py' }, { id: 'c.py' }],
        edges: [{ from: 'b.py', to: 'c.py', kind: 'import' }]
      }
    };

    const result = mergeGraphs(graphs);

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0]).toEqual({ from: 'a.js', to: 'b.js', kind: 'import' });
    expect(result.edges[1]).toEqual({ from: 'b.py', to: 'c.py', kind: 'import' });
  });

  test('deduplicates edges', () => {
    const graphs = {
      js: {
        nodes: [{ id: 'a.js' }, { id: 'b.js' }],
        edges: [{ from: 'a.js', to: 'b.js', kind: 'import' }]
      },
      ts: {
        nodes: [{ id: 'a.js' }, { id: 'b.js' }],
        edges: [{ from: 'a.js', to: 'b.js', kind: 'import' }]
      }
    };

    const result = mergeGraphs(graphs);

    expect(result.edges).toHaveLength(1);
  });

  test('handles null/undefined graphs', () => {
    const graphs1 = {
      js: { nodes: [{ id: 'a.js' }], edges: [] },
      py: null
    };

    const result1 = mergeGraphs(graphs1);
    expect(result1.nodes).toHaveLength(1);

    const graphs2 = {
      js: null,
      py: { nodes: [{ id: 'b.py' }], edges: [] }
    };

    const result2 = mergeGraphs(graphs2);
    expect(result2.nodes).toHaveLength(1);
  });

  test('preserves node metadata', () => {
    const graphs = {
      js: {
        nodes: [{
          id: 'a.js',
          lang: 'js',
          env: 'frontend',
          pkg: 'root',
          folder: 'src',
          changed: false,
          size: 1234
        }],
        edges: []
      }
    };

    const result = mergeGraphs(graphs);

    expect(result.nodes[0]).toEqual({
      id: 'a.js',
      lang: 'js',
      env: 'frontend',
      pkg: 'root',
      folder: 'src',
      changed: false,
      size: 1234
    });
  });
});


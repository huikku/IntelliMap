import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RAGDatabase } from './database.js';
import fs from 'fs-extra';
import { join } from 'node:path';

describe('RAGDatabase', () => {
  let db;
  const testDbPath = join(process.cwd(), '.intellimap', 'test-rag.db');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.removeSync(testDbPath);
    }
    db = new RAGDatabase(testDbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.removeSync(testDbPath);
    }
  });

  it('should initialize database schema', () => {
    // Check that tables exist
    const tables = db.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();

    const tableNames = tables.map(t => t.name);
    
    expect(tableNames).toContain('snapshots');
    expect(tableNames).toContain('files');
    expect(tableNames).toContain('metrics');
    expect(tableNames).toContain('deps');
    expect(tableNames).toContain('symbols');
    expect(tableNames).toContain('positions');
    expect(tableNames).toContain('worklist');
    expect(tableNames).toContain('chunks');
    expect(tableNames).toContain('vectors');
  });

  it('should create a snapshot', () => {
    const snapshotId = db.createSnapshot('test-hash-123', 'test-project', { foo: 'bar' });
    
    expect(snapshotId).toBeGreaterThan(0);
    
    const snapshot = db.getSnapshot(snapshotId);
    expect(snapshot.manifest_hash).toBe('test-hash-123');
    expect(snapshot.project).toBe('test-project');
  });

  it('should add files to snapshot', () => {
    const snapshotId = db.createSnapshot('test-hash-456', 'test-project');
    
    const fileId = db.addFile(
      snapshotId,
      'src/index.js',
      'content-hash-123',
      100,
      5000,
      new Date().toISOString(),
      'Main entry point',
      'react,vite'
    );
    
    expect(fileId).toBeGreaterThan(0);
    
    const file = db.db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    expect(file.path).toBe('src/index.js');
    expect(file.tags).toBe('react,vite');
  });

  it('should add metrics for a file', () => {
    const snapshotId = db.createSnapshot('test-hash-789', 'test-project');
    const fileId = db.addFile(snapshotId, 'src/app.js', 'hash-abc', 50, 2000);
    
    db.addMetrics(fileId, {
      complexity: 10,
      fanin: 5,
      fanout: 8,
      depth: 3,
      churn: 12,
      coverage: 0.85
    });
    
    const metrics = db.db.prepare('SELECT * FROM metrics WHERE file_id = ?').get(fileId);
    expect(metrics.complexity).toBe(10);
    expect(metrics.fanin).toBe(5);
    expect(metrics.fanout).toBe(8);
    expect(metrics.coverage).toBe(0.85);
  });

  it('should add dependencies', () => {
    const snapshotId = db.createSnapshot('test-hash-dep', 'test-project');
    const file1 = db.addFile(snapshotId, 'src/a.js', 'hash-a', 10, 100);
    const file2 = db.addFile(snapshotId, 'src/b.js', 'hash-b', 20, 200);
    
    db.addDependency(snapshotId, file1, file2);
    
    const deps = db.db.prepare('SELECT * FROM deps WHERE src_file_id = ?').all(file1);
    expect(deps.length).toBe(1);
    expect(deps[0].dst_file_id).toBe(file2);
  });

  it('should add symbols', () => {
    const snapshotId = db.createSnapshot('test-hash-sym', 'test-project');
    const fileId = db.addFile(snapshotId, 'src/utils.js', 'hash-utils', 30, 300);
    
    const symbolId = db.addSymbol(fileId, 'function', 'myFunction', 10, 25);
    
    expect(symbolId).toBeGreaterThan(0);
    
    const symbol = db.db.prepare('SELECT * FROM symbols WHERE id = ?').get(symbolId);
    expect(symbol.kind).toBe('function');
    expect(symbol.name).toBe('myFunction');
    expect(symbol.span_start).toBe(10);
    expect(symbol.span_end).toBe(25);
  });
});


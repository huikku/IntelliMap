import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * RAG Database Manager
 * Implements the MOTH RAG schema for code repository analysis
 */
export class RAGDatabase {
  constructor(dbPath = null) {
    // Default to .intellimap/rag.db in the current repo
    this.dbPath = dbPath || join(process.cwd(), '.intellimap', 'rag.db');
    
    // Ensure directory exists
    fs.ensureDirSync(dirname(this.dbPath));
    
    // Initialize database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeSchema();
  }

  initializeSchema() {
    // Create all tables according to MOTH RAG plan
    this.db.exec(`
      -- Snapshots: Immutable project snapshots
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        manifest_hash TEXT NOT NULL UNIQUE,
        project TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        meta_json TEXT -- JSON metadata
      );

      -- Files: Source files in each snapshot
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        loc INTEGER NOT NULL DEFAULT 0,
        size INTEGER NOT NULL DEFAULT 0,
        mtime TIMESTAMP,
        doc_snippet TEXT,
        tags TEXT, -- e.g. "react,tensorflow,vite"
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
        UNIQUE (snapshot_id, path)
      );

      -- Metrics: Code quality and complexity metrics
      CREATE TABLE IF NOT EXISTS metrics (
        file_id INTEGER PRIMARY KEY,
        complexity INTEGER DEFAULT 0,
        fanin INTEGER DEFAULT 0,
        fanout INTEGER DEFAULT 0,
        depth INTEGER DEFAULT 0,
        churn INTEGER DEFAULT 0,
        coverage REAL,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      -- Dependencies: Import/export relationships
      CREATE TABLE IF NOT EXISTS deps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        src_file_id INTEGER NOT NULL,
        dst_file_id INTEGER,
        dst_external TEXT,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
        FOREIGN KEY (src_file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (dst_file_id) REFERENCES files(id) ON DELETE CASCADE,
        UNIQUE (snapshot_id, src_file_id, dst_file_id, dst_external)
      );

      -- Symbols: Functions, classes, variables
      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        kind TEXT NOT NULL, -- 'function', 'class', 'variable', etc.
        name TEXT NOT NULL,
        span_start INTEGER,
        span_end INTEGER,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      -- Positions: ReactFlow node positions
      CREATE TABLE IF NOT EXISTS positions (
        file_id INTEGER PRIMARY KEY,
        x REAL,
        y REAL,
        pinned TEXT DEFAULT 'false', -- 'true', 'false', 'auto'
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      -- Worklist: Issues and TODOs
      CREATE TABLE IF NOT EXISTS worklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        file_id INTEGER,
        issue_type TEXT NOT NULL,
        severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
        notes TEXT,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      -- Chunks: Vectorized retrieval units (function/class or slice)
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        file_id INTEGER NOT NULL,
        symbol TEXT,
        path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        text TEXT NOT NULL,
        summary TEXT,
        content_hash TEXT NOT NULL,
        metrics_json TEXT, -- JSON: complexity, fanin, fanout, etc.
        deps_topN TEXT, -- JSON: top N dependencies
        embed_model TEXT,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      -- Vectors: Embeddings for chunks
      CREATE TABLE IF NOT EXISTS vectors (
        chunk_id INTEGER NOT NULL,
        model TEXT NOT NULL,
        dim INTEGER NOT NULL,
        vector BLOB NOT NULL,
        norm REAL,
        FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
        UNIQUE (chunk_id, model)
      );

      -- FTS5 virtual table for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_files USING fts5(
        path,
        doc_snippet,
        content,
        content_rowid UNINDEXED
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_files_snapshot ON files(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
      CREATE INDEX IF NOT EXISTS idx_deps_src ON deps(src_file_id);
      CREATE INDEX IF NOT EXISTS idx_deps_dst ON deps(dst_file_id);
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_chunks_snapshot ON chunks(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(content_hash);
      CREATE INDEX IF NOT EXISTS idx_worklist_snapshot ON worklist(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_worklist_severity ON worklist(severity);

      -- View: Hotspots by snapshot
      CREATE VIEW IF NOT EXISTS hotspots_by_snapshot AS
      SELECT 
        f.id as file_id,
        f.snapshot_id,
        f.path,
        m.fanin,
        m.fanout,
        m.depth,
        m.churn,
        m.coverage,
        m.complexity
      FROM files f
      LEFT JOIN metrics m ON f.id = m.file_id
      ORDER BY m.fanout DESC, m.churn DESC;
    `);

    console.log('✅ RAG database schema initialized');
  }

  /**
   * Create a new snapshot
   */
  createSnapshot(manifestHash, project, metaJson = null) {
    const stmt = this.db.prepare(`
      INSERT INTO snapshots (manifest_hash, project, meta_json)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(manifestHash, project, metaJson ? JSON.stringify(metaJson) : null);
    return result.lastInsertRowid;
  }

  /**
   * Get snapshot by ID or manifest hash
   */
  getSnapshot(idOrHash) {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots 
      WHERE id = ? OR manifest_hash = ?
    `);
    
    return stmt.get(idOrHash, idOrHash);
  }

  /**
   * Add a file to a snapshot
   */
  addFile(snapshotId, path, contentHash, loc, size, mtime = null, docSnippet = null, tags = null) {
    const stmt = this.db.prepare(`
      INSERT INTO files (snapshot_id, path, content_hash, loc, size, mtime, doc_snippet, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_id, path) DO UPDATE SET
        content_hash = excluded.content_hash,
        loc = excluded.loc,
        size = excluded.size,
        mtime = excluded.mtime,
        doc_snippet = excluded.doc_snippet,
        tags = excluded.tags
    `);
    
    const result = stmt.run(snapshotId, path, contentHash, loc, size, mtime, docSnippet, tags);
    return result.lastInsertRowid || this.db.prepare('SELECT id FROM files WHERE snapshot_id = ? AND path = ?').get(snapshotId, path).id;
  }

  /**
   * Add metrics for a file
   */
  addMetrics(fileId, metrics) {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (file_id, complexity, fanin, fanout, depth, churn, coverage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET
        complexity = excluded.complexity,
        fanin = excluded.fanin,
        fanout = excluded.fanout,
        depth = excluded.depth,
        churn = excluded.churn,
        coverage = excluded.coverage
    `);
    
    stmt.run(
      fileId,
      metrics.complexity || 0,
      metrics.fanin || 0,
      metrics.fanout || 0,
      metrics.depth || 0,
      metrics.churn || 0,
      metrics.coverage || null
    );
  }

  /**
   * Add a dependency
   */
  addDependency(snapshotId, srcFileId, dstFileId = null, dstExternal = null) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO deps (snapshot_id, src_file_id, dst_file_id, dst_external)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(snapshotId, srcFileId, dstFileId, dstExternal);
  }

  /**
   * Add a symbol
   */
  addSymbol(fileId, kind, name, spanStart = null, spanEnd = null) {
    const stmt = this.db.prepare(`
      INSERT INTO symbols (file_id, kind, name, span_start, span_end)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(fileId, kind, name, spanStart, spanEnd);
    return result.lastInsertRowid;
  }

  /**
   * Close the database
   */
  close() {
    this.db.close();
  }
}

export default RAGDatabase;


import crypto from 'crypto';
import fs from 'fs-extra';
import { join } from 'node:path';
import { RAGDatabase } from './database.js';
import { CodeChunker } from './chunker.js';

/**
 * Snapshot Manager
 * Creates and manages immutable snapshots of code repositories
 */
export class SnapshotManager {
  constructor(repoPath, dbPath = null) {
    this.repoPath = repoPath;
    this.db = new RAGDatabase(dbPath);
    this.chunker = new CodeChunker();
  }

  /**
   * Create a snapshot from IntelliMap graph
   * @param {Object} graph - IntelliMap graph.json
   * @returns {number} Snapshot ID
   */
  async createSnapshotFromGraph(graph) {
    // Generate manifest hash from graph
    const manifestHash = this.generateManifestHash(graph);
    
    // Check if snapshot already exists
    const existing = this.db.getSnapshot(manifestHash);
    if (existing) {
      console.log(`📦 Snapshot already exists: ${manifestHash}`);
      return existing.id;
    }

    // Extract project name from graph or repo path
    const projectName = graph.metadata?.project || this.repoPath.split('/').pop();

    // Create snapshot
    const snapshotId = this.db.createSnapshot(manifestHash, projectName, {
      timestamp: new Date().toISOString(),
      nodeCount: graph.nodes?.length || 0,
      edgeCount: graph.edges?.length || 0,
      repoPath: this.repoPath
    });

    console.log(`📸 Creating snapshot ${snapshotId} for ${projectName} (${manifestHash.substring(0, 8)}...)`);

    // Process nodes (files)
    const fileIdMap = new Map(); // path -> file_id
    
    for (const node of graph.nodes || []) {
      const filePath = node.id;
      const fileId = await this.processFile(snapshotId, node, fileIdMap);
      fileIdMap.set(filePath, fileId);
    }

    // Process edges (dependencies)
    for (const edge of graph.edges || []) {
      const srcFileId = fileIdMap.get(edge.source);
      const dstFileId = fileIdMap.get(edge.target);
      
      if (srcFileId && dstFileId) {
        this.db.addDependency(snapshotId, srcFileId, dstFileId);
      } else if (srcFileId && !dstFileId) {
        // External dependency
        this.db.addDependency(snapshotId, srcFileId, null, edge.target);
      }
    }

    console.log(`✅ Snapshot ${snapshotId} created with ${fileIdMap.size} files`);
    return snapshotId;
  }

  /**
   * Process a single file node
   */
  async processFile(snapshotId, node, fileIdMap) {
    const filePath = node.id;
    const fullPath = join(this.repoPath, filePath);

    // Read file content
    let content = '';
    let loc = 0;
    let size = 0;
    let mtime = null;

    try {
      if (await fs.pathExists(fullPath)) {
        content = await fs.readFile(fullPath, 'utf-8');
        loc = content.split('\n').length;
        size = content.length;
        const stats = await fs.stat(fullPath);
        mtime = stats.mtime.toISOString();
      }
    } catch (error) {
      console.warn(`⚠️  Could not read file ${filePath}: ${error.message}`);
    }

    // Generate content hash
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Extract doc snippet (first comment or docstring)
    const docSnippet = this.extractDocSnippet(content);

    // Detect tags from file path and content
    const tags = this.detectTags(filePath, content);

    // Add file to database
    const fileId = this.db.addFile(
      snapshotId,
      filePath,
      contentHash,
      loc,
      size,
      mtime,
      docSnippet,
      tags.join(',')
    );

    // Add metrics from node data
    if (node.data) {
      this.db.addMetrics(fileId, {
        complexity: node.data.complexity || 0,
        fanin: node.data.fanin || 0,
        fanout: node.data.fanout || 0,
        depth: node.data.depth || 0,
        churn: node.data.churn || 0,
        coverage: node.data.coverage || null
      });
    }

    // Extract and store symbols (if available)
    const symbols = this.extractSymbols(content, filePath);
    for (const symbol of symbols) {
      this.db.addSymbol(fileId, symbol.kind, symbol.name, symbol.span_start, symbol.span_end);
    }

    // Create chunks for RAG
    await this.createChunks(snapshotId, fileId, filePath, content, symbols);

    return fileId;
  }

  /**
   * Create chunks for a file
   */
  async createChunks(snapshotId, fileId, filePath, content, symbols) {
    const chunks = this.chunker.chunkFile(filePath, content, symbols);

    const stmt = this.db.db.prepare(`
      INSERT INTO chunks (snapshot_id, file_id, symbol, path, start_line, end_line, text, summary, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const chunk of chunks) {
      const summary = this.chunker.generateSummary(chunk.text);
      
      stmt.run(
        snapshotId,
        fileId,
        chunk.symbol,
        chunk.path,
        chunk.start_line,
        chunk.end_line,
        chunk.text,
        summary,
        chunk.content_hash
      );
    }
  }

  /**
   * Extract doc snippet from file content
   */
  extractDocSnippet(content) {
    // Look for file-level docstring or comment
    const docMatch = content.match(/^\/\*\*([\s\S]*?)\*\/|^"""([\s\S]*?)"""|^'''([\s\S]*?)'''/);
    if (docMatch) {
      const doc = (docMatch[1] || docMatch[2] || docMatch[3]).trim();
      return doc.split('\n').slice(0, 3).join(' ').substring(0, 200);
    }
    return null;
  }

  /**
   * Detect tags from file path and content
   */
  detectTags(filePath, content) {
    const tags = new Set();

    // Framework detection
    if (content.includes('import React') || content.includes('from \'react\'')) tags.add('react');
    if (content.includes('import Vue') || content.includes('from \'vue\'')) tags.add('vue');
    if (content.includes('import tensorflow') || content.includes('import torch')) tags.add('ml');
    if (content.includes('import express') || content.includes('from \'express\'')) tags.add('express');
    if (content.includes('import vite') || content.includes('from \'vite\'')) tags.add('vite');

    // File type detection
    if (filePath.endsWith('.test.js') || filePath.endsWith('.spec.js')) tags.add('test');
    if (filePath.includes('config')) tags.add('config');
    if (filePath.includes('build')) tags.add('build');
    if (filePath.includes('component')) tags.add('component');
    if (filePath.includes('util') || filePath.includes('helper')) tags.add('util');

    return Array.from(tags);
  }

  /**
   * Extract symbols from content (basic implementation)
   */
  extractSymbols(content, filePath) {
    const symbols = [];
    const lines = content.split('\n');

    // JavaScript/TypeScript function detection
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+([\w]+)\s*\(/g;
    const classRegex = /(?:export\s+)?class\s+([\w]+)/g;
    const constRegex = /(?:export\s+)?const\s+([\w]+)\s*=/g;

    let match;
    
    // Find functions
    while ((match = functionRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length - 1;
      symbols.push({
        kind: 'function',
        name: match[1],
        span_start: lineNum,
        span_end: this.findBlockEnd(lines, lineNum)
      });
    }

    // Find classes
    while ((match = classRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length - 1;
      symbols.push({
        kind: 'class',
        name: match[1],
        span_start: lineNum,
        span_end: this.findBlockEnd(lines, lineNum)
      });
    }

    // Find constants
    while ((match = constRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length - 1;
      symbols.push({
        kind: 'const',
        name: match[1],
        span_start: lineNum,
        span_end: lineNum
      });
    }

    return symbols;
  }

  /**
   * Find the end of a code block (simple brace matching)
   */
  findBlockEnd(lines, startLine) {
    let braceCount = 0;
    let inBlock = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inBlock = true;
        } else if (char === '}') {
          braceCount--;
          if (inBlock && braceCount === 0) {
            return i;
          }
        }
      }
    }

    return Math.min(startLine + 50, lines.length - 1); // Fallback
  }

  /**
   * Generate manifest hash from graph
   */
  generateManifestHash(graph) {
    const manifest = {
      nodes: graph.nodes?.map(n => ({ id: n.id, type: n.type })) || [],
      edges: graph.edges?.map(e => ({ source: e.source, target: e.target })) || [],
      timestamp: new Date().toISOString().split('T')[0] // Date only for daily snapshots
    };

    return crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

export default SnapshotManager;


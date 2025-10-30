import { RAGDatabase } from './database.js';
import { EmbeddingService } from './embedding-service.js';

/**
 * Vector Index Manager
 * Manages vector embeddings and similarity search
 * Uses SQLite for storage with in-memory index for fast retrieval
 */
export class VectorIndex {
  constructor(dbPath = null, embeddingOptions = {}) {
    this.db = new RAGDatabase(dbPath);
    this.embeddingService = new EmbeddingService(embeddingOptions);
    
    // In-memory index for fast similarity search
    // Map: snapshot_id -> Array<{chunk_id, vector, norm}>
    this.index = new Map();
  }

  /**
   * Embed and store a chunk
   * @param {number} chunkId - Chunk ID
   * @param {string} text - Chunk text
   * @param {string} type - 'code' or 'docs'
   */
  async embedChunk(chunkId, text, type = 'code') {
    // Generate embedding
    const { vector, model, dim } = await this.embeddingService.embed(text, type);
    
    // Calculate norm for faster similarity search
    const norm = this.calculateNorm(vector);
    
    // Store in database
    const stmt = this.db.db.prepare(`
      INSERT INTO vectors (chunk_id, model, dim, vector, norm)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(chunk_id, model) DO UPDATE SET
        vector = excluded.vector,
        norm = excluded.norm
    `);
    
    // Convert Float32Array to Buffer for SQLite
    const vectorBuffer = Buffer.from(vector.buffer);
    
    stmt.run(chunkId, model, dim, vectorBuffer, norm);
    
    return { chunkId, model, dim, norm };
  }

  /**
   * Embed all chunks in a snapshot
   * @param {number} snapshotId - Snapshot ID
   * @param {string} type - 'code' or 'docs'
   * @param {Function} onProgress - Optional callback for progress updates (current, total, percentage)
   */
  async embedSnapshot(snapshotId, type = 'code', onProgress = null) {
    // Get all chunks for this snapshot
    const chunks = this.db.db.prepare(`
      SELECT id, text FROM chunks WHERE snapshot_id = ?
    `).all(snapshotId);

    console.log(`🔢 Embedding ${chunks.length} chunks for snapshot ${snapshotId}...`);

    let embedded = 0;
    for (const chunk of chunks) {
      try {
        await this.embedChunk(chunk.id, chunk.text, type);
        embedded++;

        // Report progress
        const percentage = Math.round((embedded / chunks.length) * 100);
        if (onProgress) {
          onProgress(embedded, chunks.length, percentage);
        }

        if (embedded % 10 === 0) {
          console.log(`  Embedded ${embedded}/${chunks.length} chunks (${percentage}%)...`);
        }
      } catch (error) {
        console.error(`  ⚠️  Failed to embed chunk ${chunk.id}: ${error.message}`);
      }
    }

    console.log(`✅ Embedded ${embedded}/${chunks.length} chunks`);

    // Build in-memory index for this snapshot
    await this.buildIndex(snapshotId);

    return embedded;
  }

  /**
   * Build in-memory index for a snapshot
   */
  async buildIndex(snapshotId) {
    const vectors = this.db.db.prepare(`
      SELECT v.chunk_id, v.vector, v.norm, v.dim
      FROM vectors v
      JOIN chunks c ON v.chunk_id = c.id
      WHERE c.snapshot_id = ?
    `).all(snapshotId);

    const indexData = vectors.map(v => ({
      chunk_id: v.chunk_id,
      vector: new Float32Array(v.vector.buffer, v.vector.byteOffset, v.dim),
      norm: v.norm
    }));

    this.index.set(snapshotId, indexData);
    console.log(`📇 Built index for snapshot ${snapshotId} with ${indexData.length} vectors`);
  }

  /**
   * Search for similar chunks
   * @param {string} query - Query text
   * @param {number} snapshotId - Snapshot ID
   * @param {number} topK - Number of results to return
   * @param {string} type - 'code' or 'docs'
   * @returns {Promise<Array<{chunk_id, score, chunk}>>}
   */
  async search(query, snapshotId, topK = 10, type = 'code') {
    // Embed the query
    const { vector: queryVector } = await this.embeddingService.embed(query, type);
    
    // Ensure index is built
    if (!this.index.has(snapshotId)) {
      await this.buildIndex(snapshotId);
    }

    const indexData = this.index.get(snapshotId);
    if (!indexData || indexData.length === 0) {
      return [];
    }

    // Calculate similarities
    const results = indexData.map(item => ({
      chunk_id: item.chunk_id,
      score: this.embeddingService.cosineSimilarity(queryVector, item.vector)
    }));

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Get top K
    const topResults = results.slice(0, topK);

    // Fetch chunk details
    const chunks = topResults.map(result => {
      const chunk = this.db.db.prepare(`
        SELECT c.*, f.path as file_path
        FROM chunks c
        JOIN files f ON c.file_id = f.id
        WHERE c.id = ?
      `).get(result.chunk_id);

      return {
        chunk_id: result.chunk_id,
        score: result.score,
        chunk: chunk
      };
    });

    return chunks;
  }

  /**
   * Hybrid search: combine FTS and vector search
   * @param {string} query - Query text
   * @param {number} snapshotId - Snapshot ID
   * @param {number} topK - Number of results to return
   * @returns {Promise<Array<{chunk_id, score, chunk}>>}
   */
  async hybridSearch(query, snapshotId, topK = 10) {
    // 1. FTS search to get candidate chunks
    const ftsResults = this.db.db.prepare(`
      SELECT c.id, c.text, c.path, f.path as file_path
      FROM chunks c
      JOIN files f ON c.file_id = f.id
      WHERE c.snapshot_id = ?
        AND (c.text LIKE ? OR c.path LIKE ?)
      LIMIT 50
    `).all(snapshotId, `%${query}%`, `%${query}%`);

    if (ftsResults.length === 0) {
      // Fall back to pure vector search
      return await this.search(query, snapshotId, topK);
    }

    // 2. Rerank with vector similarity
    const { vector: queryVector } = await this.embeddingService.embed(query, 'code');
    
    const reranked = [];
    for (const result of ftsResults) {
      // Get vector for this chunk
      const vectorData = this.db.db.prepare(`
        SELECT vector, dim FROM vectors WHERE chunk_id = ?
      `).get(result.id);

      if (vectorData) {
        const chunkVector = new Float32Array(
          vectorData.vector.buffer,
          vectorData.vector.byteOffset,
          vectorData.dim
        );
        
        const score = this.embeddingService.cosineSimilarity(queryVector, chunkVector);
        
        reranked.push({
          chunk_id: result.id,
          score: score,
          chunk: result
        });
      }
    }

    // Sort by score and return top K
    reranked.sort((a, b) => b.score - a.score);
    return reranked.slice(0, topK);
  }

  /**
   * Calculate vector norm
   */
  calculateNorm(vector) {
    let sum = 0;
    for (let i = 0; i < vector.length; i++) {
      sum += vector[i] * vector[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * Get embedding statistics
   */
  getStats(snapshotId = null) {
    let query = 'SELECT COUNT(*) as count, AVG(dim) as avg_dim FROM vectors';
    let params = [];

    if (snapshotId) {
      query = `
        SELECT COUNT(*) as count, AVG(v.dim) as avg_dim
        FROM vectors v
        JOIN chunks c ON v.chunk_id = c.id
        WHERE c.snapshot_id = ?
      `;
      params = [snapshotId];
    }

    return this.db.db.prepare(query).get(...params);
  }

  /**
   * Clear in-memory index
   */
  clearIndex() {
    this.index.clear();
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

export default VectorIndex;


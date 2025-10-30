import { RAGDatabase } from './database.js';
import { VectorIndex } from './vector-index.js';
import { ModelRouter } from './model-router.js';
import Fuse from 'fuse.js';

/**
 * Retrieval Workflow
 * Implements the MOTH RAG retrieval pipeline:
 * seed → graph_prefilter → fts_filter → vector_rerank → pack → answer
 */
export class RetrievalWorkflow {
  constructor(dbPath = null, options = {}) {
    this.db = new RAGDatabase(dbPath);
    this.vectorIndex = new VectorIndex(dbPath, options.embedding);
    this.modelRouter = new ModelRouter(options.models);
    
    // Packing rules from MOTH plan
    this.maxChunks = options.maxChunks || 8;
    this.chunkSizeTokens = options.chunkSizeTokens || { min: 600, max: 800, oversize: 1200 };
    this.worklistBias = options.worklistBias !== undefined ? options.worklistBias : true;
  }

  /**
   * Main retrieval workflow
   * @param {string} question - User question
   * @param {number} snapshotId - Snapshot ID
   * @param {Object} options - Additional options
   */
  async retrieve(question, snapshotId, options = {}) {
    console.log(`🔍 Starting retrieval for: "${question}"`);

    // Step 1: Seed (extract hints from question)
    const seeds = this.extractSeeds(question);
    console.log(`  Seeds: ${JSON.stringify(seeds)}`);

    // Step 2: Graph prefilter (filter by path hints, symbols)
    let candidateChunks = await this.graphPrefilter(snapshotId, seeds);
    console.log(`  Graph prefilter: ${candidateChunks.length} candidates`);

    // Step 3: FTS filter (full-text search)
    if (candidateChunks.length > 50) {
      candidateChunks = await this.ftsFilter(question, candidateChunks);
      console.log(`  FTS filter: ${candidateChunks.length} candidates`);
    }

    // Step 4: Vector rerank (semantic similarity)
    const rankedChunks = await this.vectorRerank(question, candidateChunks);
    console.log(`  Vector rerank: ${rankedChunks.length} ranked`);

    // Step 5: Pack (select top chunks within token budget)
    const packedChunks = await this.pack(rankedChunks, snapshotId);
    console.log(`  Packed: ${packedChunks.length} chunks`);

    // Step 6: Generate answer with citations
    const answer = await this.answer(question, packedChunks, snapshotId, options);

    return {
      answer: answer.content,
      citations: answer.citations,
      chunks: packedChunks,
      metadata: {
        totalCandidates: candidateChunks.length,
        rankedCount: rankedChunks.length,
        packedCount: packedChunks.length,
        model: answer.model,
        tokensIn: answer.tokensIn,
        tokensOut: answer.tokensOut,
        cost: answer.cost
      }
    };
  }

  /**
   * Extract seed hints from question
   */
  extractSeeds(question) {
    const seeds = {
      paths: [],
      symbols: [],
      keywords: []
    };

    // Extract file paths (e.g., "in src/app.js")
    const pathMatches = question.match(/(?:in|file|path)\s+([a-zA-Z0-9_\-./]+\.[a-z]+)/gi);
    if (pathMatches) {
      seeds.paths = pathMatches.map(m => m.split(/\s+/).pop());
    }

    // Extract symbols (e.g., "function myFunc", "class MyClass")
    const symbolMatches = question.match(/(?:function|class|method|variable)\s+([a-zA-Z0-9_]+)/gi);
    if (symbolMatches) {
      seeds.symbols = symbolMatches.map(m => m.split(/\s+/).pop());
    }

    // Extract keywords
    const keywords = question.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['what', 'where', 'when', 'which', 'this', 'that', 'with', 'from'].includes(w));
    
    seeds.keywords = keywords.slice(0, 5);

    return seeds;
  }

  /**
   * Graph prefilter: Filter chunks by graph structure
   */
  async graphPrefilter(snapshotId, seeds) {
    let chunks = [];

    // If we have path hints, filter by path
    if (seeds.paths.length > 0) {
      for (const path of seeds.paths) {
        const pathChunks = this.db.db.prepare(`
          SELECT c.*, f.path as file_path
          FROM chunks c
          JOIN files f ON c.file_id = f.id
          WHERE c.snapshot_id = ? AND f.path LIKE ?
        `).all(snapshotId, `%${path}%`);
        
        chunks.push(...pathChunks);
      }
    }

    // If we have symbol hints, filter by symbol
    if (seeds.symbols.length > 0) {
      for (const symbol of seeds.symbols) {
        const symbolChunks = this.db.db.prepare(`
          SELECT c.*, f.path as file_path
          FROM chunks c
          JOIN files f ON c.file_id = f.id
          WHERE c.snapshot_id = ? AND c.symbol LIKE ?
        `).all(snapshotId, `%${symbol}%`);
        
        chunks.push(...symbolChunks);
      }
    }

    // If no specific hints, get all chunks (will be filtered by FTS/vector)
    if (chunks.length === 0) {
      chunks = this.db.db.prepare(`
        SELECT c.*, f.path as file_path
        FROM chunks c
        JOIN files f ON c.file_id = f.id
        WHERE c.snapshot_id = ?
        LIMIT 200
      `).all(snapshotId);
    }

    // Deduplicate by chunk ID
    const uniqueChunks = Array.from(
      new Map(chunks.map(c => [c.id, c])).values()
    );

    return uniqueChunks;
  }

  /**
   * FTS filter: Full-text search with fuzzy matching
   */
  async ftsFilter(query, chunks) {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    // First try exact matching
    const exactMatches = chunks.filter(chunk => {
      const text = chunk.text.toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    });

    // If we have good exact matches, return them
    if (exactMatches.length >= 5) {
      return exactMatches;
    }

    // Otherwise, use fuzzy matching on chunk text
    const fuse = new Fuse(chunks, {
      keys: ['text', 'file_path'],
      threshold: 0.4, // More lenient for spelling mistakes
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });

    const fuzzyResults = fuse.search(query);
    const fuzzyMatches = fuzzyResults.map(result => result.item);

    // Combine exact and fuzzy matches, prioritizing exact
    const combined = [...exactMatches];
    for (const fuzzyMatch of fuzzyMatches) {
      if (!combined.find(c => c.id === fuzzyMatch.id)) {
        combined.push(fuzzyMatch);
      }
    }

    return combined;
  }

  /**
   * Vector rerank: Semantic similarity ranking
   */
  async vectorRerank(query, chunks) {
    if (chunks.length === 0) return [];

    // Get query embedding
    const { vector: queryVector } = await this.vectorIndex.embeddingService.embed(query, 'code');

    // Calculate similarity for each chunk
    const ranked = [];
    for (const chunk of chunks) {
      const vectorData = this.db.db.prepare(`
        SELECT vector, dim FROM vectors WHERE chunk_id = ?
      `).get(chunk.id);

      if (vectorData) {
        const chunkVector = new Float32Array(
          vectorData.vector.buffer,
          vectorData.vector.byteOffset,
          vectorData.dim
        );
        
        const score = this.vectorIndex.embeddingService.cosineSimilarity(queryVector, chunkVector);
        
        ranked.push({
          ...chunk,
          similarity_score: score
        });
      }
    }

    // Sort by similarity score
    ranked.sort((a, b) => b.similarity_score - a.similarity_score);

    return ranked;
  }

  /**
   * Pack: Select chunks within token budget
   */
  async pack(chunks, snapshotId) {
    const packed = [];
    let totalTokens = 0;

    // Apply worklist bias (prioritize files with issues)
    if (this.worklistBias) {
      chunks = await this.applyWorklistBias(chunks, snapshotId);
    }

    for (const chunk of chunks) {
      if (packed.length >= this.maxChunks) break;

      const chunkTokens = Math.ceil(chunk.text.length / 4); // Rough estimate
      
      // Allow one oversize chunk
      if (chunkTokens > this.chunkSizeTokens.oversize) {
        if (packed.length === 0) {
          packed.push(chunk);
        }
        continue;
      }

      if (totalTokens + chunkTokens <= this.maxChunks * this.chunkSizeTokens.max) {
        packed.push(chunk);
        totalTokens += chunkTokens;
      }
    }

    return packed;
  }

  /**
   * Apply worklist bias: Prioritize chunks from files with issues
   */
  async applyWorklistBias(chunks, snapshotId) {
    // Get files with high-severity issues
    const worklistFiles = this.db.db.prepare(`
      SELECT DISTINCT file_id FROM worklist
      WHERE snapshot_id = ? AND severity IN ('high', 'critical')
    `).all(snapshotId).map(r => r.file_id);

    // Boost chunks from worklist files
    return chunks.map(chunk => ({
      ...chunk,
      similarity_score: worklistFiles.includes(chunk.file_id)
        ? chunk.similarity_score * 1.2
        : chunk.similarity_score
    })).sort((a, b) => b.similarity_score - a.similarity_score);
  }

  /**
   * Generate answer with LLM
   */
  async answer(question, chunks, snapshotId, options = {}) {
    // Get snapshot metadata
    const snapshot = this.db.getSnapshot(snapshotId);

    // Get file statistics for metadata-aware queries
    const fileStats = this.db.db.prepare(`
      SELECT
        f.path,
        f.loc,
        f.size,
        m.complexity,
        m.fanin,
        m.fanout,
        m.churn,
        m.age,
        m.authors,
        m.hotspot
      FROM files f
      LEFT JOIN metrics m ON f.id = m.file_id
      WHERE f.snapshot_id = ?
      ORDER BY f.size DESC
    `).all(snapshotId);

    // Build file statistics summary (top files by different metrics)
    const topBySize = fileStats.slice(0, 20);
    const topByLoc = [...fileStats].sort((a, b) => b.loc - a.loc).slice(0, 20);
    const topByComplexity = [...fileStats].filter(f => f.complexity).sort((a, b) => b.complexity - a.complexity).slice(0, 20);
    const topByChurn = [...fileStats].filter(f => f.churn).sort((a, b) => b.churn - a.churn).slice(0, 20);
    const topByHotspot = [...fileStats].filter(f => f.hotspot).sort((a, b) => b.hotspot - a.hotspot).slice(0, 20);
    const topByAge = [...fileStats].filter(f => f.age !== null).sort((a, b) => b.age - a.age).slice(0, 20);

    const fileStatsSummary = `
FILE STATISTICS (Top 20 by each metric):

Top Files by Size (bytes):
${topBySize.map((f, i) => `${i + 1}. ${f.path} - ${f.size} bytes, ${f.loc} LOC`).join('\n')}

Top Files by Lines of Code:
${topByLoc.map((f, i) => `${i + 1}. ${f.path} - ${f.loc} LOC, ${f.size} bytes`).join('\n')}

Top Files by Complexity:
${topByComplexity.map((f, i) => `${i + 1}. ${f.path} - Complexity: ${f.complexity}, LOC: ${f.loc}`).join('\n')}

Top Files by Churn (most changed):
${topByChurn.map((f, i) => `${i + 1}. ${f.path} - Churn: ${f.churn} commits, Complexity: ${f.complexity || 0}`).join('\n')}

Top Hotspot Files (complexity × churn):
${topByHotspot.map((f, i) => `${i + 1}. ${f.path} - Hotspot: ${f.hotspot?.toFixed(2)}, Complexity: ${f.complexity}, Churn: ${f.churn}`).join('\n')}

Oldest Files (by age):
${topByAge.map((f, i) => `${i + 1}. ${f.path} - Age: ${f.age} days, Authors: ${f.authors || 'N/A'}`).join('\n')}
`;

    // Build context from chunks
    const context = chunks.map((chunk, i) =>
      `[${i + 1}] ${chunk.file_path}:${chunk.start_line}-${chunk.end_line}\n${chunk.text}`
    ).join('\n\n---\n\n');

    const snapshotHeader = `Project: ${snapshot.project}\nSnapshot: ${snapshot.manifest_hash.substring(0, 8)}\nDate: ${snapshot.created_at}\nTotal Files: ${fileStats.length}`;

    // Build prompt with file statistics
    const systemPrompt = `You are RepoGPT, a code analysis assistant. Answer questions about the codebase using the provided context and file statistics.

${snapshotHeader}

${fileStatsSummary}

Code Context (relevant chunks):
${context}

IMPORTANT CITATION RULES:
- For questions about file sizes, LOC, complexity, churn, or other metrics: cite files as "path:1-1" (use line 1)
- For questions about code content: cite the actual line numbers from the Code Context section
- Always include citations in your answer
- Be specific and provide exact numbers when available
- List files in order of relevance to the question`;

    const userPrompt = question;

    // Route to appropriate model
    const task = options.task || 'explain';
    const result = await this.modelRouter.route(task, userPrompt, {
      systemPrompt,
      maxTokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7
    });

    // Extract citations from answer
    const citations = this.extractCitations(result.content, chunks);

    return {
      content: result.content,
      citations,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cost: result.cost
    };
  }

  /**
   * Extract citations from answer
   */
  extractCitations(answer, chunks) {
    const citations = [];
    const citationRegex = /([a-zA-Z0-9_\-./]+):(\d+)(?:-(\d+))?/g;
    
    let match;
    while ((match = citationRegex.exec(answer)) !== null) {
      citations.push({
        path: match[1],
        start_line: parseInt(match[2]),
        end_line: match[3] ? parseInt(match[3]) : parseInt(match[2])
      });
    }

    return citations;
  }

  /**
   * Close connections
   */
  close() {
    this.db.close();
    this.vectorIndex.close();
  }
}

export default RetrievalWorkflow;


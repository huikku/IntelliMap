import crypto from 'crypto';

/**
 * Embedding Service
 * Supports multiple embedding providers: Voyage AI, OpenAI, Cohere
 * Following MOTH RAG plan: voyage-code-3 for code, voyage-3-large for docs
 */
export class EmbeddingService {
  constructor(options = {}) {
    this.provider = options.provider || 'openai'; // Default to OpenAI for now
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.voyageApiKey = options.voyageApiKey || process.env.VOYAGE_API_KEY;
    this.cohereApiKey = options.cohereApiKey || process.env.COHERE_API_KEY;
    
    // Model selection based on content type
    this.codeModel = options.codeModel || 'text-embedding-3-large'; // Fallback: OpenAI
    this.docsModel = options.docsModel || 'text-embedding-3-large'; // Fallback: OpenAI
    
    // Cache for embeddings (content_hash -> embedding)
    this.cache = new Map();
  }

  /**
   * Generate embedding for text
   * @param {string} text - Text to embed
   * @param {string} type - 'code' or 'docs'
   * @returns {Promise<{vector: Float32Array, model: string, dim: number}>}
   */
  async embed(text, type = 'code') {
    // Check cache first
    const contentHash = this.hashContent(text);
    if (this.cache.has(contentHash)) {
      return this.cache.get(contentHash);
    }

    let result;
    
    // Select model based on type
    const model = type === 'code' ? this.codeModel : this.docsModel;

    // Route to appropriate provider
    if (this.provider === 'voyage' && this.voyageApiKey) {
      result = await this.embedVoyage(text, model);
    } else if (this.provider === 'cohere' && this.cohereApiKey) {
      result = await this.embedCohere(text, model);
    } else {
      // Default to OpenAI
      result = await this.embedOpenAI(text, model);
    }

    // Cache the result
    this.cache.set(contentHash, result);

    return result;
  }

  /**
   * Embed using OpenAI API
   */
  async embedOpenAI(text, model = 'text-embedding-3-large') {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: model,
        encoding_format: 'float'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding failed: ${error}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    return {
      vector: new Float32Array(embedding),
      model: model,
      dim: embedding.length
    };
  }

  /**
   * Embed using Voyage AI API
   */
  async embedVoyage(text, model = 'voyage-code-3') {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.voyageApiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: model
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage AI embedding failed: ${error}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    return {
      vector: new Float32Array(embedding),
      model: model,
      dim: embedding.length
    };
  }

  /**
   * Embed using Cohere API
   */
  async embedCohere(text, model = 'embed-english-v3.0') {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.cohereApiKey}`
      },
      body: JSON.stringify({
        texts: [text],
        model: model,
        input_type: 'search_document'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere embedding failed: ${error}`);
    }

    const data = await response.json();
    const embedding = data.embeddings[0];

    return {
      vector: new Float32Array(embedding),
      model: model,
      dim: embedding.length
    };
  }

  /**
   * Batch embed multiple texts
   * @param {Array<string>} texts - Texts to embed
   * @param {string} type - 'code' or 'docs'
   * @returns {Promise<Array<{vector: Float32Array, model: string, dim: number}>>}
   */
  async embedBatch(texts, type = 'code') {
    // For now, embed sequentially (can be optimized with batch APIs)
    const results = [];
    
    for (const text of texts) {
      const result = await this.embed(text, type);
      results.push(result);
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Normalize a vector
   */
  normalize(vector) {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / norm;
    }

    return normalized;
  }

  /**
   * Hash content for caching
   */
  hashContent(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize() {
    return this.cache.size;
  }
}

export default EmbeddingService;


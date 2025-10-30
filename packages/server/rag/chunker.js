import crypto from 'crypto';

/**
 * Code Chunker for RAG
 * Splits code into semantic chunks (functions, classes, or slices)
 * Following MOTH RAG plan: 600-800 tokens per chunk, max 1200 for oversized
 */
export class CodeChunker {
  constructor(options = {}) {
    this.minTokens = options.minTokens || 600;
    this.maxTokens = options.maxTokens || 800;
    this.maxOversizeTokens = options.maxOversizeTokens || 1200;
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 chars)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate content hash for deduplication
   */
  hashContent(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Chunk a file into semantic units
   * @param {string} filePath - Path to the file
   * @param {string} content - File content
   * @param {Array} symbols - Array of symbols from the file
   * @returns {Array} Array of chunks
   */
  chunkFile(filePath, content, symbols = []) {
    const lines = content.split('\n');
    const chunks = [];

    // If we have symbols, chunk by symbol boundaries
    if (symbols && symbols.length > 0) {
      for (const symbol of symbols) {
        const startLine = symbol.span_start || 0;
        const endLine = symbol.span_end || lines.length;
        
        const chunkText = lines.slice(startLine, endLine + 1).join('\n');
        const tokens = this.estimateTokens(chunkText);

        // Skip empty chunks
        if (chunkText.trim().length === 0) continue;

        // If chunk is too large, split it
        if (tokens > this.maxOversizeTokens) {
          const subChunks = this.splitLargeChunk(chunkText, startLine);
          chunks.push(...subChunks.map(sc => ({
            path: filePath,
            symbol: symbol.name,
            start_line: sc.start_line,
            end_line: sc.end_line,
            text: sc.text,
            content_hash: this.hashContent(sc.text),
            tokens: this.estimateTokens(sc.text)
          })));
        } else {
          chunks.push({
            path: filePath,
            symbol: symbol.name,
            start_line: startLine,
            end_line: endLine,
            text: chunkText,
            content_hash: this.hashContent(chunkText),
            tokens
          });
        }
      }
    } else {
      // No symbols, chunk by line count (sliding window)
      const linesPerChunk = Math.ceil(this.maxTokens / 4); // Rough estimate
      
      for (let i = 0; i < lines.length; i += linesPerChunk) {
        const endLine = Math.min(i + linesPerChunk, lines.length);
        const chunkText = lines.slice(i, endLine).join('\n');
        
        if (chunkText.trim().length === 0) continue;

        chunks.push({
          path: filePath,
          symbol: null,
          start_line: i,
          end_line: endLine - 1,
          text: chunkText,
          content_hash: this.hashContent(chunkText),
          tokens: this.estimateTokens(chunkText)
        });
      }
    }

    return chunks;
  }

  /**
   * Split a large chunk into smaller pieces
   */
  splitLargeChunk(text, startLine) {
    const lines = text.split('\n');
    const chunks = [];
    const linesPerChunk = Math.ceil(this.maxTokens / 4);

    for (let i = 0; i < lines.length; i += linesPerChunk) {
      const endLine = Math.min(i + linesPerChunk, lines.length);
      const chunkText = lines.slice(i, endLine).join('\n');
      
      if (chunkText.trim().length === 0) continue;

      chunks.push({
        start_line: startLine + i,
        end_line: startLine + endLine - 1,
        text: chunkText
      });
    }

    return chunks;
  }

  /**
   * Extract imports/exports from chunk for context
   */
  extractImportsExports(text) {
    const imports = [];
    const exports = [];

    // Match ES6 imports
    const importRegex = /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }

    // Match ES6 exports
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([\w]+)/g;
    while ((match = exportRegex.exec(text)) !== null) {
      exports.push(match[1]);
    }

    return { imports, exports };
  }

  /**
   * Generate summary for a chunk (first few lines or docstring)
   */
  generateSummary(text, maxLines = 3) {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    
    // Look for docstring or comment block
    const docstringMatch = text.match(/"""([\s\S]*?)"""|'''([\s\S]*?)'''|\/\*\*([\s\S]*?)\*\//);
    if (docstringMatch) {
      const docstring = (docstringMatch[1] || docstringMatch[2] || docstringMatch[3]).trim();
      return docstring.split('\n').slice(0, maxLines).join(' ').substring(0, 200);
    }

    // Otherwise, use first few non-empty lines
    return lines.slice(0, maxLines).join(' ').substring(0, 200);
  }
}

export default CodeChunker;


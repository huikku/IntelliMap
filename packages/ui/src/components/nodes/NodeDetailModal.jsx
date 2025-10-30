import { useState, useEffect, useRef } from 'react';
import './NodeDetailModal.css';

const NodeDetailModal = ({ data, onClose }) => {
  const [fileContent, setFileContent] = useState('Loading...');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matches, setMatches] = useState([]);
  const searchInputRef = useRef(null);
  const codeContentRef = useRef(null);

  useEffect(() => {
    // Fetch file content from server
    const fetchFileContent = async () => {
      try {
        const repoPath = data._original?.repoPath || '/home/john/IntelliMap';
        const response = await fetch(
          `http://localhost:7676/api/file-content?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(data.id)}`
        );

        if (response.ok) {
          const data = await response.json();
          const content = data.content || '';
          setFileContent(content);
        } else {
          setFileContent('// Failed to load file content');
        }
      } catch (error) {
        setFileContent(`// Error loading file: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFileContent();
  }, [data.id, data._original?.repoPath]);

  // Keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchVisible(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      // Ctrl+G or Cmd+G to find next
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        findNext();
      }
      // Escape to close search
      if (e.key === 'Escape' && searchVisible) {
        setSearchVisible(false);
        setSearchQuery('');
        setMatches([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible, currentMatchIndex, matches]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery || !fileContent) {
      setMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    const lines = fileContent.split('\n');
    const foundMatches = [];

    lines.forEach((line, lineIndex) => {
      const lowerLine = line.toLowerCase();
      const lowerQuery = searchQuery.toLowerCase();
      let startIndex = 0;

      while (true) {
        const index = lowerLine.indexOf(lowerQuery, startIndex);
        if (index === -1) break;

        foundMatches.push({
          lineIndex,
          charIndex: index,
          length: searchQuery.length,
        });

        startIndex = index + 1;
      }
    });

    setMatches(foundMatches);
    setCurrentMatchIndex(0);

    // Scroll to first match
    if (foundMatches.length > 0) {
      scrollToMatch(0);
    }
  }, [searchQuery, fileContent]);

  const findNext = () => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  };

  const findPrevious = () => {
    if (matches.length === 0) return;
    const prevIndex = currentMatchIndex === 0 ? matches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(prevIndex);
  };

  const scrollToMatch = (matchIndex) => {
    if (!codeContentRef.current || !matches[matchIndex]) return;

    const match = matches[matchIndex];
    const lineElement = codeContentRef.current.querySelector(`[data-line-index="${match.lineIndex}"]`);

    if (lineElement) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Simple syntax highlighting for JavaScript/TypeScript
  const highlightCode = (code) => {
    if (!code) return '';

    // Split into lines and add line numbers
    const lines = code.split('\n');

    return lines.map((line, index) => {
      // Escape HTML first
      let escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Apply syntax highlighting with proper ordering to avoid conflicts
      let highlighted = escaped;

      // 1. Comments first (so strings inside comments don't get highlighted)
      highlighted = highlighted.replace(
        /(\/\/.*$)/g,
        '<span class="code-comment">$1</span>'
      );

      // 2. Strings (but not if already in a comment)
      highlighted = highlighted.replace(
        /(?!<span class="code-comment">)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        '<span class="code-string">$1</span>'
      );

      // 3. Keywords (but not if in string or comment)
      const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|try|catch|throw|new|this|super|extends|implements|interface|type|enum|namespace|module|declare|public|private|protected|static|readonly|abstract|as|in|of|typeof|instanceof)\b/g;
      highlighted = highlighted.replace(keywords, (match, p1, offset) => {
        // Don't highlight if inside a span tag
        const before = highlighted.substring(0, offset);
        if (before.lastIndexOf('<span') > before.lastIndexOf('</span>')) {
          return match;
        }
        return `<span class="code-keyword">${p1}</span>`;
      });

      // 4. Numbers
      highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, (match, p1, offset) => {
        const before = highlighted.substring(0, offset);
        if (before.lastIndexOf('<span') > before.lastIndexOf('</span>')) {
          return match;
        }
        return `<span class="code-number">${p1}</span>`;
      });

      // 5. Function calls
      highlighted = highlighted.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, (match, p1, offset) => {
        const before = highlighted.substring(0, offset);
        if (before.lastIndexOf('<span') > before.lastIndexOf('</span>')) {
          return match;
        }
        return `<span class="code-function">${p1}</span>(`;
      });

      // 6. Highlight search matches
      if (searchQuery && matches.length > 0) {
        const lineMatches = matches.filter(m => m.lineIndex === index);

        if (lineMatches.length > 0) {
          // Sort matches by character index in reverse to avoid offset issues
          const sortedMatches = [...lineMatches].sort((a, b) => b.charIndex - a.charIndex);

          sortedMatches.forEach((match) => {
            const isCurrentMatch = matches[currentMatchIndex]?.lineIndex === index &&
                                   matches[currentMatchIndex]?.charIndex === match.charIndex;
            const className = isCurrentMatch ? 'search-match-current' : 'search-match';

            // Find the position in the highlighted HTML (accounting for tags)
            let plainTextPos = 0;
            let htmlPos = 0;
            let inTag = false;

            while (plainTextPos < match.charIndex && htmlPos < highlighted.length) {
              if (highlighted[htmlPos] === '<') {
                inTag = true;
              } else if (highlighted[htmlPos] === '>') {
                inTag = false;
                htmlPos++;
                continue;
              }

              if (!inTag) {
                plainTextPos++;
              }
              htmlPos++;
            }

            // Insert highlight span
            const beforeMatch = highlighted.substring(0, htmlPos);
            let afterMatchStart = htmlPos;
            let matchTextLength = 0;
            inTag = false;

            while (matchTextLength < match.length && afterMatchStart < highlighted.length) {
              if (highlighted[afterMatchStart] === '<') {
                inTag = true;
              } else if (highlighted[afterMatchStart] === '>') {
                inTag = false;
                afterMatchStart++;
                continue;
              }

              if (!inTag) {
                matchTextLength++;
              }
              afterMatchStart++;
            }

            const matchText = highlighted.substring(htmlPos, afterMatchStart);
            const afterMatch = highlighted.substring(afterMatchStart);

            highlighted = `${beforeMatch}<mark class="${className}">${matchText}</mark>${afterMatch}`;
          });
        }
      }

      return `<div class="code-line" data-line-index="${index}"><span class="line-number">${index + 1}</span><span class="line-content">${highlighted}</span></div>`;
    }).join('');
  };

  // Render trend bars (copied from CodeNode)
  const renderTrendBars = (values, color = '#5F9B8C') => {
    if (!values || values.length === 0) return null;
    
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '30px', marginTop: '8px' }}>
        {values.slice(-10).map((value, i) => {
          const normalizedHeight = range > 0 ? ((value - minValue) / range) * 100 : 50;
          const height = Math.max(normalizedHeight, 5);
          
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${height}%`,
                background: color,
                borderRadius: '2px',
                minWidth: '4px',
                opacity: 0.6 + (i / values.length) * 0.4,
                transition: 'height 0.3s ease',
              }}
              title={`${value}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="node-detail-modal-overlay" onClick={onClose}>
      <div className="node-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="node-detail-modal-header">
          <div className="node-detail-modal-title">
            <span className="node-detail-modal-icon">📊</span>
            <span>{data.label}</span>
          </div>
          <button className="node-detail-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="node-detail-modal-content">
          {/* Left: Metrics */}
          <div className="node-detail-modal-left">
            <div className="node-detail-scrollable">
              {/* File Info - Full Width Card */}
              <div className="bento-card bento-card-full">
                <div className="bento-card-label">Full Path</div>
                <div className="bento-card-value bento-card-small" style={{ fontSize: '13px', wordBreak: 'break-all', lineHeight: '1.4' }}>
                  {data.fullPath}
                </div>
              </div>

              {/* Compact Bento Grid - Interesting mixed layout */}
              <div className="bento-grid-compact">
                {/* Row 1: Language (big), Env + File Size (small stack) */}
                <div className="bento-card bento-tall">
                  <div className="bento-card-label">Language</div>
                  <div className="bento-card-value" style={{ fontSize: '28px' }}>{data.lang || 'unknown'}</div>
                </div>
                <div className="bento-card bento-small">
                  <div className="bento-card-label">Environment</div>
                  <div className="bento-card-value bento-card-small">{data.env || 'unknown'}</div>
                </div>
                <div className="bento-card bento-small">
                  <div className="bento-card-label">File Size</div>
                  <div className="bento-card-value bento-card-small">{Math.round((data._original?.size || 0) / 1024)}KB</div>
                </div>

                {/* Row 2: LOC (wide), Complexity, Depth */}
                <div className="bento-card bento-wide">
                  <div className="bento-card-label">Lines of Code</div>
                  <div className="bento-card-value">{Math.round(data.metrics?.loc || 0)}</div>
                </div>
                <div className="bento-card">
                  <div className="bento-card-label">Complexity</div>
                  <div className="bento-card-value">{Math.round(data.metrics?.complexity || 0)}</div>
                </div>
                <div className="bento-card">
                  <div className="bento-card-label">Import Depth</div>
                  <div className="bento-card-value">{data.metrics?.depth || 0}</div>
                </div>

                {/* Row 3: Fan-in, Fan-out, Churn, Authors */}
                <div className="bento-card bento-tiny">
                  <div className="bento-card-label">Fan-in</div>
                  <div className="bento-card-value bento-card-small">{data.metrics?.fanin || 0}</div>
                </div>
                <div className="bento-card bento-tiny">
                  <div className="bento-card-label">Fan-out</div>
                  <div className="bento-card-value bento-card-small">{data.metrics?.fanout || 0}</div>
                </div>
                <div className="bento-card bento-tiny">
                  <div className="bento-card-label">Churn</div>
                  <div className="bento-card-value bento-card-small">{data._original?.churn || 0}</div>
                </div>
                <div className="bento-card bento-tiny">
                  <div className="bento-card-label">Authors</div>
                  <div className="bento-card-value bento-card-small">{data._original?.authors || 0}</div>
                </div>

                {/* Row 4: LOC Quantile, Complexity Quantile, Age */}
                <div className="bento-card">
                  <div className="bento-card-label">LOC Quantile</div>
                  <div className="bento-card-value">{data._original?.loc_q || 'N/A'} / 5</div>
                </div>
                <div className="bento-card">
                  <div className="bento-card-label">Complexity Quantile</div>
                  <div className="bento-card-value">{data._original?.cx_q || 'N/A'} / 5</div>
                </div>
                <div className="bento-card">
                  <div className="bento-card-label">Age</div>
                  <div className="bento-card-value">{data._original?.age || 0} days</div>
                </div>

                {/* Row 5: Hotspot Risk (full width, prominent) */}
                {data._original?.hotspot_q !== undefined && (
                  <div className="bento-card bento-card-full bento-highlight">
                    <div className="bento-card-label">🔥 Hotspot Risk</div>
                    <div className="bento-card-value" style={{
                      fontSize: '24px',
                      color: data._original.hotspot_q >= 4 ? '#FF7D2D' :
                             data._original.hotspot_q >= 3 ? '#FAC846' : '#A0C382'
                    }}>
                      {data._original.hotspot_q >= 4 ? '🔥 High' :
                       data._original.hotspot_q >= 3 ? '⚠️ Medium' : '✓ Low'} ({data._original.hotspot_q}/5)
                    </div>
                  </div>
                )}

                {/* Last Modified (if available) */}
                {data._original?.age !== undefined && (
                  <div className="bento-card bento-card-full">
                    <div className="bento-card-label">Last Modified</div>
                    <div className="bento-card-value bento-card-small">
                      {data._original.age === 0 ? 'Today' :
                       data._original.age === 1 ? '1 day ago' :
                       `${data._original.age} days ago`}
                    </div>
                  </div>
                )}
              </div>

              {/* Symbols */}
              {data._original?.symbols && data._original.symbols.length > 0 && (
                <>
                  <div className="bento-section-header">Exported Symbols ({data._original.symbols.length})</div>
                  <div className="bento-card bento-card-full">
                    <div className="bento-list">
                      {data._original.symbols.slice(0, 10).map((sym, i) => (
                        <div key={i} className="bento-list-item">• {sym}</div>
                      ))}
                      {data._original.symbols.length > 10 && (
                        <div style={{ fontSize: '11px', color: '#7BAEA2', marginTop: '8px', textAlign: 'center' }}>
                          +{data._original.symbols.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Imports */}
              {data._original?.imports && data._original.imports.length > 0 && (
                <>
                  <div className="bento-section-header">Import Statements ({data._original.imports.length})</div>
                  <div className="bento-card bento-card-full">
                    <div className="bento-list">
                      {data._original.imports.slice(0, 10).map((imp, i) => (
                        <div key={i} className="bento-list-item">• {imp}</div>
                      ))}
                      {data._original.imports.length > 10 && (
                        <div style={{ fontSize: '11px', color: '#7BAEA2', marginTop: '8px', textAlign: 'center' }}>
                          +{data._original.imports.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Runtime */}
              {(data.runtime?.executionCount > 0 || data.metrics?.coverage > 0) && (
                <div className="detail-section">
                  <div className="detail-header">Runtime Analysis</div>
                  {data.metrics?.coverage > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Coverage:</span>
                      <span className="detail-value">{Math.round(data.metrics.coverage)}%</span>
                    </div>
                  )}
                  {data.runtime?.executionCount > 0 && (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Execution Count:</span>
                        <span className="detail-value">{data.runtime.executionCount}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Total Time:</span>
                        <span className="detail-value">{data.runtime.totalTime?.toFixed(2)}ms</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Avg Time:</span>
                        <span className="detail-value">{data.runtime.avgTime?.toFixed(2)}ms</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Trends */}
              {data.timeseries && (
                <>
                  <div className="bento-section-header">Trends</div>
                  {data.timeseries.churn && data.timeseries.churn.length > 0 && (
                    <div className="bento-card bento-card-full">
                      <div className="bento-trend-label">Churn Trend</div>
                      <div className="bento-trend-container">
                        {renderTrendBars(data.timeseries.churn, '#FF9A4A')}
                      </div>
                    </div>
                  )}
                  {data.timeseries.complexity && data.timeseries.complexity.length > 0 && (
                    <div className="bento-card bento-card-full">
                      <div className="bento-trend-label">Complexity Trend</div>
                      <div className="bento-trend-container">
                        {renderTrendBars(data.timeseries.complexity, '#7BAEA2')}
                      </div>
                    </div>
                  )}
                  {data.timeseries.coverage && data.timeseries.coverage.length > 0 && (
                    <div className="bento-card bento-card-full">
                      <div className="bento-trend-label">Coverage Trend</div>
                      <div className="bento-trend-container">
                        {renderTrendBars(data.timeseries.coverage, '#A0C382')}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Code Preview */}
          <div className="node-detail-modal-right">
            <div className="node-detail-code-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span>Code Preview</span>
                <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal' }}>
                  {data.id}
                </span>
              </div>

              {/* Search toggle button */}
              <button
                onClick={() => {
                  setSearchVisible(!searchVisible);
                  if (!searchVisible) {
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                  }
                }}
                style={{
                  padding: '4px 8px',
                  background: searchVisible ? '#5F9B8C' : '#1a2830',
                  border: '1px solid #5F9B8C',
                  borderRadius: '4px',
                  color: '#F6DA80',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                title="Search (Ctrl+F)"
              >
                🔍 Search
              </button>
            </div>

            {/* Search bar */}
            {searchVisible && (
              <div className="code-search-bar">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        findPrevious();
                      } else {
                        findNext();
                      }
                    }
                  }}
                  placeholder="Search in code..."
                  className="code-search-input"
                />
                <span className="code-search-count">
                  {matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : 'No matches'}
                </span>
                <button
                  onClick={findPrevious}
                  disabled={matches.length === 0}
                  className="code-search-btn"
                  title="Previous (Shift+Enter)"
                >
                  ↑
                </button>
                <button
                  onClick={findNext}
                  disabled={matches.length === 0}
                  className="code-search-btn"
                  title="Next (Ctrl+G or Enter)"
                >
                  ↓
                </button>
                <button
                  onClick={() => {
                    setSearchVisible(false);
                    setSearchQuery('');
                    setMatches([]);
                  }}
                  className="code-search-btn"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="node-detail-code-viewer">
              {loading ? (
                <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>
                  Loading file content...
                </div>
              ) : (
                <div
                  ref={codeContentRef}
                  className="code-content"
                  dangerouslySetInnerHTML={{ __html: highlightCode(fileContent) }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeDetailModal;


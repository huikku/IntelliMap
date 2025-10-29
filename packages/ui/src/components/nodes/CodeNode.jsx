import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from '@xyflow/react';
import HealthBars from './HealthBars';
import NodeDetailModal from './NodeDetailModal';
import './CodeNode.css';

/**
 * CodeNode - React Flow node component for code files
 * Displays title bar, metrics, and connection handles
 * Double-click to flip and see detailed metrics on the back
 */
const CodeNode = memo(({ data, selected }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Get title color based on file extension - using original muted palette
  const getTitleColor = () => {
    const lang = data.lang || 'unknown';

    // Original muted color palette
    const colors = {
      navy: '#233C4B',
      slate: '#2F5060',
      orange: '#FF7D2D',
      peach: '#FF9A4A',
      gold: '#FAC846',
      cream: '#F6DA80',
      sage: '#A0C382',
      olive: '#8AB572',
      teal: '#5F9B8C',
      mint: '#7BAEA2',
      rust: '#C25C4A',
      // Darker greens for .cjs and other bright files
      darkOlive: '#6B8A5A', // Darker, less bright olive
      darkSage: '#7FA068',  // Darker, less bright sage
    };

    // Language-based colors using original palette
    const languageColors = {
      // TypeScript - Navy/Slate blues
      'ts': colors.navy,
      'tsx': colors.slate,

      // JavaScript - Olive/Sage (darker greens instead of bright yellows)
      'js': colors.olive,
      'jsx': colors.sage,
      'cjs': colors.darkOlive,  // CommonJS - darker olive (less bright)
      'mjs': colors.darkSage,   // ES Modules - darker sage (less bright)

      // Python - Teal/Mint
      'py': colors.teal,

      // Java - Orange/Rust
      'java': colors.orange,

      // Go - Mint
      'go': colors.mint,

      // Rust - Rust/Orange
      'rust': colors.rust,

      // CSS/SCSS - Slate/Navy
      'css': colors.slate,
      'scss': colors.navy,

      // HTML - Peach
      'html': colors.peach,

      // JSON/Config - Slate
      'json': colors.slate,
      'yaml': colors.slate,
      'yml': colors.slate,

      // Markdown - Navy
      'md': colors.navy,

      // Vue - Sage/Olive greens
      'vue': colors.sage,

      // Svelte - Orange
      'svelte': colors.orange,

      // Unknown - Slate
      'unknown': colors.slate,
    };

    return languageColors[lang] || languageColors.unknown;
  };

  // Darken a hex color by a percentage (0-1)
  const darkenColor = (hex, percent = 0.3) => {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Darken
    const newR = Math.round(r * (1 - percent));
    const newG = Math.round(g * (1 - percent));
    const newB = Math.round(b * (1 - percent));

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  // Get icon based on environment/type
  const getIcon = () => {
    if (data.env === 'frontend') return '🎨';
    if (data.env === 'backend') return '⚙️';
    if (data.env === 'test') return '🧪';
    if (data.lang === 'css' || data.lang === 'scss') return '💅';
    if (data.lang === 'json' || data.lang === 'yaml') return '📋';
    return '📄';
  };

  // Determine if node is a hotspot (high complexity × churn)
  // Use hotspot_q (quantile 1-5) if available, otherwise fall back to complexity
  const isHotspot = data._original?.hotspot_q >= 4 || data.metrics?.complexity > 75;

  // Determine handle positions based on layout direction
  const getHandlePositions = () => {
    const layoutDirection = data.layoutDirection || 'RIGHT';

    // For vertical layouts (DOWN/UP), use top/bottom handles
    if (layoutDirection === 'DOWN' || layoutDirection === 'TB') {
      return {
        source: Position.Bottom,
        target: Position.Top,
      };
    }
    // For UP layout
    if (layoutDirection === 'UP' || layoutDirection === 'BT') {
      return {
        source: Position.Top,
        target: Position.Bottom,
      };
    }
    // For LEFT layout
    if (layoutDirection === 'LEFT' || layoutDirection === 'RL') {
      return {
        source: Position.Left,
        target: Position.Right,
      };
    }
    // Default: horizontal layout (RIGHT/LR)
    return {
      source: Position.Right,
      target: Position.Left,
    };
  };

  const handlePositions = getHandlePositions();

  // Render a mini bar graph for trend data
  const renderTrendBars = (values, color = '#5F9B8C') => {
    if (!values || values.length === 0) return null;

    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1; // Avoid division by zero

    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '20px', marginTop: '4px' }}>
        {values.slice(-10).map((value, i) => {
          const normalizedHeight = range > 0 ? ((value - minValue) / range) * 100 : 50;
          const height = Math.max(normalizedHeight, 5); // Minimum 5% height

          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${height}%`,
                background: color,
                borderRadius: '1px',
                minWidth: '3px',
                opacity: 0.6 + (i / values.length) * 0.4, // Fade in from left to right
                transition: 'height 0.3s ease',
              }}
              title={`${value}`}
            />
          );
        })}
      </div>
    );
  };

  // Get hotspot class for glow effect
  const getHotspotClass = () => {
    const hotspot_q = data._original?.hotspot_q;
    if (hotspot_q >= 4) return 'hotspot-high';
    if (hotspot_q >= 3) return 'hotspot-medium';
    return '';
  };

  return (
    <div
      className={`code-node-container ${getHotspotClass()}`}
      onWheel={(e) => {
        // Stop wheel events from propagating to React Flow (which would zoom)
        e.stopPropagation();
      }}
    >
      {/* Connection handles - outside the rotating card */}
      <Handle
        type="target"
        position={handlePositions.target}
        className="code-node-handle"
      />

      <div
        className={`code-node ${selected ? 'selected' : ''} ${isFlipped ? 'flipped' : ''}`}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsFlipped(!isFlipped);
        }}
      >
        {/* Front side */}
        <div className="code-node-face code-node-front">
          {/* Title bar */}
          <div
            className="code-node-title"
            style={{ background: getTitleColor() }}
          >
            <span className="code-node-icon">{getIcon()}</span>
            <span className="code-node-label" title={data.fullPath}>
              {data.label}
            </span>
            {isHotspot && <span className="code-node-badge">🔥</span>}
            {data.changed && <span className="code-node-badge">📝</span>}
          </div>

          {/* Metrics section */}
          <div className="code-node-metrics">
            <div className="code-node-metric">
              <span className="metric-label">LOC:</span>
              <span className="metric-value">{Math.round(data.metrics?.loc || 0)}</span>
            </div>
            <div className="code-node-metric">
              <span className="metric-label">Complexity:</span>
              <span className="metric-value">{Math.round(data.metrics?.complexity || 0)}</span>
            </div>
            <div className="code-node-metric">
              <span className="metric-label">Fanin:</span>
              <span className="metric-value">{data.metrics?.fanin || 0}</span>
            </div>
            <div className="code-node-metric">
              <span className="metric-label">Fanout:</span>
              <span className="metric-value">{data.metrics?.fanout || 0}</span>
            </div>
            {data.metrics?.coverage > 0 && (
              <div className="code-node-metric">
                <span className="metric-label">Coverage:</span>
                <span className="metric-value">{Math.round(data.metrics.coverage)}%</span>
              </div>
            )}
          </div>

          {/* Health/Wellness bars */}
          <HealthBars metrics={data.metrics} timeseries={data.timeseries} />

          {/* Flip hint */}
          <div className="flip-hint">Double-click to flip</div>
        </div>

        {/* Back side - Detailed metrics */}
        <div className="code-node-face code-node-back">
          {/* Title bar - darker version of front color */}
          <div
            className="code-node-title"
            style={{ background: darkenColor(getTitleColor(), 0.3), position: 'relative' }}
          >
            <span className="code-node-icon">📊</span>
            <span className="code-node-label" title={data.fullPath}>
              {data.label}
            </span>
            <button
              className="code-node-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              title="Expand to full view"
            >
              ⤢
            </button>
          </div>

          {/* Detailed metrics */}
          <div className="code-node-details">
            {/* File Info */}
            <div className="detail-section">
              <div className="detail-header">File Info</div>
              <div className="detail-row">
                <span className="detail-label">Full Path:</span>
                <span className="detail-value" style={{ fontSize: '9px', wordBreak: 'break-all' }}>
                  {data.fullPath}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Language:</span>
                <span className="detail-value">{data.lang || 'unknown'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Environment:</span>
                <span className="detail-value">{data.env || 'unknown'}</span>
              </div>
              {data._original?.size && (
                <div className="detail-row">
                  <span className="detail-label">File Size:</span>
                  <span className="detail-value">{(data._original.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
            </div>

            {/* Quantiles & Buckets */}
            <div className="detail-section">
              <div className="detail-header">Relative Metrics</div>
              <div className="detail-row">
                <span className="detail-label">LOC Quantile:</span>
                <span className="detail-value">{data._original?.loc_q || 'N/A'} / 5</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Complexity Quantile:</span>
                <span className="detail-value">{data._original?.cx_q || 'N/A'} / 5</span>
              </div>
              {data._original?.hotspot_q !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">Hotspot Risk:</span>
                  <span className="detail-value" style={{
                    color: data._original.hotspot_q >= 4 ? '#FF7D2D' :
                           data._original.hotspot_q >= 3 ? '#FAC846' : '#A0C382'
                  }}>
                    {data._original.hotspot_q >= 4 ? '🔥 High' :
                     data._original.hotspot_q >= 3 ? '⚠️ Medium' : '✓ Low'} ({data._original.hotspot_q}/5)
                  </span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Import Depth:</span>
                <span className="detail-value">{data.metrics?.depth || 0}</span>
              </div>
            </div>

            {/* Git & History */}
            {(data._original?.churn > 0 || data.changed) && (
              <div className="detail-section">
                <div className="detail-header">Git History</div>
                {data._original?.churn > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Total Churn:</span>
                    <span className="detail-value">{data._original.churn} commits</span>
                  </div>
                )}
                {data._original?.age !== undefined && (
                  <div className="detail-row">
                    <span className="detail-label">Last Modified:</span>
                    <span className="detail-value">
                      {data._original.age === 0 ? 'Today' :
                       data._original.age === 1 ? '1 day ago' :
                       `${data._original.age} days ago`}
                    </span>
                  </div>
                )}
                {data._original?.authors > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Contributors:</span>
                    <span className="detail-value">
                      {data._original.authors} {data._original.authors === 1 ? 'author' : 'authors'}
                    </span>
                  </div>
                )}
                {data.changed && (
                  <div className="detail-row">
                    <span className="detail-label">Current Diff:</span>
                    <span className="detail-value" style={{ color: '#FF9A4A' }}>✓ Modified</span>
                  </div>
                )}
                {data._original?.hash && (
                  <div className="detail-row">
                    <span className="detail-label">Content Hash:</span>
                    <span className="detail-value" style={{ fontSize: '9px' }}>
                      {data._original.hash.substring(0, 8)}...
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Symbols & Exports */}
            {data._original?.symbols && data._original.symbols.length > 0 && (
              <div className="detail-section">
                <div className="detail-header">Exported Symbols</div>
                <div className="detail-row">
                  <span className="detail-label">Count:</span>
                  <span className="detail-value">{data._original.symbols.length}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#888', marginTop: '4px', maxHeight: '60px', overflow: 'auto' }}>
                  {data._original.symbols.slice(0, 10).join(', ')}
                  {data._original.symbols.length > 10 && ` +${data._original.symbols.length - 10} more`}
                </div>
              </div>
            )}

            {/* Imports */}
            {data._original?.imports && data._original.imports.length > 0 && (
              <div className="detail-section">
                <div className="detail-header">Import Statements</div>
                <div className="detail-row">
                  <span className="detail-label">Count:</span>
                  <span className="detail-value">{data._original.imports.length}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#888', marginTop: '4px', maxHeight: '60px', overflow: 'auto' }}>
                  {data._original.imports.slice(0, 8).map((imp, i) => (
                    <div key={i} style={{ marginBottom: '2px' }}>• {imp}</div>
                  ))}
                  {data._original.imports.length > 8 && (
                    <div style={{ color: '#666' }}>+{data._original.imports.length - 8} more...</div>
                  )}
                </div>
              </div>
            )}

            {/* Runtime Performance */}
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
                      <span className="detail-label">Executions:</span>
                      <span className="detail-value">{data.runtime.executionCount.toLocaleString()}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Total Time:</span>
                      <span className="detail-value">{data.runtime.totalTime.toFixed(2)}ms</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Avg Time:</span>
                      <span className="detail-value">{(data.runtime.totalTime / data.runtime.executionCount).toFixed(2)}ms</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Documentation */}
            {data._original?.doc && (
              <div className="detail-section">
                <div className="detail-header">Documentation</div>
                <div style={{ fontSize: '9px', color: '#aaa', marginTop: '4px', fontStyle: 'italic', maxHeight: '50px', overflow: 'auto' }}>
                  {data._original.doc}
                </div>
              </div>
            )}

            {/* Timeseries Trends */}
            {data.timeseries && (
              <div className="detail-section">
                <div className="detail-header">Trends</div>
                {data.timeseries.churn && data.timeseries.churn.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div className="detail-label" style={{ marginBottom: '2px' }}>Churn Trend:</div>
                    {renderTrendBars(data.timeseries.churn, '#FF9A4A')}
                  </div>
                )}
                {data.timeseries.complexity && data.timeseries.complexity.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div className="detail-label" style={{ marginBottom: '2px' }}>Complexity Trend:</div>
                    {renderTrendBars(data.timeseries.complexity, '#7BAEA2')}
                  </div>
                )}
                {data.timeseries.coverage && data.timeseries.coverage.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div className="detail-label" style={{ marginBottom: '2px' }}>Coverage Trend:</div>
                    {renderTrendBars(data.timeseries.coverage, '#A0C382')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Flip hint */}
          <div className="flip-hint">Double-click to flip back</div>
        </div>
      </div>

      {/* Output handle - outside the rotating card */}
      <Handle
        type="source"
        position={handlePositions.source}
        className="code-node-handle"
      />

      {/* Expanded detail modal - rendered in graph container using portal */}
      {showModal && createPortal(
        <NodeDetailModal
          data={data}
          onClose={() => setShowModal(false)}
        />,
        document.getElementById('react-flow-container') || document.body
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.data === nextProps.data &&
    prevProps.selected === nextProps.selected
  );
});

CodeNode.displayName = 'CodeNode';

export default CodeNode;

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import HealthBars from './HealthBars';
import './CodeNode.css';

/**
 * CodeNode - React Flow node component for code files
 * Displays title bar, metrics, and connection handles
 */
const CodeNode = memo(({ data, selected }) => {
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

  // Get icon based on environment/type
  const getIcon = () => {
    if (data.env === 'frontend') return '🎨';
    if (data.env === 'backend') return '⚙️';
    if (data.env === 'test') return '🧪';
    if (data.lang === 'css' || data.lang === 'scss') return '💅';
    if (data.lang === 'json' || data.lang === 'yaml') return '📋';
    return '📄';
  };

  // Determine if node is a hotspot
  const isHotspot = data.metrics?.complexity > 75 || data.changed;

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

  return (
    <div className={`code-node ${selected ? 'selected' : ''}`}>
      {/* Connection handles */}
      <Handle
        type="target"
        position={handlePositions.target}
        className="code-node-handle"
      />

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

      {/* Output handle */}
      <Handle
        type="source"
        position={handlePositions.source}
        className="code-node-handle"
      />
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

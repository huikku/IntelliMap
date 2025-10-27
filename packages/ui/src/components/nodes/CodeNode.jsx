import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import './CodeNode.css';

/**
 * CodeNode - React Flow node component for code files
 * Displays title bar, metrics, and connection handles
 */
const CodeNode = memo(({ data, selected }) => {
  // Get title color based on language and environment
  const getTitleColor = () => {
    const key = `${data.lang || 'unknown'}-${data.env || 'unknown'}`;
    const colors = {
      'ts-frontend': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'ts-backend': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'js-frontend': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'js-backend': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'py-backend': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'py-frontend': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'jsx-frontend': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'tsx-frontend': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'css-frontend': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'unknown': 'linear-gradient(135deg, #555 0%, #777 100%)',
    };
    return colors[key] || colors.unknown;
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

  return (
    <div className={`code-node ${selected ? 'selected' : ''}`}>
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
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

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
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

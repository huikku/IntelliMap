/**
 * Sparkline - Mini chart for visualizing churn/change history
 * Shows a simple line chart of values over time
 */
export default function Sparkline({ data = [], width = 150, height = 30, color = '#667eea' }) {
  if (!data || data.length === 0) {
    return null;
  }

  // Find min/max for scaling
  const values = data.map(d => d.value || d);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Generate SVG path
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} className="sparkline" style={{ display: 'block' }}>
      {/* Area fill */}
      <path
        d={`${pathData} L ${width},${height} L 0,${height} Z`}
        fill={color}
        fillOpacity={0.2}
      />
      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

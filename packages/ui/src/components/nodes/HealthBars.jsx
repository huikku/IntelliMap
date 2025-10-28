/**
 * HealthBars - Display wellness metrics as colored bars
 * Shows complexity, coverage, activity, and other health indicators
 */
export default function HealthBars({ metrics = {}, timeseries = {} }) {
  // Muted color palette
  const colors = {
    orange: '#FF7D2D',
    sage: '#A0C382',
    teal: '#5F9B8C',
    gold: '#FAC846',
  };

  // Normalize values to 0-100 scale for bar display
  const bars = [
    {
      label: 'Complexity',
      value: Math.min(100, (metrics.complexity || 0)),
      color: colors.orange,
      max: 100,
    },
    {
      label: 'Coverage',
      value: metrics.coverage || 0,
      color: colors.sage,
      max: 100,
    },
    {
      label: 'Activity',
      value: timeseries.churn ? (timeseries.churn.reduce((a, b) => a + b, 0) / timeseries.churn.length) * 10 : 0,
      color: colors.teal,
      max: 100,
    },
    {
      label: 'Size',
      value: Math.min(100, (metrics.loc || 0) / 10),
      color: colors.gold,
      max: 100,
    },
  ];

  return (
    <div className="health-bars">
      {bars.map((bar, index) => (
        <div key={index} className="health-bar-item">
          <div className="health-bar-label">{bar.label}</div>
          <div className="health-bar-track">
            <div
              className="health-bar-fill"
              style={{
                width: `${(bar.value / bar.max) * 100}%`,
                backgroundColor: bar.color,
              }}
            />
          </div>
          <div className="health-bar-value">{Math.round(bar.value)}</div>
        </div>
      ))}
    </div>
  );
}

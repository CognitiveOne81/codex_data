import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function rollingAverage(data, key, windowSize) {
  return data.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = data.slice(start, index + 1);
    const avg = slice.reduce((sum, item) => sum + Number(item[key] || 0), 0) / slice.length;
    return { ...point, [`${key}Rolling`]: avg };
  });
}

const rollingWindowMap = { '1H': 60, '24H': 24 * 60, '7D': 7 * 24 * 60 };

function formatTs(ts) {
  return new Date(ts).toLocaleString();
}

export function MetricCharts({ data, sourceName, carrierLabel, transitLabel, rollingEnabled, rollingWindow }) {
  const windowSize = rollingWindowMap[rollingWindow] || 60;
  const enhanced = rollingEnabled
    ? rollingAverage(rollingAverage(data, 'vesselCount', windowSize), 'energyEstimate', windowSize)
    : data;

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const p = payload[0].payload;
    return (
      <div className="tooltip">
        <strong>{formatTs(p.ts)}</strong>
        <div>Source: {sourceName}</div>
        <div>Carrier: {carrierLabel}</div>
        <div>Transit: {transitLabel}</div>
        <div>Fuel: {(p.fuelTypes || []).join(', ') || 'Unknown / estimated'}</div>
        <div>Count: {p.vesselCount}</div>
        <div>Energy: {Math.round(p.energyEstimate).toLocaleString()}</div>
      </div>
    );
  };

  return (
    <section className="chart-grid">
      <article className="panel">
        <h2>Carrier Count Chart</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={enhanced} syncId="sync-main">
            <CartesianGrid strokeDasharray="2 8" stroke="#2f3844" />
            <XAxis dataKey="ts" tickFormatter={(value) => new Date(value).toLocaleTimeString()} stroke="#7f8a9a" />
            <YAxis stroke="#7f8a9a" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="vesselCount" stroke="#00c805" dot={false} strokeWidth={2} />
            {rollingEnabled && (
              <Line type="monotone" dataKey="vesselCountRolling" stroke="#85ff95" dot={false} strokeWidth={1.5} strokeDasharray="5 5" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </article>

      <article className="panel">
        <h2>Energy Estimate Chart</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={enhanced} syncId="sync-main">
            <CartesianGrid strokeDasharray="2 8" stroke="#2f3844" />
            <XAxis dataKey="ts" tickFormatter={(value) => new Date(value).toLocaleTimeString()} stroke="#7f8a9a" />
            <YAxis stroke="#7f8a9a" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="energyEstimate" stroke="#5ac8fa" dot={false} strokeWidth={2} />
            {rollingEnabled && (
              <Line type="monotone" dataKey="energyEstimateRolling" stroke="#9edfff" dot={false} strokeWidth={1.5} strokeDasharray="5 5" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}

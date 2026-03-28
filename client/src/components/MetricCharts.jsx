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

function inferPointMillis(data) {
  if (data.length < 2) return 5 * 60 * 1000;
  const d1 = new Date(data[0].ts).getTime();
  const d2 = new Date(data[1].ts).getTime();
  return Math.max(60_000, d2 - d1);
}

function rollingWindowPoints(window, data) {
  const winMillis = { '1H': 3600000, '24H': 86400000, '7D': 604800000 }[window] || 3600000;
  return Math.max(1, Math.round(winMillis / inferPointMillis(data)));
}

function formatTooltipTs(ts) {
  return new Date(ts).toLocaleString();
}

function tickFormatterForTimeframe(timeframe) {
  return (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    if (timeframe === '1D') return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (timeframe === '1W' || timeframe === '1M') return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return date.toLocaleDateString([], { year: 'numeric', month: 'short' });
  };
}

function tickCountForTimeframe(timeframe) {
  const map = {
    '1D': 8,
    '1W': 7,
    '1M': 8,
    '1Y': 12,
    ALL: 10,
  };
  return map[timeframe] || 8;
}

export function MetricCharts({ data, timeframe, carrierLabel, transitLabel, rollingEnabled, rollingWindow }) {
  const windowSize = rollingWindowPoints(rollingWindow, data);
  const enhanced = rollingEnabled
    ? rollingAverage(rollingAverage(data, 'vesselCount', windowSize), 'energyEstimate', windowSize)
    : data;

  const xTickFormatter = tickFormatterForTimeframe(timeframe);
  const xTickCount = tickCountForTimeframe(timeframe);

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const p = payload[0].payload;
    return (
      <div className="tooltip">
        <strong>{formatTooltipTs(p.ts)}</strong>
        <div>Count: {p.vesselCount}</div>
        <div>Carrier Type: {carrierLabel}</div>
        <div>Transit Type: {transitLabel}</div>
        <div>Energy: {Math.round(p.energyEstimate).toLocaleString()}</div>
        <div>Oil energy: {Math.round(p.oilEnergy || 0).toLocaleString()}</div>
        <div>LNG energy: {Math.round(p.lngEnergy || 0).toLocaleString()}</div>
      </div>
    );
  };

  return (
    <section className="chart-grid">
      <article className="panel">
        <h2>Carrier Count</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={enhanced} syncId="sync-main">
            <CartesianGrid strokeDasharray="2 8" stroke="#2f3844" />
            <XAxis dataKey="ts" tickFormatter={xTickFormatter} tickCount={xTickCount} minTickGap={24} stroke="#7f8a9a" />
            <YAxis stroke="#7f8a9a" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="vesselCount" stroke="#00c805" dot={false} strokeWidth={2} isAnimationActive />
            {rollingEnabled && (
              <Line type="monotone" dataKey="vesselCountRolling" stroke="#85ff95" dot={false} strokeWidth={1.5} strokeDasharray="5 5" isAnimationActive />
            )}
          </LineChart>
        </ResponsiveContainer>
      </article>

      <article className="panel">
        <h2>Energy Estimate</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={enhanced} syncId="sync-main">
            <CartesianGrid strokeDasharray="2 8" stroke="#2f3844" />
            <XAxis dataKey="ts" tickFormatter={xTickFormatter} tickCount={xTickCount} minTickGap={24} stroke="#7f8a9a" />
            <YAxis stroke="#7f8a9a" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="energyEstimate" stroke="#5ac8fa" dot={false} strokeWidth={2} isAnimationActive />
            {rollingEnabled && (
              <Line type="monotone" dataKey="energyEstimateRolling" stroke="#9edfff" dot={false} strokeWidth={1.5} strokeDasharray="5 5" isAnimationActive />
            )}
          </LineChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}

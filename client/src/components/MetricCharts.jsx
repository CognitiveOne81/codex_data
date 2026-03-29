import {
  Area,
  AreaChart,
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

export function MetricCharts({ data, timeframe, transitLabel, rollingEnabled, rollingWindow }) {
  const windowSize = rollingWindowPoints(rollingWindow, data);
  const enhanced = rollingEnabled
    ? rollingAverage(
      rollingAverage(
        rollingAverage(rollingAverage(data, 'vlccCount', windowSize), 'lngCount', windowSize),
        'oilEnergy',
        windowSize,
      ),
      'lngEnergy',
      windowSize,
    )
    : data;

  const xTickFormatter = tickFormatterForTimeframe(timeframe);
  const xTickCount = tickCountForTimeframe(timeframe);

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const p = payload[0].payload;
    return (
      <div className="tooltip">
        <strong>{formatTooltipTs(p.ts)}</strong>
        <div>Transit Type: {transitLabel}</div>
        <div>VLCC Count: {p.vlccCount}</div>
        <div>LNG Count: {p.lngCount}</div>
        <div>Oil Volume: {Math.round(p.oilEnergy || 0).toLocaleString()}</div>
        <div>LNG Volume: {Math.round(p.lngEnergy || 0).toLocaleString()}</div>
      </div>
    );
  };

  return (
    <section className="chart-grid">
      <article className="panel">
        <h2>Carrier Traffic (Tick-Marked)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={enhanced} syncId="sync-main">
            <defs>
              <linearGradient id="vlccGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00c805" stopOpacity={0.36} />
                <stop offset="100%" stopColor="#00c805" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="lngGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5ac8fa" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#5ac8fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 8" stroke="#2f3844" />
            <XAxis dataKey="ts" tickFormatter={xTickFormatter} tickCount={xTickCount} minTickGap={24} stroke="#7f8a9a" />
            <YAxis stroke="#7f8a9a" allowDecimals={false} />
            <Tooltip content={tooltip} />
            <Area type="monotone" dataKey="vlccCount" stroke="none" fill="url(#vlccGlow)" />
            <Area type="monotone" dataKey="lngCount" stroke="none" fill="url(#lngGlow)" />
            <Line type="monotone" dataKey="vlccCount" stroke="#00c805" dot={{ r: 2.5, fill: '#00c805' }} strokeWidth={2.2} isAnimationActive />
            <Line type="monotone" dataKey="lngCount" stroke="#5ac8fa" dot={{ r: 2.5, fill: '#5ac8fa' }} strokeWidth={2.2} isAnimationActive />
            {rollingEnabled && (
              <>
                <Line type="monotone" dataKey="vlccCountRolling" stroke="#89ff9b" dot={false} strokeWidth={1.4} strokeDasharray="5 5" isAnimationActive />
                <Line type="monotone" dataKey="lngCountRolling" stroke="#9edfff" dot={false} strokeWidth={1.4} strokeDasharray="5 5" isAnimationActive />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </article>

      <article className="panel">
        <h2>Estimated Energy Volume</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={enhanced} syncId="sync-main">
            <CartesianGrid strokeDasharray="2 8" stroke="#2f3844" />
            <XAxis dataKey="ts" tickFormatter={xTickFormatter} tickCount={xTickCount} minTickGap={24} stroke="#7f8a9a" />
            <YAxis stroke="#7f8a9a" />
            <Tooltip content={tooltip} />
            <Line type="monotone" dataKey="oilEnergy" stroke="#f6bd16" dot={{ r: 2.5, fill: '#f6bd16' }} strokeWidth={2.2} isAnimationActive />
            <Line type="monotone" dataKey="lngEnergy" stroke="#8b83ff" dot={{ r: 2.5, fill: '#8b83ff' }} strokeWidth={2.2} isAnimationActive />
            {rollingEnabled && (
              <>
                <Line type="monotone" dataKey="oilEnergyRolling" stroke="#f7dd81" dot={false} strokeWidth={1.4} strokeDasharray="5 5" isAnimationActive />
                <Line type="monotone" dataKey="lngEnergyRolling" stroke="#b2aef9" dot={false} strokeWidth={1.4} strokeDasharray="5 5" isAnimationActive />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}

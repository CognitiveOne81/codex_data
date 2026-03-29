import { useEffect, useMemo, useState } from 'react';
import { fetchMetrics, fetchSources, fetchStatus } from './lib/api';
import { TimeframeSelector } from './components/TimeframeSelector';
import { ToggleGroup } from './components/ToggleGroup';
import { MetricCharts } from './components/MetricCharts';

const transitOptions = [
  { label: 'Entrance', value: 'ENTRANCE' },
  { label: 'Full Transit', value: 'FULL_TRANSIT' },
];

const rollingOptions = [
  { label: '1 hour', value: '1H' },
  { label: '24 hours', value: '24H' },
  { label: '7 days', value: '7D' },
];

export function App() {
  const [timeframe, setTimeframe] = useState('1D');
  const [transit, setTransit] = useState('ENTRANCE');
  const [rollingEnabled, setRollingEnabled] = useState(true);
  const [rollingWindow, setRollingWindow] = useState('1H');
  const [data, setData] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState('aishub');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const loadSources = async () => {
      const sourceList = await fetchSources();
      setSources(sourceList || []);
      if (sourceList?.length && !sourceList.some((src) => src.id === selectedSource)) {
        setSelectedSource(sourceList[0].id);
      }
    };

    loadSources().catch(console.error);
  }, []);

  useEffect(() => {
    const load = async () => {
      const [metrics, status] = await Promise.all([
        fetchMetrics({ source: selectedSource, timeframe, transit, carrier: 'BOTH', energy: 'BOTH' }),
        fetchStatus(),
      ]);
      setData(metrics || []);
      setLastUpdated(status.lastUpdated);
    };

    load().catch(console.error);
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [selectedSource, timeframe, transit]);

  const activeTransit = useMemo(() => transitOptions.find((o) => o.value === transit)?.label || transit, [transit]);
  const activeSource = useMemo(() => sources.find((s) => s.id === selectedSource), [sources, selectedSource]);

  return (
    <main className="app robinhood-theme">
      <header className="hero panel">
        <div>
          <p className="eyebrow">AIS Carrier Analytics</p>
          <h1>Strait of Hormuz Carrier Tracker</h1>
          <p className="subtitle">Robinhood-style trend charts with per-carrier tick markers and energy volume across VLCC + LNG transits.</p>
        </div>
      </header>

      <section className="panel controls">
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />

        <div className="source-tabs" role="tablist" aria-label="Data sources">
          {sources.map((source) => (
            <button
              key={source.id}
              role="tab"
              type="button"
              className={`source-tab ${source.id === selectedSource ? 'active' : ''}`}
              aria-selected={source.id === selectedSource}
              onClick={() => setSelectedSource(source.id)}
            >
              {source.name}
            </button>
          ))}
        </div>

        <div className="control-row">
          <ToggleGroup label="Transit" value={transit} onChange={setTransit} options={transitOptions} />
          <ToggleGroup label="Rolling Avg" value={rollingWindow} onChange={setRollingWindow} options={rollingOptions} />
          <label className="control check">
            <span>Overlay</span>
            <input type="checkbox" checked={rollingEnabled} onChange={(event) => setRollingEnabled(event.target.checked)} />
          </label>
        </div>
        <div className="meta">Source: {activeSource?.name || selectedSource} · Transit: {activeTransit} · Refresh: every 1 minute</div>
        <div className="meta">Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Waiting for ingest...'}</div>
      </section>

      <MetricCharts
        data={data}
        timeframe={timeframe}
        transitLabel={activeTransit}
        rollingEnabled={rollingEnabled}
        rollingWindow={rollingWindow}
      />
    </main>
  );
}

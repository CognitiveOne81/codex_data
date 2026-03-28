import { useEffect, useMemo, useState } from 'react';
import { fetchMetrics, fetchSources, fetchStatus } from './lib/api';
import { TimeframeSelector } from './components/TimeframeSelector';
import { ToggleGroup } from './components/ToggleGroup';
import { MetricCharts } from './components/MetricCharts';

const transitOptions = [
  { label: 'Entrance only', value: 'ENTRANCE' },
  { label: 'Exit only', value: 'EXIT' },
  { label: 'Full transit', value: 'FULL_TRANSIT' },
];

const carrierOptions = [
  { label: 'Both carriers', value: 'BOTH' },
  { label: 'VLCC only', value: 'VLCC' },
  { label: 'LNG only', value: 'LNG' },
];

const rollingOptions = [
  { label: '1 hour', value: '1H' },
  { label: '24 hours', value: '24H' },
  { label: '7 days', value: '7D' },
];

const allowedSourceNames = new Set(['MarineTraffic', 'VesselFinder', 'AISHub']);

export function App() {
  const [sources, setSources] = useState([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [timeframe, setTimeframe] = useState('1D');
  const [transit, setTransit] = useState('ENTRANCE');
  const [carrier, setCarrier] = useState('BOTH');
  const [rollingEnabled, setRollingEnabled] = useState(true);
  const [rollingWindow, setRollingWindow] = useState('1H');
  const [data, setData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');

  const activeSource = sources[sourceIndex];

  useEffect(() => {
    fetchSources()
      .then((incoming) => {
        const filtered = incoming.filter((source) => allowedSourceNames.has(source.name));
        setSources(filtered);
        setSourceIndex(0);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeSource) return;

    const load = async () => {
      const [metrics, status] = await Promise.all([
        fetchMetrics({ source: activeSource.id, timeframe, transit, carrier }),
        fetchStatus(),
      ]);
      setData(metrics);
      setLastUpdated(status.lastUpdated);
    };

    load().catch(console.error);
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [activeSource, timeframe, transit, carrier]);

  const transitLabel = useMemo(() => transitOptions.find((option) => option.value === transit)?.label || transit, [transit]);
  const carrierLabel = useMemo(() => carrierOptions.find((option) => option.value === carrier)?.label || carrier, [carrier]);

  return (
    <main className="app robinhood-theme">
      <header className="hero panel">
        <div>
          <p className="eyebrow">AIS Carrier Analytics</p>
          <h1>Strait of Hormuz Carrier Tracker</h1>
          <p className="subtitle">Robinhood-inspired source paging with two synchronized line charts per AIS provider.</p>
        </div>
      </header>

      <section className="source-nav panel">
        <button
          type="button"
          onClick={() => setSourceIndex((prev) => (prev - 1 + sources.length) % sources.length)}
          disabled={!sources.length}
          aria-label="Previous source"
        >
          ←
        </button>
        <div>
          <h2>{activeSource?.name || 'Loading source...'}</h2>
          <div className="meta">Source site: {activeSource?.website || '-'}</div>
          <div className="meta muted">Page {sources.length ? sourceIndex + 1 : 0} of {sources.length || 0}</div>
        </div>
        <button
          type="button"
          onClick={() => setSourceIndex((prev) => (prev + 1) % sources.length)}
          disabled={!sources.length}
          aria-label="Next source"
        >
          →
        </button>
      </section>

      <section className="panel controls">
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <div className="control-row">
          <ToggleGroup label="Transit" value={transit} onChange={setTransit} options={transitOptions} />
          <ToggleGroup label="Carrier" value={carrier} onChange={setCarrier} options={carrierOptions} />
          <ToggleGroup label="Rolling Window" value={rollingWindow} onChange={setRollingWindow} options={rollingOptions} />
          <label className="control check">
            <span>Rolling average overlay</span>
            <input type="checkbox" checked={rollingEnabled} onChange={(event) => setRollingEnabled(event.target.checked)} />
          </label>
        </div>
        <div className="meta">
          Selected carrier type: {carrierLabel} · Transit category: {transitLabel} · Fuel type: inferred from AIS vessel class metadata.
        </div>
        <div className="meta">Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Waiting for first ingest...'}</div>
      </section>

      <MetricCharts
        data={data}
        sourceName={activeSource?.name || ''}
        carrierLabel={carrierLabel}
        transitLabel={transitLabel}
        rollingEnabled={rollingEnabled}
        rollingWindow={rollingWindow}
      />
    </main>
  );
}

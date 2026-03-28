import { useEffect, useMemo, useState } from 'react';
import { fetchMetrics, fetchStatus } from './lib/api';
import { TimeframeSelector } from './components/TimeframeSelector';
import { ToggleGroup } from './components/ToggleGroup';
import { MetricCharts } from './components/MetricCharts';

const transitOptions = [
  { label: 'Entrance', value: 'ENTRANCE' },
  { label: 'Full Transit', value: 'FULL_TRANSIT' },
];

const carrierOptions = [
  { label: 'Both', value: 'BOTH' },
  { label: 'VLCC only', value: 'VLCC' },
  { label: 'LNG only', value: 'LNG' },
];

const energyOptions = [
  { label: 'Both', value: 'BOTH' },
  { label: 'Oil (VLCC)', value: 'OIL' },
  { label: 'LNG', value: 'LNG' },
];

const rollingOptions = [
  { label: '1 hour', value: '1H' },
  { label: '24 hours', value: '24H' },
  { label: '7 days', value: '7D' },
];

export function App() {
  const [timeframe, setTimeframe] = useState('1D');
  const [transit, setTransit] = useState('ENTRANCE');
  const [carrier, setCarrier] = useState('BOTH');
  const [energy, setEnergy] = useState('BOTH');
  const [rollingEnabled, setRollingEnabled] = useState(true);
  const [rollingWindow, setRollingWindow] = useState('1H');
  const [data, setData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    const load = async () => {
      const [metrics, status] = await Promise.all([
        fetchMetrics({ source: 'aishub', timeframe, transit, carrier, energy }),
        fetchStatus(),
      ]);
      setData(metrics);
      setLastUpdated(status.lastUpdated);
    };

    load().catch(console.error);
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [timeframe, transit, carrier, energy]);

  const activeCarrier = useMemo(() => carrierOptions.find((o) => o.value === carrier)?.label || carrier, [carrier]);
  const activeTransit = useMemo(() => transitOptions.find((o) => o.value === transit)?.label || transit, [transit]);

  return (
    <main className="app robinhood-theme">
      <header className="hero panel">
        <div>
          <p className="eyebrow">AIS Carrier Analytics</p>
          <h1>Strait of Hormuz Carrier Tracker</h1>
          <p className="subtitle">Dark-mode analytics for VLCC and LNG carrier transits across the Strait of Hormuz.</p>
        </div>
      </header>

      <section className="panel controls">
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <div className="control-row">
          <ToggleGroup label="Transit" value={transit} onChange={setTransit} options={transitOptions} />
          <ToggleGroup label="Carrier" value={carrier} onChange={setCarrier} options={carrierOptions} />
          <ToggleGroup label="Energy" value={energy} onChange={setEnergy} options={energyOptions} />
          <ToggleGroup label="Rolling Avg" value={rollingWindow} onChange={setRollingWindow} options={rollingOptions} />
          <label className="control check">
            <span>Overlay</span>
            <input type="checkbox" checked={rollingEnabled} onChange={(event) => setRollingEnabled(event.target.checked)} />
          </label>
        </div>
        <div className="meta">Carrier: {activeCarrier} · Transit: {activeTransit} · Refresh: every 1 minute</div>
        <div className="meta">Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Waiting for ingest...'}</div>
      </section>

      <MetricCharts
        data={data}
        carrierLabel={activeCarrier}
        transitLabel={activeTransit}
        rollingEnabled={rollingEnabled}
        rollingWindow={rollingWindow}
      />
    </main>
  );
}

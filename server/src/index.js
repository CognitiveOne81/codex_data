import express from 'express';
import cors from 'cors';
import { config, SOURCES } from './config.js';
import { initSchema } from './db/schema.js';
import { ensureSettings, getSettings, updateSettings } from './services/settingsService.js';
import { getLastUpdated, runIngestionCycle } from './services/ingestService.js';
import { getSourceMetrics } from './services/metricsService.js';

const app = express();
app.use(cors());
app.use(express.json());


function renderDashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Strait of Hormuz Carrier Tracker</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #06090c;
        --panel: #111820;
        --line: #00c805;
        --line-soft: #5fff85;
        --muted: #91a0b2;
        --text: #edf3fa;
        --border: #243041;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(1000px 460px at 85% -10%, rgba(0, 200, 5, 0.18), transparent 68%),
          radial-gradient(700px 430px at 5% 2%, rgba(56, 189, 248, 0.18), transparent 60%),
          var(--bg);
      }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 22px; }
      .panel {
        background: linear-gradient(180deg, rgba(18, 25, 33, 0.97), rgba(12, 17, 24, 0.97));
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px;
        margin-top: 16px;
      }
      h1 { margin: 6px 0; font-size: 2rem; }
      .eyebrow { margin: 0; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; font-size: 12px; }
      .subtitle, .meta { color: var(--muted); }
      .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
      .tab {
        border: 1px solid #2d3949;
        border-radius: 999px;
        background: #121b25;
        color: #c4cfde;
        padding: 8px 12px;
        cursor: pointer;
      }
      .tab.active {
        border-color: var(--line);
        background: rgba(0, 200, 5, 0.16);
        color: #d5ffe2;
        box-shadow: 0 0 0 1px rgba(0, 200, 5, 0.25) inset;
      }
      .controls { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
      .controls select {
        background: #0f1620;
        color: #dde7f5;
        border: 1px solid #2e3a4b;
        border-radius: 8px;
        padding: 7px 9px;
      }
      .ticker { display: flex; align-items: baseline; gap: 10px; margin-top: 10px; }
      .ticker .value { font-size: 2.5rem; font-weight: 700; letter-spacing: -1px; }
      .ticker .delta { color: var(--line-soft); font-weight: 600; }
      .chart-wrap { position: relative; margin-top: 12px; border-radius: 12px; border: 1px solid #203041; overflow: hidden; }
      canvas { display: block; width: 100%; height: 320px; background: linear-gradient(180deg, rgba(0, 200, 5, 0.08), rgba(0, 0, 0, 0)); }
      .overlay {
        position: absolute; left: 12px; bottom: 10px;
        color: #84f5a2; font-size: 12px;
        background: rgba(0,0,0,0.35); padding: 4px 8px; border-radius: 999px;
      }
      .empty { color: #f0b663; margin-top: 10px; font-size: 0.9rem; }
      a { color: #9fc6ff; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="panel">
        <p class="eyebrow">AIS Carrier Analytics</p>
        <h1>Strait of Hormuz Carrier Tracker</h1>
        <p class="subtitle">Robinhood-like chart display with source tabs, always rendered from the API root.</p>
        <div id="tabs" class="tabs"></div>
        <div class="controls">
          <select id="timeframe">
            <option value="1D">1 Day</option>
            <option value="1W">1 Week</option>
            <option value="1M">1 Month</option>
          </select>
          <select id="transit">
            <option value="ENTRANCE">Entrance only</option>
            <option value="EXIT">Exit only</option>
            <option value="FULL_TRANSIT">Full transit</option>
          </select>
          <select id="carrier">
            <option value="BOTH">Both carriers</option>
            <option value="VLCC">VLCC only</option>
            <option value="LNG">LNG only</option>
          </select>
        </div>
      </section>

      <section class="panel">
        <div class="meta" id="sourceMeta">Loading source...</div>
        <div class="ticker">
          <div class="value" id="heroValue">0</div>
          <div class="delta" id="heroDelta">—</div>
        </div>
        <div class="chart-wrap">
          <canvas id="chart" width="1040" height="320"></canvas>
          <div class="overlay" id="overlayLabel">No data yet</div>
        </div>
        <div class="empty" id="emptyHint" hidden>No points were returned, showing a baseline chart.</div>
      </section>

      <section class="panel meta">
        API endpoints remain available: <a href="/api/sources">/api/sources</a>, <a href="/api/metrics?source=marinetraffic">/api/metrics</a>, <a href="/api/status">/api/status</a>
      </section>
    </main>

    <script>
      const chart = document.getElementById('chart');
      const ctx = chart.getContext('2d');
      const tabs = document.getElementById('tabs');
      const timeframe = document.getElementById('timeframe');
      const transit = document.getElementById('transit');
      const carrier = document.getElementById('carrier');
      const heroValue = document.getElementById('heroValue');
      const heroDelta = document.getElementById('heroDelta');
      const sourceMeta = document.getElementById('sourceMeta');
      const overlayLabel = document.getElementById('overlayLabel');
      const emptyHint = document.getElementById('emptyHint');

      let sources = [];
      let activeSource = '';

      const fallbackPoints = Array.from({ length: 40 }, (_, i) => ({
        ts: Date.now() - (39 - i) * 60 * 1000,
        vesselCount: 0,
      }));

      function drawLine(points) {
        const w = chart.width;
        const h = chart.height;
        ctx.clearRect(0, 0, w, h);

        const values = points.map((p) => Number(p.vesselCount || 0));
        const min = Math.min(...values, 0);
        const max = Math.max(...values, 1);
        const range = Math.max(1, max - min);

        ctx.strokeStyle = '#243344';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
          const y = (h / 5) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(0, 200, 5, 0.32)');
        grad.addColorStop(1, 'rgba(0, 200, 5, 0.02)');

        ctx.beginPath();
        points.forEach((point, i) => {
          const x = (i / Math.max(points.length - 1, 1)) * w;
          const y = h - ((Number(point.vesselCount || 0) - min) / range) * (h - 24) - 12;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#00c805';
        ctx.stroke();

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      function updateHero(points) {
        const first = Number(points[0]?.vesselCount || 0);
        const last = Number(points[points.length - 1]?.vesselCount || 0);
        const diff = last - first;
        const prefix = diff > 0 ? '+' : '';
        heroValue.textContent = last.toLocaleString();
        heroDelta.textContent = prefix + diff.toLocaleString() + ' (' + points.length + ' points)';
      }

      function renderTabs() {
        tabs.innerHTML = '';
        sources.forEach((source) => {
          const button = document.createElement('button');
          button.className = 'tab ' + (source.id === activeSource ? 'active' : '');
          button.textContent = source.name;
          button.onclick = () => {
            activeSource = source.id;
            renderTabs();
            loadMetrics();
          };
          tabs.appendChild(button);
        });
      }

      async function loadMetrics() {
        if (!activeSource) return;
        const query = new URLSearchParams({
          source: activeSource,
          timeframe: timeframe.value,
          transit: transit.value,
          carrier: carrier.value,
        });
        const res = await fetch('/api/metrics?' + query.toString());
        const payload = await res.json();
        const points = payload.points?.length ? payload.points : fallbackPoints;
        emptyHint.hidden = Boolean(payload.points?.length);
        drawLine(points);
        updateHero(points);
        const source = sources.find((s) => s.id === activeSource);
        sourceMeta.textContent = (source?.name || activeSource) + ' · ' + (source?.website || '');
        const lastTs = points[points.length - 1]?.ts;
        overlayLabel.textContent = lastTs ? 'Latest: ' + new Date(lastTs).toLocaleString() : 'No timestamp data';
      }

      async function init() {
        try {
          const res = await fetch('/api/sources');
          const payload = await res.json();
          sources = payload.sources || [];
          activeSource = sources[0]?.id || '';
          renderTabs();
          await loadMetrics();
        } catch (err) {
          console.error(err);
          sourceMeta.textContent = 'Failed to load source list.';
          drawLine(fallbackPoints);
        }
      }

      [timeframe, transit, carrier].forEach((el) => el.addEventListener('change', loadMetrics));
      init();
      setInterval(loadMetrics, 60_000);
    </script>
  </body>
</html>`;
}


app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => {
  res.type('html').send(renderDashboardHtml());
});

app.get('/api/sources', (_req, res) => {
  res.json({ sources: SOURCES });
});

app.get('/api/status', (_req, res) => {
  res.json({
    lastUpdated: getLastUpdated(),
    pollIntervalMs: config.pollIntervalMs,
  });
});

app.get('/api/settings', async (_req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings', async (req, res, next) => {
  try {
    const updated = await updateSettings(req.body || {});
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.get('/api/metrics', async (req, res, next) => {
  try {
    const data = await getSourceMetrics({
      sourceId: req.query.source,
      timeframe: req.query.timeframe || '1D',
      transit: req.query.transit || 'ENTRANCE',
      carrier: req.query.carrier || 'BOTH',
    });
    res.json({ points: data });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

async function bootstrap() {
  await initSchema();
  await ensureSettings();

  try {
    await runIngestionCycle();
  } catch (error) {
    console.error('Initial ingestion failed:', error.message);
  }

  setInterval(async () => {
    try {
      await runIngestionCycle();
    } catch (error) {
      console.error('Ingestion cycle failed:', error.message);
    }
  }, config.pollIntervalMs);

  app.listen(config.port, () => {
    console.log(`Hormuz tracker API running on port ${config.port}`);
  });
}

bootstrap();

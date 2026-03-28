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

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => {
  res.json({
    name: 'Strait of Hormuz Carrier Tracker API',
    ok: true,
    health: '/health',
    endpoints: [
      '/api/sources',
      '/api/status',
      '/api/settings',
      '/api/metrics?source=aishub&timeframe=1D&transit=ENTRANCE&carrier=BOTH',
    ],
  });
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

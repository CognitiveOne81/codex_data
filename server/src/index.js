import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, SOURCES, ZONES } from './config.js';
import { initSchema } from './db/schema.js';
import { ensureSettings, getSettings, updateSettings } from './services/settingsService.js';
import { getLastUpdated, runIngestionCycle } from './services/ingestService.js';
import { getSourceMetrics } from './services/metricsService.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(cors());
app.use(express.json());
app.use(express.static(clientDistPath));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/sources', (_req, res) => {
  res.json({ sources: SOURCES, zones: ZONES });
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
      sourceId: req.query.source || 'aishub',
      timeframe: req.query.timeframe || '1D',
      transit: req.query.transit || 'ENTRANCE',
      carrier: req.query.carrier || 'BOTH',
      energy: req.query.energy || 'BOTH',
    });
    res.json({ points: data });
  } catch (error) {
    next(error);
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
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

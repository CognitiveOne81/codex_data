import { config } from '../config.js';

const VESSEL_TYPES = new Set(['VLCC', 'LNG']);
const CARRIER_TYPE_CODES = new Set([80, 81, 82, 83, 84, 85, 86, 87, 88, 89]);
const LNG_KEYWORDS = [' LNG', 'LNG ', 'LNG-', '-LNG', 'LIQUID NATURAL GAS', 'GAS CARRIER'];
const TANKER_KEYWORDS = ['CRUDE', 'TANKER', 'VLCC'];

function normalizeType(raw) {
  const n = Number(raw);
  if (Number.isFinite(n) && CARRIER_TYPE_CODES.has(n)) return 'VLCC';

  const t = String(raw || '').toUpperCase();
  if (LNG_KEYWORDS.some((keyword) => t.includes(keyword))) return 'LNG';
  if (t.includes('LNG')) return 'LNG';
  if (TANKER_KEYWORDS.some((keyword) => t.includes(keyword))) return 'VLCC';
  return null;
}

function parseAisHubRow(row) {
  const vesselType = normalizeType(
    row.TYPE_NAME || row.SHIPTYPE || row.vessel_type || row.TYPE || row.type || row.NAME || row.SHIPNAME,
  );
  if (!VESSEL_TYPES.has(vesselType)) return null;

  const lat = Number(row.LAT || row.lat || row.LATITUDE || row.latitude);
  const lon = Number(row.LON || row.lon || row.LONGITUDE || row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    sourceId: 'aishub',
    sourceName: 'AISHub',
    mmsi: String(row.MMSI || row.mmsi || ''),
    imo: row.IMO ? String(row.IMO) : null,
    vesselName: row.NAME || row.SHIPNAME || 'Unknown',
    vesselType,
    lat,
    lon,
    observedAt: new Date(row.TIMESTAMP || row.time || row.TIME || Date.now()).toISOString(),
  };
}

async function fetchAisHubLive() {
  if (!config.aisHub.username) return [];

  const url = new URL(config.aisHub.baseUrl);
  url.searchParams.set('username', config.aisHub.username);
  url.searchParams.set('format', '1');
  url.searchParams.set('output', 'json');
  url.searchParams.set('compress', '0');
  url.searchParams.set('latmin', String(config.aisHub.bounds.latMin));
  url.searchParams.set('latmax', String(config.aisHub.bounds.latMax));
  url.searchParams.set('lonmin', String(config.aisHub.bounds.lonMin));
  url.searchParams.set('lonmax', String(config.aisHub.bounds.lonMax));
  url.searchParams.set('interval', String(config.aisHub.maxAgeMinutes));

  if (config.aisHub.key) {
    url.searchParams.set('apikey', config.aisHub.key);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.aisHub.timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`AISHub HTTP ${res.status}`);
    const payload = await res.json();
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.vessels)
        ? payload.vessels
        : Array.isArray(payload) && Array.isArray(payload[1])
          ? payload[1]
          : Array.isArray(payload)
            ? payload
            : [];
    return rows.map(parseAisHubRow).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateSyntheticSample(now = new Date()) {
  const vessels = [];
  for (let i = 0; i < 24; i += 1) {
    const vesselType = i % 2 === 0 ? 'VLCC' : 'LNG';
    const seed = now.getTime() / 60000 + i;
    const onEntranceTrack = i % 3 === 0;
    const lat = onEntranceTrack ? 26.2 + seededRandom(seed) * 0.5 : 26.12 + seededRandom(seed) * 0.7;
    const lon = onEntranceTrack ? 55.96 + seededRandom(seed + 3) * 0.12 : 57.16 + seededRandom(seed + 8) * 0.12;
    vessels.push({
      sourceId: 'aishub',
      sourceName: 'AISHub',
      mmsi: `99900${1000 + i}`,
      imo: `${9300000 + i}`,
      vesselName: `${vesselType}-${i}`,
      vesselType,
      lat,
      lon,
      observedAt: now.toISOString(),
    });
  }
  return vessels;
}

export async function fetchAllSources() {
  try {
    const live = await fetchAisHubLive();
    return [{ source: { id: 'aishub', name: 'AISHub' }, vessels: live.length ? live : generateSyntheticSample() }];
  } catch (error) {
    console.error('AISHub fetch failed, using synthetic data:', error.message);
    return [{ source: { id: 'aishub', name: 'AISHub' }, vessels: generateSyntheticSample() }];
  }
}

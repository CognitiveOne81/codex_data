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

function normalizeObservedAt(raw) {
  if (!raw && raw !== 0) return new Date().toISOString();

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    const asMilliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
    const fromNumeric = new Date(asMilliseconds);
    if (!Number.isNaN(fromNumeric.getTime())) {
      return fromNumeric.toISOString();
    }
  }

  const fromString = new Date(raw);
  if (!Number.isNaN(fromString.getTime())) {
    return fromString.toISOString();
  }

  return new Date().toISOString();
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
    observedAt: normalizeObservedAt(row.TIMESTAMP || row.time || row.TIME),
  };
}

async function fetchAisHubLive() {
  if (!config.aisHub.username) {
    throw new Error('AISHUB_USERNAME (or AISHUB_API_KEY) is required for live ingestion');
  }

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
        : Array.isArray(payload?.Data)
          ? payload.Data
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

export async function fetchAllSources() {
  const live = await fetchAisHubLive();
  return [{ source: { id: 'aishub', name: 'AISHub' }, vessels: live }];
}

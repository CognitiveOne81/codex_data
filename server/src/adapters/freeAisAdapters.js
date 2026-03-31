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

function parseVesselFinderRow(row) {
  const ais = row?.AIS || row?.ais || row;
  if (!ais) return null;

  const vesselType = normalizeType(ais.TYPE || ais.type || ais.TYPE_NAME || ais.SHIPTYPE);
  if (!VESSEL_TYPES.has(vesselType)) return null;

  const lat = Number(ais.LATITUDE || ais.latitude || ais.LAT || ais.lat);
  const lon = Number(ais.LONGITUDE || ais.longitude || ais.LON || ais.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    sourceId: 'vesselfinder',
    sourceName: 'VesselFinder',
    mmsi: String(ais.MMSI || ais.mmsi || ''),
    imo: ais.IMO ? String(ais.IMO) : null,
    vesselName: ais.NAME || ais.SHIPNAME || 'Unknown',
    vesselType,
    lat,
    lon,
    observedAt: normalizeObservedAt(ais.TIMESTAMP || ais.time || ais.TIME),
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

async function fetchVesselFinderLive() {
  if (!config.vesselFinder.userKey) {
    throw new Error('VESSELFINDER_USER_KEY (or VESSELFINDER_API_KEY) is required for live ingestion');
  }

  const url = new URL(config.vesselFinder.baseUrl);
  url.searchParams.set('userkey', config.vesselFinder.userKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('interval', String(config.vesselFinder.intervalMinutes));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.vesselFinder.timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`VesselFinder HTTP ${res.status}`);
    const payload = await res.json();
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.vessels)
          ? payload.vessels
          : [];
    return rows.map(parseVesselFinderRow).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAllSources() {
  const providers = [
    {
      id: 'aishub',
      name: 'AISHub',
      enabled: Boolean(config.aisHub.username),
      fetcher: fetchAisHubLive,
    },
    {
      id: 'vesselfinder',
      name: 'VesselFinder',
      enabled: Boolean(config.vesselFinder.userKey),
      fetcher: fetchVesselFinderLive,
    },
  ];

  const results = await Promise.all(
    providers
      .filter((provider) => provider.enabled)
      .map(async (provider) => {
        try {
          const vessels = await provider.fetcher();
          return { source: { id: provider.id, name: provider.name }, vessels };
        } catch (error) {
          console.error(`${provider.name} ingestion failed:`, error.message);
          return { source: { id: provider.id, name: provider.name }, vessels: [] };
        }
      }),
  );

  if (!results.length) {
    throw new Error('No AIS providers configured. Set AISHUB_* or VESSELFINDER_* environment variables.');
  }

  return results;
}

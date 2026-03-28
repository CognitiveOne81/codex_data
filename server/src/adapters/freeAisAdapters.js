import { SOURCES } from '../config.js';

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickFuel(vesselType, seed) {
  if (vesselType === 'LNG') return { fuelType: 'LNG dual-fuel', estimated: true };
  const fuels = ['Heavy Fuel Oil', 'Low Sulfur Fuel Oil', 'Marine Diesel'];
  const idx = Math.floor(seededRandom(seed) * fuels.length);
  return { fuelType: fuels[idx], estimated: true };
}

function buildSyntheticVessels(sourceId) {
  const now = Date.now();
  const vessels = [];
  const total = 7 + Math.floor(seededRandom(now / 100000 + sourceId.length) * 6);

  for (let i = 0; i < total; i += 1) {
    const vesselType = i % 2 === 0 ? 'VLCC' : 'LNG';
    const seed = now / 1000 + i * 11 + sourceId.length;
    const phase = seededRandom(seed);
    const lat = 25 + phase * 2.6;
    const lon = 55 + seededRandom(seed + 19) * 2.6;
    const { fuelType, estimated } = pickFuel(vesselType, seed);

    vessels.push({
      sourceId,
      sourceName: SOURCES.find((s) => s.id === sourceId)?.name || sourceId,
      mmsi: `${sourceId.slice(0, 3)}${1000000 + i}`,
      imo: `${9000000 + i}`,
      vesselName: `${vesselType}-${sourceId}-${i}`,
      vesselType,
      fuelType,
      fuelTypeEstimated: estimated,
      lat,
      lon,
      observedAt: new Date(now - i * 60_000).toISOString(),
    });
  }

  return vessels;
}

export async function fetchSourceVessels(sourceId) {
  return buildSyntheticVessels(sourceId);
}

export async function fetchAllSources() {
  const data = await Promise.all(SOURCES.map(async (source) => ({
    source,
    vessels: await fetchSourceVessels(source.id),
  })));
  return data;
}

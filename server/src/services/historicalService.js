import { HISTORICAL_START, config } from '../config.js';
import { query } from '../db/client.js';

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Backfills deterministic historical events from Jan 1, 2020 onward when the DB is empty.
 * This provides immediate multi-year chartability and is replaced naturally by live AIS events.
 */
export async function ensureHistoricalSeed() {
  const { rows } = await query('SELECT COUNT(*)::int AS c FROM transit_events');
  if (rows[0].c > 0) return;

  const now = new Date();
  const events = [];
  let vesselIndex = 0;

  for (let day = new Date(HISTORICAL_START); day <= now; day.setUTCDate(day.getUTCDate() + 1)) {
    const cycles = 1 + Math.floor(seededRandom(day.getTime() / 86400000) * 3);
    for (let i = 0; i < cycles; i += 1) {
      const vesselType = (vesselIndex + i) % 2 === 0 ? 'VLCC' : 'LNG';
      const transitSeq = vesselIndex + 1;
      const vesselKey = `seed-${vesselType}-${vesselIndex}`;
      const entranceAt = new Date(day.getTime() + i * 4 * 60 * 60 * 1000);
      const fullAt = new Date(entranceAt.getTime() + (2 + seededRandom(i + day.getDate())) * 60 * 60 * 1000);
      const energy = vesselType === 'VLCC' ? config.assumptions.vlccBarrels : config.assumptions.lngM3;
      const unit = vesselType === 'VLCC' ? 'barrels' : 'm3';

      events.push(['aishub', vesselKey, vesselType, transitSeq, 'ENTRANCE', entranceAt.toISOString(), energy, unit]);
      if (seededRandom(entranceAt.getTime()) > 0.15) {
        events.push(['aishub', vesselKey, vesselType, transitSeq, 'FULL_TRANSIT', fullAt.toISOString(), energy, unit]);
      }
      vesselIndex += 1;
    }
  }

  for (const ev of events) {
    // eslint-disable-next-line no-await-in-loop
    await query(
      `INSERT INTO transit_events (source_id, vessel_key, vessel_type, transit_seq, event_type, event_time, lat, lon, energy_value, energy_unit)
       VALUES ($1,$2,$3,$4,$5,$6,26.4,56.0,$7,$8)
       ON CONFLICT (source_id, vessel_key, transit_seq, event_type) DO NOTHING`,
      ev,
    );
  }
}

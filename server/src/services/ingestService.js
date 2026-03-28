import { ZONES, config } from '../config.js';
import { query } from '../db/client.js';
import { fetchAllSources } from '../adapters/freeAisAdapters.js';
import { isInsideRect } from '../utils/geo.js';
import { getSettings } from './settingsService.js';

let lastUpdated = null;

function dedupe(vessels) {
  const map = new Map();
  for (const vessel of vessels) {
    const vesselKey = vessel.imo || vessel.mmsi;
    if (!vesselKey) continue;
    map.set(vesselKey, { ...vessel, vesselKey });
  }
  return [...map.values()];
}

function energyForVessel(vesselType, settings) {
  if (vesselType === 'VLCC') return { value: Number(settings.vlcc_barrels), unit: 'barrels' };
  return { value: Number(settings.lng_m3), unit: 'm3' };
}

async function getState(vessel) {
  const { rows } = await query('SELECT * FROM vessel_transit_state WHERE vessel_key = $1', [vessel.vesselKey]);
  return rows[0] || null;
}

async function upsertState(vessel, state) {
  await query(
    `INSERT INTO vessel_transit_state (vessel_key, source_id, vessel_type, state, transit_seq, last_seen_at, last_outside_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (vessel_key)
     DO UPDATE SET
      source_id = EXCLUDED.source_id,
      vessel_type = EXCLUDED.vessel_type,
      state = EXCLUDED.state,
      transit_seq = EXCLUDED.transit_seq,
      last_seen_at = EXCLUDED.last_seen_at,
      last_outside_at = EXCLUDED.last_outside_at,
      updated_at = now()`,
    [
      vessel.vesselKey,
      vessel.sourceId,
      vessel.vesselType,
      state.state,
      state.transit_seq,
      state.last_seen_at,
      state.last_outside_at,
    ],
  );
}

async function insertEvent(vessel, state, eventType, observedAt, settings) {
  const energy = energyForVessel(vessel.vesselType, settings);
  await query(
    `INSERT INTO transit_events
    (source_id, vessel_key, mmsi, imo, vessel_name, vessel_type, transit_seq, event_type, event_time, lat, lon, energy_value, energy_unit)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (source_id, vessel_key, transit_seq, event_type) DO NOTHING`,
    [
      vessel.sourceId,
      vessel.vesselKey,
      vessel.mmsi,
      vessel.imo,
      vessel.vesselName,
      vessel.vesselType,
      state.transit_seq,
      eventType,
      observedAt,
      vessel.lat,
      vessel.lon,
      energy.value,
      energy.unit,
    ],
  );
}

async function processVessel(vessel, settings) {
  const observedAt = new Date(vessel.observedAt);
  const inEntrance = isInsideRect(vessel, ZONES.entrance);
  const inExit = isInsideRect(vessel, ZONES.exit);
  const inAnyZone = inEntrance || inExit;

  await query(
    `INSERT INTO ais_positions (source_id, vessel_key, mmsi, imo, vessel_name, vessel_type, observed_at, lat, lon)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (source_id, vessel_key, observed_at) DO NOTHING`,
    [vessel.sourceId, vessel.vesselKey, vessel.mmsi, vessel.imo, vessel.vesselName, vessel.vesselType, observedAt, vessel.lat, vessel.lon],
  );

  const existing = await getState(vessel);
  const state = existing
    ? { ...existing, transit_seq: Number(existing.transit_seq) }
    : { state: 'OUTSIDE', transit_seq: 0, last_outside_at: null, last_seen_at: observedAt.toISOString() };

  // Transit reset logic: vessel must be outside both zones and remain outside during cooldown.
  if (!inAnyZone) {
    const outsideAt = state.last_outside_at ? new Date(state.last_outside_at) : observedAt;
    const elapsedHours = (observedAt.getTime() - outsideAt.getTime()) / (60 * 60 * 1000);
    if (state.state !== 'OUTSIDE' && elapsedHours >= Number(settings.transit_cooldown_hours || config.transitCooldownHours)) {
      state.state = 'OUTSIDE';
    }
    state.last_outside_at = outsideAt.toISOString();
  } else {
    state.last_outside_at = null;
  }

  // Entrance event: one event per vessel per transit sequence.
  if (state.state === 'OUTSIDE' && inEntrance) {
    state.transit_seq += 1;
    state.state = 'ENTERED';
    await insertEvent(vessel, state, 'ENTRANCE', observedAt, settings);
  }

  // Full transit event: must have entered first then later hit exit zone.
  if (state.state === 'ENTERED' && inExit) {
    state.state = 'COMPLETED';
    await insertEvent(vessel, state, 'FULL_TRANSIT', observedAt, settings);
  }

  state.last_seen_at = observedAt.toISOString();
  await upsertState(vessel, state);
}

export async function runIngestionCycle() {
  const settings = await getSettings();
  const sourceData = await fetchAllSources();

  for (const { vessels } of sourceData) {
    const normalized = dedupe(vessels).filter((v) => v.vesselType === 'VLCC' || v.vesselType === 'LNG');
    for (const vessel of normalized) {
      // Sequential processing keeps transit state transitions deterministic per vessel.
      // eslint-disable-next-line no-await-in-loop
      await processVessel(vessel, settings);
    }
  }

  lastUpdated = new Date().toISOString();
}

export function getLastUpdated() {
  return lastUpdated;
}

import { config, GEOFENCES } from '../config.js';
import { query } from '../db/client.js';
import { fetchAllSources } from '../adapters/freeAisAdapters.js';
import { isInsideGeofence } from '../utils/geo.js';
import { floorToMinute } from '../utils/time.js';
import { getSettings } from './settingsService.js';
import { evaluateAndSendAlerts } from './alertService.js';

const seenEntrances = new Map();
let lastUpdated = null;

function classifyTransit(vessel) {
  const pos = { lat: vessel.lat, lon: vessel.lon };
  const atEntrance = isInsideGeofence(pos, GEOFENCES.entrance, config.geofenceKm);
  const atExit = isInsideGeofence(pos, GEOFENCES.exit, config.geofenceKm);
  const key = vessel.imo || vessel.mmsi;

  if (atEntrance) {
    seenEntrances.set(key, Date.now());
    return 'ENTRANCE';
  }

  if (atExit && seenEntrances.has(key)) {
    return 'FULL_TRANSIT';
  }

  if (atExit) {
    return 'EXIT';
  }

  return null;
}

function computeEnergy(vessel, settings) {
  if (vessel.vesselType === 'VLCC') {
    return { value: Number(settings.vlcc_barrels), unit: 'barrels crude oil' };
  }
  return { value: Number(settings.lng_m3), unit: 'm3 LNG' };
}

function dedupe(vessels) {
  const map = new Map();
  for (const vessel of vessels) {
    const key = vessel.imo || vessel.mmsi || `${vessel.sourceId}:${vessel.vesselName}`;
    map.set(key, vessel);
  }
  return [...map.values()];
}

export async function runIngestionCycle() {
  const settings = await getSettings();
  const snapshotMinute = floorToMinute();
  const sourceData = await fetchAllSources();
  const upsertRows = [];

  for (const { source, vessels } of sourceData) {
    const normalized = dedupe(vessels);
    for (const vessel of normalized) {
      const transitCategory = classifyTransit(vessel);
      if (!transitCategory) continue;
      const energy = computeEnergy(vessel, settings);

      await query(
        `INSERT INTO vessel_events
          (source_id, source_name, mmsi, imo, vessel_name, vessel_type, fuel_type, fuel_type_estimated, lat, lon, observed_at, transit_category, energy_value, energy_unit)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          source.id,
          source.name,
          vessel.mmsi,
          vessel.imo,
          vessel.vesselName,
          vessel.vesselType,
          vessel.fuelType || 'Unknown / estimated',
          Boolean(vessel.fuelTypeEstimated ?? true),
          vessel.lat,
          vessel.lon,
          vessel.observedAt,
          transitCategory,
          energy.value,
          energy.unit,
        ],
      );

      upsertRows.push({
        source_id: source.id,
        source_name: source.name,
        ts_minute: snapshotMinute,
        transit_category: transitCategory,
        vessel_type: vessel.vesselType,
        fuel_type: vessel.fuelType || 'Unknown / estimated',
        fuel_type_estimated: Boolean(vessel.fuelTypeEstimated ?? true),
        vessel_count: 1,
        energy_value: energy.value,
        energy_unit: energy.unit,
      });
    }
  }

  const grouped = new Map();
  for (const row of upsertRows) {
    const key = [
      row.source_id,
      row.ts_minute.toISOString(),
      row.transit_category,
      row.vessel_type,
      row.fuel_type,
      row.fuel_type_estimated,
      row.energy_unit,
    ].join('|');

    if (!grouped.has(key)) {
      grouped.set(key, { ...row });
    } else {
      const current = grouped.get(key);
      current.vessel_count += 1;
      current.energy_value += row.energy_value;
    }
  }

  const snapshotRows = [...grouped.values()];
  for (const row of snapshotRows) {
    await query(
      `INSERT INTO snapshots
      (source_id, source_name, ts_minute, transit_category, vessel_type, fuel_type, fuel_type_estimated, vessel_count, energy_value, energy_unit)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (source_id, ts_minute, transit_category, vessel_type, fuel_type, fuel_type_estimated)
      DO UPDATE SET
        vessel_count = EXCLUDED.vessel_count,
        energy_value = EXCLUDED.energy_value,
        energy_unit = EXCLUDED.energy_unit`,
      [
        row.source_id,
        row.source_name,
        row.ts_minute,
        row.transit_category,
        row.vessel_type,
        row.fuel_type,
        row.fuel_type_estimated,
        row.vessel_count,
        row.energy_value,
        row.energy_unit,
      ],
    );
  }

  await evaluateAndSendAlerts(snapshotRows, settings);
  lastUpdated = new Date().toISOString();
}

export function getLastUpdated() {
  return lastUpdated;
}

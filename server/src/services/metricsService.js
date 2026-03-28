import { query } from '../db/client.js';
import { timeframeToInterval } from '../utils/time.js';

export async function getSourceMetrics({ sourceId, timeframe = '1D', transit = 'ENTRANCE', carrier = 'BOTH' }) {
  const since = new Date(Date.now() - timeframeToInterval(timeframe));
  const values = [sourceId, since, transit];
  let carrierFilter = '';

  if (carrier !== 'BOTH') {
    values.push(carrier);
    carrierFilter = ` AND vessel_type = $${values.length}`;
  }

  const { rows } = await query(
    `SELECT
      ts_minute,
      source_name,
      source_id,
      transit_category,
      vessel_type,
      SUM(vessel_count)::int AS vessel_count,
      SUM(energy_value)::float8 AS energy_value,
      STRING_AGG(DISTINCT fuel_type, ', ') AS fuel_types,
      BOOL_AND(fuel_type_estimated) AS fuel_type_estimated,
      MIN(energy_unit) AS energy_unit
    FROM snapshots
    WHERE source_id = $1
      AND ts_minute >= $2
      AND transit_category = $3
      ${carrierFilter}
    GROUP BY ts_minute, source_name, source_id, transit_category, vessel_type
    ORDER BY ts_minute ASC`,
    values,
  );

  const byTs = new Map();
  for (const row of rows) {
    const key = new Date(row.ts_minute).toISOString();
    if (!byTs.has(key)) {
      byTs.set(key, {
        ts: key,
        sourceName: row.source_name,
        sourceId: row.source_id,
        transitCategory: row.transit_category,
        vesselCount: 0,
        energyEstimate: 0,
        fuelTypes: new Set(),
        fuelTypeEstimated: true,
        byCarrier: {},
      });
    }

    const point = byTs.get(key);
    point.vesselCount += Number(row.vessel_count);
    point.energyEstimate += Number(row.energy_value);
    point.byCarrier[row.vessel_type] = {
      vesselCount: Number(row.vessel_count),
      energyEstimate: Number(row.energy_value),
      energyUnit: row.energy_unit,
    };
    if (row.fuel_types) {
      row.fuel_types.split(', ').forEach((f) => point.fuelTypes.add(f));
    }
    point.fuelTypeEstimated = point.fuelTypeEstimated && row.fuel_type_estimated;
  }

  return [...byTs.values()].map((point) => ({
    ...point,
    fuelTypes: [...point.fuelTypes],
  }));
}

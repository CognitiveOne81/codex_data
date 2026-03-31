import { query } from '../db/client.js';
import { bucketSecondsForTimeframe, timeframeStart } from '../utils/time.js';
import { ENABLED_SOURCES } from '../config.js';

export async function getSourceMetrics({
  sourceId,
  timeframe = '1D',
  transit = 'ENTRANCE',
  carrier = 'BOTH',
  energy = 'BOTH',
}) {
  const start = timeframeStart(timeframe);
  const bucketSeconds = bucketSecondsForTimeframe(timeframe);

  const defaultSourceId = ENABLED_SOURCES[0]?.id || 'aishub';
  const values = [sourceId || defaultSourceId, start, transit, bucketSeconds];
  let carrierFilter = '';
  if (carrier !== 'BOTH') {
    values.push(carrier);
    carrierFilter = ` AND vessel_type = $${values.length}`;
  }

  const { rows } = await query(
    `SELECT
      to_timestamp(floor(extract(epoch FROM event_time) / $4) * $4) AS bucket,
      SUM(CASE WHEN vessel_type = 'VLCC' THEN 1 ELSE 0 END)::int AS vlcc_count,
      SUM(CASE WHEN vessel_type = 'LNG' THEN 1 ELSE 0 END)::int AS lng_count,
      SUM(CASE WHEN vessel_type = 'VLCC' THEN energy_value ELSE 0 END)::float8 AS oil_energy,
      SUM(CASE WHEN vessel_type = 'LNG' THEN energy_value ELSE 0 END)::float8 AS lng_energy
    FROM transit_events
    WHERE source_id = $1
      AND event_time >= $2
      AND event_type = $3
      ${carrierFilter}
    GROUP BY 1
    ORDER BY 1 ASC`,
    values,
  );

  return rows.map((row) => {
    const vlccCount = Number(row.vlcc_count || 0);
    const lngCount = Number(row.lng_count || 0);
    const oilEnergy = Number(row.oil_energy || 0);
    const lngEnergy = Number(row.lng_energy || 0);

    const vesselCount = carrier === 'VLCC' ? vlccCount : carrier === 'LNG' ? lngCount : vlccCount + lngCount;

    let energyEstimate = oilEnergy + lngEnergy;
    if (energy === 'OIL') energyEstimate = oilEnergy;
    if (energy === 'LNG') energyEstimate = lngEnergy;

    return {
      ts: new Date(row.bucket).toISOString(),
      transitType: transit,
      carrierType: carrier,
      vesselCount,
      energyEstimate,
      oilEnergy,
      lngEnergy,
      vlccCount,
      lngCount,
    };
  });
}

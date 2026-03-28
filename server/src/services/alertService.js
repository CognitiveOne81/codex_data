import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { query } from '../db/client.js';

let transporter;

function getTransporter() {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

async function wasRecentlyAlerted(sourceId, vesselType, cooldownMinutes) {
  const { rows } = await query(
    `SELECT sent_at FROM alert_history
     WHERE source_id = $1 AND vessel_type = $2
     ORDER BY sent_at DESC LIMIT 1`,
    [sourceId, vesselType],
  );
  if (!rows[0]) return false;
  const elapsed = Date.now() - new Date(rows[0].sent_at).getTime();
  return elapsed < cooldownMinutes * 60_000;
}

export async function evaluateAndSendAlerts(snapshotRows, settings) {
  const grouped = snapshotRows.filter((row) => row.transit_category === 'ENTRANCE');
  for (const row of grouped) {
    const absoluteThreshold = row.vessel_type === 'VLCC' ? settings.alert_vlcc_absolute : settings.alert_lng_absolute;
    if (row.vessel_count < absoluteThreshold) continue;

    const baselineRes = await query(
      `SELECT COALESCE(AVG(vessel_count), 0) AS baseline
       FROM snapshots
       WHERE source_id = $1
         AND vessel_type = $2
         AND transit_category = 'ENTRANCE'
         AND ts_minute >= now() - interval '24 hours'`,
      [row.source_id, row.vessel_type],
    );

    const baseline = Number(baselineRes.rows[0]?.baseline || 0);
    const pctAbove = baseline === 0 ? 100 : ((row.vessel_count - baseline) / baseline) * 100;
    if (pctAbove < settings.alert_percent_baseline) continue;

    if (await wasRecentlyAlerted(row.source_id, row.vessel_type, settings.alert_cooldown_minutes)) continue;

    const transport = getTransporter();
    if (transport) {
      await transport.sendMail({
        from: config.smtp.from,
        to: config.smtp.to,
        subject: `[Hormuz Tracker] ${row.vessel_type} influx at ${row.source_name}`,
        text: [
          `Timestamp: ${row.ts_minute.toISOString()}`,
          `Source: ${row.source_name}`,
          `Carrier Type: ${row.vessel_type}`,
          `Entrance count: ${row.vessel_count}`,
          `Estimated energy: ${row.energy_value.toLocaleString()} ${row.energy_unit}`,
          `24h baseline: ${baseline.toFixed(2)}`,
          `Above baseline: ${pctAbove.toFixed(1)}%`,
        ].join('\n'),
      });
    }

    await query(
      `INSERT INTO alert_history (source_id, vessel_type, transit_category, observed_at, vessel_count, energy_value, baseline)
       VALUES ($1, $2, 'ENTRANCE', $3, $4, $5, $6)`,
      [row.source_id, row.vessel_type, row.ts_minute, row.vessel_count, row.energy_value, baseline],
    );
  }
}

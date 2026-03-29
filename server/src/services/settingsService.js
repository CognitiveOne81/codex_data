import { config } from '../config.js';
import { query } from '../db/client.js';

export async function ensureSettings() {
  await query(
    `INSERT INTO app_settings (
        id,
        vlcc_barrels,
        lng_m3,
        alert_vlcc_absolute,
        alert_lng_absolute,
        alert_percent_baseline,
        alert_cooldown_minutes,
        transit_cooldown_hours
      )
     VALUES (1, $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      config.assumptions.vlccBarrels,
      config.assumptions.lngM3,
      config.alerts.vlccAbsolute,
      config.alerts.lngAbsolute,
      config.alerts.percentBaseline,
      config.alerts.cooldownMinutes,
      config.transitCooldownHours,
    ],
  );

  await query(
    `UPDATE app_settings
     SET alert_vlcc_absolute = COALESCE(alert_vlcc_absolute, $1),
         alert_lng_absolute = COALESCE(alert_lng_absolute, $2),
         alert_percent_baseline = COALESCE(alert_percent_baseline, $3),
         alert_cooldown_minutes = COALESCE(alert_cooldown_minutes, $4),
         transit_cooldown_hours = COALESCE(transit_cooldown_hours, $5),
         updated_at = COALESCE(updated_at, now())
     WHERE id = 1`,
    [
      config.alerts.vlccAbsolute,
      config.alerts.lngAbsolute,
      config.alerts.percentBaseline,
      config.alerts.cooldownMinutes,
      config.transitCooldownHours,
    ],
  );
}

export async function getSettings() {
  const { rows } = await query('SELECT * FROM app_settings WHERE id = 1');
  return rows[0];
}

export async function updateSettings(payload) {
  const current = await getSettings();
  const next = { ...current, ...payload };

  const { rows } = await query(
    `UPDATE app_settings SET
      vlcc_barrels = $1,
      lng_m3 = $2,
      alert_vlcc_absolute = $3,
      alert_lng_absolute = $4,
      alert_percent_baseline = $5,
      alert_cooldown_minutes = $6,
      transit_cooldown_hours = $7,
      updated_at = now()
     WHERE id = 1
     RETURNING *`,
    [
      Number(next.vlcc_barrels),
      Number(next.lng_m3),
      Number(next.alert_vlcc_absolute),
      Number(next.alert_lng_absolute),
      Number(next.alert_percent_baseline),
      Number(next.alert_cooldown_minutes),
      Number(next.transit_cooldown_hours),
    ],
  );

  return rows[0];
}

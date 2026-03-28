import { config, DEFAULT_SETTINGS } from '../config.js';
import { query } from '../db/client.js';

export async function ensureSettings() {
  await query(
    `INSERT INTO app_settings (id, vlcc_barrels, lng_m3, alert_vlcc_absolute, alert_lng_absolute, alert_percent_baseline, alert_cooldown_minutes)
     VALUES (1, $1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [
      config.assumptions.vlccBarrels,
      config.assumptions.lngM3,
      DEFAULT_SETTINGS.alertThresholds.vlccAbsolute,
      DEFAULT_SETTINGS.alertThresholds.lngAbsolute,
      DEFAULT_SETTINGS.alertThresholds.percentAboveBaseline,
      DEFAULT_SETTINGS.alertCooldownMinutes,
    ],
  );
}

export async function getSettings() {
  const { rows } = await query('SELECT * FROM app_settings WHERE id = 1');
  return rows[0];
}

export async function updateSettings(payload) {
  const current = await getSettings();
  const next = {
    ...current,
    ...payload,
  };

  const { rows } = await query(
    `UPDATE app_settings SET
      vlcc_barrels = $1,
      lng_m3 = $2,
      alert_vlcc_absolute = $3,
      alert_lng_absolute = $4,
      alert_percent_baseline = $5,
      alert_cooldown_minutes = $6,
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
    ],
  );

  return rows[0];
}

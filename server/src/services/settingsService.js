import { config } from '../config.js';
import { query } from '../db/client.js';

export async function ensureSettings() {
  await query(
    `INSERT INTO app_settings (id, vlcc_barrels, lng_m3, transit_cooldown_hours)
     VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [config.assumptions.vlccBarrels, config.assumptions.lngM3, config.transitCooldownHours],
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
      transit_cooldown_hours = $3,
      updated_at = now()
     WHERE id = 1
     RETURNING *`,
    [Number(next.vlcc_barrels), Number(next.lng_m3), Number(next.transit_cooldown_hours)],
  );

  return rows[0];
}

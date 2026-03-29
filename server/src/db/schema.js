import { query } from './client.js';

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS ais_positions (
      id BIGSERIAL PRIMARY KEY,
      source_id TEXT NOT NULL,
      vessel_key TEXT NOT NULL,
      mmsi TEXT,
      imo TEXT,
      vessel_name TEXT,
      vessel_type TEXT NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lon DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_id, vessel_key, observed_at)
    );

    CREATE INDEX IF NOT EXISTS idx_ais_positions_time ON ais_positions (observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ais_positions_vessel_time ON ais_positions (vessel_key, observed_at DESC);

    CREATE TABLE IF NOT EXISTS vessel_transit_state (
      vessel_key TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      vessel_type TEXT NOT NULL,
      state TEXT NOT NULL,
      transit_seq INTEGER NOT NULL DEFAULT 0,
      last_seen_at TIMESTAMPTZ NOT NULL,
      last_outside_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS transit_events (
      id BIGSERIAL PRIMARY KEY,
      source_id TEXT NOT NULL,
      vessel_key TEXT NOT NULL,
      mmsi TEXT,
      imo TEXT,
      vessel_name TEXT,
      vessel_type TEXT NOT NULL,
      transit_seq INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_time TIMESTAMPTZ NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lon DOUBLE PRECISION NOT NULL,
      energy_value DOUBLE PRECISION NOT NULL,
      energy_unit TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_id, vessel_key, transit_seq, event_type)
    );

    CREATE INDEX IF NOT EXISTS idx_transit_events_query
      ON transit_events (source_id, event_time, event_type, vessel_type);

    CREATE TABLE IF NOT EXISTS app_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      vlcc_barrels DOUBLE PRECISION NOT NULL,
      lng_m3 DOUBLE PRECISION NOT NULL,
      alert_vlcc_absolute DOUBLE PRECISION NOT NULL DEFAULT 3,
      alert_lng_absolute DOUBLE PRECISION NOT NULL DEFAULT 3,
      alert_percent_baseline DOUBLE PRECISION NOT NULL DEFAULT 50,
      alert_cooldown_minutes DOUBLE PRECISION NOT NULL DEFAULT 60,
      transit_cooldown_hours DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS alert_vlcc_absolute DOUBLE PRECISION;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS alert_lng_absolute DOUBLE PRECISION;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS alert_percent_baseline DOUBLE PRECISION;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS alert_cooldown_minutes DOUBLE PRECISION;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS transit_cooldown_hours DOUBLE PRECISION;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    UPDATE app_settings
    SET alert_vlcc_absolute = COALESCE(alert_vlcc_absolute, 3),
        alert_lng_absolute = COALESCE(alert_lng_absolute, 3),
        alert_percent_baseline = COALESCE(alert_percent_baseline, 50),
        alert_cooldown_minutes = COALESCE(alert_cooldown_minutes, 60),
        transit_cooldown_hours = COALESCE(transit_cooldown_hours, 18),
        updated_at = COALESCE(updated_at, now());

    ALTER TABLE app_settings ALTER COLUMN alert_vlcc_absolute SET DEFAULT 3;
    ALTER TABLE app_settings ALTER COLUMN alert_lng_absolute SET DEFAULT 3;
    ALTER TABLE app_settings ALTER COLUMN alert_percent_baseline SET DEFAULT 50;
    ALTER TABLE app_settings ALTER COLUMN alert_cooldown_minutes SET DEFAULT 60;
    ALTER TABLE app_settings ALTER COLUMN alert_vlcc_absolute SET NOT NULL;
    ALTER TABLE app_settings ALTER COLUMN alert_lng_absolute SET NOT NULL;
    ALTER TABLE app_settings ALTER COLUMN alert_percent_baseline SET NOT NULL;
    ALTER TABLE app_settings ALTER COLUMN alert_cooldown_minutes SET NOT NULL;
  `);
}

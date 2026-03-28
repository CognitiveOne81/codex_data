import { query } from './client.js';

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS vessel_events (
      id BIGSERIAL PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      mmsi TEXT,
      imo TEXT,
      vessel_name TEXT,
      vessel_type TEXT NOT NULL,
      fuel_type TEXT NOT NULL,
      fuel_type_estimated BOOLEAN NOT NULL DEFAULT TRUE,
      lat DOUBLE PRECISION NOT NULL,
      lon DOUBLE PRECISION NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      transit_category TEXT NOT NULL,
      energy_value DOUBLE PRECISION NOT NULL,
      energy_unit TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_vessel_events_main
      ON vessel_events (source_id, observed_at, transit_category, vessel_type);

    CREATE TABLE IF NOT EXISTS snapshots (
      id BIGSERIAL PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      ts_minute TIMESTAMPTZ NOT NULL,
      transit_category TEXT NOT NULL,
      vessel_type TEXT NOT NULL,
      fuel_type TEXT NOT NULL,
      fuel_type_estimated BOOLEAN NOT NULL,
      vessel_count INTEGER NOT NULL,
      energy_value DOUBLE PRECISION NOT NULL,
      energy_unit TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_id, ts_minute, transit_category, vessel_type, fuel_type, fuel_type_estimated)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      vlcc_barrels DOUBLE PRECISION NOT NULL,
      lng_m3 DOUBLE PRECISION NOT NULL,
      alert_vlcc_absolute INTEGER NOT NULL,
      alert_lng_absolute INTEGER NOT NULL,
      alert_percent_baseline DOUBLE PRECISION NOT NULL,
      alert_cooldown_minutes INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS alert_history (
      id BIGSERIAL PRIMARY KEY,
      source_id TEXT NOT NULL,
      vessel_type TEXT NOT NULL,
      transit_category TEXT NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      vessel_count INTEGER NOT NULL,
      energy_value DOUBLE PRECISION NOT NULL,
      baseline DOUBLE PRECISION NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

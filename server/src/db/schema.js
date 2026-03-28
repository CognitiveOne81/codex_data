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
      transit_cooldown_hours DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS transit_cooldown_hours DOUBLE PRECISION;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  `);
}

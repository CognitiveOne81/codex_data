import dotenv from 'dotenv';

dotenv.config();

export const HISTORICAL_START = new Date('2020-01-01T00:00:00.000Z');

export const config = {
  port: Number(process.env.PORT || 8080),
  databaseUrl: process.env.DATABASE_URL,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 60_000),
  transitCooldownHours: Number(process.env.TRANSIT_COOLDOWN_HOURS || 18),
  alerts: {
    vlccAbsolute: Number(process.env.ALERT_VLCC_ABSOLUTE || 3),
    lngAbsolute: Number(process.env.ALERT_LNG_ABSOLUTE || 3),
    percentBaseline: Number(process.env.ALERT_PERCENT_BASELINE || 50),
    cooldownMinutes: Number(process.env.ALERT_COOLDOWN_MINUTES || 60),
  },
  assumptions: {
    vlccBarrels: Number(process.env.VLCC_DEFAULT_BARRELS || 2_000_000),
    lngM3: Number(process.env.LNG_DEFAULT_M3 || 170_000),
  },
  aisHub: {
    baseUrl: process.env.AISHUB_BASE_URL || 'https://data.aishub.net/ws.php',
    username: process.env.AISHUB_USERNAME,
    key: process.env.AISHUB_API_KEY,
    timeoutMs: Number(process.env.AISHUB_TIMEOUT_MS || 20_000),
    maxAgeMinutes: Number(process.env.AISHUB_INTERVAL_MINUTES || 180),
    bounds: {
      latMin: Number(process.env.AISHUB_LAT_MIN || 25.8),
      latMax: Number(process.env.AISHUB_LAT_MAX || 27.1),
      lonMin: Number(process.env.AISHUB_LON_MIN || 55.6),
      lonMax: Number(process.env.AISHUB_LON_MAX || 57.5),
    },
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@hormuz-tracker.local',
    to: process.env.SMTP_TO,
  },
};

export const SOURCES = [{ id: 'aishub', name: 'AISHub', website: 'https://www.aishub.net/' }];

export const ZONES = {
  entrance: {
    latMin: 26.15,
    latMax: 26.8,
    lonMin: 55.95,
    lonMax: 56.1,
  },
  exit: {
    latMin: 26.1,
    latMax: 26.85,
    lonMin: 57.15,
    lonMax: 57.3,
  },
};

export const DEFAULT_SETTINGS = {
  rollingAverageWindows: ['1H', '24H', '7D'],
};

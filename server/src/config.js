import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8080),
  databaseUrl: process.env.DATABASE_URL,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 60_000),
  geofenceKm: Number(process.env.GEOFENCE_RADIUS_KM || 25),
  assumptions: {
    vlccBarrels: Number(process.env.VLCC_DEFAULT_BARRELS || 2_000_000),
    lngM3: Number(process.env.LNG_DEFAULT_M3 || 170_000),
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.ALERT_FROM,
    to: process.env.ALERT_TO,
  },
};

export const SOURCES = [
  { id: 'aishub', name: 'AISHub', website: 'https://www.aishub.net/' },
];

export const GEOFENCES = {
  entrance: { lat: 25.2732, lon: 55.1647 },
  exit: { lat: 27.3713, lon: 57.3419 },
};

export const DEFAULT_SETTINGS = {
  rollingAverageWindows: ['1H', '24H', '7D'],
  alertThresholds: {
    vlccAbsolute: Number(process.env.ALERT_VLCC_ABS || 4),
    lngAbsolute: Number(process.env.ALERT_LNG_ABS || 3),
    percentAboveBaseline: Number(process.env.ALERT_PCT_BASELINE || 70),
  },
  alertCooldownMinutes: Number(process.env.ALERT_COOLDOWN_MINUTES || 60),
};

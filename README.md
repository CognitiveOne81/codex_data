# Strait of Hormuz Carrier Tracker

Full-stack Railway-ready web app that tracks **VLCC** and **LNG** carriers using AIS data and detects:
- **Entrance events** in the west-zone geofence.
- **Full transit events** when a vessel later reaches the east-zone geofence.

## Architecture

- **Frontend**: React + Vite + Recharts (dark mode, Robinhood-style)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Railway Postgres)
- **Source**: AISHub API (`https://www.aishub.net/api`) live feed.

## Zone Logic (Rectangles)

- Entrance Zone (west)
  - Lat: `26.15 → 26.80`
  - Lon: `55.95 → 56.10`
- Exit Zone (east)
  - Lat: `26.10 → 26.85`
  - Lon: `57.15 → 57.30`

## Transit Detection Rules

Vessel state per IMO/MMSI (`vessel_key`):
- `OUTSIDE`
- `ENTERED`
- `COMPLETED`

Rules:
1. **Entrance event** = first ping in entrance zone for a transit.
2. **Full transit event** = vessel already `ENTERED`, then ping in exit zone.
3. **Reset for next transit** = vessel outside both zones for configurable cooldown (`transit_cooldown_hours`, default 18h).

## Data Model

- `ais_positions`: normalized AIS pings
- `vessel_transit_state`: state machine snapshot per vessel key
- `transit_events`: deduped entrance/full events (`UNIQUE(source_id, vessel_key, transit_seq, event_type)`)
- `app_settings`: configurable energy assumptions + cooldown

Indexes support long-range queries and ALL-timeframe performance.

## Timeframes and Aggregation

Supported:
- `1D`, `1W`, `1M`, `1Y`, `ALL`

Bucket strategy (~100–300 points target):
- `1D` → 5-minute
- `1W` → hourly
- `1M` → 6-hour
- `1Y` → daily
- `ALL` → weekly

## Charts

Exactly 2 synchronized line charts:
1. **Carrier Count**
2. **Energy Estimate**

Toggles:
- Transit: Entrance / Full Transit
- Carrier: VLCC / LNG / Both
- Energy: Oil (VLCC) / LNG / Both
- Rolling average overlay: 1h / 24h / 7d

Tooltips include timestamp, count, carrier, transit type, and estimated energy.

## Live Coverage

- The backend ingests **live AIS feed only** (no seeded synthetic or historical backfill data).
- `ALL` timeframe queries all stored events currently in your database.

## Environment Variables

Backend (`server/.env`):

```bash
PORT=8080
DATABASE_URL=postgresql://...
POLL_INTERVAL_MS=60000
TRANSIT_COOLDOWN_HOURS=18
VLCC_DEFAULT_BARRELS=2000000
LNG_DEFAULT_M3=170000

# AISHub
AISHUB_BASE_URL=https://data.aishub.net/ws.php
AISHUB_USERNAME=...
AISHUB_API_KEY=...
AISHUB_TIMEOUT_MS=20000
AISHUB_INTERVAL_MINUTES=180
AISHUB_LAT_MIN=25.8
AISHUB_LAT_MAX=27.1
AISHUB_LON_MIN=55.6
AISHUB_LON_MAX=57.5
```

Frontend (`client/.env`):

```bash
VITE_API_URL=http://localhost:8080
```

## Local Run

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8080`

## Railway Deployment

### 1) Create DB
- Add PostgreSQL plugin in Railway.
- Confirm `DATABASE_URL` is injected into the API service.

### 2) Deploy API service
- Service root: repository root.
- Start command: `npm run start -w server`
- Set backend env vars above.

### 3) Deploy web service
- Service root: repository root.
- Build command: `npm run build -w client`
- Start command: `npx serve client/dist -l $PORT`
- Set `VITE_API_URL` to API public URL.

### 4) Verify
- `/health` returns `{"ok":true}`
- `/api/metrics?timeframe=ALL&transit=FULL_TRANSIT&carrier=BOTH&energy=BOTH`

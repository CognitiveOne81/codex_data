# Strait of Hormuz Carrier Tracker

A full-stack, dark-mode analytics dashboard for tracking VLCC and LNG carrier movement through the Strait of Hormuz using free AIS source attribution (MarineTraffic, VesselFinder, FleetMon) with one-source-at-a-time chart paging.

## Tech Stack

- **Frontend**: React + Vite + Recharts (Robinhood-inspired dark dashboard)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Railway preferred)
- **Alerts**: Nodemailer SMTP email alerts with cooldown protection

## Features Implemented

- Title and branding: **Strait of Hormuz Carrier Tracker**
- Two primary synchronized line charts only (per active source):
  1. Carrier Count Chart
  2. Energy Estimate Chart
- One source website visible at a time with left/right arrow paging
- Filters/toggles:
  - Transit mode: Entrance / Exit / Full Transit
  - Carrier mode: VLCC / LNG / Both
  - Time ranges: 1H, 1D, 1W, 1M, 3M, 1Y, ALL
  - Rolling average overlay (1H, 24H, 7D)
- Geofence logic around:
  - Entrance: 25.2732, 55.1647
  - Exit: 27.3713, 57.3419
- Refresh and ingestion every 1 minute
- Source attribution, fuel-type labeling, and estimated/uncertain fuel handling
- Configurable energy assumptions:
  - VLCC: 2,000,000 barrels (default)
  - LNG carrier: 170,000 m3 (default)
- Significant influx alerting by threshold + percent above baseline + cooldown

## Important Data Source Note

This implementation keeps a modular **adapter layer** (`server/src/adapters/freeAisAdapters.js`) that currently provides synthetic AIS-shaped data for development safety/reliability. It is intentionally designed so you can plug in free public endpoints/pages from MarineTraffic, VesselFinder, FleetMon, or other free AIS aggregators without changing the dashboard contract.

Because free AIS pages can rate-limit and change HTML frequently, production adapters should be implemented per source terms of use.

## System Design

### Backend flow (every minute)
1. Pull per-source vessel lists via adapter layer.
2. Normalize vessels into common schema (`mmsi/imo`, vessel type, fuel type, location, timestamp).
3. Deduplicate by IMO/MMSI.
4. Classify into transit categories with configurable geofence radius.
5. Estimate energy by vessel class assumptions.
6. Persist raw vessel events + aggregated minute snapshots.
7. Evaluate influx alerts and send email if thresholds are exceeded and cooldown allows.

### Transit classification
- **ENTRANCE**: Vessel in entrance geofence.
- **EXIT**: Vessel in exit geofence without prior entrance observation.
- **FULL_TRANSIT**: Vessel seen in entrance geofence and later in exit geofence.

## Environment Variables

Create `server/.env` (or Railway service variables):

```bash
PORT=8080
DATABASE_URL=postgresql://...
PGPASSWORD=...
PGPORT=5432

POLL_INTERVAL_MS=60000
GEOFENCE_RADIUS_KM=25
VLCC_DEFAULT_BARRELS=2000000
LNG_DEFAULT_M3=170000

ALERT_VLCC_ABS=4
ALERT_LNG_ABS=3
ALERT_PCT_BASELINE=70
ALERT_COOLDOWN_MINUTES=60

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
ALERT_FROM=alerts@example.com
ALERT_TO=you@example.com
```

Frontend env (`client/.env`):

```bash
VITE_API_URL=http://localhost:8080
```

## Local Setup

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

## API Endpoints

- `GET /api/sources`
- `GET /api/status`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/metrics?source=marinetraffic&timeframe=1D&transit=ENTRANCE&carrier=BOTH`

## Railway Deployment

### Option A: Two Railway services (recommended)
1. Create PostgreSQL plugin on Railway.
2. Create **API service** from this repo root:
   - Start command: `npm run start -w server`
3. Create **web service** from this repo root:
   - Build command: `npm run build -w client`
   - Start command: `npx serve client/dist -l $PORT`
4. Set `VITE_API_URL` in web service to API service public URL.
5. Set backend env vars (including `DATABASE_URL`, SMTP vars, thresholds).

### Option B: Single service
Use a reverse proxy/static serving approach in Express and host built frontend from backend.

## Assumptions, Formulas, and Limitations

- **Energy formulas**:
  - VLCC energy estimate = `vessel_count * vlcc_barrels`
  - LNG estimate = `vessel_count * lng_m3`
- Fuel type may be estimated from vessel class when source data is incomplete.
- Source-level duplicate handling is by IMO/MMSI dedupe.
- Cross-source comparisons should be interpreted with caution because free AIS sources may have different coverage latency.
- The UI shows source-specific limitations by explicitly showing one source at a time.

## Extending the Adapter Layer

Update `server/src/adapters/freeAisAdapters.js` to:
- Pull from free AIS endpoint/page snapshots per source.
- Map external payload fields to normalized schema:
  - `sourceId`, `sourceName`, `mmsi`, `imo`, `vesselName`, `vesselType`, `fuelType`, `fuelTypeEstimated`, `lat`, `lon`, `observedAt`.
- Keep source attribution in each record.

## Alert Logic Summary

Alert triggers on **ENTRANCE** spikes when all conditions are met:
1. Absolute threshold passed (separate VLCC/LNG threshold).
2. Count is above 24h rolling baseline by configured percent.
3. Cooldown since last similar alert has elapsed.

Alert email includes timestamp, source, carrier type, vessel count, estimated energy, baseline, and delta percentage.

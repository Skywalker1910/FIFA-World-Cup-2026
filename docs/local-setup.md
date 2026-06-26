# Local Setup

This guide explains how to run the FIFA World Cup 2026 prediction app locally.

## Prerequisites

- Node.js `24` or newer.
- SQLite CLI available on your machine if you want to inspect the database manually.
- Optional: a football-data.org API token for score sync testing.

## Install

This project has no frontend build step. Install dependencies if `node_modules` is not already present:

```powershell
npm install
```

## Environment File

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` as needed:

```text
PORT=3000
SQLITE_DB_PATH=./data/tracker.db
FOOTBALL_DATA_API_KEY=your-football-data-token
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
FOOTBALL_DATA_AUTO_SYNC=false
FOOTBALL_DATA_SYNC_MINUTES=15
```

The `.env` file is ignored by git. Do not commit real API keys or player credentials.

## Start the App

```powershell
npm start
```

Open:

```text
http://localhost:3000
```

Command Center:

```text
http://localhost:3000/admin
```

If port `3000` is occupied:

```powershell
$env:PORT=3001
npm start
```

Then open:

```text
http://localhost:3001
```

## Default Accounts

Fresh local databases are seeded automatically.

Full admin:

```text
Login ID: admin
Password: admin123
```

US regional admin:

```text
Login ID: usadmin
Password: usadmin123
```

Initial player accounts are also seeded from `server.js`. Use Command Center `Account Records` to add, update, or delete players and full-admin-managed AI agents.

## Local Database

Default local database path:

```text
./data/tracker.db
```

Override it with:

```text
SQLITE_DB_PATH=./data/custom.db
```

Inspect local data:

```powershell
sqlite3 .\data\tracker.db "select count(*) from users; select count(*) from matches; select count(*) from bets;"
```

## Validation

Run syntax checks:

```powershell
npm run check
```

This checks:

- `server.js`
- `app.js`
- `admin.js`
- helper scripts under `scripts/`

## Score Sync Testing

Set:

```text
FOOTBALL_DATA_API_KEY=your-football-data-token
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
```

Restart the server after editing `.env`.

Check status:

```text
http://localhost:3000/api/sync-status
```

If local TLS certificate verification fails, use this only for local testing:

```text
FOOTBALL_DATA_ALLOW_INSECURE_TLS=true
```

Do not use insecure TLS settings in production.

## Common Local Issues

### Browser shows old behavior

An older Node process may still be running. Stop it or run this app on a different port.

### `/api/sync-status` returns `404`

The browser is not hitting this app instance. Confirm the port and restart the correct process.

### Scores are not updating

Check `/api/sync-status`. If `hasKey` is false, the `.env` value is not loaded. If `sourceMatches` is `0`, your API plan may not have access to the configured competition/season.

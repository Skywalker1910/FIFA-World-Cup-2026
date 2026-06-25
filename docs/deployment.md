# Deployment

This app is currently designed for a simple Railway deployment with persistent SQLite storage.

## Railway Deployment

1. Push the repository to GitHub.
2. Create a Railway project from the GitHub repository.
3. Add a Railway volume.
4. Mount the volume at:

```text
/data
```

5. Set:

```text
SQLITE_DB_PATH=/data/tracker.db
```

6. Deploy the service.

## Required Production Variables

```text
PORT=3000
SQLITE_DB_PATH=/data/tracker.db
```

Railway injects `PORT`, but this project can also run with an explicit `PORT=3000` if your Railway networking is configured for that port.

## Optional Score Sync Variables

```text
FOOTBALL_DATA_API_KEY=your-football-data-token
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
FOOTBALL_DATA_AUTO_SYNC=false
FOOTBALL_DATA_SYNC_MINUTES=15
FOOTBALL_DATA_SYNC_MODE=competition
FOOTBALL_DATA_DATE_WINDOW_DAYS=3
```

Keep `FOOTBALL_DATA_AUTO_SYNC=false` until manual sync works from the Command Center or `/api/sync-status`.

## Persistent SQLite

Without a Railway volume, every deploy starts from a fresh container filesystem and data can reset.

With this setup:

```text
SQLITE_DB_PATH=/data/tracker.db
```

the SQLite file is stored on the mounted volume and survives redeployments.

## First Deploy Seed Data

On a fresh database, the app seeds:

- Full admin: `admin` / `admin123`
- US regional admin: `usadmin` / `usadmin123`
- Initial player accounts
- Match fixtures from `data/fixtures.js`
- Default settings

Change default admin passwords after first deploy.

## Production Checks

Health:

```text
/health
```

Sync diagnostics:

```text
/api/sync-status
```

Database from Railway console:

```sh
echo $SQLITE_DB_PATH
sqlite3 "$SQLITE_DB_PATH" "select count(*) from users; select count(*) from matches; select count(*) from bets;"
```

## Backups

Use Railway volume backups where available. You can also copy the SQLite file manually from the Railway shell:

```sh
cp /data/tracker.db /data/tracker-backup-$(date +%Y%m%d-%H%M%S).db
```

Download backups before any risky migration or schema change.

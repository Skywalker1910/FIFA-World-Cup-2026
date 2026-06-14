# World Cup 2026 Bet Tracker

SQLite-backed local web app for World Cup betting, admin-created player logins, bet placement, public profiles, leaderboard tracking, and optional sports API result sync.

## Run

For local API testing, copy the example env file first:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and set:

```text
FOOTBALL_DATA_API_KEY=your-real-football-data-token
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
FOOTBALL_DATA_SYNC_MODE=auto
FOOTBALL_DATA_DATE_WINDOW_DAYS=3
```

The `.env` file is ignored by git, so local API keys are not committed.

```powershell
node server.js
```

Open:

```text
http://localhost:3000
```

Admin console:

```text
http://localhost:3000/admin
```

If port `3000` is already running an older server, stop it first or run on another port:

```powershell
$env:PORT=3001
node server.js
```

## Default Admin

```text
Login ID: admin
Password: admin123
```

Use `/admin` to create player accounts. The admin manually shares each player's login ID and temporary password.

## Railway Deploy

This project includes a `Dockerfile` for Railway. The container installs `sqlite3` and starts `node server.js`.

1. Push this project to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add a Railway volume and mount it at:

```text
/data
```

4. Add this environment variable:

```text
SQLITE_DB_PATH=/data/tracker.db
```

5. Optional football-data.org variables:

```text
FOOTBALL_DATA_API_KEY=your-football-data-token
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
FOOTBALL_DATA_SYNC_MINUTES=15
```

6. Deploy. Railway will provide a public URL. Add `www.uvxupworldcupbets.com` as a custom domain in Railway, then point your DNS CNAME to Railway's target.

On a fresh Railway volume, the app automatically seeds:

- Admin account: `admin` / `admin123`
- Player accounts: `AdityaMore`, `MithileshBiradar`, `ShardulVartak`
- Historical bets from the seeded fixture file

## Data Storage

- Primary source of truth: `data/tracker.db`
- Hosted source of truth when `SQLITE_DB_PATH` is set, for example `/data/tracker.db` on Railway

The app writes bets, results, settings, users, and sessions to SQLite.

## Betting Rules

- Only `player` accounts can place bets.
- Admin accounts manage users, settings, and results.
- Bets lock server-side 60 minutes before kickoff.
- Kickoff values imported into SQLite are treated as Eastern Time.
- Locked or settled matches cannot be changed by players.

## football-data.org Sync

The app is wired for football-data.org by default. Create a football-data.org account, copy your API token, and put it in `.env`:

```text
FOOTBALL_DATA_API_KEY=your-football-data-token
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
```

The `/admin` page has a `Sync football-data.org Results` button. The default competition code is `WC` and the default season is `2026`.

The sync updates live/current scores, stores API match status, and only sets the final betting result when football-data.org reports `FINISHED`.

When `FOOTBALL_DATA_AUTO_SYNC=true` is set, the server automatically syncs scores every `FOOTBALL_DATA_SYNC_MINUTES` minutes. Leave auto-sync off until `/api/sync-status` or the Command Center manual sync confirms your football-data.org plan can access the configured competition.

Check sync status at:

```text
/api/sync-status
```

If scores are not loading locally:

1. Confirm `.env` has a real value after the equals sign:

```text
FOOTBALL_DATA_API_KEY=your-real-football-data-token
```

2. Restart `node server.js` after editing `.env`. The server reads `.env` only at startup.
3. Make sure the browser is hitting this app. If `http://localhost:3000/api/sync-status` returns `404`, an older process is using port `3000`; stop it or set `PORT=3001` in `.env`.
4. If `/api/sync-status` says `sourceMatches: 0`, check `apiErrors` and confirm your football-data.org plan has access to the `WC` competition and `2026` season.
5. If Node reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE` locally, set `FOOTBALL_DATA_ALLOW_INSECURE_TLS=true` in `.env` for local testing only. Do not use that setting in Railway/production.

Optional overrides:

```text
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4
SPORTS_API_URL=custom-fixtures-url
FOOTBALL_DATA_AUTO_SYNC=false
FOOTBALL_DATA_SYNC_MODE=date-window
FOOTBALL_DATA_DATE_WINDOW_DAYS=3
```

## Team Flags

Team flags load in the browser from `flagcdn.com`. Knockout placeholders such as `Winner Group A` use generated text badges until real teams are known.

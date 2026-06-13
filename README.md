# World Cup 2026 Bet Tracker

SQLite-backed local web app for World Cup betting, admin-created player logins, bet placement, public profiles, leaderboard tracking, and optional sports API result sync.

## Run

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

5. Optional API-Football variables:

```text
API_FOOTBALL_KEY=your-api-football-key
API_FOOTBALL_LEAGUE=1
API_FOOTBALL_SEASON=2026
API_FOOTBALL_SYNC_MINUTES=15
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

## API-Football Sync

The app is wired for API-Football by default. Create a free API-Football account, copy your API key, then run:

```powershell
$env:API_FOOTBALL_KEY="your-api-football-key"
$env:API_FOOTBALL_LEAGUE="1"
$env:API_FOOTBALL_SEASON="2026"
node server.js
```

The `/admin` page has a `Sync API-Football Results` button. The default league ID is `1`, which API-Football commonly uses for the FIFA World Cup, but verify the league ID in your API-Football dashboard before tournament use.

The sync updates live/current scores, stores API match status, and only sets the final betting result when API-Football reports a final status such as `FT`, `AET`, or `PEN`.

When `API_FOOTBALL_KEY` is set, the server automatically syncs scores every `API_FOOTBALL_SYNC_MINUTES` minutes. The public dashboard refreshes once per minute.

Check sync status at:

```text
/api/sync-status
```

Optional overrides:

```powershell
$env:API_FOOTBALL_BASE_URL="https://v3.football.api-sports.io"
$env:SPORTS_API_URL="custom-fixtures-url"
$env:API_FOOTBALL_AUTO_SYNC="false"
```

## Team Flags

Team flags load in the browser from `flagcdn.com`. Knockout placeholders such as `Winner Group A` use generated text badges until real teams are known.

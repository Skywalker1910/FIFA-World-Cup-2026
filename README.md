# FIFA World Cup 2026

SQLite-backed FIFA World Cup 2026 prediction platform with admin-created player logins, match predictions, score forecasts, public player profiles, leaderboards, regional scoring systems, and optional football-data.org result sync.

## Product Overview

The app supports two regional experiences from one deployment:

- `US`: match prediction entries with dollar-based settlement and ledger tools.
- `India`: match prediction entries with an achievement-style points system using Matchballs, Boots, Glory, Caps, Prestige, Legends, and Orbs.

Players sign in with credentials created by an administrator, submit match predictions before each match locks, maintain a public profile, and view rankings. Administrators manage users, match results, prediction records, settings, and regional access from the Command Center.

## Application Design

The product uses a simple server-rendered/static frontend architecture:

- `index.html`: public application shell for dashboard, predictions, players, groups, road to final, profile, and rules.
- `app.js`: public app state management, rendering, profile updates, prediction submission, leaderboard rendering, and regional UI behavior.
- `admin.html`: Command Center shell for administrator workflows.
- `admin.js`: Command Center rendering and interactions for match results, player records, prediction records, ledger, and settings.
- `server.js`: HTTP server, API routes, session handling, SQLite access, scoring calculations, football-data.org sync, and static file serving.
- `styles.css`: shared visual system, responsive layout, player cards, tables, badges, and micro-interactions.
- `data/fixtures.js`: seeded World Cup 2026 fixture data.
- `assets/`: app branding assets.

The interface uses a minimal Apple-inspired visual language: light surfaces, rounded cards, subtle borders, compact navigation, clear tables, player profile cards, and badge-based scoring indicators.

## System Architecture

```text
Browser
  ├─ Public app: /, /index.html, /app.js
  ├─ Command Center: /admin, /admin.html, /admin.js
  └─ Static assets: /styles.css, /assets/*

Node HTTP Server
  ├─ Auth/session APIs
  ├─ Public state APIs
  ├─ Player profile and prediction APIs
  ├─ Command Center APIs
  ├─ football-data.org sync
  └─ SQLite query layer

SQLite Database
  ├─ users
  ├─ sessions
  ├─ settings
  ├─ matches
  ├─ prediction records
  └─ audit logs
```

The same SQLite database stores both regional experiences. Region-specific records are scoped by server/region fields, while player access is controlled by `server_access`. This keeps deployment and backups simple while preserving separation between `US` and `India` workflows.

## Data Model

- `users`: player/admin accounts, display names, roles, server access, profile images, supported team/player, and tournament predictions.
- `sessions`: browser login sessions.
- `settings`: app configuration such as lock timing.
- `matches`: fixture metadata, kickoff time, venue, scores, result, status, and source sync data.
- Prediction records: per-player, per-match, per-region prediction selections and optional score forecasts.
- `audit_logs`: administrative and player activity history.

## Regional Scoring

### US

- Players submit match predictions before lock.
- The Command Center ledger calculates dollar-based net balances after results are settled.
- Score forecasts are collected for engagement, but they do not affect US settlement rules right now.

### India

- `Matchballs`: 1 for each correct winner or draw prediction.
- `Boots`: 1 for each correctly predicted team goal count.
- `Perfect score`: correct goals for both teams adds 3 additional Boots.
- `Glory`: 1 when the player predicts both the correct winner/draw and the exact score.
- `Caps`: 1 for every submitted match prediction, regardless of result.
- `Prestige`: 1 for a 3-match consecutive correct winner/draw streak.
- `Legends`: 1 for a 5-match consecutive correct winner/draw streak.
- `Orbs`: 1 for a 7-match consecutive correct winner/draw streak.

India rankings are ordered by Matchballs, then Boots, Glory, Orbs, Legends, Prestige, Caps, and display name.

## User Roles

### Full Admin

- Accesses both `US` and `India`.
- Creates players and admins.
- Assigns regional access.
- Manages match scores/results, prediction records, settings, player records, and sync.

### Regional Admin

- Accesses assigned region only.
- Creates player accounts only for assigned region.
- Updates assigned-region player records, prediction records, and ledger views.
- Cannot create admin accounts or assign another region.

### Player

- Signs in with admin-created credentials.
- Submits match predictions before lock.
- Updates profile details and profile picture.
- Selects supported team/player.
- Submits tournament predictions before the tournament prediction lock.

## Prediction Locks

- Match predictions lock server-side before kickoff.
- Default lock timing is 60 minutes before kickoff.
- Kickoff values imported into SQLite are treated as Eastern Time.
- Locked or settled matches cannot be changed by players.
- Tournament knockout predictions lock according to `PREDICTION_LOCK_AT`.

## Run Locally

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

Command Center:

```text
http://localhost:3000/admin
```

If port `3000` is already running an older server, stop it first or run on another port:

```powershell
$env:PORT=3001
node server.js
```

## Default Accounts

```text
Full admin:
Login ID: admin
Password: admin123

US regional admin:
Login ID: usadmin
Password: usadmin123
```

Use `/admin` to create player accounts. The administrator shares each player's login ID and temporary password directly with the player.

## Railway Deployment

This project includes a `Dockerfile` for Railway. The container installs `sqlite3`, copies static assets, and starts `node server.js`.

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

6. Deploy. Railway will provide a public URL. Add a custom domain in Railway if needed, then point DNS to Railway's target.

On a fresh Railway volume, the app automatically seeds:

- Full admin account: `admin` / `admin123`
- US regional admin account: `usadmin` / `usadmin123`
- Initial player accounts
- Seeded fixture history from `data/fixtures.js`

## Persistent Storage

- Local source of truth: `data/tracker.db`
- Hosted source of truth when `SQLITE_DB_PATH` is set, for example `/data/tracker.db` on Railway

Railway deployments should use a mounted volume so SQLite persists across redeployments. Without a volume, each new deployment starts with a fresh container filesystem.

## football-data.org Sync

The app is wired for football-data.org by default. Create a football-data.org account, copy your API token, and put it in `.env`:

```text
FOOTBALL_DATA_API_KEY=your-football-data-token
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
```

The Command Center has a `Sync football-data.org Results` button. The default competition code is `WC` and the default season is `2026`.

The sync updates live/current scores, stores API match status, and only sets the final result when football-data.org reports `FINISHED`.

When `FOOTBALL_DATA_AUTO_SYNC=true` is set, the server automatically syncs scores every `FOOTBALL_DATA_SYNC_MINUTES` minutes. Leave auto-sync off until `/api/sync-status` or the Command Center manual sync confirms your football-data.org plan can access the configured competition.

Railway variables are read at runtime by `server.js`, not during Docker build. After changing `FOOTBALL_DATA_API_KEY`, redeploy or restart the Railway service and confirm `/api/sync-status` shows `"hasKey": true` under `config`.

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

Team flags load in the browser from `flagcdn.com`. Knockout placeholders use generated text badges until real teams are known.

# FIFA World Cup 2026

SQLite-backed FIFA World Cup 2026 prediction platform with player accounts, dedicated AI agent accounts, regional prediction systems, public profiles, leaderboards, score sync, and a private Command Center for operations.

## Product Overview

The app is designed for a small private World Cup prediction group. Players sign in with credentials created by an administrator, submit match predictions before each match locks, maintain public profile cards, and track rankings as the tournament progresses.

The product supports two regional game servers from one deployment:

- `US`: match predictions with dollar-based settlement and ledger tools.
- `India`: match predictions with an achievement-style points system using Matchballs, Boots, Glory, Caps, Prestige, Legends, and Orbs.

Administrators use the Command Center to manage users, match scores, prediction records, ledger views, settings, and optional score synchronization.

## Core Features

- Public dashboard with live/current matches and upcoming fixtures.
- Match prediction table with team-name picks, draw option, and score forecasts.
- Regional server switching for players with access to both `US` and `India`.
- Public picks view showing player predictions by match.
- Dedicated AI Prediction Arena with OpenAI, Claude, and Gemini provider cards, a match-by-agent prediction matrix, result-aware tags, score forecasts, reasoning, confidence, technical metadata, and accuracy.
- Player profile cards with profile images, supported team/player, awards, ranking, and tournament predictions.
- Tournament fixtures, group tables, and road-to-final views.
- Command Center for match results, player records, prediction records, settings, and ledger management.
- Optional football-data.org score synchronization.
- SQLite persistence with Railway volume support.

## Application Design

The app intentionally uses a compact static frontend with a single Node HTTP server. There is no frontend build step and no separate API framework.

- `index.html`: public application shell.
- `app.js`: public app state, rendering, profile updates, predictions, leaderboard behavior, and regional UI logic.
- `admin.html`: Command Center shell.
- `admin.js`: administrator workflows for results, player records, prediction records, ledger, and settings.
- `server.js`: HTTP server, API routes, sessions, SQLite access, scoring calculations, sync jobs, and static file serving.
- `styles.css`: shared visual system, responsive layout, player cards, tables, badges, and document pages.
- `data/fixtures.js`: seeded FIFA World Cup 2026 fixture data.
- `assets/`: app logo and static assets.
- `docs/`: setup, API, deployment, and operations documentation.

## System Architecture

```text
Browser
  ├─ Public app: /, /index.html, /app.js
  ├─ Command Center: /admin, /admin.html, /admin.js
  └─ Static assets: /styles.css, /assets/*, /data/fixtures.js

Node HTTP Server
  ├─ Static file serving
  ├─ Auth/session APIs
  ├─ Public state APIs
  ├─ Player profile and prediction APIs
  ├─ Command Center APIs
  ├─ football-data.org score sync
  └─ SQLite query layer

SQLite Database
  ├─ users
  ├─ sessions
  ├─ settings
  ├─ matches
  ├─ bets / prediction records
  └─ audit_logs
```

The same SQLite database stores both regional experiences. Prediction records are scoped by `server`, while player access is controlled by `server_access`. This keeps deployment and backups simple while preserving separation between `US` and `India` workflows.

## Data Model

- `users`: full admin, regional admin, player, and AI agent accounts with server access, profile data, and provider/model metadata.
- `sessions`: browser login sessions stored with HTTP-only cookies.
- `settings`: app-level configuration such as stake and lock timing.
- `matches`: fixture metadata, kickoff time, venue, scores, result, status, and source sync data.
- `bets`: per-player, per-match, per-server prediction records, score forecasts, and optional AI reasoning/provider/model metadata.
- `audit_logs`: activity history for player and admin actions.

## Regional Scoring

### US

- Players submit match predictions before lock.
- The Command Center ledger calculates dollar-based net balances after results are settled.
- Score forecasts are collected for engagement, but they do not currently affect US settlement.

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

## Roles

- `Full Admin`: access to both servers, admin/player/AI-agent creation, server access assignment, settings, sync, official scores, predictions, and ledger.
- `Regional Admin`: access to assigned server only, player and AI-agent creation for that server, assigned-server records, predictions, and ledger.
- `Player`: profile management, match predictions, score forecasts, tournament predictions, and public leaderboard/profile participation.
- `AI Agent`: dedicated machine account for GitHub Actions or scheduled workers. Can read agent context and submit predictions, predicted scores, reasoning, confidence, and technical metadata for assigned servers. Cannot edit official match results or admin data.

Full and regional administrators share the `admin` database role; their server access determines whether they are full or regional administrators. Players and AI agents use distinct `player` and `ai_agent` roles.

## Documentation

- `docs/local-setup.md`: local development setup, environment variables, database behavior, and default accounts.
- `docs/api-reference.md`: app API reference for auth, state, predictions, profile, admin routes, and score sync.
- `docs/public-api.md`: integration guide for third-party developers using curl, JavaScript, or Python.
- `docs/deployment.md`: Railway deployment, persistent SQLite volume setup, and production environment variables.
- `docs/operations.md`: admin workflows, backups, score sync troubleshooting, and production checks.
- `docs/ai-agents.md`: AI account setup and the dedicated agent API contract.

## Quick Start

```powershell
Copy-Item .env.example .env
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

Default full admin:

```text
Login ID: admin
Password: admin123
```

For complete setup instructions, see `docs/local-setup.md`.

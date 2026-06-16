const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");

const rootDir = __dirname;

function loadLocalEnv() {
  if (process.env.NODE_ENV === "production") return;

  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadLocalEnv();

if (
  process.env.FOOTBALL_DATA_ALLOW_INSECURE_TLS === "true"
  && process.env.NODE_ENV !== "production"
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.SQLITE_DB_PATH || path.join(rootDir, "data", "tracker.db");
const sqliteCommand = process.env.SQLITE3_PATH || "sqlite3";
const sessionCookie = "wc_session";
const publicPaths = new Set(["/", "/index.html", "/admin.html", "/styles.css", "/app.js", "/admin.js", "/data/fixtures.js"]);
const finalSportsStatuses = new Set(["FT", "AET", "PEN", "FINISHED"]);
const sportsSyncMinutes = Math.max(1, Number(process.env.FOOTBALL_DATA_SYNC_MINUTES || 15));
const autoSyncEnabled = process.env.FOOTBALL_DATA_AUTO_SYNC === "true";
const predictionLockAt = process.env.PREDICTION_LOCK_AT || "2026-06-27T23:59:59-04:00";

function footballDataConfig() {
  const keySource = process.env.FOOTBALL_DATA_API_KEY
    ? "FOOTBALL_DATA_API_KEY"
    : process.env.SPORTS_API_KEY
      ? "SPORTS_API_KEY"
      : process.env.FOOTBALL_DATA_TOKEN
        ? "FOOTBALL_DATA_TOKEN"
        : null;
  return {
    provider: "football-data.org",
    hasKey: Boolean(keySource),
    keySource,
    baseUrl: process.env.FOOTBALL_DATA_BASE_URL || "https://api.football-data.org/v4",
    competition: process.env.FOOTBALL_DATA_COMPETITION || "WC",
    season: process.env.FOOTBALL_DATA_SEASON || "2026",
    syncMode: process.env.FOOTBALL_DATA_SYNC_MODE || "auto",
    autoSync: autoSyncEnabled,
    syncMinutes: sportsSyncMinutes,
  };
}

let syncInProgress = false;
let lastSyncStatus = {
  enabled: false,
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  updated: 0,
  unmatched: 0,
  sourceMatches: 0,
  skippedWithoutScore: 0,
  unmatchedSamples: [],
  config: footballDataConfig(),
  message: "football-data.org sync has not run yet.",
  error: null,
};
const initialPlayers = [
  { displayName: "Skywalker", loginId: "AdityaMore", password: "Player@1", sourceInitial: "A" },
  { displayName: "Mith", loginId: "MithileshBiradar", password: "Player@2", sourceInitial: "M" },
  { displayName: "TBD", loginId: "ShardulVartak", password: "Player@3", sourceInitial: "S" },
];
const defaultAdmins = [
  { displayName: "Admin", loginId: "admin", password: "admin123", serverAccess: "US,India" },
  { displayName: "US Admin", loginId: "usadmin", password: "usadmin123", serverAccess: "US" },
];
const servers = ["US", "India"];

function normalizeServer(value) {
  return servers.includes(value) ? value : "US";
}

function parseServerAccess(value, role = "player") {
  const fallback = role === "admin" ? "US,India" : "US";
  const access = String(value || fallback)
    .split(",")
    .map((item) => normalizeServer(item.trim()))
    .filter((item, index, list) => item && list.indexOf(item) === index);
  return access.length ? access : parseServerAccess(fallback);
}

function serverAccessValue(value, role = "player") {
  const requested = Array.isArray(value) ? value.join(",") : value;
  return parseServerAccess(requested, role).join(",");
}

function isFullAdmin(user) {
  return user?.role === "admin" && parseServerAccess(user.server_access, user.role).length === servers.length;
}

function nullableScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 ? score : null;
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runSql(sql, json = false) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const tempSqlPath = !json && sql.length > 7000
      ? path.join(path.dirname(dbPath), `query-${crypto.randomBytes(8).toString("hex")}.sql`)
      : null;
    if (tempSqlPath) fs.writeFileSync(tempSqlPath, sql);
    const args = json
      ? ["-json", dbPath, sql]
      : tempSqlPath
        ? [dbPath, `.read "${tempSqlPath.replaceAll("\\", "/")}"`]
        : [dbPath, sql];
    execFile(sqliteCommand, args, { cwd: rootDir, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (tempSqlPath) fs.rmSync(tempSqlPath, { force: true });
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      if (!json) {
        resolve(stdout.trim());
        return;
      }
      resolve(stdout.trim() ? JSON.parse(stdout) : []);
    });
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || "").split(":");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function cleanAvatarData(value) {
  if (value === null || value === undefined || value === "") return "";
  const avatar = String(value);
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(avatar)) {
    throw new Error("Profile picture must be a PNG, JPG, GIF, or WebP image");
  }
  if (Buffer.byteLength(avatar, "utf8") > 750_000) {
    throw new Error("Profile picture must be smaller than 750 KB");
  }
  return avatar;
}

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanJsonArray(value, maxItems, maxLength = 120) {
  const source = Array.isArray(value) ? value : [];
  return source.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function cleanKnockoutPredictions(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    quarterfinalists: cleanJsonArray(source.quarterfinalists, 8),
    semifinalists: cleanJsonArray(source.semifinalists, 4),
    finalists: cleanJsonArray(source.finalists, 2),
    winner: cleanText(source.winner),
  };
}

function parseJsonField(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function tournamentPredictionsLocked() {
  return Date.now() >= new Date(predictionLockAt).getTime();
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
    const [key, ...rest] = cookie.trim().split("=");
    return [key, decodeURIComponent(rest.join("="))];
  }));
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
    request.on("error", reject);
  });
}

function fixtureRows() {
  const fixturesPath = path.join(rootDir, "data", "fixtures.js");
  global.window = {};
  delete require.cache[require.resolve(fixturesPath)];
  require(fixturesPath);
  return global.window.WC_BET_TRACKER_FIXTURES || [];
}

function parseKickoffUtc(date, kickoff) {
  if (!date || !kickoff) return null;
  const match = String(kickoff).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridian = match[3].toUpperCase();
  if (meridian === "PM" && hour !== 12) hour += 12;
  if (meridian === "AM" && hour === 12) hour = 0;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`).toISOString();
}

function normalizeTeamName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(united states|usa|u\.s\.a\.)\b/gi, "us")
    .replace(/\b(turkiye|turkey)\b/gi, "turkiye")
    .replace(/\b(south korea|korea republic|korea)\b/gi, "korea republic")
    .replace(/\b(cape verde islands|cape verde|cabo verde)\b/gi, "cabo verde")
    .replace(/\b(ivory coast|cote d ivoire|côte d ivoire)\b/gi, "cote d ivoire")
    .replace(/\b(iran|ir iran)\b/gi, "ir iran")
    .replace(/\b(dr congo|congo dr|democratic republic of congo)\b/gi, "congo dr")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function isLocked(match) {
  if (!match.kickoff_at) return false;
  return Date.now() >= new Date(match.kickoff_at).getTime() - 60 * 60 * 1000;
}

async function initDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  await runSql(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','player')),
      server_access TEXT NOT NULL DEFAULT 'US',
      avatar_data TEXT,
      supported_team TEXT,
      supported_player TEXT,
      golden_boot_predictions TEXT,
      knockout_predictions TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY,
      stage TEXT,
      group_name TEXT,
      match_date TEXT,
      kickoff TEXT,
      kickoff_at TEXT,
      venue TEXT,
      team1 TEXT,
      team2 TEXT,
      team1_score INTEGER,
      team2_score INTEGER,
      result TEXT,
      match_status TEXT,
      notes TEXT,
      source_url TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      match_id INTEGER NOT NULL,
      server TEXT NOT NULL DEFAULT 'US' CHECK(server IN ('US','India')),
      pick TEXT NOT NULL CHECK(pick IN ('Team 1','Team 2','Draw')),
      predicted_team1_score INTEGER,
      predicted_team2_score INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, match_id, server),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(match_id) REFERENCES matches(id)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO settings(key, value) VALUES ('stake', '1'), ('lock_minutes', '60');
  `);

  try {
    await runSql("ALTER TABLE matches ADD COLUMN match_status TEXT;");
  } catch (error) {
    if (!String(error.message).includes("duplicate column name")) throw error;
  }

  try {
    await runSql("ALTER TABLE users ADD COLUMN avatar_data TEXT;");
  } catch (error) {
    if (!String(error.message).includes("duplicate column name")) throw error;
  }

  for (const statement of [
    "ALTER TABLE users ADD COLUMN supported_team TEXT;",
    "ALTER TABLE users ADD COLUMN supported_player TEXT;",
    "ALTER TABLE users ADD COLUMN golden_boot_predictions TEXT;",
    "ALTER TABLE users ADD COLUMN knockout_predictions TEXT;",
  ]) {
    try {
      await runSql(statement);
    } catch (error) {
      if (!String(error.message).includes("duplicate column name")) throw error;
    }
  }

  try {
    await runSql("ALTER TABLE users ADD COLUMN server_access TEXT NOT NULL DEFAULT 'US';");
  } catch (error) {
    if (!String(error.message).includes("duplicate column name")) throw error;
  }
  await runSql(`
    UPDATE users SET server_access = 'US,India' WHERE role = 'admin' AND (server_access IS NULL OR server_access = '');
    UPDATE users SET server_access = 'US' WHERE role = 'player' AND (server_access IS NULL OR server_access = '');
  `);

  const betColumns = await runSql("PRAGMA table_info(bets);", true);
  if (!betColumns.some((column) => column.name === "server")) {
    await runSql(`
      BEGIN;
      ALTER TABLE bets RENAME TO bets_old;
      CREATE TABLE bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        match_id INTEGER NOT NULL,
        server TEXT NOT NULL DEFAULT 'US' CHECK(server IN ('US','India')),
        pick TEXT NOT NULL CHECK(pick IN ('Team 1','Team 2','Draw')),
        predicted_team1_score INTEGER,
        predicted_team2_score INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, match_id, server),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(match_id) REFERENCES matches(id)
      );
      INSERT INTO bets(id, user_id, match_id, server, pick, predicted_team1_score, predicted_team2_score, created_at, updated_at)
      SELECT id, user_id, match_id, 'US', pick, NULL, NULL, created_at, updated_at FROM bets_old;
      DROP TABLE bets_old;
      COMMIT;
    `);
  }

  const migratedBetColumns = await runSql("PRAGMA table_info(bets);", true);
  if (!migratedBetColumns.some((column) => column.name === "predicted_team1_score")) {
    await runSql("ALTER TABLE bets ADD COLUMN predicted_team1_score INTEGER;");
  }
  if (!migratedBetColumns.some((column) => column.name === "predicted_team2_score")) {
    await runSql("ALTER TABLE bets ADD COLUMN predicted_team2_score INTEGER;");
  }

  await seedDefaultAdmins();

  const matchCount = await runSql("SELECT COUNT(*) AS count FROM matches;", true);
  if (!matchCount[0].count) {
    const fixtures = fixtureRows();
    const inserts = fixtures.map((fixture) => `
      INSERT INTO matches(id, stage, group_name, match_date, kickoff, kickoff_at, venue, team1, team2, team1_score, team2_score, result, match_status, notes, source_url)
      VALUES (
        ${sqlValue(fixture.id)}, ${sqlValue(fixture.stage)}, ${sqlValue(fixture.group)}, ${sqlValue(fixture.date)},
        ${sqlValue(fixture.kickoff)}, ${sqlValue(parseKickoffUtc(fixture.date, fixture.kickoff))}, ${sqlValue(fixture.venue)},
        ${sqlValue(fixture.team1)}, ${sqlValue(fixture.team2)}, ${sqlValue(fixture.team1Score)}, ${sqlValue(fixture.team2Score)},
        ${sqlValue(fixture.result)}, ${sqlValue(fixture.result ? "FT" : null)}, ${sqlValue(fixture.notes)}, ${sqlValue(fixture.sourceUrl)}
      );
    `).join("\n");
    await runSql(inserts);
  }

  await runSql("UPDATE matches SET match_status = 'FT' WHERE result IS NOT NULL AND (match_status IS NULL OR match_status = '');");

  await seedInitialPlayers();
}

async function seedDefaultAdmins() {
  const adminSql = defaultAdmins.map((admin) => `
    INSERT INTO users(login_id, display_name, password_hash, role, server_access, is_active)
    VALUES (${sqlValue(admin.loginId)}, ${sqlValue(admin.displayName)}, ${sqlValue(hashPassword(admin.password))}, 'admin', ${sqlValue(admin.serverAccess)}, 1)
    ON CONFLICT(login_id) DO UPDATE SET
      role = 'admin',
      server_access = excluded.server_access,
      is_active = 1;
  `).join("\n");
  await runSql(adminSql);
}

async function seedInitialPlayers() {
  const fixtures = fixtureRows();
  const userSql = initialPlayers.map((player) => `
    INSERT INTO users(login_id, display_name, password_hash, role, server_access, is_active)
    VALUES (${sqlValue(player.loginId)}, ${sqlValue(player.displayName)}, ${sqlValue(hashPassword(player.password))}, 'player', 'US', 1)
    ON CONFLICT(login_id) DO NOTHING;
  `).join("\n");
  await runSql(userSql);

  const existingBets = await runSql("SELECT COUNT(*) AS count FROM bets;", true);
  if (existingBets[0].count) return;

  const playerRows = await runSql(`
    SELECT id, login_id
    FROM users
    WHERE login_id IN (${initialPlayers.map((player) => sqlValue(player.loginId)).join(", ")});
  `, true);
  const playerIdByLogin = new Map(playerRows.map((row) => [row.login_id, row.id]));
  const betSql = initialPlayers.flatMap((player) => {
    const userId = playerIdByLogin.get(player.loginId);
    if (!userId) return [];
    return fixtures
      .filter((fixture) => fixture.picks?.[player.sourceInitial])
      .map((fixture) => `
        INSERT INTO bets(user_id, match_id, server, pick, predicted_team1_score, predicted_team2_score, updated_at)
        VALUES (${userId}, ${fixture.id}, 'US', ${sqlValue(fixture.picks[player.sourceInitial])}, NULL, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, match_id, server) DO UPDATE SET
          pick = excluded.pick,
          predicted_team1_score = excluded.predicted_team1_score,
          predicted_team2_score = excluded.predicted_team2_score,
          updated_at = CURRENT_TIMESTAMP;
      `);
  }).join("\n");
  if (betSql) await runSql(betSql);
}

async function currentUser(request) {
  const token = parseCookies(request)[sessionCookie];
  if (!token) return null;
  const rows = await runSql(`
    SELECT users.id, users.login_id, users.display_name, users.role, users.server_access, users.avatar_data,
           users.supported_team, users.supported_player, users.golden_boot_predictions, users.knockout_predictions
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${sqlValue(token)}
      AND sessions.expires_at > datetime('now')
      AND users.is_active = 1;
  `, true);
  return rows[0] || null;
}

function publicUser(user) {
  return user ? {
    id: user.id,
    login_id: user.login_id,
    display_name: user.display_name,
    role: user.role,
    servers: parseServerAccess(user.server_access, user.role),
    avatar_data: user.avatar_data || "",
    supported_team: user.supported_team || "",
    supported_player: user.supported_player || "",
    golden_boot_predictions: parseJsonField(user.golden_boot_predictions, []),
    knockout_predictions: parseJsonField(user.knockout_predictions, { quarterfinalists: [], semifinalists: [], finalists: [], winner: "" }),
  } : null;
}

function requestServer(url, user = null) {
  const requested = normalizeServer(url.searchParams.get("server"));
  if (!user) return requested;
  const access = parseServerAccess(user.server_access, user.role);
  return access.includes(requested) ? requested : access[0];
}

async function requireUser(request, response) {
  const user = await currentUser(request);
  if (!user) {
    sendJson(response, 401, { ok: false, error: "Login required" });
    return null;
  }
  return user;
}

async function requireAdmin(request, response) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (user.role !== "admin") {
    sendJson(response, 403, { ok: false, error: "Admin access required" });
    return null;
  }
  return user;
}

function requireFullAdmin(admin, response) {
  if (isFullAdmin(admin)) return true;
  sendJson(response, 403, { ok: false, error: "Full admin access required" });
  return false;
}

function requireAdminServer(admin, server, response) {
  if (parseServerAccess(admin.server_access, admin.role).includes(server)) return true;
  sendJson(response, 403, { ok: false, error: `Admin access to ${server} is required` });
  return false;
}

function settlement(match, bets, users, stake, server = "US") {
  const correct = match.result ? bets.filter((bet) => bet.pick === match.result) : [];
  const pool = bets.length * stake;
  const payoutEach = match.result && correct.length ? pool / correct.length : 0;
  return users.map((user) => {
    const bet = bets.find((row) => row.user_id === user.id);
    const won = Boolean(match.result && bet && bet.pick === match.result);
    const settled = match.result && bet ? 1 : 0;
    if (server === "India") {
      const team1ScorePoint = settled
        && bet.predicted_team1_score !== null
        && Number(bet.predicted_team1_score) === Number(match.team1_score)
        ? 1
        : 0;
      const team2ScorePoint = settled
        && bet.predicted_team2_score !== null
        && Number(bet.predicted_team2_score) === Number(match.team2_score)
        ? 1
        : 0;
      const exactScoreBonus = team1ScorePoint && team2ScorePoint ? 3 : 0;
      const points = (won ? 1 : 0) + team1ScorePoint + team2ScorePoint + exactScoreBonus;
      return {
        user_id: user.id,
        payout: 0,
        net: points,
        points,
        score_points: team1ScorePoint + team2ScorePoint + exactScoreBonus,
        correct: won ? 1 : 0,
        settled,
      };
    }
    const payout = won ? payoutEach : 0;
    const net = settled ? payout - stake : 0;
    return { user_id: user.id, payout, net, points: won ? 1 : 0, correct: won ? 1 : 0, settled };
  });
}

async function appState(user = null, selectedServer = "US") {
  const server = normalizeServer(selectedServer);
  const [settingsRows, matches, users, bets] = await Promise.all([
    runSql("SELECT key, value FROM settings;", true),
    runSql("SELECT * FROM matches ORDER BY id;", true),
    runSql("SELECT id, login_id, display_name, role, server_access, avatar_data, supported_team, supported_player, golden_boot_predictions, knockout_predictions, is_active, created_at FROM users ORDER BY role, display_name;", true),
    runSql(`SELECT * FROM bets WHERE server = ${sqlValue(server)} ORDER BY match_id, user_id;`, true),
  ]);
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  const stake = Number(settings.stake || 1);
  const allUsersWithAccess = users.map((row) => ({ ...row, servers: parseServerAccess(row.server_access, row.role) }));
  const usersWithAccess = user?.role === "admin" && !isFullAdmin(user)
    ? allUsersWithAccess.filter((row) => row.id === user.id || (row.role === "player" && row.servers.includes(server)))
    : allUsersWithAccess;
  const players = usersWithAccess.filter((row) => row.role === "player" && row.is_active && row.servers.includes(server));
  const summaries = players.map((player) => ({
    user_id: player.id,
    login_id: player.login_id,
    display_name: player.display_name,
    avatar_data: player.avatar_data,
    supported_team: player.supported_team || "",
    supported_player: player.supported_player || "",
    golden_boot_predictions: parseJsonField(player.golden_boot_predictions, []),
    knockout_predictions: parseJsonField(player.knockout_predictions, { quarterfinalists: [], semifinalists: [], finalists: [], winner: "" }),
    bets_entered: 0,
    settled: 0,
    correct: 0,
    score_points: 0,
    payout: 0,
    net: 0,
    points: 0,
    roi: 0,
  }));

  const fixtures = matches.map((match) => {
    const matchBets = bets.filter((bet) => bet.match_id === match.id);
    const rows = settlement(match, matchBets, players, stake, server);
    rows.forEach((row) => {
      const summary = summaries.find((item) => item.user_id === row.user_id);
      const bet = matchBets.find((item) => item.user_id === row.user_id);
      if (bet) summary.bets_entered += 1;
      summary.settled += row.settled;
      summary.correct += row.correct;
      summary.score_points += row.score_points || 0;
      summary.payout += row.payout;
      summary.net += row.net;
      summary.points += row.points || 0;
    });
    const publicBets = Object.fromEntries(matchBets.map((bet) => [bet.user_id, {
      pick: bet.pick,
      predictedTeam1Score: bet.predicted_team1_score,
      predictedTeam2Score: bet.predicted_team2_score,
    }]));
    return {
      id: match.id,
      stage: match.stage,
      group: match.group_name,
      date: match.match_date,
      kickoff: match.kickoff,
      kickoffAt: match.kickoff_at,
      venue: match.venue,
      team1: match.team1,
      team2: match.team2,
      team1Score: match.team1_score,
      team2Score: match.team2_score,
      result: match.result,
      status: match.match_status,
      notes: match.notes,
      sourceUrl: match.source_url,
      locked: isLocked(match),
      bets: publicBets,
      myPick: user ? publicBets[user.id]?.pick || "" : "",
      myPrediction: user ? publicBets[user.id] || null : null,
    };
  });

  summaries.forEach((summary) => {
    const staked = summary.settled * stake;
    summary.roi = staked ? summary.net / staked : 0;
  });
  summaries.sort((a, b) => server === "India"
    ? b.points - a.points || b.correct - a.correct || a.display_name.localeCompare(b.display_name)
    : b.net - a.net || b.correct - a.correct || a.display_name.localeCompare(b.display_name));

  return {
    settings: {
      stake,
      lockMinutes: Number(settings.lock_minutes || 60),
      server,
      serverLabel: server,
      scoringMode: server === "India" ? "points" : "money",
      servers,
      predictionsLocked: tournamentPredictionsLocked(),
      predictionLockAt,
    },
    fixtures,
    users: usersWithAccess,
    players,
    leaderboard: summaries,
    sync: lastSyncStatus,
  };
}

async function syncSportsResults() {
  const config = footballDataConfig();
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY || process.env.SPORTS_API_KEY || process.env.FOOTBALL_DATA_TOKEN;
  const footballDataBaseUrl = config.baseUrl;
  const footballDataCompetition = config.competition;
  const footballDataSeason = config.season;
  const dateWindowDays = Math.max(1, Number(process.env.FOOTBALL_DATA_DATE_WINDOW_DAYS || 3));
  const syncMode = config.syncMode;
  const competitionMatchesUrl = `${footballDataBaseUrl}/competitions/${encodeURIComponent(footballDataCompetition)}/matches`;
  const apiUrl = process.env.SPORTS_API_URL || (footballDataKey
    ? `${competitionMatchesUrl}?season=${encodeURIComponent(footballDataSeason)}`
    : "");
  const apiKey = footballDataKey;

  if (!apiUrl) {
    const result = {
      updated: 0,
      unmatched: 0,
      message: "Set FOOTBALL_DATA_API_KEY to enable football-data.org sync. Optional: FOOTBALL_DATA_COMPETITION=WC and FOOTBALL_DATA_SEASON=2026.",
    };
    lastSyncStatus = {
      ...lastSyncStatus,
      enabled: false,
      running: false,
      lastRunAt: new Date().toISOString(),
      config,
      updated: 0,
      unmatched: 0,
      message: result.message,
      error: null,
    };
    return result;
  }

  const headers = {};
  if (apiKey) headers["X-Auth-Token"] = apiKey;

  async function fetchApiJson(url) {
    const response = await fetch(url, { headers });
    const payload = await response.json().catch(() => ({}));
    const apiErrors = response.ok ? null : {
      status: response.status,
      statusText: response.statusText,
      body: payload,
    };
    return {
      rows: response.ok ? payload.matches || payload.response || payload.events || [] : [],
      errors: apiErrors,
      url,
    };
  }

  function dateOnly(date) {
    return date.toISOString().slice(0, 10);
  }

  async function fetchDateWindowMatches() {
    const today = new Date();
    const before = Math.floor((dateWindowDays - 1) / 2);
    const after = dateWindowDays - before - 1;
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - before));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + after + 1));
    const dateWindowUrl = process.env.SPORTS_API_URL || `${competitionMatchesUrl}?dateFrom=${dateOnly(start)}&dateTo=${dateOnly(end)}`;
    return fetchApiJson(dateWindowUrl);
  }

  let apiResult;
  if (syncMode === "date-window") {
    apiResult = await fetchDateWindowMatches();
  } else {
    apiResult = await fetchApiJson(apiUrl);
    if (syncMode === "auto" && apiResult.errors) {
      apiResult = await fetchDateWindowMatches();
    }
  }

  const sourceMatches = apiResult.rows;
  const localMatches = await runSql("SELECT id, team1, team2 FROM matches;", true);
  const localByTeams = new Map(localMatches.map((match) => [
    `${normalizeTeamName(match.team1)}|${normalizeTeamName(match.team2)}`,
    match,
  ]));
  let updated = 0;
  let unmatched = 0;
  let skippedWithoutScore = 0;
  const unmatchedSamples = [];

  for (const item of sourceMatches) {
    const home = item.homeTeam?.name || item.homeTeam?.shortName || item.teams?.home?.name || item.strHomeTeam;
    const away = item.awayTeam?.name || item.awayTeam?.shortName || item.teams?.away?.name || item.strAwayTeam;
    const homeScore = item.score?.fullTime?.home ?? item.score?.regularTime?.home ?? item.goals?.home ?? item.intHomeScore;
    const awayScore = item.score?.fullTime?.away ?? item.score?.regularTime?.away ?? item.goals?.away ?? item.intAwayScore;
    const status = item.status || item.fixture?.status?.short || item.fixture?.status?.long || "";
    if (!home || !away || homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
      skippedWithoutScore += 1;
      continue;
    }

    const normalHome = normalizeTeamName(home);
    const normalAway = normalizeTeamName(away);
    const localMatch = localByTeams.get(`${normalHome}|${normalAway}`) || localByTeams.get(`${normalAway}|${normalHome}`);
    if (!localMatch) {
      unmatched += 1;
      if (unmatchedSamples.length < 5) unmatchedSamples.push(`${home} vs ${away}`);
      continue;
    }

    const reversed = normalizeTeamName(localMatch.team1) === normalAway;
    const team1Score = reversed ? Number(awayScore) : Number(homeScore);
    const team2Score = reversed ? Number(homeScore) : Number(awayScore);
    const isFinal = finalSportsStatuses.has(String(status).toUpperCase());
    const apiWinner = String(item.score?.winner || "").toUpperCase();
    const result = isFinal
      ? apiWinner === "HOME_TEAM"
        ? reversed ? "Team 2" : "Team 1"
        : apiWinner === "AWAY_TEAM"
          ? reversed ? "Team 1" : "Team 2"
          : team1Score > team2Score ? "Team 1" : team2Score > team1Score ? "Team 2" : "Draw"
      : null;

    await runSql(`
      UPDATE matches
      SET team1_score = ${sqlValue(team1Score)},
          team2_score = ${sqlValue(team2Score)},
          result = COALESCE(${sqlValue(result)}, result),
          match_status = ${sqlValue(status)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlValue(localMatch.id)};
    `);
    updated += 1;
  }
  const result = {
    updated,
    unmatched,
    sourceMatches: sourceMatches.length,
    skippedWithoutScore,
    unmatchedSamples,
    apiErrors: apiResult.errors,
    apiSource: apiResult.url.replace(footballDataBaseUrl, ""),
    config,
    message: `football-data.org sync saw ${sourceMatches.length} API matches and updated ${updated}${skippedWithoutScore ? `; ${skippedWithoutScore} had no score yet` : ""}${unmatched ? `; ${unmatched} did not match tracker teams` : ""}${apiResult.errors ? `; API reported ${JSON.stringify(apiResult.errors)}` : ""}.`,
  };
  lastSyncStatus = {
    ...lastSyncStatus,
    enabled: true,
    running: false,
    lastRunAt: new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
    updated,
    unmatched,
    sourceMatches: sourceMatches.length,
    skippedWithoutScore,
    unmatchedSamples,
    apiErrors: apiResult.errors,
    apiSource: result.apiSource,
    config,
    message: result.message,
    error: null,
  };
  return result;
}

async function runScheduledSync(reason = "scheduled") {
  const config = footballDataConfig();
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY || process.env.SPORTS_API_KEY || process.env.FOOTBALL_DATA_TOKEN;
  if (!autoSyncEnabled || !footballDataKey) {
    lastSyncStatus = {
      ...lastSyncStatus,
      enabled: Boolean(footballDataKey),
      running: false,
      config,
      message: footballDataKey
        ? "Automatic football-data.org sync is disabled."
        : "Automatic football-data.org sync is waiting for FOOTBALL_DATA_API_KEY.",
    };
    return lastSyncStatus;
  }
  if (syncInProgress) return lastSyncStatus;

  syncInProgress = true;
  lastSyncStatus = {
    ...lastSyncStatus,
    enabled: true,
    running: true,
    lastRunAt: new Date().toISOString(),
    config,
    message: `football-data.org ${reason} sync running.`,
    error: null,
  };
  try {
    const result = await syncSportsResults();
    return { ...lastSyncStatus, ...result };
  } catch (error) {
    lastSyncStatus = {
      ...lastSyncStatus,
      enabled: true,
      running: false,
      lastErrorAt: new Date().toISOString(),
      config,
      message: `football-data.org ${reason} sync could not complete.`,
      error: error.message,
    };
    if (reason === "manual") console.error("football-data.org manual sync failed:", error);
    else console.log(`football-data.org ${reason} sync could not complete: ${error.message}`);
    return lastSyncStatus;
  } finally {
    syncInProgress = false;
    lastSyncStatus = { ...lastSyncStatus, running: false };
  }
}

function startSportsAutoSync() {
  const config = footballDataConfig();
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY || process.env.SPORTS_API_KEY || process.env.FOOTBALL_DATA_TOKEN;
  lastSyncStatus = {
    ...lastSyncStatus,
    enabled: Boolean(footballDataKey) && autoSyncEnabled,
    config,
    message: !footballDataKey
      ? "Automatic football-data.org sync is waiting for FOOTBALL_DATA_API_KEY."
      : autoSyncEnabled
        ? `football-data.org auto sync every ${sportsSyncMinutes} minutes.`
        : "Automatic football-data.org sync is disabled.",
  };
  if (!footballDataKey || !autoSyncEnabled) return;

  setTimeout(() => runScheduledSync("startup"), 60_000);
  setInterval(() => runScheduledSync("scheduled"), sportsSyncMinutes * 60 * 1000);
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const routePath = url.pathname === "/admin" ? "/admin.html" : url.pathname;
  const requestedPath = decodeURIComponent(routePath === "/" ? "/index.html" : routePath);
  const filePath = path.normalize(path.join(rootDir, requestedPath));
  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}

async function router(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(request);
    const users = await runSql(`SELECT * FROM users WHERE login_id = ${sqlValue(body.loginId)} AND is_active = 1;`, true);
    const user = users[0];
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      sendJson(response, 401, { ok: false, error: "Invalid login ID or password" });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    await runSql(`INSERT INTO sessions(token, user_id, expires_at) VALUES (${sqlValue(token)}, ${user.id}, datetime('now', '+7 days'));`);
    const secureCookieFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    sendJson(response, 200, { ok: true, user: publicUser(user) }, {
      "set-cookie": `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}${secureCookieFlag}`,
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    const token = parseCookies(request)[sessionCookie];
    if (token) await runSql(`DELETE FROM sessions WHERE token = ${sqlValue(token)};`);
    const secureClearFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    sendJson(response, 200, { ok: true }, { "set-cookie": `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureClearFlag}` });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/me") {
    sendJson(response, 200, { user: publicUser(await currentUser(request)) });
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/profile") {
    const user = await requireUser(request, response);
    if (!user) return;
    const body = await readBody(request);
    const displayName = String(body.displayName || "").trim();
    const loginId = String(body.loginId || "").trim();
    const password = String(body.password || "");
    if (!displayName || !loginId) {
      sendJson(response, 400, { ok: false, error: "Display name and login ID are required" });
      return;
    }
    let avatarData;
    try {
      avatarData = cleanAvatarData(body.avatarData);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
      return;
    }
    const passwordSql = password ? `, password_hash = ${sqlValue(hashPassword(password))}` : "";
    const predictionsLocked = tournamentPredictionsLocked();
    const existingRows = await runSql(`SELECT golden_boot_predictions, knockout_predictions FROM users WHERE id = ${sqlValue(user.id)};`, true);
    const existingProfile = existingRows[0] || {};
    const goldenBootPredictions = predictionsLocked
      ? existingProfile.golden_boot_predictions
      : JSON.stringify(cleanJsonArray(body.goldenBootPredictions, 5));
    const knockoutPredictions = predictionsLocked
      ? existingProfile.knockout_predictions
      : JSON.stringify(cleanKnockoutPredictions(body.knockoutPredictions));
    try {
      await runSql(`
        UPDATE users
        SET display_name = ${sqlValue(displayName)},
            login_id = ${sqlValue(loginId)},
            avatar_data = ${sqlValue(avatarData)},
            supported_team = ${sqlValue(cleanText(body.supportedTeam))},
            supported_player = ${sqlValue(cleanText(body.supportedPlayer))},
            golden_boot_predictions = ${sqlValue(goldenBootPredictions)},
            knockout_predictions = ${sqlValue(knockoutPredictions)}
            ${passwordSql}
        WHERE id = ${sqlValue(user.id)};
      `);
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        sendJson(response, 409, { ok: false, error: "That login ID is already in use" });
        return;
      }
      throw error;
    }
    await runSql(`INSERT INTO audit_logs(user_id, action, details) VALUES (${user.id}, 'profile.updated', ${sqlValue(JSON.stringify({ displayName, loginId, avatarUpdated: Boolean(avatarData), passwordUpdated: Boolean(password), predictionsLocked }))});`);
    const nextUser = await currentUser(request);
    sendJson(response, 200, { ok: true, user: publicUser(nextUser), state: await appState(nextUser, requestServer(url, nextUser)) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    const user = await currentUser(request);
    sendJson(response, 200, await appState(user, requestServer(url, user)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/sync-status") {
    sendJson(response, 200, lastSyncStatus);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/bets") {
    const user = await requireUser(request, response);
    if (!user) return;
    if (user.role !== "player") {
      sendJson(response, 403, { ok: false, error: "Only player accounts can place bets" });
      return;
    }
    const body = await readBody(request);
    const server = requestServer(new URL(`/?server=${encodeURIComponent(body.server || "")}`, `http://${request.headers.host}`), user);
    const predictedTeam1Score = nullableScore(body.predictedTeam1Score);
    const predictedTeam2Score = nullableScore(body.predictedTeam2Score);
    if (!["Team 1", "Team 2", "Draw"].includes(body.pick)) {
      sendJson(response, 400, { ok: false, error: "Invalid pick" });
      return;
    }
    const matches = await runSql(`SELECT * FROM matches WHERE id = ${sqlValue(Number(body.matchId))};`, true);
    const match = matches[0];
    if (!match) {
      sendJson(response, 404, { ok: false, error: "Match not found" });
      return;
    }
    if (isLocked(match)) {
      sendJson(response, 423, { ok: false, error: "Betting is locked for this match" });
      return;
    }
    await runSql(`
      INSERT INTO bets(user_id, match_id, server, pick, predicted_team1_score, predicted_team2_score, updated_at)
      VALUES (${user.id}, ${match.id}, ${sqlValue(server)}, ${sqlValue(body.pick)}, ${sqlValue(predictedTeam1Score)}, ${sqlValue(predictedTeam2Score)}, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, match_id, server) DO UPDATE SET
        pick = excluded.pick,
        predicted_team1_score = excluded.predicted_team1_score,
        predicted_team2_score = excluded.predicted_team2_score,
        updated_at = CURRENT_TIMESTAMP;
    `);
    await runSql(`INSERT INTO audit_logs(user_id, action, details) VALUES (${user.id}, 'bet.saved', ${sqlValue(JSON.stringify({ ...body, server, predictedTeam1Score, predictedTeam2Score }))});`);
    sendJson(response, 200, { ok: true, state: await appState(user, server) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/users") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const body = await readBody(request);
    if (!body.loginId || !body.password || !body.displayName) {
      sendJson(response, 400, { ok: false, error: "Login ID, display name, and password are required" });
      return;
    }
    const fullAdmin = isFullAdmin(admin);
    const role = fullAdmin && body.role === "admin" ? "admin" : "player";
    const serverAccess = fullAdmin
      ? serverAccessValue(body.serverAccess, role)
      : parseServerAccess(admin.server_access, admin.role).join(",");
    if (!fullAdmin && role !== "player") {
      sendJson(response, 403, { ok: false, error: "Sub-admins can only create player accounts" });
      return;
    }
    await runSql(`
      INSERT INTO users(login_id, display_name, password_hash, role, server_access, is_active)
      VALUES (${sqlValue(body.loginId)}, ${sqlValue(body.displayName)}, ${sqlValue(hashPassword(body.password))}, ${sqlValue(role)}, ${sqlValue(serverAccess)}, 1);
    `);
    sendJson(response, 200, { ok: true, state: await appState(admin, requestServer(url, admin)) });
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/users/")) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(request);
    const targetRows = await runSql(`SELECT id, role, server_access FROM users WHERE id = ${sqlValue(id)};`, true);
    const targetUser = targetRows[0];
    if (!targetUser) {
      sendJson(response, 404, { ok: false, error: "User not found" });
      return;
    }
    if (!isFullAdmin(admin)) {
      const adminServers = parseServerAccess(admin.server_access, admin.role);
      const targetServers = parseServerAccess(targetUser.server_access, targetUser.role);
      if (targetUser.role !== "player" || !targetServers.some((server) => adminServers.includes(server))) {
        sendJson(response, 403, { ok: false, error: "You can only update player records in your assigned server" });
        return;
      }
      delete body.role;
      delete body.serverAccess;
    }
    const passwordSql = body.password ? `, password_hash = ${sqlValue(hashPassword(body.password))}` : "";
    await runSql(`
      UPDATE users
      SET login_id = COALESCE(${sqlValue(body.loginId)}, login_id),
          display_name = COALESCE(${sqlValue(body.displayName)}, display_name),
          role = COALESCE(${body.role === "admin" ? "'admin'" : body.role === "player" ? "'player'" : "NULL"}, role),
          server_access = COALESCE(${body.serverAccess === undefined ? "NULL" : sqlValue(serverAccessValue(body.serverAccess, body.role))}, server_access),
          is_active = COALESCE(${body.isActive === undefined ? "NULL" : sqlValue(body.isActive ? 1 : 0)}, is_active)
          ${passwordSql}
      WHERE id = ${sqlValue(id)};
    `);
    await runSql(`INSERT INTO audit_logs(user_id, action, details) VALUES (${admin.id}, 'admin.user.updated', ${sqlValue(JSON.stringify({ id, ...body, password: body.password ? "[redacted]" : "" }))});`);
    sendJson(response, 200, { ok: true, state: await appState(admin, requestServer(url, admin)) });
    return;
  }

  if (
    (request.method === "DELETE" && url.pathname.startsWith("/api/admin/users/"))
    || (request.method === "POST" && /^\/api\/admin\/users\/\d+\/delete$/.test(url.pathname))
  ) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    if (!requireFullAdmin(admin, response)) return;
    const parts = url.pathname.split("/");
    const id = Number(request.method === "POST" ? parts.at(-2) : parts.at(-1));
    if (!Number.isFinite(id)) {
      sendJson(response, 400, { ok: false, error: "Invalid user ID" });
      return;
    }
    if (id === admin.id) {
      sendJson(response, 400, { ok: false, error: "You cannot delete your own admin account" });
      return;
    }
    const users = await runSql(`SELECT id, login_id, display_name, role FROM users WHERE id = ${sqlValue(id)};`, true);
    if (!users[0]) {
      sendJson(response, 404, { ok: false, error: "User not found" });
      return;
    }
    await runSql(`
      DELETE FROM bets WHERE user_id = ${sqlValue(id)};
      DELETE FROM sessions WHERE user_id = ${sqlValue(id)};
      DELETE FROM users WHERE id = ${sqlValue(id)};
    `);
    await runSql(`INSERT INTO audit_logs(user_id, action, details) VALUES (${admin.id}, 'admin.user.deleted', ${sqlValue(JSON.stringify(users[0]))});`);
    sendJson(response, 200, { ok: true, state: await appState(admin, requestServer(url, admin)) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/settings") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    if (!requireFullAdmin(admin, response)) return;
    const body = await readBody(request);
    await runSql(`
      INSERT INTO settings(key, value) VALUES ('stake', ${sqlValue(String(Number(body.stake || 1)))})
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      INSERT INTO settings(key, value) VALUES ('lock_minutes', ${sqlValue(String(Number(body.lockMinutes || 60)))})
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `);
    sendJson(response, 200, { ok: true, state: await appState(admin, requestServer(url, admin)) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/bets") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const body = await readBody(request);
    const userId = Number(body.userId);
    const matchId = Number(body.matchId);
    const server = normalizeServer(body.server);
    if (!requireAdminServer(admin, server, response)) return;
    const pick = String(body.pick || "");
    const predictedTeam1Score = nullableScore(body.predictedTeam1Score);
    const predictedTeam2Score = nullableScore(body.predictedTeam2Score);
    const [users, matches] = await Promise.all([
      runSql(`SELECT id, role, server_access FROM users WHERE id = ${sqlValue(userId)};`, true),
      runSql(`SELECT id FROM matches WHERE id = ${sqlValue(matchId)};`, true),
    ]);
    if (!users[0] || users[0].role !== "player") {
      sendJson(response, 400, { ok: false, error: "Bet must belong to a player account" });
      return;
    }
    if (!parseServerAccess(users[0].server_access, users[0].role).includes(server)) {
      sendJson(response, 400, { ok: false, error: `Player is not assigned to ${server}` });
      return;
    }
    if (!matches[0]) {
      sendJson(response, 404, { ok: false, error: "Match not found" });
      return;
    }
    if (!pick) {
      await runSql(`DELETE FROM bets WHERE user_id = ${sqlValue(userId)} AND match_id = ${sqlValue(matchId)} AND server = ${sqlValue(server)};`);
    } else {
      if (!["Team 1", "Team 2", "Draw"].includes(pick)) {
        sendJson(response, 400, { ok: false, error: "Invalid pick" });
        return;
      }
      await runSql(`
        INSERT INTO bets(user_id, match_id, server, pick, predicted_team1_score, predicted_team2_score, updated_at)
        VALUES (${sqlValue(userId)}, ${sqlValue(matchId)}, ${sqlValue(server)}, ${sqlValue(pick)}, ${sqlValue(predictedTeam1Score)}, ${sqlValue(predictedTeam2Score)}, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, match_id, server) DO UPDATE SET
          pick = excluded.pick,
          predicted_team1_score = excluded.predicted_team1_score,
          predicted_team2_score = excluded.predicted_team2_score,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }
    await runSql(`INSERT INTO audit_logs(user_id, action, details) VALUES (${admin.id}, 'admin.bet.updated', ${sqlValue(JSON.stringify({ userId, matchId, server, pick, predictedTeam1Score, predictedTeam2Score }))});`);
    sendJson(response, 200, { ok: true, state: await appState(admin, server) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/matches") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    if (!requireFullAdmin(admin, response)) return;
    const body = await readBody(request);
    if (!body.team1 || !body.team2) {
      sendJson(response, 400, { ok: false, error: "Team 1 and Team 2 are required" });
      return;
    }
    const nextRows = await runSql("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM matches;", true);
    const id = Number(body.id) || Number(nextRows[0].next_id);
    const kickoffAt = parseKickoffUtc(body.date, body.kickoff);
    await runSql(`
      INSERT INTO matches(id, stage, group_name, match_date, kickoff, kickoff_at, venue, team1, team2, match_status, notes)
      VALUES (
        ${sqlValue(id)},
        ${sqlValue(body.stage)},
        ${sqlValue(body.groupName)},
        ${sqlValue(body.date)},
        ${sqlValue(body.kickoff)},
        ${sqlValue(kickoffAt)},
        ${sqlValue(body.venue)},
        ${sqlValue(body.team1)},
        ${sqlValue(body.team2)},
        ${sqlValue(body.matchStatus || "NS")},
        ${sqlValue(body.notes)}
      );
    `);
    await runSql(`INSERT INTO audit_logs(user_id, action, details) VALUES (${admin.id}, 'admin.match.created', ${sqlValue(JSON.stringify({ id, ...body }))});`);
    sendJson(response, 200, { ok: true, state: await appState(admin, requestServer(url, admin)) });
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/matches/")) {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    if (!requireFullAdmin(admin, response)) return;
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(request);
    const kickoffAt = parseKickoffUtc(body.date, body.kickoff);
    await runSql(`
      UPDATE matches SET
        stage = COALESCE(${sqlValue(body.stage)}, stage),
        group_name = COALESCE(${sqlValue(body.groupName)}, group_name),
        match_date = COALESCE(${sqlValue(body.date)}, match_date),
        kickoff = COALESCE(${sqlValue(body.kickoff)}, kickoff),
        kickoff_at = COALESCE(${sqlValue(kickoffAt)}, kickoff_at),
        venue = COALESCE(${sqlValue(body.venue)}, venue),
        team1 = COALESCE(${sqlValue(body.team1)}, team1),
        team2 = COALESCE(${sqlValue(body.team2)}, team2),
        team1_score = ${sqlValue(body.team1Score)},
        team2_score = ${sqlValue(body.team2Score)},
        result = ${sqlValue(body.result)},
        match_status = ${sqlValue(body.matchStatus)},
        notes = COALESCE(${sqlValue(body.notes)}, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlValue(id)};
    `);
    await runSql(`INSERT INTO audit_logs(user_id, action, details) VALUES (${admin.id}, 'admin.match.updated', ${sqlValue(JSON.stringify({ id, ...body }))});`);
    sendJson(response, 200, { ok: true, state: await appState(admin, requestServer(url, admin)) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/sync-results") {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    if (!requireFullAdmin(admin, response)) return;
    sendJson(response, 200, { ok: true, ...(await runScheduledSync("manual")), state: await appState(admin, requestServer(url, admin)) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, status: "healthy" });
    return;
  }

  if (request.method === "GET" && publicPaths.has(url.pathname)) {
    serveStatic(request, response);
    return;
  }
  serveStatic(request, response);
}

initDb().then(() => {
  http.createServer((request, response) => {
    router(request, response).catch((error) => sendJson(response, 500, { ok: false, error: error.message }));
  }).listen(port, "0.0.0.0", () => {
    const config = footballDataConfig();
    console.log(`World Cup bet tracker running at http://0.0.0.0:${port}`);
    console.log("Default admin: admin / admin123");
    console.log(config.hasKey
      ? `football-data.org key loaded from ${config.keySource}; competition=${config.competition}; season=${config.season}; autoSync=${config.autoSync}.`
      : "football-data.org key not set. Add FOOTBALL_DATA_API_KEY to the Railway service variables.");
    startSportsAutoSync();
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

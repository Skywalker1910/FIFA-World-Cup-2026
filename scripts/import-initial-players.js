const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const dbPath = process.env.SQLITE_DB_PATH || path.join(rootDir, "data", "tracker.db");
const sqliteCommand = process.env.SQLITE3_PATH || "sqlite3";

const users = [
  { displayName: "Skywalker", loginId: "AdityaMore", password: "Player@1", sourceInitial: "A" },
  { displayName: "Mith", loginId: "MithileshBiradar", password: "Player@2", sourceInitial: "M" },
  { displayName: "TBD", loginId: "ShardulVartak", password: "Player@3", sourceInitial: "S" },
];

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function runSql(sql) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const tempPath = path.join(path.dirname(dbPath), `import-${crypto.randomBytes(8).toString("hex")}.sql`);
  fs.writeFileSync(tempPath, sql);
  try {
    return execFileSync(sqliteCommand, [dbPath, `.read "${tempPath.replaceAll("\\", "/")}"`], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

global.window = {};
require(path.join(rootDir, "data", "fixtures.js"));
const fixtures = global.window.WC_BET_TRACKER_FIXTURES || [];

const userSql = users.map((user) => `
  INSERT INTO users(login_id, display_name, password_hash, role, is_active)
  VALUES (${sqlValue(user.loginId)}, ${sqlValue(user.displayName)}, ${sqlValue(hashPassword(user.password))}, 'player', 1)
  ON CONFLICT(login_id) DO UPDATE SET
    display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    role = 'player',
    is_active = 1;
`).join("\n");

runSql(`BEGIN; ${userSql} COMMIT;`);

const userRows = JSON.parse(execFileSync(sqliteCommand, [
  "-json",
  dbPath,
  `SELECT id, login_id FROM users WHERE login_id IN (${users.map((user) => sqlValue(user.loginId)).join(", ")});`,
], { cwd: rootDir, encoding: "utf8" }));
const userIdByLogin = new Map(userRows.map((row) => [row.login_id, row.id]));

const betSql = users.flatMap((user) => {
  const userId = userIdByLogin.get(user.loginId);
  return fixtures
    .filter((fixture) => fixture.picks?.[user.sourceInitial])
    .map((fixture) => `
      INSERT INTO bets(user_id, match_id, pick, updated_at)
      VALUES (${userId}, ${fixture.id}, ${sqlValue(fixture.picks[user.sourceInitial])}, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, match_id) DO UPDATE SET
        pick = excluded.pick,
        updated_at = CURRENT_TIMESTAMP;
    `);
}).join("\n");

runSql(`BEGIN; ${betSql} COMMIT;`);

const summary = execFileSync(sqliteCommand, [dbPath, `
  SELECT users.display_name || ' (' || users.login_id || '): ' || COUNT(bets.id)
  FROM users
  LEFT JOIN bets ON bets.user_id = users.id
  WHERE users.login_id IN (${users.map((user) => sqlValue(user.loginId)).join(", ")})
  GROUP BY users.id
  ORDER BY users.display_name;
`], { cwd: rootDir, encoding: "utf8" });

process.stdout.write(summary);

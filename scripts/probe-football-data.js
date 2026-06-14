const fs = require("node:fs");
const path = require("node:path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function probe(pathname) {
  const baseUrl = process.env.FOOTBALL_DATA_BASE_URL || "https://api.football-data.org/v4";
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY || process.env.SPORTS_API_KEY },
  });
  const payload = await response.json();
  const rows = Array.isArray(payload.matches) ? payload.matches : [];
  console.log(`URL=${pathname} status=${response.status} count=${rows.length} resultSet=${JSON.stringify(payload.resultSet || {})}`);
  if (payload.error || !response.ok) console.log(`error=${JSON.stringify(payload)}`);
  if (rows.length) {
    const sample = JSON.stringify(rows[0]);
    console.log(`sample=${sample.slice(0, 700)}`);
  }
}

async function main() {
  loadEnv();
  if (process.env.FOOTBALL_DATA_ALLOW_INSECURE_TLS === "true" && process.env.NODE_ENV !== "production") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  if (!process.env.FOOTBALL_DATA_API_KEY && !process.env.SPORTS_API_KEY) {
    console.log("FOOTBALL_DATA_API_KEY is empty or missing in .env");
    return;
  }

  const competition = encodeURIComponent(process.env.FOOTBALL_DATA_COMPETITION || "WC");
  const season = encodeURIComponent(process.env.FOOTBALL_DATA_SEASON || "2026");
  const urls = [
    `/competitions/${competition}`,
    `/competitions/${competition}/matches?season=${season}`,
    `/competitions/${competition}/matches?season=${season}&dateFrom=2026-06-11&dateTo=2026-06-15`,
  ];

  for (const url of urls) {
    try {
      await probe(url);
    } catch (error) {
      const cause = error.cause ? ` cause=${error.cause.code || error.cause.message || error.cause}` : "";
      console.log(`URL=${url} ERROR=${error.message}${cause}`);
    }
  }
}

main();

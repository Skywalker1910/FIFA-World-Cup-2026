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
  const baseUrl = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
  });
  const payload = await response.json();
  const rows = Array.isArray(payload.response) ? payload.response : [];
  console.log(`URL=${pathname} status=${response.status} count=${rows.length} errors=${JSON.stringify(payload.errors || {})}`);
  if (rows.length) {
    const sample = JSON.stringify(rows[0]);
    console.log(`sample=${sample.slice(0, 700)}`);
  }
}

async function probeDateMatches(date) {
  const baseUrl = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
  const response = await fetch(`${baseUrl}/fixtures?date=${date}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
  });
  const payload = await response.json();
  const rows = Array.isArray(payload.response) ? payload.response : [];
  const hits = rows.filter((item) => {
    const text = [
      item.league?.id,
      item.league?.name,
      item.teams?.home?.name,
      item.teams?.away?.name,
    ].join(" ");
    return item.league?.id === 1 || /World Cup|Haiti|Scotland|Germany|Cura|Japan|Netherlands|Ecuador|Ivoire/i.test(text);
  });
  console.log(`dateProbe=${date} total=${rows.length} worldCupOrTeamHits=${hits.length}`);
  if (hits.length) {
    console.log(JSON.stringify(hits.slice(0, 5).map((item) => ({
      league: item.league,
      home: item.teams?.home?.name,
      away: item.teams?.away?.name,
      status: item.fixture?.status,
      goals: item.goals,
    })), null, 2));
  }
}

async function main() {
  loadEnv();
  if (process.env.API_FOOTBALL_ALLOW_INSECURE_TLS === "true" && process.env.NODE_ENV !== "production") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  if (!process.env.API_FOOTBALL_KEY) {
    console.log("API_FOOTBALL_KEY is empty or missing in .env");
    return;
  }

  const league = encodeURIComponent(process.env.API_FOOTBALL_LEAGUE || "1");
  const season = encodeURIComponent(process.env.API_FOOTBALL_SEASON || "2026");
  const urls = [
    "/status",
    "/leagues?search=World%20Cup",
    `/fixtures?league=${league}&season=${season}`,
    `/fixtures?league=${league}&season=${season}&date=2026-06-13`,
    "/fixtures?date=2026-06-13",
  ];

  for (const url of urls) {
    try {
      await probe(url);
    } catch (error) {
      const cause = error.cause ? ` cause=${error.cause.code || error.cause.message || error.cause}` : "";
      console.log(`URL=${url} ERROR=${error.message}${cause}`);
    }
  }

  for (const date of ["2026-06-13", "2026-06-14", "2026-06-15"]) {
    try {
      await probeDateMatches(date);
    } catch (error) {
      const cause = error.cause ? ` cause=${error.cause.code || error.cause.message || error.cause}` : "";
      console.log(`dateProbe=${date} ERROR=${error.message}${cause}`);
    }
  }
}

main();

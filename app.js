const PLAYERS = [];
const PICK_OPTIONS = ["", "Team 1", "Team 2", "Draw"];
const TEAM_FLAGS = {
  Algeria: "dz", Argentina: "ar", Australia: "au", Austria: "at", Belgium: "be",
  "Bosnia & Herzegovina": "ba", Brazil: "br", "Cabo Verde": "cv", Canada: "ca",
  Colombia: "co", "Congo DR": "cd", Croatia: "hr", "Curaçao": "cw", Czechia: "cz",
  "Côte d'Ivoire": "ci", Ecuador: "ec", Egypt: "eg", England: "gb-eng", France: "fr",
  Germany: "de", Ghana: "gh", Haiti: "ht", "IR Iran": "ir", Iraq: "iq", Japan: "jp",
  Jordan: "jo", "Korea Republic": "kr", Mexico: "mx", Morocco: "ma", Netherlands: "nl",
  "New Zealand": "nz", Norway: "no", Panama: "pa", Paraguay: "py", Portugal: "pt",
  Qatar: "qa", "Saudi Arabia": "sa", Scotland: "gb-sct", Senegal: "sn",
  "South Africa": "za", Spain: "es", Sweden: "se", Switzerland: "ch", Tunisia: "tn",
  "Türkiye": "tr", USA: "us", Uruguay: "uy", Uzbekistan: "uz",
};

let app = { user: null, state: null };
const refreshIntervalMs = 60 * 1000;

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  viewTitle: document.querySelector("#viewTitle"),
  accountLabel: document.querySelector("#accountLabel"),
  logoutButton: document.querySelector("#logoutButton"),
  loginPanel: document.querySelector("#loginPanel"),
  loginForm: document.querySelector("#loginForm"),
  metrics: document.querySelector("#metrics"),
  leaderboard: document.querySelector("#leaderboard"),
  leaderLabel: document.querySelector("#leaderLabel"),
  recentSettlements: document.querySelector("#recentSettlements"),
  settlementCount: document.querySelector("#settlementCount"),
  matchBoard: document.querySelector("#matchBoard"),
  matchBoardLabel: document.querySelector("#matchBoardLabel"),
  liveScores: document.querySelector("#liveScores"),
  liveScoresLabel: document.querySelector("#liveScoresLabel"),
  upcomingMatches: document.querySelector("#upcomingMatches"),
  upcomingLabel: document.querySelector("#upcomingLabel"),
  fixturesTable: document.querySelector("#fixturesTable"),
  playerCards: document.querySelector("#playerCards"),
  searchInput: document.querySelector("#searchInput"),
  stageFilter: document.querySelector("#stageFilter"),
  groupFilter: document.querySelector("#groupFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  loginToggleButton: document.querySelector("#loginToggleButton"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "Request failed");
  return payload;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value || 0);
}

function dateLabel(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function initials(team) {
  return String(team || "?").replace(/[()]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

function teamBadge(team, options = {}) {
  const code = TEAM_FLAGS[team];
  const size = options.compact ? "compact" : "";
  const safeTeam = escapeHtml(team);
  if (code) {
    return `<span class="team-badge ${size}" title="${safeTeam}"><img src="https://flagcdn.com/${code}.svg" alt="" loading="lazy" onerror="this.closest('.team-badge').classList.add('flag-failed')"><span class="team-initials">${escapeHtml(initials(team))}</span><span>${safeTeam}</span></span>`;
  }
  return `<span class="team-badge placeholder ${size}" title="${safeTeam}"><span class="team-initials">${escapeHtml(initials(team))}</span><span>${safeTeam}</span></span>`;
}

function resultLabel(fixture, pick) {
  if (pick === "Team 1") return fixture.team1;
  if (pick === "Team 2") return fixture.team2;
  if (pick === "Draw") return "Draw";
  return "Pending";
}

function getBets(fixture) {
  return Object.entries(fixture.bets || {}).filter(([, pick]) => pick);
}

function settlement(fixture) {
  const bets = getBets(fixture);
  const correct = fixture.result ? bets.filter(([, pick]) => pick === fixture.result) : [];
  const pool = bets.length * Number(app.state?.settings?.stake || 1);
  const payoutEach = fixture.result && correct.length ? pool / correct.length : 0;
  return {
    settled: Boolean(fixture.result),
    pool,
    correct,
    rollover: fixture.result ? pool - correct.length * payoutEach : 0,
  };
}

function hasScore(fixture) {
  return fixture.team1Score !== null
    && fixture.team1Score !== undefined
    && fixture.team2Score !== null
    && fixture.team2Score !== undefined;
}

function scoreText(fixture) {
  return hasScore(fixture) ? `${fixture.team1Score} - ${fixture.team2Score}` : "-";
}

function optionList(selected, labels = PICK_OPTIONS) {
  return labels.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value || "-"}</option>`).join("");
}

function renderAccount() {
  const user = app.user;
  elements.accountLabel.textContent = user ? `${user.display_name} (${user.role})` : "Not signed in";
  elements.loginPanel.style.display = user ? "none" : "";
  elements.logoutButton.style.display = user ? "" : "none";
  elements.loginToggleButton.textContent = user ? user.display_name : "Login";
}

function renderMetrics() {
  const fixtures = app.state.fixtures;
  const rows = fixtures.map(settlement);
  const metrics = [
    ["Matches", fixtures.length],
    ["Settled", rows.filter((row) => row.settled).length],
    ["Total Pool", money(rows.reduce((sum, row) => sum + row.pool, 0))],
    ["Rollover", money(rows.reduce((sum, row) => sum + row.rollover, 0))],
    ["Players", app.state.players.length],
  ];
  elements.metrics.innerHTML = metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderLeaderboard() {
  const rows = app.state.leaderboard || [];
  const leader = rows[0];
  elements.leaderLabel.textContent = leader ? `${leader.display_name} leads at ${money(leader.net)}` : "No players yet";
  elements.leaderboard.innerHTML = rows.length ? rows.map((row, index) => `
    <div class="leader-row">
      <div class="rank">${index + 1}</div>
      <div>
        <strong>${escapeHtml(row.display_name)}</strong>
        <div class="fixture-subtext">${row.correct}/${row.settled} correct, ${row.bets_entered} bets</div>
      </div>
      <strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${money(row.net)}</strong>
    </div>
  `).join("") : `<div class="empty-state">No player accounts yet.</div>`;
}

function renderRecentSettlements() {
  const scored = app.state.fixtures.filter((fixture) => fixture.result || hasScore(fixture)).slice(-6).reverse();
  elements.settlementCount.textContent = `${scored.length} shown`;
  elements.recentSettlements.innerHTML = scored.length ? scored.map((fixture) => `
    <div class="compact-item">
      <div>
        <strong>#${fixture.id}</strong>
        <div class="mini-teams">${teamBadge(fixture.team1, { compact: true })}${teamBadge(fixture.team2, { compact: true })}</div>
        <small>${fixture.result ? `${resultLabel(fixture, fixture.result)} won` : escapeHtml(fixture.status || "Score updated")}</small>
      </div>
      <strong>${scoreText(fixture)}</strong>
    </div>
  `).join("") : `<div class="empty-state">No scored matches yet.</div>`;
}

function renderMatchBoard() {
  const open = app.state.fixtures.filter((fixture) => !fixture.result).slice(0, 6);
  const matches = open.length ? open : app.state.fixtures.filter((fixture) => fixture.result).slice(-6).reverse();
  elements.matchBoardLabel.textContent = open.length ? "Next open matches" : "Latest results";
  elements.matchBoard.innerHTML = matches.map((fixture) => `
    <article class="match-card">
      <div class="match-card-meta"><span>#${fixture.id}</span><span>${dateLabel(fixture.date)}</span></div>
      <div class="match-card-teams">${teamBadge(fixture.team1)}<span class="versus">vs</span>${teamBadge(fixture.team2)}</div>
      <div class="match-card-footer"><span>${fixture.locked ? "Locked" : fixture.kickoff || "TBD"}</span><strong>${hasScore(fixture) ? scoreText(fixture) : fixture.result ? resultLabel(fixture, fixture.result) : money(settlement(fixture).pool)}</strong></div>
    </article>
  `).join("");
}

function matchStartTime(fixture) {
  return fixture.kickoffAt ? new Date(fixture.kickoffAt).getTime() : Number.POSITIVE_INFINITY;
}

function renderLiveScores() {
  const now = Date.now();
  const liveWindow = 2.5 * 60 * 60 * 1000;
  const matches = app.state.fixtures
    .filter((fixture) => {
      const start = matchStartTime(fixture);
      return hasScore(fixture) && Number.isFinite(start) && start <= now && now <= start + liveWindow;
    })
    .slice(0, 6);
  const fallback = app.state.fixtures.filter((fixture) => fixture.result || hasScore(fixture)).slice(-6).reverse();
  const rows = matches.length ? matches : fallback;
  elements.liveScoresLabel.textContent = matches.length ? "Ongoing now" : "Latest scores";
  elements.liveScores.innerHTML = rows.length ? rows.map((fixture) => `
    <article class="live-score-card">
      <div class="match-card-meta"><span>#${fixture.id}</span><span>${escapeHtml(fixture.status || (matches.length ? "Live" : "Final"))}</span></div>
      <div class="score-line">${teamBadge(fixture.team1)}<strong>${fixture.team1Score ?? "-"}</strong></div>
      <div class="score-line">${teamBadge(fixture.team2)}<strong>${fixture.team2Score ?? "-"}</strong></div>
      <div class="match-card-footer"><span>${dateLabel(fixture.date)} ${escapeHtml(fixture.kickoff || "")}</span><strong>${fixture.result ? resultLabel(fixture, fixture.result) : escapeHtml(fixture.status || "In progress")}</strong></div>
    </article>
  `).join("") : `<div class="empty-state">No synced scores yet.</div>`;
}

function renderUpcomingMatches() {
  const now = Date.now();
  const rows = app.state.fixtures
    .filter((fixture) => !fixture.result && matchStartTime(fixture) > now)
    .sort((a, b) => matchStartTime(a) - matchStartTime(b))
    .slice(0, 8);
  elements.upcomingLabel.textContent = `${rows.length} next`;
  elements.upcomingMatches.innerHTML = rows.length ? rows.map((fixture) => `
    <article class="match-card">
      <div class="match-card-meta"><span>#${fixture.id}</span><span>${dateLabel(fixture.date)}</span></div>
      <div class="match-card-teams">${teamBadge(fixture.team1)}<span class="versus">vs</span>${teamBadge(fixture.team2)}</div>
      <div class="match-card-footer"><span>${escapeHtml(fixture.venue || "")}</span><strong>${escapeHtml(fixture.kickoff || "TBD")}</strong></div>
    </article>
  `).join("") : `<div class="empty-state">No upcoming open matches.</div>`;
}

function renderFilters() {
  const stages = [...new Set(app.state.fixtures.map((fixture) => fixture.stage).filter(Boolean))];
  const groups = [...new Set(app.state.fixtures.map((fixture) => fixture.group).filter(Boolean))];
  const stageValue = elements.stageFilter.value || "all";
  const groupValue = elements.groupFilter.value || "all";
  elements.stageFilter.innerHTML = `<option value="all">All stages</option>${stages.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`).join("")}`;
  elements.groupFilter.innerHTML = `<option value="all">All groups</option>${groups.map((group) => `<option value="${escapeHtml(group)}">Group ${escapeHtml(group)}</option>`).join("")}`;
  elements.stageFilter.value = stageValue;
  elements.groupFilter.value = groupValue;
}

function filteredFixtures() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const stage = elements.stageFilter.value || "all";
  const group = elements.groupFilter.value || "all";
  const status = elements.statusFilter.value || "all";
  return app.state.fixtures.filter((fixture) => {
    const searchable = [fixture.id, fixture.team1, fixture.team2, fixture.venue, fixture.stage, fixture.group].join(" ").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (stage !== "all" && fixture.stage !== stage) return false;
    if (group !== "all" && fixture.group !== group) return false;
    if (status === "settled" && !fixture.result) return false;
    if (status === "open" && fixture.result) return false;
    if (status === "needs-picks" && fixture.myPick) return false;
    return true;
  });
}

function renderFixtures() {
  const isPlayer = app.user?.role === "player";
  elements.fixturesTable.innerHTML = filteredFixtures().map((fixture) => {
    const row = settlement(fixture);
    const canBet = isPlayer && !fixture.locked && !fixture.result;
    return `
      <tr data-id="${fixture.id}">
        <td><strong>#${fixture.id}</strong><div class="fixture-subtext">${escapeHtml(fixture.stage || "")}${fixture.group ? ` / Group ${escapeHtml(fixture.group)}` : ""}</div></td>
        <td><strong>${dateLabel(fixture.date)}</strong><div class="fixture-subtext">${escapeHtml(fixture.kickoff || "")}</div></td>
        <td><div class="team-line">${teamBadge(fixture.team1)}</div><div class="team-line">${teamBadge(fixture.team2)}</div><div class="fixture-subtext">${escapeHtml(fixture.venue || "")}</div></td>
        <td><strong>${fixture.team1Score ?? "-"} - ${fixture.team2Score ?? "-"}</strong></td>
        <td>${fixture.result ? resultLabel(fixture, fixture.result) : fixture.locked ? "Locked" : "Open"}</td>
        <td colspan="3">
          <select data-bet ${canBet ? "" : "disabled"}>${optionList(fixture.myPick)}</select>
          <div class="fixture-subtext">${canBet ? "Place or update your pick" : fixture.myPick ? `Your pick: ${resultLabel(fixture, fixture.myPick)}` : "Login as player before lock"}</div>
        </td>
        <td><strong>${money(row.pool)}</strong><div class="fixture-subtext">${getBets(fixture).length} bets</div></td>
        <td><strong>${money(row.rollover)}</strong></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="10"><div class="empty-state">No matches match the current filters.</div></td></tr>`;
}

function renderPlayers() {
  elements.playerCards.innerHTML = (app.state.leaderboard || []).map((row, index) => `
    <article class="player-card">
      <h3>${index + 1}. ${escapeHtml(row.display_name)}</h3>
      <div class="player-stat"><span>Net</span><strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${money(row.net)}</strong></div>
      <div class="player-stat"><span>Total payout</span><strong>${money(row.payout)}</strong></div>
      <div class="player-stat"><span>Correct picks</span><strong>${row.correct}</strong></div>
      <div class="player-stat"><span>Settled bets</span><strong>${row.settled}</strong></div>
      <div class="player-stat"><span>Bets entered</span><strong>${row.bets_entered}</strong></div>
      <div class="player-stat"><span>ROI</span><strong>${Math.round(row.roi * 100)}%</strong></div>
    </article>
  `).join("") || `<div class="empty-state">No public player profiles yet.</div>`;
}

function renderAll() {
  renderAccount();
  if (!app.state) return;
  renderFilters();
  renderMetrics();
  renderLiveScores();
  renderUpcomingMatches();
  renderLeaderboard();
  renderRecentSettlements();
  renderMatchBoard();
  renderFixtures();
  renderPlayers();
}

async function refresh() {
  const [me, state] = await Promise.all([api("/api/me"), api("/api/state")]);
  app.user = me.user;
  app.state = state;
  const sync = state.sync;
  elements.saveStatus.textContent = sync?.enabled
    ? sync.error
      ? `Sync error: ${sync.error}`
      : sync.running
      ? "Syncing scores..."
      : sync.lastSuccessAt
        ? `Scores synced ${new Date(sync.lastSuccessAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (${sync.updated || 0} updated)`
        : "Score sync enabled"
    : "Database connected";
  renderAll();
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}View`).classList.add("active");
    elements.viewTitle.textContent = button.textContent;
  });
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(elements.loginForm));
  await api("/api/login", { method: "POST", body: JSON.stringify(data) });
  elements.loginForm.reset();
  await refresh();
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  await refresh();
});

elements.loginToggleButton.addEventListener("click", () => {
  if (app.user) return;
  elements.loginPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

[elements.searchInput, elements.stageFilter, elements.groupFilter, elements.statusFilter].forEach((element) => {
  element.addEventListener("input", renderFixtures);
});

elements.fixturesTable.addEventListener("change", async (event) => {
  if (!event.target.dataset.bet) return;
  const row = event.target.closest("tr[data-id]");
  if (!row || !event.target.value) return;
  const payload = await api("/api/bets", { method: "POST", body: JSON.stringify({ matchId: Number(row.dataset.id), pick: event.target.value }) });
  app.state = payload.state;
  renderAll();
});

refresh().catch((error) => {
  elements.saveStatus.textContent = error.message;
  console.error(error);
});

setInterval(() => {
  refresh().catch((error) => console.error(error));
}, refreshIntervalMs);

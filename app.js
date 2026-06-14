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
let loginPanelOpen = false;
let profilePanelOpen = false;
let profileAvatarData = "";
const refreshIntervalMs = 60 * 1000;

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  viewTitle: document.querySelector("#viewTitle"),
  accountLabel: document.querySelector("#accountLabel"),
  profileButton: document.querySelector("#profileButton"),
  logoutButton: document.querySelector("#logoutButton"),
  loginPanel: document.querySelector("#loginPanel"),
  loginCloseButton: document.querySelector("#loginCloseButton"),
  loginForm: document.querySelector("#loginForm"),
  profilePanel: document.querySelector("#profilePanel"),
  profileCloseButton: document.querySelector("#profileCloseButton"),
  profileForm: document.querySelector("#profileForm"),
  profileAvatarInput: document.querySelector("#profileAvatarInput"),
  profileAvatarPreview: document.querySelector("#profileAvatarPreview"),
  metrics: document.querySelector("#metrics"),
  leaderboard: document.querySelector("#leaderboard"),
  playersLeaderboard: document.querySelector("#playersLeaderboard"),
  leaderLabel: document.querySelector("#leaderLabel"),
  recentSettlements: document.querySelector("#recentSettlements"),
  settlementCount: document.querySelector("#settlementCount"),
  matchBoard: document.querySelector("#matchBoard"),
  matchBoardLabel: document.querySelector("#matchBoardLabel"),
  liveScores: document.querySelector("#liveScores"),
  liveTicker: document.querySelector("#liveTicker"),
  liveScoresLabel: document.querySelector("#liveScoresLabel"),
  upcomingMatches: document.querySelector("#upcomingMatches"),
  upcomingLabel: document.querySelector("#upcomingLabel"),
  fixturesTable: document.querySelector("#fixturesTable"),
  playerCards: document.querySelector("#playerCards"),
  allFixtures: document.querySelector("#allFixtures"),
  allFixturesLabel: document.querySelector("#allFixturesLabel"),
  groupTables: document.querySelector("#groupTables"),
  roadmap: document.querySelector("#roadmap"),
  roadmapLabel: document.querySelector("#roadmapLabel"),
  searchInput: document.querySelector("#searchInput"),
  stageFilter: document.querySelector("#stageFilter"),
  groupFilter: document.querySelector("#groupFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  adminSwitchButton: document.querySelector("#adminSwitchButton"),
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

function avatarHtml(user, className = "avatar") {
  if (user?.avatar_data) {
    return `<img class="${className}" src="${escapeHtml(user.avatar_data)}" alt="${escapeHtml(user.display_name)} profile picture">`;
  }
  const initials = String(user?.display_name || user?.login_id || "26")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "26";
  return `<span class="${className} avatar-fallback">${escapeHtml(initials)}</span>`;
}

function icon(name) {
  return `<i class="inline-icon" data-lucide="${escapeHtml(name)}"></i>`;
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

function countdownText(fixture) {
  const start = matchStartTime(fixture);
  if (!Number.isFinite(start)) return "Schedule TBD";
  const diff = start - Date.now();
  if (fixture.result || isFinalFixture(fixture)) return "Final";
  if (diff <= 0) return hasScore(fixture) ? "Live now" : "In progress";
  const totalMinutes = Math.ceil(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m`;
}

function fixtureStatusLabel(fixture) {
  if (fixture.result || isFinalFixture(fixture)) return "Final";
  if (fixture.locked) return "Locked";
  if (hasScore(fixture)) return fixture.status || "Live";
  return "Open";
}

function matchMetaChips(fixture) {
  const chips = [
    fixture.group ? `Group ${fixture.group}` : fixture.stage,
    fixtureStatusLabel(fixture),
    countdownText(fixture),
  ].filter(Boolean);
  return `<div class="match-chip-row">${chips.map((chip) => `<span class="match-chip">${escapeHtml(chip)}</span>`).join("")}</div>`;
}

function resolvedResult(fixture) {
  if (fixture.result) return fixture.result;
  if (!hasScore(fixture)) return "";
  if (Number(fixture.team1Score) > Number(fixture.team2Score)) return "Team 1";
  if (Number(fixture.team2Score) > Number(fixture.team1Score)) return "Team 2";
  return "Draw";
}

function fixtureById(id) {
  return app.state?.fixtures.find((fixture) => Number(fixture.id) === Number(id));
}

function fixtureTeamByOutcome(id, outcome) {
  const fixture = fixtureById(id);
  if (!fixture || !isFinalFixture(fixture)) return "";
  const result = resolvedResult(fixture);
  if (result === "Draw") return "";
  if (outcome === "winner") return result === "Team 1" ? fixture.team1 : fixture.team2;
  return result === "Team 1" ? fixture.team2 : fixture.team1;
}

function displayTeamName(team) {
  const winnerMatch = String(team || "").match(/^Winner Match (\d+)$/i);
  if (winnerMatch) return fixtureTeamByOutcome(winnerMatch[1], "winner") || team;
  const loserMatch = String(team || "").match(/^Loser Match (\d+)$/i);
  if (loserMatch) return fixtureTeamByOutcome(loserMatch[1], "loser") || team;
  return team;
}

function isFinalFixture(fixture) {
  const status = String(fixture.status || "").toUpperCase();
  return Boolean(fixture.result) || ["FT", "AET", "PEN"].includes(status);
}

function optionList(selected, labels = PICK_OPTIONS) {
  return labels.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value || "-"}</option>`).join("");
}

function renderAccount() {
  const user = app.user;
  elements.accountLabel.textContent = user ? `${user.display_name} (${user.role})` : "Not signed in";
  elements.loginPanel.hidden = Boolean(user) || !loginPanelOpen;
  elements.profilePanel.hidden = !user || !profilePanelOpen;
  elements.profileButton.hidden = !user;
  elements.logoutButton.style.display = user ? "" : "none";
  elements.adminSwitchButton.hidden = user?.role !== "admin";
  elements.loginToggleButton.innerHTML = `<i data-lucide="${user ? "user-round" : "log-in"}"></i>${escapeHtml(user ? user.display_name : "Login")}`;
  window.lucide?.createIcons();
}

function openProfilePanel() {
  if (!app.user) return;
  profilePanelOpen = true;
  profileAvatarData = app.user.avatar_data || "";
  elements.profileForm.displayName.value = app.user.display_name || "";
  elements.profileForm.loginId.value = app.user.login_id || "";
  elements.profileForm.password.value = "";
  renderProfileAvatarPreview();
  renderAccount();
  elements.profileForm.displayName.focus({ preventScroll: true });
}

function closeProfilePanel() {
  profilePanelOpen = false;
  renderAccount();
  elements.profileButton.focus({ preventScroll: true });
}

function renderProfileAvatarPreview() {
  if (profileAvatarData) {
    elements.profileAvatarPreview.innerHTML = `<img src="${escapeHtml(profileAvatarData)}" alt="">`;
    return;
  }
  elements.profileAvatarPreview.textContent = "26";
}

function renderMetrics() {
  const fixtures = app.state.fixtures;
  const rows = fixtures.map(settlement);
  const metrics = [
    ["trophy", "Matches", fixtures.length],
    ["badge-check", "Settled", rows.filter((row) => row.settled).length],
    ["coins", "Total Pool", money(rows.reduce((sum, row) => sum + row.pool, 0))],
    ["refresh-ccw", "Rollover", money(rows.reduce((sum, row) => sum + row.rollover, 0))],
    ["users-round", "Players", app.state.players.length],
  ];
  elements.metrics.innerHTML = metrics.map(([icon, label, value]) => `
    <div class="metric">
      <span class="metric-label"><i data-lucide="${icon}"></i>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
  window.lucide?.createIcons();
}

function renderLeaderboard() {
  const rows = app.state.leaderboard || [];
  const leader = rows[0];
  elements.leaderLabel.textContent = leader ? `${leader.display_name} leads at ${money(leader.net)}` : "No players yet";
  elements.leaderboard.innerHTML = rows.length ? rows.map((row, index) => `
    <div class="leader-row">
      <div class="rank">${index + 1}</div>
      ${avatarHtml(row, "avatar avatar-small")}
      <div>
        <strong>${escapeHtml(row.display_name)}</strong>
        <div class="fixture-subtext stat-line">
          <span>${icon("medal")}Rank #${index + 1}</span>
          <span>${icon("target")} ${row.settled ? Math.round((row.correct / row.settled) * 100) : 0}% accuracy</span>
          <span>${icon("flame")} ${row.correct} correct</span>
        </div>
      </div>
      <strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${money(row.net)}</strong>
    </div>
  `).join("") : `<div class="empty-state">No player accounts yet.</div>`;
  window.lucide?.createIcons();
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
      ${matchMetaChips(fixture)}
      <div class="match-card-teams">${teamBadge(fixture.team1)}<span class="versus">vs</span>${teamBadge(fixture.team2)}</div>
      <div class="match-card-footer"><span>${icon("map-pin")} ${escapeHtml(fixture.venue || "Venue TBD")}</span><strong>${hasScore(fixture) ? scoreText(fixture) : fixture.result ? resultLabel(fixture, fixture.result) : money(settlement(fixture).pool)}</strong></div>
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
      ${matchMetaChips(fixture)}
      <div class="score-line">${teamBadge(fixture.team1)}<strong>${fixture.team1Score ?? "-"}</strong></div>
      <div class="score-line">${teamBadge(fixture.team2)}<strong>${fixture.team2Score ?? "-"}</strong></div>
      <div class="match-card-footer"><span>${dateLabel(fixture.date)} ${escapeHtml(fixture.kickoff || "")}</span><strong>${fixture.result ? resultLabel(fixture, fixture.result) : escapeHtml(fixture.status || "In progress")}</strong></div>
    </article>
  `).join("") : `<div class="empty-state">No synced scores yet.</div>`;
  elements.liveTicker.innerHTML = rows.length ? `
    <div class="ticker-track">
      ${[...rows, ...rows].map((fixture) => `
        <span class="ticker-item">
          <strong>#${fixture.id}</strong>
          ${escapeHtml(fixture.team1)} ${fixture.team1Score ?? "-"} — ${fixture.team2Score ?? "-"} ${escapeHtml(fixture.team2)}
          <em>${escapeHtml(fixtureStatusLabel(fixture))}</em>
        </span>
      `).join("")}
    </div>
  ` : "";
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
      ${matchMetaChips(fixture)}
      <div class="match-card-teams">${teamBadge(fixture.team1)}<span class="versus">vs</span>${teamBadge(fixture.team2)}</div>
      <div class="match-card-footer"><span>${icon("map-pin")} ${escapeHtml(fixture.venue || "Venue TBD")}</span><strong>${escapeHtml(fixture.kickoff || "TBD")}</strong></div>
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
    const betStatus = fixture.result || isFinalFixture(fixture) ? "Ended" : fixture.locked ? "Locked" : "Open";
    const resultText = fixture.result ? resultLabel(fixture, fixture.result) : "---";
    return `
      <tr data-id="${fixture.id}">
        <td><strong>#${fixture.id}</strong><div class="fixture-subtext">${escapeHtml(fixture.stage || "")}${fixture.group ? ` / Group ${escapeHtml(fixture.group)}` : ""}</div></td>
        <td><strong>${dateLabel(fixture.date)}</strong><div class="fixture-subtext">${escapeHtml(fixture.kickoff || "")}</div></td>
        <td><div class="team-line">${teamBadge(fixture.team1)}</div><div class="team-line">${teamBadge(fixture.team2)}</div><div class="fixture-subtext">${escapeHtml(fixture.venue || "")}</div></td>
        <td><strong>${fixture.team1Score ?? "-"} - ${fixture.team2Score ?? "-"}</strong></td>
        <td>${escapeHtml(resultText)}</td>
        <td><span class="status-badge status-${betStatus.toLowerCase()}">${escapeHtml(betStatus)}</span></td>
        <td>
          <select data-bet ${canBet ? "" : "disabled"}>${optionList(fixture.myPick)}</select>
          <div class="fixture-subtext">${canBet ? "Place or update your pick" : fixture.myPick ? `Your pick: ${resultLabel(fixture, fixture.myPick)}` : "Login as player before lock"}</div>
        </td>
        <td><strong>${money(row.pool)}</strong><div class="fixture-subtext">${getBets(fixture).length} bets</div></td>
        <td><strong>${money(row.rollover)}</strong></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="9"><div class="empty-state">No matches match the current filters.</div></td></tr>`;
}

function renderPlayers() {
  const rows = app.state.leaderboard || [];
  elements.playersLeaderboard.innerHTML = rows.length ? rows.map((row, index) => `
    <div class="leader-row">
      <div class="rank">${index + 1}</div>
      ${avatarHtml(row, "avatar avatar-small")}
      <div>
        <strong>${escapeHtml(row.display_name)}</strong>
        <div class="fixture-subtext">${row.correct}/${row.settled} correct, ${row.bets_entered} bets entered</div>
      </div>
      <strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${money(row.net)}</strong>
    </div>
  `).join("") : `<div class="empty-state">No player rankings yet.</div>`;
  elements.playerCards.innerHTML = (app.state.leaderboard || []).map((row, index) => `
    <article class="player-card">
      <div class="player-card-header">
        ${avatarHtml(row, "avatar avatar-large")}
        <h3>${index + 1}. ${escapeHtml(row.display_name)}</h3>
      </div>
      <div class="player-badge-row">
        <span class="player-badge">${icon("medal")}Rank #${index + 1}</span>
        <span class="player-badge">${icon("target")}${row.settled ? Math.round((row.correct / row.settled) * 100) : 0}% Accuracy</span>
        <span class="player-badge">${icon("flame")}${row.correct} Correct Picks</span>
      </div>
      <div class="player-stat"><span>Net</span><strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${money(row.net)}</strong></div>
      <div class="player-stat"><span>Total payout</span><strong>${money(row.payout)}</strong></div>
      <div class="player-stat"><span>Correct picks</span><strong>${row.correct}</strong></div>
      <div class="player-stat"><span>Settled bets</span><strong>${row.settled}</strong></div>
      <div class="player-stat"><span>Bets entered</span><strong>${row.bets_entered}</strong></div>
      <div class="player-stat"><span>ROI</span><strong>${Math.round(row.roi * 100)}%</strong></div>
    </article>
  `).join("") || `<div class="empty-state">No public player profiles yet.</div>`;
  window.lucide?.createIcons();
}

function renderAllFixtures() {
  const fixtures = [...app.state.fixtures].sort((a, b) => {
    const dateSort = matchStartTime(a) - matchStartTime(b);
    return Number.isFinite(dateSort) && dateSort !== 0 ? dateSort : a.id - b.id;
  });
  elements.allFixturesLabel.textContent = `${fixtures.length} matches`;
  elements.allFixtures.innerHTML = fixtures.map((fixture) => `
    <article class="tournament-fixture-card ${fixture.result ? "is-final" : ""}">
      <div class="match-card-meta">
        <span>#${fixture.id} ${escapeHtml(fixture.stage || "")}${fixture.group ? ` / Group ${escapeHtml(fixture.group)}` : ""}</span>
        <span>${dateLabel(fixture.date)} ${escapeHtml(fixture.kickoff || "")}</span>
      </div>
      <div class="fixture-card-body">
        <div>
          <div class="score-line">${teamBadge(fixture.team1)}<strong>${fixture.team1Score ?? "-"}</strong></div>
          <div class="score-line">${teamBadge(fixture.team2)}<strong>${fixture.team2Score ?? "-"}</strong></div>
        </div>
        <div class="fixture-status">
          <strong>${fixture.result ? resultLabel(fixture, fixture.result) : hasScore(fixture) ? escapeHtml(fixture.status || "Score updated") : "Not started"}</strong>
          <span>${escapeHtml(fixture.venue || "")}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function emptyStanding(team) {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

function groupStandings() {
  const groups = new Map();
  app.state.fixtures
    .filter((fixture) => fixture.group)
    .forEach((fixture) => {
      if (!groups.has(fixture.group)) groups.set(fixture.group, new Map());
      const table = groups.get(fixture.group);
      if (!table.has(fixture.team1)) table.set(fixture.team1, emptyStanding(fixture.team1));
      if (!table.has(fixture.team2)) table.set(fixture.team2, emptyStanding(fixture.team2));
      if (!hasScore(fixture) || !isFinalFixture(fixture)) return;

      const home = table.get(fixture.team1);
      const away = table.get(fixture.team2);
      const homeGoals = Number(fixture.team1Score);
      const awayGoals = Number(fixture.team2Score);
      home.played += 1;
      away.played += 1;
      home.gf += homeGoals;
      home.ga += awayGoals;
      away.gf += awayGoals;
      away.ga += homeGoals;

      if (homeGoals > awayGoals) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (awayGoals > homeGoals) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;
    });

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, table]) => ({
    group,
    rows: [...table.values()].sort((a, b) =>
      b.points - a.points
      || b.gd - a.gd
      || b.gf - a.gf
      || a.team.localeCompare(b.team)
    ),
  }));
}

function renderGroupTables() {
  elements.groupTables.innerHTML = groupStandings().map(({ group, rows }) => `
    <article class="group-table-card">
      <h3>Group ${escapeHtml(group)}</h3>
      <table class="standings-table">
        <thead>
          <tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => `
            <tr class="${index < 2 ? "qualifier-row" : ""}">
              <td>${teamBadge(row.team, { compact: true })}</td>
              <td>${row.played}</td>
              <td>${row.won}</td>
              <td>${row.drawn}</td>
              <td>${row.lost}</td>
              <td>${row.gd > 0 ? `+${row.gd}` : row.gd}</td>
              <td><strong>${row.points}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </article>
  `).join("");
}

function renderRoadmap() {
  const stageOrder = ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Third-Place Match", "Final"];
  const knockout = stageOrder
    .map((stage) => ({
      stage,
      fixtures: app.state.fixtures.filter((fixture) => fixture.stage === stage),
    }))
    .filter((round) => round.fixtures.length);
  elements.roadmapLabel.textContent = `${knockout.reduce((total, round) => total + round.fixtures.length, 0)} knockout matches`;
  elements.roadmap.innerHTML = knockout.map((round) => `
    <section class="bracket-round">
      <div class="bracket-round-title">
        <h3>${escapeHtml(round.stage)}</h3>
        <span>${round.fixtures.length} matches</span>
      </div>
      <div class="bracket-match-list">
        ${round.fixtures.map((fixture) => `
          <article class="bracket-match ${fixture.result ? "is-final" : ""}">
            <div class="match-card-meta"><span>#${fixture.id}</span><span>${dateLabel(fixture.date)}</span></div>
            <div class="bracket-teams">
              <div class="${resolvedResult(fixture) === "Team 1" ? "winner-team" : ""}">${teamBadge(displayTeamName(fixture.team1), { compact: true })}<strong>${fixture.team1Score ?? ""}</strong></div>
              <div class="${resolvedResult(fixture) === "Team 2" ? "winner-team" : ""}">${teamBadge(displayTeamName(fixture.team2), { compact: true })}<strong>${fixture.team2Score ?? ""}</strong></div>
            </div>
            <div class="bracket-match-footer">
              <span>${escapeHtml(fixture.kickoff || "")}</span>
              <strong>${fixture.result ? `${escapeHtml(resultLabel(fixture, fixture.result))} advances` : hasScore(fixture) ? escapeHtml(fixture.status || "In progress") : "Pending"}</strong>
            </div>
            <div class="fixture-subtext">${escapeHtml(fixture.venue || "")}</div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
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
  renderAllFixtures();
  renderGroupTables();
  renderRoadmap();
  window.lucide?.createIcons();
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
  loginPanelOpen = false;
  elements.loginForm.reset();
  await refresh();
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  profilePanelOpen = false;
  await refresh();
});

elements.profileButton.addEventListener("click", openProfilePanel);

elements.profileCloseButton.addEventListener("click", closeProfilePanel);

elements.profilePanel.addEventListener("click", (event) => {
  if (event.target !== elements.profilePanel) return;
  closeProfilePanel();
});

elements.profileAvatarInput.addEventListener("change", async () => {
  const file = elements.profileAvatarInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    elements.saveStatus.textContent = "Profile picture must be an image";
    elements.profileAvatarInput.value = "";
    return;
  }
  if (file.size > 550_000) {
    elements.saveStatus.textContent = "Profile picture must be smaller than 550 KB";
    elements.profileAvatarInput.value = "";
    return;
  }
  profileAvatarData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  renderProfileAvatarPreview();
});

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(elements.profileForm));
    const payload = await api("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: formData.displayName,
        loginId: formData.loginId,
        password: formData.password,
        avatarData: profileAvatarData,
      }),
    });
    app.user = payload.user;
    app.state = payload.state;
    profilePanelOpen = false;
    elements.saveStatus.textContent = "Profile updated";
    renderAll();
  } catch (error) {
    elements.saveStatus.textContent = error.message;
  }
});

elements.loginToggleButton.addEventListener("click", () => {
  if (app.user) return;
  loginPanelOpen = !loginPanelOpen;
  renderAccount();
  if (loginPanelOpen) {
    elements.loginPanel.querySelector("input")?.focus({ preventScroll: true });
  }
});

elements.loginCloseButton.addEventListener("click", () => {
  loginPanelOpen = false;
  renderAccount();
  elements.loginToggleButton.focus({ preventScroll: true });
});

elements.loginPanel.addEventListener("click", (event) => {
  if (event.target !== elements.loginPanel) return;
  loginPanelOpen = false;
  renderAccount();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!elements.profilePanel.hidden) {
    closeProfilePanel();
    return;
  }
  if (elements.loginPanel.hidden) return;
  loginPanelOpen = false;
  renderAccount();
  elements.loginToggleButton.focus({ preventScroll: true });
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

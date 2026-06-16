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
const GOLDEN_BOOT_OPTIONS = [
  "Kylian Mbappé", "Harry Kane", "Erling Haaland", "Lionel Messi", "Cristiano Ronaldo",
  "Vinícius Júnior", "Jude Bellingham", "Lamine Yamal", "Lautaro Martínez", "Julián Álvarez",
  "Raphinha", "Bukayo Saka", "Christian Pulisic", "Jonathan David", "Álvaro Morata",
];

let app = { user: null, state: null };
let loginPanelOpen = false;
let profilePanelOpen = false;
let profileAvatarData = "";
let selectedServer = localStorage.getItem("selectedServer") || "US";
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
  profilePageForm: document.querySelector("#profilePageForm"),
  profilePageAvatarInput: document.querySelector("#profilePageAvatarInput"),
  profilePageAvatarPreview: document.querySelector("#profilePageAvatarPreview"),
  profileLockNotice: document.querySelector("#profileLockNotice"),
  supportedTeamSelect: document.querySelector("#supportedTeamSelect"),
  goldenBootFields: document.querySelector("#goldenBootFields"),
  knockoutFields: document.querySelector("#knockoutFields"),
  predictionTables: document.querySelector("#predictionTables"),
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
  publicBetsHead: document.querySelector("#publicBetsHead"),
  publicBetsBody: document.querySelector("#publicBetsBody"),
  poolHeader: document.querySelector("#poolHeader"),
  rolloverHeader: document.querySelector("#rolloverHeader"),
  playerCards: document.querySelector("#playerCards"),
  allFixtures: document.querySelector("#allFixtures"),
  allFixturesLabel: document.querySelector("#allFixturesLabel"),
  groupTables: document.querySelector("#groupTables"),
  roadmap: document.querySelector("#roadmap"),
  roadmapLabel: document.querySelector("#roadmapLabel"),
  rulesLabel: document.querySelector("#rulesLabel"),
  rulesContent: document.querySelector("#rulesContent"),
  searchInput: document.querySelector("#searchInput"),
  stageFilter: document.querySelector("#stageFilter"),
  groupFilter: document.querySelector("#groupFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  serverSwitch: document.querySelector("#serverSwitch"),
  adminSwitchButton: document.querySelector("#adminSwitchButton"),
  loginToggleButton: document.querySelector("#loginToggleButton"),
  profileNavTab: document.querySelector(".profile-nav-tab"),
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

function scoringMode() {
  return app.state?.settings?.scoringMode || "money";
}

function scoreValue(value) {
  return scoringMode() === "points" ? `${Number(value || 0)} pts` : money(value);
}

function activeServer() {
  return app.state?.settings?.server || selectedServer || "US";
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
  return Object.entries(fixture.bets || {})
    .map(([userId, bet]) => [userId, typeof bet === "string" ? bet : bet?.pick || "", bet])
    .filter(([, pick]) => pick);
}

function settlement(fixture) {
  const bets = getBets(fixture);
  const correct = fixture.result ? bets.filter(([, pick]) => pick === fixture.result) : [];
  const pool = bets.length * Number(app.state?.settings?.stake || 1);
  const payoutEach = fixture.result && correct.length ? pool / correct.length : 0;
  if (scoringMode() === "points") {
    return {
      pool: correct.length,
      payoutEach: correct.length ? 1 : 0,
      rollover: 0,
      correct: correct.length,
      settled: Boolean(fixture.result),
    };
  }
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
  if (hasScore(fixture)) return displayStatusLabel(fixture.status || "Live");
  return "Open";
}

function displayStatusLabel(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized === "paused" || normalized === "pause" || normalized === "ht" || normalized.includes("half")) return "Half-Time";
  if (normalized === "in_play" || normalized === "in-play" || normalized === "in progress") return "Live";
  if (normalized === "ft" || normalized === "finished") return "Final";
  return label || "";
}

function statusBadgeClass(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("half") || normalized === "paused" || normalized === "pause" || normalized === "ht") return "half";
  if (normalized.includes("live") || normalized.includes("progress")) return "live";
  if (normalized.includes("locked")) return "locked";
  if (normalized.includes("open")) return "open";
  if (normalized.includes("ended") || normalized.includes("final") || normalized.includes("finished") || normalized === "ft") return "ended";
  return "neutral";
}

function statusBadge(label) {
  const value = displayStatusLabel(label) || "-";
  return `<span class="status-badge status-${statusBadgeClass(value)}">${escapeHtml(value)}</span>`;
}

function matchMetaChips(fixture) {
  const statusLabel = fixtureStatusLabel(fixture);
  const countdownLabel = countdownText(fixture);
  const countdownStatusClass = ["live", "half", "ended"].includes(statusBadgeClass(countdownLabel))
    ? `match-chip-status status-${statusBadgeClass(countdownLabel)}`
    : "";
  const chips = [
    { label: fixture.group ? `Group ${fixture.group}` : fixture.stage, className: "" },
    { label: statusLabel, className: `match-chip-status status-${statusBadgeClass(statusLabel)}` },
    { label: countdownLabel, className: countdownStatusClass },
  ].filter(Boolean);
  return `<div class="match-chip-row">${chips
    .filter((chip) => chip.label)
    .map((chip) => `<span class="match-chip ${chip.className}">${escapeHtml(chip.label)}</span>`)
    .join("")}</div>`;
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

function betOptionList(fixture, selected) {
  const options = [
    ["", "-"],
    ["Team 1", displayTeamName(fixture.team1)],
    ["Team 2", displayTeamName(fixture.team2)],
    ["Draw", "Draw"],
  ];
  return options.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function predictionValue(fixture, key) {
  const value = fixture.myPrediction?.[key];
  return value === null || value === undefined ? "" : value;
}

function renderAccount() {
  const user = app.user;
  const userServers = user?.servers || app.state?.settings?.servers || ["US"];
  elements.accountLabel.textContent = user ? `${user.display_name} (${user.role}) · ${activeServer()}` : `Viewing ${activeServer()}`;
  elements.loginPanel.hidden = Boolean(user) || !loginPanelOpen;
  elements.profilePanel.hidden = !user || !profilePanelOpen;
  if (elements.profileButton) elements.profileButton.hidden = !user;
  elements.profileNavTab.hidden = !user;
  elements.logoutButton.style.display = user ? "" : "none";
  elements.adminSwitchButton.hidden = user?.role !== "admin";
  elements.serverSwitch.hidden = user?.role === "player" && userServers.length <= 1;
  elements.serverSwitch.innerHTML = userServers.map((server) => `<option value="${escapeHtml(server)}">${escapeHtml(server)}</option>`).join("");
  elements.serverSwitch.value = activeServer();
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
  elements.profileButton?.focus({ preventScroll: true });
}

function renderProfileAvatarPreview() {
  if (profileAvatarData) {
    elements.profileAvatarPreview.innerHTML = `<img src="${escapeHtml(profileAvatarData)}" alt="">`;
    if (elements.profilePageAvatarPreview) elements.profilePageAvatarPreview.innerHTML = `<img src="${escapeHtml(profileAvatarData)}" alt="">`;
    return;
  }
  elements.profileAvatarPreview.textContent = "26";
  if (elements.profilePageAvatarPreview) elements.profilePageAvatarPreview.textContent = "26";
}

function teamOptions(selected = "") {
  const teams = [...new Set(app.state.fixtures
    .flatMap((fixture) => [displayTeamName(fixture.team1), displayTeamName(fixture.team2)])
    .filter((team) => team && !/^(winner|runner-up|runner up|loser)\s/i.test(team)))]
    .sort((a, b) => a.localeCompare(b));
  return `<option value="">Team you support</option>${teams.map((team) => `<option value="${escapeHtml(team)}" ${team === selected ? "selected" : ""}>${escapeHtml(team)}</option>`).join("")}`;
}

function predictionSelect(name, value = "", placeholder = "") {
  return `<select name="${escapeHtml(name)}" ${app.state?.settings?.predictionsLocked ? "disabled" : ""}>${teamOptions(value).replace("Team you support", placeholder)}</select>`;
}

function predictionLockText() {
  if (app.state?.settings?.predictionsLocked) return "Locked";
  const lockAt = new Date(app.state?.settings?.predictionLockAt || "2026-06-27T23:59:59-04:00");
  const totalMinutes = Math.max(0, Math.ceil((lockAt.getTime() - Date.now()) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  return `Open · locks in ${days}d ${hours}h`;
}

function renderProfilePage() {
  if (!app.user || !elements.profilePageForm) return;
  profileAvatarData = app.user.avatar_data || profileAvatarData || "";
  elements.profilePageForm.displayName.value = app.user.display_name || "";
  elements.profilePageForm.loginId.value = app.user.login_id || "";
  elements.profilePageForm.password.value = "";
  elements.profilePageForm.supportedPlayer.value = app.user.supported_player || "";
  elements.supportedTeamSelect.innerHTML = teamOptions(app.user.supported_team || "");
  elements.profileLockNotice.textContent = "Update your public profile, supporter details, and tournament predictions.";
  const golden = app.user.golden_boot_predictions || [];
  elements.goldenBootFields.innerHTML = Array.from({ length: 5 }, (_, index) => `
    <select name="goldenBoot${index + 1}" ${app.state.settings.predictionsLocked ? "disabled" : ""}>
      <option value="">Golden Boot pick ${index + 1}</option>
      ${GOLDEN_BOOT_OPTIONS.map((player) => `<option value="${escapeHtml(player)}" ${golden[index] === player ? "selected" : ""}>${escapeHtml(player)}</option>`).join("")}
    </select>
  `).join("");
  const knockout = app.user.knockout_predictions || {};
  elements.knockoutFields.innerHTML = [
    ["Quarterfinal predictions", "quarterfinalists", 8, "Quarterfinal team"],
    ["Semifinal predictions", "semifinalists", 4, "Semifinal team"],
    ["Final predictions", "finalists", 2, "Finalist"],
    ["Winner prediction", "winner", 1, "Tournament winner"],
  ].map(([title, key, count, label]) => `
    <section class="prediction-fieldset has-lock-tag">
      <span class="prediction-lock-tag ${app.state.settings.predictionsLocked ? "is-locked" : "is-open"}">${escapeHtml(predictionLockText())}</span>
      <h5>${escapeHtml(title)}</h5>
      <div class="form-grid">
        ${Array.from({ length: count }, (_, index) => key === "winner"
          ? predictionSelect("winner", knockout.winner, label)
          : predictionSelect(`${key}${index + 1}`, knockout[key]?.[index], `${label} ${index + 1}`)).join("")}
      </div>
    </section>
  `).join("");
  renderProfileAvatarPreview();
}

function renderMetrics() {
  const fixtures = app.state.fixtures;
  const rows = fixtures.map(settlement);
  const metrics = [
    ["trophy", "Matches", fixtures.length],
    ["badge-check", "Settled", rows.filter((row) => row.settled).length],
    scoringMode() === "points"
      ? ["target", "Points Awarded", scoreValue((app.state.leaderboard || []).reduce((sum, row) => sum + row.points, 0))]
      : ["coins", "Total Pool", money(rows.reduce((sum, row) => sum + row.pool, 0))],
    scoringMode() === "points"
      ? ["list-checks", "Correct Picks", (app.state.leaderboard || []).reduce((sum, row) => sum + row.correct, 0)]
      : ["refresh-ccw", "Rollover", money(rows.reduce((sum, row) => sum + row.rollover, 0))],
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
  elements.leaderLabel.textContent = leader ? `${leader.display_name} leads at ${scoreValue(scoringMode() === "points" ? leader.points : leader.net)}` : "No players yet";
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
      <strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${scoreValue(scoringMode() === "points" ? row.points : row.net)}</strong>
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
      <div class="match-card-footer"><span>${icon("map-pin")} ${escapeHtml(fixture.venue || "Venue TBD")}</span><strong>${hasScore(fixture) ? scoreText(fixture) : fixture.result ? resultLabel(fixture, fixture.result) : scoreValue(settlement(fixture).pool)}</strong></div>
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
      <div class="match-card-meta"><span>#${fixture.id}</span>${statusBadge(matches.length && !isFinalFixture(fixture) ? fixture.status || "Live" : fixture.status || "Final")}</div>
      ${matchMetaChips(fixture)}
      <div class="score-line">${teamBadge(fixture.team1)}<strong>${fixture.team1Score ?? "-"}</strong></div>
      <div class="score-line">${teamBadge(fixture.team2)}<strong>${fixture.team2Score ?? "-"}</strong></div>
      <div class="match-card-footer"><span>${dateLabel(fixture.date)} ${escapeHtml(fixture.kickoff || "")}</span><strong>${fixture.result ? resultLabel(fixture, fixture.result) : escapeHtml(displayStatusLabel(fixture.status || "In progress"))}</strong></div>
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
  elements.poolHeader.textContent = scoringMode() === "points" ? "Points" : "Pool";
  elements.rolloverHeader.textContent = scoringMode() === "points" ? "Missed" : "Rollover";
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
        <td>${statusBadge(betStatus)}</td>
        <td>
          <div class="bet-editor">
            <select data-bet-pick ${canBet ? "" : "disabled"}>${betOptionList(fixture, fixture.myPick)}</select>
            <div class="score-prediction">
              <input data-score-team1 type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(predictionValue(fixture, "predictedTeam1Score"))}" placeholder="${escapeHtml(displayTeamName(fixture.team1))}" ${canBet ? "" : "disabled"}>
              <span>-</span>
              <input data-score-team2 type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(predictionValue(fixture, "predictedTeam2Score"))}" placeholder="${escapeHtml(displayTeamName(fixture.team2))}" ${canBet ? "" : "disabled"}>
            </div>
          </div>
          <div class="fixture-subtext">${canBet ? "Place pick and optional score prediction" : fixture.myPick ? `Your pick: ${resultLabel(fixture, fixture.myPick)}` : "Login as player before lock"}</div>
        </td>
        <td><strong>${scoreValue(row.pool)}</strong><div class="fixture-subtext">${getBets(fixture).length} bets</div></td>
        <td><strong>${scoreValue(row.rollover)}</strong></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="9"><div class="empty-state">No matches match the current filters.</div></td></tr>`;
}

function renderPlayers() {
  const rows = app.state.leaderboard || [];
  const statOneLabel = scoringMode() === "points" ? "Points" : "Net";
  const statTwoLabel = "Correct";
  const statThreeLabel = scoringMode() === "points" ? "Score pts" : "ROI";
  elements.playersLeaderboard.innerHTML = rows.length ? rows.map((row, index) => `
    <div class="leader-row">
      <div class="rank">${index + 1}</div>
      ${avatarHtml(row, "avatar avatar-small")}
      <div>
        <strong>${escapeHtml(row.display_name)}</strong>
        <div class="fixture-subtext">${row.correct}/${row.settled} correct${scoringMode() === "points" ? `, ${row.points} pts` : `, ${row.bets_entered} bets entered`}</div>
      </div>
      <strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${scoreValue(scoringMode() === "points" ? row.points : row.net)}</strong>
    </div>
  `).join("") : `<div class="empty-state">No player rankings yet.</div>`;
  elements.playerCards.innerHTML = (app.state.leaderboard || []).map((row, index) => `
    <article class="player-card flip-card" tabindex="0" aria-label="${escapeHtml(row.display_name)} player profile card">
      <div class="flip-card-inner">
        <section class="player-card-face player-card-front">
          <div class="player-card-top">
            <strong>${escapeHtml(row.display_name)}</strong>
            <div class="support-flag-row">
              ${row.supported_team ? teamBadge(row.supported_team, { compact: true }) : `<span class="support-empty">No team</span>`}
            </div>
          </div>
          <div class="player-hero-panel">
            ${avatarHtml(row, "avatar player-card-avatar")}
          </div>
          <div class="player-card-identity">
            <h3>${escapeHtml(row.display_name)}</h3>
            ${row.supported_player ? `<p>Supporting ${escapeHtml(row.supported_player)}</p>` : row.supported_team ? `<p>Supporting ${escapeHtml(row.supported_team)}</p>` : `<p>World Cup Player</p>`}
          </div>
          <div class="player-badge-row player-card-tags">
            <span class="player-badge">${icon("medal")}Rank #${index + 1}</span>
            <span class="player-badge">${icon("target")}${scoreValue(scoringMode() === "points" ? row.points : row.net)}</span>
            <span class="player-badge">${icon("flame")}${row.correct} correct</span>
          </div>
          <div class="player-card-stat-row">
            <div><strong>${scoreValue(scoringMode() === "points" ? row.points : row.net)}</strong><span>${statOneLabel}</span></div>
            <div><strong>${row.correct}</strong><span>${statTwoLabel}</span></div>
            <div><strong>${scoringMode() === "points" ? row.score_points || 0 : `${Math.round(row.roi * 100)}%`}</strong><span>${statThreeLabel}</span></div>
          </div>
          <small class="flip-hint">Click to flip</small>
        </section>
        <section class="player-card-face player-card-back">
          <div class="player-card-back-top">
            <span class="supported-player-tag">${escapeHtml(row.supported_player || "No player selected")}</span>
            <div class="support-flag-row">
              ${row.supported_team ? teamBadge(row.supported_team, { compact: true }) : `<span class="support-empty">No team</span>`}
            </div>
          </div>
          <div class="player-prediction-list knockout-only">
            <div><strong>Quarter Finals Predictions</strong><div class="prediction-flag-grid">${predictionFlagChips(row.knockout_predictions?.quarterfinalists)}</div></div>
            <div><strong>Semi-Finals Prediction</strong><div class="prediction-flag-grid">${predictionFlagChips(row.knockout_predictions?.semifinalists)}</div></div>
            <div><strong>Finals Predictions</strong><div class="prediction-flag-grid">${predictionFlagChips(row.knockout_predictions?.finalists)}</div></div>
            <div><strong>Winner</strong><div class="prediction-flag-grid winner">${predictionFlagChips([row.knockout_predictions?.winner].filter(Boolean))}</div></div>
          </div>
          <small class="flip-hint">Click to return</small>
        </section>
      </div>
    </article>
  `).join("") || `<div class="empty-state">No public player profiles yet.</div>`;
  document.querySelectorAll(".flip-card").forEach((card) => {
    card.addEventListener("click", () => card.classList.toggle("is-flipped"));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      card.classList.toggle("is-flipped");
    });
  });
  window.lucide?.createIcons();
}

function predictionFlagChips(teams = []) {
  const cleanTeams = teams.filter(Boolean);
  if (!cleanTeams.length) return `<span class="empty-prediction">No picks yet</span>`;
  return cleanTeams.map((team) => teamBadge(team, { compact: true })).join("");
}

function predictionRows(key, title) {
  const players = app.state.leaderboard || [];
  return `
    <section>
      <h4>${escapeHtml(title)}</h4>
      <div class="table-wrap">
        <table class="fixture-table">
          <thead><tr><th>Player</th><th>Selections</th></tr></thead>
          <tbody>
            ${players.map((player) => {
              const value = key === "golden"
                ? player.golden_boot_predictions || []
                : key === "winner"
                  ? [player.knockout_predictions?.winner].filter(Boolean)
                  : player.knockout_predictions?.[key] || [];
              return `<tr><td>${escapeHtml(player.display_name)}</td><td>${value.map(escapeHtml).join(", ") || "-"}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPredictionTables() {
  if (!elements.predictionTables) return;
  elements.predictionTables.innerHTML = [
    predictionRows("golden", "Golden Boot Predictions"),
    predictionRows("quarterfinalists", "Quarterfinal Teams"),
    predictionRows("semifinalists", "Semifinal Teams"),
    predictionRows("finalists", "Finalists"),
    predictionRows("winner", "Tournament Winner"),
  ].join("");
}

function publicPickLabel(fixture, pick) {
  if (!pick) return "-";
  if (pick === "Team 1") return displayTeamName(fixture.team1);
  if (pick === "Team 2") return displayTeamName(fixture.team2);
  return "Draw";
}

function publicPredictionLabel(bet) {
  if (!bet || bet.predictedTeam1Score === null || bet.predictedTeam1Score === undefined || bet.predictedTeam2Score === null || bet.predictedTeam2Score === undefined) return "";
  return `${bet.predictedTeam1Score}-${bet.predictedTeam2Score}`;
}

function renderPublicBets() {
  const players = app.state.players || [];
  elements.publicBetsHead.innerHTML = `
    <tr>
      <th>Match</th>
      <th>Date</th>
      ${players.map((player) => `<th>${escapeHtml(player.display_name)}</th>`).join("")}
    </tr>
  `;
  elements.publicBetsBody.innerHTML = app.state.fixtures.map((fixture) => `
    <tr>
      <td>
        <strong>#${fixture.id}</strong>
        <div class="fixture-subtext">${escapeHtml(fixture.stage || "")} ${escapeHtml(fixture.group || "")}</div>
      </td>
      <td>
        <strong>${dateLabel(fixture.date)}</strong>
        <div class="fixture-subtext">${escapeHtml(fixture.kickoff || "")}</div>
      </td>
      ${players.map((player) => {
        const bet = fixture.bets[player.id] || null;
        const pick = bet?.pick || "";
        const scorePrediction = publicPredictionLabel(bet);
        return `<td><span class="pick-chip ${pick ? "has-pick" : ""}">${escapeHtml(publicPickLabel(fixture, pick))}${scorePrediction ? `<small>${escapeHtml(scorePrediction)}</small>` : ""}</span></td>`;
      }).join("")}
    </tr>
  `).join("");
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

function renderRules() {
  const india = scoringMode() === "points";
  elements.rulesLabel.textContent = `${activeServer()} server rules`;
  const serverRules = india
    ? [
        ["Prediction result", "Correct winner/draw prediction earns 1 point."],
        ["Score prediction", "Correct score for each team earns 1 point."],
        ["Exact score bonus", "Correct scores for both teams earn 5 score points total for that match."],
        ["Leaderboard", "India rankings are ordered by total points, then correct predictions."],
      ]
    : [
        ["Stake", `Each pick contributes ${money(app.state?.settings?.stake || 1)} to that match pool.`],
        ["Payout", "Players with the correct prediction split the match pool."],
        ["Ledger", "The Command Center ledger calculates who owes whom after settled matches."],
        ["Score prediction", "Score prediction is available for fun, but it does not affect US payouts right now."],
      ];
  const commonRules = [
    ["Login", "Use the login button and the credentials shared by the admin."],
    ["Profile", "After login, open Profile to update display name, login ID, password, and profile picture."],
    ["Placing picks", "Open Bets, choose the team name or Draw, and optionally enter the predicted score."],
    ["Bet lock", `Picks lock ${app.state?.settings?.lockMinutes || 60} minutes before kickoff in Eastern Time.`],
    ["Switching server", "Players assigned to both US and India can use the server selector at the top right."],
  ];
  elements.rulesContent.innerHTML = [...serverRules, ...commonRules].map(([title, text]) => `
    <article class="rule-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </article>
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
  renderPublicBets();
  renderPlayers();
  renderProfilePage();
  renderPredictionTables();
  renderAllFixtures();
  renderGroupTables();
  renderRoadmap();
  renderRules();
  window.lucide?.createIcons();
}

async function refresh() {
  const [me, state] = await Promise.all([api("/api/me"), api(`/api/state?server=${encodeURIComponent(selectedServer)}`)]);
  app.user = me.user;
  if (app.user?.servers?.length && !app.user.servers.includes(selectedServer)) {
    selectedServer = app.user.servers[0];
    localStorage.setItem("selectedServer", selectedServer);
    app.state = await api(`/api/state?server=${encodeURIComponent(selectedServer)}`);
    renderAll();
    return;
  }
  app.state = state;
  selectedServer = state.settings.server;
  localStorage.setItem("selectedServer", selectedServer);
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

elements.profileButton?.addEventListener("click", () => {
  elements.profileNavTab.hidden = false;
  elements.profileNavTab.click();
});

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

elements.profilePageAvatarInput.addEventListener("change", async () => {
  const file = elements.profilePageAvatarInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    elements.saveStatus.textContent = "Profile picture must be an image";
    elements.profilePageAvatarInput.value = "";
    return;
  }
  if (file.size > 550_000) {
    elements.saveStatus.textContent = "Profile picture must be smaller than 550 KB";
    elements.profilePageAvatarInput.value = "";
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

function collectKnockoutPredictions(formData) {
  return {
    quarterfinalists: Array.from({ length: 8 }, (_, index) => formData.get(`quarterfinalists${index + 1}`)),
    semifinalists: Array.from({ length: 4 }, (_, index) => formData.get(`semifinalists${index + 1}`)),
    finalists: Array.from({ length: 2 }, (_, index) => formData.get(`finalists${index + 1}`)),
    winner: formData.get("winner"),
  };
}

elements.profilePageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(elements.profilePageForm);
    const payload = await api(`/api/profile?server=${encodeURIComponent(selectedServer)}`, {
      method: "PATCH",
      body: JSON.stringify({
        displayName: formData.get("displayName"),
        loginId: formData.get("loginId"),
        password: formData.get("password"),
        avatarData: profileAvatarData,
        supportedTeam: formData.get("supportedTeam"),
        supportedPlayer: formData.get("supportedPlayer"),
        goldenBootPredictions: Array.from({ length: 5 }, (_, index) => formData.get(`goldenBoot${index + 1}`)),
        knockoutPredictions: collectKnockoutPredictions(formData),
      }),
    });
    app.user = payload.user;
    app.state = payload.state;
    elements.saveStatus.textContent = "Profile updated";
    renderAll();
  } catch (error) {
    elements.saveStatus.textContent = error.message;
  }
});

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(elements.profileForm));
    const payload = await api(`/api/profile?server=${encodeURIComponent(selectedServer)}`, {
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

elements.serverSwitch.addEventListener("change", async () => {
  selectedServer = elements.serverSwitch.value;
  localStorage.setItem("selectedServer", selectedServer);
  await refresh();
});

elements.fixturesTable.addEventListener("change", async (event) => {
  if (!event.target.matches("[data-bet-pick], [data-score-team1], [data-score-team2]")) return;
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const pick = row.querySelector("[data-bet-pick]")?.value || "";
  if (!pick) return;
  const payload = await api("/api/bets", {
    method: "POST",
    body: JSON.stringify({
      matchId: Number(row.dataset.id),
      pick,
      server: selectedServer,
      predictedTeam1Score: row.querySelector("[data-score-team1]")?.value || "",
      predictedTeam2Score: row.querySelector("[data-score-team2]")?.value || "",
    }),
  });
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

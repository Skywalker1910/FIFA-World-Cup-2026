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

let app = { user: null, state: null, aiState: null };
let loginPanelOpen = false;
let profilePanelOpen = false;
let profileAvatarData = "";
let selectedServer = localStorage.getItem("selectedServer") || "";
let roadmapZoom = Number(localStorage.getItem("roadmapZoom") || 1);
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
  aiAgentCards: document.querySelector("#aiAgentCards"),
  aiPredictionsHead: document.querySelector("#aiPredictionsHead"),
  aiPredictionsBody: document.querySelector("#aiPredictionsBody"),
  aiPredictionsList: document.querySelector("#aiPredictionsList"),
  aiPredictionsLabel: document.querySelector("#aiPredictionsLabel"),
  aiServerLabel: document.querySelector("#aiServerLabel"),
  aiActiveAgents: document.querySelector("#aiActiveAgents"),
  aiTotalPredictions: document.querySelector("#aiTotalPredictions"),
  aiAverageConfidence: document.querySelector("#aiAverageConfidence"),
  poolHeader: document.querySelector("#poolHeader"),
  rolloverHeader: document.querySelector("#rolloverHeader"),
  playerCards: document.querySelector("#playerCards"),
  allFixtures: document.querySelector("#allFixtures"),
  allFixturesLabel: document.querySelector("#allFixturesLabel"),
  groupTables: document.querySelector("#groupTables"),
  roadmap: document.querySelector("#roadmap"),
  roadmapLabel: document.querySelector("#roadmapLabel"),
  roadmapZoomIn: document.querySelector("#roadmapZoomIn"),
  roadmapZoomOut: document.querySelector("#roadmapZoomOut"),
  roadmapZoomReset: document.querySelector("#roadmapZoomReset"),
  roadmapZoomLabel: document.querySelector("#roadmapZoomLabel"),
  thirdPlaceTable: document.querySelector("#thirdPlaceTable"),
  updatesContent: document.querySelector("#updatesContent"),
  privacyContent: document.querySelector("#privacyContent"),
  helpContent: document.querySelector("#helpContent"),
  searchInput: document.querySelector("#searchInput"),
  stageFilter: document.querySelector("#stageFilter"),
  groupFilter: document.querySelector("#groupFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  serverSwitch: document.querySelector("#serverSwitch"),
  serverTag: document.querySelector("#serverTag"),
  serverTagLabel: document.querySelector("#serverTagLabel"),
  adminSwitchButton: document.querySelector("#adminSwitchButton"),
  loginToggleButton: document.querySelector("#loginToggleButton"),
  logoutNavButton: document.querySelector("#logoutNavButton"),
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

function indiaAwards(row) {
  return [
    ["circle-dot", "Matchballs", row.matchballs ?? row.points ?? 0],
    ["footprints", "Boots", row.boots ?? row.score_points ?? 0],
    ["sparkles", "Glory", row.glory_points ?? row.correct ?? 0],
    ["shirt", "Caps", row.caps ?? row.bets_entered ?? 0],
    ["award", "Prestige", row.prestige_points ?? 0],
    ["crown", "Legends", row.legends ?? 0],
    ["gem", "Orbs", row.orbs ?? 0],
  ];
}

function awardBadges(row, options = {}) {
  if (scoringMode() !== "points") return "";
  const labelFilter = options.labels ? new Set(options.labels) : null;
  const awards = indiaAwards(row).filter(([, label]) => !labelFilter || labelFilter.has(label));
  const limit = options.limit || awards.length;
  return `<div class="award-row ${options.compact ? "compact" : ""} ${options.className || ""}">
    ${awards.slice(0, limit).map(([iconName, label, value]) => `
      <span class="award-pill" title="${escapeHtml(label)}">
        ${icon(iconName)}
        <strong>${Number(value || 0)}</strong>
        <em>${escapeHtml(label)}</em>
      </span>
    `).join("")}
  </div>`;
}

function activeServer() {
  return app.state?.settings?.server || selectedServer || "US";
}

function browserPreferredServer() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const languages = navigator.languages || [navigator.language || ""];
  if (timezone === "Asia/Kolkata" || languages.some((language) => /(^|-)IN\b/i.test(language))) return "India";
  return "US";
}

async function detectPreferredServer() {
  if (selectedServer) return selectedServer;
  try {
    const geo = await api("/api/geo");
    selectedServer = geo.source === "request-header" ? geo.preferredServer : browserPreferredServer();
  } catch {
    selectedServer = browserPreferredServer();
  }
  localStorage.setItem("selectedServer", selectedServer);
  return selectedServer;
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

function isKnownCountryTeam(team) {
  return Boolean(TEAM_FLAGS[displayTeamName(team)]);
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
  elements.logoutButton.hidden = !user;
  elements.logoutNavButton.hidden = !user;
  elements.adminSwitchButton.hidden = user?.role !== "admin";
  elements.serverTag.hidden = false;
  const canSwitchServers = !(["player", "ai_agent"].includes(user?.role) && userServers.length <= 1);
  elements.serverSwitch.hidden = !canSwitchServers;
  elements.serverSwitch.textContent = "";
  elements.serverSwitch.classList.toggle("is-india", activeServer() === "India");
  elements.serverSwitch.dataset.nextServer = activeServer() === "India" ? "US" : "India";
  elements.serverSwitch.setAttribute("aria-label", `Switch to ${elements.serverSwitch.dataset.nextServer} server`);
  elements.serverTagLabel.textContent = `${activeServer()} Server`;
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
      ? ["circle-dot", "Matchballs", (app.state.leaderboard || []).reduce((sum, row) => sum + Number(row.matchballs ?? row.points ?? 0), 0)]
      : ["coins", "Total Entry Value", money(rows.reduce((sum, row) => sum + row.pool, 0))],
    scoringMode() === "points"
      ? ["footprints", "Boots", (app.state.leaderboard || []).reduce((sum, row) => sum + Number(row.boots ?? row.score_points ?? 0), 0)]
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
  elements.leaderLabel.textContent = leader ? `${leader.display_name} leads at ${scoringMode() === "points" ? `${leader.matchballs ?? leader.points ?? 0} Matchballs` : scoreValue(leader.net)}` : "No players yet";
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
        ${awardBadges(row, { compact: true, limit: 4 })}
      </div>
      <strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${scoringMode() === "points" ? `${row.matchballs ?? row.points ?? 0} MB` : scoreValue(row.net)}</strong>
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
  const isPlayer = ["player", "ai_agent"].includes(app.user?.role);
  elements.poolHeader.textContent = scoringMode() === "points" ? "Matchballs" : "Entry Value";
  elements.rolloverHeader.textContent = scoringMode() === "points" ? "Streak" : "Rollover";
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
        <td><strong>${scoreValue(row.pool)}</strong><div class="fixture-subtext">${getBets(fixture).length} predictions</div></td>
        <td><strong>${scoreValue(row.rollover)}</strong></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="9"><div class="empty-state">No matches match the current filters.</div></td></tr>`;
}

function renderPlayers() {
  const rows = app.state.leaderboard || [];
  const statOneLabel = scoringMode() === "points" ? "Matchballs" : "Net";
  const statTwoLabel = "Correct";
  const statThreeLabel = scoringMode() === "points" ? "Caps" : "ROI";
  elements.playersLeaderboard.innerHTML = rows.length ? rows.map((row, index) => `
    <div class="leader-row">
      <div class="rank">${index + 1}</div>
      ${avatarHtml(row, "avatar avatar-small")}
      <div>
        <strong>${escapeHtml(row.display_name)}</strong>
        <div class="fixture-subtext">${row.correct}/${row.settled} correct${scoringMode() === "points" ? `, ${row.matchballs ?? row.points ?? 0} Matchballs` : `, ${row.bets_entered} predictions entered`}</div>
        ${awardBadges(row, { compact: true })}
      </div>
      <strong class="${row.net >= 0 ? "money-positive" : "money-negative"}">${scoringMode() === "points" ? `${row.matchballs ?? row.points ?? 0} MB` : scoreValue(row.net)}</strong>
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
          ${scoringMode() === "points" ? `
            <div class="player-badge-row player-card-tags">
              <span class="player-badge">${icon("medal")}Rank #${index + 1}</span>
              <span class="player-badge">${icon("circle-dot")}${row.matchballs ?? row.points ?? 0} Matchballs</span>
              <span class="player-badge">${icon("award")}${row.prestige_points ?? 0} Prestige</span>
            </div>
            ${awardBadges(row, { compact: true, labels: ["Glory", "Legends", "Orbs"], className: "player-card-streak-awards" })}
          ` : `
            <div class="player-badge-row player-card-tags">
              <span class="player-badge">${icon("medal")}Rank #${index + 1}</span>
              <span class="player-badge">${icon("target")}${scoreValue(row.net)}</span>
              <span class="player-badge">${icon("flame")}${row.correct} correct</span>
            </div>
          `}
          <div class="player-card-stat-row">
            <div><strong>${scoringMode() === "points" ? row.matchballs ?? row.points ?? 0 : scoreValue(row.net)}</strong><span>${statOneLabel}</span></div>
            <div><strong>${scoringMode() === "points" ? row.boots ?? row.score_points ?? 0 : row.correct}</strong><span>${scoringMode() === "points" ? "Boots" : statTwoLabel}</span></div>
            <div><strong>${scoringMode() === "points" ? row.caps ?? row.bets_entered ?? 0 : `${Math.round(row.roi * 100)}%`}</strong><span>${statThreeLabel}</span></div>
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

function isPerfectPublicPrediction(fixture, bet) {
  if (!fixture.result || !bet || bet.pick !== fixture.result) return false;
  if (fixture.team1Score === null || fixture.team1Score === undefined || fixture.team2Score === null || fixture.team2Score === undefined) return false;
  if (bet.predictedTeam1Score === null || bet.predictedTeam1Score === undefined || bet.predictedTeam2Score === null || bet.predictedTeam2Score === undefined) return false;
  return Number(bet.predictedTeam1Score) === Number(fixture.team1Score)
    && Number(bet.predictedTeam2Score) === Number(fixture.team2Score);
}

function publicPickStatus(fixture, bet, correctPickCount) {
  const pick = bet?.pick || "";
  if (!pick) return { className: "", uniqueCorrect: false };
  if (!fixture.result) return { className: "is-pending", uniqueCorrect: false };
  if (pick !== fixture.result) return { className: "is-incorrect", uniqueCorrect: false };
  return {
    className: isPerfectPublicPrediction(fixture, bet) ? "is-perfect" : "is-correct",
    uniqueCorrect: correctPickCount === 1,
  };
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
  elements.publicBetsBody.innerHTML = app.state.fixtures.map((fixture) => {
    const correctPickCount = fixture.result
      ? Object.values(fixture.bets || {}).filter((prediction) => prediction?.pick === fixture.result).length
      : 0;
    return `
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
          const status = publicPickStatus(fixture, bet, correctPickCount);
          return `<td><span class="pick-chip ${status.className}">${status.uniqueCorrect ? `<i class="pick-star" data-lucide="star"></i>` : ""}<span>${escapeHtml(publicPickLabel(fixture, pick))}${scorePrediction ? `<small>${escapeHtml(scorePrediction)}</small>` : ""}</span></span></td>`;
        }).join("")}
      </tr>
    `;
  }).join("");
}

const AI_PROVIDER_CARDS = [
  { key: "openai", name: "OpenAI", agentLabel: "GPT Agent", icon: "sparkles", className: "provider-openai" },
  { key: "anthropic", name: "Anthropic", agentLabel: "Claude Agent", icon: "brain-circuit", className: "provider-claude" },
  { key: "google", name: "Google", agentLabel: "Gemini Agent", icon: "gem", className: "provider-gemini" },
];

function aiProviderKey(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("openai") || normalized.includes("gpt")) return "openai";
  if (normalized.includes("anthropic") || normalized.includes("claude")) return "anthropic";
  if (normalized.includes("google") || normalized.includes("gemini")) return "google";
  return "other";
}

function aiMetadataEntries(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  return Object.entries(metadata).slice(0, 5).map(([key, value]) => {
    const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
    const displayValue = Array.isArray(value)
      ? value.join(", ")
      : value && typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
    return [label, displayValue];
  });
}

function aiPredictionAsBet(prediction) {
  return prediction ? {
    pick: prediction.pick,
    predictedTeam1Score: prediction.predictedTeam1Score,
    predictedTeam2Score: prediction.predictedTeam2Score,
  } : null;
}

function renderAIPredictionMatrix(agents, predictions) {
  if (!elements.aiPredictionsHead || !elements.aiPredictionsBody) return;
  elements.aiPredictionsHead.innerHTML = `
    <tr>
      <th>Match</th>
      <th>Date</th>
      ${agents.map((agent) => `
        <th>
          <span class="ai-table-agent">
            <i data-lucide="${AI_PROVIDER_CARDS.find((provider) => provider.key === aiProviderKey(agent.provider || agent.model))?.icon || "bot"}"></i>
            ${escapeHtml(agent.displayName)}
          </span>
        </th>
      `).join("")}
    </tr>
  `;

  const matches = (app.state?.fixtures || []).length
    ? [...app.state.fixtures]
    : [...new Map(predictions.map((prediction) => [
      prediction.matchId,
      { id: prediction.matchId, ...prediction.match },
    ])).values()];
  matches.sort((left, right) => Number(left.id) - Number(right.id));

  elements.aiPredictionsBody.innerHTML = agents.length && matches.length ? matches.map((fixture) => {
    const matchPredictions = predictions.filter((prediction) => Number(prediction.matchId) === Number(fixture.id));
    const correctPickCount = fixture.result
      ? matchPredictions.filter((prediction) => prediction.pick === fixture.result).length
      : 0;
    return `
      <tr>
        <td>
          <strong>#${fixture.id}</strong>
          <div class="fixture-subtext">${escapeHtml(fixture.stage || "")}${fixture.group ? ` · Group ${escapeHtml(fixture.group)}` : ""}</div>
          <div class="ai-table-matchup">${teamBadge(fixture.team1, { compact: true })}<span>vs</span>${teamBadge(fixture.team2, { compact: true })}</div>
        </td>
        <td>
          <strong>${dateLabel(fixture.date)}</strong>
          <div class="fixture-subtext">${escapeHtml(fixture.kickoff || "")}</div>
        </td>
        ${agents.map((agent) => {
          const prediction = matchPredictions.find((item) => Number(item.userId) === Number(agent.id)) || null;
          const bet = aiPredictionAsBet(prediction);
          const status = publicPickStatus(fixture, bet, correctPickCount);
          const score = prediction && prediction.predictedTeam1Score !== null && prediction.predictedTeam1Score !== undefined
            && prediction.predictedTeam2Score !== null && prediction.predictedTeam2Score !== undefined
            ? `${prediction.predictedTeam1Score}-${prediction.predictedTeam2Score}`
            : "";
          const confidence = Number(prediction?.confidence);
          return `
            <td>
              <span class="pick-chip ai-table-pick ${status.className}">
                ${status.uniqueCorrect ? `<i class="pick-star" data-lucide="star"></i>` : ""}
                <span>
                  ${escapeHtml(publicPickLabel(fixture, prediction?.pick || ""))}
                  ${score ? `<small>${escapeHtml(score)}${Number.isFinite(confidence) ? ` · ${Math.round(confidence)}%` : ""}</small>` : Number.isFinite(confidence) ? `<small>${Math.round(confidence)}% confidence</small>` : ""}
                </span>
              </span>
            </td>
          `;
        }).join("")}
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="${Math.max(2, agents.length + 2)}">
        <div class="empty-state">AI prediction records will appear here after agents submit their first match predictions.</div>
      </td>
    </tr>
  `;
}

function renderAI() {
  if (!elements.aiAgentCards || !elements.aiPredictionsList) return;
  const aiState = app.aiState || { agents: [], predictions: [], providers: [], server: activeServer() };
  const agents = aiState.agents || [];
  const predictions = aiState.predictions || [];
  const confidenceValues = predictions
    .map((prediction) => Number(prediction.confidence))
    .filter((confidence) => Number.isFinite(confidence));
  elements.aiServerLabel.textContent = `${aiState.server || activeServer()} Server`;
  elements.aiPredictionsLabel.textContent = `${predictions.length} predictions from ${agents.length} AI agent${agents.length === 1 ? "" : "s"}`;
  elements.aiActiveAgents.textContent = agents.length;
  elements.aiTotalPredictions.textContent = predictions.length;
  elements.aiAverageConfidence.textContent = confidenceValues.length
    ? `${Math.round(confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length)}%`
    : "—";
  renderAIPredictionMatrix(agents, predictions);

  elements.aiAgentCards.innerHTML = AI_PROVIDER_CARDS.map((provider) => {
    const providerAgents = agents.filter((agent) => aiProviderKey(agent.provider || agent.model) === provider.key);
    const agent = providerAgents[0] || null;
    const providerPredictions = predictions.filter((prediction) => aiProviderKey(prediction.provider || prediction.model) === provider.key);
    const providerConfidence = providerPredictions
      .map((prediction) => Number(prediction.confidence))
      .filter((confidence) => Number.isFinite(confidence));
    return `
    <article class="ai-agent-card ${provider.className} ${agent ? "is-connected" : "is-awaiting"}">
      <div class="ai-agent-card-head">
        <span class="ai-provider-mark"><i data-lucide="${provider.icon}"></i></span>
        <span class="ai-agent-live"><span></span>${agent ? "Connected" : "Awaiting agent"}</span>
      </div>
      <span class="ai-provider-name">${provider.name}</span>
      <h4>${escapeHtml(agent?.displayName || provider.agentLabel)}</h4>
      <p>${escapeHtml(agent?.model || "Create and assign a dedicated AI agent account in Command Center")}</p>
      <div class="ai-agent-stats">
        <div><strong>${agent?.predictionsEntered || 0}</strong><span>Predictions</span></div>
        <div><strong>${agent?.correct || 0}</strong><span>Correct</span></div>
        <div><strong>${providerConfidence.length ? `${Math.round(providerConfidence.reduce((sum, value) => sum + value, 0) / providerConfidence.length)}%` : "—"}</strong><span>Confidence</span></div>
      </div>
    </article>
  `;
  }).join("");

  elements.aiPredictionsList.innerHTML = predictions.length ? predictions.map((prediction) => {
    const fixture = { id: prediction.matchId, ...prediction.match };
    const settled = Boolean(fixture.result);
    const correct = settled && prediction.pick === fixture.result;
    const provider = AI_PROVIDER_CARDS.find((item) => item.key === aiProviderKey(prediction.provider || prediction.model));
    const confidence = Number(prediction.confidence);
    const hasConfidence = Number.isFinite(confidence);
    const metadataEntries = aiMetadataEntries(prediction.metadata);
    const scorePrediction = prediction.predictedTeam1Score !== null
      && prediction.predictedTeam1Score !== undefined
      && prediction.predictedTeam2Score !== null
      && prediction.predictedTeam2Score !== undefined
      ? `${prediction.predictedTeam1Score} – ${prediction.predictedTeam2Score}`
      : "No score forecast";
    return `
      <article class="ai-prediction-card ${provider?.className || ""}">
        <div class="ai-prediction-agent">
          <span class="ai-provider-mark compact"><i data-lucide="${provider?.icon || "bot"}"></i></span>
          <div>
            <strong>${escapeHtml(prediction.agentName)}</strong>
            <span>${escapeHtml([prediction.provider, prediction.model].filter(Boolean).join(" · ") || "AI agent")}</span>
          </div>
        </div>
        <div class="ai-prediction-match">
          <span>#${prediction.matchId} · ${escapeHtml(fixture.stage || "")}${fixture.group ? ` · Group ${escapeHtml(fixture.group)}` : ""}</span>
          <div>${teamBadge(fixture.team1, { compact: true })}<b>vs</b>${teamBadge(fixture.team2, { compact: true })}</div>
          <small>${dateLabel(fixture.date)} ${escapeHtml(fixture.kickoff || "")}</small>
        </div>
        <div class="ai-prediction-pick">
          <span>Predicted winner</span>
          <strong>${escapeHtml(publicPickLabel(fixture, prediction.pick))}</strong>
          <small>${escapeHtml(scorePrediction)}</small>
          <div class="ai-confidence">
            <span><b>${hasConfidence ? `${Math.round(confidence)}%` : "—"}</b> confidence</span>
            <i style="--confidence:${hasConfidence ? Math.max(0, Math.min(100, confidence)) : 0}%"></i>
          </div>
        </div>
        <div class="ai-prediction-outcome">
          <span class="status-badge ${settled ? (correct ? "status-live" : "status-locked") : "status-open"}">
            ${settled ? (correct ? "Correct" : "Incorrect") : "Pending"}
          </span>
          <p>${escapeHtml(prediction.reason || "No model reasoning published.")}</p>
        </div>
        <div class="ai-technical-details">
          <span>Technical details</span>
          <div>
            ${metadataEntries.length ? metadataEntries.map(([key, value]) => `<small><b>${escapeHtml(key)}</b>${escapeHtml(value)}</small>`).join("") : `<small><b>metadata</b>Not supplied</small>`}
            ${prediction.responseId ? `<small><b>response ID</b>${escapeHtml(prediction.responseId)}</small>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("") : `<div class="empty-state">AI agents have not submitted predictions for this server yet.</div>`;
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

function compareStandingRows(a, b) {
  return b.points - a.points
    || b.gd - a.gd
    || b.gf - a.gf
    || a.team.localeCompare(b.team);
}

function clinchedTopTwoByPoints(group, rows) {
  const fixtures = app.state.fixtures.filter((fixture) => fixture.group === group);
  const remainingByTeam = new Map(rows.map((row) => [row.team, 0]));
  fixtures
    .filter((fixture) => !hasScore(fixture) || !isFinalFixture(fixture))
    .forEach((fixture) => {
      remainingByTeam.set(fixture.team1, (remainingByTeam.get(fixture.team1) || 0) + 1);
      remainingByTeam.set(fixture.team2, (remainingByTeam.get(fixture.team2) || 0) + 1);
    });
  const maxPoints = new Map(rows.map((row) => [row.team, row.points + ((remainingByTeam.get(row.team) || 0) * 3)]));
  const clinched = new Set();
  rows.forEach((row) => {
    const teamsThatCanCatch = rows.filter((other) => other.team !== row.team && (maxPoints.get(other.team) || 0) >= row.points);
    if (teamsThatCanCatch.length <= 1) clinched.add(row.team);
  });
  return clinched;
}

function qualificationProjection() {
  const groups = groupStandings();
  const qualifiedTeams = new Map();
  const groupMap = new Map(groups.map((group) => [group.group, group.rows]));
  const groupCompletion = new Map(groups.map(({ group }) => {
    const fixtures = app.state.fixtures.filter((fixture) => fixture.group === group);
    return [group, fixtures.length > 0 && fixtures.every((fixture) => hasScore(fixture) && isFinalFixture(fixture))];
  }));
  const allGroupsComplete = [...groupCompletion.values()].length > 0 && [...groupCompletion.values()].every(Boolean);
  const thirdPlaceRows = [];
  groups.forEach(({ group, rows }) => {
    const clinchedTopTwo = clinchedTopTwoByPoints(group, rows);
    rows.forEach((row, index) => {
      row.group = group;
      row.rank = index + 1;
      row.groupComplete = Boolean(groupCompletion.get(group));
      if (index < 2 && (row.groupComplete || clinchedTopTwo.has(row.team))) {
        qualifiedTeams.set(row.team, { type: "auto", group, rank: index + 1, confirmed: true, clinched: !row.groupComplete });
      }
      if (index === 2) {
        thirdPlaceRows.push({ ...row, group, rank: 3 });
      }
    });
  });
  const thirdRankings = thirdPlaceRows.sort(compareStandingRows).map((row, index) => ({
    ...row,
    thirdRank: index + 1,
    qualified: allGroupsComplete && index < 8,
    projected: index < 8,
  }));
  thirdRankings.slice(0, 8).forEach((row) => {
    if (allGroupsComplete) {
      qualifiedTeams.set(row.team, { type: "third", group: row.group, rank: 3, thirdRank: row.thirdRank, confirmed: true });
    }
  });
  app.state.fixtures
    .filter((fixture) => fixture.stage === "Round of 32")
    .flatMap((fixture) => [displayTeamName(fixture.team1), displayTeamName(fixture.team2)])
    .filter(isKnownCountryTeam)
    .forEach((team) => {
      if (!qualifiedTeams.has(team)) {
        qualifiedTeams.set(team, { type: "knockout-fixture", confirmed: true });
      }
    });
  return { groups, groupMap, groupCompletion, allGroupsComplete, qualifiedTeams, thirdRankings };
}

function resolveGroupSeed(seed, projection, assignedThirdGroups = new Set()) {
  const value = String(seed || "");
  const winner = value.match(/^Winner Group ([A-L])$/i);
  if (winner) {
    const group = winner[1].toUpperCase();
    return projection.groupCompletion.get(group) ? projection.groupMap.get(group)?.[0]?.team || value : value;
  }
  const runnerUp = value.match(/^Runner-up Group ([A-L])$/i);
  if (runnerUp) {
    const group = runnerUp[1].toUpperCase();
    return projection.groupCompletion.get(group) ? projection.groupMap.get(group)?.[1]?.team || value : value;
  }
  const bestThird = value.match(/^Best 3rd \(([^)]+)\)$/i);
  if (bestThird) {
    if (!projection.allGroupsComplete) return value;
    const candidateGroups = bestThird[1].split("/").map((group) => group.trim().toUpperCase());
    const candidate = projection.thirdRankings.find((row) =>
      row.qualified && candidateGroups.includes(row.group) && !assignedThirdGroups.has(row.group)
    );
    if (candidate) {
      assignedThirdGroups.add(candidate.group);
      return candidate.team;
    }
  }
  return value;
}

function resolvedKnockoutTeam(seed, fixturesById, projection, assignedThirdGroups) {
  const matchRef = String(seed || "").match(/^(Winner|Loser) Match (\d+)$/i);
  if (matchRef) {
    const fixture = fixturesById.get(Number(matchRef[2]));
    if (!fixture?.result) return seed;
    const winner = resultLabel(fixture, fixture.result);
    if (matchRef[1].toLowerCase() === "winner") return winner;
    return fixture.result === "Team 1" ? displayTeamName(fixture.team2) : fixture.result === "Team 2" ? displayTeamName(fixture.team1) : seed;
  }
  return resolveGroupSeed(seed, projection, assignedThirdGroups);
}

function renderThirdPlaceProjection(projection) {
  return `
    <section class="third-place-projection">
      <div class="bracket-round-title">
        <h3>Best Third-Place Teams</h3>
        <span>${projection.allGroupsComplete ? "Top 8 advance" : "Projected until all groups finish"}</span>
      </div>
      <div class="third-place-leaderboard">
        ${projection.thirdRankings.map((row) => `
          <div class="third-place-row ${row.qualified ? "is-qualified" : row.projected ? "is-projected" : ""}">
            <strong>#${row.thirdRank}</strong>
            <div>${teamBadge(row.team, { compact: true })}<small>Group ${escapeHtml(row.group)}</small></div>
            <span>${row.played} played</span>
            <span>${row.gd > 0 ? `+${row.gd}` : row.gd} GD</span>
            <b>${row.points} pts</b>
            <em>${row.qualified ? "Qualified" : row.projected ? "Projected" : "Pending"}</em>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderThirdPlaceTable() {
  if (!elements.thirdPlaceTable) return;
  const projection = qualificationProjection();
  elements.thirdPlaceTable.innerHTML = renderThirdPlaceProjection(projection);
}

function setRoadmapZoom(value) {
  roadmapZoom = Math.min(1.4, Math.max(0.55, Math.round(Number(value || 1) * 100) / 100));
  localStorage.setItem("roadmapZoom", String(roadmapZoom));
  elements.roadmap?.style.setProperty("--roadmap-zoom", roadmapZoom);
  if (elements.roadmapZoomLabel) {
    elements.roadmapZoomLabel.textContent = `${Math.round(roadmapZoom * 100)}%`;
  }
}

function renderGroupTables() {
  const projection = qualificationProjection();
  elements.groupTables.innerHTML = projection.groups.map(({ group, rows }) => `
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
            <tr class="${index === 0 ? "top-row" : ""} ${projection.qualifiedTeams.has(row.team) ? "qualified-row" : ""}">
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
  const projection = qualificationProjection();
  const fixturesById = new Map(app.state.fixtures.map((fixture) => [fixture.id, fixture]));
  const assignedThirdGroups = new Set();
  const knockoutFixtures = app.state.fixtures.filter((fixture) => fixture.stage && fixture.stage !== "Group Stage");
  const resolvedFixture = (fixture) => ({
    ...fixture,
    projectedTeam1: resolvedKnockoutTeam(fixture.team1, fixturesById, projection, assignedThirdGroups),
    projectedTeam2: resolvedKnockoutTeam(fixture.team2, fixturesById, projection, assignedThirdGroups),
  });
  const rounds = {
    left32: [74, 77, 73, 75, 83, 84, 81, 82].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    left16: [89, 90, 93, 94].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    leftQf: [97, 98].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    leftSf: [101].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    final: [104].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    third: [103].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    rightSf: [102].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    rightQf: [99, 100].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    right16: [91, 92, 95, 96].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
    right32: [76, 78, 79, 80, 86, 88, 85, 87].map((id) => fixturesById.get(id)).filter(Boolean).map(resolvedFixture),
  };
  const bracketMatch = (fixture, options = {}) => `
    <article class="bracket-match ${fixture.result ? "is-final" : ""} ${options.center ? "is-championship" : ""}">
      <div class="match-card-meta"><span>${options.center ? escapeHtml(fixture.stage || "Final") : `#${fixture.id}`}</span><span>${dateLabel(fixture.date)}${fixture.kickoff ? ` · ${escapeHtml(fixture.kickoff)}` : ""}</span></div>
      <div class="bracket-teams">
        <div class="${resolvedResult(fixture) === "Team 1" ? "winner-team" : ""}">${teamBadge(displayTeamName(fixture.projectedTeam1), { compact: true })}<strong>${fixture.team1Score ?? ""}</strong></div>
        <div class="${resolvedResult(fixture) === "Team 2" ? "winner-team" : ""}">${teamBadge(displayTeamName(fixture.projectedTeam2), { compact: true })}<strong>${fixture.team2Score ?? ""}</strong></div>
      </div>
      <div class="bracket-match-footer">
        <span>${escapeHtml(fixture.kickoff || "")}</span>
        <strong>${fixture.result ? `${escapeHtml(resultLabel(fixture, fixture.result))} advances` : hasScore(fixture) ? escapeHtml(fixture.status || "In progress") : "Pending"}</strong>
      </div>
      <div class="fixture-subtext">${escapeHtml(fixture.venue || "")}</div>
    </article>
  `;
  const slotMaps = {
    round32: [1, 3, 5, 7, 10, 12, 14, 16],
    round16: [2, 6, 11, 15],
    quarter: [4, 13],
    semi: [8],
    final: [7],
    third: [10],
  };
  const bracketRound = (title, fixtures, side = "", slots = []) => `
    <section class="bracket-round ${side}">
      <div class="bracket-round-title">
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="bracket-match-list bracket-slot-list">
        ${fixtures.map((fixture, index) => `
          <div class="bracket-slot" style="--slot:${slots[index] || index + 1}">
            ${bracketMatch(fixture)}
          </div>
        `).join("")}
      </div>
    </section>
  `;
  elements.roadmapLabel.textContent = `${knockoutFixtures.length} knockout matches · ${projection.qualifiedTeams.size} confirmed qualifiers`;
  elements.roadmap.innerHTML = `
    <div class="roadmap-zoom-surface">
      <section class="centered-bracket">
        ${bracketRound("Round of 32", rounds.left32, "is-left", slotMaps.round32)}
        ${bracketRound("Round of 16", rounds.left16, "is-left", slotMaps.round16)}
        ${bracketRound("Quarterfinal", rounds.leftQf, "is-left", slotMaps.quarter)}
        ${bracketRound("Semifinal", rounds.leftSf, "is-left", slotMaps.semi)}
        <section class="bracket-round is-center">
          <div class="bracket-round-title">
            <h3>Final</h3>
          </div>
          <div class="bracket-match-list bracket-slot-list">
            ${rounds.final.map((fixture) => `<div class="bracket-slot" style="--slot:${slotMaps.final[0]}">${bracketMatch(fixture, { center: true })}</div>`).join("")}
            ${rounds.third.map((fixture) => `<div class="bracket-slot third-place-slot" style="--slot:${slotMaps.third[0]}">${bracketMatch(fixture)}</div>`).join("")}
          </div>
        </section>
        ${bracketRound("Semifinal", rounds.rightSf, "is-right", slotMaps.semi)}
        ${bracketRound("Quarterfinal", rounds.rightQf, "is-right", slotMaps.quarter)}
        ${bracketRound("Round of 16", rounds.right16, "is-right", slotMaps.round16)}
        ${bracketRound("Round of 32", rounds.right32, "is-right", slotMaps.round32)}
      </section>
    </div>
  `;
  setRoadmapZoom(roadmapZoom);
}

function renderUpdates() {
  const releases = [
    ["v2.3.0", "Thursday, June 25, 2026", "AI Prediction Comparison Table", [
      "Added a full fixture-by-agent prediction table to the AI page.",
      "Added blue, green, gold, and red result-aware prediction tags.",
      "Added a star when only one AI agent predicts the correct match result.",
      "Expanded public API documentation for rebuilding the AI matrix externally.",
    ]],
    ["v2.2.0", "Wednesday, June 24, 2026", "Dedicated AI Agent Account Role", [
      "Promoted AI agents from a player flag to a dedicated account role.",
      "Added automatic migration for existing AI-tagged player accounts.",
      "Updated Command Center account creation for players, AI agents, and admins.",
      "Kept AI permissions limited to predictions, predicted scores, reasoning, confidence, and metadata.",
    ]],
    ["v2.1.0", "Wednesday, June 24, 2026", "Multi-Model AI Prediction Arena", [
      "Redesigned the AI page for OpenAI, Claude, and Gemini agents.",
      "Added confidence scores, technical metadata, response IDs, and provider comparison cards.",
      "Added stable versioned API routes and a capabilities endpoint for external integrations.",
      "Published curl, JavaScript, and Python API integration documentation.",
    ]],
    ["v2.0.0", "Wednesday, June 24, 2026", "AI Match Center and Agent APIs", [
      "Added a public AI page for both US and India servers.",
      "Added AI agent account metadata for provider and model identity.",
      "Added dedicated public feed, agent context, and batch prediction APIs.",
      "Preserved compatibility with the existing GPT-5.5 agent repository.",
    ]],
    ["v1.9.0", "Wednesday, June 17, 2026", "India Awards, Documentation, and Support Pages", [
      "Added Matchballs, Boots, Glory, Caps, Prestige, Legends, and Orbs for India scoring.",
      "Simplified India player cards with award-focused rows and clearer flip behavior.",
      "Added prediction-focused documentation, privacy page, updates page, and help page.",
      "Added high-level location-based default server selection with manual switching.",
    ]],
    ["v1.8.0", "Tuesday, June 16, 2026", "Branding and Production Assets", [
      "Renamed the app to FIFA World Cup 2026.",
      "Added app logo assets and fixed Docker image asset delivery.",
      "Improved score display so match scores remain on a single line.",
    ]],
    ["v1.7.0", "Tuesday, June 16, 2026", "Scoped Command Center Controls", [
      "Added full admin and US regional admin behavior.",
      "Separated regional prediction record editing.",
      "Added one-player prediction editor for cleaner Command Center workflows.",
    ]],
    ["v1.6.0", "Monday, June 15, 2026", "Regional Servers and Tournament Predictions", [
      "Added US and India server experiences.",
      "Added player server access controls.",
      "Added profile, supported team/player, Golden Boot, and knockout prediction features.",
    ]],
    ["v1.5.0", "Sunday, June 14, 2026", "Command Center and Public Views", [
      "Added user deletion, public picks view, profile editing, and profile picture uploads.",
      "Added Railway health checks and deployment-safe runtime behavior.",
      "Improved status badges and prediction saving.",
    ]],
    ["v1.4.0", "Sunday, June 14, 2026", "football-data.org Integration", [
      "Switched score sync to football-data.org.",
      "Added sync diagnostics and manual result sync controls.",
      "Added safer sync error handling for production deployments.",
    ]],
    ["v1.3.0", "Sunday, June 14, 2026", "Tournament Structure", [
      "Added fixtures, group tables, and road-to-final views.",
      "Improved Command Center layout and administrator controls.",
      "Updated the UI toward a cleaner modern dashboard.",
    ]],
    ["v1.2.0", "Saturday, June 13, 2026", "Live Scores and Sync Foundation", [
      "Added automatic score sync foundation.",
      "Displayed synced scores before final results are settled.",
    ]],
    ["v1.0.0", "Saturday, June 13, 2026", "Initial Release", [
      "Created the first World Cup prediction tracker with fixtures, players, dashboard, and SQLite persistence.",
    ]],
  ];
  elements.updatesContent.innerHTML = releases.map(([version, date, title, notes]) => `
    <article class="release-card document-status-card">
      <span class="document-status-dot ${version === "v1.9.0" ? "is-live" : ""}" aria-hidden="true"></span>
      <div class="release-meta"><span>${escapeHtml(version)}</span><time>${escapeHtml(date)}</time></div>
      <div class="release-body">
        <h4>${escapeHtml(title)}</h4>
        <div class="release-note-grid">${notes.map((note) => `<div class="release-note">${escapeHtml(note)}</div>`).join("")}</div>
      </div>
    </article>
  `).join("");
}

function renderPrivacy() {
  const sections = [
    ["Privacy Notice", "This private prediction platform stores the minimum data needed to run player accounts, match predictions, profiles, regional leaderboards, and administrator workflows."],
    ["Account data", "The app stores display name, login ID, password hash, account role, assigned server access, session records, and optional profile image data. Supported roles include admin, player, and dedicated AI agent accounts."],
    ["Prediction data", "The app stores match predictions, score forecasts, tournament selections, award counters, match results, and leaderboard summaries."],
    ["AI agent data", "Dedicated AI agent accounts publicly display their provider, model, submitted predictions, score forecasts, optional reasoning, confidence, selected technical metadata, and accuracy. AI credentials and model API keys are not exposed by this app."],
    ["Location and server defaults", "For visitors, the app may use high-level request country headers from the hosting platform or browser timezone/language signals to choose a default US or India server. Players can manually switch servers when their account has access."],
    ["What is not collected", "The app does not intentionally collect precise GPS location, payment card data, advertising identifiers, or third-party marketing profiles."],
    ["Third-party services", "Team flags load from flagcdn.com. Match score sync may use football-data.org when configured. Hosting and persistent storage are handled by the deployment provider."],
    ["Data access", "Full admins can manage both servers. Regional admins can manage assigned-region player and prediction records only. Players can update their own profile and predictions before locks."],
    ["Retention", "Data remains in the SQLite database until an administrator updates or deletes it. Railway volume backups and database exports should be managed by the app owner."],
    ["Security", "Passwords are stored as hashes, sessions use HTTP-only cookies, and sensitive API keys are loaded from environment variables."],
  ];
  elements.privacyContent.innerHTML = sections.map(([title, text], index) => `
    <section class="document-section document-status-card">
      <span class="document-status-dot ${index === 0 ? "is-live" : ""}" aria-hidden="true"></span>
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(text)}</p>
    </section>
  `).join("");
}

function renderHelp() {
  const india = activeServer() === "India";
  const help = [
    ["Choose your server", "The app selects a starting server from high-level location signals when possible. Use the server control in the top right to switch if your account has access to more than one server."],
    ["Login", "Click Login and enter the login ID and temporary password shared by the administrator. After login, open Profile to update your details and password."],
    ["Save match predictions", "Open Predictions, choose the team name or Draw, optionally enter score forecasts, and save before the match lock time."],
    ["Prediction lock", "Match predictions lock before kickoff based on the app setting. Locked or settled matches cannot be changed by players."],
    ["Public picks", "Open Public Picks to see submitted player predictions by match."],
    ["AI Prediction Arena", "Open AI to compare OpenAI, Claude, and Gemini agents using the fixture-by-agent table and detailed analysis cards. Blue tags are pending, green tags are correct, gold tags are perfect-score predictions, red tags are incorrect, and a star marks a unique correct agent."],
    ["Profile cards", "Open Players to see rankings and profile cards. Click a card to flip it and view tournament predictions."],
    india
      ? ["Earn India awards", "Matchballs come from correct winner/draw predictions. Boots come from correct team goal forecasts and perfect score bonuses. Glory requires correct winner/draw plus exact score. Caps come from participation. Prestige, Legends, and Orbs come from 3, 5, and 7 correct-prediction streaks."]
      : ["US scoring", "US rankings use dollar-based net settlement in the Command Center ledger. Score forecasts are collected for engagement but do not affect US settlement right now."],
    ["Need help", "Contact the app administrator if you cannot log in, need regional access, or need a profile/account correction."],
  ];
  elements.helpContent.innerHTML = help.map(([title, text]) => `
    <article class="rule-card document-status-card">
      <span class="document-status-dot" aria-hidden="true"></span>
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
  renderAI();
  renderPlayers();
  renderProfilePage();
  renderPredictionTables();
  renderAllFixtures();
  renderGroupTables();
  renderThirdPlaceTable();
  renderRoadmap();
  renderUpdates();
  renderPrivacy();
  renderHelp();
  window.lucide?.createIcons();
}

async function refresh() {
  await detectPreferredServer();
  const [me, state, aiState] = await Promise.all([
    api("/api/me"),
    api(`/api/state?server=${encodeURIComponent(selectedServer)}`),
    api(`/api/ai/predictions?server=${encodeURIComponent(selectedServer)}`),
  ]);
  app.user = me.user;
  app.aiState = aiState;
  if (app.user?.servers?.length && !app.user.servers.includes(selectedServer)) {
    selectedServer = app.user.servers[0];
    localStorage.setItem("selectedServer", selectedServer);
    [app.state, app.aiState] = await Promise.all([
      api(`/api/state?server=${encodeURIComponent(selectedServer)}`),
      api(`/api/ai/predictions?server=${encodeURIComponent(selectedServer)}`),
    ]);
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

function setView(viewName) {
  if (viewName === "profile" && !app.user) {
    loginPanelOpen = true;
    renderAccount();
    elements.loginPanel.querySelector("input")?.focus({ preventScroll: true });
    return;
  }
  const target = document.querySelector(`#${viewName}View`);
  if (!target) return;
  document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  target.classList.add("active");
  const navButton = document.querySelector(`.nav-tab[data-view="${CSS.escape(viewName)}"]`);
  elements.viewTitle.textContent = navButton?.textContent?.trim() || target.querySelector("h3")?.textContent || "FIFA World Cup 2026";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-jump-view]");
  if (!button) return;
  setView(button.dataset.jumpView);
});

let roadmapDragState = null;

elements.roadmap.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest("button, a, input, select, textarea")) return;
  roadmapDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: elements.roadmap.scrollLeft,
    scrollTop: elements.roadmap.scrollTop,
  };
  elements.roadmap.classList.add("is-dragging");
  elements.roadmap.setPointerCapture(event.pointerId);
});

elements.roadmap.addEventListener("pointermove", (event) => {
  if (!roadmapDragState || roadmapDragState.pointerId !== event.pointerId) return;
  event.preventDefault();
  elements.roadmap.scrollLeft = roadmapDragState.scrollLeft - (event.clientX - roadmapDragState.startX);
  elements.roadmap.scrollTop = roadmapDragState.scrollTop - (event.clientY - roadmapDragState.startY);
});

function endRoadmapDrag(event) {
  if (!roadmapDragState || roadmapDragState.pointerId !== event.pointerId) return;
  roadmapDragState = null;
  elements.roadmap.classList.remove("is-dragging");
  if (elements.roadmap.hasPointerCapture(event.pointerId)) {
    elements.roadmap.releasePointerCapture(event.pointerId);
  }
}

elements.roadmap.addEventListener("pointerup", endRoadmapDrag);
elements.roadmap.addEventListener("pointercancel", endRoadmapDrag);
elements.roadmap.addEventListener("pointerleave", endRoadmapDrag);
elements.roadmapZoomIn?.addEventListener("click", () => setRoadmapZoom(roadmapZoom + 0.1));
elements.roadmapZoomOut?.addEventListener("click", () => setRoadmapZoom(roadmapZoom - 0.1));
elements.roadmapZoomReset?.addEventListener("click", () => setRoadmapZoom(1));
setRoadmapZoom(roadmapZoom);

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

elements.logoutNavButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  profilePanelOpen = false;
  loginPanelOpen = false;
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

elements.serverSwitch.addEventListener("click", async () => {
  const userServers = app.user?.servers || app.state?.settings?.servers || ["US", "India"];
  const nextServer = elements.serverSwitch.dataset.nextServer || (activeServer() === "India" ? "US" : "India");
  selectedServer = userServers.includes(nextServer) ? nextServer : userServers[0] || "US";
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

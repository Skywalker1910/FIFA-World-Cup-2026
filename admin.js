let app = { user: null, state: null, serverStates: {} };
let loginDismissed = false;
let selectedServer = localStorage.getItem("selectedServer") || "US";
let selectedBetPlayerId = localStorage.getItem("selectedBetPlayerId") || "";
let selectedAccountView = localStorage.getItem("selectedAccountView") || "players";
let selectedAccountId = localStorage.getItem("selectedAccountId") || "";

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  accountLabel: document.querySelector("#accountLabel"),
  logoutButton: document.querySelector("#logoutButton"),
  loginPanel: document.querySelector("#loginPanel"),
  loginCloseButton: document.querySelector("#loginCloseButton"),
  loginForm: document.querySelector("#loginForm"),
  adminContent: document.querySelector("#adminContent"),
  commandTabs: [...document.querySelectorAll("[data-admin-view]")],
  adminPages: [...document.querySelectorAll("[data-admin-page]")],
  createMatchForm: document.querySelector("#createMatchForm"),
  settingsForm: document.querySelector("#settingsForm"),
  syncResultsButton: document.querySelector("#syncResultsButton"),
  adminServerSwitch: document.querySelector("#adminServerSwitch"),
  adminUsers: document.querySelector("#adminUsers"),
  adminMatches: document.querySelector("#adminMatches"),
  adminBets: document.querySelector("#adminBets"),
  adminLedger: document.querySelector("#adminLedger"),
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
  let requestPath = path;
  if (path.startsWith("/api/admin/") && !path.includes("server=")) {
    requestPath += `${path.includes("?") ? "&" : "?"}server=${encodeURIComponent(selectedServer)}`;
  }
  const response = await fetch(requestPath, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "Request failed");
  return payload;
}

function dateLabel(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function optionList(selected) {
  return ["", "Team 1", "Team 2", "Draw"].map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value || "-"}</option>`).join("");
}

function betPickList(fixture, selected) {
  const options = [
    ["", "No prediction"],
    ["Team 1", fixture.team1],
    ["Team 2", fixture.team2],
    ["Draw", "Draw"],
  ];
  return options.map(([value, label]) => (
    `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function predictionValue(bet, key) {
  const value = bet?.[key];
  return value === null || value === undefined ? "" : value;
}

function statusList(selected) {
  return ["", "NS", "1H", "HT", "2H", "FT", "AET", "PEN", "PST", "CANC"].map((value) => (
    `<option value="${value}" ${value === selected ? "selected" : ""}>${value || "Status"}</option>`
  )).join("");
}

function setStatus(message) {
  elements.saveStatus.textContent = message;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      reject(new Error("Profile picture must be a PNG, JPG, GIF, or WebP image"));
      return;
    }
    if (file.size > 750_000) {
      reject(new Error("Profile picture must be smaller than 750 KB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read profile picture"));
    reader.readAsDataURL(file);
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function scoringMode() {
  return app.state?.settings?.scoringMode || "money";
}

function isFullAdmin() {
  return app.user?.role === "admin" && (app.user.servers || []).length > 1;
}

function accountRoleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "ai_agent") return "AI Agent";
  return "Player";
}

function roleBadge(role) {
  const className = role === "admin" ? "is-admin" : role === "ai_agent" ? "is-agent" : "is-player";
  return `<span class="admin-role-badge ${className}">${accountRoleLabel(role)}</span>`;
}

function accountServers(user) {
  return user.role === "ai_agent" ? ["US", "India"] : (user.servers || []);
}

function accessibleAccountUsers() {
  return app.state?.users || [];
}

function accountMatchesSearch(user, query) {
  const search = String(query || "").trim().toLowerCase();
  if (!search) return true;
  return [user.display_name, user.login_id, accountRoleLabel(user.role), ...(accountServers(user) || [])]
    .join(" ")
    .toLowerCase()
    .includes(search);
}

function accountCard(user, options = {}) {
  const active = String(user.id) === String(selectedAccountId);
  return `
    <button class="account-record-card ${active ? "active" : ""}" data-select-account="${user.id}" type="button">
      <span>
        <strong>${escapeHtml(user.display_name)}</strong>
        <small>${escapeHtml(user.login_id)} · ${accountServers(user).join(", ") || "No server"}</small>
      </span>
      <span class="account-record-card-meta">
        ${roleBadge(user.role)}
        <em class="${user.is_active ? "is-active" : "is-inactive"}">${user.is_active ? "Active" : "Inactive"}</em>
      </span>
      ${options.detail ? `<p>${escapeHtml(options.detail)}</p>` : ""}
    </button>
  `;
}

function selectedAccount(users = accessibleAccountUsers()) {
  return users.find((user) => String(user.id) === String(selectedAccountId));
}

function ensureSelectedAccount(users) {
  if (!users.length) {
    selectedAccountId = "";
    localStorage.removeItem("selectedAccountId");
    return null;
  }
  if (!users.some((user) => String(user.id) === String(selectedAccountId))) {
    selectedAccountId = String(users[0].id);
    localStorage.setItem("selectedAccountId", selectedAccountId);
  }
  return selectedAccount(users);
}

function accountServerChecks(user, options = {}) {
  const disabled = options.disabled ? "disabled" : "";
  const checkedServers = user ? accountServers(user) : (isFullAdmin() ? [selectedServer] : app.user?.servers || ["US"]);
  return ["US", "India"].map((server) => {
    const checked = checkedServers.includes(server) ? "checked" : "";
    const serverDisabled = user?.role === "ai_agent" ? "disabled" : disabled;
    return `<label class="admin-check"><input data-account-server="${server}" name="serverAccess" type="checkbox" value="${server}" ${checked} ${serverDisabled}> ${server}</label>`;
  }).join("");
}

function renderAccountEditor(user) {
  if (!user) {
    return `<div class="empty-state">Select an account to edit its records.</div>`;
  }
  const canChangeRole = isFullAdmin();
  const canDelete = isFullAdmin() && user.id !== app.user?.id;
  const aiFields = user.role === "ai_agent" ? `
    <div class="account-avatar-field is-wide">
      <div class="account-avatar-preview">${user.avatar_data ? `<img src="${escapeHtml(user.avatar_data)}" alt="">` : "AI"}</div>
      <label>
        <span>AI profile picture</span>
        <input data-account-avatar type="file" accept="image/png,image/jpeg,image/webp,image/gif">
      </label>
    </div>
    <div class="account-form-row is-wide">
      <input data-account-field="aiProvider" value="${escapeHtml(user.ai_provider || "")}" placeholder="AI provider">
      <input data-account-field="aiModel" value="${escapeHtml(user.ai_model || "")}" placeholder="AI model">
    </div>
    <p class="account-form-note">AI agent responses and predictions are shared across both US and India servers. Match prediction records remain server-scoped.</p>
  ` : "";
  return `
    <section class="account-editor admin-user" data-id="${user.id}">
      <div class="account-editor-heading">
        <div>
          <strong>${escapeHtml(user.display_name)}</strong>
          <small>${escapeHtml(user.login_id)} · ${accountServers(user).join(", ")}</small>
        </div>
        <div>
          ${roleBadge(user.role)}
          <span class="admin-role-badge ${user.is_active ? "is-active" : "is-inactive"}">${user.is_active ? "Active" : "Inactive"}</span>
        </div>
      </div>
      <div class="account-form-grid">
        <input data-account-field="displayName" value="${escapeHtml(user.display_name)}" placeholder="Display name">
        <input data-account-field="loginId" value="${escapeHtml(user.login_id)}" placeholder="Login ID">
        <input data-account-field="password" type="password" placeholder="New password">
        <select data-account-field="role" ${canChangeRole ? "" : "disabled"}>
          <option value="player" ${user.role === "player" ? "selected" : ""}>Player</option>
          <option value="ai_agent" ${user.role === "ai_agent" ? "selected" : ""}>AI Agent</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
        <div class="account-server-field">
          <span>Server access</span>
          ${accountServerChecks(user, { disabled: !isFullAdmin() })}
        </div>
        <label class="account-toggle account-active-toggle">
          <input data-account-field="isActive" type="checkbox" ${user.is_active ? "checked" : ""}>
          <span></span>
          <strong>Active account</strong>
        </label>
        ${aiFields}
      </div>
      <div class="account-editor-actions">
        <button class="primary-button" data-save-account="true" type="button"><i data-lucide="save"></i>Save account</button>
        ${canDelete ? `<button class="danger-button" data-delete-account="true" type="button"><i data-lucide="trash-2"></i>Delete account</button>` : ""}
      </div>
    </section>
  `;
}

function renderCreateAccountForm(role) {
  const isAiAgent = role === "ai_agent";
  const title = isAiAgent ? "Create AI Agent" : "Add Player";
  const submitLabel = isAiAgent ? "Create AI agent" : "Add player";
  return `
    <section class="account-create-card">
      <div class="account-section-heading">
        <div>
          <strong>${title}</strong>
          <small>${isAiAgent ? "Agent credentials are used by automated prediction workflows." : "Player credentials are shared manually by an admin."}</small>
        </div>
        ${roleBadge(role)}
      </div>
      <form class="form-grid account-create-form" data-create-account-form data-create-role="${role}">
        <input name="displayName" placeholder="Display name" required>
        <input name="loginId" placeholder="Login ID" required>
        <input name="password" placeholder="Temporary password" required>
        ${isAiAgent ? `
          <div class="account-avatar-field is-wide">
            <div class="account-avatar-preview">AI</div>
            <label>
              <span>AI profile picture</span>
              <input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
            </label>
          </div>
          <input name="aiProvider" placeholder="AI provider (OpenAI)">
          <input name="aiModel" placeholder="AI model (gpt-5.5)">
          <p class="account-form-note">AI agents are created with access to both servers so their responses can be shown globally.</p>
        ` : `
          <div class="account-server-field">
            <span>Server access</span>
            ${accountServerChecks(null, { disabled: !isFullAdmin() })}
          </div>
        `}
        <button class="primary-button" type="submit"><i data-lucide="user-plus"></i>${submitLabel}</button>
      </form>
    </section>
  `;
}

function renderAccountRecords() {
  const users = accessibleAccountUsers();
  const activeServer = selectedServer;
  const playerUsers = users.filter((user) => user.role === "player" && accountServers(user).includes(activeServer));
  const editableUsers = users.filter((user) => isFullAdmin() || (user.role === "player" && accountServers(user).includes(activeServer)));
  const aiUsers = users.filter((user) => user.role === "ai_agent");
  const accountTabs = [
    ["players", "Players"],
    ["edit", "Edit Account"],
    ["agents", "AI Agents"],
    ["add-player", "Add Player"],
    ...(isFullAdmin() ? [["create-agent", "Create AI Agent"]] : []),
  ];
  if (!accountTabs.some(([view]) => view === selectedAccountView)) {
    selectedAccountView = "players";
    localStorage.setItem("selectedAccountView", selectedAccountView);
  }
  const search = document.querySelector("[data-account-search]")?.value || "";
  const searchableUsers = editableUsers.filter((user) => accountMatchesSearch(user, search));
  if (["players", "edit", "agents"].includes(selectedAccountView)) {
    ensureSelectedAccount(selectedAccountView === "agents" ? aiUsers : selectedAccountView === "players" ? playerUsers : editableUsers);
  }
  const body = (() => {
    if (selectedAccountView === "players") {
      return `
        <div class="account-list-grid">
          <div class="account-list-panel">
            <div class="account-section-heading">
              <div>
                <strong>${escapeHtml(activeServer)} Players</strong>
                <small>${playerUsers.length} player accounts assigned to this server</small>
              </div>
              <span class="server-section-kicker">${escapeHtml(activeServer)}</span>
            </div>
            ${playerUsers.length ? playerUsers.map((user) => accountCard(user)).join("") : `<div class="empty-state">No players assigned to ${escapeHtml(activeServer)}.</div>`}
          </div>
          ${renderAccountEditor(selectedAccount(playerUsers))}
        </div>
      `;
    }
    if (selectedAccountView === "edit") {
      return `
        <div class="account-list-grid">
          <div class="account-list-panel">
            <div class="account-section-heading">
              <div>
                <strong>Search Accounts</strong>
                <small>Select one account, then update the fields on the right.</small>
              </div>
              <input data-account-search value="${escapeHtml(search)}" placeholder="Search name, login, role, server">
            </div>
            ${searchableUsers.length ? searchableUsers.map((user) => accountCard(user)).join("") : `<div class="empty-state">No matching accounts.</div>`}
          </div>
          ${renderAccountEditor(selectedAccount(searchableUsers) || selectedAccount(editableUsers))}
        </div>
      `;
    }
    if (selectedAccountView === "agents") {
      return `
        <div class="account-list-grid">
          <div class="account-list-panel">
            <div class="account-section-heading">
              <div>
                <strong>AI Agents</strong>
                <small>${aiUsers.filter((user) => user.is_active).length} active · ${aiUsers.filter((user) => !user.is_active).length} inactive</small>
              </div>
              ${roleBadge("ai_agent")}
            </div>
            ${aiUsers.length ? aiUsers.map((user) => accountCard(user, { detail: `${user.ai_provider || "AI"} ${user.ai_model || ""}`.trim() })).join("") : `<div class="empty-state">No AI agents created yet.</div>`}
          </div>
          ${isFullAdmin() ? renderAccountEditor(selectedAccount(aiUsers)) : `<div class="empty-state">AI agents are globally managed by the main admin.</div>`}
        </div>
      `;
    }
    if (selectedAccountView === "add-player") return renderCreateAccountForm("player");
    if (selectedAccountView === "create-agent") return renderCreateAccountForm("ai_agent");
    return "";
  })();
  return `
    <div class="account-record-tabs">
      ${accountTabs.map(([view, label]) => `<button class="${view === selectedAccountView ? "active" : ""}" data-account-view="${view}" type="button">${escapeHtml(label)}</button>`).join("")}
    </div>
    ${body}
  `;
}

function scoreValue(value) {
  return scoringMode() === "points" ? `${Number(value || 0)} pts` : formatMoney(value);
}

function setAdminView(view) {
  if (!isFullAdmin() && ["scores", "settings"].includes(view)) view = "bets";
  elements.commandTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.adminView === view));
  elements.adminPages.forEach((page) => {
    page.hidden = page.dataset.adminPage !== view;
  });
}

function closeLoginPanel() {
  loginDismissed = true;
  elements.loginPanel.hidden = true;
  setStatus("Admin login dismissed");
}

function ledgerRows() {
  if (scoringMode() === "points") return { balances: [], rows: [] };
  const balances = app.state.leaderboard
    .map((player) => ({
      name: player.display_name,
      balance: Math.round(Number(player.net || 0) * 100) / 100,
    }))
    .filter((player) => player.balance !== 0);
  const debtors = balances
    .filter((player) => player.balance < 0)
    .map((player) => ({ ...player, remaining: Math.abs(player.balance) }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balances
    .filter((player) => player.balance > 0)
    .map((player) => ({ ...player, remaining: player.balance }))
    .sort((a, b) => b.remaining - a.remaining);
  const rows = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0.0001) {
      rows.push({ from: debtor.name, to: creditor.name, amount });
    }
    debtor.remaining = Math.round((debtor.remaining - amount) * 100) / 100;
    creditor.remaining = Math.round((creditor.remaining - amount) * 100) / 100;
    if (debtor.remaining <= 0.0001) debtorIndex += 1;
    if (creditor.remaining <= 0.0001) creditorIndex += 1;
  }
  return { balances, rows };
}

function renderAccount() {
  const isAdmin = app.user?.role === "admin";
  elements.accountLabel.textContent = app.user ? `${app.user.display_name} (${app.user.role}) · ${app.state?.settings?.server || selectedServer}` : "Not signed in";
  elements.loginPanel.hidden = isAdmin || loginDismissed;
  elements.adminContent.style.display = isAdmin ? "" : "none";
  elements.logoutButton.hidden = !app.user;
  setStatus(isAdmin ? "Admin connected" : "Admin login required");
}

function renderAdminBetsTable(server, state) {
  const players = state.users.filter((user) => ["player", "ai_agent"].includes(user.role) && user.is_active && (user.servers || []).includes(server));
  if (players.length && !players.some((player) => String(player.id) === String(selectedBetPlayerId))) {
    selectedBetPlayerId = String(players[0].id);
    localStorage.setItem("selectedBetPlayerId", selectedBetPlayerId);
  }
  const selectedPlayer = players.find((player) => String(player.id) === String(selectedBetPlayerId));
  return `
    <section class="admin-server-bets" data-bets-server-section="${escapeHtml(server)}">
      <div class="admin-server-bets-heading">
        <div>
          <span class="server-section-kicker">${escapeHtml(server)} server</span>
          <h4>${escapeHtml(server)} Player Predictions</h4>
        </div>
        <span>${players.length} players · ${state.fixtures.length} matches</span>
      </div>
      ${players.length ? "" : `<div class="empty-state">No active players are assigned to the ${escapeHtml(server)} server yet.</div>`}
      ${players.length ? `
        <div class="admin-player-bet-toolbar">
          <label>
            <span>Editing player</span>
            <select data-admin-bet-player>
              ${players.map((player) => `
                <option value="${player.id}" ${String(player.id) === String(selectedBetPlayerId) ? "selected" : ""}>
                  ${escapeHtml(player.display_name)}
                </option>
              `).join("")}
            </select>
          </label>
          <p>Only this player’s predictions are shown below. Change the player from this dropdown to edit another record set.</p>
        </div>
      ` : ""}
      <div class="admin-bets-table" data-server="${escapeHtml(server)}">
        <div class="admin-bets-header">
          <strong>Match</strong>
          <strong>${selectedPlayer ? escapeHtml(selectedPlayer.display_name) : "Player prediction"}</strong>
          <strong>Action</strong>
        </div>
        ${state.fixtures.map((fixture) => `
          <div class="admin-bets-row" data-match-id="${fixture.id}" data-server="${escapeHtml(server)}">
            <div class="admin-match-summary">
              <strong>#${fixture.id} ${escapeHtml(fixture.team1)} vs ${escapeHtml(fixture.team2)}</strong>
              <small>${dateLabel(fixture.date)} · ${escapeHtml(fixture.stage || "")} ${escapeHtml(fixture.group || "")}</small>
            </div>
            <div class="admin-single-bet-cell">
              ${selectedPlayer ? `
                <label>
                  <span>Pick</span>
                  <select data-bet-pick data-user-id="${selectedPlayer.id}" aria-label="${escapeHtml(selectedPlayer.display_name)} pick for match ${fixture.id}">
                    ${betPickList(fixture, fixture.bets[selectedPlayer.id]?.pick)}
                  </select>
                </label>
                <label>
                  <span>Score prediction</span>
                  <div class="score-prediction">
                    <input data-admin-score-team1 data-user-id="${selectedPlayer.id}" type="number" min="0" step="1" value="${escapeHtml(predictionValue(fixture.bets[selectedPlayer.id], "predictedTeam1Score"))}" placeholder="${escapeHtml(fixture.team1)}">
                    <span>-</span>
                    <input data-admin-score-team2 data-user-id="${selectedPlayer.id}" type="number" min="0" step="1" value="${escapeHtml(predictionValue(fixture.bets[selectedPlayer.id], "predictedTeam2Score"))}" placeholder="${escapeHtml(fixture.team2)}">
                  </div>
                </label>
              ` : `<div class="empty-state">Select a player to edit predictions.</div>`}
            </div>
            <button class="secondary-light-button" data-save-bet-row="true" type="button" ${selectedPlayer ? "" : "disabled"}>Save</button>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAdmin() {
  if (app.user?.role !== "admin" || !app.state) return;
  elements.commandTabs.forEach((tab) => {
    tab.hidden = !isFullAdmin() && ["scores", "settings"].includes(tab.dataset.adminView);
  });
  if (!isFullAdmin() && !["bets", "players", "ledger"].includes(document.querySelector(".command-tab.active")?.dataset.adminView)) {
    setAdminView("bets");
  }
  const accessibleServers = app.user.servers || ["US"];
  const betServerList = accessibleServers.map((server) => `<span>${escapeHtml(server)}</span>`).join("");
  const activeBetServer = accessibleServers.includes(selectedServer) ? selectedServer : accessibleServers[0];
  const activeBetState = app.serverStates[activeBetServer] || app.state;
  elements.adminServerSwitch.innerHTML = accessibleServers.map((server) => `
    <button class="${server === selectedServer ? "active" : ""}" data-admin-server-option="${escapeHtml(server)}" type="button">${escapeHtml(server)}</button>
  `).join("");
  elements.settingsForm.stake.value = app.state.settings.stake;
  elements.settingsForm.lockMinutes.value = app.state.settings.lockMinutes;
  elements.adminUsers.innerHTML = renderAccountRecords();
  elements.adminMatches.innerHTML = app.state.fixtures.map((fixture) => `
    <div class="admin-match" data-id="${fixture.id}">
      <div class="admin-match-summary">
        <strong>#${fixture.id} ${escapeHtml(fixture.team1)} vs ${escapeHtml(fixture.team2)}</strong>
        <small>${dateLabel(fixture.date)} ${escapeHtml(fixture.kickoff || "")} · ${escapeHtml(fixture.venue || "Venue TBD")}</small>
      </div>
      <input data-field="stage" value="${escapeHtml(fixture.stage || "")}" placeholder="Stage">
      <input data-field="groupName" value="${escapeHtml(fixture.group || "")}" placeholder="Group">
      <input data-field="date" type="date" value="${escapeHtml(fixture.date || "")}">
      <input data-field="kickoff" value="${escapeHtml(fixture.kickoff || "")}" placeholder="Kickoff">
      <input data-field="venue" value="${escapeHtml(fixture.venue || "")}" placeholder="Venue">
      <input data-field="team1" value="${escapeHtml(fixture.team1 || "")}" placeholder="Team 1">
      <input data-field="team2" value="${escapeHtml(fixture.team2 || "")}" placeholder="Team 2">
      <input data-field="team1Score" type="number" min="0" value="${fixture.team1Score ?? ""}" placeholder="T1 score">
      <input data-field="team2Score" type="number" min="0" value="${fixture.team2Score ?? ""}" placeholder="T2 score">
      <select data-field="result">${optionList(fixture.result)}</select>
      <select data-field="matchStatus">${statusList(fixture.status)}</select>
      <input data-field="notes" value="${escapeHtml(fixture.notes || "")}" placeholder="Notes">
      <button class="secondary-light-button" data-save-match="true" type="button">Save</button>
    </div>
  `).join("");
  elements.adminBets.innerHTML = `
    <div class="admin-bets-overview">
      <strong>${escapeHtml(activeBetServer)} prediction table</strong>
      <p>Use the server switch above to load the US or India prediction table. Each server writes to its own prediction records.</p>
      <div>${betServerList}</div>
    </div>
    ${renderAdminBetsTable(activeBetServer, activeBetState)}
  `;
  const ledger = ledgerRows();
  elements.adminLedger.innerHTML = `
    <div class="ledger-grid">
      ${app.state.leaderboard.map((player) => `
        <div class="ledger-balance ${Number(player.net) >= 0 ? "positive" : "negative"}">
          <strong>${escapeHtml(player.display_name)}</strong>
          <span>${scoreValue(scoringMode() === "points" ? player.points : player.net)}</span>
          <small>${player.correct} correct · ${player.bets_entered} predictions</small>
        </div>
      `).join("")}
    </div>
    <div class="ledger-settlements">
      ${scoringMode() === "points" ? `<div class="empty-state">India server uses points only. No cash ledger is required.</div>` : ledger.rows.length ? ledger.rows.map((row) => `
        <div class="ledger-row">
          <strong>${escapeHtml(row.from)}</strong>
          <span>pays</span>
          <strong>${escapeHtml(row.to)}</strong>
          <b>${formatMoney(row.amount)}</b>
        </div>
      `).join("") : `<div class="empty-state">No settlement required yet.</div>`}
    </div>
  `;
  window.lucide && window.lucide.createIcons();
}

function renderAll() {
  renderAccount();
  renderAdmin();
}

async function refresh() {
  const me = await api("/api/me");
  app.user = me.user;
  const accessibleServers = app.user?.servers?.length ? app.user.servers : ["US"];
  if (!accessibleServers.includes(selectedServer)) selectedServer = accessibleServers[0];
  const states = await Promise.all(accessibleServers.map((server) => api(`/api/state?server=${encodeURIComponent(server)}`)));
  app.serverStates = Object.fromEntries(accessibleServers.map((server, index) => [server, states[index]]));
  app.state = app.serverStates[selectedServer] || states[0];
  selectedServer = app.state.settings.server;
  localStorage.setItem("selectedServer", selectedServer);
  renderAll();
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(elements.loginForm));
  await api("/api/login", { method: "POST", body: JSON.stringify(data) });
  loginDismissed = false;
  elements.loginForm.reset();
  await refresh();
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  loginDismissed = false;
  await refresh();
});

elements.loginCloseButton.addEventListener("click", closeLoginPanel);

elements.loginPanel.addEventListener("click", (event) => {
  if (event.target === elements.loginPanel) closeLoginPanel();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.loginPanel.hidden && app.user?.role !== "admin") closeLoginPanel();
});

elements.commandTabs.forEach((tab) => {
  tab.addEventListener("click", () => setAdminView(tab.dataset.adminView));
});

elements.adminServerSwitch.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-admin-server-option]");
  if (!button) return;
  selectedServer = button.dataset.adminServerOption;
  selectedBetPlayerId = "";
  selectedAccountId = "";
  localStorage.removeItem("selectedBetPlayerId");
  localStorage.removeItem("selectedAccountId");
  localStorage.setItem("selectedServer", selectedServer);
  await refresh();
});

elements.adminBets.addEventListener("change", (event) => {
  const select = event.target.closest("[data-admin-bet-player]");
  if (!select) return;
  selectedBetPlayerId = select.value;
  localStorage.setItem("selectedBetPlayerId", selectedBetPlayerId);
  renderAll();
});

elements.createMatchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = Object.fromEntries(new FormData(elements.createMatchForm));
    const payload = await api("/api/admin/matches", { method: "POST", body: JSON.stringify(data) });
    app.state = payload.state;
    elements.createMatchForm.reset();
    setStatus("Match created");
    renderAll();
  } catch (error) {
    setStatus(error.message);
  }
});

elements.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = await api("/api/admin/settings", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(elements.settingsForm))) });
  app.state = payload.state;
  renderAll();
});

elements.adminMatches.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-match]");
  if (!button) return;
  const row = button.closest(".admin-match");
  try {
    const values = Object.fromEntries([...row.querySelectorAll("[data-field]")].map((input) => [input.dataset.field, input.value]));
    const payload = await api(`/api/admin/matches/${row.dataset.id}`, { method: "PATCH", body: JSON.stringify(values) });
    app.state = payload.state;
    setStatus(`Match #${row.dataset.id} saved`);
    renderAll();
  } catch (error) {
    setStatus(error.message);
  }
});

elements.adminUsers.addEventListener("change", (event) => {
  if (event.target.closest("[data-account-search]")) {
    renderAll();
    return;
  }
  const avatarInput = event.target.closest("[data-account-avatar], [name='avatar']");
  if (!avatarInput) return;
  const preview = avatarInput.closest(".account-avatar-field")?.querySelector(".account-avatar-preview");
  const file = avatarInput.files?.[0];
  if (!preview || !file) return;
  fileToDataUrl(file)
    .then((dataUrl) => {
      preview.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="">`;
    })
    .catch((error) => {
      avatarInput.value = "";
      setStatus(error.message);
    });
});

elements.adminUsers.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-create-account-form]");
  if (!form) return;
  event.preventDefault();
  try {
    const formData = new FormData(form);
    const role = form.dataset.createRole === "ai_agent" && isFullAdmin() ? "ai_agent" : "player";
    const data = Object.fromEntries(formData);
    data.role = role;
    data.avatarData = role === "ai_agent" ? await fileToDataUrl(form.querySelector("[name='avatar']")?.files?.[0]) : "";
    data.serverAccess = role === "ai_agent"
      ? ["US", "India"]
      : isFullAdmin()
        ? formData.getAll("serverAccess")
        : (app.user?.servers || ["US"]);
    const payload = await api("/api/admin/users", { method: "POST", body: JSON.stringify(data) });
    app.state = payload.state;
    form.reset();
    setStatus(role === "ai_agent" ? "AI agent created" : "Player created");
    renderAll();
  } catch (error) {
    setStatus(error.message);
  }
});

elements.adminUsers.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-account-view]");
  if (viewButton) {
    selectedAccountView = viewButton.dataset.accountView;
    localStorage.setItem("selectedAccountView", selectedAccountView);
    renderAll();
    return;
  }

  const selectAccountButton = event.target.closest("[data-select-account]");
  if (selectAccountButton) {
    selectedAccountId = selectAccountButton.dataset.selectAccount;
    localStorage.setItem("selectedAccountId", selectedAccountId);
    renderAll();
    return;
  }

  const deleteButton = event.target.closest("[data-delete-account]");
  if (deleteButton) {
    const row = deleteButton.closest(".admin-user");
    const userName = row.querySelector(".account-editor-heading strong")?.textContent || "this account";
    if (!window.confirm(`Delete ${userName}? This removes their account, sessions, and prediction records.`)) return;
    try {
      const payload = await api(`/api/admin/users/${row.dataset.id}/delete`, { method: "POST", body: "{}" });
      app.state = payload.state;
      selectedAccountId = "";
      localStorage.removeItem("selectedAccountId");
      setStatus("User deleted");
      renderAll();
    } catch (error) {
      setStatus(error.message);
    }
    return;
  }

  const button = event.target.closest("[data-save-account]");
  if (!button) return;
  const row = button.closest(".admin-user");
  try {
    const values = {};
    row.querySelectorAll("[data-account-field]").forEach((input) => {
      values[input.dataset.accountField] = input.type === "checkbox" ? input.checked : input.value;
    });
    values.serverAccess = values.role === "ai_agent"
      ? ["US", "India"]
      : [...row.querySelectorAll("[data-account-server]:checked")].map((input) => input.dataset.accountServer);
    const avatarData = await fileToDataUrl(row.querySelector("[data-account-avatar]")?.files?.[0]);
    if (avatarData) values.avatarData = avatarData;
    const payload = await api(`/api/admin/users/${row.dataset.id}`, { method: "PATCH", body: JSON.stringify(values) });
    app.state = payload.state;
    setStatus("Account saved");
    renderAll();
  } catch (error) {
    setStatus(error.message);
  }
});

elements.adminBets.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-bet-row]");
  if (!button) return;
  const row = button.closest(".admin-bets-row");
  const rowServer = row.dataset.server || selectedServer;
  try {
    let nextState = app.state;
    const select = row.querySelector("[data-bet-pick]");
    if (!select) return;
    const userId = select.dataset.userId;
    const payload = await api("/api/admin/bets", {
      method: "POST",
      body: JSON.stringify({
        matchId: row.dataset.matchId,
        userId,
        server: rowServer,
        pick: select.value,
        predictedTeam1Score: row.querySelector(`[data-admin-score-team1][data-user-id="${CSS.escape(userId)}"]`)?.value || "",
        predictedTeam2Score: row.querySelector(`[data-admin-score-team2][data-user-id="${CSS.escape(userId)}"]`)?.value || "",
      }),
    });
    nextState = payload.state;
    app.serverStates[rowServer] = nextState;
    if (rowServer === selectedServer) app.state = nextState;
    setStatus(`${rowServer} prediction saved for match #${row.dataset.matchId}`);
    renderAll();
  } catch (error) {
    setStatus(error.message);
  }
});

elements.syncResultsButton.addEventListener("click", async () => {
  const payload = await api("/api/admin/sync-results", { method: "POST", body: "{}" });
  app.state = payload.state;
  setStatus(payload.message);
  renderAll();
});

refresh().catch((error) => {
  elements.saveStatus.textContent = error.message;
  console.error(error);
});

let app = { user: null, state: null };
let loginDismissed = false;

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
  createUserForm: document.querySelector("#createUserForm"),
  createMatchForm: document.querySelector("#createMatchForm"),
  settingsForm: document.querySelector("#settingsForm"),
  syncResultsButton: document.querySelector("#syncResultsButton"),
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
  const response = await fetch(path, {
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

function betPickList(selected) {
  return ["", "Team 1", "Team 2", "Draw"].map((value) => (
    `<option value="${value}" ${value === selected ? "selected" : ""}>${value || "No bet"}</option>`
  )).join("");
}

function statusList(selected) {
  return ["", "NS", "1H", "HT", "2H", "FT", "AET", "PEN", "PST", "CANC"].map((value) => (
    `<option value="${value}" ${value === selected ? "selected" : ""}>${value || "Status"}</option>`
  )).join("");
}

function setStatus(message) {
  elements.saveStatus.textContent = message;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function setAdminView(view) {
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
  elements.accountLabel.textContent = app.user ? `${app.user.display_name} (${app.user.role})` : "Not signed in";
  elements.loginPanel.hidden = isAdmin || loginDismissed;
  elements.adminContent.style.display = isAdmin ? "" : "none";
  elements.logoutButton.style.display = app.user ? "" : "none";
  setStatus(isAdmin ? "Admin connected" : "Admin login required");
}

function renderAdmin() {
  if (app.user?.role !== "admin" || !app.state) return;
  elements.settingsForm.stake.value = app.state.settings.stake;
  elements.settingsForm.lockMinutes.value = app.state.settings.lockMinutes;
  elements.adminUsers.innerHTML = app.state.users.map((user) => `
    <div class="compact-item admin-user" data-id="${user.id}">
      <div class="admin-item-title">
        <strong>${escapeHtml(user.display_name)}</strong>
        <small>${escapeHtml(user.login_id)} / ${user.role === "admin" ? "Admin" : "Player"}</small>
      </div>
      <input data-user-field="displayName" value="${escapeHtml(user.display_name)}" placeholder="Display name">
      <input data-user-field="loginId" value="${escapeHtml(user.login_id)}" placeholder="Login ID">
      <input data-user-field="password" type="password" placeholder="New password">
      <select data-user-field="role">
        <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
        <option value="player" ${user.role === "player" ? "selected" : ""}>Player</option>
      </select>
      <label class="admin-check"><input data-user-field="isActive" type="checkbox" ${user.is_active ? "checked" : ""}> Active</label>
      <button class="secondary-light-button" data-save-user="true" type="button">Save</button>
      <button class="danger-button admin-delete-button" data-delete-user="true" type="button" ${user.id === app.user?.id ? "disabled title=\"You cannot delete your own admin account\"" : ""}>Delete</button>
    </div>
  `).join("");
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
  const players = app.state.users.filter((user) => user.role === "player" && user.is_active);
  elements.adminBets.innerHTML = `
    <div class="admin-bets-table">
      <div class="admin-bets-header">
        <strong>Match</strong>
        <div class="admin-bet-picks-grid" style="--player-count: ${players.length}">
          ${players.map((player) => `
            <strong title="${escapeHtml(player.display_name)}">
              ${escapeHtml(player.display_name)}
            </strong>
          `).join("")}
        </div>
        <strong>Action</strong>
      </div>
      ${app.state.fixtures.map((fixture) => `
        <div class="admin-bets-row" data-match-id="${fixture.id}">
          <div class="admin-match-summary">
            <strong>#${fixture.id} ${escapeHtml(fixture.team1)} vs ${escapeHtml(fixture.team2)}</strong>
            <small>${dateLabel(fixture.date)} · ${escapeHtml(fixture.stage || "")} ${escapeHtml(fixture.group || "")}</small>
          </div>
          <div class="admin-bet-picks-grid" style="--player-count: ${players.length}">
            ${players.map((player) => `
              <label class="admin-bet-pick-cell">
                <span>${escapeHtml(player.display_name)}</span>
                <select data-bet-pick data-user-id="${player.id}" aria-label="${escapeHtml(player.display_name)} pick for match ${fixture.id}">
                  ${betPickList(fixture.bets[player.id])}
                </select>
              </label>
            `).join("")}
          </div>
          <button class="secondary-light-button" data-save-bet-row="true" type="button">Save Row</button>
        </div>
      `).join("")}
    </div>
  `;
  const ledger = ledgerRows();
  elements.adminLedger.innerHTML = `
    <div class="ledger-grid">
      ${app.state.leaderboard.map((player) => `
        <div class="ledger-balance ${Number(player.net) >= 0 ? "positive" : "negative"}">
          <strong>${escapeHtml(player.display_name)}</strong>
          <span>${formatMoney(player.net)}</span>
          <small>${player.correct} correct · ${player.bets_entered} bets</small>
        </div>
      `).join("")}
    </div>
    <div class="ledger-settlements">
      ${ledger.rows.length ? ledger.rows.map((row) => `
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
  const [me, state] = await Promise.all([api("/api/me"), api("/api/state")]);
  app.user = me.user;
  app.state = state;
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

elements.createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = Object.fromEntries(new FormData(elements.createUserForm));
    const payload = await api("/api/admin/users", { method: "POST", body: JSON.stringify(data) });
    app.state = payload.state;
    elements.createUserForm.reset();
    setStatus("User created");
    renderAll();
  } catch (error) {
    setStatus(error.message);
  }
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

elements.adminUsers.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-user]");
  if (deleteButton) {
    const row = deleteButton.closest(".admin-user");
    const userName = row.querySelector(".admin-item-title strong")?.textContent || "this user";
    if (!window.confirm(`Delete ${userName}? This removes their account, sessions, and bets.`)) return;
    try {
      const payload = await api(`/api/admin/users/${row.dataset.id}/delete`, { method: "POST", body: "{}" });
      app.state = payload.state;
      setStatus("User deleted");
      renderAll();
    } catch (error) {
      setStatus(error.message);
    }
    return;
  }

  const button = event.target.closest("[data-save-user]");
  if (!button) return;
  const row = button.closest(".admin-user");
  try {
    const values = {};
    row.querySelectorAll("[data-user-field]").forEach((input) => {
      values[input.dataset.userField] = input.type === "checkbox" ? input.checked : input.value;
    });
    const payload = await api(`/api/admin/users/${row.dataset.id}`, { method: "PATCH", body: JSON.stringify(values) });
    app.state = payload.state;
    setStatus("User saved");
    renderAll();
  } catch (error) {
    setStatus(error.message);
  }
});

elements.adminBets.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-bet-row]");
  if (!button) return;
  const row = button.closest(".admin-bets-row");
  try {
    let nextState = app.state;
    for (const select of row.querySelectorAll("[data-bet-pick]")) {
      const payload = await api("/api/admin/bets", {
        method: "POST",
        body: JSON.stringify({
          matchId: row.dataset.matchId,
          userId: select.dataset.userId,
          pick: select.value,
        }),
      });
      nextState = payload.state;
    }
    app.state = nextState;
    setStatus(`Bet saved for match #${row.dataset.matchId}`);
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

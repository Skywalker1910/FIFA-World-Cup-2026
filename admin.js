let app = { user: null, state: null };

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  accountLabel: document.querySelector("#accountLabel"),
  logoutButton: document.querySelector("#logoutButton"),
  loginPanel: document.querySelector("#loginPanel"),
  loginForm: document.querySelector("#loginForm"),
  adminContent: document.querySelector("#adminContent"),
  createUserForm: document.querySelector("#createUserForm"),
  settingsForm: document.querySelector("#settingsForm"),
  syncResultsButton: document.querySelector("#syncResultsButton"),
  adminUsers: document.querySelector("#adminUsers"),
  adminMatches: document.querySelector("#adminMatches"),
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

function renderAccount() {
  const isAdmin = app.user?.role === "admin";
  elements.accountLabel.textContent = app.user ? `${app.user.display_name} (${app.user.role})` : "Not signed in";
  elements.loginPanel.style.display = isAdmin ? "none" : "";
  elements.adminContent.style.display = isAdmin ? "" : "none";
  elements.logoutButton.style.display = app.user ? "" : "none";
  elements.saveStatus.textContent = isAdmin ? "Admin connected" : "Admin login required";
}

function renderAdmin() {
  if (app.user?.role !== "admin" || !app.state) return;
  elements.settingsForm.stake.value = app.state.settings.stake;
  elements.settingsForm.lockMinutes.value = app.state.settings.lockMinutes;
  elements.adminUsers.innerHTML = app.state.users.map((user) => `
    <div class="compact-item">
      <div><strong>${escapeHtml(user.display_name)}</strong><small>${escapeHtml(user.login_id)} / ${user.role}</small></div>
      <strong>${user.is_active ? "Active" : "Off"}</strong>
    </div>
  `).join("");
  elements.adminMatches.innerHTML = app.state.fixtures.map((fixture) => `
    <div class="admin-match" data-id="${fixture.id}">
      <div><strong>#${fixture.id} ${escapeHtml(fixture.team1)} vs ${escapeHtml(fixture.team2)}</strong><small>${dateLabel(fixture.date)} ${escapeHtml(fixture.kickoff || "")}</small></div>
      <input data-field="team1Score" type="number" min="0" value="${fixture.team1Score ?? ""}" placeholder="${escapeHtml(fixture.team1)}">
      <input data-field="team2Score" type="number" min="0" value="${fixture.team2Score ?? ""}" placeholder="${escapeHtml(fixture.team2)}">
      <select data-field="result">${optionList(fixture.result)}</select>
      <button class="secondary-light-button" data-save-match type="button">Save</button>
    </div>
  `).join("");
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
  elements.loginForm.reset();
  await refresh();
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  await refresh();
});

elements.createUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(elements.createUserForm));
  const payload = await api("/api/admin/users", { method: "POST", body: JSON.stringify(data) });
  app.state = payload.state;
  elements.createUserForm.reset();
  renderAll();
});

elements.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = await api("/api/admin/settings", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(elements.settingsForm))) });
  app.state = payload.state;
  renderAll();
});

elements.adminMatches.addEventListener("click", async (event) => {
  if (!event.target.dataset.saveMatch) return;
  const row = event.target.closest(".admin-match");
  const values = Object.fromEntries([...row.querySelectorAll("[data-field]")].map((input) => [input.dataset.field, input.value]));
  const payload = await api(`/api/admin/matches/${row.dataset.id}`, { method: "PATCH", body: JSON.stringify(values) });
  app.state = payload.state;
  renderAll();
});

elements.syncResultsButton.addEventListener("click", async () => {
  const payload = await api("/api/admin/sync-results", { method: "POST", body: "{}" });
  app.state = payload.state;
  elements.saveStatus.textContent = payload.message;
  renderAll();
});

refresh().catch((error) => {
  elements.saveStatus.textContent = error.message;
  console.error(error);
});

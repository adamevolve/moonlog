const KEY = "moonlog-phone:v1";

const icons = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>',
  setup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 7 9 9 0 1 1-9-7Z"/></svg>',
  insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-2"/></svg>',
  moon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 7 9 9 0 1 1-9-7Z"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m20 6-11 11-5-5"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>'
};

const seedEntries = () => {
  const now = new Date();
  const rows = [
    ["23:12", "07:02", 4, 1, false, true, false, "Confirmed after first unlock"],
    ["00:08", "06:54", 3, 2, true, false, true, "Late screen time"],
    ["22:58", "07:10", 5, 0, false, true, false, "Easy morning"],
    ["23:44", "07:06", 3, 1, false, false, true, ""],
    ["00:35", "08:22", 4, 0, false, false, true, "Weekend"],
    ["23:20", "07:18", 4, 1, false, true, false, ""],
    ["01:04", "07:12", 2, 3, true, false, true, "Could not settle"]
  ];
  return rows.map((r, i) => ({
    id: crypto.randomUUID(),
    date: iso(addDays(now, -(i + 1))),
    bedtime: r[0],
    wake: r[1],
    quality: r[2],
    interruptions: r[3],
    caffeine: r[4],
    exercise: r[5],
    screens: r[6],
    notes: r[7],
    source: i < 3 ? "confirmed" : "estimated"
  }));
};

const defaultState = () => ({
  entries: seedEntries(),
  settings: {
    target: 8,
    intendedBed: "23:00",
    intendedWake: "07:00",
    alarm: "07:00",
    useCharging: true,
    useFirstUnlock: true,
    useScreenIdle: true,
    useMotion: false,
    dnd: true
  },
  night: {
    active: false,
    startedAt: null,
    intendedBed: "23:00",
    intendedWake: "07:00",
    alarmSet: true,
    chargingReminder: true,
    dndReminder: true
  }
});

let state = load();
let view = "dashboard";
let editingId = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Array.isArray(saved.entries)) return saved;
  } catch {}
  const fresh = defaultState();
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  render();
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return iso(new Date());
}

function min(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function duration(entry) {
  let diff = min(entry.wake) - min(entry.bedtime);
  if (diff <= 0) diff += 1440;
  return diff;
}

function fmtDuration(minutes) {
  const sign = minutes < 0 ? "-" : "";
  const total = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

function fmtClock(time) {
  const [h, m] = time.split(":").map(Number);
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

function weekday(date) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });
}

function sortedEntries() {
  return [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
}

function confidence() {
  let score = 45;
  if (state.settings.useFirstUnlock) score += 18;
  if (state.settings.useCharging) score += 12;
  if (state.settings.useScreenIdle) score += 14;
  if (state.night.active || state.night.startedAt) score += 8;
  if (state.settings.useMotion) score += 8;
  return Math.min(92, score);
}

function proposedEstimate() {
  const last = sortedEntries()[0];
  const baseBed = last ? last.bedtime : state.settings.intendedBed;
  const bed = state.night.startedAt ? new Date(state.night.startedAt).toTimeString().slice(0, 5) : baseBed;
  const wake = state.settings.useFirstUnlock ? "07:08" : state.settings.alarm;
  return {
    id: "proposal",
    date: todayIso(),
    bedtime: bed,
    wake,
    quality: 4,
    interruptions: 1,
    caffeine: false,
    exercise: false,
    screens: true,
    notes: "Estimated from phone-only signals. Confirmed by me.",
    source: "confirmed"
  };
}

function weekly() {
  const end = addDays(new Date(), -1);
  return Array.from({ length: 7 }, (_, i) => {
    const date = iso(addDays(end, i - 6));
    const entry = state.entries.find((e) => e.date === date);
    return { date, entry };
  });
}

function avg(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function sleepDebt() {
  return weekly().reduce((sum, item) => sum + ((item.entry ? duration(item.entry) : 0) - state.settings.target * 60), 0);
}

function createEl(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstElementChild;
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <main class="app">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">${icons.moon}</div>
          <div>
            <h1>Moonlog</h1>
            <p>Phone-only sleep journal</p>
          </div>
        </div>
        <span class="pill">${confidence()}% estimate confidence</span>
      </header>
      <nav class="tabs" aria-label="Main navigation">
        ${tab("dashboard", icons.dashboard, "Today")}
        ${tab("log", icons.log, "Log")}
        ${tab("setup", icons.setup, "Night")}
        ${tab("insights", icons.insights, "Insights")}
      </nav>
      <section class="view ${view === "dashboard" ? "active" : ""}" id="dashboard"></section>
      <section class="view ${view === "log" ? "active" : ""}" id="log"></section>
      <section class="view ${view === "setup" ? "active" : ""}" id="setup"></section>
      <section class="view ${view === "insights" ? "active" : ""}" id="insights"></section>
    </main>
    ${entryDialog()}
  `;
  renderDashboard();
  renderLog();
  renderSetup();
  renderInsights();
  bindEvents();
}

function tab(id, icon, label) {
  return `<button class="tab ${view === id ? "active" : ""}" data-view="${id}" type="button">${icon}<span>${label}</span></button>`;
}

function renderDashboard() {
  const root = document.getElementById("dashboard");
  const entries = sortedEntries();
  const last = entries[0];
  const proposal = proposedEstimate();
  const debt = sleepDebt();
  root.innerHTML = `
    <div class="grid desktop-grid">
      <div class="grid">
        <section class="panel hero">
          <p class="label">${last?.source === "confirmed" ? "Last confirmed sleep" : "Last estimated sleep"}</p>
          <div class="hero-main">
            <div>
              <p class="big-number">${last ? fmtDuration(duration(last)) : "0h 00m"}</p>
              <p class="tiny">${last ? `${fmtClock(last.bedtime)} to ${fmtClock(last.wake)} · ${last.quality}/5 quality` : "No sleep logged yet"}</p>
            </div>
            <button class="btn secondary" data-edit="${last?.id || ""}" ${last ? "" : "disabled"}>${icons.edit}<span>Edit</span></button>
          </div>
          <div class="metric-row">
            <div class="metric"><strong>${last ? (duration(last) >= state.settings.target * 60 ? "Met" : "Short") : "-"}</strong><span>Goal</span></div>
            <div class="metric"><strong>${fmtDuration(debt)}</strong><span>Week debt</span></div>
            <div class="metric"><strong>${confidence()}%</strong><span>Confidence</span></div>
          </div>
        </section>
        <section class="panel card confirm-card">
          <div class="section-title">
            <div>
              <h2>Morning confirmation</h2>
              <p>Phone-only estimate. Adjust it if needed.</p>
            </div>
          </div>
          <div class="estimate-band">
            <div><span class="tiny">Asleep</span><strong>${fmtClock(proposal.bedtime)}</strong></div>
            <div><span class="tiny">Wake</span><strong>${fmtClock(proposal.wake)}</strong></div>
            <div><span class="tiny">Duration</span><strong>${fmtDuration(duration(proposal))}</strong></div>
          </div>
          <div class="btn-row">
            <button class="btn" data-confirm-proposal>${icons.check}<span>Confirm</span></button>
            <button class="btn secondary" data-edit-proposal>${icons.edit}<span>Adjust</span></button>
          </div>
        </section>
      </div>
      <div class="grid">
        <section class="panel card">
          <div class="section-title">
            <div>
              <h2>7-night trend</h2>
              <p>Goal line is ${state.settings.target}h.</p>
            </div>
          </div>
          <div class="chart">${weekly().map(chartBar).join("")}</div>
        </section>
        <section class="panel card">
          <div class="section-title"><h2>Phone signals</h2></div>
          ${signalList()}
        </section>
      </div>
    </div>
  `;
}

function chartBar(item) {
  const mins = item.entry ? duration(item.entry) : 0;
  const pct = Math.max(6, Math.min(100, (mins / 600) * 100));
  const under = mins && mins < state.settings.target * 60;
  return `<div class="bar-wrap"><div class="bar ${under ? "under" : ""}" style="height:${pct}px" title="${item.entry ? fmtDuration(mins) : "No entry"}"></div><span class="bar-label">${weekday(item.date)}</span></div>`;
}

function signalList() {
  const sig = [
    ["First unlock", state.settings.useFirstUnlock],
    ["Phone charging", state.settings.useCharging],
    ["Screen inactivity", state.settings.useScreenIdle],
    ["Bedside motion", state.settings.useMotion]
  ];
  return sig.map(([name, on]) => `<div class="switch"><label>${name}</label><span class="pill">${on ? "Used" : "Off"}</span></div>`).join("");
}

function renderLog() {
  const root = document.getElementById("log");
  const entries = sortedEntries();
  root.innerHTML = `
    <section class="panel card">
      <div class="section-title">
        <div><h2>Sleep log</h2><p>Manual entries and phone estimates live together.</p></div>
        <button class="btn secondary" data-new-entry>${icons.plus}<span>Add</span></button>
      </div>
      <div class="log-list">
        ${entries.map(logItem).join("") || `<div class="notice">No nights logged yet. Add one or confirm the morning estimate.</div>`}
      </div>
    </section>
  `;
}

function logItem(e) {
  return `
    <article class="log-item">
      <div class="log-head">
        <div>
          <strong>${new Date(e.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</strong>
          <span>${fmtClock(e.bedtime)} to ${fmtClock(e.wake)} · ${fmtDuration(duration(e))}</span>
        </div>
        <div class="mini-actions">
          <button class="icon-btn" data-edit="${e.id}" aria-label="Edit entry">${icons.edit}</button>
          <button class="icon-btn" data-delete="${e.id}" aria-label="Delete entry">${icons.trash}</button>
        </div>
      </div>
      <div class="source">${e.source === "confirmed" ? "Confirmed by me" : "Estimated by phone"}</div>
      <div class="tiny">Quality ${e.quality}/5 · ${e.interruptions} interruptions${e.notes ? ` · ${escapeHtml(e.notes)}` : ""}</div>
    </article>
  `;
}

function renderSetup() {
  const root = document.getElementById("setup");
  root.innerHTML = `
    <section class="panel card">
      <div class="section-title">
        <div><h2>Night setup</h2><p>Optional. It helps the estimate tomorrow.</p></div>
      </div>
      <form class="form" data-setup-form>
        <div class="two">
          <div class="field"><label for="intended-bed">Intended bedtime</label><input id="intended-bed" name="intendedBed" type="time" value="${state.night.intendedBed || state.settings.intendedBed}"></div>
          <div class="field"><label for="intended-wake">Intended wake</label><input id="intended-wake" name="intendedWake" type="time" value="${state.night.intendedWake || state.settings.intendedWake}"></div>
        </div>
        ${check("alarmSet", "Alarm is set", state.night.alarmSet)}
        ${check("chargingReminder", "Put phone on charge", state.night.chargingReminder)}
        ${check("dndReminder", "Turn on Do Not Disturb", state.night.dndReminder)}
        <button class="btn" type="submit">${state.night.active ? "Update night" : "Start night"}</button>
        ${state.night.active ? `<button class="btn secondary" type="button" data-end-night>End night</button>` : ""}
      </form>
    </section>
    <section class="panel card" style="margin-top:12px">
      <div class="section-title"><div><h2>Estimate inputs</h2><p>These are phone-only clues, not wearable data.</p></div></div>
      ${settingSwitch("useFirstUnlock", "First unlock time")}
      ${settingSwitch("useCharging", "Charging overnight")}
      ${settingSwitch("useScreenIdle", "Screen inactivity")}
      ${settingSwitch("useMotion", "Optional mattress-side motion")}
    </section>
  `;
}

function check(name, label, checked) {
  return `<div class="switch"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="checkbox" ${checked ? "checked" : ""}></div>`;
}

function settingSwitch(name, label) {
  return `<div class="switch"><label for="${name}">${label}</label><input id="${name}" data-setting="${name}" type="checkbox" ${state.settings[name] ? "checked" : ""}></div>`;
}

function renderInsights() {
  const root = document.getElementById("insights");
  const entries = sortedEntries();
  const durations = entries.map(duration);
  const confirmed = entries.filter((e) => e.source === "confirmed").length;
  const avgDur = avg(durations);
  const lateScreens = entries.filter((e) => e.screens).length;
  const caffeine = entries.filter((e) => e.caffeine).length;
  root.innerHTML = `
    <div class="grid">
      <section class="panel card">
        <div class="section-title"><div><h2>Insights</h2><p>Built from your phone-only log.</p></div></div>
        <div class="metric-row">
          <div class="metric"><strong>${fmtDuration(avgDur || 0)}</strong><span>Average</span></div>
          <div class="metric"><strong>${confirmed}/${entries.length}</strong><span>Confirmed</span></div>
          <div class="metric"><strong>${fmtDuration(sleepDebt())}</strong><span>Week debt</span></div>
        </div>
      </section>
      <section class="panel card">
        ${insight("Best habit", lateScreens > entries.length / 2 ? "Screens are showing up on many nights. A no-screen wind-down is the cleanest experiment." : "Screen use is not dominating your log. Keep the bedtime rhythm steady.")}
        ${insight("Caffeine check", caffeine ? `${caffeine} recent nights include caffeine after 2pm. Compare those against confirmed quality.` : "No late caffeine logged recently. Nice clean baseline.")}
        ${insight("Confidence", `Your current estimate confidence is ${confidence()}%. Morning confirmation is the biggest accuracy boost.`)}
        ${insight("No wearable needed", "Moonlog treats the phone as a rough estimator and you as the final source of truth.")}
      </section>
    </div>
  `;
}

function insight(title, body) {
  return `<div class="insight"><strong>${title}</strong><p>${body}</p></div>`;
}

function entryDialog() {
  const e = editingId === "proposal" ? proposedEstimate() : state.entries.find((x) => x.id === editingId);
  if (!e) return "";
  return `
    <div class="panel card" style="position:fixed;inset:10px;z-index:50;overflow:auto;max-width:560px;margin:auto;max-height:calc(100vh - 20px)">
      <div class="section-title">
        <div><h2>${editingId === "proposal" ? "Confirm estimate" : "Edit sleep"}</h2><p>Saved on this phone.</p></div>
        <button class="icon-btn" data-close aria-label="Close">x</button>
      </div>
      <form class="form" data-entry-form>
        <input type="hidden" name="id" value="${e.id}">
        <div class="field"><label>Date</label><input name="date" type="date" value="${e.date}" required></div>
        <div class="two">
          <div class="field"><label>Asleep</label><input name="bedtime" type="time" value="${e.bedtime}" required></div>
          <div class="field"><label>Wake</label><input name="wake" type="time" value="${e.wake}" required></div>
        </div>
        <div class="two">
          <div class="field"><label>Quality</label><select name="quality">${[1,2,3,4,5].map((n) => `<option value="${n}" ${e.quality == n ? "selected" : ""}>${n}/5</option>`).join("")}</select></div>
          <div class="field"><label>Interruptions</label><input name="interruptions" type="number" min="0" max="20" value="${e.interruptions}"></div>
        </div>
        ${formCheck("caffeine", "Caffeine after 2pm", e.caffeine)}
        ${formCheck("exercise", "Exercise today", e.exercise)}
        ${formCheck("screens", "Screens before bed", e.screens)}
        <div class="field"><label>Source</label><select name="source"><option value="confirmed" ${e.source === "confirmed" ? "selected" : ""}>Confirmed by me</option><option value="estimated" ${e.source === "estimated" ? "selected" : ""}>Estimated by phone</option></select></div>
        <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(e.notes || "")}</textarea></div>
        <div class="btn-row">
          <button class="btn" type="submit">Save</button>
          <button class="btn secondary" type="button" data-close>Cancel</button>
        </div>
      </form>
    </div>
  `;
}

function formCheck(name, label, checked) {
  return `<div class="switch"><label for="form-${name}">${label}</label><input id="form-${name}" name="${name}" type="checkbox" ${checked ? "checked" : ""}></div>`;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => {
    view = btn.dataset.view;
    editingId = null;
    render();
  }));

  document.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => {
    if (!btn.dataset.edit) return;
    editingId = btn.dataset.edit;
    render();
  }));

  document.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => {
    state.entries = state.entries.filter((e) => e.id !== btn.dataset.delete);
    save();
  }));

  document.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => {
    editingId = null;
    render();
  }));

  document.querySelector("[data-new-entry]")?.addEventListener("click", () => {
    const p = proposedEstimate();
    p.id = crypto.randomUUID();
    p.source = "confirmed";
    state.entries.unshift(p);
    editingId = p.id;
    save();
  });

  document.querySelector("[data-confirm-proposal]")?.addEventListener("click", () => {
    const p = proposedEstimate();
    p.id = crypto.randomUUID();
    state.entries = [p, ...state.entries.filter((e) => e.date !== p.date)];
    state.night.active = false;
    save();
  });

  document.querySelector("[data-edit-proposal]")?.addEventListener("click", () => {
    editingId = "proposal";
    render();
  });

  document.querySelector("[data-entry-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = {
      id: data.get("id") === "proposal" ? crypto.randomUUID() : String(data.get("id")),
      date: String(data.get("date")),
      bedtime: String(data.get("bedtime")),
      wake: String(data.get("wake")),
      quality: Number(data.get("quality")),
      interruptions: Number(data.get("interruptions")),
      caffeine: data.has("caffeine"),
      exercise: data.has("exercise"),
      screens: data.has("screens"),
      source: String(data.get("source")),
      notes: String(data.get("notes") || "")
    };
    if (duration(next) < 60 || duration(next) > 960) {
      alert("Check those times. Moonlog accepts sleep windows from 1 to 16 hours.");
      return;
    }
    state.entries = [next, ...state.entries.filter((e) => e.id !== next.id && e.date !== next.date)];
    editingId = null;
    save();
  });

  document.querySelector("[data-setup-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.night = {
      active: true,
      startedAt: state.night.startedAt || new Date().toISOString(),
      intendedBed: String(data.get("intendedBed")),
      intendedWake: String(data.get("intendedWake")),
      alarmSet: data.has("alarmSet"),
      chargingReminder: data.has("chargingReminder"),
      dndReminder: data.has("dndReminder")
    };
    state.settings.intendedBed = state.night.intendedBed;
    state.settings.intendedWake = state.night.intendedWake;
    save();
  });

  document.querySelector("[data-end-night]")?.addEventListener("click", () => {
    state.night.active = false;
    save();
  });

  document.querySelectorAll("[data-setting]").forEach((input) => input.addEventListener("change", () => {
    state.settings[input.dataset.setting] = input.checked;
    save();
  }));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

render();

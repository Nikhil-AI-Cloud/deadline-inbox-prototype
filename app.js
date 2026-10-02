// Deadline Inbox prototype: all state lives in memory (reload resets to data.js).

const SOURCE_ICONS = { Canvas: "🎓", Gmail: "✉️", Slack: "💬", Discord: "🎮" };
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const state = {
  view: "inbox",
  activeSources: new Set(SOURCES), // all on by default
  editingId: null,                 // item currently open in the Add info form
};

const VIEWS = {
  inbox: {
    title: "Inbox",
    subtitle: "Everything we detected. Complete and partial items are on your calendar; the rest wait in Backlog.",
    render: renderInbox,
  },
  calendar: {
    title: "Calendar",
    subtitle: "Your private calendar. Only items with a verified due date appear here.",
    render: renderCalendar,
  },
  backlog: {
    title: "Backlog",
    subtitle: "Possible deadlines with no verifiable date. No calendar event was created.",
    render: renderBacklog,
  },
};

// ---------- rules (the MVP logic lives here) ----------

function getStatus(item) {
  if (!item.dueDate) return "backlog";        // never invent a date, never create an event
  if (!item.dueTime) return "partial";        // event exists, but flagged
  return "complete";
}

function getMissing(item) {
  const missing = [];
  if (!item.dueDate) missing.push("Due date");
  if (!item.dueTime) missing.push("Due time");
  return missing;
}

const hasEvent = (item) => getStatus(item) !== "backlog";
const visibleItems = () =>
  ITEMS.filter((i) => !i.dismissed && state.activeSources.has(i.source));

// Calendar events. Visible items with the same taskKey AND the same due date are one deadline,
// so they merge into a single event that keeps every source's evidence in `items`.
// (Same task with different dates is NOT merged: that's a conflict we don't resolve silently.)
function getEvents() {
  const groups = new Map();
  for (const item of visibleItems().filter(hasEvent)) {
    const key = `${item.taskKey}|${item.dueDate}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()].map((items) => {
    items.sort((a, b) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source));
    const primary = items[0];
    return {
      id: primary.id, // used to find the event again when clicked
      taskKey: primary.taskKey,
      title: primary.title,
      course: primary.course,
      dueDate: primary.dueDate,
      dueTime: items.map((i) => i.dueTime).find(Boolean) || null, // any source that knows the time
      items,
    };
  });
}

// ---------- formatting helpers ----------

function formatDate(iso) {
  if (!iso) return "No date";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// "17:30" (from <input type="time">) -> "5:30 PM"
function formatTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function sourceTag(source) {
  return `<span class="tag source">${SOURCE_ICONS[source]} ${source}</span>`;
}

function statusTag(item) {
  const status = getStatus(item);
  if (status === "complete") return `<span class="tag ok">On calendar</span>`;
  if (status === "partial") return `<span class="tag partial">Partial</span>`;
  return `<span class="tag backlog">Backlog</span>`;
}

function evidenceBlock(item) {
  return `
    <blockquote class="evidence">
      <div class="evidence-meta">From ${item.source} · ${item.from} · received ${formatDate(item.received)}</div>
      “${item.sourceEvidence}”
    </blockquote>`;
}

function missingBlock(item) {
  const missing = getMissing(item);
  if (!missing.length) return "";
  const text =
    getStatus(item) === "backlog"
      ? missing.map((m) => `${m} missing`).join(" · ")
      : `Missing: ${missing.join(", ")}`;
  return `<div class="missing">${text}</div>`;
}

const emptyState = (text) => `<div class="empty">${text}</div>`;

// ---------- views ----------

function renderCard(item) {
  const when = item.dueDate
    ? `Due ${formatDate(item.dueDate)}${item.dueTime ? " · " + item.dueTime : ""}`
    : "No verified due date";
  return `
    <article class="card clickable" data-action="open-item" data-id="${item.id}" tabindex="0" role="button">
      <div class="card-top">
        <h3>${item.title}</h3>
        <div class="tags">${sourceTag(item.source)}${statusTag(item)}</div>
      </div>
      <div class="muted">${item.course}</div>
      <div class="due">${when}</div>
      ${missingBlock(item)}
      ${evidenceBlock(item)}
    </article>`;
}

function renderInbox() {
  const items = visibleItems();
  if (!items.length) return emptyState("No items for the selected sources.");
  return `<div class="list">${items.map(renderCard).join("")}</div>`;
}

function renderBacklog() {
  const items = visibleItems().filter((i) => getStatus(i) === "backlog");
  if (!items.length) return emptyState("Backlog is empty. 🎉");
  return `<div class="list">${items
    .map(
      (item) => `
      <article class="card">
        <div class="card-top">
          <h3>${item.title}</h3>
          <div class="tags">${sourceTag(item.source)}</div>
        </div>
        <div class="muted">${item.course}</div>
        ${missingBlock(item)}
        ${evidenceBlock(item)}
        <div class="actions">
          <button class="btn" data-action="add-info" data-id="${item.id}">Add info</button>
          <button class="btn ghost" data-action="dismiss" data-id="${item.id}">Dismiss</button>
        </div>
      </article>`
    )
    .join("")}</div>`;
}

// One month grid per month that has at least one event (October 2026 if none).
function renderCalendar() {
  const events = getEvents();
  const months = [...new Set(events.map((e) => e.dueDate.slice(0, 7)))].sort();
  if (!months.length) months.push("2026-10");

  const legend = `<div class="legend"><span class="event complete">On calendar</span><span class="event partial">⚠ Partial</span></div>`;
  return legend + months.map((ym) => renderMonth(ym, events)).join("");
}

function renderMonth(ym, events) {
  const [year, month1] = ym.split("-").map(Number);
  const month = month1 - 1; // JS months are 0-indexed
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < first; i++) cells.push(`<div class="day blank"></div>`);
  for (let d = 1; d <= days; d++) {
    const iso = `${ym}-${String(d).padStart(2, "0")}`;
    const todays = events
      .filter((e) => e.dueDate === iso)
      .map((e) => {
        const partial = getStatus(e) === "partial";
        return `<button class="event ${partial ? "partial" : "complete"}" data-action="open-event" data-id="${e.id}" title="${e.title}">${partial ? "⚠ " : ""}${e.title}</button>`;
      })
      .join("");
    cells.push(`<div class="day"><span class="num">${d}</span>${todays}</div>`);
  }

  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((h) => `<div class="dow">${h}</div>`)
    .join("");
  return `
    <h3 class="month-title">${MONTH_NAMES[month]} ${year}</h3>
    <div class="grid">${heads}${cells.join("")}</div>`;
}

// ---------- chrome (nav, filters, counts) ----------

function renderFilters() {
  document.getElementById("filters").innerHTML = SOURCES.map(
    (s) => `
    <label class="filter">
      <input type="checkbox" data-source="${s}" ${state.activeSources.has(s) ? "checked" : ""} />
      ${SOURCE_ICONS[s]} ${s}
    </label>`
  ).join("");
}

function renderCounts() {
  const items = visibleItems();
  document.getElementById("count-inbox").textContent = items.length;
  document.getElementById("count-calendar").textContent = getEvents().length;
  document.getElementById("count-backlog").textContent = items.filter((i) => getStatus(i) === "backlog").length;
}

function render() {
  const v = VIEWS[state.view];
  document.getElementById("view-title").textContent = v.title;
  document.getElementById("view-subtitle").textContent = v.subtitle;
  document.getElementById("view").innerHTML = v.render();
  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === state.view)
  );
  renderCounts();
}

// ---------- Add info form ----------

const dialog = document.getElementById("add-info-dialog");
const form = document.getElementById("add-info-form");
const formError = document.getElementById("form-error");

function openAddInfo(id) {
  const item = ITEMS.find((i) => i.id === id);
  state.editingId = id;
  document.getElementById("form-item-title").textContent = item.title;
  form.reset();
  formError.textContent = "";
  dialog.showModal();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const date = form.elements.dueDate.value;
  const time = form.elements.dueTime.value;
  if (!date && !time) {
    formError.textContent = "Enter at least one detail, or cancel.";
    return;
  }
  const item = ITEMS.find((i) => i.id === state.editingId);
  if (date) item.dueDate = date;
  if (time) item.dueTime = formatTime(time);
  dialog.close();
  render(); // status is re-derived: no date -> still Backlog, date only -> Partial, both -> On calendar
});

document.getElementById("form-cancel").addEventListener("click", () => dialog.close());

// ---------- Event detail popup (Calendar and Inbox) ----------

const eventDialog = document.getElementById("event-dialog");

// Only real https links are ever rendered as links.
const isHttpsUrl = (url) => typeof url === "string" && /^https:\/\//i.test(url);
const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function formatLongDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// `event` is one deadline, possibly backed by several sources (from getEvents()), or a single
// Backlog item with no date (opened from the Inbox). Same card either way.
function renderEventDetail(event) {
  const status = getStatus(event); // "complete" | "partial" | "backlog"
  const multi = event.items.length > 1;
  const documentUrl = DOCUMENT_URLS[event.taskKey];

  const when =
    status === "backlog"
      ? "No verified due date"
      : `${formatLongDate(event.dueDate)} · ${event.dueTime || "Time not provided"}`;

  const statusTagHtml = {
    complete: `<span class="tag ok">Verified</span>`,
    partial: `<span class="tag partial">Partial</span>`,
    backlog: `<span class="tag backlog">Backlog: no calendar event</span>`,
  }[status];

  // "Open Task Document" = where the student works. Separate from "View Original Source" below.
  const docAction = isHttpsUrl(documentUrl)
    ? `<a class="btn primary" href="${escapeAttr(documentUrl)}" target="_blank" rel="noopener noreferrer">Open Task Document ↗</a>`
    : `<span class="btn unavailable" aria-disabled="true" title="Add a real Google Doc URL for this task in DOCUMENT_URLS in data.js">Task document not linked yet</span>`;

  // One quote per source; labelled with the source name when there is more than one.
  const evidence = event.items
    .map(
      (i) => `<blockquote class="evidence">${multi ? `<div class="evidence-meta">${i.source}:</div>` : ""}“${i.sourceEvidence}”</blockquote>`
    )
    .join("");

  // "View Original Source" = where Deadline Inbox found the deadline (simulated, no external links).
  const tabs = multi
    ? `<div class="src-tabs">${event.items
        .map((i, n) => `<button class="src-tab${n === 0 ? " active" : ""}" data-action="source-tab" data-index="${n}">${i.source} source</button>`)
        .join("")}</div>`
    : "";
  const records = event.items
    .map((i, n) => `<div class="src-record" data-index="${n}"${n === 0 ? "" : " hidden"}>${renderSourceRecord(i)}</div>`)
    .join("");

  return `
    <div class="ev-head ${status}">
      <h3>${event.title}</h3>
      <button class="ev-close" data-close aria-label="Close">✕</button>
    </div>
    <div class="ev-body">
      <div class="muted">${event.course}</div>
      <div class="ev-when">${when}</div>

      <dl class="ev-meta">
        <dt>${multi ? "Sources" : "Source"}</dt><dd>${event.items.map((i) => sourceTag(i.source)).join(" + ")}</dd>
        <dt>Status</dt><dd>${statusTagHtml}</dd>
      </dl>
      ${status === "complete" ? "" : missingBlock(event)}

      <div class="ev-label">Source evidence</div>
      ${evidence}

      <div class="actions">
        ${docAction}
        <button class="btn" data-action="toggle-source" aria-expanded="false">View Original Source</button>
      </div>

      <div class="source-panel" id="source-panel" hidden>
        ${tabs}
        ${records}
        <div class="src-note">Simulated view for this prototype. It is not a live link to ${multi ? "these platforms" : event.items[0].source}.</div>
      </div>
    </div>`;
}

// ----- Simulated original-source views (one look per platform) -----

const highlight = (text, phrase) =>
  text.includes(phrase) ? text.replace(phrase, `<mark>${phrase}</mark>`) : text;

// Uses the item's existing fields. Slack `from` is "#channel · Sender"; Discord is "Server · #channel".
function renderSourceRecord(item) {
  const body = highlight(item.sourceMessage, item.deadlinePhrase);
  const received = formatDate(item.received);
  const [partA, partB] = item.from.split(" · ");
  let meta, content;

  if (item.source === "Canvas") {
    meta = `Course: ${item.course} › Assignments`;
    content = `<h4>${item.title}</h4><p>${body}</p>`;
  } else if (item.source === "Gmail") {
    meta = `From: ${item.from} · ${received}`;
    content = `<h4>${item.subject}</h4><p>${body}</p>`;
  } else if (item.source === "Slack") {
    meta = `${partA} · ${received}`;
    content = `<div class="msg-author">${partB}</div><p>${body}</p>`;
  } else {
    // Discord
    meta = `${partA} › ${partB} · ${received}`;
    content = `<div class="msg-author">Study group member</div><p>${body}</p>`;
  }

  return `
    <div class="src-card ${item.source.toLowerCase()}">
      <div class="src-head">${SOURCE_ICONS[item.source]} ${item.source}</div>
      <div class="src-body">
        <div class="src-meta">${meta}</div>
        ${content}
      </div>
    </div>`;
}

function showEvent(event) {
  document.getElementById("event-detail").innerHTML = renderEventDetail(event);
  eventDialog.showModal();
}

// From the Calendar: `id` is the merged event's id.
function openEventDetail(id) {
  showEvent(getEvents().find((e) => e.id === id));
}

// From the Inbox: show the (merged) calendar event this item belongs to; a Backlog item has no
// event, so show it on its own with no date.
function openItemDetail(id) {
  const item = ITEMS.find((i) => i.id === id);
  const event = getEvents().find((e) => e.items.includes(item)) || {
    id: item.id,
    taskKey: item.taskKey,
    title: item.title,
    course: item.course,
    dueDate: item.dueDate,
    dueTime: item.dueTime,
    items: [item],
  };
  showEvent(event);
}

eventDialog.addEventListener("click", (e) => {
  // Close on the X button or on a click outside the card (the dialog backdrop).
  if (e.target === eventDialog || e.target.closest("[data-close]")) {
    eventDialog.close();
    return;
  }
  const toggle = e.target.closest('[data-action="toggle-source"]');
  if (toggle) {
    const panel = document.getElementById("source-panel");
    panel.hidden = !panel.hidden;
    toggle.textContent = panel.hidden ? "View Original Source" : "Hide Original Source";
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    return;
  }
  const tab = e.target.closest('[data-action="source-tab"]');
  if (tab) {
    eventDialog.querySelectorAll(".src-tab").forEach((t) => t.classList.toggle("active", t === tab));
    eventDialog.querySelectorAll(".src-record").forEach((r) => (r.hidden = r.dataset.index !== tab.dataset.index));
  }
});

// ---------- events ----------

document.getElementById("nav").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  state.view = btn.dataset.view;
  render();
});

document.getElementById("filters").addEventListener("change", (e) => {
  const { source } = e.target.dataset;
  if (!source) return;
  e.target.checked ? state.activeSources.add(source) : state.activeSources.delete(source);
  render();
});

document.getElementById("view").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "add-info") openAddInfo(id);
  if (btn.dataset.action === "open-event") openEventDetail(id);
  if (btn.dataset.action === "open-item") openItemDetail(id);
  if (btn.dataset.action === "dismiss") {
    ITEMS.find((i) => i.id === id).dismissed = true;
    render();
  }
});

// Inbox cards are focusable: Enter / Space opens them like a click.
document.getElementById("view").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('[data-action="open-item"]')) {
    e.preventDefault();
    openItemDetail(Number(e.target.dataset.id));
  }
});

renderFilters();
render();

/* matura-tool frontend — vanilla, keyboard-first */
import { esc, renderRich, plain, highlight } from "./render.js";

const $ = (s) => document.querySelector(s);
const qEl = $("#q");
const listEl = $("#list");
const detailEl = $("#detail");
const filtersEl = $("#filters");
const statsEl = $("#stats");
const statusEl = $("#status");
const emptyEl = $("#empty");
const helpEl = $("#help");

const state = {
  q: "",
  hits: [],
  sel: 0,
  detail: null,
  showAnswer: false,
  showExplain: false,
  loadToken: 0,
  meta: { sheets: 0, tasks: 0 },
};

/* ---------- api ---------- */

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/* ---------- rendering ---------- */

function renderFilters(f) {
  const pills = [];
  for (const y of f.years) pills.push(`<span class="pill">rok ${y}</span>`);
  for (const s of f.sessions) pills.push(`<span class="pill">${s}</span>`);
  for (const s of f.kinds) pills.push(`<span class="pill">${s}</span>`);
  for (const l of f.levels) pills.push(`<span class="pill">${l}</span>`);
  if (f.taskNo != null) pills.push(`<span class="pill">zadanie ${f.taskNo}</span>`);
  if (f.points != null) pills.push(`<span class="pill">${f.points} pkt</span>`);
  if (f.solved != null) pills.push(`<span class="pill">${f.solved ? "rozwiązane" : "nierozwiązane"}</span>`);
  if (f.flagged != null) pills.push(`<span class="pill">zaznaczone</span>`);
  if (pills.length === 0 && state.meta.tasks)
    pills.push(`<span class="pill dim">wszystkie zadania</span>`);
  filtersEl.innerHTML = pills.join("");
}

function renderList() {
  listEl.innerHTML = "";
  state.hits.forEach((h, i) => {
    const li = document.createElement("li");
    li.className = "hit" + (i === state.sel ? " sel" : "") + (h.solved ? " solved" : "");
    li.dataset.i = String(i);
    const badges = [
      `<span class="badge">${h.year} ${h.session}</span>`,
      `<span>zad ${h.task_no}</span>`,
      `<span class="pts">${h.points} pkt</span>`,
      h.solved ? `<span class="s">✓</span>` : "",
      h.flagged ? `<span class="s" style="color:var(--flag)">⚑</span>` : "",
    ].join("");
    const words = (state.q ? (state.filters?.text ?? "").split(/\s+/) : []).filter(Boolean);
    li.innerHTML = `
      <div class="meta">${badges}</div>
      <div class="body">${highlight(plain(h.text).slice(0, 180), words)}</div>
      ${h.topics.length ? `<div class="topics">${esc(h.topics.join(" · "))}</div>` : ""}`;
    li.onclick = () => select(i, true);
    listEl.appendChild(li);
  });
  emptyEl.classList.toggle("hidden", state.hits.length > 0);
}

function renderDetail() {
  const d = state.detail;
  if (!d) {
    detailEl.innerHTML = `<div class="empty">← pick a task with ↑ ↓ and press ↵</div>`;
    return;
  }
  const { task, sheet, neighbors, progress } = d;
  const opts = task.options.length
    ? `<div class="options">${task.options
        .map((o) => `<div class="option"><b>${o.letter}</b><span data-md="${esc(o.content)}"></span></div>`)
        .join("")}</div>`
    : "";

  detailEl.innerHTML = `
    <h1>${esc(sheet.title)} · arkusz: ${esc(sheet.id)}</h1>
    <div class="headline">
      <span class="ttl">Zadanie ${task.task_no}</span>
      <span class="tag">${task.points} pkt</span>
      <span class="tag">${task.type === "closed" ? "zamknięte" : "otwarte"}</span>
      <span class="tag">${sheet.formula === "stara" ? "stara formuła" : "nowa formuła"}</span>
      ${progress.solved ? `<span class="tag good">✓ rozwiązane</span>` : ""}
      ${progress.flagged ? `<span class="tag flag">⚑ zaznaczone</span>` : ""}
    </div>
    <section>
      <h2 class="sec">Treść</h2>
      <div class="card" id="task-text"></div>
      ${opts}
    </section>
    <section>
      <h2 class="sec">Odpowiedź</h2>
      <div id="answer-wrap">
        ${
          state.showAnswer
            ? `<div class="card answer" id="answer"></div>`
            : `<div class="reveal-hint">ukryta — naciśnij <kbd>space</kbd>, żeby sprawdzić</div>`
        }
      </div>
    </section>
    <section>
      <h2 class="sec">Wyjaśnienie</h2>
      <div id="explain-wrap">
        ${
          state.showExplain
            ? `<div class="card explain" id="explain"></div>`
            : `<div class="reveal-hint">ukryte — naciśnij <kbd>e</kbd></div>`
        }
      </div>
    </section>
    ${task.scoring ? `<section><h2 class="sec">Punktacja</h2><div class="card scoring" id="scoring"></div></section>` : ""}
    <section>
      <h2 class="sec">Źródło</h2>
      <div class="empty" style="padding:0">
        <a href="${esc(sheet.url)}" target="_blank" rel="noreferrer" style="color:var(--accent)">${esc(sheet.url)}</a><br>
        <span style="font-size:11px">pdf: <a href="${esc(sheet.pdf_url ?? "#")}" target="_blank" rel="noreferrer" style="color:var(--accent)">${esc(sheet.pdf_url ?? "-")}</a></span>
      </div>
    </section>`;

  renderRich($("#task-text"), task.text);
  detailEl.querySelectorAll(".option span[data-md]").forEach((el) => renderRich(el, el.dataset.md));
  if (state.showAnswer && $("#answer")) renderRich($("#answer"), task.answer || "(brak)");
  if (state.showExplain && $("#explain")) renderRich($("#explain"), task.explanation || "(brak)");
  if (task.scoring && $("#scoring")) renderRich($("#scoring"), task.scoring);

  statusEl.textContent = `zadanie ${task.task_no} · ${sheet.year} ${sheet.session} · ${neighbors.prev ? "n←" : ""}${neighbors.next ? " →p" : ""}`;
}

/* ---------- data flow ---------- */

let searchTimer = null;

async function runSearch(immediate = false) {
  const q = qEl.value;
  state.q = q;
  const data = await api(`/api/search?q=${encodeURIComponent(q)}&limit=80`);
  state.hits = data.hits;
  state.filters = data.filters;
  state.total = data.total;
  if (state.sel >= state.hits.length) state.sel = Math.max(0, state.hits.length - 1);
  renderFilters(data.filters);
  renderList();
  statsEl.textContent = `${state.hits.length}/${data.total} wyników · ${state.meta.sheets} arkuszy · ${state.meta.tasks} zadań`;
  if (state.hits.length && !state.detail) loadDetail(state.hits[state.sel].id);
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(), 120);
}

function select(i, load) {
  if (i < 0 || i >= state.hits.length) return;
  state.sel = i;
  renderList();
  const li = listEl.querySelector(".hit.sel");
  li?.scrollIntoView({ block: "nearest" });
  if (load !== false) loadDetail(state.hits[i].id);
}

async function loadDetail(id) {
  const token = ++state.loadToken;
  state.showAnswer = false;
  state.showExplain = false;
  const d = await api(`/api/task/${encodeURIComponent(id)}`);
  if (token !== state.loadToken) return;
  state.detail = d;
  renderDetail();
}

async function patchProgress(patch) {
  const d = state.detail;
  if (!d) return;
  const next = await api(`/api/progress/${encodeURIComponent(d.task.id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  d.progress = next;
  const hit = state.hits.find((h) => h.id === d.task.id);
  if (hit) Object.assign(hit, { solved: next.solved, flagged: next.flagged });
  renderDetail();
  renderList();
}

/* ---------- keyboard ---------- */

function inField() {
  return document.activeElement === qEl;
}

document.addEventListener("keydown", (e) => {
  if (helpEl.open) {
    if (e.key === "Escape" || e.key === "?") helpEl.close();
    return;
  }

  const k = e.key;
  const nav = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };

  if (k === "/" && !inField()) {
    e.preventDefault();
    qEl.focus();
    qEl.select();
    return;
  }

  if (k in nav && !e.metaKey && !e.ctrlKey) {
    // arrows navigate from anywhere; j/k only outside the input (so you can type them)
    if (inField() && (k === "j" || k === "k")) return;
    e.preventDefault();
    select(state.sel + nav[k]);
    return;
  }

  if (k === "Enter") {
    e.preventDefault();
    if (state.hits[state.sel]) loadDetail(state.hits[state.sel].id);
    if (inField()) qEl.blur();
    return;
  }

  if (k === "Escape") {
    if (inField()) qEl.blur();
    return;
  }

  if (inField()) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  switch (k) {
    case " ":
      e.preventDefault();
      state.showAnswer = !state.showAnswer;
      renderDetail();
      break;
    case "e":
      state.showExplain = !state.showExplain;
      renderDetail();
      break;
    case "s":
      patchProgress({ solved: !(state.detail?.progress.solved ?? false) });
      break;
    case "f":
      patchProgress({ flagged: !(state.detail?.progress.flagged ?? false) });
      break;
    case "n":
      if (state.detail?.neighbors.next) loadDetail(state.detail.neighbors.next);
      break;
    case "p":
      if (state.detail?.neighbors.prev) loadDetail(state.detail.neighbors.prev);
      break;
    case "o":
      if (state.detail) window.open(state.detail.sheet.url, "_blank");
      break;
    case "?":
      helpEl.showModal();
      break;
  }
});

qEl.addEventListener("input", scheduleSearch);
qEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") scheduleSearch();
});
$("#help-btn").onclick = () => helpEl.showModal();

/* ---------- boot ---------- */

(async function boot() {
  try {
    const facets = await api("/api/facets");
    state.meta = { sheets: facets.sheets, tasks: facets.tasks };
  } catch {}
  const url = new URL(location.href);
  if (url.searchParams.get("q")) qEl.value = url.searchParams.get("q");
  qEl.focus();
  await runSearch();
})();

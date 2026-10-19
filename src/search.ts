import type { LoadedData, SearchHit, Sheet, Task } from "./db.ts";
import { editDistance, fold, stripMath, tokens } from "./text.ts";

export interface Filters {
  years: number[];
  sessions: string[];
  kinds: string[];
  levels: string[];
  topics: string[];
  taskNo: number | null;
  points: number | null;
  solved: boolean | null;
  flagged: boolean | null;
  text: string;
}

export interface IndexedTask {
  task: Task;
  sheet: Sheet;
  blob: string;
  indexTokens: string[];
  topicBlob: string;
}

const SESSION_WORDS = ["maj", "czerwiec", "sierpien", "listopad", "styczen", "grudzien", "probna", "poprawkowa"];

export class SearchEngine {
  readonly tasks: IndexedTask[] = [];
  readonly sheets: Sheet[] = [];
  readonly byId = new Map<string, IndexedTask>();
  readonly sheetById = new Map<string, Sheet>();
  progress: LoadedData["progress"];

  constructor(data: LoadedData) {
    this.sheets = data.sheets;
    this.progress = data.progress;
    for (const s of data.sheets) this.sheetById.set(s.id, s);
    for (const task of data.tasks) {
      const sheet = this.sheetById.get(task.sheet_id);
      if (!sheet) continue;
      const blob = fold(stripMath([task.text, task.answer, task.options.map((o) => o.content).join(" ")].join(" ")));
      const indexed: IndexedTask = {
        task,
        sheet,
        blob,
        indexTokens: tokens(blob),
        topicBlob: fold(task.topics.join(" ")),
      };
      this.tasks.push(indexed);
      this.byId.set(task.id, indexed);
    }
  }

  get topics(): string[] {
    const set = new Set<string>();
    for (const t of this.tasks) for (const topic of t.task.topics) set.add(topic);
    return [...set].sort();
  }

  get years(): number[] {
    return [...new Set(this.sheets.map((s) => s.year))].sort((a, b) => b - a);
  }

  search(raw: string, limit = 60): { filters: Filters; total: number; hits: SearchHit[] } {
    const filters = parseFilters(raw);
    const queryTokens = tokens(filters.text);
    const phrase = fold(stripMath(filters.text)).trim();

    const hits: SearchHit[] = [];
    for (const item of this.tasks) {
      if (!passesFilters(item, filters, this.progress)) continue;
      const { score, matched } = scoreTask(item, queryTokens, phrase);
      if (queryTokens.length > 0 && matched.length === 0) continue;
      hits.push({ task: item.task, sheet: item.sheet, score, matched });
    }

    hits.sort((a, b) => b.score - a.score || compareNewer(a, b));
    return { filters, total: hits.length, hits: hits.slice(0, limit) };
  }
}

function compareNewer(a: SearchHit, b: SearchHit): number {
  if (a.sheet.year !== b.sheet.year) return b.sheet.year - a.sheet.year;
  if (a.task.points !== b.task.points) return b.task.points - a.task.points;
  return a.task.task_no - b.task.task_no;
}

function scoreTask(
  item: IndexedTask,
  queryTokens: string[],
  phrase: string,
): { score: number; matched: string[] } {
  if (queryTokens.length === 0) return { score: 0, matched: [] };
  const matched: string[] = [];
  let sum = 0;
  let topicHits = 0;

  for (const q of queryTokens) {
    let best = 0;
    for (const t of item.indexTokens) {
      if (t === q) { best = 1; break; }
      if (t.startsWith(q)) { if (best < 0.85) best = 0.85; continue; }
      if (q.length >= 4 && t.includes(q)) { if (best < 0.6) best = 0.6; continue; }
      if (q.length >= 4 && best < 0.7 && editDistance(t, q, 1) <= 1) best = 0.7;
    }
    if (best > 0) {
      matched.push(q);
      sum += best;
    }
    if (best === 0 && item.topicBlob.includes(q)) {
      matched.push(q);
      sum += 0.8;
      topicHits++;
    }
  }

  const coverage = matched.length / queryTokens.length;
  let score = sum * (0.35 + 0.65 * coverage);
  if (topicHits > 0) score += 0.5 * topicHits;
  if (phrase.length >= 6 && item.blob.includes(phrase)) score += 2;
  // gentle tiebreak: prefer newer years and higher-value tasks
  score += item.sheet.year / 100000 + item.task.points / 100000;
  return { score, matched };
}

function passesFilters(
  item: IndexedTask,
  f: Filters,
  progress: LoadedData["progress"],
): boolean {
  const { sheet, task } = item;
  if (f.years.length && !f.years.includes(sheet.year)) return false;
  if (f.levels.length && !f.levels.includes(sheet.level)) return false;
  if (f.sessions.length) {
    const hay = sheet.session;
    if (!f.sessions.some((s) => hay.includes(s))) return false;
  }
  if (f.kinds.length) {
    const hay = sheet.session;
    if (!f.kinds.some((s) => hay.includes(s))) return false;
  }
  if (f.taskNo !== null && task.task_no !== f.taskNo) return false;
  if (f.points !== null && task.points !== f.points) return false;
  if (f.topics.length && !f.topics.every((t) => item.topicBlob.includes(t))) return false;
  const p = progress[task.id];
  if (f.solved !== null && !!p?.solved !== f.solved) return false;
  if (f.flagged !== null && !!p?.flagged !== f.flagged) return false;
  return true;
}

/** alias → canonical key. Long forms work bare or with `:`, single-letter forms need `:`. */
const KEY_ALIASES: Record<string, string> = {
  rok: "year",
  year: "year",
  r: "year",
  y: "year",
  zad: "task",
  task: "task",
  nr: "task",
  z: "task",
  punkty: "points",
  pkt: "points",
  pts: "points",
  p: "points",
  sesja: "session",
  session: "session",
  miesiac: "session",
  m: "session",
  typ: "kind",
  kind: "kind",
  k: "kind",
  topic: "topic",
  dzial: "topic",
  solved: "solved",
  rozwiazane: "solved",
  flagged: "flagged",
  flaga: "flagged",
};

/** aliases that may appear bare (no colon). single-letter aliases are excluded to avoid
 *  clashing with ordinary Polish words like "z" (= from). */
const LONG_ALIASES = new Set(
  Object.keys(KEY_ALIASES).filter((k) => k.length > 1),
);

export function parseFilters(raw: string): Filters {
  const f: Filters = {
    years: [],
    sessions: [],
    kinds: [],
    levels: [],
    topics: [],
    taskNo: null,
    points: null,
    solved: null,
    flagged: null,
    text: "",
  };
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  const text: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const tok = parts[i]!;
    const lower = tok.toLowerCase();
    const colon = lower.indexOf(":");
    const rawKey = colon >= 0 ? lower.slice(0, colon) : LONG_ALIASES.has(lower) ? lower : null;
    const key = rawKey ? (KEY_ALIASES[rawKey] ?? null) : null;
    const value = colon >= 0 ? lower.slice(colon + 1) || null : null;
    const consume = () => parts[++i];

    if (/^(19|20)\d{2}$/.test(lower)) { f.years.push(Number(lower)); continue; }
    if (SESSION_WORDS.includes(lower)) { f.sessions.push(lower); continue; }
    if (["podst", "podstawowa", "podstawowy"].includes(lower)) { f.levels.push("podstawowa"); continue; }
    if (["rozsz", "rozszerzona", "rozszerzony"].includes(lower)) { f.levels.push("rozszerzona"); continue; }
    if (["unsolved", "niesolved", "nierozwiazane"].includes(lower)) { f.solved = false; continue; }
    if (["flagged", "flaga", "zaznaczone"].includes(lower)) { f.flagged = true; continue; }

    switch (key) {
      case "year": {
        const y = Number(value ?? consume());
        if (y) f.years.push(y);
        continue;
      }
      case "task": {
        const n = Number(value ?? consume());
        if (n) f.taskNo = n;
        continue;
      }
      case "points": {
        const v = value ?? consume();
        const n = Number(v);
        if (!Number.isNaN(n)) f.points = n;
        continue;
      }
      case "session": {
        const v = (value ?? consume() ?? "").toLowerCase();
        if (v) f.sessions.push(v);
        continue;
      }
      case "kind": {
        const v = (value ?? consume() ?? "").toLowerCase();
        if (v) f.kinds.push(v);
        continue;
      }
      case "topic": {
        const v = value ?? consume();
        if (v) f.topics.push(fold(v));
        continue;
      }
      case "solved": {
        f.solved = value !== "false";
        continue;
      }
      case "flagged": {
        f.flagged = value !== "false";
        continue;
      }
    }
    text.push(tok);
  }
  f.text = text.join(" ");
  return f;
}

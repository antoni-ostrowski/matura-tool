import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const DB_PATH = process.env.MATURA_DB ?? "data/matura.db";

/** A single matura sheet (arkusz): podstawowa, one session of one year. */
export interface Sheet {
  id: string;
  title: string;
  level: string;
  formula: "nowa" | "stara";
  session: string;
  year: number;
  url: string;
  pdf_url: string | null;
  source: string;
}

export interface Option {
  letter: string;
  content: string;
}

export interface Task {
  id: string;
  sheet_id: string;
  task_no: number;
  points: number;
  type: "closed" | "open";
  text: string;
  answer: string;
  explanation: string;
  scoring: string;
  topics: string[];
  options: Option[];
}

export interface SearchHit {
  task: Task;
  sheet: Sheet;
  score: number;
  matched: string[];
}

let db: Database | null = null;

export function getDb(path = DB_PATH): Database {
  if (db) return db;
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  init(db);
  return db;
}

function init(d: Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS sheets (
      id        TEXT PRIMARY KEY,
      title     TEXT NOT NULL,
      level     TEXT NOT NULL DEFAULT 'podstawowa',
      formula   TEXT NOT NULL DEFAULT 'nowa',
      session   TEXT NOT NULL,
      year      INTEGER NOT NULL,
      url       TEXT NOT NULL,
      pdf_url   TEXT,
      source    TEXT NOT NULL DEFAULT 'szaloneliczby'
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      sheet_id    TEXT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
      task_no     INTEGER NOT NULL,
      points      REAL NOT NULL DEFAULT 0,
      type        TEXT NOT NULL DEFAULT 'open',
      text        TEXT NOT NULL DEFAULT '',
      answer      TEXT NOT NULL DEFAULT '',
      explanation TEXT NOT NULL DEFAULT '',
      scoring     TEXT NOT NULL DEFAULT '',
      options     TEXT NOT NULL DEFAULT '[]',
      topics      TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_sheet ON tasks(sheet_id, task_no);

    CREATE TABLE IF NOT EXISTS progress (
      task_id    TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
      solved     INTEGER NOT NULL DEFAULT 0,
      flagged    INTEGER NOT NULL DEFAULT 0,
      note       TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

export function resetDb(path = DB_PATH) {
  const d = new Database(path);
  d.exec("DROP TABLE IF EXISTS progress; DROP TABLE IF EXISTS tasks; DROP TABLE IF EXISTS sheets;");
  d.close();
}

export function upsertSheet(d: Database, s: Sheet) {
  d.query(
    `INSERT INTO sheets (id, title, level, formula, session, year, url, pdf_url, source)
     VALUES ($id, $title, $level, $formula, $session, $year, $url, $pdf_url, $source)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, level=excluded.level, formula=excluded.formula,
       session=excluded.session, year=excluded.year, url=excluded.url,
       pdf_url=excluded.pdf_url, source=excluded.source`,
  ).run({
    $id: s.id,
    $title: s.title,
    $level: s.level,
    $formula: s.formula,
    $session: s.session,
    $year: s.year,
    $url: s.url,
    $pdf_url: s.pdf_url,
    $source: s.source,
  });
}

export function upsertTask(d: Database, t: Task) {
  d.query(
    `INSERT INTO tasks (id, sheet_id, task_no, points, type, text, answer, explanation, scoring, options, topics)
     VALUES ($id, $sheet_id, $task_no, $points, $type, $text, $answer, $explanation, $scoring, $options, $topics)
     ON CONFLICT(id) DO UPDATE SET
       sheet_id=excluded.sheet_id, task_no=excluded.task_no, points=excluded.points,
       type=excluded.type, text=excluded.text, answer=excluded.answer,
       explanation=excluded.explanation, scoring=excluded.scoring,
       options=excluded.options, topics=excluded.topics`,
  ).run({
    $id: t.id,
    $sheet_id: t.sheet_id,
    $task_no: t.task_no,
    $points: t.points,
    $type: t.type,
    $text: t.text,
    $answer: t.answer,
    $explanation: t.explanation,
    $scoring: t.scoring,
    $options: JSON.stringify(t.options),
    $topics: JSON.stringify(t.topics),
  });
}

function hydrateTask(row: any): Task {
  return {
    ...row,
    options: JSON.parse(row.options ?? "[]"),
    topics: JSON.parse(row.topics ?? "[]"),
  };
}

export interface LoadedData {
  sheets: Sheet[];
  tasks: Task[];
  progress: Record<string, { solved: boolean; flagged: boolean; note: string }>;
}

export function loadAll(d: Database): LoadedData {
  const sheets = d.query("SELECT * FROM sheets").all() as Sheet[];
  const tasks = (d.query("SELECT * FROM tasks").all() as any[]).map(hydrateTask);
  const progress: LoadedData["progress"] = {};
  for (const p of d.query("SELECT * FROM progress").all() as any[]) {
    progress[p.task_id] = { solved: !!p.solved, flagged: !!p.flagged, note: p.note };
  }
  return { sheets, tasks, progress };
}

export function setProgress(
  d: Database,
  taskId: string,
  patch: { solved?: boolean; flagged?: boolean; note?: string },
) {
  const cur = d.query("SELECT * FROM progress WHERE task_id = ?").get(taskId) as any;
  const solved = patch.solved ?? (cur ? !!cur.solved : false);
  const flagged = patch.flagged ?? (cur ? !!cur.flagged : false);
  const note = patch.note ?? (cur ? cur.note : "");
  d.query(
    `INSERT INTO progress (task_id, solved, flagged, note, updated_at)
     VALUES ($id, $solved, $flagged, $note, unixepoch())
     ON CONFLICT(task_id) DO UPDATE SET
       solved=excluded.solved, flagged=excluded.flagged, note=excluded.note, updated_at=unixepoch()`,
  ).run({
    $id: taskId,
    $solved: solved ? 1 : 0,
    $flagged: flagged ? 1 : 0,
    $note: note,
  });
  return { solved, flagged, note };
}

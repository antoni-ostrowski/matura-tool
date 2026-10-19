/**
 * matura-tool server: REST API + static frontend.
 *
 *   bun run serve           # http://localhost:8787
 *   PORT=9000 bun run serve
 */
import { getDb, loadAll, setProgress, type LoadedData } from "./db.ts";
import { SearchEngine } from "./search.ts";

const PORT = Number(process.env.PORT ?? "8787");
const HOST = process.env.HOST ?? "0.0.0.0";
const IMAGES_DIR = process.env.MATURA_IMAGES ?? "data/images";

const db = getDb();
let engine = new SearchEngine(loadAll(db));

function summary(hit: ReturnType<SearchEngine["search"]>["hits"][number]) {
  const p = engine.progress[hit.task.id];
  return {
    id: hit.task.id,
    year: hit.sheet.year,
    session: hit.sheet.session,
    level: hit.sheet.level,
    formula: hit.sheet.formula,
    task_no: hit.task.task_no,
    points: hit.task.points,
    type: hit.task.type,
    text: hit.task.text,
    answer: hit.task.answer,
    topics: hit.task.topics,
    solved: !!p?.solved,
    flagged: !!p?.flagged,
    score: Number(hit.score.toFixed(3)),
    matched: hit.matched,
  };
}

function facets() {
  const byYear = new Map<number, number>();
  for (const s of engine.sheets) byYear.set(s.year, (byYear.get(s.year) ?? 0) + 1);
  return {
    years: engine.years.map((y) => ({ year: y, sheets: byYear.get(y) ?? 0 })),
    sessions: [...new Set(engine.sheets.map((s) => s.session))].sort(),
    topics: engine.topics,
    levels: [...new Set(engine.sheets.map((s) => s.level))],
    sheets: engine.sheets.length,
    tasks: engine.tasks.length,
  };
}

function neighbors(item: { task: { sheet_id: string; task_no: number } }) {
  const siblings = engine.tasks
    .filter((t) => t.task.sheet_id === item.task.sheet_id)
    .sort((a, b) => a.task.task_no - b.task.task_no);
  const i = siblings.findIndex((t) => t.task.task_no === item.task.task_no);
  return {
    prev: i > 0 ? siblings[i - 1]!.task.id : null,
    next: i < siblings.length - 1 ? siblings[i + 1]!.task.id : null,
  };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
};

async function serveFile(path: string): Promise<Response | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return new Response(file, {
    headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
  });
}

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    try {
      if (p === "/api/health") return json({ ok: true, tasks: engine.tasks.length });

      if (p === "/api/facets") return json(facets());

      if (p === "/api/search") {
        const q = url.searchParams.get("q") ?? "";
        const limit = Number(url.searchParams.get("limit") ?? "60");
        const result = engine.search(q, limit);
        return json({
          query: q,
          filters: result.filters,
          total: result.total,
          hits: result.hits.map(summary),
        });
      }

      if (p.startsWith("/api/task/")) {
        const id = decodeURIComponent(p.slice("/api/task/".length));
        const item = engine.byId.get(id);
        if (!item) return json({ error: "not found" }, 404);
        const pr = engine.progress[id];
        return json({
          task: item.task,
          sheet: item.sheet,
          neighbors: neighbors(item),
          progress: { solved: !!pr?.solved, flagged: !!pr?.flagged, note: pr?.note ?? "" },
        });
      }

      if (p.startsWith("/api/progress/") && req.method === "POST") {
        const id = decodeURIComponent(p.slice("/api/progress/".length));
        if (!engine.byId.has(id)) return json({ error: "not found" }, 404);
        const patch = (await req.json().catch(() => ({}))) as {
          solved?: boolean;
          flagged?: boolean;
          note?: string;
        };
        const next = setProgress(db, id, patch);
        engine.progress[id] = next;
        return json(next);
      }

      if (p === "/api/reload" && req.method === "POST") {
        engine = new SearchEngine(loadAll(db));
        return json({ ok: true, tasks: engine.tasks.length });
      }

      // static assets
      if (p.startsWith("/images/")) {
        const f = await serveFile(`${IMAGES_DIR}/${p.slice("/images/".length)}`);
        return f ?? new Response("not found", { status: 404 });
      }
      if (p.startsWith("/vendor/katex/")) {
        const f = await serveFile(`node_modules/katex/dist/${p.slice("/vendor/katex/".length)}`);
        return f ?? new Response("not found", { status: 404 });
      }
      if (p === "/" || p === "/index.html") {
        const f = await serveFile("web/index.html");
        return f ?? new Response("frontend missing", { status: 500 });
      }
      const f = await serveFile(`web${p}`);
      if (f) return f;
      const fallback = await serveFile("web/index.html");
      return fallback ?? new Response("not found", { status: 404 });
    } catch (err) {
      console.error(err);
      return json({ error: (err as Error).message }, 500);
    }
  },
});

console.log(`matura-tool → http://localhost:${server.port}  (${engine.tasks.length} tasks)`);

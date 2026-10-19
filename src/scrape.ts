/**
 * Scraper: szaloneliczby.pl -> data/matura.db
 *
 *   bun run scrape                 # full scrape (arkusze + topics + images)
 *   bun run scrape -- --limit 3    # first 3 sheets only (fast smoke test)
 *   bun run scrape -- --no-images  # skip mirroring PNGs
 *   bun run scrape -- --reset      # wipe tables first
 *
 * Source adapter: the `Source` shape keeps room for a second provider
 * (e.g. CKE/arkusze.pl for poziom rozszerzony) without touching the rest.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseSheet, parseTopicTasks } from "./parse.ts";
import { taskKey } from "./text.ts";
import { getDb, resetDb, upsertSheet, upsertTask, type Task } from "./db.ts";

const ORIGIN = "https://szaloneliczby.pl";
const IMAGES_DIR = process.env.MATURA_IMAGES ?? "data/images";
const args = process.argv.slice(2);
const LIMIT = Number(argValue("--limit") ?? "0");
const NO_IMAGES = args.includes("--no-images");
const RESET = args.includes("--reset");

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const imageCache = new Map<string, string>();
const downloaded = new Set<string>();

function localName(url: string): string {
  const base = new URL(url).pathname.split("/").pop() ?? "img.png";
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 8);
  return `${hash}-${base.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

async function mirrorImage(url: string): Promise<string> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const name = localName(url);
  const local = `/images/${name}`;
  imageCache.set(url, local);
  const file = join(IMAGES_DIR, name);
  if (!existsSync(file)) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        await writeFile(file, buf);
        downloaded.add(name);
      } else {
        console.warn(`  ! image ${res.status}: ${url}`);
      }
    } catch (err) {
      console.warn(`  ! image failed: ${url} (${(err as Error).message})`);
    }
  }
  return local;
}

async function rewriteImages(fields: string[]): Promise<string[]> {
  if (NO_IMAGES) return fields;
  const urls = new Set<string>();
  for (const f of fields) {
    for (const m of f.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) urls.add(m[1]!);
  }
  if (urls.size === 0) return fields;
  const mapping = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (u) => {
      mapping.set(u, await mirrorImage(u));
    }),
  );
  return fields.map((f) =>
    f.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const local = mapping.get(src);
      return local ? `![${alt}](${local})` : `![${alt}](${src})`;
    }),
  );
}

async function fetchText(url: string, attempt = 1): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "matura-tool/0.1 (personal study tool)" },
  });
  if (!res.ok) {
    if (attempt < 3) {
      await Bun.sleep(1500 * attempt);
      return fetchText(url, attempt + 1);
    }
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  return res.text();
}

async function collectUrls(): Promise<{ arkusze: string[]; topics: string[] }> {
  const index = await fetchText(`${ORIGIN}/sitemap.xml`);
  const maps = [...index.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((m) => m[1]!)
    .filter((u) => /post-sitemap\d*\.xml$/.test(u));
  const parts = await Promise.all(maps.map((u) => fetchText(u)));
  const all = parts.flatMap((t) =>
    [...t.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]!),
  );
  const arkusze = all.filter((u) => /matura-podstawowa-.*-odpowiedzi\/$/.test(u));
  const topics = all.filter((u) => /-zadania-maturalne\/$/.test(u));
  return { arkusze: [...new Set(arkusze)], topics: [...new Set(topics)] };
}

async function buildTopicIndex(topics: string[]): Promise<Map<string, string[]>> {
  const index = new Map<string, string[]>();
  let done = 0;
  await mapPool(topics, 4, async (url) => {
    const html = await fetchText(url);
    const slug = new URL(url).pathname.replace(/^\/|\/$/g, "");
    const name = slug
      .replace(/-zadania-maturalne$/, "")
      .replace(/-/g, " ")
      .trim();
    for (const { text } of parseTopicTasks(html)) {
      const key = taskKey(text);
      if (!key) continue;
      const list = index.get(key) ?? [];
      if (!list.includes(name)) list.push(name);
      index.set(key, list);
    }
    done++;
    process.stdout.write(`  topics ${done}/${topics.length}\r`);
    await Bun.sleep(120);
  });
  process.stdout.write("\n");
  return index;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<void>,
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const t0 = Date.now();
  if (RESET) resetDb();
  const db = getDb();
  await mkdir(IMAGES_DIR, { recursive: true });

  console.log("→ reading sitemaps…");
  const { arkusze, topics } = await collectUrls();
  console.log(`  ${arkusze.length} arkusze, ${topics.length} topic pages`);

  console.log("→ building topic index…");
  const topicIndex = await buildTopicIndex(topics);
  console.log(`  ${topicIndex.size} tagged question variants`);

  const list = LIMIT > 0 ? arkusze.slice(0, LIMIT) : arkusze;
  let sheets = 0;
  let tasks = 0;
  let tagged = 0;

  await mapPool(list, 4, async (url) => {
    const html = await fetchText(url);
    const { sheet, tasks: parsed } = parseSheet(url, html);
    upsertSheet(db, sheet);

    for (const p of parsed) {
      const topicLabels = topicIndex.get(taskKey(p.text)) ?? [];
      if (topicLabels.length) tagged++;

      const [text, answer, explanation, scoring, ...optContents] = await rewriteImages([
        p.text,
        p.answer,
        p.explanation,
        p.scoring,
        ...p.options.map((o) => o.content),
      ]);

      const options = p.options.map((o, i) => ({ letter: o.letter, content: optContents[i]! }));
      const task: Task = {
        id: `${sheet.id}#${p.task_no}`,
        sheet_id: sheet.id,
        task_no: p.task_no,
        points: p.points,
        type: p.type,
        text: text!,
        answer: answer!,
        explanation: explanation!,
        scoring: scoring!,
        options,
        topics: topicLabels,
      };
      upsertTask(db, task);
      tasks++;
    }

    sheets++;
    process.stdout.write(`  sheets ${sheets}/${list.length}  tasks ${tasks}  tagged ${tagged}\r`);
    await Bun.sleep(150);
  });

  console.log(`\n✓ ${sheets} sheets, ${tasks} tasks, ${downloaded.size} new images`);
  console.log(`  topic-tagged ${tagged} tasks`);
  console.log(`  db: ${process.env.MATURA_DB ?? "data/matura.db"}`);
  console.log(`  took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();

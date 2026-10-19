/** Quick terminal search: bun run src/cli.ts "2015 maj kula stozek" */
import { getDb, loadAll } from "./db.ts";
import { SearchEngine } from "./search.ts";

const query = process.argv.slice(2).join(" ");
const engine = new SearchEngine(loadAll(getDb()));
const { filters, total, hits } = engine.search(query, 12);

console.log(`query: ${query || "(empty)"}`);
console.log(`filters: ${JSON.stringify({ ...filters, text: filters.text })}`);
console.log(`total: ${total}\n`);

for (const h of hits) {
  const meta = `${h.sheet.year} ${h.sheet.session} · zad ${h.task.task_no} · ${h.task.points}pkt · ${h.task.type}`;
  const plain = h.task.text.replace(/!\[[^\]]*\]\([^)]*\)/g, "[rysunek]").replace(/\n+/g, " ");
  console.log(`[${h.score.toFixed(2)}] ${meta}`);
  console.log(`   ${plain.slice(0, 160)}`);
  console.log(`   → ${h.task.answer.replace(/\n+/g, " ").slice(0, 100) || "(brak)"}`);
  if (h.task.topics.length) console.log(`   # ${h.task.topics.join(", ")}`);
  console.log();
}

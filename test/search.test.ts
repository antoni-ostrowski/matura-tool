import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { getDb, loadAll } from "../src/db.ts";
import { parseFilters, SearchEngine } from "../src/search.ts";

describe("parseFilters", () => {
  test("bare year and session", () => {
    const f = parseFilters("2015 maj kula");
    expect(f.years).toEqual([2015]);
    expect(f.sessions).toEqual(["maj"]);
    expect(f.text).toBe("kula");
  });

  test("key:value forms", () => {
    const f = parseFilters("rok:2018 zad:26 punkty:2");
    expect(f.years).toEqual([2018]);
    expect(f.taskNo).toBe(26);
    expect(f.points).toBe(2);
    expect(f.text).toBe("");
  });

  test("space-separated value after key", () => {
    const f = parseFilters("year 2019 funkcja");
    expect(f.years).toEqual([2019]);
    expect(f.text).toBe("funkcja");
  });

  test("long and short key aliases are equivalent", () => {
    const long = parseFilters("rok:2016 zad:12 punkty:2");
    const short = parseFilters("r:2016 z:12 pkt:2");
    expect(short.years).toEqual(long.years);
    expect(short.taskNo).toEqual(long.taskNo);
    expect(short.points).toEqual(long.points);
    expect(parseFilters("y:2016").years).toEqual([2016]);
    expect(parseFilters("p:3").points).toBe(3);
    expect(parseFilters("pts:5").points).toBe(5);
  });

  test("single-letter aliases require a colon (so 'z' stays a word)", () => {
    const f = parseFilters("z:12");
    expect(f.taskNo).toBe(12);
    const g = parseFilters("wykres z funkcji");
    expect(g.text).toBe("wykres z funkcji");
    expect(g.taskNo).toBeNull();
  });

  test("progress flags", () => {
    expect(parseFilters("unsolved").solved).toBe(false);
    expect(parseFilters("flagged").flagged).toBe(true);
    expect(parseFilters("solved").solved).toBe(true);
  });

  test("levels", () => {
    expect(parseFilters("rozsz").levels).toEqual(["rozszerzona"]);
    expect(parseFilters("podst").levels).toEqual(["podstawowa"]);
  });
});

const dbPath = process.env.MATURA_DB ?? "data/matura.db";
const hasDb = existsSync(dbPath);

describe.skipIf(!hasDb)("SearchEngine (integration)", () => {
  const engine = new SearchEngine(loadAll(getDb()));

  test("diacritics are optional", () => {
    const a = engine.search("prawdopodobienstwo").hits.length;
    const b = engine.search("prawdopodobieństwo").hits.length;
    expect(a).toBeGreaterThan(0);
    expect(a).toBe(b);
  });

  test("fuzzy tolerates a typo", () => {
    const hits = engine.search("funkcja kwadrtowa").hits;
    expect(hits.length).toBeGreaterThan(0);
  });

  test("year filter is exclusive", () => {
    const { hits } = engine.search("2015 maj");
    expect(hits.length).toBeGreaterThan(10);
    expect(hits.every((h) => h.sheet.year === 2015)).toBe(true);
  });

  test("topic matching surfaces related tasks", () => {
    const { hits } = engine.search("nierownosci kwadratowe");
    expect(hits.some((h) => h.task.topics.some((t) => t.includes("kwadratow")))).toBe(true);
  });
});

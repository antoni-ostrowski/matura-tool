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
    expect(parseFilters("m:maj").sessions).toEqual(["maj"]);
    expect(parseFilters("m:probna").sessions).toEqual(["probna"]);
    expect(parseFilters("k:poprawkowa").kinds).toEqual(["poprawkowa"]);
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

  test("topic is a filter, not free text", () => {
    const f = parseFilters("topic:kwadratowe");
    expect(f.topics).toEqual(["kwadratowe"]);
    expect(f.text).toBe("");
    expect(parseFilters("t:kwadratowe").topics).toEqual(["kwadratowe"]);
  });

  test("dzial:/d:/cke: target CKE chapters, accepting slug, numeral or name fragment", () => {
    expect(parseFilters("dzial:stereometria").dzialy).toEqual(["stereometria"]);
    expect(parseFilters("d:x").dzialy).toEqual(["stereometria"]);
    expect(parseFilters("cke:wielomian").dzialy).toEqual(["wyrazenia-algebraiczne"]);
    expect(parseFilters("t:kwadratowe d:ciagi").topics).toEqual(["kwadratowe"]);
    expect(parseFilters("t:kwadratowe d:ciagi").dzialy).toEqual(["ciagi"]);
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

  test("topic: is a hard filter — every hit carries the topic", () => {
    const { hits, total } = engine.search("topic:kwadratowe");
    expect(total).toBeGreaterThan(5);
    expect(hits.every((h) => h.task.topics.some((t) => t.includes("kwadratow")))).toBe(true);
  });

  test("topic: ignores diacritics", () => {
    const a = engine.search("topic:nierownosci").total;
    const b = engine.search("topic:nierówności").total;
    expect(a).toBeGreaterThan(0);
    expect(a).toBe(b);
  });

  test("topic: combines with other filters", () => {
    const { hits } = engine.search("topic:kwadratowe r:2015");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.sheet.year === 2015)).toBe(true);
  });

  test("dzial: is a hard filter and every hit carries that chapter", () => {
    const { hits, total } = engine.search("d:stereometria");
    expect(total).toBeGreaterThan(50);
    expect(hits.every((h) => engine.byId.get(h.task.id)?.dzial === "stereometria")).toBe(true);
  });

  test("dzial: accepts numeral and name fragment", () => {
    const bySlug = engine.search("d:stereometria").total;
    expect(engine.search("d:x").total).toBe(bySlug);
    expect(engine.search("d:planimetria").total).toBe(engine.search("d:viii").total);
  });

  test("dzial: combines with year", () => {
    const { hits } = engine.search("d:ciagi r:2016");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.sheet.year === 2016)).toBe(true);
  });

  test("the classifier labels the overwhelming majority of tasks", () => {
    const classified = engine.tasks.filter((t) => t.dzial).length;
    expect(classified / engine.tasks.length).toBeGreaterThan(0.9);
  });
});

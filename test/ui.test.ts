import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import katex from "katex";

let document: any;
let window: any;
let detail: any;

const emptyFilters = {
  years: [],
  sessions: [],
  kinds: [],
  levels: [],
  taskNo: null,
  points: null,
  solved: null,
  flagged: null,
  text: "",
};
const hit = {
  id: "s#1",
  year: 2015,
  session: "maj",
  level: "podstawowa",
  formula: "nowa",
  task_no: 1,
  points: 1,
  type: "closed",
  text: "kula",
  answer: "A",
  topics: [],
  solved: false,
  flagged: false,
  score: 1,
  matched: ["kula"],
};
const task = {
  id: "s#1",
  sheet_id: "s",
  task_no: 1,
  points: 1,
  type: "closed",
  text: "kula",
  answer: "A",
  explanation: "e",
  scoring: "",
  options: [],
  topics: [],
};
const sheet = {
  id: "s",
  title: "t",
  level: "podstawowa",
  formula: "nowa",
  session: "maj",
  year: 2015,
  url: "http://x",
  pdf_url: null,
  source: "z",
};

function key(k: string) {
  const Ctor = window.KeyboardEvent ?? window.Event;
  const ev = new Ctor("keydown", { key: k, bubbles: true, cancelable: true });
  if (ev.key !== k) Object.defineProperty(ev, "key", { value: k });
  document.dispatchEvent(ev);
}

/** linkedom's focus() is unreliable, so force activeElement to exercise the guard. */
function setActive(el: any) {
  try {
    el.focus?.();
  } catch {}
  if (document.activeElement !== el) {
    Object.defineProperty(document, "activeElement", { value: el, configurable: true });
  }
}

beforeAll(async () => {
  const { parseHTML } = await import("linkedom");
  const html = readFileSync("web/index.html", "utf8");
  const dom = parseHTML(html);
  window = dom.window;
  document = dom.document;
  (globalThis as any).window = window;
  (globalThis as any).document = document;
  (globalThis as any).katex = katex;
  if (!(globalThis as any).location) {
    (globalThis as any).location = new URL("http://localhost:8787/");
  }
  (globalThis as any).fetch = async (url: string) => {
    const body = url.includes("/api/facets")
      ? { years: [], sessions: [], topics: [], levels: [], sheets: 1, tasks: 1 }
      : url.includes("/api/task/")
        ? { task, sheet, neighbors: { prev: null, next: null }, progress: { solved: false, flagged: false, note: "" } }
        : { query: "", filters: emptyFilters, total: 1, hits: [hit] };
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  };

  await import("../web/app.js");
  await new Promise((r) => setTimeout(r, 80));

  detail = document.querySelector("#detail");
  Object.defineProperty(detail, "clientHeight", { value: 600, configurable: true });
  Object.defineProperty(detail, "scrollHeight", { value: 2000, configurable: true });
});

describe("keyboard scrolling of the detail pane", () => {
  test("boot renders a result and loads detail", () => {
    expect(document.querySelectorAll("#list .hit").length).toBe(1);
    expect(detail.textContent).toContain("Zadanie 1");
  });

  test("d scrolls down ~half a page", () => {
    setActive(document.body);
    detail.scrollTop = 0;
    key("d");
    expect(detail.scrollTop).toBe(360);
  });

  test("u scrolls back up", () => {
    key("u");
    expect(detail.scrollTop).toBe(0);
  });

  test("G jumps to bottom, g back to top", () => {
    key("G");
    expect(detail.scrollTop).toBe(2000);
    key("g");
    expect(detail.scrollTop).toBe(0);
  });

  test("d does NOT scroll while the search box is focused", () => {
    const q = document.querySelector("#q");
    setActive(q);
    detail.scrollTop = 0;
    key("d");
    expect(detail.scrollTop).toBe(0);
  });

  test("j/k still move the result selection, not the pane", () => {
    setActive(document.body);
    detail.scrollTop = 0;
    key("j");
    key("k");
    expect(detail.scrollTop).toBe(0);
  });

  test("clicking a figure toggles full size, not the answer", () => {
    const img = document.createElement("img");
    img.className = "fig";
    detail.appendChild(img);
    img.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(img.classList.contains("fig-full")).toBe(true);
    img.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(img.classList.contains("fig-full")).toBe(false);
    img.remove();
  });
});

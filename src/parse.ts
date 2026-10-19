import { parse as parseHtml, type HTMLElement } from "node-html-parser";
import type { Option, Sheet } from "./db.ts";

export interface ParsedTask {
  task_no: number;
  points: number;
  type: "closed" | "open";
  text: string;
  answer: string;
  explanation: string;
  scoring: string;
  options: Option[];
  images: string[];
}

export interface ParsedSheet {
  sheet: Sheet;
  tasks: ParsedTask[];
}

const SESSIONS = ["maj", "czerwiec", "sierpien", "listopad", "styczen", "grudzien"];

/** Serialize a DOM subtree to a markdown-ish string that preserves LaTeX and image refs. */
function inlineMarkdown(node: HTMLElement): string {
  let out = "";
  for (const child of node.childNodes) {
    const nt = (child as any).nodeType;
    if (nt === 3) {
      out += (child as any).text ?? "";
    } else if (nt === 1) {
      const el = child as HTMLElement;
      const tag = (el.rawTagName ?? el.tagName ?? "").toLowerCase();
      if (tag === "br") out += "\n";
      else if (tag === "img") {
        const src = el.getAttribute("src") ?? "";
        const alt = el.getAttribute("alt") ?? "rysunek";
        if (src) out += `![${alt}](${src})`;
      } else if (tag === "script" || tag === "style") {
        // skip
      } else {
        out += inlineMarkdown(el);
      }
    }
  }
  return out;
}

/** Collapse whitespace while keeping intentional `\n` breaks. */
function tidy(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function firstMatchBox(slide: HTMLElement, tabClass: string): string {
  const boxes = slide.querySelectorAll("div");
  for (const box of boxes) {
    if (!box.classList.contains(tabClass)) continue;
    const md = inlineMarkdown(box);
    return tidy(md.replace(/^\s*(Odpowiedź|Wyjaśnienie|Podpowiedź|Punktacja)\s*:?/i, ""));
  }
  return "";
}

function parseOptions(slide: HTMLElement): Option[] {
  const options: Option[] = [];
  for (const input of slide.querySelectorAll("input[value]")) {
    const letter = input.getAttribute("value");
    if (!letter || !/^[A-E]$/.test(letter)) continue;
    const parent = input.parentNode as HTMLElement | null;
    const label = parent?.querySelector("label") ?? parent;
    if (!label) continue;
    const md = tidy(inlineMarkdown(label).replace(new RegExp(`^\\s*${letter}\\.?\\s*`), ""));
    options.push({ letter, content: md });
  }
  return options.sort((a, b) => a.letter.localeCompare(b.letter));
}

function collectImages(...parts: string[]): string[] {
  const set = new Set<string>();
  for (const p of parts) {
    for (const m of p.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) set.add(m[1]!);
  }
  return [...set];
}

function parseMeta(url: string, html: string): Sheet {
  const u = new URL(url);
  const slug = u.pathname.replace(/^\/|\/$/g, "");
  const id = slug.replace(/-odpowiedzi$/, "");
  const root = parseHtml(html);
  const h2 = root.querySelector("h2")?.text?.trim() ?? "";
  const title = h2 || slug.replace(/-/g, " ");

  const yearMatch = slug.match(/(19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : 0;
  const session = SESSIONS.find((s) => slug.includes(s)) ?? "maj";
  const kind = slug.includes("probna")
    ? "probna"
    : slug.includes("poprawkowa")
      ? "poprawkowa"
      : "";
  const sessionLabel = kind ? `${kind}-${session}` : session;

  const formula: Sheet["formula"] =
    slug.includes("stara-matura") || year < 2015 ? "stara" : "nowa";

  const pdfAnchor = root
    .querySelectorAll("a[href]")
    .map((a) => a.getAttribute("href") ?? "")
    .find((h) => h.includes("/arkusz/") && h.endsWith(".pdf"));

  return {
    id,
    title,
    level: "podstawowa",
    formula,
    session: sessionLabel,
    year,
    url,
    pdf_url: pdfAnchor
      ? new URL(pdfAnchor, u.origin).toString()
      : `${u.origin}/arkusz/${id}.pdf`,
    source: "szaloneliczby",
  };
}

export function parseSheet(url: string, html: string): ParsedSheet {
  const sheet = parseMeta(url, html);
  const root = parseHtml(html);
  const tasks: ParsedTask[] = [];

  for (const slide of root.querySelectorAll(".szalpdf-websheet-slide")) {
    const id = slide.getAttribute("id") ?? "";
    if (!id.startsWith("sheet-slide-")) continue;

    // The question lives in the <p> that contains "Zadanie N. (Xpkt)".
    let questionEl: HTMLElement | null = null;
    let header = "";
    for (const p of slide.querySelectorAll("p")) {
      const strong = p.querySelector("strong");
      const t = strong?.text?.trim() ?? "";
      if (/^Zadanie\s+\d+/.test(t)) {
        questionEl = p;
        header = t;
        break;
      }
    }
    if (!questionEl) continue;

    const taskNo = Number(header.match(/Zadanie\s+(\d+)/)?.[1] ?? tasks.length + 1);
    const points = Number(header.match(/\(([\d.,]+)\s*pkt\)/)?.[1]?.replace(",", ".") ?? 0);

    const fullText = tidy(inlineMarkdown(questionEl));
    const text = tidy(fullText.replace(/^Zadanie\s+\d+\.[^\n]*?pkt\)\s*/, ""));

    const options = parseOptions(slide);
    const answer = firstMatchBox(slide, "szalpdf-tabs-3");
    const explanation = firstMatchBox(slide, "szalpdf-tabs-4");
    const scoring = firstMatchBox(slide, "szalpdf-tabs-5");

    tasks.push({
      task_no: taskNo,
      points,
      type: options.length > 0 ? "closed" : "open",
      text,
      answer,
      explanation,
      scoring,
      options,
      images: collectImages(text, answer, explanation, scoring, ...options.map((o) => o.content)),
    });
  }

  return { sheet, tasks };
}

/** Extract just the question texts from a topic-collection page, for topic tagging. */
export function parseTopicTasks(html: string): { text: string; answer: string }[] {
  const root = parseHtml(html);
  const out: { text: string; answer: string }[] = [];
  for (const slide of root.querySelectorAll(".szalpdf-websheet-slide")) {
    let questionEl: HTMLElement | null = null;
    for (const p of slide.querySelectorAll("p")) {
      const strong = p.querySelector("strong");
      if (/^Zadanie\s+\d+/.test(strong?.text?.trim() ?? "")) {
        questionEl = p;
        break;
      }
    }
    if (!questionEl) continue;
    const text = tidy(
      inlineMarkdown(questionEl).replace(/^Zadanie\s+\d+\.[^\n]*?pkt\)\s*/, ""),
    );
    out.push({ text, answer: firstMatchBox(slide, "szalpdf-tabs-3") });
  }
  return out;
}

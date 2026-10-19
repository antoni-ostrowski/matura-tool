import { describe, expect, test, beforeAll } from "bun:test";
import katex from "katex";
import { existsSync } from "node:fs";
import { mdToHtml, plain, fixDisplayMath, highlight } from "../web/render.js";

beforeAll(() => {
  (globalThis as any).katex = katex;
});

describe("render.js", () => {
  test("renders inline and display math, not raw delimiters", () => {
    const html = mdToHtml("Rozwiąż \\(x^2-x-2\\le0\\).");
    expect(html).toContain("katex");
    expect(html).not.toContain("\\(");
  });

  test("newlines inside display math do not break rendering", () => {
    const md = "Krok 1:\n\n$$7x+1\\neq0 \\\\ 7x\\neq-1 \\\\ x\\neq-\\frac{1}{7}$$\n\nKoniec";
    const html = mdToHtml(md);
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("$$");
    expect(html).toContain("<br>");
    expect(html).toContain("katex-display");
  });

  test("images become img tags and stay escaped", () => {
    const html = mdToHtml('tekst ![rysunek](/images/a.png) dalej <b>');
    expect(html).toContain('<img class="fig"');
    expect(html).toContain('src="/images/a.png"');
    expect(html).toContain("&lt;b&gt;");
  });

  test("fixDisplayMath wraps bare line breaks but leaves environments alone", () => {
    expect(fixDisplayMath("$$a \\\\ b$$")).toContain("\\begin{aligned}");
    expect(fixDisplayMath("$$\\begin{cases}a\\\\b\\end{cases}$$")).not.toContain("aligned");
    expect(fixDisplayMath("$$a+b$$")).toBe("$$a+b$$");
  });

  test("plain() drops delimiters, keeps readable content", () => {
    expect(plain("Oblicz \\(2+2\\) ![r](/i.png)")).toBe("Oblicz 2+2 [rysunek]");
  });

  test("highlight escapes html and wraps matches", () => {
    const out = highlight("kula <script>", ["kula"]);
    expect(out).toContain("<mark>kula</mark>");
    expect(out).toContain("&lt;script&gt;");
  });

  const dbPath = process.env.MATURA_DB ?? "data/matura.db";
  test.skipIf(!existsSync(dbPath))("renders every real explanation without katex errors", async () => {
    const { Database } = await import("bun:sqlite");
    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .query("SELECT explanation FROM tasks WHERE explanation != '' LIMIT 400")
      .all() as { explanation: string }[];
    expect(rows.length).toBeGreaterThan(100);
    let bad = 0;
    for (const r of rows) {
      const html = mdToHtml(r.explanation);
      if (html.includes("katex-error")) bad++;
    }
    expect(bad).toBe(0);
  });
});

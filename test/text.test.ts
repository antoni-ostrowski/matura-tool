import { describe, expect, test } from "bun:test";
import { editDistance, fold, stripMath, taskKey, tokens } from "../src/text.ts";

describe("fold", () => {
  test("strips Polish diacritics both ways", () => {
    expect(fold("Prawdopodobieństwo ŁÓDŹ ĆMA")).toBe("prawdopodobienstwo lodz cma");
  });
});

describe("stripMath", () => {
  test("removes latex and image syntax, keeps words", () => {
    expect(stripMath("Oblicz \\(x^2\\) ![r](/i.png) wartość").replace(/\s+/g, " ").trim()).toBe(
      "Oblicz wartość",
    );
  });
});

describe("taskKey", () => {
  test("template questions with different math do NOT collide", () => {
    const a = taskKey("Liczba \\(2^3\\) jest równa:");
    const b = taskKey("Liczba \\(3^2\\) jest równa:");
    expect(a).not.toBe(b);
  });

  test("the same question from two pages matches despite whitespace differences", () => {
    const arkusz = "Rozwiąż nierówność \\(x^2-x-2\\le 0\\).";
    const topic = "Rozwiąż nierówność  \\(x^2-x-2\\le 0\\).   ";
    expect(taskKey(arkusz)).toBe(taskKey(topic));
  });

  test("image URLs are ignored (same figure, different hosting path)", () => {
    const a = taskKey("Wskaż rysunek ![matura](/rys/arkusz-2-1a.png)");
    const b = taskKey("Wskaż rysunek ![matura](/rys/matura-339.png)");
    expect(a).toBe(b);
  });

  test("number of figures still matters", () => {
    const a = taskKey("Wskaż rysunek ![x](/a.png)");
    const b = taskKey("Wskaż rysunek ![x](/a.png) ![y](/b.png)");
    expect(a).not.toBe(b);
  });

  test("diacritics and case are irrelevant", () => {
    expect(taskKey("Ciąg geometryczny")).toBe(taskKey("ciag geometryczny"));
  });
});

describe("editDistance / tokens", () => {
  test("edit distance finds one typo", () => {
    expect(editDistance("kwadratowa", "kwadrtowa", 1)).toBe(1);
    expect(editDistance("kula", "stozek", 1)).toBeGreaterThan(1);
  });

  test("tokens drops single characters", () => {
    expect(tokens("a kula z 2")).toEqual(["kula"]);
  });
});

import { describe, expect, test } from "bun:test";
import { CKE_DZIALY, classifyDzial, resolveDzial } from "../src/cke.ts";

describe("resolveDzial", () => {
  test("accepts slug, roman numeral, name fragment and fine-topic name", () => {
    expect(resolveDzial("stereometria")).toBe("stereometria");
    expect(resolveDzial("X")).toBe("stereometria");
    expect(resolveDzial("prawdopodobienstwo")).toBe("prawdopodobienstwo-i-statystyka");
    expect(resolveDzial("wielomian")).toBe("wyrazenia-algebraiczne");
    expect(resolveDzial("ciągi")).toBe("ciagi");
  });

  test("numerals are exact, not substrings (x != ix)", () => {
    expect(resolveDzial("x")).toBe("stereometria");
    expect(resolveDzial("ix")).toBe("geometria-analityczna");
    expect(resolveDzial("v")).toBe("funkcje");
    expect(resolveDzial("iv")).toBe("uklady-rownan");
  });

  test("nonsense resolves to null", () => {
    expect(resolveDzial("qwertyuiop")).toBeNull();
    expect(resolveDzial("")).toBeNull();
  });
});

describe("classifyDzial", () => {
  const cases: [string, string][] = [
    ["Oblicz \\(\\log_2 8\\).", "liczby-rzeczywiste"],
    ["Wyrażenie \\(27x^3+y^3\\) jest równe iloczynowi:", "wyrazenia-algebraiczne"],
    ["Rozwiąż nierówność \\(x^2-3x+2<0\\).", "rownania-i-nierownosci"],
    ["Rozwiąż układ równań \\(\\begin{cases}x+y=3\\\\x-y=1\\end{cases}\\).", "uklady-rownan"],
    [
      "Dana jest funkcja kwadratowa \\(f(x)=x^2-4x+3\\). Wyznacz zbiór wartości.",
      "funkcje",
    ],
    ["Dany jest ciąg arytmetyczny o \\(a_1=2\\), \\(r=3\\). Oblicz \\(a_{10}\\).", "ciagi"],
    ["W trójkącie prostokątnym oblicz \\(\\sin\\alpha\\).", "trygonometria"],
    ["Oblicz pole trójkąta o bokach \\(3, 4, 5\\).", "planimetria"],
    [
      "Dane są punkty \\(A=(-2,3)\\) i \\(B=(4,6)\\). Długość odcinka \\(AB\\) jest równa:",
      "geometria-analityczna",
    ],
    ["Oblicz objętość graniastosłupa prawidłowego trójkątnego.", "stereometria"],
    ["Na ile sposobów można ustawić w szeregu 5 osób?", "kombinatoryka"],
    [
      "Rzucamy dwa razy sześcienną kostką. Oblicz prawdopodobieństwo.",
      "prawdopodobienstwo-i-statystyka",
    ],
    ["Wyznacz pochodną funkcji \\(f(x)=x^3-3x\\).", "optymalizacja-i-rachunek-rozniczkowy"],
  ];

  for (const [text, expected] of cases) {
    test(`"${text.slice(0, 40)}…" → ${expected}`, () => {
      expect(classifyDzial(text).dzial).toBe(expected);
    });
  }

  test("a fine topic overrides a weak keyword signal", () => {
    // text looks like dział I, but the site's topic says stereometria
    const c = classifyDzial("Objętość bryły jest równa 12.", [], ["bryly obrotowe"]);
    expect(c.dzial).toBe("stereometria");
    expect(c.confident).toBe(true);
  });

  test("returns null when nothing recognisable is present", () => {
    expect(classifyDzial("Zaznacz poprawną odpowiedź.").dzial).toBeNull();
  });

  test("tie is broken by the official chapter order", () => {
    // both trygonometria (sin) and planimetria (trójkąt) hit; VII comes before VIII
    expect(classifyDzial("W trójkącie oblicz \\(\\cos\\beta\\).").dzial).toBe("trygonometria");
  });

  test("every chapter has a unique numeral and slug", () => {
    const slugs = new Set(CKE_DZIALY.map((d) => d.slug));
    const numerals = new Set(CKE_DZIALY.map((d) => d.numeral));
    expect(slugs.size).toBe(CKE_DZIALY.length);
    expect(numerals.size).toBe(CKE_DZIALY.length);
  });
});

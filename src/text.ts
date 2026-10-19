/**
 * Text normalization helpers shared by the scraper (topic matching, dedup)
 * and the search layer (diacritic-insensitive fuzzy matching).
 */

const PL_MAP: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "a",
  Ć: "c",
  Ę: "e",
  Ł: "l",
  Ń: "n",
  Ó: "o",
  Ś: "s",
  Ź: "z",
  Ż: "z",
};

/** Lowercase + strip Polish diacritics so `prawdopodobienstwo` matches `prawdopodobieństwo`. */
export function fold(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) out += PL_MAP[ch] ?? ch;
  return out
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Remove LaTeX notation and markdown images, leaving plain words for indexing. */
export function stripMath(input: string): string {
  return input
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // markdown images
    .replace(/\$\$[\s\S]*?\$\$/g, " ") // display math
    .replace(/\\\([\s\S]*?\\\)/g, " ") // inline math
    .replace(/\\\[[\s\S]*?\\\]/g, " ") // display math alt
    .replace(/\\[a-zA-Z]+/g, " ") // leftover latex commands
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable key for deduping the same task across arkusze and topic pages.
 *
 * Must NOT strip math: template questions ("Liczba \(x\) jest równa:") are only
 * distinguished by their formulas. Image URLs differ between an arkusz page and a
 * topic page, so they're replaced by a positional marker instead of being compared. */
export function taskKey(text: string): string {
  return fold(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[img]")
    .replace(/\s+/g, "")
    .slice(0, 400);
}

export function tokens(input: string): string[] {
  return fold(input)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** Levenshtein distance with early exit when the budget is exceeded. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

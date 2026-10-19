/**
 * CKE dział (chapter) classification.
 *
 * The official matura syllabus has 13 numbered areas (I–XIII). No per-question label
 * exists publicly, so dział is inferred from the question text:
 *
 *   1. the site's own fine-grained topic (when the task has one) is the strongest hint;
 *   2. otherwise weighted keyword rules over the folded question text + options.
 *
 * Deterministic and offline — no API key, no cost. Accuracy is measured, not assumed.
 */
import { fold } from "./text.ts";

export const CKE_DZIALY = [
  { slug: "liczby-rzeczywiste", name: "Liczby rzeczywiste", numeral: "I" },
  { slug: "wyrazenia-algebraiczne", name: "Wyrażenia algebraiczne", numeral: "II" },
  { slug: "rownania-i-nierownosci", name: "Równania i nierówności", numeral: "III" },
  { slug: "uklady-rownan", name: "Układy równań", numeral: "IV" },
  { slug: "funkcje", name: "Funkcje", numeral: "V" },
  { slug: "ciagi", name: "Ciągi", numeral: "VI" },
  { slug: "trygonometria", name: "Trygonometria", numeral: "VII" },
  { slug: "planimetria", name: "Planimetria", numeral: "VIII" },
  { slug: "geometria-analityczna", name: "Geometria analityczna", numeral: "IX" },
  { slug: "stereometria", name: "Stereometria", numeral: "X" },
  { slug: "kombinatoryka", name: "Kombinatoryka", numeral: "XI" },
  {
    slug: "prawdopodobienstwo-i-statystyka",
    name: "Rachunek prawdopodobieństwa i statystyka",
    numeral: "XII",
  },
  {
    slug: "optymalizacja-i-rachunek-rozniczkowy",
    name: "Optymalizacja i rachunek różniczkowy",
    numeral: "XIII",
  },
] as const;

export type DzialSlug = (typeof CKE_DZIALY)[number]["slug"];

const ORDER = new Map<DzialSlug, number>(CKE_DZIALY.map((d, i) => [d.slug, i]));

export const DZIAL_NAME = new Map<DzialSlug, string>(
  CKE_DZIALY.map((d) => [d.slug, `${d.numeral}. ${d.name}`]),
);

/** Map of the site's 48 fine topics → CKE dział. High-confidence signal. */
export const FINE_TOPIC_TO_DZIAL: Record<string, DzialSlug> = {
  "logarytmy": "liczby-rzeczywiste",
  "wzory skroconego mnozenia": "wyrazenia-algebraiczne",
  "pierwiastki": "liczby-rzeczywiste",
  "odczytywanie informacji z tablic trygonometrycznych": "trygonometria",
  "potegi": "liczby-rzeczywiste",
  "liczby rzeczywiste": "liczby-rzeczywiste",
  "pozostale rownania": "rownania-i-nierownosci",
  "nierownosci kwadratowe": "rownania-i-nierownosci",
  "zaleznosci miedzy funkcjami trygonometrycznymi": "trygonometria",
  "rownania trzeciego i wyzszego stopnia": "rownania-i-nierownosci",
  "graniastoslupy i ostroslupy": "stereometria",
  "rownania wymierne": "rownania-i-nierownosci",
  "prawdopodobienstwo": "prawdopodobienstwo-i-statystyka",
  "punkty odcinki i proste": "geometria-analityczna",
  "ciag geometryczny": "ciagi",
  "procenty": "liczby-rzeczywiste",
  "ciag arytmetyczny": "ciagi",
  "wlasnosci funkcji": "funkcje",
  "wykresy wzory i wspolczynniki funkcji liniowej": "funkcje",
  "bryly obrotowe": "stereometria",
  "statystyka": "prawdopodobienstwo-i-statystyka",
  "proste prostopadle i rownolegle": "geometria-analityczna",
  "wzory i wspolczynniki funkcji kwadratowej": "funkcje",
  "odczytywanie informacji z wykresow funkcji": "funkcje",
  "rownania kwadratowe": "rownania-i-nierownosci",
  "wykresy funkcji kwadratowej": "funkcje",
  "styczna do okregu i okregi styczne": "planimetria",
  "podobienstwo figur": "planimetria",
  "ciagi liczbowe": "ciagi",
  "uklad rownan": "uklady-rownan",
  "trygonometria w stereometrii": "stereometria",
  "rownanie okregu": "geometria-analityczna",
  "kombinatoryka": "kombinatoryka",
  "rownania i nierownosci liniowe": "rownania-i-nierownosci",
  "zadania optymalizacyjne": "optymalizacja-i-rachunek-rozniczkowy",
  "wielomiany": "wyrazenia-algebraiczne",
  "obliczanie wartosci funkcji": "funkcje",
  "rownanie prostej": "geometria-analityczna",
  "funkcja wykladnicza i logarytmiczna": "funkcje",
  "funkcje trygonometryczne": "trygonometria",
  "trygonometria w planimetrii": "planimetria",
  "przeksztalcenia funkcji": "funkcje",
  "kat srodkowy i wpisany": "planimetria",
  "przedzialy liczbowe i zbiory": "liczby-rzeczywiste",
  "funkcja wykladnicza": "funkcje",
  "blad bezwzgledny i wzgledny": "liczby-rzeczywiste",
  "wartosci odwrotnie proporcjonalne": "funkcje",
  "symetria w ukladzie wspolrzednych": "geometria-analityczna",
};

const norm = (s: string) => fold(s).replace(/[^a-z0-9]+/g, "");

const DZIAL_BY_SLUG = new Map<string, DzialSlug>(CKE_DZIALY.map((d) => [d.slug, d.slug]));
const DZIAL_BY_NUMERAL = new Map<string, DzialSlug>(
  CKE_DZIALY.map((d) => [d.numeral.toLowerCase(), d.slug]),
);

/** Terms that should resolve to each dział: its official name plus the fine topic
 *  names that map onto it. Lets `d:wielomian` find dział II even though the official
 *  chapter name ("Wyrażenia algebraiczne") does not contain that word. */
const DZIAL_TERMS: [DzialSlug, string][] = (() => {
  const out: [DzialSlug, string][] = [];
  for (const d of CKE_DZIALY) out.push([d.slug, norm(d.name)]);
  for (const [topic, slug] of Object.entries(FINE_TOPIC_TO_DZIAL)) out.push([slug, norm(topic)]);
  return out;
})();

/** Resolve a user-typed dział to a slug. Accepts the slug (`stereometria`), the roman
 *  numeral (`x`), a fragment of the official name, or a fine topic name (`wielomian`). */
export function resolveDzial(input: string): DzialSlug | null {
  const raw = input.trim().toLowerCase();
  const slug = DZIAL_BY_SLUG.get(raw) ?? DZIAL_BY_NUMERAL.get(raw);
  if (slug) return slug;
  const q = norm(input);
  if (!q) return null;
  const find = (pred: (term: string) => boolean) => DZIAL_TERMS.find(([, t]) => pred(t))?.[0] ?? null;
  return (
    find((t) => t === q) ??
    find((t) => t.startsWith(q)) ??
    find((t) => t.includes(q))
  );
}

/** [dział, weight, pattern]. Patterns run against folded (diacritic-free) text. */
const RULES: [DzialSlug, number, RegExp][] = [
  // --- IV: must beat III, which also sees the word "układ" ---
  ["uklady-rownan", 6, /\buklad(?:u|y|zie|em|ach)?\s+rownan/g],
  ["uklady-rownan", 3, /metoda\s+(?:podstawiania|przeciwnych)/g],
  ["uklady-rownan", 3, /\bmetoda\s+wyznacznik/g],

  // --- III: równania i nierówności ---
  ["rownania-i-nierownosci", 4, /rozwiaz[^\s]*\s+(?:rownani|nierownos)/g],
  ["rownania-i-nierownosci", 4, /\bnierownos(?:c|ci|cia|ciami)/g],
  ["rownania-i-nierownosci", 4, /\bmiejsca\s+zerowe/g],
  ["rownania-i-nierownosci", 3, /rownani[aeu]\s+[a-z0-9\\()\[\]{}=+\-*^.,;:!?]*\s*(?:jest|sa|ma)/g],
  ["rownania-i-nierownosci", 3, /\bwyznacz\s+(?:x|liczbe|wartosc)/g],
  ["rownania-i-nierownosci", 2, /\brozwiazan(?:ie|ia)\s+rownania/g],
  ["rownania-i-nierownosci", 3, /\brownani(?:e|a|u|em)\s+[\\\(]/g],
  ["rownania-i-nierownosci", 3, /\bnierownos\w*\s+[\\\(]/g],

  // --- II: wyrażenia algebraiczne ---
  ["wyrazenia-algebraiczne", 4, /\bwyrazen(?:ie|ia)\s+(?:jest|jestrowne|dla|algebraiczn)/g],
  ["wyrazenia-algebraiczne", 4, /wzor(?:y|u)\s+skroconego\s+mnozenia/g],
  ["wyrazenia-algebraiczne", 4, /\bwielomian/g],
  ["wyrazenia-algebraiczne", 4, /\btrojmia/g],
  ["wyrazenia-algebraiczne", 3, /\bskroc(?:ic)?\b|\bdoprowadz\s+do\s+najprostszej/g],
  ["wyrazenia-algebraiczne", 2, /\bwyznacz\s+dziedzin/g],
  ["wyrazenia-algebraiczne", 3, /\bwyrazen(?:ie|ia)\b/g],
  ["wyrazenia-algebraiczne", 2, /\brownosc\b/g],

  // --- I: liczby rzeczywiste ---
  ["liczby-rzeczywiste", 4, /\blogarytm/g],
  ["liczby-rzeczywiste", 4, /\bwartosc\s+bezwzgledn/g],
  ["liczby-rzeczywiste", 4, /\bpoteg(?:a|i|e|owanie|y|ą)/g],
  ["liczby-rzeczywiste", 4, /\bpierwias(?:tek|tka|tki|tkow|tku)/g],
  ["liczby-rzeczywiste", 2, /\bprzedzial/g],
  ["liczby-rzeczywiste", 3, /\bprocent/g],
  ["liczby-rzeczywiste", 3, /\bnwd\b|\bnww\b/g],
  ["liczby-rzeczywiste", 3, /\bpodzieln(?:osci|a|e)/g],
  ["liczby-rzeczywiste", 3, /\boblicz\s+(?:wartosc|liczbe)\b/g],
  ["liczby-rzeczywiste", 3, /\bnotacj(?:a|i)\s+wykladnicz/g],
  ["liczby-rzeczywiste", 3, /\bblad\s+(?:bezwzgledny|wzgledny)/g],
  ["liczby-rzeczywiste", 3, /\bzaokragl/g],
  ["liczby-rzeczywiste", 2, /\bliczb(?:a|y|e|ami)?\s+[a-z]*\s*(?:jest|sa)\s+(?:rowna|rowne|równa|wieksza|mniejsza)/g],
  // Symbol-only arithmetic (old arkusze): "Liczba \(...\) jest równa", "Iloczyn \(...\)"
  ["liczby-rzeczywiste", 3, /\bliczb[eęaoy]?\s+[\\\(]/g],
  ["liczby-rzeczywiste", 3, /\\(?:log|ln)\b|\blog\s*_/g],
  ["liczby-rzeczywiste", 3, /\\(?:sqrt)/g],
  ["liczby-rzeczywiste", 2, /\b(?:iloczyn|iloraz|suma|roznica)\s+[\\\(]/g],
  ["liczby-rzeczywiste", 2, /%/g],

  // --- V: funkcje ---
  ["funkcje", 5, /\bfunkcj(?:a|i|e|ami)\b/g],
  ["funkcje", 4, /\bwykres/g],
  ["funkcje", 4, /\bmonotoniczn/g],
  ["funkcje", 4, /\bdziedzin(?:a|e|y)/g],
  ["funkcje", 4, /\bzbior\s+wartosci/g],
  ["funkcje", 4, /\bparabol/g],
  ["funkcje", 4, /\bwierzcholek/g],
  ["funkcje", 4, /\bproporcjonaln(?:e|osci|a)/g],
  ["funkcje", 3, /\bf\s*\(\s*x\s*\)/g],
  ["funkcje", 3, /\bprzesunie(?:cie|ty)\s+wykres/g],
  ["funkcje", 2, /\bnaj(?:mniejsza|wieksza)\s+(?:wartosc|wystepuje)/g],

  // --- VI: ciągi ---
  ["ciagi", 5, /\bciag(?:u|i|iem|ow|ach)?\b/g],
  ["ciagi", 4, /\bwyraz(?:y|ow|u|ami)?\s+ciagu/g],
  ["ciagi", 3, /\bciag|suma\s+(?:poczatkowych|n\s+)/g],
  ["ciagi", 2, /\br(?:oznica|oznice)\s+ciagu/g],

  // --- VII: trygonometria ---
  ["trygonometria", 5, /\btrygonometr/g],
  ["trygonometria", 4, /\b(?:sin|cos|tg|ctg)\b/g],
  ["trygonometria", 4, /\b(?:tanges|tangens|sinus|cosinus|cotangens)/g],
  ["trygonometria", 3, /\bkat\s+ostry/g],
  ["trygonometria", 3, /\btwierdzenie\s+(?:sinusow|cosinusow)/g],
  ["trygonometria", 2, /\bmiara\s+kata\b/g],

  // --- VIII: planimetria ---
  ["planimetria", 5, /\bokrag|okreg(?:u|i|iem|ow|u)?\b/g],
  ["planimetria", 4, /\btrojkat/g],
  ["planimetria", 4, /\bkat\s+(?:wpisany|srodkowy)/g],
  ["planimetria", 4, /\bstyczn(?:a|e|ej|ych)/g],
  ["planimetria", 4, /\bpodobien(?:stwo|stwa|stwie)/g],
  ["planimetria", 3, /\b(?:czworokat|trapez|romb|rownoleglobok|prostokat)/g],
  ["planimetria", 3, /\bprzekatn(?:a|e|ej)/g],
  ["planimetria", 3, /\b(?:cieciwa|promien(?:a|ie)?|obwod)\b/g],
  ["planimetria", 3, /\btwierdzenie\s+talesa/g],
  ["planimetria", 3, /\b(?:wpisany|opisany)\s+(?:w|na)\b/g],
  ["planimetria", 4, /\b(?:wielokat|siedmiokat|szesciokat|pieciokat|osmiokat|dziewieciokat|dziesieciokat)\b/g],
  ["planimetria", 3, /\bprzekatn/g],
  ["planimetria", 3, /\bdwusieczn/g],
  ["planimetria", 1, /\bkat(?:ow|y|a|em|u|ach)?\b/g],

  // --- IX: geometria analityczna ---
  ["geometria-analityczna", 6, /\bw\s+ukladzie\s+wspolrzednych/g],
  ["geometria-analityczna", 5, /\bwspolrzedn(?:e|ych|a|ej)/g],
  ["geometria-analityczna", 5, /\brownanie\s+(?:prostej|okregu)/g],
  ["geometria-analityczna", 4, /\bwektor/g],
  ["geometria-analityczna", 4, /\bsrodek\s+odcinka/g],
  ["geometria-analityczna", 4, /\bodleglosc\s+(?:punktu|miedzy|od)/g],
  ["geometria-analityczna", 3, /\bsymetri(?:a|i|czne)\s+wzgledem/g],
  ["geometria-analityczna", 3, /\bproste\s+(?:prostopadle|rownolegle)/g],
  ["geometria-analityczna", 2, /\bprosta\s+(?:o\s+rownaniu|przechodzaca)/g],
  ["geometria-analityczna", 5, /\bdane\s+sa\s+punkty/g],
  ["geometria-analityczna", 3, /\bdlugosc\s+odcinka/g],
  ["geometria-analityczna", 2, /\bodcink(?:i|a|u|iem)?\b/g],

  // --- X: stereometria ---
  ["stereometria", 5, /\b(?:graniastoslup|ostroslup|prostopadloscian|szescian)/g],
  ["stereometria", 5, /\b(?:walec|stozek|kula|kuli|kule)\b/g],
  ["stereometria", 4, /\bbryl(?:a|y|ie)/g],
  ["stereometria", 4, /\bobjetosc/g],
  ["stereometria", 4, /\bpole\s+powierzchni/g],
  ["stereometria", 3, /\b(?:krawedz|sciana|scianie|sciany)\b/g],
  ["stereometria", 2, /\bwysokosc\s+(?:graniastoslupa|ostroslupa|walca|stozka)/g],

  // --- XI: kombinatoryka ---
  ["kombinatoryka", 6, /\bkombinatoryk/g],
  ["kombinatoryka", 5, /\bna\s+ile\s+sposobow/g],
  ["kombinatoryka", 5, /\b(?:permutacj|wariacj|kombinacj)/g],
  ["kombinatoryka", 4, /\bsilni(?:a|i)/g],
  ["kombinatoryka", 3, /\bregula\s+mnozenia/g],
  ["kombinatoryka", 3, /\bile\s+jest\s+(?:liczb|ciagow|zbiorow)/g],
  ["kombinatoryka", 3, /\bile\s+jest\b/g],
  ["kombinatoryka", 3, /\bwybieramy\b/g],

  // --- XII: prawdopodobieństwo i statystyka ---
  ["prawdopodobienstwo-i-statystyka", 6, /\bprawdopodobienstw/g],
  ["prawdopodobienstwo-i-statystyka", 5, /\b(?:srednia|mediana|dominanta|odchylenie\s+standardowe)\b/g],
  ["prawdopodobienstwo-i-statystyka", 5, /\bwariancj(?:a|i)\b/g],
  ["prawdopodobienstwo-i-statystyka", 4, /\b(?:kostk|monet)/g],
  ["prawdopodobienstwo-i-statystyka", 3, /\blosow(?:o|ania|anie|y)/g],
  ["prawdopodobienstwo-i-statystyka", 3, /\bdoświadczen|\bwynik(?:ow|i)/g],

  // --- XIII: optymalizacja / rachunek różniczkowy ---
  ["optymalizacja-i-rachunek-rozniczkowy", 6, /\boptymalizac/g],
  ["optymalizacja-i-rachunek-rozniczkowy", 12, /\bpochodn/g],
  ["optymalizacja-i-rachunek-rozniczkowy", 4, /\bekstrem/g],
  ["optymalizacja-i-rachunek-rozniczkowy", 3, /\bnaj(?:mniejsze|wieksze)\s+(?:pole|objetosc|koszt)/g],
  ["optymalizacja-i-rachunek-rozniczkowy", 3, /\bgranic(?:a|y|e)/g],
];

function countMatches(text: string, re: RegExp, cap = 3): number {
  const m = text.match(re);
  return m ? Math.min(m.length, cap) : 0;
}

export interface Classification {
  dzial: DzialSlug | null;
  score: number;
  /** true when it came from a fine topic or a strong (>=4) keyword hit */
  confident: boolean;
}

export function classifyDzial(text: string, options: string[] = [], fineTopics: string[] = []): Classification {
  const hay = fold([text, options.join(" ")].join(" ")).replace(/\s+/g, " ");
  const scores = new Map<DzialSlug, number>();

  const add = (slug: DzialSlug, w: number, confident = false) => {
    scores.set(slug, (scores.get(slug) ?? 0) + w);
    if (confident) confidentHits.add(slug);
  };

  const confidentHits = new Set<DzialSlug>();
  for (const t of fineTopics) {
    const slug = FINE_TOPIC_TO_DZIAL[t];
    if (slug) add(slug, 8, true);
  }
  for (const [slug, weight, re] of RULES) {
    const n = countMatches(hay, re);
    if (n > 0) add(slug, n * weight, weight >= 4);
  }

  let best: DzialSlug | null = null;
  let bestScore = 0;
  for (const d of CKE_DZIALY) {
    const s = scores.get(d.slug) ?? 0;
    if (s > bestScore) {
      best = d.slug;
      bestScore = s;
    }
  }
  return { dzial: best, score: bestScore, confident: best !== null && confidentHits.has(best) };
}

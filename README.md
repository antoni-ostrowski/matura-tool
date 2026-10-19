# (vibed) matura-tool

A self-hosted, keyboard-first trainer for Polish *matura* (poziom podstawowy) maths.

Type one fuzzy query, get the exact task, its answer and a step-by-step explanation —
without googling, without clicking through pages.

```
2015 maj kula stożek          # year + session + concept
próbna prawdopodobieństwo     # mock exams only
rozsz ciąg geometryczny       # future: extended level
zad:26                        # jump to task number
punkty:2 unsolved             # your progress
```

## Why it works

- **The dataset is tiny and scrapeable.** ~100 sheets → ~3000 tasks. Scrape once, use forever, offline.
- **Questions and solutions are real LaTeX text**, not images — so they're fully searchable, and only figures need to be mirrored.
- **Search is fuzzy and diacritic-insensitive**: `prawdopodobienstwo` finds `prawdopodobieństwo`.
- **Answers are hidden by default** so you attempt first, then reveal.

## Quickstart

```bash
bun install

# 1. build the dataset (one time, ~40s)
bun run scrape            # or: mise run scrape

# 2. run it
bun run serve             # → http://localhost:8787
```

Then just start typing. Press `?` for the full keymap.

### Query tokens

| token | meaning |
| --- | --- |
| `2015`, `rok:2015`, `r:2015`, `y:2015` | filter by year |
| `maj` `czerwiec` `sierpien` `listopad` `probna` `poprawkowa` | session / kind |
| `sesja:maj`, `m:maj`, `typ:probna`, `k:probna` | same, with keys |
| `topic:kwadratowe`, `t:kwadratowe` | only tasks tagged with that (site) topic |
| `dzial:stereometria`, `d:x`, `cke:stereometria` | only tasks in that CKE chapter (see below) |
| `zad:26`, `z:26` | task number |
| `punkty:2`, `pkt:2`, `pts:2`, `p:2` | points |
| `unsolved` `solved` `flagged` | your progress |
| anything else | fuzzy text search (diacritics optional) |

Long forms work bare too (`rok 2015`, `zad 26`). Single-letter forms require the colon,
so `z` stays an ordinary word (Polish "from").

### What you can filter by

**CKE chapters** (`dzial:` / `d:` / `cke:`) — the official 13 syllabus areas, assigned to
each task by the classifier in `src/cke.ts`. Accept a slug, the roman numeral, or a name
fragment: `d:x`, `d:stereometria`, `d:wielomian`.

| | chapter | | chapter |
| --- | --- | --- | --- |
| `d:i` | Liczby rzeczywiste | `d:viii` | Planimetria |
| `d:ii` | Wyrażenia algebraiczne | `d:ix` | Geometria analityczna |
| `d:iii` | Równania i nierówności | `d:x` | Stereometria |
| `d:iv` | Układy równań | `d:xi` | Kombinatoryka |
| `d:v` | Funkcje | `d:xii` | Rachunek prawdopodobieństwa i statystyka |
| `d:vi` | Ciągi | `d:xiii` | Optymalizacja i rachunek różniczkowy |
| `d:vii` | Trygonometria | | |

**Site topics** (`topic:` / `t:`) — the finer ~48 labels scraped from szaloneliczby's
collection pages. Coverage is partial (~23% of tasks) and the labels are the site's, not
CKE's, so prefer `dzial:` for complete coverage. Ask the live list with
`curl localhost:8787/api/facets | jq -r '.topics[]'`, or search the ones below (diacritics
optional, use one distinctive word):

```
LICZBY / ALGEBRA            GEOMETRIA                     FUNKCJE
  logarytmy                   graniastoslupy                wlasnosci
  wzory skroconego            punkty                        liniowej
  pierwiastki                 bryly obrotowe                kwadratowej
  potegi                      proste                        odczytywanie
  liczby rzeczywiste          styczna                       wykresy
  procenty                    podobienstwo                  optymalizacyjne
  przedzialy                  rownanie okregu               obliczanie
  blad                        rownanie prostej              wykladnicza
                              kat                           przeksztalcenia
ROWNANIA / NIEROWNOSCI                                      symetria
  nierownosci               TRYGONOMETRIA
  rownania wymierne           zaleznosci                  CIAGI
  pozostale rownania          trygonometria                 ciag geometryczny
  rownania kwadratowe         funkcje trygonometryczne      ciag arytmetyczny
  uklad rownan                tablic                        ciagi liczbowe
  rownania liniowe
  wielomiany                PRAWDOPODOBIENSTWO / STATYSTYKA
  trzeciego                   prawdopodobienstwo
                              statystyka
                              kombinatoryka
```

### Keyboard

`/` search · `↑↓`/`jk` move · `↵` open · `space` answer · `e` explanation ·
`d`/`u` scroll pane · `g`/`G` top/bottom ·
`s` solved · `f` flag · `n`/`p` next/prev task in sheet · `o` source · `?` help

### Figures

Diagram PNGs render capped at `512×352 px` (answer-option figures at `320×192`), which lands at
roughly 60% of natural size for the bulk of them — small diagrams are left alone. **Click any
figure** to toggle between that preview and full size. Tune the numbers in `web/style.css`
(`img.fig` / `.option img.fig`).

## Architecture

```
src/scrape.ts   sitemap → pages → parse → SQLite (+ mirror images)
src/parse.ts    HTML → structured tasks (LaTeX preserved, images → markdown)
src/text.ts     diacritic folding, Levenshtein, tokenizer
src/cke.ts      CKE-dział classifier (13 syllabus areas) + topic→chapter map
src/search.ts   in-memory fuzzy index + query-token filter parser
src/db.ts       SQLite schema (sheets / tasks / progress)
src/server.ts   Bun.serve: JSON API + static frontend
src/cli.ts      terminal search
web/            vanilla JS frontend + KaTeX
```

One Bun process, one SQLite file, no external services. ~3000 tasks fit in memory,
so search is a linear fuzzy scan (single-digit ms) rather than an FTS dance.

### API

```
GET  /api/search?q=...&limit=60
GET  /api/task/:id
POST /api/progress/:id      { solved?, flagged?, note? }
GET  /api/facets
POST /api/reload
```

## Deploy on a homelab

```bash
docker compose up -d --build
```

First boot scrapes into the mounted `matura-data` volume (takes ~40s), then serves.
Put Caddy/Traefik in front if you want TLS.

```bash
# inside the container
docker compose exec matura bun run scrape     # refresh data
docker compose restart                        # pick up changes? use /api/reload instead
curl -X POST localhost:8787/api/reload
```

## Limitations & roadmap

- **Only poziom podstawowy.** szaloneliczby.pl has no rozszerzona arkusze. The scraper
  is written as a *source adapter*, so CKE/arkusze.pl PDFs can be added for rozszerzona.
- **Source is one third-party site.** Answers are as good as that site; every task keeps
  its `source_url` so you can verify.
- **CKE chapters are inferred, not official.** `src/cke.ts` classifies each task into one
  of the 13 syllabus areas by reusing the site's fine topic when present, then weighted
  keyword rules over the question text. Measured: **~96% of tasks get a chapter**, and it
  agrees with the site's own topic labels **~79%** of the time (neither label is ground
  truth). Treat `d:` as a strong narrowing filter, not gospel.
- Roadmap: rozszerzona source · chapter/topic facets in the UI sidebar · `sqlite-vec`
  semantic search (`stożek wpisany w kulę` ↔ `cone inscribed in a sphere`) · notes per
  task · export progress.

## Etiquette

Scraper is polite (throttled, ~4 concurrent, identifies itself) and caches everything
locally. Personal study use only — don't republish the content.

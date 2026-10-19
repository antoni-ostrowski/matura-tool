# matura-tool

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
| `2015`, `rok:2015` | filter by year |
| `maj` `czerwiec` `sierpien` `listopad` `probna` `poprawkowa` | session / kind |
| `zad:26` | task number |
| `punkty:2` / `pkt:2` | points |
| `unsolved` `solved` `flagged` | your progress |
| anything else | fuzzy text search (diacritics optional) |

### Keyboard

`/` search · `↑↓`/`jk` move · `↵` open · `space` answer · `e` explanation ·
`s` solved · `f` flag · `n`/`p` next/prev task in sheet · `o` source · `?` help

## Architecture

```
src/scrape.ts   sitemap → pages → parse → SQLite (+ mirror images)
src/parse.ts    HTML → structured tasks (LaTeX preserved, images → markdown)
src/text.ts     diacritic folding, Levenshtein, tokenizer
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
- Roadmap: rozszerzona source · topic facets in the UI · `sqlite-vec` semantic search
  (`stożek wpisany w kulę` ↔ `cone inscribed in a sphere`) · notes per task · export progress.

## Etiquette

Scraper is polite (throttled, ~4 concurrent, identifies itself) and caches everything
locally. Personal study use only — don't republish the content.

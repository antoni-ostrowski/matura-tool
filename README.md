# (vibed) matura-tool

A self-hosted, keyboard-first trainer for Polish *matura* (poziom podstawowy) maths.

Type one fuzzy query, get the exact task, its answer and a step-by-step explanation —
without googling, without clicking through pages.

```
2015 maj kula stożek          # year + session + concept
próbna prawdopodobieństwo     # mock exams only
d:stereometria unsolved       # by chapter
t:nierownosci kwadratowe      # by topic
zad:26                        # jump to task number
```

Answers are hidden until you ask, so you attempt first.

## Quickstart

```bash
bun install

# 1. build the dataset (one time, ~40s)
bun run scrape            # or: mise run scrape

# 2. run it
bun run serve             # → http://localhost:8787
```

Then just start typing. Press `?` for the full keymap.

## Searching

Mix plain words with `key:value` tokens — everything is optional and combinable.
Word matching is fuzzy and ignores Polish diacritics, so `prawdopodobienstwo` finds
`prawdopodobieństwo` and a single typo still hits.

| token | meaning |
| --- | --- |
| `2015`, `rok:2015`, `r:2015` | filter by year |
| `maj` `sierpien` `listopad` `probna` `poprawkowa` | session / kind |
| `sesja:maj`, `m:maj`, `typ:probna`, `k:probna` | same, with keys |
| `d:stereometria` | only tasks in that CKE chapter (list below) |
| `t:kwadratowe` | only tasks with that finer topic (list below) |
| `zad:26`, `z:26` | task number |
| `punkty:2`, `pkt:2`, `p:2` | points |
| `unsolved` `solved` `flagged` | your progress |
| anything else | fuzzy text search |

Long forms work bare too (`rok 2015`, `zad 26`). Single-letter keys need the colon,
so `z` stays an ordinary word (Polish "from").

### Chapters (`d:`)

The 13 official CKE syllabus areas. Every task belongs to one:

| | chapter | | chapter |
| --- | --- | --- | --- |
| `d:liczby` | Liczby rzeczywiste | `d:planimetria` | Planimetria |
| `d:algebra` | Wyrażenia algebraiczne | `d:analityczna` | Geometria analityczna |
| `d:nierownosci` | Równania i nierówności | `d:stereometria` | Stereometria |
| `d:uklady` | Układy równań | `d:kombinatoryka` | Kombinatoryka |
| `d:funkcje` | Funkcje | `d:prawdopodobienstwo` | Rachunek prawdopodobieństwa i statystyka |
| `d:ciagi` | Ciągi | `d:optymalizacja` | Optymalizacja i rachunek różniczkowy |
| `d:trygonometria` | Trygonometria | | |

Any distinctive fragment of a chapter name works, so `d:stereo`, `d:plan`, or the full
`d:stereometria` all do the same thing.

### Topics (`t:`)

Finer labels that mirror how the material is usually taught — handy for drilling a single
skill. They only cover part of the dataset, so use `d:` when you want everything in a
chapter. Diacritics optional; one distinctive word is enough.

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

## Keyboard

`/` search · `↑↓`/`jk` move · `↵` open · `space` answer · `e` explanation ·
`d`/`u` scroll pane · `g`/`G` top/bottom ·
`s` solved · `f` flag · `n`/`p` next/prev task in sheet · `o` source · `?` help

## Figures

Diagrams render at a readable reduced size. **Click any figure** to toggle full size.

## Deploy on a homelab

```bash
docker compose up -d --build
```

First boot scrapes into the mounted `matura-data` volume (~40s), then serves.
Put Caddy/Traefik in front if you want TLS.

```bash
# refresh the data later
docker compose exec matura bun run scrape
curl -X POST localhost:8787/api/reload
```

## Limitations

- **Only poziom podstawowy.** No rozszerzona arkusze on the source site yet.
- **Answers come from one third-party site**, so verify anything that looks off — every
  task keeps a link to its source.
- **Chapters are auto-assigned.** A rare ambiguous task may sit in the wrong chapter;
  `d:` is a strong filter, not a guarantee.

## Etiquette

Scraper is polite and caches everything locally. Personal study use only — don't
republish the content.

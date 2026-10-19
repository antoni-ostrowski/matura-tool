#!/usr/bin/env sh
set -e

DB="${MATURA_DB:-/data/matura.db}"

if [ ! -f "$DB" ]; then
  echo "[matura] no database at $DB — scraping szaloneliczby.pl (one-time, ~40s)…"
  bun run scrape
else
  echo "[matura] using existing database $DB"
fi

echo "[matura] serving on ${HOST:-0.0.0.0}:${PORT:-8787}"
exec bun run serve

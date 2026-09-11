#!/usr/bin/env python3
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHUNKS = ROOT / "data" / "chunks"
OVERRIDES = ROOT / "tmp" / "ngsl_japanese_overrides_2026-09-12.csv"

with OVERRIDES.open(encoding="utf-8-sig", newline="") as f:
    overrides = list(csv.DictReader(f))

chunk_rows = {}
by_key = {}
all_ranks = []
for path in sorted(CHUNKS.glob("*.csv")):
    with path.open(encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    chunk_rows[path] = rows
    for row in rows:
        if len(row) < 6:
            raise SystemExit(f"bad row in {path}: {row!r}")
        rank = int(row[0])
        key = (str(rank), row[1])
        if key in by_key:
            raise SystemExit(f"duplicate key: {key}")
        by_key[key] = (path, row)
        all_ranks.append(rank)

if len(by_key) != 2809 or sorted(all_ranks) != list(range(1, 2810)):
    raise SystemExit(f"invalid public dataset: rows={len(by_key)}")

changed = 0
for ov in overrides:
    key = (ov["rank"], ov["word"])
    if key not in by_key:
        raise SystemExit(f"override target missing: {key}")
    _, row = by_key[key]
    current = row[4]
    if current == ov["new_japanese"]:
        continue
    if current != ov["old_japanese"]:
        raise SystemExit(
            f"japanese mismatch for {key}: expected old={ov['old_japanese']!r} or new={ov['new_japanese']!r}; actual={current!r}"
        )
    row[4] = ov["new_japanese"]
    changed += 1

for path, rows in chunk_rows.items():
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerows(rows)

print(f"changed={changed} overrides={len(overrides)} rows={len(by_key)} chunks={len(chunk_rows)}")

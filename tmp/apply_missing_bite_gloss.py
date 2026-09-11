#!/usr/bin/env python3
import csv
from pathlib import Path

path = Path("data/chunks/027.csv")
with path.open(encoding="utf-8", newline="") as f:
    rows = list(csv.reader(f))

found = False
for row in rows:
    if row and row[0] == "2663" and row[1] == "bite":
        found = True
        if row[4] == "かむ；噛みつく":
            break
        if row[4] != "かむ，かむこと;一口":
            raise SystemExit(f"unexpected old gloss: {row[4]!r}")
        row[4] = "かむ；噛みつく"
        break

if not found:
    raise SystemExit("rank 2663 bite not found")

with path.open("w", encoding="utf-8", newline="") as f:
    csv.writer(f, lineterminator="\n").writerows(rows)

print("verified rank=2663 word=bite japanese=かむ；噛みつく")

# Vocab Trainer

A minimal iPhone-friendly vocabulary trainer built as a static PWA.

## What it does

- Shows one English word at a time with its frequency rank.
- Swipe left: **Known**.
- Swipe right: **Unknown**.
- Swipe up: **Unsure**.
- Long press: reveal the Japanese gloss.
- Study in frequency order or random order.
- Filter by `part_of_speech`.
- Filter by saved review status: **All**, **Not reviewed**, **Know**, **Don't know**, **Unsure**, or **Don't know + Unsure**.
- Combine review status, part of speech, and frequency/random order freely.
- Review-status filters use the latest saved status for each word; changing a status during a session affects later sessions, not the already-built current queue.
- Import another CSV to replace the active vocabulary set.
- Export learning results as CSV.
- Saves vocabulary and review results locally in the browser.

## Default vocabulary

The bundled default set contains **2,809 NGSL words**.

The public distribution copy is stored as 29 CSV chunks under:

```text
data/chunks/001.csv
...
data/chunks/029.csv
```

`data-loader.js` presents those chunks to the app as one logical `data/NGSL.csv` dataset at runtime. The split is only a distribution implementation detail.

The durable source of truth for the vocabulary dataset remains in the private AIW repository:

```text
mak-ot-o/aiw
areas/english/vocabulary/ngsl/NGSL.csv
```

Changes to the vocabulary source should be made there first and then reflected into this public distribution repository.

## CSV format

Required columns:

```csv
rank,word,japanese
```

Optional column used by the built-in filter:

```csv
part_of_speech
```

The bundled NGSL source includes additional fields such as `definition` and `example`; the trainer only reads the fields it needs.

## Run locally

Serve the repository with any static HTTP server and open `index.html`. Opening the file directly with `file://` is not recommended because browser fetch and service-worker behavior differs from a hosted site.

## iPhone

Open the GitHub Pages site in Safari, then use **Add to Home Screen** to install it like an app.

## Deployment

GitHub Pages deploys from the repository's `main` branch at the repository root.

Public URL:

`https://mak-ot-o.github.io/vocab-trainer/`

The repository rename to `mak-ot-o/vocab-trainer` was confirmed on 2026-09-03.

## Vocabulary attribution

Vocabulary data is based on the **New General Service List (NGSL)** by Charles Browne, Brent Culligan, and Joseph Phillips and is distributed under **CC BY-SA 4.0**. Japanese glosses and app formatting are adapted for this trainer.

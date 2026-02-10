# Spelling Bee (Browser-only)

Standalone NYT-style Spelling Bee clone built with plain JavaScript and HTML5.

## Current Features

- Browser-only runtime (no backend dependencies)
- Local persistence with IndexedDB
- Multiple sessions in parallel
- Daily puzzle + random puzzle sessions
- NYT-style validation/scoring/rank progression model
- Toggleable hints:
  - Remaining total points
  - Remaining word count by 2-letter prefix (e.g., `CA`, `CO`)

## Architecture and Product Spec

- MVP spec: `docs/spec-mvp.md`

## Quick Start

Run a single dev command:

```bash
npm run dev
```

Then visit:

- `http://localhost:8080`

`npm run dev` will:

- run the data pipeline (dictionary + puzzles)
- run code syntax checks
- start an embedded static server
- watch for changes in `src/`, `data/raw/`, `tools/`, and `index.html`
- rerun the build pipeline automatically on changes

## Test

```bash
npm test
```

## Data Pipeline

Raw inputs:

- `data/raw/dictionary-base.txt`
- `data/raw/allowlist.txt`
- `data/raw/blocklist.txt`
- `data/raw/policy.json`
- optional external sources in `data/raw/sources/`:
  - `scowl.txt` (base word list)
  - `wordfreq.tsv` (columns: `word`, `zipf`)

Build outputs:

- `data/dictionary-v1.json`
- `data/dictionary-v1-meta.json`
- `data/puzzles-v1.json`

Commands:

```bash
npm run prepare:sources
npm run build:dictionary
npm run build:puzzles
npm run build:data
```

To prioritize common words:

1. Run `npm run prepare:sources`.
2. Tune `data/raw/policy.json`:
   - `frequency.minZipf` (higher = more common words only)
   - `frequency.requireScore` (`true` drops words missing a frequency score)
3. Run `npm run build:data`.

## Notes

- Dictionary is intentionally strict and project-controlled.
- Exact NYT lexical parity is not guaranteed because NYT's full proprietary word list is not public.

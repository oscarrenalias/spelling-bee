# Spelling Bee (Browser-Only)

Standalone NYT-style Spelling Bee clone built with plain JavaScript and HTML5.

Status: MVP complete and ready for public sharing.

## Features

- Browser-only runtime with no backend
- IndexedDB persistence (multiple concurrent sessions)
- Daily puzzle + reproducible random puzzle by seed
- NYT-style validation, scoring, and rank progression
- Toggleable hints:
  - Remaining total points
  - Remaining word count by 2-letter prefix
- Keyboard-friendly gameplay:
  - Global typing capture
  - Enter to submit
  - Backspace to delete
  - Shuffle outer letters

## Tech Stack

- Runtime: vanilla JS (ES modules), HTML, CSS
- Storage: IndexedDB
- Data: local JSON assets generated from project-controlled raw sources
- Tooling: Node.js scripts only (no framework build system)

## Requirements

Development dependencies:

- Node.js 20+ (Node 18 may work, but 20+ is recommended)
- npm

Optional (only if you run `npm run prepare:sources`):

- `git`
- `make`
- Python 3 (for local `wordfreq` generation)

## Quick Start (Development)

```bash
npm install
npm run dev
```

Open: [http://127.0.0.1:8080](http://127.0.0.1:8080)

`npm run dev` will:

- build dictionary + puzzles
- run syntax checks
- start a local static server
- watch `src/`, `data/raw/`, `tools/`, and `index.html`
- rerun build pipeline automatically when files change

### Optional Dev Environment Variables

```bash
PORT=4173 HOST=127.0.0.1 PUZZLE_COUNT=30 npm run dev
```

## Build and Run (Production-Like)

1. Generate app data and run code checks:

```bash
npm install
npm run build
```

2. Serve the repository as static files (any static server works). Example:

```bash
npx serve .
```

Then open the URL printed by the server.

## Test

```bash
npm test
```

## Repository Layout

- `index.html`: app entry
- `src/`: gameplay logic, UI, storage modules
- `data/`: generated dictionary/puzzle artifacts + raw sources
- `tools/`: Node scripts for build/dev/data preparation
- `tests/`: unit and integration tests
- `docs/`: MVP scope/spec documentation

## Data Pipeline

Raw inputs:

- `data/raw/dictionary-base.txt`
- `data/raw/allowlist.txt`
- `data/raw/blocklist.txt`
- `data/raw/policy.json`
- optional external sources in `data/raw/sources/`:
  - `scowl.txt`
  - `wordfreq.tsv` (`word`, `zipf`)

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

If tuning frequency filtering, edit `data/raw/policy.json` and rebuild:

- `frequency.minZipf`
- `frequency.requireScore`

## Documentation

- MVP scope: `docs/scope-mvp.md`
- Full MVP spec: `docs/spec-mvp.md`

## Notes

- The dictionary is intentionally strict and project-controlled.
- Exact lexical parity with NYT is not guaranteed (their full proprietary list is not public).
- Daily puzzle lookup uses the browser date in ISO form and falls back to the first puzzle in `data/puzzles-v1.json` if no date match exists.

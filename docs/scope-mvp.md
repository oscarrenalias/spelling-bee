# Spelling Bee MVP Scope

Last updated: 2026-02-10

## Goal

Ship a public, browser-only Spelling Bee web app that runs entirely from static files, with NYT-style core gameplay behavior.

## In Scope

- Browser runtime only (no backend)
- Daily puzzle mode from local puzzle pack
- Reproducible random puzzle mode (seed-based)
- Validation rules:
  - only puzzle letters
  - center letter required
  - min word length
  - duplicate prevention
- Scoring and rank progression
- Hint panel (toggleable):
  - remaining total points
  - remaining word counts by 2-letter prefix
- Multi-session support with IndexedDB persistence
- Session recovery after page reload
- Basic responsive UI + keyboard-friendly interaction
- Automated data/build/test scripts for local development

## Out of Scope

- Accounts / cloud sync
- Multiplayer
- Backend APIs
- Guaranteed lexical parity with NYT proprietary dictionary

## Deliverables

- App shell and gameplay UI (`index.html`, `src/`)
- Data outputs:
  - `data/dictionary-v1.json`
  - `data/dictionary-v1-meta.json`
  - `data/puzzles-v1.json`
- Documentation:
  - this scope (`docs/scope-mvp.md`)
  - detailed spec (`docs/spec-mvp.md`)
  - setup/run guide (`README.md`)
- Tests (`npm test`)

## Definition of Done

- `npm run build` succeeds
- `npm test` succeeds
- App starts locally and is playable via static serving
- Daily and random seeded sessions both function
- Progress persists across refreshes

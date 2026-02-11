# Spelling Bee Backlog (Post-MVP Suggestions)

Created: 2026-02-11

This backlog captures the remaining suggestions for feature, QoL, and technical work after immediate updates to CI e2e smoke coverage and README documentation links.

## Prioritization Scale

- Effort `S`: <= half day
- Effort `M`: 1 to 3 days
- Effort `L`: multi-day or cross-cutting

## Now (Immediate Impact)

- Fix daily puzzle date logic to use local calendar date instead of UTC date slicing. Effort `S`.
- Add shareable seed deep links via URL query params (`?seed=...`) and restore from URL on load. Effort `M`.
- Add confirmation before starting a new random game when progress exists. Effort `S`.
- Add cross-tab state sync (for example via `BroadcastChannel`) to keep sessions consistent across multiple open tabs. Effort `M`.

## Next (High Value)

- Add session management actions: delete, reset, archive, export/import. Effort `M`.
- Add found words tooling: sort modes (alphabetical, score, length), search/filter, pangram highlighting. Effort `M`.
- Add undo for last accepted word. Effort `S`.
- Add copy/share summary output (score, rank, words found, seed/date). Effort `S`.
- Either use the IndexedDB `app_meta` and `puzzles` stores for real cache/version metadata, or remove them if intentionally unused. Effort `M`.
- Replace syntax-only checks with lint/format/coverage gates in CI and local build scripts. Effort `M`.

## Later (Nice to Have / Expansion)

- Add streaks/history (today/yesterday/calendar) and per-puzzle completion badges. Effort `L`.

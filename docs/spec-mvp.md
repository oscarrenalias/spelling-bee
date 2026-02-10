# Spelling Bee MVP Specification

## 1. Objective

Build a standalone, browser-only Spelling Bee game with NYT-like behavior:

- No backend dependencies.
- Strict local dictionary policy.
- Daily and random puzzles.
- Score/rank progression similar to NYT.
- Toggleable hints panel:
  - Remaining total points
  - Remaining word count by 2-letter prefix
- Multiple parallel game sessions with persistence.

## 2. Non-Goals (MVP)

- User accounts or cloud sync.
- Multiplayer.
- Server-side APIs.
- 100% guaranteed lexical parity with NYT proprietary word list.

## 3. Product Decisions (Locked)

- Parity target: behavior parity with NYT (validation/scoring/ranks/hints UX style).
- Dictionary policy: strict.
- Hints: toggleable (show/hide).
- Storage: IndexedDB for game data.
- Runtime model: static browser app (offline-capable, no backend).

## 4. Technical Architecture

## 4.1 Runtime and UI

- Language: JavaScript (ES Modules).
- UI approach: Web Components + plain CSS.
- Delivery: static assets (HTML/CSS/JS + local JSON data files).
- Optional dev-only local server/tooling is allowed, but runtime remains browser-only.

## 4.2 Core Modules

- `GameEngine`
  - Accepts puzzle + input word.
  - Applies validator/scoring/ranking/hint updates.
  - Returns deterministic state transitions.
- `Validator`
  - Checks letter set and center-letter rule.
  - Enforces min length and duplicate submission rules.
- `Scoring`
  - Computes per-word points and pangram bonus.
- `Ranking`
  - Computes level from score thresholds.
- `HintService`
  - Computes remaining total points.
  - Computes counts by first two letters from remaining words.
- `PuzzleProvider`
  - Daily puzzle lookup by date.
  - Random puzzle generation with seed and quality constraints.
- `StorageRepository`
  - IndexedDB access and schema migrations.

## 4.3 Data Flow

1. App initializes dictionary metadata and puzzle source.
2. User opens/resumes/creates a session.
3. Input word submitted.
4. `GameEngine` validates and scores.
5. State persisted to IndexedDB.
6. UI re-renders score/rank/found words/hints.

## 5. Data Contracts

## 5.1 Puzzle

```json
{
  "id": "2026-02-10",
  "date": "2026-02-10",
  "centerLetter": "a",
  "outerLetters": ["c", "e", "l", "n", "r", "t"],
  "dictionaryVersion": "v1",
  "validWords": ["..."],
  "pangrams": ["..."],
  "maxScore": 0,
  "rankThresholds": {
    "beginner": 0,
    "goodStart": 0,
    "movingUp": 0,
    "good": 0,
    "solid": 0,
    "nice": 0,
    "great": 0,
    "amazing": 0,
    "genius": 0,
    "queenBee": 0
  }
}
```

## 5.2 Game Session

```json
{
  "sessionId": "uuid",
  "puzzleId": "2026-02-10",
  "source": "daily",
  "seed": null,
  "createdAt": "2026-02-10T10:00:00.000Z",
  "updatedAt": "2026-02-10T10:05:00.000Z",
  "foundWords": ["..."],
  "score": 0,
  "rankKey": "beginner",
  "hintUsage": {
    "viewCount": 0
  },
  "status": "active"
}
```

## 5.3 Hints View Model

```json
{
  "remainingTotalPoints": 123,
  "remainingWordCount": 45,
  "byPrefix2": {
    "ca": 4,
    "co": 7
  }
}
```

## 6. IndexedDB Design

- Database name: `spelling_bee_db`
- Initial version: `1`

Object stores:

- `sessions` (key: `sessionId`)
  - indexes: `byUpdatedAt`, `byStatus`, `byPuzzleId`
- `puzzles` (key: `id`)
- `app_meta` (key: `key`)

Migration policy:

- Bump DB version for schema changes.
- Keep migration functions deterministic and tested.
- Preserve existing session data across versions.

## 7. Dictionary and Puzzle Pipeline

## 7.1 Inputs

- `data/raw/dictionary-base.txt`
- `data/raw/allowlist.txt`
- `data/raw/blocklist.txt`
- `data/raw/policy.json`

## 7.2 Strict Dictionary Rules

Include:

- lowercase alphabetic words only (`a-z`)
- length >= 4
- common modern English words

Exclude:

- profanity/swear words
- proper nouns
- countries/cities/regions
- nationalities/demonyms
- acronyms/abbreviations
- hyphenated or apostrophe-containing words
- obscure/archaic specialist words (unless allowlisted)

Override order:

1. Apply filters.
2. Add `allowlist`.
3. Remove `blocklist` (final authority).

## 7.3 Outputs

- `data/dictionary-v1.json`
- `data/dictionary-v1-meta.json`
- `data/puzzles-v1.json`

All puzzle files must reference `dictionaryVersion` to keep behavior deterministic.

## 8. Puzzle Strategy

- Daily mode:
  - Local curated puzzle pack keyed by date.
  - No runtime fetch from third-party sources.
- Random mode:
  - Seeded generator to ensure replayability.
  - Quality gates:
    - minimum valid word count
    - minimum one pangram
    - reasonable score distribution

## 9. UX and Accessibility

- Keyboard-first word entry.
- Clear feedback for invalid/duplicate/accepted submissions.
- Toggleable hint panel.
- Session switcher for multiple active games.
- Responsive layout (desktop + mobile).
- Accessible semantics:
  - labels, focus states, ARIA live region for submission feedback.

## 10. Testing Strategy

Unit tests:

- validator rules
- scoring logic
- ranking thresholds
- hint calculations

Integration tests:

- submit flow and state transitions
- session create/resume/switch
- IndexedDB persistence and migrations

Fixture/parity tests:

- known puzzle fixtures with expected score/rank/hint outputs

## 11. MVP Acceptance Criteria

1. Runs fully in browser with no backend dependency.
2. Loads local strict dictionary and daily/random puzzles.
3. Enforces validation rules:
   - only puzzle letters
   - center letter required
   - minimum length
   - duplicate handling
4. Applies NYT-like scoring and rank progression.
5. Displays hints with toggle:
   - remaining total points
   - counts by first two letters from remaining words
6. Persists multiple game sessions using IndexedDB.
7. Reloading browser restores in-progress sessions.
8. Random puzzles are reproducible from seed.

## 12. Implementation Plan (Milestones)

1. Foundation
   - App shell, module boundaries, basic state container, test harness.
2. Core Rules
   - Validator, scoring, ranking with unit tests.
3. Storage
   - IndexedDB schema, repositories, migrations, persistence tests.
4. Data Pipeline
   - Dictionary filtering and puzzle build scripts, output versioning.
5. Gameplay UI
   - Letter board, input flow, found list, score/rank display.
6. Hints and Sessions
   - Toggleable hints + multi-session management UI.
7. Hardening
   - parity fixtures, accessibility pass, visual polish, mobile polish.

## 13. Open Follow-up Items

- Choose initial dictionary source (license-compatible) for `dictionary-base.txt`.
- Define exact rank thresholds per puzzle and final level naming parity.
- Decide if hint interactions should be tracked in stats beyond `viewCount`.

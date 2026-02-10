import { computeWordScore } from "./scoring.js";

export function computeHints(puzzle, foundWordSet) {
  const byPrefix2 = new Map();
  let remainingTotalPoints = 0;
  let remainingWordCount = 0;

  for (const word of puzzle.validWords) {
    const prefix = word.slice(0, 2);
    const existing = byPrefix2.get(prefix) ?? { found: 0, total: 0 };
    existing.total += 1;

    if (foundWordSet.has(word)) {
      existing.found += 1;
      byPrefix2.set(prefix, existing);
      continue;
    }

    remainingWordCount += 1;
    remainingTotalPoints += computeWordScore(word, puzzle.pangramSet.has(word));
    byPrefix2.set(prefix, existing);
  }

  const sortedPrefixes = [...byPrefix2.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return {
    remainingTotalPoints,
    remainingWordCount,
    byPrefix2: sortedPrefixes
  };
}

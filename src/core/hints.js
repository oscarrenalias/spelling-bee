import { computeWordScore } from "./scoring.js";

export function computeHints(puzzle, foundWordSet) {
  const byPrefix2 = new Map();
  let remainingTotalPoints = 0;
  let remainingWordCount = 0;

  for (const word of puzzle.validWords) {
    if (foundWordSet.has(word)) {
      continue;
    }

    remainingWordCount += 1;
    remainingTotalPoints += computeWordScore(word, puzzle.pangramSet.has(word));

    const prefix = word.slice(0, 2);
    byPrefix2.set(prefix, (byPrefix2.get(prefix) ?? 0) + 1);
  }

  const sortedPrefixes = [...byPrefix2.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return {
    remainingTotalPoints,
    remainingWordCount,
    byPrefix2: sortedPrefixes
  };
}

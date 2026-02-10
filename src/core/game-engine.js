import { validateWord } from "./validator.js";
import { computeWordScore } from "./scoring.js";
import { getRank } from "./rankings.js";
import { computeHints } from "./hints.js";

export function decoratePuzzle(rawPuzzle) {
  return {
    ...rawPuzzle,
    validWordSet: new Set(rawPuzzle.validWords),
    pangramSet: new Set(rawPuzzle.pangrams)
  };
}

export function createInitialState(puzzle, existingSession = null) {
  const foundWords = [...(existingSession?.foundWords ?? [])].sort();
  const foundWordSet = new Set(foundWords);

  const score = existingSession?.score ?? 0;
  const rankKey = existingSession?.rankKey ?? getRank(score, puzzle.rankThresholds);

  return {
    puzzle,
    sessionId: existingSession?.sessionId ?? crypto.randomUUID(),
    createdAt: existingSession?.createdAt ?? new Date().toISOString(),
    source: existingSession?.source ?? puzzle.source ?? "daily",
    seed: existingSession?.seed ?? null,
    foundWords,
    foundWordSet,
    score,
    rankKey,
    feedback: "",
    hints: computeHints(puzzle, foundWordSet)
  };
}

export function submitWord(state, rawWord) {
  const result = validateWord(rawWord, state.puzzle, state.foundWordSet);
  if (!result.ok) {
    return {
      ...state,
      feedback: result.reason
    };
  }

  const isPangram = state.puzzle.pangramSet.has(result.word);
  const deltaScore = computeWordScore(result.word, isPangram);
  const nextFoundWords = [...state.foundWords, result.word].sort();
  const nextFoundSet = new Set(nextFoundWords);
  const nextScore = state.score + deltaScore;
  const nextRank = getRank(nextScore, state.puzzle.rankThresholds);
  const suffix = isPangram ? " Pangram!" : "";

  return {
    ...state,
    foundWords: nextFoundWords,
    foundWordSet: nextFoundSet,
    score: nextScore,
    rankKey: nextRank,
    feedback: `Accepted +${deltaScore}.${suffix}`.trim(),
    hints: computeHints(state.puzzle, nextFoundSet)
  };
}

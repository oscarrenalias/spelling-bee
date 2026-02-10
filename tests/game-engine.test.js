import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, decoratePuzzle, submitWord } from "../src/core/game-engine.js";

const puzzle = decoratePuzzle({
  id: "fixture-1",
  centerLetter: "a",
  outerLetters: ["c", "e", "l", "n", "r", "t"],
  validWords: ["acre", "alert", "alter", "central"],
  pangrams: ["central"],
  rankThresholds: {
    beginner: 0,
    goodStart: 2,
    movingUp: 4,
    good: 8,
    solid: 12,
    nice: 16,
    great: 20,
    amazing: 24,
    genius: 28
  }
});

test("initial state computes hints and rank", () => {
  const state = createInitialState(puzzle);
  assert.equal(state.score, 0);
  assert.equal(state.rankKey, "beginner");
  assert.equal(state.hints.remainingWordCount, 4);
});

test("submitWord accepts valid words and updates score/rank/hints", () => {
  const initial = createInitialState(puzzle);
  const afterAcre = submitWord(initial, "acre");
  assert.equal(afterAcre.score, 1);
  assert.equal(afterAcre.foundWords.length, 1);

  const afterPangram = submitWord(afterAcre, "central");
  assert.equal(afterPangram.score, 15);
  assert.equal(afterPangram.rankKey, "solid");
  assert.equal(afterPangram.hints.remainingWordCount, 2);
});

test("submitWord reports validation errors", () => {
  const initial = createInitialState(puzzle);
  const afterBad = submitWord(initial, "xxxx");
  assert.equal(afterBad.feedback, "Word must include the center letter.");
  assert.equal(afterBad.score, 0);
});

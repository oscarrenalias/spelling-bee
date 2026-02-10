import test from "node:test";
import assert from "node:assert/strict";
import { hashSeed, pickPuzzleBySeed } from "../src/puzzles/random-generator.js";

test("hashSeed is deterministic for the same seed", () => {
  const seed = "alpha-seed-2026";
  assert.equal(hashSeed(seed), hashSeed(seed));
});

test("pickPuzzleBySeed returns the same puzzle for the same seed", () => {
  const puzzles = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const seed = "shared-seed";

  const first = pickPuzzleBySeed(puzzles, seed);
  const second = pickPuzzleBySeed(puzzles, seed);

  assert.equal(first.id, second.id);
});

test("pickPuzzleBySeed throws for empty puzzle lists", () => {
  assert.throws(() => pickPuzzleBySeed([], "seed"), /No puzzles available/);
});

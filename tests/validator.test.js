import test from "node:test";
import assert from "node:assert/strict";
import { validateWord } from "../src/core/validator.js";

const puzzle = {
  centerLetter: "a",
  outerLetters: ["c", "e", "l", "n", "r", "t"],
  validWordSet: new Set(["acre", "alert", "central", "clean"])
};

test("validator rejects non alpha words", () => {
  const result = validateWord("ab3d", puzzle, new Set());
  assert.equal(result.ok, false);
});

test("validator requires center letter", () => {
  const result = validateWord("cler", puzzle, new Set());
  assert.equal(result.ok, false);
});

test("validator rejects duplicates", () => {
  const result = validateWord("acre", puzzle, new Set(["acre"]));
  assert.equal(result.ok, false);
});

test("validator accepts valid puzzle word", () => {
  const result = validateWord("central", puzzle, new Set());
  assert.equal(result.ok, true);
  assert.equal(result.word, "central");
});

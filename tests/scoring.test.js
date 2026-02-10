import test from "node:test";
import assert from "node:assert/strict";
import { computeMaxScore, computeWordScore } from "../src/core/scoring.js";

test("computeWordScore follows base + pangram bonus rules", () => {
  assert.equal(computeWordScore("able", false), 1);
  assert.equal(computeWordScore("alert", false), 5);
  assert.equal(computeWordScore("central", true), 14);
});

test("computeMaxScore sums puzzle words", () => {
  const validWords = ["able", "alert", "central"];
  const pangrams = new Set(["central"]);
  assert.equal(computeMaxScore(validWords, pangrams), 20);
});

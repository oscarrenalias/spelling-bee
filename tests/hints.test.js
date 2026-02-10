import test from "node:test";
import assert from "node:assert/strict";
import { computeHints } from "../src/core/hints.js";

const puzzle = {
  validWords: ["acre", "alert", "alter", "central"],
  pangramSet: new Set(["central"])
};

test("hints include remaining totals and prefix buckets", () => {
  const hints = computeHints(puzzle, new Set(["acre"]));
  assert.equal(hints.remainingWordCount, 3);
  assert.equal(hints.remainingTotalPoints, 24);
  assert.deepEqual(hints.byPrefix2, [
    ["ac", { found: 1, total: 1 }],
    ["al", { found: 0, total: 2 }],
    ["ce", { found: 0, total: 1 }]
  ]);
});

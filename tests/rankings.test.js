import test from "node:test";
import assert from "node:assert/strict";
import { getRank, toRankLabel } from "../src/core/rankings.js";

test("getRank supports queen bee and ignores missing thresholds", () => {
  const thresholds = {
    beginner: 0,
    goodStart: 2,
    movingUp: 5,
    good: 8,
    solid: 15,
    nice: 25,
    great: 40,
    amazing: 50,
    genius: 70,
    queenBee: 100
  };

  assert.equal(getRank(74, thresholds), "genius");
  assert.equal(getRank(100, thresholds), "queenBee");
  assert.equal(getRank(4, { beginner: 0, goodStart: 2 }), "goodStart");
});

test("toRankLabel formats camelCase keys", () => {
  assert.equal(toRankLabel("goodStart"), "Good Start");
  assert.equal(toRankLabel("queenBee"), "Queen Bee");
});

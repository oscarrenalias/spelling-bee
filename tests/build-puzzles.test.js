import test from "node:test";
import assert from "node:assert/strict";
import {
  assignDifficulties,
  computeDifficultyTargets,
  interleaveForSchedule,
  selectByQuota
} from "../tools/build-puzzles.mjs";

function makeCandidate(id, difficulty, guardrailMatches = ["simple", "medium", "hard"], score = 0.5) {
  return {
    coreKey: id,
    difficulty,
    metrics: {
      difficultyScore: score,
      guardrailMatches
    }
  };
}

test("computeDifficultyTargets enforces 30/50/20 split", () => {
  assert.deepEqual(computeDifficultyTargets(730), {
    simple: 219,
    medium: 365,
    hard: 146
  });
});

test("assignDifficulties uses score quantiles and respects guardrails", () => {
  const candidates = [
    makeCandidate("a", "medium", ["simple"], 0.1),
    makeCandidate("b", "medium", ["simple", "medium"], 0.2),
    makeCandidate("c", "medium", ["medium"], 0.6),
    makeCandidate("d", "medium", ["hard"], 0.9),
    makeCandidate("e", "medium", ["hard"], 0.95)
  ];

  const assigned = assignDifficulties(candidates);

  assert.equal(assigned[0].difficulty, "simple");
  assert.equal(assigned[1].difficulty, "medium");
  assert.equal(assigned[2].difficulty, "medium");
  assert.equal(assigned[3].difficulty, "hard");
  assert.equal(assigned[4].difficulty, "hard");
});

test("selectByQuota is deterministic and satisfies quotas when supply exists", () => {
  const candidates = [];
  for (let idx = 0; idx < 15; idx += 1) {
    candidates.push(makeCandidate(`s-${idx}`, "simple", ["simple", "medium"], 0.1));
    candidates.push(makeCandidate(`m-${idx}`, "medium", ["simple", "medium", "hard"], 0.5));
    candidates.push(makeCandidate(`h-${idx}`, "hard", ["medium", "hard"], 0.9));
  }

  const first = selectByQuota(candidates, 20, "2026-01-01");
  const second = selectByQuota(candidates, 20, "2026-01-01");
  assert.deepEqual(first.map((item) => item.coreKey), second.map((item) => item.coreKey));

  const counts = first.reduce(
    (acc, item) => {
      acc[item.difficulty] += 1;
      return acc;
    },
    { simple: 0, medium: 0, hard: 0 }
  );

  assert.deepEqual(counts, { simple: 6, medium: 10, hard: 4 });
});

test("interleaveForSchedule alternates difficulty pattern when available", () => {
  const candidates = [
    makeCandidate("m1", "medium"),
    makeCandidate("m2", "medium"),
    makeCandidate("m3", "medium"),
    makeCandidate("s1", "simple"),
    makeCandidate("s2", "simple"),
    makeCandidate("h1", "hard")
  ];

  const ordered = interleaveForSchedule(candidates).map((candidate) => candidate.difficulty);

  assert.deepEqual(ordered, ["medium", "simple", "medium", "hard", "medium", "simple"]);
});

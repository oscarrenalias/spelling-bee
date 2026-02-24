import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { computeMaxScore } from "../src/core/scoring.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const INPUT_DICT = path.join(rootDir, "data/dictionary-v1.json");
const OUTPUT_PUZZLES = path.join(rootDir, "data/puzzles-v1.json");
const INPUT_FREQUENCY = path.join(rootDir, "data/raw/sources/wordfreq.tsv");

const MIN_WORDS = 12;
const MIN_PANGRAMS = 1;
const MAX_PUZZLES = 60;
const TARGET_DIFFICULTY_RATIO = {
  simple: 0.3,
  medium: 0.5,
  hard: 0.2
};
const DIFFICULTY_ORDER = ["simple", "medium", "hard"];
const DIFFICULTY_GUARDRAILS = {
  simple: {
    minWordCount: 35,
    maxWordCount: 85,
    minMaxScore: 170,
    maxMaxScore: 250,
    minAverageZipf: 4.2
  },
  medium: {
    minWordCount: 24,
    maxWordCount: 65,
    minMaxScore: 120,
    maxMaxScore: 210,
    minAverageZipf: 3.8,
    maxAverageZipf: 4.4
  },
  hard: {
    minWordCount: 16,
    maxWordCount: 45,
    minMaxScore: 90,
    maxMaxScore: 170,
    maxAverageZipf: 4.0
  }
};
const DIFFICULTY_CENTERS = {
  simple: 0.2,
  medium: 0.55,
  hard: 0.85
};

function hashString(input) {
  let hash = 2166136261;
  for (let idx = 0; idx < input.length; idx += 1) {
    hash ^= input.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function comparablePayload(payload) {
  return {
    version: payload.version,
    sourceDictionaryVersion: payload.sourceDictionaryVersion,
    puzzles: payload.puzzles
  };
}

function parseArgs(argv) {
  const parsed = {
    startDate: null,
    count: MAX_PUZZLES
  };

  for (const arg of argv) {
    if (arg.startsWith("--start=")) {
      parsed.startDate = arg.slice("--start=".length);
    }
    if (arg.startsWith("--count=")) {
      const count = Number(arg.slice("--count=".length));
      if (Number.isFinite(count) && count > 0) {
        parsed.count = Math.floor(count);
      }
    }
  }

  return parsed;
}

function normalize01(value, min, max) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate, offset) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  return localIsoDate(date);
}

function uniqueLetters(word) {
  return new Set(word);
}

function isSubsetWord(word, allowedSet) {
  for (const char of word) {
    if (!allowedSet.has(char)) {
      return false;
    }
  }
  return true;
}

function isPangram(word, allowedSet) {
  const chars = uniqueLetters(word);
  if (chars.size !== allowedSet.size) {
    return false;
  }
  for (const char of allowedSet) {
    if (!chars.has(char)) {
      return false;
    }
  }
  return true;
}

function rankThresholds(maxScore) {
  const pct = {
    beginner: 0,
    goodStart: 0.02,
    movingUp: 0.05,
    good: 0.08,
    solid: 0.15,
    nice: 0.25,
    great: 0.4,
    amazing: 0.5,
    genius: 0.7,
    queenBee: 1
  };

  const thresholds = {};
  for (const [key, value] of Object.entries(pct)) {
    thresholds[key] = Math.floor(maxScore * value);
  }
  return thresholds;
}

async function loadZipfMap() {
  const zipfByWord = new Map();
  let minZipf = Number.POSITIVE_INFINITY;
  let maxZipf = Number.NEGATIVE_INFINITY;
  let rowsLoaded = 0;

  try {
    const raw = await fs.readFile(INPUT_FREQUENCY, "utf8");
    const lines = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return {
        zipfByWord,
        minZipf: 0,
        maxZipf: 0,
        rowsLoaded: 0
      };
    }

    const header = lines[0].split("\t");
    const wordIdx = header.indexOf("word");
    const zipfIdx = header.indexOf("zipf");

    if (wordIdx < 0 || zipfIdx < 0) {
      throw new Error('Frequency file must include "word" and "zipf" columns');
    }

    for (const line of lines.slice(1)) {
      const cols = line.split("\t");
      const word = String(cols[wordIdx] ?? "").trim().toLowerCase();
      const zipf = Number(cols[zipfIdx]);
      if (!word || !Number.isFinite(zipf)) {
        continue;
      }

      zipfByWord.set(word, zipf);
      minZipf = Math.min(minZipf, zipf);
      maxZipf = Math.max(maxZipf, zipf);
      rowsLoaded += 1;
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  if (!rowsLoaded) {
    minZipf = 0;
    maxZipf = 0;
  }

  return {
    zipfByWord,
    minZipf,
    maxZipf,
    rowsLoaded
  };
}

function buildLetterFrequency(words) {
  const counts = new Map();

  for (const word of words) {
    const unique = uniqueLetters(word);
    for (const letter of unique) {
      counts.set(letter, (counts.get(letter) ?? 0) + 1);
    }
  }

  const totalWords = words.length || 1;
  const frequency = new Map();
  for (const [letter, count] of counts.entries()) {
    frequency.set(letter, count / totalWords);
  }

  return frequency;
}

function passesGuardrail(candidate, guardrail) {
  const { wordCount, maxScore, averageZipf } = candidate.metrics;

  if (wordCount < guardrail.minWordCount || wordCount > guardrail.maxWordCount) {
    return false;
  }

  if (maxScore < guardrail.minMaxScore || maxScore > guardrail.maxMaxScore) {
    return false;
  }

  if (Number.isFinite(guardrail.minAverageZipf) && averageZipf < guardrail.minAverageZipf) {
    return false;
  }

  if (Number.isFinite(guardrail.maxAverageZipf) && averageZipf > guardrail.maxAverageZipf) {
    return false;
  }

  return true;
}

function chooseNearestDifficulty(score, allowed) {
  let best = allowed[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const difficulty of allowed) {
    const center = DIFFICULTY_CENTERS[difficulty];
    const distance = Math.abs(score - center);
    if (distance < bestDistance) {
      best = difficulty;
      bestDistance = distance;
    }
  }

  return best;
}

export function computeDifficultyTargets(totalCount) {
  const simple = Math.round(totalCount * TARGET_DIFFICULTY_RATIO.simple);
  const medium = Math.round(totalCount * TARGET_DIFFICULTY_RATIO.medium);
  const hard = totalCount - simple - medium;
  return { simple, medium, hard };
}

function assignDifficulties(candidates) {
  if (!candidates.length) {
    return [];
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.metrics.difficultyScore !== b.metrics.difficultyScore) {
      return a.metrics.difficultyScore - b.metrics.difficultyScore;
    }
    return a.coreKey.localeCompare(b.coreKey);
  });

  const total = sorted.length;
  const simpleCutoff = Math.floor(total * TARGET_DIFFICULTY_RATIO.simple);
  const mediumCutoff = Math.floor(total * (TARGET_DIFFICULTY_RATIO.simple + TARGET_DIFFICULTY_RATIO.medium));

  return sorted.map((candidate, idx) => {
    const targetDifficulty = idx < simpleCutoff ? "simple" : idx < mediumCutoff ? "medium" : "hard";
    const allowed = candidate.metrics.guardrailMatches;
    const difficulty = allowed.includes(targetDifficulty)
      ? targetDifficulty
      : chooseNearestDifficulty(candidate.metrics.difficultyScore, allowed);

    return {
      ...candidate,
      difficulty
    };
  });
}

function selectByQuota(candidates, count, startDate) {
  const targets = computeDifficultyTargets(count);
  const buckets = {
    simple: [],
    medium: [],
    hard: []
  };

  for (const candidate of candidates) {
    buckets[candidate.difficulty].push(candidate);
  }

  for (const difficulty of DIFFICULTY_ORDER) {
    buckets[difficulty].sort((a, b) => {
      const ah = hashString(`${startDate}:${difficulty}:${a.coreKey}`);
      const bh = hashString(`${startDate}:${difficulty}:${b.coreKey}`);
      if (ah !== bh) {
        return ah - bh;
      }
      return a.coreKey.localeCompare(b.coreKey);
    });
  }

  const selected = {
    simple: buckets.simple.slice(0, targets.simple),
    medium: buckets.medium.slice(0, targets.medium),
    hard: buckets.hard.slice(0, targets.hard)
  };
  const shortages = {};

  for (const difficulty of DIFFICULTY_ORDER) {
    shortages[difficulty] = Math.max(0, targets[difficulty] - selected[difficulty].length);
  }

  const leftovers = {
    simple: buckets.simple.slice(selected.simple.length),
    medium: buckets.medium.slice(selected.medium.length),
    hard: buckets.hard.slice(selected.hard.length)
  };

  const borrowOrder = {
    simple: ["medium", "hard"],
    medium: ["simple", "hard"],
    hard: ["medium", "simple"]
  };

  for (const difficulty of DIFFICULTY_ORDER) {
    while (shortages[difficulty] > 0) {
      let borrowed = null;
      for (const source of borrowOrder[difficulty]) {
        while (leftovers[source].length > 0) {
          const next = leftovers[source].shift();
          if (next.metrics.guardrailMatches.includes(difficulty)) {
            borrowed = {
              ...next,
              difficulty
            };
            break;
          }
        }
        if (borrowed) {
          break;
        }
      }

      if (!borrowed) {
        break;
      }

      selected[difficulty].push(borrowed);
      shortages[difficulty] -= 1;
    }
  }

  for (const difficulty of DIFFICULTY_ORDER) {
    if (shortages[difficulty] > 0) {
      console.warn(`Unable to fully satisfy ${difficulty} quota. missing=${shortages[difficulty]}`);
    }
  }

  const finalSelection = [...selected.simple, ...selected.medium, ...selected.hard];
  if (finalSelection.length < count) {
    const allLeftovers = [...leftovers.simple, ...leftovers.medium, ...leftovers.hard];
    allLeftovers.sort((a, b) => {
      const ah = hashString(`${startDate}:fallback:${a.coreKey}`);
      const bh = hashString(`${startDate}:fallback:${b.coreKey}`);
      if (ah !== bh) {
        return ah - bh;
      }
      return a.coreKey.localeCompare(b.coreKey);
    });

    for (const candidate of allLeftovers) {
      if (finalSelection.length >= count) {
        break;
      }
      finalSelection.push(candidate);
    }
  }

  return finalSelection.slice(0, count);
}

function interleaveForSchedule(candidates) {
  const byDifficulty = {
    simple: candidates.filter((candidate) => candidate.difficulty === "simple"),
    medium: candidates.filter((candidate) => candidate.difficulty === "medium"),
    hard: candidates.filter((candidate) => candidate.difficulty === "hard")
  };

  const pattern = ["medium", "simple", "medium", "hard"];
  const ordered = [];
  let patternIdx = 0;

  while (ordered.length < candidates.length) {
    const preferred = pattern[patternIdx % pattern.length];
    patternIdx += 1;

    if (byDifficulty[preferred].length > 0) {
      ordered.push(byDifficulty[preferred].shift());
      continue;
    }

    const fallback = DIFFICULTY_ORDER.find((difficulty) => byDifficulty[difficulty].length > 0);
    if (!fallback) {
      break;
    }
    ordered.push(byDifficulty[fallback].shift());
  }

  return ordered;
}

function annotateCandidates(candidates, words, zipfInfo) {
  const letterFrequency = buildLetterFrequency(words);
  const rawStats = candidates.map((candidate) => {
    const letters = [candidate.centerLetter, ...candidate.outerLetters];
    const letterRarityRaw =
      letters.reduce((total, letter) => total + (1 - (letterFrequency.get(letter) ?? 0)), 0) / letters.length;

    let zipfTotal = 0;
    let zipfCount = 0;
    let commonWordCount = 0;
    for (const word of candidate.validWords) {
      const zipf = zipfInfo.zipfByWord.get(word);
      if (!Number.isFinite(zipf)) {
        continue;
      }
      zipfTotal += zipf;
      zipfCount += 1;
      if (zipf >= 4.5) {
        commonWordCount += 1;
      }
    }

    const averageZipf = zipfCount ? zipfTotal / zipfCount : zipfInfo.minZipf;
    const commonWordShare = candidate.validWords.length ? commonWordCount / candidate.validWords.length : 0;

    return {
      ...candidate,
      coreKey: `${candidate.signature}:${candidate.centerLetter}`,
      metricsRaw: {
        wordCount: candidate.validWords.length,
        maxScore: candidate.maxScore,
        averageZipf,
        commonWordShare,
        letterRarityRaw
      }
    };
  });

  const mins = {
    wordCount: Math.min(...rawStats.map((item) => item.metricsRaw.wordCount)),
    maxScore: Math.min(...rawStats.map((item) => item.metricsRaw.maxScore)),
    averageZipf: Math.min(...rawStats.map((item) => item.metricsRaw.averageZipf)),
    commonWordShare: Math.min(...rawStats.map((item) => item.metricsRaw.commonWordShare)),
    letterRarityRaw: Math.min(...rawStats.map((item) => item.metricsRaw.letterRarityRaw))
  };
  const maxs = {
    wordCount: Math.max(...rawStats.map((item) => item.metricsRaw.wordCount)),
    maxScore: Math.max(...rawStats.map((item) => item.metricsRaw.maxScore)),
    averageZipf: Math.max(...rawStats.map((item) => item.metricsRaw.averageZipf)),
    commonWordShare: Math.max(...rawStats.map((item) => item.metricsRaw.commonWordShare)),
    letterRarityRaw: Math.max(...rawStats.map((item) => item.metricsRaw.letterRarityRaw))
  };

  const withMetrics = rawStats.map((candidate) => {
    const letterRarity = normalize01(candidate.metricsRaw.letterRarityRaw, mins.letterRarityRaw, maxs.letterRarityRaw);
    const scoreHardness = 1 - normalize01(candidate.metricsRaw.maxScore, mins.maxScore, maxs.maxScore);
    const countHardness = 1 - normalize01(candidate.metricsRaw.wordCount, mins.wordCount, maxs.wordCount);
    const zipfHardness = 1 - normalize01(candidate.metricsRaw.averageZipf, mins.averageZipf, maxs.averageZipf);
    const obviousnessHardness = 1 - normalize01(
      candidate.metricsRaw.commonWordShare,
      mins.commonWordShare,
      maxs.commonWordShare
    );

    const difficultyScore =
      letterRarity * 0.3 + zipfHardness * 0.3 + scoreHardness * 0.2 + countHardness * 0.15 + obviousnessHardness * 0.05;

    const metrics = {
      wordCount: candidate.metricsRaw.wordCount,
      maxScore: candidate.metricsRaw.maxScore,
      averageZipf: candidate.metricsRaw.averageZipf,
      commonWordShare: candidate.metricsRaw.commonWordShare,
      letterRarity,
      difficultyScore
    };

    const guardrailMatches = DIFFICULTY_ORDER.filter((difficulty) =>
      passesGuardrail({ ...candidate, metrics }, DIFFICULTY_GUARDRAILS[difficulty])
    );

    return {
      ...candidate,
      metrics: {
        ...metrics,
        guardrailMatches
      }
    };
  });

  return withMetrics.filter((candidate) => candidate.metrics.guardrailMatches.length > 0);
}

function buildCandidates(words) {
  const sevenLetterSets = new Map();

  for (const word of words) {
    if (word.length < 7) {
      continue;
    }

    const chars = uniqueLetters(word);
    if (chars.size !== 7) {
      continue;
    }

    const signature = [...chars].sort().join("");
    if (!sevenLetterSets.has(signature)) {
      sevenLetterSets.set(signature, chars);
    }
  }

  const candidates = [];

  for (const [signature, letterSet] of sevenLetterSets.entries()) {
    for (const centerLetter of letterSet) {
      const allowedSet = letterSet;
      const validWords = words.filter((word) => word.includes(centerLetter) && isSubsetWord(word, allowedSet));
      const pangrams = validWords.filter((word) => isPangram(word, allowedSet));

      if (validWords.length < MIN_WORDS || pangrams.length < MIN_PANGRAMS) {
        continue;
      }

      const maxScore = computeMaxScore(validWords, new Set(pangrams));
      const outerLetters = [...allowedSet].filter((letter) => letter !== centerLetter).sort();

      candidates.push({
        signature,
        coreKey: `${signature}:${centerLetter}`,
        centerLetter,
        outerLetters,
        validWords: validWords.sort(),
        pangrams: pangrams.sort(),
        maxScore,
        rankThresholds: rankThresholds(maxScore),
        quality: maxScore + validWords.length * 3 + pangrams.length * 10
      });
    }
  }

  candidates.sort((a, b) => b.quality - a.quality);

  const uniqueByCore = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.signature}:${candidate.centerLetter}`;
    if (!uniqueByCore.has(key)) {
      uniqueByCore.set(key, candidate);
    }
  }

  return [...uniqueByCore.values()];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const dictRaw = await fs.readFile(INPUT_DICT, "utf8");
  const dictionary = JSON.parse(dictRaw);
  const words = dictionary.words;
  const zipfInfo = await loadZipfMap();

  const baseCandidates = buildCandidates(words);
  const annotated = annotateCandidates(baseCandidates, words, zipfInfo);
  const start = args.startDate ?? localIsoDate(new Date());
  const withDifficulty = assignDifficulties(annotated);
  const selected = interleaveForSchedule(selectByQuota(withDifficulty, args.count, start));

  const puzzles = selected.map((candidate, idx) => {
    const date = addDays(start, idx);
    return {
      id: date,
      date,
      centerLetter: candidate.centerLetter,
      outerLetters: candidate.outerLetters,
      dictionaryVersion: dictionary.version,
      validWords: candidate.validWords,
      pangrams: candidate.pangrams,
      difficulty: candidate.difficulty,
      maxScore: candidate.maxScore,
      rankThresholds: candidate.rankThresholds
    };
  });

  const payload = {
    version: "v1",
    generatedAt: new Date().toISOString(),
    sourceDictionaryVersion: dictionary.version,
    puzzles
  };

  let shouldWrite = true;
  try {
    const existingRaw = await fs.readFile(OUTPUT_PUZZLES, "utf8");
    const existingPayload = JSON.parse(existingRaw);
    shouldWrite = JSON.stringify(comparablePayload(existingPayload)) !== JSON.stringify(comparablePayload(payload));
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  if (shouldWrite) {
    await fs.writeFile(OUTPUT_PUZZLES, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } else {
    console.log("Puzzle build skipped write (no content changes).");
  }

  const countsByDifficulty = puzzles.reduce(
    (acc, puzzle) => {
      acc[puzzle.difficulty] += 1;
      return acc;
    },
    { simple: 0, medium: 0, hard: 0 }
  );

  console.log(
    `Puzzle build complete. baseCandidates=${baseCandidates.length} eligible=${withDifficulty.length} published=${puzzles.length}`
  );
  console.log(
    `Difficulty mix simple=${countsByDifficulty.simple} medium=${countsByDifficulty.medium} hard=${countsByDifficulty.hard}`
  );
  console.log(`Frequency rows loaded=${zipfInfo.rowsLoaded}`);
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { assignDifficulties, annotateCandidates, buildCandidates, interleaveForSchedule, selectByQuota };

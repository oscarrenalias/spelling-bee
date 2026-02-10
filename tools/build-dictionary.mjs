import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const INPUT_BASE = path.join(rootDir, "data/raw/dictionary-base.txt");
const INPUT_ALLOW = path.join(rootDir, "data/raw/allowlist.txt");
const INPUT_BLOCK = path.join(rootDir, "data/raw/blocklist.txt");
const INPUT_POLICY = path.join(rootDir, "data/raw/policy.json");

const OUTPUT_DICT = path.join(rootDir, "data/dictionary-v1.json");
const OUTPUT_META = path.join(rootDir, "data/dictionary-v1-meta.json");

function parseWordLines(content) {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
}

function toSet(values) {
  return new Set(values.map((value) => value.toLowerCase()));
}

function isAlphaWord(word) {
  return /^[a-z]+$/u.test(word);
}

function matchesBlockedPattern(word, patterns) {
  return patterns.some((pattern) => new RegExp(pattern, "u").test(word));
}

function buildMeta(policyVersion, sourceVersion, counters, finalTotal) {
  return {
    sourceName: "project-local-seed",
    sourceVersion,
    license: "project-internal",
    policyVersion,
    counts: {
      inputTotal: counters.inputTotal,
      normalizedTotal: counters.normalizedTotal,
      removedProfanity: counters.removedProfanity,
      removedProperNouns: counters.removedProperNouns,
      removedGeoTerms: counters.removedGeoTerms,
      removedDemonyms: counters.removedDemonyms,
      removedAbbreviations: counters.removedAbbreviations,
      removedRare: counters.removedRare,
      allowlistAdded: counters.allowlistAdded,
      blocklistRemoved: counters.blocklistRemoved,
      finalTotal
    }
  };
}

async function main() {
  const [baseRaw, allowRaw, blockRaw, policyRaw] = await Promise.all([
    fs.readFile(INPUT_BASE, "utf8"),
    fs.readFile(INPUT_ALLOW, "utf8"),
    fs.readFile(INPUT_BLOCK, "utf8"),
    fs.readFile(INPUT_POLICY, "utf8")
  ]);

  const policy = JSON.parse(policyRaw);
  const allowlist = toSet(parseWordLines(allowRaw));
  const blocklist = toSet(parseWordLines(blockRaw));

  const profanity = toSet(policy.profanity ?? []);
  const geoTerms = toSet(policy.geoTerms ?? []);
  const demonyms = toSet(policy.demonyms ?? []);
  const rareTerms = toSet(policy.rareTerms ?? []);
  const blockedPatterns = policy.blockedPatterns ?? [];

  const counters = {
    inputTotal: 0,
    normalizedTotal: 0,
    removedProfanity: 0,
    removedProperNouns: 0,
    removedGeoTerms: 0,
    removedDemonyms: 0,
    removedAbbreviations: 0,
    removedRare: 0,
    allowlistAdded: 0,
    blocklistRemoved: 0
  };

  const baseWords = parseWordLines(baseRaw);
  counters.inputTotal = baseWords.length;

  const normalized = new Set();
  for (const word of baseWords) {
    normalized.add(word.normalize("NFKC"));
  }
  counters.normalizedTotal = normalized.size;

  const filtered = new Set();

  for (const rawWord of normalized) {
    const word = rawWord.toLowerCase();

    if (!isAlphaWord(word)) {
      counters.removedAbbreviations += 1;
      continue;
    }

    if (word.length < (policy.minimumLength ?? 4)) {
      counters.removedAbbreviations += 1;
      continue;
    }

    if (matchesBlockedPattern(word, blockedPatterns)) {
      counters.removedAbbreviations += 1;
      continue;
    }

    if (policy.excludeProfanity && profanity.has(word)) {
      counters.removedProfanity += 1;
      continue;
    }

    if (policy.excludeGeoTerms && geoTerms.has(word)) {
      counters.removedGeoTerms += 1;
      continue;
    }

    if (policy.excludeDemonyms && demonyms.has(word)) {
      counters.removedDemonyms += 1;
      continue;
    }

    if (policy.excludeRare && rareTerms.has(word)) {
      counters.removedRare += 1;
      continue;
    }

    filtered.add(word);
  }

  for (const word of allowlist) {
    if (!filtered.has(word)) {
      filtered.add(word);
      counters.allowlistAdded += 1;
    }
  }

  for (const word of blocklist) {
    if (filtered.delete(word)) {
      counters.blocklistRemoved += 1;
    }
  }

  const words = [...filtered].sort();

  const dictionaryPayload = {
    version: "v1",
    strict: true,
    words
  };

  const metaPayload = buildMeta(policy.version ?? "v1", "v1", counters, words.length);

  await Promise.all([
    fs.writeFile(OUTPUT_DICT, `${JSON.stringify(dictionaryPayload, null, 2)}\n`, "utf8"),
    fs.writeFile(OUTPUT_META, `${JSON.stringify(metaPayload, null, 2)}\n`, "utf8")
  ]);

  console.log(`Dictionary build complete. words=${words.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export function createSeed() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function hashSeed(seed) {
  let hash = 0;
  for (let idx = 0; idx < seed.length; idx += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(idx);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pickPuzzleBySeed(puzzles, seed) {
  if (!puzzles.length) {
    throw new Error("No puzzles available");
  }

  const index = hashSeed(seed) % puzzles.length;
  return puzzles[index];
}

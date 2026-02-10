import { decoratePuzzle } from "../core/game-engine.js";

export async function loadPuzzles() {
  const response = await fetch("./data/puzzles-v1.json");
  if (!response.ok) {
    throw new Error(`Unable to load puzzles: ${response.status}`);
  }

  const payload = await response.json();
  return payload.puzzles.map((puzzle) => decoratePuzzle(puzzle));
}

export function getDailyPuzzle(puzzles, date = new Date()) {
  const yyyyMmDd = date.toISOString().slice(0, 10);
  const match = puzzles.find((puzzle) => puzzle.date === yyyyMmDd);
  return match ?? puzzles[0];
}

export function getRandomPuzzle(puzzles) {
  const idx = Math.floor(Math.random() * puzzles.length);
  return puzzles[idx];
}

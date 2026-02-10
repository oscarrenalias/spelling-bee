import "./ui/components/letter-board.js";
import { createInitialState, submitWord } from "./core/game-engine.js";
import { toRankLabel } from "./core/rankings.js";
import { getDailyPuzzle, loadPuzzles } from "./puzzles/provider.js";
import { createSeed, pickPuzzleBySeed } from "./puzzles/random-generator.js";
import { loadSessionById, loadSessions, saveSession } from "./storage/repositories.js";

const HINTS_VISIBILITY_KEY = "spelling-bee:hints-visible";

const elements = {
  board: document.getElementById("letter-board"),
  wordForm: document.getElementById("word-form"),
  wordInput: document.getElementById("word-input"),
  feedback: document.getElementById("feedback"),
  score: document.getElementById("score"),
  rank: document.getElementById("rank"),
  foundCount: document.getElementById("found-count"),
  foundWords: document.getElementById("found-words"),
  remainingPoints: document.getElementById("remaining-points"),
  remainingCount: document.getElementById("remaining-count"),
  hintPrefixes: document.getElementById("hint-prefixes"),
  hintsContent: document.getElementById("hints-content"),
  toggleHintsButton: document.getElementById("toggle-hints"),
  sessions: document.getElementById("sessions"),
  newRandomButton: document.getElementById("new-random-game")
};

const runtime = {
  puzzles: [],
  activeState: null,
  sessionsCache: [],
  hintsVisible: true
};

function renderHintsVisibility() {
  elements.hintsContent.hidden = !runtime.hintsVisible;
  elements.toggleHintsButton.textContent = runtime.hintsVisible ? "Hide Hints" : "Show Hints";
  elements.toggleHintsButton.setAttribute("aria-expanded", String(runtime.hintsVisible));
}

function render(state) {
  elements.board.setLetters(state.puzzle.centerLetter, state.puzzle.outerLetters);
  elements.score.textContent = String(state.score);
  elements.rank.textContent = toRankLabel(state.rankKey);
  elements.foundCount.textContent = String(state.foundWords.length);
  elements.feedback.textContent = state.feedback;

  elements.foundWords.innerHTML = "";
  for (const word of state.foundWords) {
    const li = document.createElement("li");
    li.textContent = word;
    elements.foundWords.append(li);
  }

  elements.remainingPoints.textContent = String(state.hints.remainingTotalPoints);
  elements.remainingCount.textContent = String(state.hints.remainingWordCount);

  elements.hintPrefixes.innerHTML = "";
  for (const [prefix, count] of state.hints.byPrefix2) {
    const row = document.createElement("tr");
    const prefixCell = document.createElement("td");
    const countCell = document.createElement("td");
    prefixCell.textContent = prefix.toUpperCase();
    countCell.textContent = String(count);
    row.append(prefixCell, countCell);
    elements.hintPrefixes.append(row);
  }
}

function renderSessionsList() {
  elements.sessions.innerHTML = "";

  const sorted = [...runtime.sessionsCache].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const session of sorted) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sessionId = session.sessionId;
    button.textContent = `${session.source.toUpperCase()} - ${session.puzzleId} - ${toRankLabel(session.rankKey)} (${session.score})`;
    li.append(button);
    elements.sessions.append(li);
  }
}

function hydrateStateFromSession(session) {
  const puzzle = runtime.puzzles.find((item) => item.id === session.puzzleId);
  if (!puzzle) {
    return null;
  }

  return createInitialState(puzzle, session);
}

async function persistAndRefreshSession(state) {
  const record = await saveSession(state);
  const existingIndex = runtime.sessionsCache.findIndex((item) => item.sessionId === record.sessionId);

  if (existingIndex >= 0) {
    runtime.sessionsCache[existingIndex] = record;
  } else {
    runtime.sessionsCache.push(record);
  }

  renderSessionsList();
}

async function activateState(state) {
  runtime.activeState = state;
  render(runtime.activeState);
  await persistAndRefreshSession(runtime.activeState);
}

async function startDailySession() {
  const puzzle = getDailyPuzzle(runtime.puzzles);
  const initialState = createInitialState(puzzle, {
    source: "daily",
    puzzleId: puzzle.id,
    foundWords: [],
    score: 0,
    rankKey: "beginner"
  });

  await activateState(initialState);
}

async function startRandomSession() {
  const seed = createSeed();
  const puzzle = pickPuzzleBySeed(runtime.puzzles, seed);
  const initialState = createInitialState(puzzle, {
    source: "random",
    seed,
    puzzleId: puzzle.id,
    foundWords: [],
    score: 0,
    rankKey: "beginner"
  });

  await activateState(initialState);
}

async function boot() {
  runtime.hintsVisible = localStorage.getItem(HINTS_VISIBILITY_KEY) !== "false";
  renderHintsVisibility();

  runtime.puzzles = await loadPuzzles();
  runtime.sessionsCache = await loadSessions();

  if (runtime.sessionsCache.length) {
    const latest = [...runtime.sessionsCache].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const recovered = hydrateStateFromSession(latest);
    if (recovered) {
      runtime.activeState = recovered;
      render(runtime.activeState);
      renderSessionsList();
      return;
    }
  }

  await startDailySession();
}

elements.wordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!runtime.activeState) {
    return;
  }

  const rawWord = elements.wordInput.value;
  runtime.activeState = submitWord(runtime.activeState, rawWord);
  render(runtime.activeState);
  await persistAndRefreshSession(runtime.activeState);
  elements.wordInput.value = "";
  elements.wordInput.focus();
});

elements.newRandomButton.addEventListener("click", async () => {
  await startRandomSession();
});

elements.toggleHintsButton.addEventListener("click", () => {
  runtime.hintsVisible = !runtime.hintsVisible;
  localStorage.setItem(HINTS_VISIBILITY_KEY, String(runtime.hintsVisible));
  renderHintsVisibility();
});

elements.sessions.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const sessionId = target.dataset.sessionId;
  if (!sessionId) {
    return;
  }

  const session = await loadSessionById(sessionId);
  if (!session) {
    return;
  }

  const hydrated = hydrateStateFromSession(session);
  if (!hydrated) {
    return;
  }

  runtime.activeState = hydrated;
  render(runtime.activeState);
});

boot().catch((error) => {
  elements.feedback.textContent = `Initialization failed: ${error.message}`;
});

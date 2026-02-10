import { withStore } from "./idb.js";

export async function saveSession(state) {
  const now = new Date().toISOString();

  const record = {
    sessionId: state.sessionId,
    puzzleId: state.puzzle.id,
    source: state.source,
    seed: state.seed,
    createdAt: state.createdAt ?? now,
    updatedAt: now,
    foundWords: state.foundWords,
    score: state.score,
    rankKey: state.rankKey,
    hintUsage: { viewCount: 0 },
    status: "active"
  };

  await withStore("sessions", "readwrite", (store) => {
    store.put(record);
  });

  return record;
}

export async function loadSessions() {
  return withStore("sessions", "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error ?? new Error("Unable to load sessions"));
    });
  });
}

export async function loadSessionById(sessionId) {
  return withStore("sessions", "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to load session"));
    });
  });
}

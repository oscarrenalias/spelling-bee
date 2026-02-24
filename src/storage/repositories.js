import { withStore } from "./idb.js";

const SESSION_INVALIDATION_KEY = "session_invalidation_version";
const SESSION_INVALIDATION_VERSION = "2026-02-24-difficulty-rollout-v1";

function getMeta(key) {
  return withStore("app_meta", "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to load app meta record"));
    });
  });
}

function putMeta(record) {
  return withStore("app_meta", "readwrite", (store) => {
    store.put(record);
  });
}

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

export async function invalidateLegacySessionsOnce() {
  const marker = await getMeta(SESSION_INVALIDATION_KEY);
  if (marker?.value === SESSION_INVALIDATION_VERSION) {
    return false;
  }

  await withStore("sessions", "readwrite", (store) => {
    store.clear();
  });

  await putMeta({
    key: SESSION_INVALIDATION_KEY,
    value: SESSION_INVALIDATION_VERSION,
    updatedAt: new Date().toISOString()
  });

  return true;
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

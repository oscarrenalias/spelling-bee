const DB_NAME = "renalias_spelling_bee_webapp_db";
const DB_VERSION = 2;

function createSessionsStore(db) {
  const store = db.createObjectStore("sessions", { keyPath: "sessionId" });
  store.createIndex("byUpdatedAt", "updatedAt");
  store.createIndex("byStatus", "status");
  store.createIndex("byPuzzleId", "puzzleId");
}

function createPuzzlesStore(db) {
  db.createObjectStore("puzzles", { keyPath: "id" });
}

function createAppMetaStore(db) {
  db.createObjectStore("app_meta", { keyPath: "key" });
}

// Ordered, deterministic migration steps keyed by target version.
const MIGRATIONS = [
  {
    version: 1,
    run(db) {
      if (!db.objectStoreNames.contains("sessions")) {
        createSessionsStore(db);
      }
    }
  },
  {
    version: 2,
    run(db) {
      if (!db.objectStoreNames.contains("puzzles")) {
        createPuzzlesStore(db);
      }

      if (!db.objectStoreNames.contains("app_meta")) {
        createAppMetaStore(db);
      }
    }
  }
];

export function runMigrations(db, oldVersion) {
  for (const migration of MIGRATIONS) {
    if (oldVersion < migration.version) {
      migration.run(db);
    }
  }
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      runMigrations(db, request.oldVersion);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

export async function withStore(storeName, mode, callback) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let callbackResult;
    try {
      callbackResult = callback(store);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }

    tx.oncomplete = () => resolve(callbackResult);
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

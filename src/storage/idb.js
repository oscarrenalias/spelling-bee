const DB_NAME = "spelling_bee_db";
const DB_VERSION = 1;

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "sessionId" });
        store.createIndex("byUpdatedAt", "updatedAt");
        store.createIndex("byStatus", "status");
        store.createIndex("byPuzzleId", "puzzleId");
      }
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

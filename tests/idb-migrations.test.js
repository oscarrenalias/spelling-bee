import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations } from "../src/storage/idb.js";

function createFakeDb(initialStores = []) {
  const stores = new Set(initialStores);
  const createdStores = [];
  const createdIndexes = [];

  return {
    objectStoreNames: {
      contains(name) {
        return stores.has(name);
      }
    },
    createObjectStore(name) {
      stores.add(name);
      createdStores.push(name);

      return {
        createIndex(indexName, keyPath) {
          createdIndexes.push({ store: name, indexName, keyPath });
        }
      };
    },
    inspect() {
      return {
        stores: [...stores].sort(),
        createdStores,
        createdIndexes
      };
    }
  };
}

test("runMigrations creates full schema for fresh databases", () => {
  const db = createFakeDb();
  runMigrations(db, 0);

  const state = db.inspect();

  assert.deepEqual(state.stores, ["app_meta", "puzzles", "sessions"]);
  assert.equal(state.createdStores.includes("sessions"), true);
  assert.equal(state.createdStores.includes("puzzles"), true);
  assert.equal(state.createdStores.includes("app_meta"), true);
  assert.deepEqual(state.createdIndexes, [
    { store: "sessions", indexName: "byUpdatedAt", keyPath: "updatedAt" },
    { store: "sessions", indexName: "byStatus", keyPath: "status" },
    { store: "sessions", indexName: "byPuzzleId", keyPath: "puzzleId" }
  ]);
});

test("runMigrations upgrades existing v1 schema without recreating sessions", () => {
  const db = createFakeDb(["sessions"]);
  runMigrations(db, 1);

  const state = db.inspect();

  assert.deepEqual(state.stores, ["app_meta", "puzzles", "sessions"]);
  assert.equal(state.createdStores.includes("sessions"), false);
  assert.deepEqual(state.createdStores.sort(), ["app_meta", "puzzles"]);
  assert.deepEqual(state.createdIndexes, []);
});

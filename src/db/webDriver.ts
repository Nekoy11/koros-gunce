import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { createSqlJsDriver } from './sqljsDriver';
import type { SqlDriver } from './driver';

/** Browser development preview only: sql.js database persisted in IndexedDB. */
const IDB_NAME = 'personal-hub-dev';
const STORE = 'db';
const KEY = 'main';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load(): Promise<Uint8Array | undefined> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function save(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bytes, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function createWebDriver(): Promise<SqlDriver> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const data = await load().catch(() => undefined);
  return createSqlJsDriver(SQL, data, save);
}

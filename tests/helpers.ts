import initSqlJs from 'sql.js';
import { createSqlJsDriver } from '../src/db/sqljsDriver';
import { initDatabase, resetDatabaseForTests } from '../src/db/database';

/** Fresh in-memory database with migrations + default seed applied. */
export async function freshDb(): Promise<void> {
  await resetDatabaseForTests();
  const SQL = await initSqlJs();
  await initDatabase(createSqlJsDriver(SQL));
}

/** Simulates closing and re-opening the app on the same database file. */
export async function reopenDb(bytes: Uint8Array): Promise<void> {
  await resetDatabaseForTests();
  const SQL = await initSqlJs();
  await initDatabase(createSqlJsDriver(SQL, bytes));
}

/** Database whose bytes can be captured, to simulate persistence across restarts. */
export async function persistentDb(): Promise<{ snapshot: () => Uint8Array }> {
  await resetDatabaseForTests();
  const SQL = await initSqlJs();
  let last: Uint8Array = new Uint8Array();
  await initDatabase(
    createSqlJsDriver(SQL, undefined, async (b) => {
      last = b;
    }),
  );
  return { snapshot: () => last };
}

import { Capacitor } from '@capacitor/core';
import type { Row, RunResult, SqlDriver, SqlValue } from './driver';
import { migrate } from './migrations';
import { seedDefaults } from './seed';
import { emitDataChanged } from '../state/dataEvents';

/**
 * Central data-access gateway. All repositories go through these helpers; UI code never
 * touches SQL. Writes are serialized through a queue so interleaved async transactions
 * can never corrupt each other.
 */
let driver: SqlDriver | null = null;
let initPromise: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();

export async function initDatabase(custom?: SqlDriver): Promise<void> {
  if (custom) {
    driver = custom;
    initPromise = (async () => {
      await migrate(custom);
      await seedDefaults();
    })();
    return initPromise;
  }
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (Capacitor.isNativePlatform()) {
      const { createNativeDriver } = await import('./nativeDriver');
      driver = await createNativeDriver();
    } else {
      const { createWebDriver } = await import('./webDriver');
      driver = await createWebDriver();
    }
    await migrate(driver);
    await seedDefaults();
  })();
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}

function getDriver(): SqlDriver {
  if (!driver) throw new Error('Veritabanı henüz hazır değil.');
  return driver;
}

export function driverKind(): SqlDriver['kind'] | null {
  return driver?.kind ?? null;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

/** Read query. Reads are also queued so they never observe a half-written transaction. */
export function query<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  return enqueue(() => getDriver().query<T>(sql, params));
}

export async function queryOne<T = Row>(sql: string, params: SqlValue[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export interface Tx {
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  query<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

/**
 * Runs `fn` inside a single SQLite transaction; rolls back on any error.
 * `tables` are reported to subscribers after a successful commit.
 */
export function transaction<T>(tables: string[], fn: (tx: Tx) => Promise<T>): Promise<T> {
  return enqueue(async () => {
    const d = getDriver();
    await d.begin();
    try {
      const tx: Tx = {
        run: (sql, params = []) => d.run(sql, params),
        query: (sql, params = []) => d.query(sql, params),
      };
      const result = await fn(tx);
      await d.commit();
      if (tables.length) emitDataChanged(tables);
      return result;
    } catch (e) {
      await d.rollback();
      throw e;
    }
  });
}

/** Single write statement (autocommit), with change notification. */
export function execute(tables: string[], sql: string, params: SqlValue[] = []): Promise<RunResult> {
  return transaction(tables, (tx) => tx.run(sql, params));
}

/** Raw statement outside a transaction (PRAGMA, VACUUM). */
export function rawExec(sql: string): Promise<void> {
  return enqueue(() => getDriver().exec(sql));
}

/** For tests: drop the connection so a fresh database can be initialized. */
export async function resetDatabaseForTests(): Promise<void> {
  await queue.catch(() => undefined);
  if (driver) await driver.close();
  driver = null;
  initPromise = null;
}

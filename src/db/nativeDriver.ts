import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { RunResult, SqlDriver, SqlValue } from './driver';

export const DB_NAME = 'personal_hub';

/** Android SQLite driver (@capacitor-community/sqlite). Transactions are managed explicitly. */
export async function createNativeDriver(): Promise<SqlDriver> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  await sqlite.checkConnectionsConsistency().catch(() => undefined);
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  const db: SQLiteDBConnection = exists
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON;', false);

  return {
    kind: 'native',
    async exec(sql) {
      await db.execute(sql, false);
    },
    async run(sql, params: SqlValue[] = []): Promise<RunResult> {
      const res = await db.run(sql, params, false);
      return { changes: res.changes?.changes ?? 0 };
    },
    async query<T>(sql: string, params: SqlValue[] = []) {
      const res = await db.query(sql, params);
      return (res.values ?? []) as T[];
    },
    async begin() {
      await db.beginTransaction();
    },
    async commit() {
      await db.commitTransaction();
    },
    async rollback() {
      const active = await db.isTransactionActive().catch(() => ({ result: true }));
      if (active.result) await db.rollbackTransaction();
    },
    async close() {
      await sqlite.closeConnection(DB_NAME, false);
    },
  };
}

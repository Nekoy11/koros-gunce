import type { Database, SqlJsStatic } from 'sql.js';
import type { RunResult, SqlDriver, SqlValue } from './driver';

/**
 * sql.js-backed driver. Used for unit tests (in-memory) and the browser
 * development preview (persisted to IndexedDB). Not used in the Android build.
 */
export function createSqlJsDriver(SQL: SqlJsStatic, data?: Uint8Array, onPersist?: (bytes: Uint8Array) => Promise<void>): SqlDriver {
  const db: Database = data ? new SQL.Database(data) : new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  let inTx = false;

  const persist = async () => {
    if (onPersist && !inTx) await onPersist(db.export());
  };

  return {
    kind: onPersist ? 'web' : 'memory',
    async exec(sql) {
      db.exec(sql);
      await persist();
    },
    async run(sql, params: SqlValue[] = []): Promise<RunResult> {
      db.run(sql, params);
      const changes = db.getRowsModified();
      await persist();
      return { changes };
    },
    async query<T>(sql: string, params: SqlValue[] = []) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    async begin() {
      db.exec('BEGIN');
      inTx = true;
    },
    async commit() {
      db.exec('COMMIT');
      inTx = false;
      await persist();
    },
    async rollback() {
      inTx = false;
      try {
        db.exec('ROLLBACK');
      } catch {
        /* no active transaction */
      }
    },
    async close() {
      db.close();
    },
  };
}

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export interface RunResult {
  changes: number;
}

/**
 * Minimal SQL driver contract. Implemented by the native Android SQLite plugin
 * and by sql.js (browser preview + unit tests). Nothing outside src/db and
 * src/data talks to a driver directly.
 */
export interface SqlDriver {
  readonly kind: 'native' | 'web' | 'memory';
  /** Executes one or more statements without parameters. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  query<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  /** Called after a committed write so web drivers can persist. */
  flush?(): Promise<void>;
  close(): Promise<void>;
}

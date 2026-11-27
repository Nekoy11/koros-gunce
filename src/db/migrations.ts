import type { SqlDriver } from './driver';

/**
 * Ordered schema migrations. The applied version is stored in PRAGMA user_version.
 * Never edit a released migration; append a new one instead.
 */
export interface Migration {
  version: number;
  name: string;
  up: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: [
      `CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
        color TEXT NOT NULL DEFAULT '#8B92A0',
        icon TEXT NOT NULL DEFAULT 'tag',
        is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX ux_categories_kind_name ON categories(kind, name COLLATE NOCASE)`,

      `CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('opening','income','expense')),
        amount_kurus INTEGER NOT NULL CHECK (amount_kurus >= 0),
        title TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
        date TEXT NOT NULL,
        description TEXT,
        search_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (type = 'opening' OR amount_kurus > 0)
      )`,
      `CREATE UNIQUE INDEX ux_transactions_single_opening ON transactions(type) WHERE type = 'opening'`,
      `CREATE INDEX ix_transactions_date ON transactions(date)`,
      `CREATE INDEX ix_transactions_type_date ON transactions(type, date)`,
      `CREATE INDEX ix_transactions_category ON transactions(category_id)`,

      `CREATE TABLE diary_entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        search_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX ix_diary_date ON diary_entries(date)`,

      `CREATE TABLE important_notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
        search_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX ix_notes_pinned_updated ON important_notes(pinned DESC, updated_at DESC)`,

      `CREATE TABLE reminders (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT NOT NULL,
        due_time TEXT,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
        completed_at TEXT,
        notification_id INTEGER NOT NULL UNIQUE,
        search_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX ix_reminders_due ON reminders(completed, due_date, due_time)`,

      `CREATE TABLE mood_entries (
        date TEXT PRIMARY KEY,
        mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      `CREATE TABLE budget_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        amount_kurus INTEGER NOT NULL CHECK (amount_kurus > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX ux_budget_category ON budget_goals(category_id) WHERE category_id IS NOT NULL`,
      `CREATE UNIQUE INDEX ux_budget_overall ON budget_goals((category_id IS NULL)) WHERE category_id IS NULL`,

      `CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function getSchemaVersion(driver: SqlDriver): Promise<number> {
  const rows = await driver.query<{ user_version: number }>('PRAGMA user_version');
  return Number(rows[0]?.user_version ?? 0);
}

/** Applies pending migrations, each one atomically. */
export async function migrate(driver: SqlDriver): Promise<number> {
  let current = await getSchemaVersion(driver);
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(`Veritabanı sürümü (${current}) uygulamadan yeni. Lütfen uygulamayı güncelleyin.`);
  }
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await driver.begin();
    try {
      for (const stmt of m.up) await driver.run(stmt);
      await driver.run(`PRAGMA user_version = ${m.version}`);
      await driver.commit();
      current = m.version;
    } catch (e) {
      await driver.rollback();
      throw new Error(`Migration ${m.version} (${m.name}) başarısız: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return current;
}

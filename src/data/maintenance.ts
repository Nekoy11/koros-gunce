import { query, queryOne, rawExec, transaction } from '../db/database';
import { ALL_TABLES } from '../state/dataEvents';
import { seedDefaults } from '../db/seed';

export interface DbStats {
  schemaVersion: number;
  counts: Record<string, number>;
}

const COUNTED = ['transactions', 'categories', 'diary_entries', 'important_notes', 'reminders', 'mood_entries', 'budget_goals'];

export async function getDbStats(): Promise<DbStats> {
  const counts: Record<string, number> = {};
  for (const t of COUNTED) {
    const r = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`);
    counts[t] = Number(r?.n ?? 0);
  }
  const v = await query<{ user_version: number }>('PRAGMA user_version');
  return { schemaVersion: Number(v[0]?.user_version ?? 0), counts };
}

export async function checkIntegrity(): Promise<{ ok: boolean; message: string }> {
  const rows = await query<{ integrity_check: string }>('PRAGMA integrity_check');
  const fk = await query('PRAGMA foreign_key_check');
  const msg = rows.map((r) => r.integrity_check).join(', ');
  const ok = msg === 'ok' && fk.length === 0;
  return { ok, message: ok ? 'Veritabanı sağlıklı.' : `Sorun bulundu: ${msg}${fk.length ? `, ${fk.length} yabancı anahtar hatası` : ''}` };
}

export async function optimizeDatabase(): Promise<void> {
  await rawExec('PRAGMA optimize;');
  await rawExec('VACUUM;');
}

/** Permanently removes every record and restores default categories/settings. */
export async function wipeAllData(): Promise<void> {
  await transaction(ALL_TABLES, async (tx) => {
    await tx.run('DELETE FROM budget_goals');
    await tx.run('DELETE FROM transactions');
    await tx.run('DELETE FROM categories');
    await tx.run('DELETE FROM diary_entries');
    await tx.run('DELETE FROM important_notes');
    await tx.run('DELETE FROM reminders');
    await tx.run('DELETE FROM mood_entries');
    await tx.run('DELETE FROM app_settings');
    await tx.run(`DELETE FROM sqlite_sequence WHERE name IN ('categories','budget_goals')`).catch(() => undefined);
  });
  await seedDefaults();
}


import { query, transaction } from '../db/database';
import { LATEST_SCHEMA_VERSION } from '../db/migrations';
import { isValidDateStr, isValidTimeStr, nowIso } from '../lib/dates';
import { MAX_AMOUNT_KURUS } from '../lib/money';
import { buildSearchText } from '../lib/text';
import { ALL_TABLES } from '../state/dataEvents';
import { DEFAULT_SETTINGS, USER_SETTING_KEYS, type AppSettings } from './settings';

// Format id kept from the first release so earlier backups stay importable.
export const BACKUP_FORMAT = 'personal-hub-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupCategory {
  id: number;
  name: string;
  kind: 'expense' | 'income';
  color: string;
  icon: string;
  is_system: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
export interface BackupTransaction {
  id: string;
  type: 'opening' | 'income' | 'expense';
  amount_kurus: number;
  title: string;
  category_id: number | null;
  date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export interface BackupDiary {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}
export interface BackupNote {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}
export interface BackupReminder {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  completed: number;
  completed_at: string | null;
  notification_id: number;
  created_at: string;
  updated_at: string;
}
export interface BackupMood {
  date: string;
  mood: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}
export interface BackupBudget {
  id: number;
  category_id: number | null;
  amount_kurus: number;
  created_at: string;
  updated_at: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: {
    categories: BackupCategory[];
    transactions: BackupTransaction[];
    diary_entries: BackupDiary[];
    important_notes: BackupNote[];
    reminders: BackupReminder[];
    mood_entries: BackupMood[];
    budget_goals: BackupBudget[];
    settings: Partial<AppSettings>;
  };
}

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export async function buildBackup(): Promise<BackupFile> {
  const [categories, transactions, diary, notes, reminders, moods, budgets, settingsRows] = await Promise.all([
    query<BackupCategory>(`SELECT id, name, kind, color, icon, is_system, sort_order, created_at, updated_at FROM categories ORDER BY id`),
    query<BackupTransaction>(`SELECT id, type, amount_kurus, title, category_id, date, description, created_at, updated_at FROM transactions ORDER BY date, created_at`),
    query<Omit<BackupDiary, 'tags'> & { tags: string }>(`SELECT id, date, title, content, tags, created_at, updated_at FROM diary_entries ORDER BY date, created_at`),
    query<BackupNote>(`SELECT id, title, content, category, pinned, created_at, updated_at FROM important_notes ORDER BY created_at`),
    query<BackupReminder>(`SELECT id, title, description, due_date, due_time, completed, completed_at, notification_id, created_at, updated_at FROM reminders ORDER BY due_date`),
    query<BackupMood>(`SELECT date, mood, note, created_at, updated_at FROM mood_entries ORDER BY date`),
    query<BackupBudget>(`SELECT id, category_id, amount_kurus, created_at, updated_at FROM budget_goals ORDER BY id`),
    query<{ key: string; value: string }>(`SELECT key, value FROM app_settings`),
  ]);
  const settings: Partial<AppSettings> = {};
  for (const r of settingsRows) {
    if ((USER_SETTING_KEYS as string[]).includes(r.key)) {
      try {
        (settings as Record<string, unknown>)[r.key] = JSON.parse(r.value);
      } catch {
        /* skip */
      }
    }
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: LATEST_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowIso(),
    data: {
      categories,
      transactions,
      diary_entries: diary.map((d) => {
        let tags: string[] = [];
        try {
          tags = JSON.parse(d.tags);
        } catch {
          /* ignore */
        }
        return { ...d, tags: Array.isArray(tags) ? tags : [] };
      }),
      important_notes: notes,
      reminders,
      mood_entries: moods,
      budget_goals: budgets,
      settings,
    },
  };
}

// ---------------- Validation ----------------

class V {
  errors: string[] = [];
  constructor(private ctx: string) {}
  private fail(field: string, msg: string) {
    if (this.errors.length < 20) this.errors.push(`${this.ctx}.${field}: ${msg}`);
  }
  str(o: Record<string, unknown>, f: string, opts: { max?: number; nonEmpty?: boolean; nullable?: boolean } = {}): string | null {
    const v = o[f];
    if (v === null || v === undefined) {
      if (opts.nullable) return null;
      if (!opts.nonEmpty) return '';
      this.fail(f, 'eksik');
      return '';
    }
    if (typeof v !== 'string') return this.fail(f, 'metin olmalı'), '';
    if (opts.nonEmpty && !v.trim()) this.fail(f, 'boş olamaz');
    if (v.length > (opts.max ?? 200_000)) this.fail(f, 'çok uzun');
    return v;
  }
  int(o: Record<string, unknown>, f: string, min: number, max: number, nullable = false): number | null {
    const v = o[f];
    if ((v === null || v === undefined) && nullable) return null;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) return this.fail(f, `${min}-${max} arası tam sayı olmalı`), min;
    return v;
  }
  date(o: Record<string, unknown>, f: string): string {
    const v = o[f];
    if (!isValidDateStr(v)) return this.fail(f, 'geçersiz tarih (YYYY-AA-GG)'), '2000-01-01';
    return v;
  }
  ts(o: Record<string, unknown>, f: string): string {
    const v = o[f];
    if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return this.fail(f, 'geçersiz zaman damgası'), nowIso();
    return v;
  }
  oneOf<T extends string>(o: Record<string, unknown>, f: string, vals: readonly T[]): T {
    const v = o[f];
    if (!vals.includes(v as T)) return this.fail(f, `şunlardan biri olmalı: ${vals.join(', ')}`), vals[0];
    return v as T;
  }
}

function arr(data: Record<string, unknown>, key: string, errors: string[]): Record<string, unknown>[] {
  const v = data[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'object' || x === null || Array.isArray(x))) {
    errors.push(`${key}: liste olmalı`);
    return [];
  }
  return v as Record<string, unknown>[];
}

const MAX_RECORDS = 500_000;

/**
 * Validates an untrusted, parsed JSON value. Returns a clean BackupFile or throws
 * an Error describing the first problems found. Nothing is written to the database here.
 */
export function validateBackup(input: unknown): BackupFile {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) throw new Error('Dosya geçerli bir Koros Günce yedeği değil.');
  const root = input as Record<string, unknown>;
  if (root.format !== BACKUP_FORMAT) throw new Error('Dosya geçerli bir Koros Günce yedeği değil.');
  if (typeof root.formatVersion !== 'number' || root.formatVersion > BACKUP_FORMAT_VERSION)
    throw new Error('Bu yedek, uygulamanın daha yeni bir sürümüyle oluşturulmuş. Lütfen uygulamayı güncelleyin.');
  if (typeof root.data !== 'object' || root.data === null) throw new Error('Yedek dosyasında veri bölümü yok.');
  const data = root.data as Record<string, unknown>;

  const total = ['categories', 'transactions', 'diary_entries', 'important_notes', 'reminders', 'mood_entries', 'budget_goals'].reduce(
    (n, k) => n + (Array.isArray(data[k]) ? (data[k] as unknown[]).length : 0),
    0,
  );
  if (total > MAX_RECORDS) throw new Error('Yedek dosyası çok büyük.');

  const categories: BackupCategory[] = arr(data, 'categories', errors).map((o, i) => {
    const v = new V(`categories[${i}]`);
    const c: BackupCategory = {
      id: v.int(o, 'id', 1, 2_147_483_647)!,
      name: v.str(o, 'name', { nonEmpty: true, max: 40 })!.trim(),
      kind: v.oneOf(o, 'kind', ['expense', 'income'] as const),
      color: /^#[0-9a-fA-F]{6}$/.test(String(o.color)) ? String(o.color) : '#8B92A0',
      icon: typeof o.icon === 'string' && o.icon.length <= 40 ? o.icon : 'tag',
      is_system: o.is_system ? 1 : 0,
      sort_order: typeof o.sort_order === 'number' && Number.isSafeInteger(o.sort_order) ? o.sort_order : 0,
      created_at: v.ts(o, 'created_at'),
      updated_at: v.ts(o, 'updated_at'),
    };
    errors.push(...v.errors);
    return c;
  });
  const catKind = new Map(categories.map((c) => [c.id, c.kind]));
  if (catKind.size !== categories.length) errors.push('categories: tekrarlanan id');
  const nameKeys = new Set<string>();
  for (const c of categories) {
    const k = `${c.kind}:${c.name.toLocaleLowerCase('tr-TR')}`;
    if (nameKeys.has(k)) errors.push(`categories: tekrarlanan isim "${c.name}"`);
    nameKeys.add(k);
  }

  const txIds = new Set<string>();
  let openingCount = 0;
  const transactions: BackupTransaction[] = arr(data, 'transactions', errors).map((o, i) => {
    const v = new V(`transactions[${i}]`);
    const type = v.oneOf(o, 'type', ['opening', 'income', 'expense'] as const);
    const t: BackupTransaction = {
      id: v.str(o, 'id', { nonEmpty: true, max: 64 })!,
      type,
      amount_kurus: v.int(o, 'amount_kurus', type === 'opening' ? 0 : 1, MAX_AMOUNT_KURUS)!,
      title: v.str(o, 'title', { nonEmpty: true, max: 120 })!,
      category_id: v.int(o, 'category_id', 1, 2_147_483_647, true),
      date: v.date(o, 'date'),
      description: v.str(o, 'description', { nullable: true, max: 1000 }),
      created_at: v.ts(o, 'created_at'),
      updated_at: v.ts(o, 'updated_at'),
    };
    if (type === 'opening') {
      openingCount++;
      t.category_id = null;
    } else if (t.category_id === null) {
      v.errors.push(`transactions[${i}].category_id: eksik`);
    } else if (catKind.get(t.category_id) !== type) {
      v.errors.push(`transactions[${i}].category_id: kategori bulunamadı veya türü uyumsuz`);
    }
    if (txIds.has(t.id)) v.errors.push(`transactions[${i}].id: tekrarlanan id`);
    txIds.add(t.id);
    errors.push(...v.errors);
    return t;
  });
  if (openingCount > 1) errors.push('transactions: birden fazla başlangıç bakiyesi');

  const diaryIds = new Set<string>();
  const diary_entries: BackupDiary[] = arr(data, 'diary_entries', errors).map((o, i) => {
    const v = new V(`diary_entries[${i}]`);
    const d: BackupDiary = {
      id: v.str(o, 'id', { nonEmpty: true, max: 64 })!,
      date: v.date(o, 'date'),
      title: v.str(o, 'title', { max: 200 })!,
      content: v.str(o, 'content')!,
      tags: Array.isArray(o.tags) ? (o.tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 10).map((t) => t.slice(0, 30)) : [],
      created_at: v.ts(o, 'created_at'),
      updated_at: v.ts(o, 'updated_at'),
    };
    if (diaryIds.has(d.id)) v.errors.push(`diary_entries[${i}].id: tekrarlanan id`);
    diaryIds.add(d.id);
    errors.push(...v.errors);
    return d;
  });

  const noteIds = new Set<string>();
  const important_notes: BackupNote[] = arr(data, 'important_notes', errors).map((o, i) => {
    const v = new V(`important_notes[${i}]`);
    const n: BackupNote = {
      id: v.str(o, 'id', { nonEmpty: true, max: 64 })!,
      title: v.str(o, 'title', { max: 200 })!,
      content: v.str(o, 'content')!,
      category: v.str(o, 'category', { max: 40 })!,
      pinned: o.pinned ? 1 : 0,
      created_at: v.ts(o, 'created_at'),
      updated_at: v.ts(o, 'updated_at'),
    };
    if (noteIds.has(n.id)) v.errors.push(`important_notes[${i}].id: tekrarlanan id`);
    noteIds.add(n.id);
    errors.push(...v.errors);
    return n;
  });

  const remIds = new Set<string>();
  const notifIds = new Set<number>();
  const reminders: BackupReminder[] = arr(data, 'reminders', errors).map((o, i) => {
    const v = new V(`reminders[${i}]`);
    const time = o.due_time === null || o.due_time === undefined || o.due_time === '' ? null : o.due_time;
    const r: BackupReminder = {
      id: v.str(o, 'id', { nonEmpty: true, max: 64 })!,
      title: v.str(o, 'title', { nonEmpty: true, max: 200 })!,
      description: v.str(o, 'description', { nullable: true, max: 2000 }),
      due_date: v.date(o, 'due_date'),
      due_time: time === null ? null : isValidTimeStr(time) ? time : (v.errors.push(`reminders[${i}].due_time: geçersiz saat`), null),
      completed: o.completed ? 1 : 0,
      completed_at: typeof o.completed_at === 'string' ? o.completed_at : null,
      notification_id: v.int(o, 'notification_id', 1, 2_147_483_647)!,
      created_at: v.ts(o, 'created_at'),
      updated_at: v.ts(o, 'updated_at'),
    };
    if (remIds.has(r.id)) v.errors.push(`reminders[${i}].id: tekrarlanan id`);
    if (notifIds.has(r.notification_id)) v.errors.push(`reminders[${i}].notification_id: tekrarlanan`);
    remIds.add(r.id);
    notifIds.add(r.notification_id);
    errors.push(...v.errors);
    return r;
  });

  const moodDates = new Set<string>();
  const mood_entries: BackupMood[] = arr(data, 'mood_entries', errors).map((o, i) => {
    const v = new V(`mood_entries[${i}]`);
    const m: BackupMood = {
      date: v.date(o, 'date'),
      mood: v.int(o, 'mood', 1, 5)!,
      note: v.str(o, 'note', { nullable: true, max: 500 }),
      created_at: v.ts(o, 'created_at'),
      updated_at: v.ts(o, 'updated_at'),
    };
    if (moodDates.has(m.date)) v.errors.push(`mood_entries[${i}].date: aynı gün için birden fazla kayıt`);
    moodDates.add(m.date);
    errors.push(...v.errors);
    return m;
  });

  const budgetCats = new Set<string>();
  const budget_goals: BackupBudget[] = arr(data, 'budget_goals', errors).map((o, i) => {
    const v = new V(`budget_goals[${i}]`);
    const b: BackupBudget = {
      id: v.int(o, 'id', 1, 2_147_483_647)!,
      category_id: v.int(o, 'category_id', 1, 2_147_483_647, true),
      amount_kurus: v.int(o, 'amount_kurus', 1, MAX_AMOUNT_KURUS)!,
      created_at: v.ts(o, 'created_at'),
      updated_at: v.ts(o, 'updated_at'),
    };
    if (b.category_id !== null && catKind.get(b.category_id) !== 'expense') v.errors.push(`budget_goals[${i}].category_id: gider kategorisi bulunamadı`);
    const key = String(b.category_id);
    if (budgetCats.has(key)) v.errors.push(`budget_goals[${i}]: aynı kategori için birden fazla limit`);
    budgetCats.add(key);
    errors.push(...v.errors);
    return b;
  });

  const settings: Partial<AppSettings> = {};
  if (typeof data.settings === 'object' && data.settings !== null) {
    const s = data.settings as Record<string, unknown>;
    for (const k of USER_SETTING_KEYS) {
      if (s[k] !== undefined && typeof s[k] === typeof DEFAULT_SETTINGS[k]) (settings as Record<string, unknown>)[k] = s[k];
    }
  }

  if (errors.length) {
    throw new Error(`Yedek dosyası doğrulanamadı:\n${errors.slice(0, 8).join('\n')}${errors.length > 8 ? `\n… ve ${errors.length - 8} hata daha` : ''}`);
  }

  return {
    format: BACKUP_FORMAT,
    formatVersion: root.formatVersion as number,
    schemaVersion: typeof root.schemaVersion === 'number' ? root.schemaVersion : 1,
    appVersion: typeof root.appVersion === 'string' ? root.appVersion : '',
    exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : '',
    data: { categories, transactions, diary_entries, important_notes, reminders, mood_entries, budget_goals, settings },
  };
}

export function summarizeBackup(b: BackupFile) {
  return {
    transactions: b.data.transactions.filter((t) => t.type !== 'opening').length,
    diary: b.data.diary_entries.length,
    notes: b.data.important_notes.length,
    reminders: b.data.reminders.length,
    moods: b.data.mood_entries.length,
    categories: b.data.categories.length,
    budgets: b.data.budget_goals.length,
  };
}

/**
 * Replaces all data with the backup contents in ONE transaction.
 * If any insert fails, everything is rolled back and the current data stays intact.
 */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const d = b.data;
  await transaction(ALL_TABLES, async (tx) => {
    for (const t of ['budget_goals', 'transactions', 'categories', 'diary_entries', 'important_notes', 'reminders', 'mood_entries', 'app_settings']) {
      await tx.run(`DELETE FROM ${t}`);
    }
    for (const c of d.categories) {
      await tx.run(
        `INSERT INTO categories (id, name, kind, color, icon, is_system, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.kind, c.color, c.icon, c.is_system, c.sort_order, c.created_at, c.updated_at],
      );
    }
    // Guarantee a non-deletable fallback category for each kind.
    const now = nowIso();
    for (const [kind, name] of [
      ['expense', 'Diğer'],
      ['income', 'Diğer Gelir'],
    ] as const) {
      const sys = await tx.query(`SELECT id FROM categories WHERE kind = ? AND is_system = 1`, [kind]);
      if (!sys.length) {
        const byName = await tx.query<{ id: number }>(`SELECT id FROM categories WHERE kind = ? AND name = ? COLLATE NOCASE`, [kind, name]);
        if (byName.length) await tx.run(`UPDATE categories SET is_system = 1 WHERE id = ?`, [byName[0].id]);
        else
          await tx.run(
            `INSERT INTO categories (name, kind, color, icon, is_system, sort_order, created_at, updated_at) VALUES (?, ?, '#8B92A0', 'tag', 1, 999, ?, ?)`,
            [name, kind, now, now],
          );
      }
    }
    for (const t of d.transactions) {
      await tx.run(
        `INSERT INTO transactions (id, type, amount_kurus, title, category_id, date, description, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.type, t.amount_kurus, t.title, t.category_id, t.date, t.description, t.type === 'opening' ? '' : buildSearchText(t.title, t.description), t.created_at, t.updated_at],
      );
    }
    for (const e of d.diary_entries) {
      await tx.run(
        `INSERT INTO diary_entries (id, date, title, content, tags, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.id, e.date, e.title, e.content, JSON.stringify(e.tags), buildSearchText(e.title, e.content, e.tags.join(' ')), e.created_at, e.updated_at],
      );
    }
    for (const n of d.important_notes) {
      await tx.run(
        `INSERT INTO important_notes (id, title, content, category, pinned, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [n.id, n.title, n.content, n.category, n.pinned, buildSearchText(n.title, n.content, n.category), n.created_at, n.updated_at],
      );
    }
    for (const r of d.reminders) {
      await tx.run(
        `INSERT INTO reminders (id, title, description, due_date, due_time, completed, completed_at, notification_id, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.title, r.description, r.due_date, r.due_time, r.completed, r.completed_at, r.notification_id, buildSearchText(r.title, r.description), r.created_at, r.updated_at],
      );
    }
    for (const m of d.mood_entries) {
      await tx.run(`INSERT INTO mood_entries (date, mood, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [m.date, m.mood, m.note, m.created_at, m.updated_at]);
    }
    for (const g of d.budget_goals) {
      await tx.run(`INSERT INTO budget_goals (id, category_id, amount_kurus, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [
        g.id,
        g.category_id,
        g.amount_kurus,
        g.created_at,
        g.updated_at,
      ]);
    }
    await tx.run(`INSERT INTO app_settings (key, value) VALUES ('seeded', '1')`);
    for (const [k, v] of Object.entries(d.settings)) {
      if (k === 'onboarded') continue;
      await tx.run(`INSERT INTO app_settings (key, value) VALUES (?, ?)`, [k, JSON.stringify(v)]);
    }
    // Restored data is a set-up app: never show the welcome screen again (it would overwrite the opening balance).
    await tx.run(`INSERT INTO app_settings (key, value) VALUES ('onboarded', 'true')`);
  });
}

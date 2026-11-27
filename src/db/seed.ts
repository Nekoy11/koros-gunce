import { nowIso } from '../lib/dates';
import { queryOne, transaction } from './database';

export interface DefaultCategory {
  name: string;
  kind: 'expense' | 'income';
  color: string;
  icon: string;
  system?: boolean;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Yiyecek ve İçecek', kind: 'expense', color: '#F59E0B', icon: 'utensils' },
  { name: 'Ulaşım', kind: 'expense', color: '#3B82F6', icon: 'bus' },
  { name: 'Giyim', kind: 'expense', color: '#EC4899', icon: 'shirt' },
  { name: 'Eğitim', kind: 'expense', color: '#8B5CF6', icon: 'graduation-cap' },
  { name: 'Spor', kind: 'expense', color: '#10B981', icon: 'dumbbell' },
  { name: 'Eğlence', kind: 'expense', color: '#F97316', icon: 'gamepad' },
  { name: 'Teknoloji', kind: 'expense', color: '#06B6D4', icon: 'laptop' },
  { name: 'Sağlık', kind: 'expense', color: '#EF4444', icon: 'heart-pulse' },
  { name: 'Kişisel Bakım', kind: 'expense', color: '#A78BFA', icon: 'sparkles' },
  { name: 'Diğer', kind: 'expense', color: '#8B92A0', icon: 'tag', system: true },
  { name: 'Harçlık', kind: 'income', color: '#22C55E', icon: 'hand-coins' },
  { name: 'Maaş', kind: 'income', color: '#14B8A6', icon: 'briefcase' },
  { name: 'Hediye', kind: 'income', color: '#F472B6', icon: 'gift' },
  { name: 'Satış', kind: 'income', color: '#60A5FA', icon: 'shopping-bag' },
  { name: 'Diğer Gelir', kind: 'income', color: '#8B92A0', icon: 'tag', system: true },
];

/** Inserts default categories once (on first run). */
export async function seedDefaults(): Promise<void> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'seeded'`);
  if (row) return;
  const now = nowIso();
  await transaction(['categories', 'app_settings'], async (tx) => {
    let order = 0;
    for (const c of DEFAULT_CATEGORIES) {
      await tx.run(
        `INSERT OR IGNORE INTO categories (name, kind, color, icon, is_system, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.name, c.kind, c.color, c.icon, c.system ? 1 : 0, order++, now, now],
      );
    }
    await tx.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seeded', '1')`);
  });
}

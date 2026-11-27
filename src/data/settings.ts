import { execute, query, queryOne } from '../db/database';
import type { CurrencyCode } from '../lib/money';

export type ThemeMode = 'dark' | 'light';

export interface AppSettings {
  theme: ThemeMode;
  currency: CurrencyCode;
  notificationsEnabled: boolean;
  onboarded: boolean;
  budgetWarnPercent: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  currency: 'TRY',
  notificationsEnabled: true,
  onboarded: false,
  budgetWarnPercent: 80,
};

/** Keys that are exported in backups (internal bookkeeping keys are not). */
export const USER_SETTING_KEYS: (keyof AppSettings)[] = ['theme', 'currency', 'notificationsEnabled', 'onboarded', 'budgetWarnPercent'];

function decode<K extends keyof AppSettings>(key: K, raw: string | undefined): AppSettings[K] {
  const def = DEFAULT_SETTINGS[key];
  if (raw === undefined) return def;
  try {
    const v = JSON.parse(raw);
    if (key === 'theme') return (v === 'light' || v === 'dark' ? v : def) as AppSettings[K];
    if (key === 'currency') return (['TRY', 'USD', 'EUR', 'GBP'].includes(v) ? v : def) as AppSettings[K];
    if (key === 'budgetWarnPercent') return (Number.isInteger(v) && v >= 50 && v <= 100 ? v : def) as AppSettings[K];
    if (typeof v === typeof def) return v;
  } catch {
    /* fall through */
  }
  return def;
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM app_settings`);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_SETTINGS };
  for (const k of USER_SETTING_KEYS) (out as Record<string, unknown>)[k] = decode(k, map.get(k));
  return out;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await execute(['app_settings'], `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [
    key,
    JSON.stringify(value),
  ]);
}

/** Internal counters (not exported). */
export async function getInternal(key: string): Promise<string | null> {
  const r = await queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = ?`, [key]);
  return r?.value ?? null;
}

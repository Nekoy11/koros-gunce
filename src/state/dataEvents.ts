/**
 * Tiny pub/sub that tells screens when tables changed so they re-query.
 * Keeps every summary, chart and balance in sync after any insert/update/delete.
 */
type Listener = (tables: Set<string>) => void;

const listeners = new Set<Listener>();
let version = 0;

export function emitDataChanged(tables: string[]): void {
  version++;
  const set = new Set(tables);
  for (const l of listeners) l(set);
}

export function subscribeDataChanged(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function dataVersion(): number {
  return version;
}

export const ALL_TABLES = [
  'transactions',
  'categories',
  'diary_entries',
  'important_notes',
  'reminders',
  'mood_entries',
  'budget_goals',
  'app_settings',
];

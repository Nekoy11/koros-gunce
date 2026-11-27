import { query, queryOne, transaction } from '../db/database';
import { isValidDateStr, nowIso, type DateStr } from '../lib/dates';

export interface MoodEntry {
  date: DateStr;
  mood: number; // 1 = çok kötü … 5 = çok iyi
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const MOODS = [
  { value: 5, label: 'Çok iyi', emoji: '😄', color: '#22C55E' },
  { value: 4, label: 'İyi', emoji: '🙂', color: '#84CC16' },
  { value: 3, label: 'Normal', emoji: '😐', color: '#EAB308' },
  { value: 2, label: 'Kötü', emoji: '🙁', color: '#F97316' },
  { value: 1, label: 'Çok kötü', emoji: '😞', color: '#EF4444' },
] as const;

export function moodInfo(value: number) {
  return MOODS.find((m) => m.value === value) ?? MOODS[2];
}

const TABLES = ['mood_entries'];

export async function setMood(date: DateStr, mood: number, note?: string | null): Promise<void> {
  if (!isValidDateStr(date)) throw new Error('Geçerli bir tarih seçin.');
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) throw new Error('Geçersiz ruh hâli.');
  const n = note?.trim().slice(0, 500) || null;
  const now = nowIso();
  await transaction(TABLES, (tx) =>
    tx.run(
      `INSERT INTO mood_entries (date, mood, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, note = excluded.note, updated_at = excluded.updated_at`,
      [date, mood, n, now, now],
    ),
  );
}

export async function deleteMood(date: DateStr): Promise<void> {
  await transaction(TABLES, (tx) => tx.run(`DELETE FROM mood_entries WHERE date = ?`, [date]));
}

export async function getMood(date: DateStr): Promise<MoodEntry | null> {
  return queryOne<MoodEntry>(`SELECT * FROM mood_entries WHERE date = ?`, [date]);
}

export async function listMoods(from: DateStr, to: DateStr): Promise<MoodEntry[]> {
  return query<MoodEntry>(`SELECT * FROM mood_entries WHERE date BETWEEN ? AND ? ORDER BY date`, [from, to]);
}

export async function getMoodDistribution(from: DateStr, to: DateStr): Promise<{ mood: number; n: number }[]> {
  const rows = await query<{ mood: number; n: number }>(
    `SELECT mood, COUNT(*) AS n FROM mood_entries WHERE date BETWEEN ? AND ? GROUP BY mood ORDER BY mood DESC`,
    [from, to],
  );
  return rows.map((r) => ({ mood: Number(r.mood), n: Number(r.n) }));
}

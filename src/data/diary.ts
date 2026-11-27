import { query, queryOne, transaction } from '../db/database';
import { isValidDateStr, nowIso, type DateStr } from '../lib/dates';
import { buildSearchText, likePattern, normalizeSearch } from '../lib/text';

export interface DiaryEntry {
  id: string;
  date: DateStr;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface DiaryRow extends Omit<DiaryEntry, 'tags'> {
  tags: string;
}

export interface DiaryInput {
  date: DateStr;
  title: string;
  content: string;
  tags: string[];
}

const TABLES = ['diary_entries'];
export const MAX_DIARY_LENGTH = 200_000;

function toEntry(r: DiaryRow): DiaryEntry {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(r.tags);
    if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === 'string');
  } catch {
    /* ignore malformed tags */
  }
  return { ...r, tags };
}

function validate(input: DiaryInput): DiaryInput {
  if (!isValidDateStr(input.date)) throw new Error('Geçerli bir tarih seçin.');
  if (input.title.length > 200) throw new Error('Başlık en fazla 200 karakter olabilir.');
  if (input.content.length > MAX_DIARY_LENGTH) throw new Error('Metin çok uzun.');
  return { ...input, title: input.title.trim() };
}

/**
 * Insert-or-update by id. Used by the autosave editor: the first save creates the row,
 * later saves update it, so rapid saves are always idempotent.
 */
export async function saveDiaryEntry(id: string, input: DiaryInput): Promise<void> {
  const v = validate(input);
  const now = nowIso();
  const search = buildSearchText(v.title, v.content, v.tags.join(' '));
  await transaction(TABLES, (tx) =>
    tx.run(
      `INSERT INTO diary_entries (id, date, title, content, tags, search_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET date = excluded.date, title = excluded.title, content = excluded.content,
         tags = excluded.tags, search_text = excluded.search_text, updated_at = excluded.updated_at`,
      [id, v.date, v.title, v.content, JSON.stringify(v.tags), search, now, now],
    ),
  );
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  await transaction(TABLES, (tx) => tx.run(`DELETE FROM diary_entries WHERE id = ?`, [id]));
}

export async function getDiaryEntry(id: string): Promise<DiaryEntry | null> {
  const r = await queryOne<DiaryRow>(`SELECT * FROM diary_entries WHERE id = ?`, [id]);
  return r ? toEntry(r) : null;
}

export async function listDiaryEntries(opts: { search?: string; date?: DateStr; order?: 'desc' | 'asc'; limit?: number } = {}): Promise<DiaryEntry[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.date) (where.push('date = ?'), params.push(opts.date));
  const term = normalizeSearch(opts.search ?? '').trim();
  if (term) (where.push(`search_text LIKE ? ESCAPE '\\'`), params.push(likePattern(term)));
  const dir = opts.order === 'asc' ? 'ASC' : 'DESC';
  params.push(opts.limit ?? 500);
  const rows = await query<DiaryRow>(
    `SELECT * FROM diary_entries ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date ${dir}, created_at ${dir} LIMIT ?`,
    params,
  );
  return rows.map(toEntry);
}

export async function getDiaryDates(from: DateStr, to: DateStr): Promise<{ date: string; n: number }[]> {
  return query(`SELECT date, COUNT(*) AS n FROM diary_entries WHERE date BETWEEN ? AND ? GROUP BY date`, [from, to]);
}

export async function countDiaryEntries(): Promise<number> {
  const r = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM diary_entries`);
  return Number(r?.n ?? 0);
}

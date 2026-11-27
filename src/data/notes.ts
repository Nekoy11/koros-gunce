import { query, queryOne, transaction } from '../db/database';
import { nowIso } from '../lib/dates';
import { buildSearchText, likePattern, normalizeSearch } from '../lib/text';

export interface ImportantNote {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  title: string;
  content: string;
  category: string;
}

const TABLES = ['important_notes'];

export const NOTE_CATEGORY_SUGGESTIONS = ['Fikir', 'Hedef', 'Bilgi', 'Proje', 'Kişisel'];

export async function saveNote(id: string, input: NoteInput): Promise<void> {
  const title = input.title.trim();
  const category = input.category.trim().slice(0, 40);
  if (title.length > 200) throw new Error('Başlık en fazla 200 karakter olabilir.');
  if (input.content.length > 200_000) throw new Error('Metin çok uzun.');
  const now = nowIso();
  await transaction(TABLES, (tx) =>
    tx.run(
      `INSERT INTO important_notes (id, title, content, category, pinned, search_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, category = excluded.category,
         search_text = excluded.search_text, updated_at = excluded.updated_at`,
      [id, title, input.content, category, buildSearchText(title, input.content, category), now, now],
    ),
  );
}

export async function setNotePinned(id: string, pinned: boolean): Promise<void> {
  await transaction(TABLES, (tx) => tx.run(`UPDATE important_notes SET pinned = ? WHERE id = ?`, [pinned ? 1 : 0, id]));
}

export async function deleteNote(id: string): Promise<void> {
  await transaction(TABLES, (tx) => tx.run(`DELETE FROM important_notes WHERE id = ?`, [id]));
}

export async function getNote(id: string): Promise<ImportantNote | null> {
  return queryOne<ImportantNote>(`SELECT * FROM important_notes WHERE id = ?`, [id]);
}

export async function listNotes(opts: { search?: string; category?: string; limit?: number } = {}): Promise<ImportantNote[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.category) (where.push('category = ?'), params.push(opts.category));
  const term = normalizeSearch(opts.search ?? '').trim();
  if (term) (where.push(`search_text LIKE ? ESCAPE '\\'`), params.push(likePattern(term)));
  params.push(opts.limit ?? 500);
  return query<ImportantNote>(
    `SELECT * FROM important_notes ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
    params,
  );
}

export async function listNoteCategories(): Promise<string[]> {
  const rows = await query<{ category: string }>(`SELECT DISTINCT category FROM important_notes WHERE category <> '' ORDER BY category`);
  return rows.map((r) => r.category);
}

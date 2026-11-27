import { query } from '../db/database';
import { likePattern, normalizeSearch, snippet } from '../lib/text';

export type SearchKind = 'expense' | 'income' | 'diary' | 'note' | 'reminder';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  date: string; // YYYY-MM-DD or ISO timestamp
  snippet: string;
  amountKurus?: number;
}

/** Global, Turkish-aware search over all user content. */
export async function searchAll(raw: string, limitPerKind = 30): Promise<SearchResult[]> {
  const term = normalizeSearch(raw).trim();
  if (term.length < 1) return [];
  const p = likePattern(term);
  const L = limitPerKind;

  const [tx, diary, notes, rem] = await Promise.all([
    query<{ id: string; type: 'income' | 'expense'; title: string; date: string; description: string | null; amount_kurus: number; category: string | null }>(
      `SELECT t.id, t.type, t.title, t.date, t.description, t.amount_kurus, c.name AS category
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.type <> 'opening' AND t.search_text LIKE ? ESCAPE '\\' ORDER BY t.date DESC LIMIT ?`,
      [p, L],
    ),
    query<{ id: string; title: string; content: string; date: string }>(
      `SELECT id, title, content, date FROM diary_entries WHERE search_text LIKE ? ESCAPE '\\' ORDER BY date DESC LIMIT ?`,
      [p, L],
    ),
    query<{ id: string; title: string; content: string; updated_at: string }>(
      `SELECT id, title, content, updated_at FROM important_notes WHERE search_text LIKE ? ESCAPE '\\' ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
      [p, L],
    ),
    query<{ id: string; title: string; description: string | null; due_date: string }>(
      `SELECT id, title, description, due_date FROM reminders WHERE search_text LIKE ? ESCAPE '\\' ORDER BY due_date DESC LIMIT ?`,
      [p, L],
    ),
  ]);

  return [
    ...tx.map((r) => ({
      kind: r.type,
      id: r.id,
      title: r.title,
      date: r.date,
      snippet: [r.category, r.description ? snippet(r.description, raw, 80) : null].filter(Boolean).join(' · '),
      amountKurus: Number(r.amount_kurus),
    })),
    ...diary.map((r) => ({ kind: 'diary' as const, id: r.id, title: r.title || 'Başlıksız kayıt', date: r.date, snippet: snippet(r.content, raw) })),
    ...notes.map((r) => ({ kind: 'note' as const, id: r.id, title: r.title || 'Başlıksız not', date: r.updated_at, snippet: snippet(r.content, raw) })),
    ...rem.map((r) => ({ kind: 'reminder' as const, id: r.id, title: r.title, date: r.due_date, snippet: r.description ? snippet(r.description, raw) : '' })),
  ];
}

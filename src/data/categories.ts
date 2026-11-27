import { query, queryOne, transaction } from '../db/database';
import { nowIso } from '../lib/dates';

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  is_system: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_COLORS = ['#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#10B981', '#F97316', '#06B6D4', '#EF4444', '#A78BFA', '#22C55E', '#14B8A6', '#F472B6', '#60A5FA', '#8B92A0'];

export async function listCategories(kind?: CategoryKind): Promise<Category[]> {
  return kind
    ? query<Category>(`SELECT * FROM categories WHERE kind = ? ORDER BY is_system, sort_order, name`, [kind])
    : query<Category>(`SELECT * FROM categories ORDER BY kind, is_system, sort_order, name`);
}

export async function getCategory(id: number): Promise<Category | null> {
  return queryOne<Category>(`SELECT * FROM categories WHERE id = ?`, [id]);
}

/** The non-deletable fallback category ("Diğer" / "Diğer Gelir") of a kind. */
export async function getFallbackCategory(kind: CategoryKind): Promise<Category> {
  const c = await queryOne<Category>(`SELECT * FROM categories WHERE kind = ? AND is_system = 1 ORDER BY id LIMIT 1`, [kind]);
  if (!c) throw new Error('Varsayılan kategori bulunamadı.');
  return c;
}

function validateName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new Error('Kategori adı boş olamaz.');
  if (n.length > 40) throw new Error('Kategori adı en fazla 40 karakter olabilir.');
  return n;
}

export async function createCategory(input: { name: string; kind: CategoryKind; color: string; icon?: string }): Promise<number> {
  const name = validateName(input.name);
  const now = nowIso();
  return transaction(['categories'], async (tx) => {
    const dup = await tx.query(`SELECT id FROM categories WHERE kind = ? AND name = ? COLLATE NOCASE`, [input.kind, name]);
    if (dup.length) throw new Error('Bu isimde bir kategori zaten var.');
    const max = await tx.query<{ m: number | null }>(`SELECT MAX(sort_order) AS m FROM categories WHERE kind = ?`, [input.kind]);
    await tx.run(
      `INSERT INTO categories (name, kind, color, icon, is_system, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [name, input.kind, input.color, input.icon ?? 'tag', (max[0]?.m ?? 0) + 1, now, now],
    );
    const row = await tx.query<{ id: number }>(`SELECT id FROM categories WHERE kind = ? AND name = ? COLLATE NOCASE`, [input.kind, name]);
    return row[0].id;
  });
}

export async function updateCategory(id: number, input: { name: string; color: string }): Promise<void> {
  const name = validateName(input.name);
  await transaction(['categories'], async (tx) => {
    const cur = await tx.query<Category>(`SELECT * FROM categories WHERE id = ?`, [id]);
    if (!cur[0]) throw new Error('Kategori bulunamadı.');
    const dup = await tx.query(`SELECT id FROM categories WHERE kind = ? AND name = ? COLLATE NOCASE AND id <> ?`, [cur[0].kind, name, id]);
    if (dup.length) throw new Error('Bu isimde bir kategori zaten var.');
    await tx.run(`UPDATE categories SET name = ?, color = ?, updated_at = ? WHERE id = ?`, [name, input.color, nowIso(), id]);
  });
}

export async function countCategoryUsage(id: number): Promise<number> {
  const r = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?`, [id]);
  return Number(r?.n ?? 0);
}

/**
 * Deletes a user category. Its transactions are moved to the fallback category
 * of the same kind so no financial record is lost. Its budget goal is removed.
 */
export async function deleteCategory(id: number): Promise<void> {
  await transaction(['categories', 'transactions', 'budget_goals'], async (tx) => {
    const cur = await tx.query<Category>(`SELECT * FROM categories WHERE id = ?`, [id]);
    const cat = cur[0];
    if (!cat) return;
    if (cat.is_system) throw new Error('Varsayılan "Diğer" kategorisi silinemez.');
    const fb = await tx.query<{ id: number }>(`SELECT id FROM categories WHERE kind = ? AND is_system = 1 ORDER BY id LIMIT 1`, [cat.kind]);
    if (!fb[0]) throw new Error('Varsayılan kategori bulunamadı.');
    await tx.run(`UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?`, [fb[0].id, nowIso(), id]);
    await tx.run(`DELETE FROM budget_goals WHERE category_id = ?`, [id]);
    await tx.run(`DELETE FROM categories WHERE id = ?`, [id]);
  });
}

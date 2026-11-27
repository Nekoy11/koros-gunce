import { query, transaction } from '../db/database';
import { endOfMonth, nowIso, startOfMonth, todayStr, type DateStr } from '../lib/dates';
import { MAX_AMOUNT_KURUS } from '../lib/money';

export interface BudgetGoal {
  id: number;
  category_id: number | null; // null = overall monthly limit
  amount_kurus: number;
  created_at: string;
  updated_at: string;
}

export type BudgetState = 'ok' | 'warning' | 'over';

export interface BudgetStatus {
  id: number;
  categoryId: number | null;
  name: string;
  color: string;
  limit: number;
  spent: number;
  remaining: number;
  percent: number; // 0..∞ (integer)
  state: BudgetState;
}

const TABLES = ['budget_goals'];

/** Creates or replaces the monthly limit for a category (or the overall limit when categoryId is null). */
export async function setBudget(categoryId: number | null, amountKurus: number): Promise<void> {
  if (!Number.isSafeInteger(amountKurus) || amountKurus <= 0 || amountKurus > MAX_AMOUNT_KURUS) throw new Error('Geçerli bir limit girin.');
  const now = nowIso();
  await transaction(TABLES, async (tx) => {
    const res =
      categoryId === null
        ? await tx.run(`UPDATE budget_goals SET amount_kurus = ?, updated_at = ? WHERE category_id IS NULL`, [amountKurus, now])
        : await tx.run(`UPDATE budget_goals SET amount_kurus = ?, updated_at = ? WHERE category_id = ?`, [amountKurus, now, categoryId]);
    if (res.changes === 0) {
      if (categoryId !== null) {
        const c = await tx.query<{ kind: string }>(`SELECT kind FROM categories WHERE id = ?`, [categoryId]);
        if (c[0]?.kind !== 'expense') throw new Error('Bütçe yalnızca gider kategorileri için belirlenebilir.');
      }
      await tx.run(`INSERT INTO budget_goals (category_id, amount_kurus, created_at, updated_at) VALUES (?, ?, ?, ?)`, [categoryId, amountKurus, now, now]);
    }
  });
}

export async function deleteBudget(id: number): Promise<void> {
  await transaction(TABLES, (tx) => tx.run(`DELETE FROM budget_goals WHERE id = ?`, [id]));
}

export function budgetState(spent: number, limit: number, warnPercent = 80): BudgetState {
  if (spent > limit) return 'over';
  // Integer comparison: spent / limit >= warn% ⇔ spent * 100 >= limit * warn
  if (spent * 100 >= limit * warnPercent) return 'warning';
  return 'ok';
}

/** Budget progress for the month containing `date`. Overall limit is listed first. */
export async function getBudgetStatus(date: DateStr = todayStr(), warnPercent = 80): Promise<BudgetStatus[]> {
  const from = startOfMonth(date);
  const to = endOfMonth(date);
  const rows = await query<{ id: number; category_id: number | null; amount_kurus: number; name: string | null; color: string | null; spent: number }>(
    `SELECT b.id, b.category_id, b.amount_kurus, c.name, c.color,
       COALESCE((SELECT SUM(t.amount_kurus) FROM transactions t
                 WHERE t.type = 'expense' AND t.date BETWEEN ? AND ?
                   AND (b.category_id IS NULL OR t.category_id = b.category_id)), 0) AS spent
     FROM budget_goals b LEFT JOIN categories c ON c.id = b.category_id
     ORDER BY (b.category_id IS NOT NULL), c.sort_order, c.name`,
    [from, to],
  );
  return rows.map((r) => {
    const limit = Number(r.amount_kurus);
    const spent = Number(r.spent);
    return {
      id: r.id,
      categoryId: r.category_id,
      name: r.category_id === null ? 'Aylık toplam' : (r.name ?? 'Kategori'),
      color: r.category_id === null ? '#1EC1CB' : (r.color ?? '#8B92A0'),
      limit,
      spent,
      remaining: limit - spent,
      percent: Math.floor((spent * 100) / limit),
      state: budgetState(spent, limit, warnPercent),
    };
  });
}

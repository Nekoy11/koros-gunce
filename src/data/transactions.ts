import { query, queryOne, transaction, type Tx } from '../db/database';
import type { SqlValue } from '../db/driver';
import { isValidDateStr, nowIso, todayStr, type DateStr } from '../lib/dates';
import { MAX_AMOUNT_KURUS } from '../lib/money';
import { buildSearchText, likePattern, normalizeSearch } from '../lib/text';

export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TxType | 'opening';
  amount_kurus: number;
  title: string;
  category_id: number | null;
  date: DateStr;
  description: string | null;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  category_color: string | null;
}

export interface TxInput {
  type: TxType;
  amountKurus: number;
  title: string;
  categoryId: number;
  date: DateStr;
  description?: string | null;
}

const TABLES = ['transactions'];
const SELECT = `SELECT t.id, t.type, t.amount_kurus, t.title, t.category_id, t.date, t.description, t.created_at, t.updated_at,
  c.name AS category_name, c.color AS category_color
  FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`;

function validate(input: TxInput): Required<TxInput> {
  const title = input.title.trim();
  if (!title) throw new Error('İsim zorunludur.');
  if (title.length > 120) throw new Error('İsim en fazla 120 karakter olabilir.');
  if (!Number.isSafeInteger(input.amountKurus) || input.amountKurus <= 0) throw new Error('Geçerli bir tutar girin.');
  if (input.amountKurus > MAX_AMOUNT_KURUS) throw new Error('Tutar çok büyük.');
  if (input.type !== 'income' && input.type !== 'expense') throw new Error('Geçersiz işlem türü.');
  if (!isValidDateStr(input.date)) throw new Error('Geçerli bir tarih seçin.');
  if (!Number.isInteger(input.categoryId)) throw new Error('Kategori seçin.');
  const description = input.description?.trim() || null;
  if (description && description.length > 1000) throw new Error('Açıklama en fazla 1000 karakter olabilir.');
  return { ...input, title, description };
}

async function assertCategoryKind(tx: Tx, categoryId: number, type: TxType) {
  const rows = await tx.query<{ kind: string }>(`SELECT kind FROM categories WHERE id = ?`, [categoryId]);
  if (!rows[0]) throw new Error('Kategori bulunamadı.');
  if (rows[0].kind !== type) throw new Error('Kategori işlem türüyle uyumlu değil.');
}

/**
 * Inserts a transaction. The caller supplies a client-generated id; a repeated call with
 * the same id (double tap, retry) is ignored, so the same operation is never saved twice.
 */
export async function addTransaction(id: string, input: TxInput): Promise<{ created: boolean }> {
  const v = validate(input);
  const now = nowIso();
  return transaction(TABLES, async (tx) => {
    await assertCategoryKind(tx, v.categoryId, v.type);
    const res = await tx.run(
      `INSERT OR IGNORE INTO transactions (id, type, amount_kurus, title, category_id, date, description, search_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, v.type, v.amountKurus, v.title, v.categoryId, v.date, v.description, buildSearchText(v.title, v.description), now, now],
    );
    return { created: res.changes > 0 };
  });
}

export async function updateTransaction(id: string, input: TxInput): Promise<void> {
  const v = validate(input);
  await transaction(TABLES, async (tx) => {
    await assertCategoryKind(tx, v.categoryId, v.type);
    const res = await tx.run(
      `UPDATE transactions SET type = ?, amount_kurus = ?, title = ?, category_id = ?, date = ?, description = ?, search_text = ?, updated_at = ?
       WHERE id = ? AND type <> 'opening'`,
      [v.type, v.amountKurus, v.title, v.categoryId, v.date, v.description, buildSearchText(v.title, v.description), nowIso(), id],
    );
    if (res.changes === 0) throw new Error('İşlem bulunamadı.');
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  await transaction(TABLES, (tx) => tx.run(`DELETE FROM transactions WHERE id = ? AND type <> 'opening'`, [id]));
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  return queryOne<Transaction>(`${SELECT} WHERE t.id = ?`, [id]);
}

// ---------- Opening balance ----------

export interface Opening {
  amountKurus: number;
  date: DateStr;
}

export async function getOpening(): Promise<Opening | null> {
  const r = await queryOne<{ amount_kurus: number; date: string }>(`SELECT amount_kurus, date FROM transactions WHERE type = 'opening'`);
  return r ? { amountKurus: Number(r.amount_kurus), date: r.date } : null;
}

/**
 * Creates or edits the single opening-balance record. Other transactions are untouched,
 * so the current balance simply shifts by the difference.
 */
export async function setOpening(amountKurus: number, date: DateStr = todayStr()): Promise<void> {
  if (!Number.isSafeInteger(amountKurus) || amountKurus < 0 || amountKurus > MAX_AMOUNT_KURUS) throw new Error('Geçerli bir tutar girin.');
  if (!isValidDateStr(date)) throw new Error('Geçerli bir tarih seçin.');
  const now = nowIso();
  await transaction(TABLES, async (tx) => {
    const res = await tx.run(`UPDATE transactions SET amount_kurus = ?, date = ?, updated_at = ? WHERE type = 'opening'`, [amountKurus, date, now]);
    if (res.changes === 0) {
      await tx.run(
        `INSERT INTO transactions (id, type, amount_kurus, title, category_id, date, description, search_text, created_at, updated_at)
         VALUES ('opening', 'opening', ?, 'Başlangıç bakiyesi', NULL, ?, NULL, '', ?, ?)`,
        [amountKurus, date, now, now],
      );
    }
  });
}

// ---------- Balance ----------

const BALANCE_EXPR = `COALESCE(SUM(CASE WHEN type = 'expense' THEN -amount_kurus ELSE amount_kurus END), 0)`;

/**
 * Current balance = opening + income − expense, counting only transactions dated up to today.
 * Future-dated (planned) entries do not change today's money; see getPlannedTotals.
 */
export async function getBalance(asOf: DateStr = todayStr()): Promise<number> {
  return getBalanceAt(asOf);
}

/** Sum of income/expense dated after `asOf` (planned entries). */
export async function getPlannedTotals(asOf: DateStr = todayStr()): Promise<Totals> {
  const r = await queryOne<{ income: number; expense: number; n: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount_kurus END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_kurus END), 0) AS expense,
            COUNT(*) AS n
     FROM transactions WHERE type <> 'opening' AND date > ?`,
    [asOf],
  );
  return { income: Number(r?.income ?? 0), expense: Number(r?.expense ?? 0), count: Number(r?.n ?? 0) };
}

/** Balance at the end of `date`: opening + all income/expense dated on or before it. */
export async function getBalanceAt(date: DateStr): Promise<number> {
  const r = await queryOne<{ b: number }>(`SELECT ${BALANCE_EXPR} AS b FROM transactions WHERE type = 'opening' OR date <= ?`, [date]);
  return Number(r?.b ?? 0);
}

export interface Totals {
  income: number;
  expense: number;
  count: number;
}

export async function getTotals(from: DateStr, to: DateStr): Promise<Totals> {
  const r = await queryOne<{ income: number; expense: number; n: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount_kurus END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_kurus END), 0) AS expense,
            COUNT(*) AS n
     FROM transactions WHERE type <> 'opening' AND date BETWEEN ? AND ?`,
    [from, to],
  );
  return { income: Number(r?.income ?? 0), expense: Number(r?.expense ?? 0), count: Number(r?.n ?? 0) };
}

export interface DailyTotal {
  date: DateStr;
  income: number;
  expense: number;
}

export async function getDailyTotals(from: DateStr, to: DateStr): Promise<DailyTotal[]> {
  const rows = await query<{ date: string; income: number; expense: number }>(
    `SELECT date,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount_kurus END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_kurus END), 0) AS expense
     FROM transactions WHERE type <> 'opening' AND date BETWEEN ? AND ?
     GROUP BY date ORDER BY date`,
    [from, to],
  );
  return rows.map((r) => ({ date: r.date, income: Number(r.income), expense: Number(r.expense) }));
}

export interface MonthlyTotal {
  month: string; // YYYY-MM
  income: number;
  expense: number;
}

export async function getMonthlyTotals(from: DateStr, to: DateStr): Promise<MonthlyTotal[]> {
  const rows = await query<{ month: string; income: number; expense: number }>(
    `SELECT substr(date, 1, 7) AS month,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount_kurus END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_kurus END), 0) AS expense
     FROM transactions WHERE type <> 'opening' AND date BETWEEN ? AND ?
     GROUP BY month ORDER BY month`,
    [from, to],
  );
  return rows.map((r) => ({ month: r.month, income: Number(r.income), expense: Number(r.expense) }));
}

export interface CategoryTotal {
  category_id: number | null;
  name: string;
  color: string;
  total: number;
  count: number;
}

export async function getCategoryTotals(from: DateStr, to: DateStr, type: TxType = 'expense'): Promise<CategoryTotal[]> {
  const rows = await query<CategoryTotal>(
    `SELECT t.category_id, COALESCE(c.name, 'Kategorisiz') AS name, COALESCE(c.color, '#8B92A0') AS color,
            SUM(t.amount_kurus) AS total, COUNT(*) AS count
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.type = ? AND t.date BETWEEN ? AND ?
     GROUP BY t.category_id ORDER BY total DESC`,
    [type, from, to],
  );
  return rows.map((r) => ({ ...r, total: Number(r.total), count: Number(r.count) }));
}

// ---------- Listing / filtering ----------

export interface TxFilter {
  from?: DateStr;
  to?: DateStr;
  type?: TxType;
  categoryId?: number;
  minKurus?: number;
  maxKurus?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listTransactions(f: TxFilter = {}): Promise<Transaction[]> {
  const where: string[] = [`t.type <> 'opening'`];
  const params: SqlValue[] = [];
  if (f.from) (where.push('t.date >= ?'), params.push(f.from));
  if (f.to) (where.push('t.date <= ?'), params.push(f.to));
  if (f.type) (where.push('t.type = ?'), params.push(f.type));
  if (f.categoryId) (where.push('t.category_id = ?'), params.push(f.categoryId));
  if (f.minKurus != null) (where.push('t.amount_kurus >= ?'), params.push(f.minKurus));
  if (f.maxKurus != null) (where.push('t.amount_kurus <= ?'), params.push(f.maxKurus));
  const term = normalizeSearch(f.search ?? '').trim();
  if (term) (where.push(`t.search_text LIKE ? ESCAPE '\\'`), params.push(likePattern(term)));
  params.push(f.limit ?? 200, f.offset ?? 0);
  return query<Transaction>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.date DESC, t.created_at DESC, t.rowid DESC LIMIT ? OFFSET ?`, params);
}

export async function listTransactionsOn(date: DateStr): Promise<Transaction[]> {
  return listTransactions({ from: date, to: date, limit: 1000 });
}

/** Most used titles for quick entry (tap to prefill name + category). */
export async function getFrequentTitles(type: TxType, limit = 8): Promise<{ title: string; category_id: number }[]> {
  return query(
    `SELECT title, category_id FROM (
       SELECT title, category_id, COUNT(*) AS n, MAX(date) AS last FROM transactions
       WHERE type = ? AND category_id IS NOT NULL GROUP BY title COLLATE NOCASE
     ) ORDER BY n DESC, last DESC LIMIT ?`,
    [type, limit],
  );
}

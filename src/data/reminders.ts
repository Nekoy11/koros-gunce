import { query, queryOne, transaction } from '../db/database';
import { isValidDateStr, isValidTimeStr, nowIso, type DateStr } from '../lib/dates';
import { buildSearchText } from '../lib/text';

export interface Reminder {
  id: string;
  title: string;
  description: string | null;
  due_date: DateStr;
  due_time: string | null;
  completed: number;
  completed_at: string | null;
  notification_id: number;
  created_at: string;
  updated_at: string;
}

export interface ReminderInput {
  title: string;
  description?: string | null;
  dueDate: DateStr;
  dueTime?: string | null;
}

const TABLES = ['reminders'];

function validate(input: ReminderInput) {
  const title = input.title.trim();
  if (!title) throw new Error('Görev başlığı zorunludur.');
  if (title.length > 200) throw new Error('Başlık en fazla 200 karakter olabilir.');
  if (!isValidDateStr(input.dueDate)) throw new Error('Geçerli bir tarih seçin.');
  const dueTime = input.dueTime || null;
  if (dueTime && !isValidTimeStr(dueTime)) throw new Error('Geçerli bir saat seçin.');
  const description = input.description?.trim() || null;
  if (description && description.length > 2000) throw new Error('Açıklama çok uzun.');
  return { title, description, dueDate: input.dueDate, dueTime };
}

/** Allocates a unique positive 31-bit integer id for Android notifications. */
async function nextNotificationId(tx: { query: <T>(sql: string, p?: (string | number | null)[]) => Promise<T[]> }): Promise<number> {
  const r = await tx.query<{ m: number | null }>(`SELECT MAX(notification_id) AS m FROM reminders`);
  const next = (r[0]?.m ?? 1000) + 1;
  return next >= 2_147_483_647 ? 1001 : next;
}

/** Idempotent create: a repeated call with the same id does nothing. Returns the stored reminder. */
export async function addReminder(id: string, input: ReminderInput): Promise<Reminder> {
  const v = validate(input);
  const now = nowIso();
  await transaction(TABLES, async (tx) => {
    const existing = await tx.query(`SELECT id FROM reminders WHERE id = ?`, [id]);
    if (existing.length) return;
    const nid = await nextNotificationId(tx);
    await tx.run(
      `INSERT INTO reminders (id, title, description, due_date, due_time, completed, completed_at, notification_id, search_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?)`,
      [id, v.title, v.description, v.dueDate, v.dueTime, nid, buildSearchText(v.title, v.description), now, now],
    );
  });
  return (await getReminder(id))!;
}

export async function updateReminder(id: string, input: ReminderInput): Promise<Reminder> {
  const v = validate(input);
  await transaction(TABLES, async (tx) => {
    const res = await tx.run(
      `UPDATE reminders SET title = ?, description = ?, due_date = ?, due_time = ?, search_text = ?, updated_at = ? WHERE id = ?`,
      [v.title, v.description, v.dueDate, v.dueTime, buildSearchText(v.title, v.description), nowIso(), id],
    );
    if (res.changes === 0) throw new Error('Hatırlatma bulunamadı.');
  });
  return (await getReminder(id))!;
}

export async function setReminderCompleted(id: string, completed: boolean): Promise<void> {
  const now = nowIso();
  await transaction(TABLES, (tx) =>
    tx.run(`UPDATE reminders SET completed = ?, completed_at = ?, updated_at = ? WHERE id = ?`, [completed ? 1 : 0, completed ? now : null, now, id]),
  );
}

export async function deleteReminder(id: string): Promise<void> {
  await transaction(TABLES, (tx) => tx.run(`DELETE FROM reminders WHERE id = ?`, [id]));
}

export async function getReminder(id: string): Promise<Reminder | null> {
  return queryOne<Reminder>(`SELECT * FROM reminders WHERE id = ?`, [id]);
}

const ORDER = `ORDER BY due_date ASC, COALESCE(due_time, '99:99') ASC, created_at ASC`;

export async function listReminders(opts: { completed?: boolean; date?: DateStr; from?: DateStr; to?: DateStr; limit?: number } = {}): Promise<Reminder[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.completed !== undefined) (where.push('completed = ?'), params.push(opts.completed ? 1 : 0));
  if (opts.date) (where.push('due_date = ?'), params.push(opts.date));
  if (opts.from) (where.push('due_date >= ?'), params.push(opts.from));
  if (opts.to) (where.push('due_date <= ?'), params.push(opts.to));
  params.push(opts.limit ?? 1000);
  const order = opts.completed ? `ORDER BY completed_at DESC` : ORDER;
  return query<Reminder>(`SELECT * FROM reminders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${order} LIMIT ?`, params);
}

/** A reminder is overdue when its due moment (date + time, or end of day without time) has passed. */
export function isOverdue(r: Reminder, now = new Date()): boolean {
  if (r.completed) return false;
  const [y, m, d] = r.due_date.split('-').map(Number);
  const due = r.due_time ? new Date(y, m - 1, d, ...(r.due_time.split(':').map(Number) as [number, number])) : new Date(y, m - 1, d, 23, 59, 59);
  return due.getTime() < now.getTime();
}

export async function getReminderDates(from: DateStr, to: DateStr): Promise<{ date: string; open: number }[]> {
  return query(
    `SELECT due_date AS date, SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS open FROM reminders WHERE due_date BETWEEN ? AND ? GROUP BY due_date`,
    [from, to],
  );
}

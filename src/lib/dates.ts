/**
 * Calendar dates are stored as local "YYYY-MM-DD" strings (no timezone shift).
 * Timestamps (created_at/updated_at) are stored as ISO-8601 UTC strings.
 */

export type DateStr = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): DateStr {
  return toDateStr(new Date());
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateStr(parseDateStr(s)) === s;
}

export function isValidTimeStr(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMonths(s: DateStr, n: number): DateStr {
  const d = parseDateStr(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toDateStr(d);
}

export function startOfMonth(s: DateStr): DateStr {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s: DateStr): DateStr {
  const d = parseDateStr(s);
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Monday-based week start (Turkish convention). */
export function startOfWeek(s: DateStr): DateStr {
  return addDays(s, -weekdayIndex(s));
}

export function daysBetween(a: DateStr, b: DateStr): number {
  // Use UTC to avoid DST off-by-one.
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function eachDay(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const WEEKDAYS_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const WEEKDAYS_SHORT_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(s: DateStr): number {
  return (parseDateStr(s).getDay() + 6) % 7;
}

/** "5 Kasım 2026" */
export function formatDateLong(s: DateStr): string {
  const d = parseDateStr(s);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 Kasım 2026, Perşembe" */
export function formatDateWithWeekday(s: DateStr): string {
  return `${formatDateLong(s)}, ${WEEKDAYS_TR[weekdayIndex(s)]}`;
}

/** "05.11.2026" */
export function formatDateShort(s: DateStr): string {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

/** "5 Kas" */
export function formatDayMonth(s: DateStr): string {
  const d = parseDateStr(s);
  return `${d.getDate()} ${MONTHS_SHORT_TR[d.getMonth()]}`;
}

/** "Bugün", "Dün", "Yarın" or the long date. */
export function formatDateRelative(s: DateStr): string {
  const t = todayStr();
  if (s === t) return 'Bugün';
  if (s === addDays(t, -1)) return 'Dün';
  if (s === addDays(t, 1)) return 'Yarın';
  return formatDateLong(s);
}

export function formatMonthYear(s: DateStr): string {
  const d = parseDateStr(s);
  return `${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDateShort(toDateStr(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const DEFAULT_REMINDER_TIME = '09:00';

/** Local Date for a reminder's date + optional time (defaults to 09:00). */
export function combineDateTime(date: DateStr, time: string | null): Date {
  const d = parseDateStr(date);
  const [h, m] = (time ?? DEFAULT_REMINDER_TIME).split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function fileStamp(): string {
  const d = new Date();
  return `${toDateStr(d)}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

import * as XLSX from 'xlsx';
import { query } from '../db/database';
import { formatDateShort, MONTHS_TR, type DateStr } from '../lib/dates';
import type { CurrencyCode } from '../lib/money';

/** kuruş → number of currency units for spreadsheet cells (display only; exact for 2 decimals). */
const units = (k: number) => Number((k / 100).toFixed(2));
const MONEY_FMT = '#,##0.00';

function sheet(rows: Record<string, string | number>[], headers: string[], moneyCols: string[], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = widths.map((wch) => ({ wch }));
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const moneyIdx = moneyCols.map((c) => headers.indexOf(c));
  for (let r = 1; r <= range.e.r; r++) {
    for (const ci of moneyIdx) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
      if (cell && typeof cell.v === 'number') cell.z = MONEY_FMT;
    }
  }
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(range.e.r, 0), c: headers.length - 1 } }) };
  return ws;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_TR[m - 1]} ${y}`;
}

/** Builds the finance report workbook (pure: no file I/O). */
export async function buildExcelWorkbook(currency: CurrencyCode): Promise<XLSX.WorkBook> {
  const cur = `(${currency})`;
  const tx = await query<{ type: string; date: DateStr; title: string; amount_kurus: number; category: string | null; description: string | null }>(
    `SELECT t.type, t.date, t.title, t.amount_kurus, c.name AS category, t.description
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.type <> 'opening' ORDER BY t.date DESC, t.created_at DESC, t.rowid DESC`,
  );
  const opening = await query<{ amount_kurus: number }>(`SELECT amount_kurus FROM transactions WHERE type = 'opening'`);
  const openingK = Number(opening[0]?.amount_kurus ?? 0);

  const txRows = (type: string) =>
    tx
      .filter((t) => t.type === type)
      .map((t) => ({
        Tarih: formatDateShort(t.date),
        Ad: t.title,
        Kategori: t.category ?? '',
        [`Tutar ${cur}`]: units(Number(t.amount_kurus)),
        Açıklama: t.description ?? '',
      }));
  const txHeaders = ['Tarih', 'Ad', 'Kategori', `Tutar ${cur}`, 'Açıklama'];

  const daily = await query<{ date: string; income: number; expense: number; n: number }>(
    `SELECT date, COALESCE(SUM(CASE WHEN type='income' THEN amount_kurus END),0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount_kurus END),0) AS expense, COUNT(*) AS n
     FROM transactions WHERE type <> 'opening' GROUP BY date ORDER BY date DESC`,
  );
  const cats = await query<{ name: string; kind: string; total: number; n: number }>(
    `SELECT c.name, c.kind, COALESCE(SUM(t.amount_kurus),0) AS total, COUNT(t.id) AS n
     FROM categories c LEFT JOIN transactions t ON t.category_id = c.id
     GROUP BY c.id ORDER BY c.kind DESC, total DESC`,
  );
  const monthly = await query<{ month: string; income: number; expense: number }>(
    `SELECT substr(date,1,7) AS month, COALESCE(SUM(CASE WHEN type='income' THEN amount_kurus END),0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount_kurus END),0) AS expense
     FROM transactions WHERE type <> 'opening' GROUP BY month ORDER BY month`,
  );
  let running = openingK;
  const monthRows = monthly.map((m) => {
    const net = Number(m.income) - Number(m.expense);
    running += net;
    return {
      Ay: monthLabel(m.month),
      [`Gelir ${cur}`]: units(Number(m.income)),
      [`Gider ${cur}`]: units(Number(m.expense)),
      [`Net ${cur}`]: units(net),
      [`Ay Sonu Bakiye ${cur}`]: units(running),
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(txRows('income'), txHeaders, [`Tutar ${cur}`], [12, 30, 20, 14, 40]), 'Gelirler');
  XLSX.utils.book_append_sheet(wb, sheet(txRows('expense'), txHeaders, [`Tutar ${cur}`], [12, 30, 20, 14, 40]), 'Giderler');
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      daily.map((d) => ({
        Tarih: formatDateShort(d.date),
        [`Gelir ${cur}`]: units(Number(d.income)),
        [`Gider ${cur}`]: units(Number(d.expense)),
        [`Net ${cur}`]: units(Number(d.income) - Number(d.expense)),
        'İşlem Sayısı': Number(d.n),
      })),
      ['Tarih', `Gelir ${cur}`, `Gider ${cur}`, `Net ${cur}`, 'İşlem Sayısı'],
      [`Gelir ${cur}`, `Gider ${cur}`, `Net ${cur}`],
      [12, 14, 14, 14, 13],
    ),
    'Günlük Özet',
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      cats.map((c) => ({ Kategori: c.name, Tür: c.kind === 'income' ? 'Gelir' : 'Gider', [`Toplam ${cur}`]: units(Number(c.total)), 'İşlem Sayısı': Number(c.n) })),
      ['Kategori', 'Tür', `Toplam ${cur}`, 'İşlem Sayısı'],
      [`Toplam ${cur}`],
      [24, 8, 14, 13],
    ),
    'Kategoriler',
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      monthRows,
      ['Ay', `Gelir ${cur}`, `Gider ${cur}`, `Net ${cur}`, `Ay Sonu Bakiye ${cur}`],
      [`Gelir ${cur}`, `Gider ${cur}`, `Net ${cur}`, `Ay Sonu Bakiye ${cur}`],
      [16, 14, 14, 14, 20],
    ),
    'Aylık Rapor',
  );
  wb.Props = { Title: 'Koros Günce Finans Raporu', Author: 'Koros Günce' };
  return wb;
}

export function workbookToBase64(wb: XLSX.WorkBook): string {
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx', compression: true }) as string;
}

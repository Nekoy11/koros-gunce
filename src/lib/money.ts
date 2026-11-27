/**
 * Money is always handled as integer kuruş (1/100 of the currency unit).
 * Never convert to floating point for arithmetic.
 */

export type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'GBP';

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: 'TRY', label: 'Türk Lirası', symbol: '₺' },
  { code: 'USD', label: 'ABD Doları', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'İngiliz Sterlini', symbol: '£' },
];

/** Upper bound keeps every sum far below Number.MAX_SAFE_INTEGER. */
export const MAX_AMOUNT_KURUS = 100_000_000_000; // 1 billion units

/**
 * Parses user input like "50", "50,5", "1.250,75", "1250.75", "1 250" into kuruş.
 * Returns null for invalid or non-positive input.
 */
export function parseAmountToKurus(input: string): number | null {
  const s = input.trim().replace(/\s|₺|\$|€|£/g, '').replace(/TL$/i, '');
  if (!s) return null;
  if (!/^[0-9.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decimalSep: ',' | '.' | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimalSep = s.split(',').length - 1 === 1 ? ',' : null;
  } else if (lastDot >= 0) {
    // "1.250" is a Turkish thousands separator; "12.5" / "12.50" is decimal.
    const decimals = s.length - lastDot - 1;
    const dotCount = s.split('.').length - 1;
    decimalSep = dotCount === 1 && decimals !== 3 ? '.' : null;
  }

  let intPart = s;
  let fracPart = '';
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
  }
  // Thousands groups after the first must have exactly 3 digits ("1.250.000" ok, "1,234,5" not).
  const groups = intPart.split(/[.,]/);
  if (groups.length > 1 && (groups[0] === '' || groups.slice(1).some((g) => g.length !== 3))) return null;
  intPart = groups.join('');
  if (fracPart.length > 2) return null;
  if (!intPart) intPart = '0';
  if (!/^\d+$/.test(intPart) || (fracPart && !/^\d+$/.test(fracPart))) return null;

  const kurus = Number(intPart) * 100 + Number((fracPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(kurus) || kurus <= 0 || kurus > MAX_AMOUNT_KURUS) return null;
  return kurus;
}

/** Like parseAmountToKurus but accepts zero ("0", "0,00"); used for the opening balance. */
export function parseAmountAllowZero(input: string): number | null {
  if (/^\s*0+([.,]0{1,2})?\s*$/.test(input)) return 0;
  return parseAmountToKurus(input);
}

/** Converts kuruş to an editable input string, e.g. 125075 -> "1250,75". */
export function kurusToInput(kurus: number): string {
  const abs = Math.abs(kurus);
  const units = Math.floor(abs / 100);
  const frac = abs % 100;
  return frac === 0 ? String(units) : `${units},${String(frac).padStart(2, '0')}`;
}

const SYMBOLS: Record<CurrencyCode, string> = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

/**
 * Formats kuruş as "1.250,75 ₺" using integer math only (Turkish grouping),
 * so the displayed digits are always exact.
 */
export function formatMoney(kurus: number, currency: CurrencyCode = 'TRY', opts?: { sign?: boolean; compact?: boolean }): string {
  const negative = kurus < 0;
  const abs = Math.abs(kurus);
  const units = Math.floor(abs / 100);
  const frac = abs % 100;
  const intStr = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const showFrac = !(opts?.compact && frac === 0);
  const num = showFrac ? `${intStr},${String(frac).padStart(2, '0')}` : intStr;
  const sign = negative ? '−' : opts?.sign && kurus > 0 ? '+' : '';
  return `${sign}${num} ${SYMBOLS[currency] ?? currency}`;
}

/** Short axis label for charts (e.g. "1,2B"). Display only. */
export function formatMoneyShort(kurus: number): string {
  const units = kurus / 100;
  const abs = Math.abs(units);
  if (abs >= 1_000_000) return `${(units / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${(units / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B`;
  return units.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

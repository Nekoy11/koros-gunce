/**
 * Turkish-aware normalization for search: lowercases with Turkish rules and folds
 * diacritics so "KAHVE"/"kahve", "Süt"/"sut", "IŞIK"/"ışık"/"isik" all match.
 * The mapping is 1:1 per character, so indexes in normalized text line up with the original.
 */
const FOLD: Record<string, string> = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

export function normalizeSearch(input: string | null | undefined): string {
  if (!input) return '';
  let out = '';
  for (const ch of input) {
    const lower = ch.toLocaleLowerCase('tr-TR');
    // "İ".toLocaleLowerCase('tr') is "i"; keep exactly one char per input char.
    if (ch.length > 1) {
      out += ch; // astral chars (emoji) pass through unchanged
      continue;
    }
    const c = lower.length === 1 ? lower : lower[0];
    out += FOLD[c] ?? c.normalize('NFD')[0];
  }
  return out;
}

export function buildSearchText(...parts: (string | null | undefined)[]): string {
  return normalizeSearch(parts.filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
}

/** Escapes LIKE wildcards; use with `ESCAPE '\'`. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
}

export function snippet(text: string, query: string, len = 100): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const q = normalizeSearch(query).trim();
  if (clean.length <= len) return clean;
  const idx = q ? normalizeSearch(clean).indexOf(q) : -1;
  if (idx < 0) return clean.slice(0, len) + '…';
  const start = Math.max(0, idx - Math.floor(len / 3));
  const out = clean.slice(start, start + len);
  return (start > 0 ? '…' : '') + out + (start + len < clean.length ? '…' : '');
}

export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,#]/)) {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, 30);
    const key = t.toLocaleLowerCase('tr-TR');
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out.slice(0, 10);
}

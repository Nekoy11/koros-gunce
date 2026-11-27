import { useEffect, useState } from 'react';
import { AlarmClock, ArrowDownLeft, ArrowUpRight, BookOpen, Search as SearchIcon, StickyNote } from 'lucide-react';
import { searchAll, type SearchKind, type SearchResult } from '../data/search';
import { formatDateShort, formatTimestamp, isValidDateStr } from '../lib/dates';
import { useDb } from '../state/useDb';
import { useNav } from '../state/nav';
import { useActions } from '../state/actions';
import { useSettings } from '../state/settings';
import { PageHeader } from '../ui/layout';
import { Chip, Divided, EmptyState, Spinner, TextInput, cx } from '../ui/primitives';

const KIND: Record<SearchKind, { label: string; icon: typeof BookOpen; cls: string }> = {
  expense: { label: 'Harcama', icon: ArrowUpRight, cls: 'text-neg' },
  income: { label: 'Gelir', icon: ArrowDownLeft, cls: 'text-pos' },
  diary: { label: 'Günlük', icon: BookOpen, cls: 'text-accent' },
  note: { label: 'Not', icon: StickyNote, cls: 'text-warn' },
  reminder: { label: 'Hatırlatma', icon: AlarmClock, cls: 'text-accent' },
};

export function Search() {
  const nav = useNav();
  const { openTransaction, openReminder } = useActions();
  const { money } = useSettings();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState<SearchKind | 'all'>('all');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading } = useDb(() => searchAll(debounced), [debounced]);
  const results = (data ?? []).filter((r) => kind === 'all' || r.kind === kind);

  const open = (r: SearchResult) => {
    if (r.kind === 'expense' || r.kind === 'income') openTransaction({ id: r.id });
    else if (r.kind === 'reminder') openReminder({ id: r.id });
    else if (r.kind === 'diary') nav.push({ name: 'diary-entry', id: r.id });
    else nav.push({ name: 'note', id: r.id });
  };

  return (
    <>
      <PageHeader back title="Ara" />
      <main className="mx-auto w-full max-w-xl px-4 pb-[calc(var(--sab)+24px)]">
        <div className="relative">
          <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Harcama, günlük, not, hatırlatma…" className="pl-10" enterKeyHint="search" />
        </div>
        {debounced && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <Chip active={kind === 'all'} onClick={() => setKind('all')}>
              Tümü {data ? `(${data.length})` : ''}
            </Chip>
            {(Object.keys(KIND) as SearchKind[]).map((k) => {
              const n = data?.filter((r) => r.kind === k).length ?? 0;
              return n ? (
                <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                  {KIND[k].label} ({n})
                </Chip>
              ) : null;
            })}
          </div>
        )}
        <div className="mt-3">
          {!debounced ? (
            <EmptyState icon={SearchIcon} title="Tüm kayıtlarda ara" text="Türkçe karakter ve büyük/küçük harf farkı gözetmeden arar: “sut” yazınca “Süt” de bulunur." />
          ) : loading && !data ? (
            <Spinner />
          ) : results.length === 0 ? (
            <EmptyState icon={SearchIcon} title="Sonuç bulunamadı" />
          ) : (
            <Divided>
              {results.map((r) => {
                const k = KIND[r.kind];
                return (
                  <button key={`${r.kind}-${r.id}`} onClick={() => open(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-card-2">
                    <k.icon size={18} className={cx('mt-0.5 shrink-0', k.cls)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-medium">{r.title}</span>
                        {r.amountKurus !== undefined && <span className={cx('tabular shrink-0 text-[14px] font-semibold', k.cls)}>{money(r.amountKurus)}</span>}
                      </div>
                      <div className="text-[12px] text-muted">
                        {k.label} · {isValidDateStr(r.date) ? formatDateShort(r.date) : formatTimestamp(r.date)}
                      </div>
                      {r.snippet && <div className="mt-0.5 line-clamp-2 text-[13px] text-muted">{r.snippet}</div>}
                    </div>
                  </button>
                );
              })}
            </Divided>
          )}
        </div>
      </main>
    </>
  );
}

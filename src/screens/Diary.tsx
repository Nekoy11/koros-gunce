import { useMemo, useState } from 'react';
import { ArrowDownUp, BookOpen, Plus, Search, X } from 'lucide-react';
import { Fab } from '../ui/Fab';
import { listDiaryEntries, type DiaryEntry } from '../data/diary';
import { formatDateWithWeekday, todayStr } from '../lib/dates';
import { useDb } from '../state/useDb';
import { useNav } from '../state/nav';
import { Page, PageHeader } from '../ui/layout';
import { Button, Divided, EmptyState, IconButton, Spinner, TextInput } from '../ui/primitives';
import { DiaryRow } from '../ui/rows';

const PAGE = 200;

export function Diary() {
  const nav = useNav();
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const { data: page } = useDb(
    async () => {
      const rows = await listDiaryEntries({ order, search: q, limit: limit + 1 });
      return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
    },
    [order, q, limit],
    ['diary_entries'],
  );
  const data = page?.rows;

  const groups = useMemo(() => {
    const g: { date: string; items: DiaryEntry[] }[] = [];
    for (const e of data ?? []) {
      const last = g[g.length - 1];
      if (last?.date === e.date) last.items.push(e);
      else g.push({ date: e.date, items: [e] });
    }
    return g;
  }, [data]);

  return (
    <>
      <PageHeader
        title="Günlük"
        actions={
          <>
            <IconButton icon={ArrowDownUp} label={order === 'desc' ? 'Eskiden yeniye sırala' : 'Yeniden eskiye sırala'} onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))} />
            <IconButton
              icon={searching ? X : Search}
              label="Günlükte ara"
              onClick={() => {
                setSearching((s) => !s);
                setQ('');
              }}
            />
          </>
        }
      />
      <Page>
        {searching && <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık, içerik veya etiket ara" className="mb-3" />}
        <div className="mb-1 px-1 text-[12px] text-muted">{order === 'desc' ? 'Yeniden eskiye' : 'Eskiden yeniye'}</div>
        {!data ? (
          <Spinner />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={q ? 'Sonuç bulunamadı' : 'Günlüğün boş'}
            text={q ? undefined : 'Bugün yaşadıklarını, düşüncelerini yaz. Yazdıkça otomatik kaydedilir.'}
            action={!q && <Button icon={Plus} onClick={() => nav.push({ name: 'diary-entry', date: todayStr() })}>Yeni kayıt</Button>}
          />
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h3 className="text-[14px] font-semibold">{formatDateWithWeekday(g.date)}</h3>
                  <span className="text-[12px] text-muted">{g.items.length} kayıt</span>
                </div>
                <Divided>
                  {g.items.map((e) => (
                    <DiaryRow key={e.id} e={e} />
                  ))}
                </Divided>
              </section>
            ))}
            {page?.hasMore && (
              <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
                Daha fazla göster
              </Button>
            )}
          </div>
        )}
      </Page>
      <Fab label="Yeni günlük kaydı" onClick={() => nav.push({ name: 'diary-entry', date: todayStr() })} />
    </>
  );
}

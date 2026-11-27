import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Minus, Plus, Receipt, Search, SlidersHorizontal, Tags, Target, Wallet, X } from 'lucide-react';
import { getBalance, getDailyTotals, getOpening, getPlannedTotals, getTotals, listTransactions, type Transaction, type TxFilter, type TxType } from '../data/transactions';
import { listCategories } from '../data/categories';
import { endOfMonth, formatDateRelative, formatDateShort, startOfMonth, todayStr } from '../lib/dates';
import { kurusToInput, parseAmountToKurus } from '../lib/money';
import { useDb } from '../state/useDb';
import { useSettings } from '../state/settings';
import { useActions } from '../state/actions';
import { useNav } from '../state/nav';
import { Page, PageHeader } from '../ui/layout';
import { Button, Card, Chip, Divided, EmptyState, Field, IconButton, Segmented, Spinner, TextInput, cx } from '../ui/primitives';
import { TransactionRow } from '../ui/rows';
import { Sheet } from '../ui/Sheet';

const PAGE = 100;

export function Finance() {
  const { money } = useSettings();
  const { openTransaction, openOpening } = useActions();
  const nav = useNav();
  const [filter, setFilter] = useState<TxFilter>({});
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [filterOpen, setFilterOpen] = useState(false);

  const today = todayStr();
  const summary = useDb(
    async () => {
      const [balance, opening, month, planned] = await Promise.all([
        getBalance(today),
        getOpening(),
        getTotals(startOfMonth(today), endOfMonth(today)),
        getPlannedTotals(today),
      ]);
      return { balance, opening, month, planned };
    },
    [today],
    ['transactions'],
  );

  const activeFilters = Object.values(filter).filter((v) => v !== undefined && v !== '').length;
  const list = useDb(
    async () => {
      const rows = await listTransactions({ ...filter, search, limit: limit + 1 });
      const hasMore = rows.length > limit;
      const shown = rows.slice(0, limit);
      // Without filters the day headers show true day totals (independent of pagination).
      let totals: Map<string, { income: number; expense: number }> | null = null;
      if (!activeFilters && !search.trim() && shown.length) {
        const daily = await getDailyTotals(shown[shown.length - 1].date, shown[0].date);
        totals = new Map(daily.map((d) => [d.date, d]));
      }
      return { rows: shown, hasMore, totals };
    },
    [filter, search, limit, activeFilters],
    ['transactions', 'categories'],
  );

  const groups = useMemo(() => {
    const g: { date: string; items: Transaction[]; income: number; expense: number }[] = [];
    for (const t of list.data?.rows ?? []) {
      let last = g[g.length - 1];
      if (!last || last.date !== t.date) g.push((last = { date: t.date, items: [], income: 0, expense: 0 }));
      last.items.push(t);
      if (t.type === 'expense') last.expense += t.amount_kurus;
      else last.income += t.amount_kurus;
    }
    const totals = list.data?.totals;
    if (totals) for (const x of g) Object.assign(x, totals.get(x.date) ?? {});
    return g;
  }, [list.data]);

  const s = summary.data;

  return (
    <>
      <PageHeader title="Finans" actions={<IconButton icon={Tags} label="Kategoriler" onClick={() => nav.push({ name: 'categories' })} />} />
      <Page>
        <Card className="mt-1 p-5">
          <div className="text-[13px] font-medium text-muted">Mevcut bakiye</div>
          <div className={cx('tabular mt-1 text-[30px] font-semibold tracking-tight', (s?.balance ?? 0) < 0 && 'text-neg')}>{s ? money(s.balance) : '—'}</div>
          {s && s.balance < 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-neg">
              <AlertTriangle size={14} /> Bakiyeniz eksiye düştü.
            </div>
          )}
          {s && s.planned.count > 0 && (
            <div className="mt-1 text-[12px] text-muted">
              İleri tarihli {s.planned.count} işlem bakiyeye henüz dahil değil
              {s.planned.expense > 0 && <span className="text-neg"> · −{money(s.planned.expense)}</span>}
              {s.planned.income > 0 && <span className="text-pos"> · +{money(s.planned.income)}</span>}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div>
              <div className="text-[12px] text-muted">Bu ay gelir</div>
              <div className="tabular text-[15px] font-semibold text-pos">{s ? money(s.month.income) : '—'}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">Bu ay gider</div>
              <div className="tabular text-[15px] font-semibold text-neg">{s ? money(s.month.expense) : '—'}</div>
            </div>
          </div>
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="lg" variant="secondary" icon={Minus} className="text-neg" onClick={() => openTransaction({ type: 'expense' })}>
            Gider ekle
          </Button>
          <Button size="lg" variant="secondary" icon={Plus} className="text-pos" onClick={() => openTransaction({ type: 'income' })}>
            Gelir ekle
          </Button>
        </div>

        <Divided className="mt-3">
          <button onClick={openOpening} className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-card-2">
            <Wallet size={20} className="text-muted" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px]">Başlangıç bakiyesi</div>
              <div className="text-[13px] text-muted">{s?.opening ? `${money(s.opening.amountKurus)} · ${formatDateShort(s.opening.date)}` : 'Henüz girilmedi'}</div>
            </div>
            <ChevronRight size={18} className="text-faint" />
          </button>
          <button onClick={() => nav.push({ name: 'budget' })} className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-card-2">
            <Target size={20} className="text-muted" />
            <div className="flex-1 text-[15px]">Bütçe hedefleri</div>
            <ChevronRight size={18} className="text-faint" />
          </button>
        </Divided>

        <div className="mb-2 mt-6 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İşlem ara" className="h-11 pl-10" />
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Filtrele"
            className={cx('relative flex h-11 w-11 items-center justify-center rounded-xl border', activeFilters ? 'border-accent text-accent' : 'border-line text-fg')}
          >
            <SlidersHorizontal size={19} />
            {activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-on-accent">{activeFilters}</span>}
          </button>
        </div>
        {activeFilters > 0 && (
          <button onClick={() => setFilter({})} className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
            <X size={14} /> Filtreleri temizle
          </button>
        )}

        {!list.data ? (
          <Spinner />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={activeFilters || search ? 'Sonuç bulunamadı' : 'Henüz işlem yok'}
            text={activeFilters || search ? 'Filtreleri veya aramayı değiştirin.' : 'İlk harcamanızı veya gelirinizi ekleyin. Kayıtlar anında kaydedilir.'}
          />
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h3 className="text-[14px] font-semibold">{formatDateRelative(g.date)}</h3>
                  <div className="tabular text-[12px] text-muted">
                    {g.expense > 0 && <span>Harcama {money(g.expense)}</span>}
                    {g.expense > 0 && g.income > 0 && ' · '}
                    {g.income > 0 && <span className="text-pos">Gelir {money(g.income)}</span>}
                  </div>
                </div>
                <Divided>
                  {g.items.map((t) => (
                    <TransactionRow key={t.id} t={t} />
                  ))}
                </Divided>
              </section>
            ))}
            {list.data.hasMore && (
              <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
                Daha fazla göster
              </Button>
            )}
          </div>
        )}
      </Page>
      <FilterSheet open={filterOpen} value={filter} onClose={() => setFilterOpen(false)} onApply={(f) => (setFilter(f), setLimit(PAGE), setFilterOpen(false))} />
    </>
  );
}

function FilterSheet({ open, value, onClose, onApply }: { open: boolean; value: TxFilter; onClose: () => void; onApply: (f: TxFilter) => void }) {
  const cats = useDb(() => listCategories(), [], ['categories']);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<'all' | TxType>('all');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  // Sync local state when opened
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setFrom(value.from ?? '');
      setTo(value.to ?? '');
      setType(value.type ?? 'all');
      setCategoryId(value.categoryId);
      setMin(value.minKurus != null ? kurusToInput(value.minKurus) : '');
      setMax(value.maxKurus != null ? kurusToInput(value.maxKurus) : '');
    }
  }

  const visibleCats = (cats.data ?? []).filter((c) => type === 'all' || c.kind === type);

  const apply = () => {
    const f: TxFilter = {};
    if (from) f.from = from;
    if (to) f.to = to;
    if (type !== 'all') f.type = type;
    if (categoryId && visibleCats.some((c) => c.id === categoryId)) f.categoryId = categoryId;
    const mi = parseAmountToKurus(min);
    const ma = parseAmountToKurus(max);
    if (mi) f.minKurus = mi;
    if (ma) f.maxKurus = ma;
    onApply(f);
  };

  const today = todayStr();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtrele"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onApply({})}>
            Temizle
          </Button>
          <Button className="flex-1" onClick={apply}>
            Uygula
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'expense', label: 'Gider' },
            { value: 'income', label: 'Gelir' },
          ]}
        />
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Chip onClick={() => (setFrom(today), setTo(today))}>Bugün</Chip>
            <Chip onClick={() => (setFrom(startOfMonth(today)), setTo(endOfMonth(today)))}>Bu ay</Chip>
            <Chip onClick={() => (setFrom(''), setTo(''))}>Tüm zamanlar</Chip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Başlangıç">
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Bitiş">
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </div>
        <Field label="Kategori">
          <div className="flex flex-wrap gap-2">
            <Chip active={!categoryId} onClick={() => setCategoryId(undefined)}>
              Tümü
            </Chip>
            {visibleCats.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} color={c.color} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="En az tutar">
            <TextInput inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" />
          </Field>
          <Field label="En çok tutar">
            <TextInput inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="∞" />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

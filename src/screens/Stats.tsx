import { useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { getBalance, getCategoryTotals, getDailyTotals, getMonthlyTotals, getTotals } from '../data/transactions';
import { getMoodDistribution, moodInfo } from '../data/moods';
import {
  addDays,
  addMonths,
  daysBetween,
  eachDay,
  endOfMonth,
  formatDateLong,
  formatDayMonth,
  MONTHS_SHORT_TR,
  startOfMonth,
  startOfWeek,
  todayStr,
  type DateStr,
} from '../lib/dates';
import { useDb } from '../state/useDb';
import { useSettings } from '../state/settings';
import { Page, PageHeader } from '../ui/layout';
import { Card, EmptyState, Field, Segmented, SectionTitle, Spinner, TextInput, cx } from '../ui/primitives';
import { Donut, IncomeExpenseBars, SpendBars } from '../ui/charts';

type Preset = '7d' | 'month' | '3m' | 'year' | 'custom';

function rangeFor(p: Preset, custom: { from: DateStr; to: DateStr }): { from: DateStr; to: DateStr } {
  const t = todayStr();
  switch (p) {
    case '7d':
      return { from: addDays(t, -6), to: t };
    case 'month':
      return { from: startOfMonth(t), to: endOfMonth(t) };
    case '3m':
      return { from: startOfMonth(addMonths(t, -2)), to: endOfMonth(t) };
    case 'year':
      return { from: `${t.slice(0, 4)}-01-01`, to: `${t.slice(0, 4)}-12-31` };
    default:
      return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
  }
}

async function loadStats(from: DateStr, to: DateStr) {
  const today = todayStr();
  const mStart = startOfMonth(today);
  const prevStart = addMonths(mStart, -1);
  const span = daysBetween(mStart, today);
  const prevSameEnd = addDays(prevStart, Math.min(span, daysBetween(prevStart, endOfMonth(prevStart))));
  const chartFrom = startOfMonth(addMonths(today, -11));

  const [totals, daily, cats, monthTotals, prevTotals, balance, months, moods] = await Promise.all([
    getTotals(from, to),
    getDailyTotals(from, to),
    getCategoryTotals(from, to, 'expense'),
    getTotals(mStart, today),
    getTotals(prevStart, prevSameEnd),
    getBalance(),
    getMonthlyTotals(chartFrom, endOfMonth(today)),
    getMoodDistribution(from, to),
  ]);
  return { totals, daily, cats, monthTotals, prevTotals, balance, months, moods, today };
}

export function Stats() {
  const { money } = useSettings();
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState({ from: startOfMonth(todayStr()), to: todayStr() });
  const range = rangeFor(preset, custom);
  const { data } = useDb(() => loadStats(range.from, range.to), [range.from, range.to]);

  return (
    <>
      <PageHeader back title="İstatistikler" subtitle={`${formatDateLong(range.from)} – ${formatDateLong(range.to)}`} />
      <Page>
        <Segmented
          value={preset}
          onChange={setPreset}
          options={[
            { value: '7d', label: '7 gün' },
            { value: 'month', label: 'Bu ay' },
            { value: '3m', label: '3 ay' },
            { value: 'year', label: 'Bu yıl' },
            { value: 'custom', label: 'Özel' },
          ]}
        />
        {preset === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Başlangıç">
              <TextInput type="date" value={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
            </Field>
            <Field label="Bitiş">
              <TextInput type="date" value={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
            </Field>
          </div>
        )}

        {!data ? <Spinner /> : <StatsBody data={data} range={range} money={money} />}
      </Page>
    </>
  );
}

function StatsBody({ data, range, money }: { data: Awaited<ReturnType<typeof loadStats>>; range: { from: DateStr; to: DateStr }; money: (k: number, o?: { sign?: boolean; compact?: boolean }) => string }) {
  const { totals, daily, cats, today } = data;
  // Average over elapsed days only (future days of the range are not counted).
  const effectiveTo = range.to > today ? today : range.to;
  const dayCount = effectiveTo >= range.from ? daysBetween(range.from, effectiveTo) + 1 : 0;
  const avg = dayCount > 0 ? Math.round(totals.expense / dayCount) : 0;
  const topDay = daily.reduce<{ date: string; expense: number } | null>((m, d) => (d.expense > (m?.expense ?? 0) ? d : m), null);
  const topCat = cats[0];
  const change = data.prevTotals.expense > 0 ? Math.round(((data.monthTotals.expense - data.prevTotals.expense) * 100) / data.prevTotals.expense) : null;

  // Daily chart (cap at 62 bars for readability; longer ranges use weekly/monthly charts)
  const dailyMap = new Map(daily.map((d) => [d.date, d.expense]));
  const spanDays = daysBetween(range.from, range.to) + 1;
  const dailyBars = spanDays <= 62 ? eachDay(range.from, range.to).map((d) => ({ label: formatDayMonth(d), value: dailyMap.get(d) ?? 0, highlight: d === today })) : null;

  const weekMap = new Map<string, number>();
  for (const d of daily) {
    const w = startOfWeek(d.date);
    weekMap.set(w, (weekMap.get(w) ?? 0) + d.expense);
  }
  const weeks: { label: string; value: number }[] = [];
  for (let w = startOfWeek(range.from); w <= range.to; w = addDays(w, 7)) weeks.push({ label: formatDayMonth(w), value: weekMap.get(w) ?? 0 });

  const monthMap = new Map(data.months.map((m) => [m.month, m]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(startOfMonth(today), i - 11);
    const m = monthMap.get(d.slice(0, 7));
    return { label: MONTHS_SHORT_TR[Number(d.slice(5, 7)) - 1], value: m?.expense ?? 0, income: m?.income ?? 0, expense: m?.expense ?? 0, highlight: i === 11 };
  });
  const hasAny = totals.count > 0 || data.months.length > 0;

  if (!hasAny)
    return <EmptyState icon={BarChart3} title="Henüz veri yok" text="Gelir ve giderlerinizi ekledikçe grafikler ve analizler burada gerçek verilerinizle oluşur." />;

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Kpi label="Toplam harcama" value={money(totals.expense)} tone="neg" />
        <Kpi label="Toplam gelir" value={money(totals.income)} tone="pos" />
        <Kpi label="Günlük ortalama harcama" value={money(avg)} />
        <Kpi label="Mevcut bakiye" value={money(data.balance)} tone={data.balance < 0 ? 'neg' : undefined} />
        <Kpi label="En çok harcanan gün" value={topDay ? money(topDay.expense) : '—'} sub={topDay ? formatDateLong(topDay.date) : undefined} />
        <Kpi label="En çok harcanan kategori" value={topCat ? topCat.name : '—'} sub={topCat ? money(topCat.total) : undefined} />
      </div>
      <Card className="mt-2 flex items-center gap-3 p-4">
        {change === null ? (
          <span className="text-[14px] text-muted">Geçen ay aynı dönemde harcama yok; karşılaştırma yapılamıyor.</span>
        ) : (
          <>
            {change > 0 ? <TrendingUp className="text-neg" size={22} /> : <TrendingDown className="text-pos" size={22} />}
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">
                <span className={change > 0 ? 'text-neg' : 'text-pos'}>
                  {change > 0 ? '+' : ''}
                  {change}%
                </span>{' '}
                önceki aya göre
              </div>
              <div className="text-[12px] text-muted">
                Bu ay {money(data.monthTotals.expense)} · geçen ayın aynı dönemi {money(data.prevTotals.expense)}
              </div>
            </div>
          </>
        )}
      </Card>

      {dailyBars && (
        <>
          <SectionTitle title="Günlük harcama" />
          <Card className="px-3 pb-2 pt-4">
            <SpendBars data={dailyBars} />
          </Card>
        </>
      )}

      {weeks.length > 1 && (
        <>
          <SectionTitle title="Haftalık harcama" />
          <Card className="px-3 pb-2 pt-4">
            <SpendBars data={weeks} />
          </Card>
        </>
      )}

      <SectionTitle title="Kategori dağılımı" />
      <Card className="p-4">
        {cats.length ? (
          <>
            <Donut data={cats.map((c) => ({ name: c.name, value: c.total, color: c.color }))} height={190} />
            <div className="mt-3 space-y-2.5">
              {cats.map((c) => {
                const pct = totals.expense ? Math.round((c.total * 1000) / totals.expense) / 10 : 0;
                return (
                  <div key={String(c.category_id)} className="flex items-center gap-3 text-[14px]">
                    <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-[12px] text-muted">%{pct.toLocaleString('tr-TR')}</span>
                    <span className="tabular w-24 text-right font-medium">{money(c.total)}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-[14px] text-muted">Bu aralıkta harcama yok.</div>
        )}
      </Card>

      <SectionTitle title="Aylık harcama (12 ay)" />
      <Card className="px-3 pb-2 pt-4">
        <SpendBars data={months} />
      </Card>

      <SectionTitle title="Gelir / gider karşılaştırması" />
      <Card className="px-3 pb-2 pt-4">
        <IncomeExpenseBars data={months.slice(-6)} />
      </Card>

      {data.moods.length > 0 && (
        <>
          <SectionTitle title="Ruh hâli dağılımı" />
          <Card className="flex items-center gap-4 p-4">
            <div className="w-36 shrink-0">
              <Donut
                data={data.moods.map((m) => ({ name: moodInfo(m.mood).label, value: m.n, color: moodInfo(m.mood).color }))}
                height={140}
                valueFormatter={(v) => `${v} gün`}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              {data.moods.map((m) => (
                <div key={m.mood} className="flex items-center gap-2 text-[14px]">
                  <span>{moodInfo(m.mood).emoji}</span>
                  <span className="flex-1">{moodInfo(m.mood).label}</span>
                  <span className="text-muted">{m.n} gün</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }) {
  return (
    <Card className="p-3.5">
      <div className="text-[12px] leading-tight text-muted">{label}</div>
      <div className={cx('tabular mt-1 truncate text-[16px] font-semibold', tone === 'pos' && 'text-pos', tone === 'neg' && 'text-neg')}>{value}</div>
      {sub && <div className="truncate text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

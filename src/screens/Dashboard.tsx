import { AlertTriangle, BookOpen, Minus, NotebookPen, Plus, Search, Settings as SettingsIcon, BellPlus, Target, BarChart3, StickyNote } from 'lucide-react';
import { getBalance, getDailyTotals, getMonthlyTotals, getOpening, getTotals } from '../data/transactions';
import { listDiaryEntries } from '../data/diary';
import { listNotes } from '../data/notes';
import { getMood, moodInfo, MOODS } from '../data/moods';
import { isOverdue, listReminders } from '../data/reminders';
import { getBudgetStatus } from '../data/budgets';
import { addDays, addMonths, eachDay, endOfMonth, formatDateWithWeekday, MONTHS_SHORT_TR, startOfMonth, todayStr, WEEKDAYS_SHORT_TR, weekdayIndex } from '../lib/dates';
import { useDb } from '../state/useDb';
import { useSettings } from '../state/settings';
import { useActions } from '../state/actions';
import { useNav } from '../state/nav';
import { Page, PageHeader } from '../ui/layout';
import { Card, Divided, EmptyState, IconButton, ProgressBar, SectionTitle, Spinner, cx } from '../ui/primitives';
import { SpendBars } from '../ui/charts';
import { DiaryRow, ReminderRow } from '../ui/rows';
import { haptic, useCountUp } from '../lib/motion';

async function loadDashboard(warnPercent: number) {
  const today = todayStr();
  const mStart = startOfMonth(today);
  const [balance, opening, todayTotals, monthTotals, diaryToday, notes, mood, openReminders, last7, months, budgets] = await Promise.all([
    getBalance(),
    getOpening(),
    getTotals(today, today),
    getTotals(mStart, endOfMonth(today)),
    listDiaryEntries({ date: today }),
    listNotes({ limit: 3 }),
    getMood(today),
    listReminders({ completed: false, to: addDays(today, 7) }),
    getDailyTotals(addDays(today, -6), today),
    getMonthlyTotals(startOfMonth(addMonths(today, -5)), endOfMonth(today)),
    getBudgetStatus(today, warnPercent),
  ]);
  return { today, balance, opening, todayTotals, monthTotals, diaryToday, notes, mood, openReminders, last7, months, budgets };
}

export function Dashboard() {
  const { settings, money } = useSettings();
  const { openTransaction, openReminder, openMood } = useActions();
  const nav = useNav();
  const { data } = useDb(() => loadDashboard(settings.budgetWarnPercent), [settings.budgetWarnPercent]);

  const header = (
    <PageHeader
      title="Koros Günce"
      subtitle={formatDateWithWeekday(todayStr())}
      actions={
        <>
          <IconButton icon={Search} label="Ara" onClick={() => nav.push({ name: 'search' })} />
          <IconButton icon={SettingsIcon} label="Ayarlar" onClick={() => nav.push({ name: 'settings' })} />
        </>
      }
    />
  );
  if (!data)
    return (
      <>
        {header}
        <Spinner />
      </>
    );

  const { today, balance, todayTotals, monthTotals } = data;
  const overdue = data.openReminders.filter((r) => isOverdue(r));
  const dueToday = data.openReminders.filter((r) => r.due_date === today && !isOverdue(r));
  const upcoming = data.openReminders.filter((r) => r.due_date > today);
  const reminderList = [...overdue, ...dueToday, ...upcoming].slice(0, 6);

  const last7Map = new Map(data.last7.map((d) => [d.date, d.expense]));
  const last7 = eachDay(addDays(today, -6), today).map((d) => ({ label: WEEKDAYS_SHORT_TR[weekdayIndex(d)], value: last7Map.get(d) ?? 0, highlight: d === today }));
  const hasLast7 = last7.some((d) => d.value > 0);

  const monthMap = new Map(data.months.map((m) => [m.month, m.expense]));
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(startOfMonth(today), i - 5);
    return { label: MONTHS_SHORT_TR[Number(d.slice(5, 7)) - 1], value: monthMap.get(d.slice(0, 7)) ?? 0, highlight: i === 5 };
  });
  const hasMonths = months.filter((m) => m.value > 0).length >= 1;
  const mood = data.mood ? moodInfo(data.mood.mood) : null;

  return (
    <>
      {header}
      <Page>
        {/* Balance */}
        <div className={cx('hero mt-1 rounded-[26px] p-5', balance < 0 && 'hero-neg')}>
          <div className="hero-shine" />
          <div className="text-[13px] font-semibold opacity-70">Mevcut bakiye</div>
          <AnimatedMoney value={balance} className="tabular mt-1 block text-[40px] font-extrabold leading-tight tracking-tight" />
          {balance < 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-[13px] opacity-90">
              <AlertTriangle size={14} /> Bakiyeniz eksiye düştü.
            </div>
          )}
          {!data.opening && (
            <button onClick={() => nav.setTab('finance')} className="press mt-1 text-[13px] font-semibold underline underline-offset-2">
              Başlangıç bakiyesi ekleyin →
            </button>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/30 bg-white/25 p-3 backdrop-blur-md">
            <Stat label="Bugün harcama" value={todayTotals.expense} />
            <Stat label="Bu ay gelir" value={monthTotals.income} />
            <Stat label="Bu ay gider" value={monthTotals.expense} />
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Quick icon={Minus} label="Harcama" tone="neg" onClick={() => openTransaction({ type: 'expense' })} />
          <Quick icon={Plus} label="Gelir" tone="pos" onClick={() => openTransaction({ type: 'income' })} />
          <Quick icon={NotebookPen} label="Günlük" onClick={() => nav.push({ name: 'diary-entry', date: today })} />
          <Quick icon={BellPlus} label="Hatırlatma" onClick={() => openReminder({ date: today })} />
        </div>

        {/* Mood */}
        <SectionTitle title="Ruh hâli" action={data.mood ? 'Düzenle' : undefined} onAction={() => openMood(today)} />
        <Card onClick={() => openMood(today)} className="flex items-center gap-3 px-4 py-3">
          {mood ? (
            <>
              <span key={mood.emoji} className="animate-pop text-[30px]">{mood.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{mood.label}</div>
                <div className="truncate text-[13px] text-muted">{data.mood?.note || 'Bugünkü ruh hâli kaydı'}</div>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 text-[15px] text-muted">Bugün nasılsın?</div>
              <div className="flex gap-1 text-[22px]">
                {MOODS.map((m, i) => (
                  <span key={m.value} className="animate-pop" style={{ animationDelay: `${300 + i * 60}ms` }}>
                    {m.emoji}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Reminders */}
        <SectionTitle title="Hatırlatmalar" action="Tümü" onAction={() => nav.push({ name: 'reminders' })} />
        {reminderList.length ? (
          <Divided>
            {(overdue.length > 0 || dueToday.length > 0) && (
              <div className="flex gap-4 px-4 py-2 text-[12px] font-medium">
                {overdue.length > 0 && <span className="text-neg">{overdue.length} gecikmiş</span>}
                {dueToday.length > 0 && <span className="text-accent">{dueToday.length} bugün</span>}
                {upcoming.length > 0 && <span className="text-muted">{upcoming.length} yaklaşan</span>}
              </div>
            )}
            {reminderList.map((r) => (
              <ReminderRow key={r.id} r={r} />
            ))}
          </Divided>
        ) : (
          <Card className="px-4 py-4 text-[14px] text-muted">Önümüzdeki 7 gün için açık görev yok.</Card>
        )}

        {/* Spending last 7 days */}
        <SectionTitle title="Son 7 gün harcama" action="İstatistikler" onAction={() => nav.push({ name: 'stats' })} />
        <Card className="px-3 pb-2 pt-4">
          {hasLast7 ? (
            <>
              <div className="mb-1 px-2 text-[13px] text-muted">
                Toplam <span className="tabular font-semibold text-fg">{money(last7.reduce((s, d) => s + d.value, 0))}</span>
              </div>
              <SpendBars data={last7} height={150} />
            </>
          ) : (
            <EmptyState icon={BarChart3} title="Henüz harcama yok" text="Harcama ekledikçe son 7 günün grafiği burada görünecek." />
          )}
        </Card>

        {/* Budgets */}
        <SectionTitle title="Bütçe hedefleri" action={data.budgets.length ? 'Yönet' : 'Ekle'} onAction={() => nav.push({ name: 'budget' })} />
        {data.budgets.length ? (
          <Card className="space-y-4 p-4">
            {data.budgets.slice(0, 4).map((b) => (
              <div key={b.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="truncate">{b.name}</span>
                  <span className={cx('tabular shrink-0 text-[13px]', b.state === 'over' ? 'text-neg' : b.state === 'warning' ? 'text-warn' : 'text-muted')}>
                    {money(b.spent, { compact: true })} / {money(b.limit, { compact: true })}
                  </span>
                </div>
                <ProgressBar percent={b.percent} state={b.state} />
              </div>
            ))}
          </Card>
        ) : (
          <Card onClick={() => nav.push({ name: 'budget' })} className="flex items-center gap-3 px-4 py-3.5">
            <Target size={20} className="text-accent" />
            <span className="text-[14px] text-muted">Aylık harcama limiti belirleyin</span>
          </Card>
        )}

        {/* Monthly chart */}
        {hasMonths && (
          <>
            <SectionTitle title="Aylık harcama" />
            <Card className="px-3 pb-2 pt-4">
              <SpendBars data={months} height={150} />
            </Card>
          </>
        )}

        {/* Diary today */}
        <SectionTitle title="Bugünün günlüğü" action="Yeni kayıt" onAction={() => nav.push({ name: 'diary-entry', date: today })} />
        {data.diaryToday.length ? (
          <Divided>
            {data.diaryToday.map((e) => (
              <DiaryRow key={e.id} e={e} />
            ))}
          </Divided>
        ) : (
          <Card onClick={() => nav.push({ name: 'diary-entry', date: today })} className="flex items-center gap-3 px-4 py-3.5">
            <BookOpen size={20} className="text-accent" />
            <span className="text-[14px] text-muted">Bugün henüz bir şey yazmadınız.</span>
          </Card>
        )}

        {/* Notes */}
        {data.notes.length > 0 && (
          <>
            <SectionTitle title="Son notlar" action="Tümü" onAction={() => nav.push({ name: 'notes' })} />
            <Divided>
              {data.notes.map((n) => (
                <button key={n.id} onClick={() => nav.push({ name: 'note', id: n.id })} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-card-2">
                  <StickyNote size={18} className="mt-0.5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium">{n.title || 'Başlıksız not'}</div>
                    {n.content && <div className="line-clamp-1 text-[13px] text-muted">{n.content}</div>}
                  </div>
                </button>
              ))}
            </Divided>
          </>
        )}
      </Page>
    </>
  );
}

function AnimatedMoney({ value, className }: { value: number; className?: string }) {
  const { money } = useSettings();
  const v = useCountUp(value);
  return <span className={className}>{money(v)}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium opacity-65">{label}</div>
      <AnimatedMoney value={value} className="tabular block truncate text-[14px] font-semibold" />
    </div>
  );
}

function Quick({ icon: Icon, label, onClick, tone }: { icon: typeof Plus; label: string; onClick: () => void; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'var(--pos)' : tone === 'neg' ? 'var(--neg)' : 'var(--accent)';
  return (
    <button
      onClick={() => {
        haptic.light();
        onClick();
      }}
      className="press flex h-[78px] flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card active:bg-card-2"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
        <Icon size={19} strokeWidth={2.2} />
      </span>
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDailyTotals } from '../data/transactions';
import { getDiaryDates } from '../data/diary';
import { getReminderDates } from '../data/reminders';
import { listMoods, moodInfo } from '../data/moods';
import { addDays, addMonths, endOfMonth, formatMonthYear, startOfMonth, startOfWeek, todayStr, WEEKDAYS_SHORT_TR } from '../lib/dates';
import { formatMoneyShort } from '../lib/money';
import { useDb } from '../state/useDb';
import { useNav } from '../state/nav';
import { useSettings } from '../state/settings';
import { Page, PageHeader } from '../ui/layout';
import { Button, IconButton, cx } from '../ui/primitives';

async function loadMonth(month: string) {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const [tx, diary, rem, moods] = await Promise.all([getDailyTotals(from, to), getDiaryDates(from, to), getReminderDates(from, to), listMoods(from, to)]);
  return {
    tx: new Map(tx.map((t) => [t.date, t])),
    diary: new Set(diary.map((d) => d.date)),
    rem: new Map(rem.map((r) => [r.date, Number(r.open)])),
    mood: new Map(moods.map((m) => [m.date, m.mood])),
  };
}

export function Calendar() {
  const nav = useNav();
  const { money } = useSettings();
  const today = todayStr();
  const [month, setMonth] = useState(startOfMonth(today));
  const { data } = useDb(() => loadMonth(month), [month]);

  const gridStart = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const lastRowNeeded = days.slice(35).some((d) => d.slice(0, 7) === month.slice(0, 7));
  const visible = lastRowNeeded ? days : days.slice(0, 35);

  return (
    <>
      <PageHeader title="Takvim" />
      <Page>
        <div className="flex items-center justify-between">
          <IconButton icon={ChevronLeft} label="Önceki ay" onClick={() => setMonth(addMonths(month, -1))} />
          <button onClick={() => setMonth(startOfMonth(today))} className="text-[17px] font-semibold">
            {formatMonthYear(month)}
          </button>
          <IconButton icon={ChevronRight} label="Sonraki ay" onClick={() => setMonth(addMonths(month, 1))} />
        </div>

        <div className="mt-2 grid grid-cols-7 text-center text-[12px] font-medium text-muted">
          {WEEKDAYS_SHORT_TR.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {visible.map((d) => {
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const tx = data?.tx.get(d);
            const mood = data?.mood.get(d);
            const rem = data?.rem.get(d);
            const isToday = d === today;
            return (
              <button
                key={d}
                onClick={() => nav.push({ name: 'day', date: d })}
                className={cx(
                  'flex aspect-[0.78] flex-col items-center rounded-xl border pt-1.5 transition-colors active:bg-card-2',
                  isToday ? 'border-accent bg-accent-soft' : 'border-transparent',
                  inMonth ? 'bg-card' : 'opacity-35',
                )}
              >
                <span className={cx('text-[14px] font-medium tabular', isToday && 'text-accent')}>{Number(d.slice(8))}</span>
                <span className="h-4 text-[13px] leading-4">{mood ? moodInfo(mood).emoji : ''}</span>
                {tx && tx.expense > 0 ? <span className="tabular mt-auto mb-1 text-[9.5px] leading-none text-neg">{formatMoneyShort(tx.expense)}</span> : <span className="mt-auto" />}
                <span className="mb-1.5 flex h-1.5 gap-0.5">
                  {data?.diary.has(d) && <i className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  {rem !== undefined && <i className={cx('h-1.5 w-1.5 rounded-full', rem > 0 ? 'bg-warn' : 'bg-faint')} />}
                  {tx && tx.income > 0 && <i className="h-1.5 w-1.5 rounded-full bg-pos" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-[12px] text-muted">
          <Legend className="bg-accent" label="Günlük yazısı" />
          <Legend className="bg-warn" label="Hatırlatma" />
          <Legend className="bg-pos" label="Gelir" />
          <span className="flex items-center gap-1.5">
            <span className="text-neg">{money(0).split(' ').pop()}</span> Harcama
          </span>
          <span>🙂 Ruh hâli</span>
        </div>

        {month !== startOfMonth(today) && (
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setMonth(startOfMonth(today))}>
            Bugüne dön
          </Button>
        )}
      </Page>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={cx('h-2 w-2 rounded-full', className)} />
      {label}
    </span>
  );
}

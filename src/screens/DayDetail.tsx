import { BellPlus, ChevronLeft, ChevronRight, Minus, NotebookPen, Plus, Smile } from 'lucide-react';
import { getBalanceAt, listTransactionsOn } from '../data/transactions';
import { listDiaryEntries } from '../data/diary';
import { getMood, moodInfo } from '../data/moods';
import { listReminders } from '../data/reminders';
import { addDays, formatDateWithWeekday, todayStr, type DateStr } from '../lib/dates';
import { useDb } from '../state/useDb';
import { useSettings } from '../state/settings';
import { useActions } from '../state/actions';
import { useNav } from '../state/nav';
import { Page, PageHeader } from '../ui/layout';
import { Card, Divided, IconButton, SectionTitle, Spinner, cx } from '../ui/primitives';
import { DiaryRow, ReminderRow, TransactionRow } from '../ui/rows';

async function loadDay(date: DateStr) {
  const [tx, diary, mood, reminders, balance] = await Promise.all([
    listTransactionsOn(date),
    listDiaryEntries({ date, order: 'asc' }),
    getMood(date),
    listReminders({ date }),
    getBalanceAt(date),
  ]);
  return { tx, diary, mood, reminders, balance };
}

export function DayDetail({ date }: { date: DateStr }) {
  const nav = useNav();
  const { money } = useSettings();
  const { openTransaction, openReminder, openMood } = useActions();
  const { data } = useDb(() => loadDay(date), [date]);

  const expenses = data?.tx.filter((t) => t.type === 'expense') ?? [];
  const incomes = data?.tx.filter((t) => t.type === 'income') ?? [];
  const totalExpense = expenses.reduce((s, t) => s + t.amount_kurus, 0);
  const totalIncome = incomes.reduce((s, t) => s + t.amount_kurus, 0);
  const mood = data?.mood ? moodInfo(data.mood.mood) : null;
  const isFuture = date > todayStr();

  return (
    <>
      <PageHeader
        back
        title={formatDateWithWeekday(date).split(', ')[0]}
        subtitle={formatDateWithWeekday(date).split(', ')[1]}
        actions={
          <>
            <IconButton icon={ChevronLeft} label="Önceki gün" onClick={() => nav.replace({ name: 'day', date: addDays(date, -1) })} />
            <IconButton icon={ChevronRight} label="Sonraki gün" onClick={() => nav.replace({ name: 'day', date: addDays(date, 1) })} />
          </>
        }
      />
      <Page>
        {!data ? (
          <Spinner />
        ) : (
          <>
            <Card className="grid grid-cols-3 gap-2 p-4">
              <div>
                <div className="text-[11px] text-muted">Harcama</div>
                <div className="tabular text-[15px] font-semibold text-neg">{money(totalExpense)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted">Gelir</div>
                <div className="tabular text-[15px] font-semibold text-pos">{money(totalIncome)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted">{isFuture ? 'Tahmini bakiye' : 'Gün sonu bakiye'}</div>
                <div className={cx('tabular text-[15px] font-semibold', data.balance < 0 && 'text-neg')}>{money(data.balance)}</div>
              </div>
            </Card>

            <div className="mt-3 grid grid-cols-5 gap-1.5">
              <Small icon={Minus} label="Gider" onClick={() => openTransaction({ type: 'expense', date })} />
              <Small icon={Plus} label="Gelir" onClick={() => openTransaction({ type: 'income', date })} />
              <Small icon={NotebookPen} label="Günlük" onClick={() => nav.push({ name: 'diary-entry', date })} />
              <Small icon={BellPlus} label="Hatırlat" onClick={() => openReminder({ date })} />
              <Small icon={Smile} label="Ruh hâli" onClick={() => openMood(date)} />
            </div>

            <SectionTitle title="Ruh hâli" />
            <Card onClick={() => openMood(date)} className="flex items-center gap-3 px-4 py-3">
              {mood ? (
                <>
                  <span className="text-[26px]">{mood.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium">{mood.label}</div>
                    {data.mood?.note && <div className="truncate text-[13px] text-muted">{data.mood.note}</div>}
                  </div>
                </>
              ) : (
                <span className="text-[14px] text-muted">Kayıt yok · eklemek için dokunun</span>
              )}
            </Card>

            <SectionTitle title={`Harcamalar${expenses.length ? ` · ${money(totalExpense)}` : ''}`} />
            {expenses.length ? (
              <Divided>
                {expenses.map((t) => (
                  <TransactionRow key={t.id} t={t} />
                ))}
              </Divided>
            ) : (
              <Empty text="Bu gün harcama yok." />
            )}

            {incomes.length > 0 && (
              <>
                <SectionTitle title={`Gelirler · ${money(totalIncome)}`} />
                <Divided>
                  {incomes.map((t) => (
                    <TransactionRow key={t.id} t={t} />
                  ))}
                </Divided>
              </>
            )}

            <SectionTitle title="Günlük yazıları" />
            {data.diary.length ? (
              <Divided>
                {data.diary.map((e) => (
                  <DiaryRow key={e.id} e={e} />
                ))}
              </Divided>
            ) : (
              <Empty text="Bu gün için günlük yazısı yok." />
            )}

            <SectionTitle title="Hatırlatmalar" />
            {data.reminders.length ? (
              <Divided>
                {data.reminders.map((r) => (
                  <ReminderRow key={r.id} r={r} showDate={false} />
                ))}
              </Divided>
            ) : (
              <Empty text="Bu gün için hatırlatma yok." />
            )}
          </>
        )}
      </Page>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line px-4 py-3.5 text-[14px] text-muted">{text}</div>;
}

function Small({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-card active:bg-card-2">
      <Icon size={18} className="text-accent" />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

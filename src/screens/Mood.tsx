import { useState } from 'react';
import { ChevronLeft, ChevronRight, Smile } from 'lucide-react';
import { getMoodDistribution, listMoods, moodInfo } from '../data/moods';
import { addMonths, endOfMonth, formatDateWithWeekday, formatMonthYear, startOfMonth, todayStr } from '../lib/dates';
import { useDb } from '../state/useDb';
import { useActions } from '../state/actions';
import { Page, PageHeader } from '../ui/layout';
import { Button, Card, Divided, EmptyState, IconButton, SectionTitle, Spinner } from '../ui/primitives';
import { Donut } from '../ui/charts';

export function Mood() {
  const { openMood } = useActions();
  const today = todayStr();
  const [month, setMonth] = useState(startOfMonth(today));
  const { data } = useDb(async () => {
    const [list, dist] = await Promise.all([listMoods(month, endOfMonth(month)), getMoodDistribution(month, endOfMonth(month))]);
    return { list: list.reverse(), dist };
  }, [month]);

  return (
    <>
      <PageHeader back title="Ruh hâli" />
      <Page>
        <Button className="w-full" size="lg" icon={Smile} onClick={() => openMood(today)}>
          Bugünkü ruh hâlini kaydet
        </Button>
        <div className="mt-4 flex items-center justify-between">
          <IconButton icon={ChevronLeft} label="Önceki ay" onClick={() => setMonth(addMonths(month, -1))} />
          <span className="text-[16px] font-semibold">{formatMonthYear(month)}</span>
          <IconButton icon={ChevronRight} label="Sonraki ay" onClick={() => setMonth(addMonths(month, 1))} />
        </div>
        {!data ? (
          <Spinner />
        ) : data.list.length === 0 ? (
          <EmptyState icon={Smile} title="Bu ay kayıt yok" text="Ruh hâli kaydı isteğe bağlıdır. Kaydettiğiniz günler takvimde de görünür." />
        ) : (
          <>
            <SectionTitle title="Aylık dağılım" />
            <Card className="flex items-center gap-4 p-4">
              <div className="w-32 shrink-0">
                <Donut data={data.dist.map((m) => ({ name: moodInfo(m.mood).label, value: m.n, color: moodInfo(m.mood).color }))} height={128} valueFormatter={(v) => `${v} gün`} />
              </div>
              <div className="flex-1 space-y-1.5">
                {data.dist.map((m) => (
                  <div key={m.mood} className="flex items-center gap-2 text-[14px]">
                    <span>{moodInfo(m.mood).emoji}</span>
                    <span className="flex-1">{moodInfo(m.mood).label}</span>
                    <span className="text-muted">{m.n}</span>
                  </div>
                ))}
              </div>
            </Card>
            <SectionTitle title="Kayıtlar" />
            <Divided>
              {data.list.map((m) => (
                <button key={m.date} onClick={() => openMood(m.date)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-card-2">
                  <span className="text-[24px]">{moodInfo(m.mood).emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px]">{moodInfo(m.mood).label}</div>
                    <div className="truncate text-[13px] text-muted">
                      {formatDateWithWeekday(m.date)}
                      {m.note && ` · ${m.note}`}
                    </div>
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

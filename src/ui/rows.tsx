import { AlarmClock, Check, Circle } from 'lucide-react';
import type { Transaction } from '../data/transactions';
import { isOverdue, setReminderCompleted, type Reminder } from '../data/reminders';
import type { DiaryEntry } from '../data/diary';
import { formatDateRelative, formatDateShort } from '../lib/dates';
import { useSettings } from '../state/settings';
import { useActions } from '../state/actions';
import { useNav } from '../state/nav';
import { syncReminderNotification } from '../services/notifications';
import { CategoryDot, cx } from './primitives';
import { useFeedback } from './feedback';

export function TransactionRow({ t, showDate }: { t: Transaction; showDate?: boolean }) {
  const { money } = useSettings();
  const { openTransaction } = useActions();
  const sign = t.type === 'expense' ? -1 : 1;
  return (
    <button onClick={() => openTransaction({ id: t.id })} className="flex min-h-15 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-card-2">
      <CategoryDot color={t.category_color ?? '#8B92A0'}>{(t.category_name ?? '?').slice(0, 1)}</CategoryDot>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px]">{t.title}</div>
        <div className="truncate text-[13px] text-muted">
          {t.category_name ?? 'Kategorisiz'}
          {showDate && ` · ${formatDateShort(t.date)}`}
          {t.description && ` · ${t.description}`}
        </div>
      </div>
      <div className={cx('tabular shrink-0 text-[15px] font-semibold', sign < 0 ? 'text-neg' : 'text-pos')}>{money(sign * t.amount_kurus, { sign: true })}</div>
    </button>
  );
}

export function ReminderRow({ r, showDate = true }: { r: Reminder; showDate?: boolean }) {
  const { openReminder } = useActions();
  const { toast } = useFeedback();
  const overdue = isOverdue(r);
  const toggle = async () => {
    await setReminderCompleted(r.id, !r.completed);
    await syncReminderNotification({ ...r, completed: r.completed ? 0 : 1 });
    if (!r.completed) toast('Görev tamamlandı.');
  };
  return (
    <div className="flex min-h-14 items-center">
      <button onClick={toggle} aria-label={r.completed ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'} className="flex h-14 w-14 shrink-0 items-center justify-center">
        {r.completed ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pos text-white">
            <Check size={15} strokeWidth={3} />
          </span>
        ) : (
          <Circle size={24} className={overdue ? 'text-neg' : 'text-faint'} strokeWidth={1.8} />
        )}
      </button>
      <button onClick={() => openReminder({ id: r.id })} className="min-w-0 flex-1 py-2.5 pr-4 text-left active:opacity-70">
        <div className={cx('truncate text-[15px]', !!r.completed && 'text-muted line-through')}>{r.title}</div>
        <div className={cx('flex items-center gap-1 truncate text-[13px]', overdue ? 'text-neg' : 'text-muted')}>
          {(showDate || r.due_time) && <AlarmClock size={13} />}
          {showDate && formatDateRelative(r.due_date)}
          {r.due_time && `${showDate ? ' · ' : ''}${r.due_time}`}
          {overdue && ' · Gecikti'}
        </div>
      </button>
    </div>
  );
}

export function DiaryRow({ e, showDate }: { e: DiaryEntry; showDate?: boolean }) {
  const nav = useNav();
  const preview = e.content.replace(/\s+/g, ' ').trim();
  return (
    <button onClick={() => nav.push({ name: 'diary-entry', id: e.id })} className="block w-full px-4 py-3 text-left active:bg-card-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="truncate text-[15px] font-medium">{e.title || 'Başlıksız kayıt'}</div>
        {showDate && <div className="shrink-0 text-[12px] text-muted">{formatDateShort(e.date)}</div>}
      </div>
      {preview && <div className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-muted">{preview}</div>}
      {e.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {e.tags.map((t) => (
            <span key={t} className="rounded-md bg-card-2 px-1.5 py-0.5 text-[11px] text-muted">
              #{t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

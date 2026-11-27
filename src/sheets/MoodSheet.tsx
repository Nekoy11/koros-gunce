import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { MOODS, deleteMood, getMood, setMood } from '../data/moods';
import { formatDateWithWeekday, todayStr, type DateStr } from '../lib/dates';
import { errorMessage } from '../lib/log';
import { Sheet } from '../ui/Sheet';
import { Button, Field, TextArea, cx } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';
import { haptic } from '../lib/motion';

export function MoodSheet({ date, onClose }: { date: DateStr | null; onClose: () => void }) {
  const { toast } = useFeedback();
  const [mood, setMoodValue] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [exists, setExists] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!date) return;
    getMood(date).then((m) => {
      setMoodValue(m?.mood ?? null);
      setNote(m?.note ?? '');
      setExists(!!m);
    });
  }, [date]);

  const save = async () => {
    if (!date || mood === null) return;
    setSaving(true);
    try {
      await setMood(date, mood, note);
      onClose();
      toast('Ruh hâli kaydedildi.');
    } catch (e) {
      toast(`Kayıt başarısız: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!date) return;
    await deleteMood(date);
    onClose();
    toast('Ruh hâli kaydı kaldırıldı.');
  };

  return (
    <Sheet
      open={!!date}
      onClose={onClose}
      title={date === todayStr() ? 'Bugün nasılsın?' : 'Ruh hâli'}
      footer={
        <div className="flex gap-2">
          {exists && <Button variant="secondary" icon={Trash2} onClick={remove} aria-label="Kaldır" className="text-neg" />}
          <Button className="flex-1" size="lg" onClick={save} disabled={mood === null} loading={saving}>
            Kaydet
          </Button>
        </div>
      }
    >
      {date && <p className="-mt-1 mb-4 px-1 text-[13px] text-muted">{formatDateWithWeekday(date)}</p>}
      <div className="grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.value}
            onClick={() => {
              haptic.tick();
              setMoodValue(m.value);
            }}
            aria-pressed={mood === m.value}
            className={cx(
              'press flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition-colors duration-300',
              mood === m.value ? 'border-accent bg-accent-soft' : 'border-line bg-card',
            )}
          >
            <span
              key={mood === m.value ? 'on' : 'off'}
              className={cx('text-[28px] leading-none transition-transform duration-300', mood === m.value ? 'animate-pop scale-125' : mood !== null && 'opacity-60 grayscale-[40%]')}
            >
              {m.emoji}
            </span>
            <span className="text-[11px] font-medium text-muted">{m.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Kısa not">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" rows={2} maxLength={500} className="min-h-16" />
        </Field>
      </div>
    </Sheet>
  );
}

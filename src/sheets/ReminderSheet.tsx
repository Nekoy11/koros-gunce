import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { addReminder, deleteReminder, getReminder, setReminderCompleted, updateReminder } from '../data/reminders';
import { uuid } from '../lib/id';
import { DEFAULT_REMINDER_TIME, todayStr, type DateStr } from '../lib/dates';
import { errorMessage, logError } from '../lib/log';
import { cancelReminderNotification, getPermissionState, requestPermission, syncReminderNotification } from '../services/notifications';
import { useSettings } from '../state/settings';
import { Sheet } from '../ui/Sheet';
import { Button, Field, TextArea, TextInput, Toggle } from '../ui/primitives';
import { useFeedback } from '../ui/feedback';

export interface ReminderSheetOptions {
  id?: string;
  date?: DateStr;
}

export function ReminderSheet({ opts, onClose }: { opts: ReminderSheetOptions | null; onClose: () => void }) {
  const open = !!opts;
  const editing = !!opts?.id;
  const { toast, confirm } = useFeedback();
  const { settings } = useSettings();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<DateStr>(todayStr());
  const [time, setTime] = useState('');
  const [completed, setCompleted] = useState(false);
  const [notificationId, setNotificationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const newId = useRef(uuid());

  useEffect(() => {
    if (!opts) return;
    newId.current = uuid();
    setError(null);
    setSaving(false);
    if (opts.id) {
      getReminder(opts.id).then((r) => {
        if (!r) return;
        setTitle(r.title);
        setDescription(r.description ?? '');
        setDate(r.due_date);
        setTime(r.due_time ?? '');
        setCompleted(!!r.completed);
        setNotificationId(r.notification_id);
      });
    } else {
      setTitle('');
      setDescription('');
      setDate(opts.date ?? todayStr());
      setTime('');
      setCompleted(false);
      setNotificationId(null);
    }
  }, [opts]);

  const save = async () => {
    if (!title.trim()) return setError('Görev başlığı zorunludur.');
    if (saving) return;
    setSaving(true);
    try {
      const input = { title, description, dueDate: date, dueTime: time || null };
      let r = editing ? await updateReminder(opts!.id!, input) : await addReminder(newId.current, input);
      if (editing && !!r.completed !== completed) {
        await setReminderCompleted(r.id, completed);
        r = { ...r, completed: completed ? 1 : 0 };
      }
      onClose();
      toast(editing ? 'Hatırlatma güncellendi.' : 'Hatırlatma eklendi.');

      if (settings.notificationsEnabled && !r.completed) {
        let perm = await getPermissionState();
        if (perm === 'prompt') perm = await requestPermission();
        if (perm === 'denied') toast('Bildirim izni verilmedi. Hatırlatma kaydedildi ancak bildirim gönderilemeyecek. İzni Android ayarlarından açabilirsiniz.', 'warning');
      }
      await syncReminderNotification(r);
    } catch (err) {
      logError('saveReminder', err);
      toast(`Kayıt başarısız: ${errorMessage(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!opts?.id) return;
    const ok = await confirm({ title: 'Hatırlatma silinsin mi?', message: `"${title}" kalıcı olarak silinecek.`, confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    try {
      await deleteReminder(opts.id);
      if (notificationId) await cancelReminderNotification(notificationId);
      onClose();
      toast('Hatırlatma silindi.');
    } catch (err) {
      toast(`Silinemedi: ${errorMessage(err)}`, 'error');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Hatırlatmayı düzenle' : 'Yeni hatırlatma'}
      footer={
        <div className="flex gap-2">
          {editing && <Button variant="secondary" icon={Trash2} onClick={remove} aria-label="Sil" className="text-neg" />}
          <Button className="flex-1" size="lg" onClick={save} loading={saving}>
            {editing ? 'Güncelle' : 'Kaydet'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <Field label="Görev" required error={error}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Kitap satın al" maxLength={200} autoFocus={!editing} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tarih" required>
            <TextInput type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <Field label="Saat">
            <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <p className="-mt-2 text-[12px] text-faint">Saat seçilmezse bildirim {DEFAULT_REMINDER_TIME}'da gönderilir. Android pil tasarrufu bildirimleri birkaç dakika geciktirebilir.</p>
        <Field label="Açıklama">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı" rows={3} maxLength={2000} />
        </Field>
        {editing && (
          <div className="flex items-center justify-between rounded-xl bg-card-2 px-4 py-3">
            <span className="text-[15px]">Tamamlandı</span>
            <Toggle checked={completed} onChange={setCompleted} label="Tamamlandı" />
          </div>
        )}
      </div>
    </Sheet>
  );
}

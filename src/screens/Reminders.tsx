import { useEffect, useState } from 'react';
import { BellOff, BellRing, CalendarClock, Plus } from 'lucide-react';
import { isOverdue, listReminders, type Reminder } from '../data/reminders';
import { todayStr } from '../lib/dates';
import { useDb } from '../state/useDb';
import { useActions } from '../state/actions';
import { useSettings } from '../state/settings';
import { getExactAlarmState, getPermissionState, openExactAlarmSettings, requestPermission, resyncNotifications, type PermissionState } from '../services/notifications';
import { Page, PageHeader } from '../ui/layout';
import { Button, Divided, EmptyState, IconButton, Segmented, SectionTitle, Spinner } from '../ui/primitives';
import { ReminderRow } from '../ui/rows';

export function Reminders({ focusId }: { focusId?: string }) {
  const { openReminder } = useActions();
  const { settings } = useSettings();
  const [view, setView] = useState<'open' | 'done'>('open');
  const { data } = useDb(() => listReminders({ completed: view === 'done', limit: 1000 }), [view], ['reminders']);
  const [perm, setPerm] = useState<PermissionState>('unsupported');
  const [exact, setExact] = useState<'granted' | 'denied' | 'unsupported'>('unsupported');

  useEffect(() => {
    getPermissionState().then(setPerm);
    getExactAlarmState().then(setExact);
  }, []);

  useEffect(() => {
    if (focusId) openReminder({ id: focusId });
  }, [focusId, openReminder]);

  const today = todayStr();
  const sections: { title: string; items: Reminder[] }[] = [];
  if (data && view === 'open') {
    const overdue = data.filter((r) => isOverdue(r));
    const todays = data.filter((r) => r.due_date === today && !isOverdue(r));
    const later = data.filter((r) => r.due_date > today);
    if (overdue.length) sections.push({ title: `Gecikmiş · ${overdue.length}`, items: overdue });
    if (todays.length) sections.push({ title: 'Bugün', items: todays });
    if (later.length) sections.push({ title: 'Yaklaşan', items: later });
  } else if (data) {
    if (data.length) sections.push({ title: 'Tamamlanan', items: data });
  }

  const ask = async () => {
    const p = await requestPermission();
    setPerm(p);
    if (p === 'granted') await resyncNotifications();
  };

  return (
    <>
      <PageHeader back title="Hatırlatmalar" actions={<IconButton icon={Plus} label="Yeni hatırlatma" onClick={() => openReminder({ date: today })} />} />
      <Page>
        {settings.notificationsEnabled && perm !== 'granted' && perm !== 'unsupported' && (
          <div className="mb-3 rounded-2xl border border-warn/40 bg-warn/10 p-4">
            <div className="flex items-start gap-3">
              <BellOff size={20} className="mt-0.5 shrink-0 text-warn" />
              <div className="text-[14px] leading-relaxed">
                <div className="font-semibold">Bildirim izni yok</div>
                <div className="text-muted">
                  Hatırlatmalarınız kaydedilir ancak zamanı gelince bildirim gönderilemez.
                  {perm === 'denied' && ' İzni Android Ayarlar → Uygulamalar → Koros Günce → Bildirimler bölümünden açabilirsiniz.'}
                </div>
                {perm === 'prompt' && (
                  <Button size="sm" className="mt-3" icon={BellRing} onClick={ask}>
                    İzin ver
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        {settings.notificationsEnabled && perm === 'granted' && exact === 'denied' && (
          <div className="mb-3 rounded-2xl border border-line bg-card p-4 text-[14px]">
            <div className="flex items-start gap-3">
              <CalendarClock size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <div className="font-medium">Tam zamanlı bildirimler kapalı</div>
                <div className="text-muted">Android pil tasarrufu nedeniyle bildirimler birkaç dakika gecikebilir. "Alarmlar ve hatırlatıcılar" iznini açarak doğruluğu artırabilirsiniz.</div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={async () => {
                    await openExactAlarmSettings();
                    setExact(await getExactAlarmState());
                  }}
                >
                  Ayarı aç
                </Button>
              </div>
            </div>
          </div>
        )}
        {!settings.notificationsEnabled && <div className="mb-3 rounded-2xl bg-card-2 px-4 py-3 text-[13px] text-muted">Bildirimler ayarlardan kapatıldı. Hatırlatmalar yalnızca uygulama içinde görünür.</div>}

        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'open', label: 'Açık' },
            { value: 'done', label: 'Tamamlanan' },
          ]}
        />

        {!data ? (
          <Spinner />
        ) : sections.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={view === 'open' ? 'Açık görev yok' : 'Tamamlanan görev yok'}
            text={view === 'open' ? 'Yapılacak işlerinizi tarih ve saatle ekleyin; zamanı gelince bildirim alın.' : undefined}
            action={
              view === 'open' && (
                <Button icon={Plus} onClick={() => openReminder({ date: today })}>
                  Hatırlatma ekle
                </Button>
              )
            }
          />
        ) : (
          sections.map((s) => (
            <div key={s.title}>
              <SectionTitle title={s.title} />
              <Divided>
                {s.items.map((r) => (
                  <ReminderRow key={r.id} r={r} />
                ))}
              </Divided>
            </div>
          ))
        )}
      </Page>
    </>
  );
}

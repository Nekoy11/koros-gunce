import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { listReminders, type Reminder } from '../data/reminders';
import { getSettings } from '../data/settings';
import { combineDateTime } from '../lib/dates';
import { logError } from '../lib/log';

/**
 * Local reminder notifications (no server). Android may delay alarms under Doze / battery
 * optimisation, so delivery time is best-effort and the UI says so.
 */

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const isNative = () => Capacitor.isNativePlatform();
const CHANNEL_ID = 'reminders';

export async function ensureChannel(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Hatırlatmalar',
      description: 'Görev ve hatırlatma bildirimleri',
      importance: 4,
      visibility: 0, // private on lock screen
      vibration: true,
    });
  } catch (e) {
    logError('createChannel', e);
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!isNative()) return 'unsupported';
  const p = await LocalNotifications.checkPermissions();
  return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
}

export async function requestPermission(): Promise<PermissionState> {
  if (!isNative()) return 'unsupported';
  const p = await LocalNotifications.requestPermissions();
  return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
}

/** Android 12+: "Alarms & reminders" special access for exact timing. */
export async function getExactAlarmState(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!isNative()) return 'unsupported';
  try {
    const s = await LocalNotifications.checkExactNotificationSetting();
    return s.exact_alarm === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.changeExactNotificationSetting();
}

function shouldSchedule(r: Reminder, now = Date.now()): boolean {
  return !r.completed && combineDateTime(r.due_date, r.due_time).getTime() > now + 5_000;
}

/** Schedules (or replaces) the notification of one reminder; cancels it when not needed. */
export async function syncReminderNotification(r: Reminder): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: r.notification_id }] });
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !shouldSchedule(r)) return;
    if ((await getPermissionState()) !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: r.notification_id,
          title: r.title,
          body: r.description || 'Hatırlatma zamanı geldi.',
          channelId: CHANNEL_ID,
          schedule: { at: combineDateTime(r.due_date, r.due_time), allowWhileIdle: true },
          extra: { reminderId: r.id },
          smallIcon: 'ic_stat_notify',
        },
      ],
    });
  } catch (e) {
    logError('scheduleNotification', e);
  }
}

export async function cancelReminderNotification(notificationId: number): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
  } catch (e) {
    logError('cancelNotification', e);
  }
}

/** Rebuilds all pending notifications from the database (app start, restore, settings change). */
export async function resyncNotifications(): Promise<void> {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const settings = await getSettings();
    if (!settings.notificationsEnabled || (await getPermissionState()) !== 'granted') return;
    const open = (await listReminders({ completed: false })).filter((r) => shouldSchedule(r));
    // Android caps pending alarms per app (~500); schedule the nearest ones.
    const batch = open.slice(0, 400);
    if (!batch.length) return;
    await LocalNotifications.schedule({
      notifications: batch.map((r) => ({
        id: r.notification_id,
        title: r.title,
        body: r.description || 'Hatırlatma zamanı geldi.',
        channelId: CHANNEL_ID,
        schedule: { at: combineDateTime(r.due_date, r.due_time), allowWhileIdle: true },
        extra: { reminderId: r.id },
        smallIcon: 'ic_stat_notify',
      })),
    });
  } catch (e) {
    logError('resyncNotifications', e);
  }
}

export function onNotificationTap(handler: (reminderId: string | null) => void): () => void {
  if (!isNative()) return () => undefined;
  const p = LocalNotifications.addListener('localNotificationActionPerformed', (ev) => {
    const id = (ev.notification.extra as { reminderId?: string } | undefined)?.reminderId ?? null;
    handler(id);
  });
  return () => {
    p.then((h) => h.remove());
  };
}

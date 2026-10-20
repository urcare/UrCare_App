import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/** Notifications in the phone's notification bar — native (Android/iOS app)
 *  through @capacitor/local-notifications, and the browser's Notification
 *  API on the web. Plan reminders are scheduled ahead on the phone, so they
 *  arrive even when the app is closed. */

const CHANNEL_ID = 'urcare';
const SCHEDULED_KEY = 'urcare_scheduled_reminders';

const nativeReady = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');

/** A stable positive 31-bit id from a string (Android needs an int id). */
function idFor(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) % 2_000_000_000 || 1;
}

let channelMade = false;
/** Asks for permission once and sets up the Android notification channel. */
export async function ensurePhoneNotifications(): Promise<boolean> {
  try {
    if (nativeReady()) {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return false;
      if (!channelMade && Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({ id: CHANNEL_ID, name: 'UrCare', description: 'Plan reminders, family progress and updates', importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#10b981' });
        channelMade = true;
      }
      return true;
    }
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'default') await Notification.requestPermission();
    return Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** Shows one notification right now. */
export async function showPhoneNotification(title: string, body: string, seed: string) {
  try {
    if (nativeReady()) {
      await LocalNotifications.schedule({ notifications: [{ id: idFor(seed), title, body, channelId: CHANNEL_ID, smallIcon: 'ic_stat_urcare', iconColor: '#059669', extra: { seed } }] });
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png', tag: seed });
    }
  } catch { /* notifications are best-effort */ }
}

/** Schedules a reminder 5 minutes before each of today's remaining plan
 *  steps (replacing the previous schedule). Phone app only. */
export async function schedulePlanReminders(steps: { id: string; title: string; at: Date; timeLabel: string }[], tr: (en: string, hi: string) => string) {
  if (!nativeReady()) return;
  try {
    const prev: number[] = JSON.parse(localStorage.getItem(SCHEDULED_KEY) || '[]');
    if (prev.length) await LocalNotifications.cancel({ notifications: prev.map((id) => ({ id })) });
    const now = Date.now();
    const list = steps
      .map((s) => ({ ...s, fireAt: new Date(s.at.getTime() - 5 * 60 * 1000) }))
      .filter((s) => s.fireAt.getTime() > now + 15_000)
      .slice(0, 40)
      .map((s) => ({
        id: idFor(`reminder:${s.id}:${s.at.toDateString()}`),
        title: s.title,
        body: tr(`Starts at ${s.timeLabel} — in 5 minutes`, `${s.timeLabel} पर शुरू — 5 मिनट में`),
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_urcare',
        iconColor: '#059669',
        schedule: { at: s.fireAt, allowWhileIdle: true },
      }));
    if (list.length) await LocalNotifications.schedule({ notifications: list });
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify(list.map((n) => n.id)));
  } catch { /* best-effort */ }
}

export const phoneNotificationsAreNative = nativeReady;

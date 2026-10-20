import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { authedFetch } from './supabase';
import { ensurePhoneNotifications, showPhoneNotification } from './phoneNotifications';

/** Firebase push (FCM): notifications reach the phone's notification bar
 *  even when the app is fully closed. Only starts when the installed app
 *  has the push plugin AND the server has Firebase set up — an older APK or
 *  a server without Firebase simply keeps using local notifications. */

let active = false;
export const pushIsActive = () => active;

export async function initPush(): Promise<boolean> {
  if (active) return true;
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) return false;
  try {
    const res = await fetch('/api/push/config');
    const cfg = await res.json().catch(() => ({}));
    if (!cfg?.enabled) return false;

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;
    await ensurePhoneNotifications(); // also creates the "urcare" channel the pushes use

    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener('registration', ({ value }) => {
      authedFetch('/api/push/register', { method: 'POST', body: JSON.stringify({ token: value, platform: Capacitor.getPlatform() }) }).catch(() => {});
    });
    // While the app is open Android doesn't put pushes in the bar by itself.
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      showPhoneNotification(n.title || 'UrCare', n.body || '', `push:${n.id || Date.now()}`);
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      window.dispatchEvent(new Event('urcare:refresh'));
    });
    await PushNotifications.register();
    active = true;
    return true;
  } catch {
    return false;
  }
}

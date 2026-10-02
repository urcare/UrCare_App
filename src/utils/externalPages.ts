import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/** The public legal pages served from public/ — linked from Settings, the
 *  sign-in screen, and the Play Console / App Store Connect listings. */
export const LEGAL_PAGES = {
  privacy: '/privacy.html',
  terms: '/terms.html',
  deleteAccount: '/delete-account.html',
} as const;

/** Opens one of this app's own public pages. Inside the native app it opens
 *  in a real in-app browser tab (so the user can close it and land back where
 *  they were) instead of navigating the app's single WebView away. */
export async function openExternalPage(path: string): Promise<void> {
  const url = new URL(path, window.location.origin).href;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

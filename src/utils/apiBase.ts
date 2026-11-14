import { Capacitor } from '@capacitor/core';

/** The live UrCare server (keep in sync with capacitor.config.ts). */
export const SERVER_ORIGIN = 'https://urcare-app.onrender.com';

/** True when the screens are bundled inside the native app (the iOS build,
 *  see capacitor.config.ts), so the page's own origin is capacitor://localhost
 *  or https://localhost, not the server. When the native shell loads the
 *  live server instead (Android), relative URLs already reach the server. */
export const isBundledNative = Capacitor.isNativePlatform() && !/^https:\/\/urcare-app\.onrender\.com$/.test(window.location.origin);

/** Origin that serves /api/* and the public pages (privacy, terms…). */
export const apiOrigin = isBundledNative ? SERVER_ORIGIN : window.location.origin;

/** In the bundled native app, send every relative /api/* request to the
 *  live server. All app code calls fetch('/api/...') directly, so patching
 *  fetch once here covers every call. */
export function installApiFetchRewrite(): void {
  if (!isBundledNative) return;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) return original(SERVER_ORIGIN + input, init);
    if (input instanceof URL && input.origin === window.location.origin && input.pathname.startsWith('/api/')) {
      return original(SERVER_ORIGIN + input.pathname + input.search, init);
    }
    if (input instanceof Request) {
      const u = new URL(input.url);
      if (u.origin === window.location.origin && u.pathname.startsWith('/api/')) {
        return original(new Request(SERVER_ORIGIN + u.pathname + u.search, input), init);
      }
    }
    return original(input as RequestInfo, init);
  };
}

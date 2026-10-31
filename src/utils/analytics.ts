import { Capacitor } from '@capacitor/core';
import { authedFetch } from './supabase';

// ============================================================================
// USAGE TRACKING — one session per app open/browser tab, reported to the
// admin panel's Analytics tab (see analytics_sessions / analytics_events in
// supabase/patches.sql §24, and /api/usage/* in server.ts). Tracks page
// views (whichever tab/screen is open) and taps/clicks on real interactive
// elements — nothing else is recorded (no raw mouse coordinates, no full
// session replay). Works the same whether this is the website in a browser
// or the Capacitor app; `platform` is the only thing that tells them apart.
//
// Deliberately NOT named "analytics" anywhere in the actual request path —
// ad blockers and browser privacy filters (uBlock, Brave Shields, Firefox
// strict tracking protection) commonly block any URL containing that word,
// even first-party same-origin ones, which would otherwise silently drop
// every single event with no error anywhere to notice it by.
// ============================================================================

const SESSION_KEY = 'urcare_usage_session';
let sessionId: string | null = null;
let sessionPromise: Promise<string | null> | null = null;
let queue: { type: 'pageview' | 'click'; path: string; label?: string }[] = [];
let started = false;

function currentPath(): string {
  try { return window.location.pathname + (window.location.hash || ''); } catch { return '/'; }
}

async function openSession(): Promise<string | null> {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) return cached;
    const res = await authedFetch('/api/usage/session', {
      method: 'POST',
      body: JSON.stringify({
        platform: Capacitor.isNativePlatform() ? 'app' : 'web',
        entryPath: currentPath(),
        userAgent: navigator.userAgent,
      }),
    });
    const data = await res.json();
    if (data?.sessionId) { sessionStorage.setItem(SESSION_KEY, data.sessionId); return data.sessionId; }
    return null;
  } catch {
    return null;
  }
}

/** Resolves the current session, trying again next time if the last
 *  attempt failed (a blocked/offline request should not permanently kill
 *  tracking for the rest of the tab's life). */
async function getSessionId(): Promise<string | null> {
  if (sessionId) return sessionId;
  if (!sessionPromise) sessionPromise = openSession();
  const id = await sessionPromise;
  if (id) sessionId = id;
  else sessionPromise = null; // let the next flush() retry
  return id;
}

async function flush() {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const id = await getSessionId();
  if (!id) return;
  try { await authedFetch('/api/usage/events', { method: 'POST', body: JSON.stringify({ sessionId: id, events: batch }) }); } catch {}
}

/** The nearest meaningfully-labeled interactive ancestor of a click target
 *  — a button/link/role=button — so taps read as "Buy Now", "Log Out", etc.
 *  instead of an unlabeled <svg>/<span> deep inside one. */
function describeTarget(el: Element | null): string | null {
  let node: Element | null = el;
  for (let i = 0; i < 6 && node; i++) {
    const tag = node.tagName?.toLowerCase();
    const role = node.getAttribute?.('role');
    if (tag === 'button' || tag === 'a' || role === 'button' || (tag === 'input' && ['submit', 'button'].includes((node as HTMLInputElement).type))) {
      const label = node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || '';
      const clean = label.replace(/\s+/g, ' ').trim().slice(0, 80);
      return clean || tag;
    }
    node = node.parentElement;
  }
  return null;
}

function onClick(e: MouseEvent) {
  const label = describeTarget(e.target as Element);
  if (!label) return;
  queue.push({ type: 'click', path: currentPath(), label });
  if (queue.length >= 20) flush();
}

/** Call once a path/tab is actually showing (a route change, or a tab
 *  switch in a single-page screen like the Dashboard). */
export function trackPageView(path?: string) {
  queue.push({ type: 'pageview', path: path || currentPath() });
  if (queue.length >= 20) flush();
}

/** Starts the tracker — safe to call multiple times, only wires up once. */
export function initAnalytics() {
  if (started) return;
  started = true;
  getSessionId();
  document.addEventListener('click', onClick, { capture: true, passive: true });
  window.setInterval(flush, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  trackPageView();
}

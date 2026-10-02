import { getSupabaseClient } from './supabase';

// Small per-account app state that has no table of its own — the store cart,
// a half-finished onboarding, language, AI-analysis consent, and which weekly
// updates were already seen. Kept in the signed-in user's own Supabase Auth
// metadata (user_metadata.app_state), so it follows the account across
// refreshes, logouts and devices with no schema change. Writes are debounced
// and serialized; each one merges onto the latest copy of the session's
// metadata so separate keys never overwrite each other.

export type SavedCartItem = { productId: string; quantity: number };

export type AccountAppState = {
  language?: 'en' | 'hi';
  aiConsent?: boolean;
  cart?: SavedCartItem[];
  onboardingDraft?: Record<string, unknown> | null;
  weeklyAck?: Record<string, number>;
  /** Which daily plan each person (the account holder, or a family member,
   *  keyed by user id) has chosen to follow while they have an uploaded plan:
   *  'mine' (the uploaded one, the default) or 'urcare' (the built-in one). */
  planChoice?: Record<string, 'urcare' | 'mine'>;
};

let cache: AccountAppState = {};
let pending: Partial<AccountAppState> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
const listeners = new Set<(state: AccountAppState) => void>();

function readFromMetadata(meta: unknown): AccountAppState {
  const state = (meta as { app_state?: unknown } | null)?.app_state;
  return state && typeof state === 'object' ? (state as AccountAppState) : {};
}

/** The last loaded/saved state — synchronous, for code that can't await. */
export function getCachedAccountState(): AccountAppState {
  return cache;
}

/** Loads the signed-in account's saved state (from the local session, no
 *  network round trip) and notifies subscribers. Call after every sign-in. */
export async function loadAccountState(): Promise<AccountAppState> {
  const supabase = getSupabaseClient();
  if (!supabase) return cache;
  const { data } = await supabase.auth.getSession();
  cache = { ...readFromMetadata(data.session?.user?.user_metadata), ...pending };
  listeners.forEach((listener) => listener(cache));
  return cache;
}

/** Forgets the previous account's state on sign-out. */
export function clearAccountStateCache(): void {
  cache = {};
  pending = {};
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

export function onAccountStateLoaded(listener: (state: AccountAppState) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Saves part of the account state. Updates the cache immediately; the
 *  write to Supabase is debounced (`immediate` skips the wait). Does nothing
 *  remotely when no one is signed in. */
export function saveAccountState(patch: Partial<AccountAppState>, options: { immediate?: boolean } = {}): void {
  cache = { ...cache, ...patch };
  pending = { ...pending, ...patch };
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushAccountState, options.immediate ? 0 : 800);
}

/** Writes any not-yet-saved changes right away (e.g. before signing out). */
export function flushAccountStateNow(): Promise<unknown> {
  if (flushTimer) clearTimeout(flushTimer);
  flushAccountState();
  return writeChain;
}

function flushAccountState(): void {
  flushTimer = null;
  writeChain = writeChain.then(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || Object.keys(pending).length === 0) return;
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>((resolve) => setTimeout(() => resolve({ data: { session: null } }), 10_000)),
    ]);
    const user = data.session?.user;
    if (!user) return; // keep `pending` — retried on the next change
    const patch = pending;
    pending = {};
    const next = { ...readFromMetadata(user.user_metadata), ...patch };
    // Time-boxed: writes are chained, so one request that never settles
    // would otherwise hold up every save after it.
    const { error } = await Promise.race([
      supabase.auth.updateUser({ data: { app_state: next } }),
      new Promise<{ error: Error }>((resolve) => setTimeout(() => resolve({ error: new Error('timed out') }), 10_000)),
    ]);
    if (error) {
      // Keep the unsaved keys so the next change retries them.
      pending = { ...patch, ...pending };
      console.warn('Could not save account state:', error.message);
    }
  }).catch(() => {});
}

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';
import {
  UserHealthProfile, UserAccount, DailyLog, MealItem,
  FeedbackSubmission, Order, Prescription, DoctorContact,
  MedicalReportAnalysis, Product, UserReview, CalculatedPlan,
  GoalType, GenderType, ActivityLevel, GoalPace, AppNotification, ActivityLogEntry, CustomPlanStep,
} from '../types';
import { calculateNutritionPlan } from './calculator';

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

// Android's WebView localStorage is NOT reliable across the round trip a
// native Google sign-in takes (WebView → real browser tab → back) — the OS
// is free to reclaim the app's process while that browser tab is open, and
// on return the PKCE "code verifier" gotrue-js stashed in localStorage can
// simply be gone, surfacing as "invalid flow state, no valid flow state
// found" even though every URL/redirect in the flow was correct. Real
// documented Capacitor+Supabase issue — the fix is to back auth storage
// with @capacitor/preferences (native SharedPreferences/UserDefaults)
// instead, which survives exactly that. On web it's a drop-in no-op: its
// web implementation is just localStorage under the hood.
const capacitorPreferencesStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => { await Preferences.set({ key, value }); },
  removeItem: async (key: string) => { await Preferences.remove({ key }); },
};

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseClient && supabaseUrl && supabaseAnonKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: 'pkce',
          storage: capacitorPreferencesStorage,
          // On native, the OAuth redirect never actually lands back in this
          // WebView (Google forces the flow into a real system browser tab —
          // see signInWithGoogle below) — it comes back in via a custom URL
          // scheme deep link instead, handled explicitly by
          // completeNativeOAuthSignIn (called from App.tsx's appUrlOpen
          // listener). Auto-detecting a session from window.location would
          // just be inert there, so it's only enabled on web.
          detectSessionInUrl: !Capacitor.isNativePlatform(),
        },
      });
    } catch (e) {
      console.warn('Supabase initialization failed:', e);
    }
  }
  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// ============================================================================
// AUTH — real Supabase Auth (Google OAuth + email/password). No mock accounts,
// no Firebase. The session Supabase keeps in the browser is just an auth
// token, not application data — every real record lives in Postgres.
// ============================================================================

export async function signInWithGoogle(): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };

  if (Capacitor.isNativePlatform()) {
    // Google refuses to complete sign-in from inside an embedded WebView
    // (it detects the WebView user agent and blocks it outright), so this
    // has to run in a real browser. skipBrowserRedirect stops the SDK from
    // trying to navigate the WebView itself — instead it hands back the
    // OAuth URL, which we open in an actual browser tab; the custom
    // "org.urcare.app://auth-callback" redirect is what brings the result
    // back into the app (see AndroidManifest's intent-filter + the
    // appUrlOpen listener in App.tsx, which calls completeNativeOAuthSignIn
    // below).
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'org.urcare.app://auth-callback',
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: error.message };
    if (data?.url) await Browser.open({ url: data.url });
    return {};
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return { error: error?.message };
}

/** Finishes the native Google sign-in flow once the OAuth redirect comes
 *  back as a deep link (org.urcare.app://auth-callback?code=...&sb_flow_id=...)
 *  — exchanges that PKCE code for a real session, which fires the same
 *  onAuthStateChange the rest of the app already listens to (see App.tsx),
 *  so nothing else needs to know this happened via a deep link rather than
 *  a normal page load.
 *
 *  exchangeCodeForSession() takes the bare `code` (and, to look up the
 *  right stored PKCE verifier, an explicit `flowId` option) — NOT a whole
 *  URL. Passed a URL, it can't find the flow id there and falls back to
 *  sniffing one out of `window.location.href`, which never actually
 *  becomes this callback URL on native (Android hands the deep link to the
 *  app as an Intent, without ever navigating the WebView to it) — so that
 *  lookup silently comes up empty, surfacing as gotrue's "invalid flow
 *  state, no valid flow state found". Parsing the code/flow id out here
 *  ourselves and passing them explicitly is exactly the pattern
 *  Supabase's own docs show for a server-side callback handler — a native
 *  deep link handler is the same shape of problem. */
export async function completeNativeOAuthSignIn(callbackUrl: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  try {
    // A custom scheme ("org.urcare.app://...") isn't a URL the WHATWG URL
    // parser accepts as-is on every platform — swap in a throwaway https
    // origin just so its query string can be read reliably.
    const parsed = new URL(callbackUrl.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, 'https://placeholder.invalid/'));
    const code = parsed.searchParams.get('code');
    const flowId = parsed.searchParams.get('sb_flow_id') || undefined;
    if (!code) return { error: 'No authorization code found in the sign-in redirect.' };
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    return { error: error?.message };
  } finally {
    // Close the browser tab the OAuth flow ran in, whether it succeeded or not.
    Browser.close().catch(() => {});
  }
}

export async function signInWithEmail(email: string, password: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message };
}

export async function signUpWithEmail(email: string, password: string, fullName: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  return { error: error?.message };
}

export async function sendPasswordReset(email: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error: error?.message };
}

export async function signOutUser(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Network-verifies the session's user still actually exists — unlike
 *  getSession() above, which only reads the locally cached token and has no
 *  way to notice the account was deleted server-side (e.g. removed directly
 *  from the Supabase dashboard) since that cached token can go on looking
 *  valid until it naturally expires. Used once on app load so a stale
 *  session for a deleted account gets signed out to the auth screen instead
 *  of silently falling through to "Begin Onboarding" (no profile found for
 *  that id looks identical to a genuinely new signup otherwise). */
export async function verifySessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email || '' };
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

/** Bearer token to attach to server API calls so the backend can verify who's calling. */
export async function getAuthToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.access_token || null;
}

/** fetch() with the caller's real Supabase access token attached — use this for any
 *  /api/* call that needs to know who's calling (requireUser on the server). */
export async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

// ============================================================================
// PROFILE — maps the real `profiles` + `health_profiles` tables onto the
// app's UserAccount / UserHealthProfile shapes. calculatedPlan is never
// stored — it's derived fresh every time from the canonical stored fields.
// ============================================================================

interface ProfileBundle {
  account: UserAccount;
  profile: UserHealthProfile | null;
}

export async function fetchProfileBundle(userId: string, email: string): Promise<ProfileBundle> {
  const supabase = getSupabaseClient();
  const account: UserAccount = {
    uid: userId,
    email,
    displayName: email.split('@')[0],
    authProvider: 'google',
    supabaseSynced: true,
    isPro: false,
  };
  if (!supabase) return { account, profile: null };

  const { data: p } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  const { data: hp } = await supabase.from('health_profiles').select('*').eq('user_id', userId).maybeSingle();

  if (p) {
    account.displayName = p.full_name || account.displayName;
    account.email = p.email || account.email;
    account.avatarUrl = p.avatar_url || undefined;
    account.isPro = p.premium_status === 'active';
    account.proExpiry = p.premium_expires_at || undefined;
    account.role = p.role === 'admin' ? 'admin' : 'user';
  }

  if (!p || !p.onboarding_completed || !hp) {
    return { account, profile: null };
  }

  const gender = (hp.gender || p.gender || 'other') as GenderType;
  const age = hp.age || p.age || 25;
  const heightCm = hp.height || p.height || 170;
  const currentWeightKg = hp.weight || p.weight || 70;
  const targetWeightKg = hp.target_weight_kg || currentWeightKg;
  const goal = (hp.goal || hp.primary_goals?.[0] || 'improve_health') as GoalType;
  const activityLevel = (hp.activity_level || p.activity_level || 'moderately_active') as ActivityLevel;
  const pace = (hp.pace || 'steady') as GoalPace;

  const calculatedPlan: CalculatedPlan = calculateNutritionPlan(
    gender, age, heightCm, currentWeightKg, targetWeightKg, goal, activityLevel, pace,
  );

  const extra = hp.extra_data || {};

  const profile: UserHealthProfile = {
    id: userId,
    name: p.full_name || '',
    email: p.email || email,
    phone: p.phone || undefined,
    gender,
    age,
    heightCm,
    currentWeightKg,
    targetWeightKg,
    goal,
    activityLevel,
    pace,
    obstacles: extra.obstacles || [],
    dietaryPreference: hp.diet_preference || '',
    medicalConditions: hp.existing_concerns || [],
    calculatedPlan,
    preferences: extra.preferences,
    assessmentData: extra.assessmentData,
    healthDeepDive: extra.healthDeepDive,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };

  return { account, profile };
}

/** Saves a profile photo (already resized/compressed client-side to a data URL). */
export async function updateAvatar(userId: string, dataUrl: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('profiles').update({ avatar_url: dataUrl, updated_at: new Date().toISOString() }).eq('user_id', userId);
  return { error: error?.message };
}

/** Persists a Pro/trial grant to the database — must be called any time isPro
 *  is set to true locally (e.g. an onboarding trial), or the very next session
 *  refresh will re-fetch 'inactive' from the DB and silently revoke it. */
export async function activatePremium(userId: string, expiryIso: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('profiles').update({
    premium_status: 'active',
    premium_started_at: new Date().toISOString(),
    premium_expires_at: expiryIso,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return { error: error?.message };
}

export async function upsertProfile(userId: string, profile: UserHealthProfile): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { error: pErr } = await supabase.from('profiles').update({
    full_name: profile.name,
    email: profile.email,
    age: profile.age,
    gender: profile.gender,
    height: profile.heightCm,
    weight: profile.currentWeightKg,
    activity_level: profile.activityLevel,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  if (pErr) return { error: pErr.message };

  const extra_data = {
    obstacles: profile.obstacles,
    preferences: profile.preferences,
    assessmentData: profile.assessmentData,
    healthDeepDive: profile.healthDeepDive,
  };

  const { error: hpErr } = await supabase.from('health_profiles').upsert({
    user_id: userId,
    age: profile.age,
    gender: profile.gender,
    height: profile.heightCm,
    weight: profile.currentWeightKg,
    target_weight_kg: profile.targetWeightKg,
    activity_level: profile.activityLevel,
    goal: profile.goal,
    pace: profile.pace,
    diet_preference: profile.dietaryPreference,
    existing_concerns: profile.medicalConditions,
    daily_routine_type: 'standard',
    sitting_hours_per_day: 8,
    exercise_frequency_per_week: 3,
    meals_per_day: 3,
    daily_water_intake_liters: profile.calculatedPlan?.waterLiters || 2.5,
    average_sleep_hours: 7,
    sleep_quality: 'average',
    bedtime: '23:00',
    wake_time: '07:00',
    stress_level: 'moderate',
    energy_level: 'moderate',
    primary_goals: [profile.goal],
    smoking_status: 'never',
    alcohol_consumption: 'none',
    extra_data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (hpErr) return { error: hpErr.message };

  return {};
}

// ============================================================================
// DAILY LOG — what the user actually ate/did (meals, water, task checkboxes)
// ============================================================================

export async function getDailyLog(userId: string, date: string): Promise<DailyLog | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from('daily_logs').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
  if (!data) return null;
  return {
    date: data.date,
    meals: data.meals || [],
    waterMl: data.water_ml || 0,
    burnedActivities: data.burned_activities || [],
    medications: data.medications || [],
    notes: data.notes || undefined,
  };
}

export async function getTaskCompletion(userId: string, date: string): Promise<Record<string, boolean>> {
  const supabase = getSupabaseClient();
  if (!supabase) return {};
  const { data } = await supabase.from('daily_logs').select('task_completion').eq('user_id', userId).eq('date', date).maybeSingle();
  return (data?.task_completion as Record<string, boolean>) || {};
}

export async function toggleDailyTask(userId: string, date: string, taskId: string): Promise<Record<string, boolean>> {
  const current = await getTaskCompletion(userId, date);
  const next = { ...current, [taskId]: !current[taskId] };
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('daily_logs').upsert({
      user_id: userId,
      date,
      task_completion: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });
  }
  // Lets anything else on screen (e.g. the streak widget, which has no
  // other way to know a task changed) refresh itself immediately instead
  // of only picking up the change on its next mount.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('urcare:daily-log-changed', { detail: { userId, date } }));
  }
  return next;
}

/** Adds (or subtracts, for a correction) to today's real logged water
 *  intake — the actual editable log, not just the static target display.
 *  Returns the new real total so the caller can update its UI without a
 *  round-trip re-fetch. */
export async function addWaterIntake(userId: string, date: string, deltaMl: number): Promise<number> {
  const existing = await getDailyLog(userId, date);
  const nextMl = Math.max(0, (existing?.waterMl || 0) + deltaMl);
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('daily_logs').upsert({
      user_id: userId,
      date,
      water_ml: nextMl,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('urcare:daily-log-changed', { detail: { userId, date } }));
  }
  return nextMl;
}

/** Clears today's logged water back to 0 — unlike the macros, every ml
 *  logged for water comes through this same UI (there's no separate
 *  "scanned" source to protect), so a plain reset to zero is safe here. */
export async function resetWaterIntake(userId: string, date: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('daily_logs').upsert({
      user_id: userId,
      date,
      water_ml: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('urcare:daily-log-changed', { detail: { userId, date } }));
  }
}

export async function addMealToLog(userId: string, date: string, meal: MealItem): Promise<void> {
  const existing = await getDailyLog(userId, date);
  const meals = [...(existing?.meals || []), meal];
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('daily_logs').upsert({
      user_id: userId,
      date,
      meals,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('urcare:daily-log-changed', { detail: { userId, date } }));
  }
}

/** A quick manual macro log ("+10g protein") for when there's no meal photo
 *  to scan, just a number to add. Implemented as a lightweight meal entry
 *  (calories derived at 4 kcal/g protein & carbs, 9 kcal/g fat) so it sums
 *  into the same real daily total the food scanner's own meals do, rather
 *  than a separate parallel tally. */
export async function addQuickMacroLog(userId: string, date: string, macro: 'protein' | 'carbs' | 'fats', grams: number): Promise<void> {
  const kcalPerGram = macro === 'fats' ? 9 : 4;
  const meal: MealItem = {
    id: `quick_${macro}_${Date.now()}`,
    name: macro === 'protein' ? 'Quick log — Protein' : macro === 'carbs' ? 'Quick log — Carbs' : 'Quick log — Fats',
    calories: grams * kcalPerGram,
    protein: macro === 'protein' ? grams : 0,
    carbs: macro === 'carbs' ? grams : 0,
    fats: macro === 'fats' ? grams : 0,
    category: 'snack',
    timestamp: new Date().toISOString(),
    aiSuggested: false,
  };
  await addMealToLog(userId, date, meal);
}

/** Clears today's manually-logged amount for one macro — removes only the
 *  quick-log entries this screen itself created (id prefix `quick_<macro>_`),
 *  never a real scanned meal, so "reset" can't accidentally erase an actual
 *  food-scan entry just because it happened to contain protein/carbs/fat. */
export async function resetQuickMacroLog(userId: string, date: string, macro: 'protein' | 'carbs' | 'fats'): Promise<void> {
  const existing = await getDailyLog(userId, date);
  const meals = (existing?.meals || []).filter((m) => !m.id.startsWith(`quick_${macro}_`));
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('daily_logs').upsert({
      user_id: userId,
      date,
      meals,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('urcare:daily-log-changed', { detail: { userId, date } }));
  }
}

/** A quick manual calorie log ("+100 kcal") — same idea as
 *  addQuickMacroLog, but with no macro breakdown attached (a scanned meal
 *  already carries its own real macros; this is only for a number typed in
 *  directly), so it doesn't skew the Protein/Carbs/Fats totals. */
export async function addQuickCalorieLog(userId: string, date: string, kcal: number): Promise<void> {
  const meal: MealItem = {
    id: `quick_calories_${Date.now()}`,
    name: 'Quick log — Calories',
    calories: kcal,
    protein: 0,
    carbs: 0,
    fats: 0,
    category: 'snack',
    timestamp: new Date().toISOString(),
    aiSuggested: false,
  };
  await addMealToLog(userId, date, meal);
}

/** Clears today's manually-logged calories only (never a real scanned
 *  meal), same guard as resetQuickMacroLog. */
export async function resetQuickCalorieLog(userId: string, date: string): Promise<void> {
  const existing = await getDailyLog(userId, date);
  const meals = (existing?.meals || []).filter((m) => !m.id.startsWith('quick_calories_'));
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('daily_logs').upsert({
      user_id: userId,
      date,
      meals,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('urcare:daily-log-changed', { detail: { userId, date } }));
  }
}

/** All dates (in the last ~120 days) that have any logged activity — used to mark the calendar. */
export async function getActiveDates(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const set = new Set<string>();
  if (!supabase) return set;
  const { data } = await supabase
    .from('daily_logs')
    .select('date, meals, task_completion')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(120);
  (data || []).forEach((row: any) => {
    const hasMeals = Array.isArray(row.meals) && row.meals.length > 0;
    const hasTask = row.task_completion && Object.values(row.task_completion).some(Boolean);
    if (hasMeals || hasTask) set.add(row.date);
  });
  return set;
}

// ============================================================================
// REVERSAL DAILY PLAN — NOT AI-generated. The server deterministically
// assembles it from the static reversal_plan_sections table, filtered to
// this user's own selected conditions and program day. `date` only steers
// which program day to show (so the calendar can look at a past day) — the
// content itself is always the same for a given user + program day.
// ============================================================================

export async function getDailyPlan(date: string): Promise<{ plan?: any; error?: string }> {
  const res = await authedFetch('/api/daily-plan', {
    method: 'POST',
    body: JSON.stringify({ date }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || 'Could not load the plan for this day.' };
  return { plan: data.plan };
}

/** Today's real, AI-generated motivational line (same for every user,
 *  regenerated once per calendar day server-side — see /api/daily-quote).
 *  Not personalized, so a plain fetch — no auth token needed. Falls back to
 *  the same static line the server itself falls back to if anything fails,
 *  so the quote card is never blank. */
export async function getDailyQuote(): Promise<{ en: string; hi: string }> {
  try {
    const res = await fetch('/api/daily-quote');
    const data = await res.json();
    if (data?.en && data?.hi) return data;
  } catch {}
  return { en: 'Discipline today, freedom tomorrow.', hi: 'आज अनुशासन, कल आज़ादी।' };
}

// Upload-your-own daily plan — a photo/PDF of a schedule the user already
// has, extracted by the AI and swapped in for the built-in reversal plan for
// the next 35 days. See /api/analyze-daily-plan in server.ts.
export interface CustomDailyPlanResult {
  isValidPlan: boolean;
  rejectionReason?: string;
  analysisFailed?: boolean;
  sections?: { id: string; timeLabel: string | null; title: string; body: string }[];
  uploadedAt?: string;
  expiresAt?: string;
}

/** `persist: false` extracts sections without saving them — used once per
 *  rendered page when the source is a multi-page PDF (see
 *  UploadDailyPlanModal + pdfToImages.ts), so nothing is written to the
 *  user's plan until every page has been read and merged. Defaults to
 *  true, which is the original save-immediately behavior for a single
 *  photo upload. */
export async function uploadCustomDailyPlan(fileBase64: string, mimeType: string, persist: boolean = true): Promise<CustomDailyPlanResult> {
  try {
    const res = await authedFetch('/api/analyze-daily-plan', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: fileBase64, mimeType, persist }),
    });
    const data = await res.json();
    if (res.status === 401) return { isValidPlan: false, rejectionReason: 'Please sign in again.' };
    if (!res.ok) return { isValidPlan: false, analysisFailed: true, rejectionReason: data.rejectionReason || data.error || 'Could not read this plan right now.' };
    return data;
  } catch (e) {
    return { isValidPlan: false, analysisFailed: true, rejectionReason: 'Could not reach the server. Please check your connection and try again.' };
  }
}

export interface DailyPlanSectionInput {
  timeLabel: string | null;
  title: string;
  body: string;
}

/** Finalizes a multi-page PDF upload — saves the sections merged client-side
 *  from every page's own (unsaved) extraction as the one active custom
 *  plan. See /api/save-daily-plan in server.ts, which re-sorts them into
 *  real chronological order before saving. */
export async function saveMergedDailyPlan(sections: DailyPlanSectionInput[]): Promise<CustomDailyPlanResult> {
  try {
    const res = await authedFetch('/api/save-daily-plan', {
      method: 'POST',
      body: JSON.stringify({ sections, sourceImageUrl: null }),
    });
    const data = await res.json();
    if (res.status === 401) return { isValidPlan: false, rejectionReason: 'Please sign in again.' };
    if (!res.ok) return { isValidPlan: false, analysisFailed: true, rejectionReason: data.error || 'Could not save this plan right now.' };
    return { isValidPlan: true, ...data };
  } catch (e) {
    return { isValidPlan: false, analysisFailed: true, rejectionReason: 'Could not reach the server. Please check your connection and try again.' };
  }
}

// A user's own addition to their Daily Plan timeline (Plan tab → Edit →
// Add) — see /api/custom-plan-steps in server.ts for the real safety review
// that stamps the 'yellow'/'red' verdict before this ever gets saved.
export async function addCustomPlanStep(timeLabel: string, title: string, body: string): Promise<{ step?: CustomPlanStep; error?: string }> {
  try {
    const res = await authedFetch('/api/custom-plan-steps', {
      method: 'POST',
      body: JSON.stringify({ timeLabel, title, body }),
    });
    const data = await res.json();
    if (res.status === 401) return { error: 'Please sign in again.' };
    if (!res.ok) return { error: data.error || 'Could not add this step right now.' };
    return { step: data.step };
  } catch (e) {
    return { error: 'Could not reach the server. Please check your connection and try again.' };
  }
}

export async function getCustomPlanSteps(userId: string): Promise<CustomPlanStep[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from('custom_plan_steps').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  return (data || []).map((r: any) => ({
    id: r.id,
    timeLabel: r.time_label,
    title: r.title,
    body: r.body || '',
    verdict: r.verdict,
    verdictReason: r.verdict_reason || '',
    createdAt: r.created_at,
  }));
}

/** Removing a custom step is allowed directly (RLS: own rows only) — unlike
 *  activity_log, this isn't an audit trail, just the user's own editable list. */
export async function deleteCustomPlanStep(id: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('custom_plan_steps').delete().eq('id', id);
  return { error: error?.message };
}

// ============================================================================
// LAB REPORTS / PRESCRIPTIONS
// ============================================================================

export async function getMyReports(userId: string): Promise<MedicalReportAnalysis[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from('lab_reports').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false });
  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    reportName: r.report_name,
    uploadedAt: r.uploaded_at,
    imageUrl: r.image_url,
    reportText: r.report_text,
    summary: r.summary,
    biomarkers: r.biomarkers || [],
    identifiedRisks: r.identified_risks || [],
    dietaryRecommendations: r.dietary_recommendations || [],
    macroAdjustments: r.macro_adjustments || { keyNutrientsToBoost: [], foodsToAvoid: [] },
    adminReviewed: r.admin_reviewed,
    adminNotes: r.admin_notes,
    recommendedConditions: r.recommended_conditions || [],
    preExistingConditions: r.pre_existing_conditions || [],
    addedConditions: r.added_conditions || [],
  }));
}

export async function deleteReport(reportId: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('lab_reports').delete().eq('id', reportId);
  return { error: error?.message };
}

/** Lets the user correct the extracted report text themselves — e.g. if the
 *  OCR/AI misread a value — rather than that being permanently stuck wrong
 *  with no way to fix it. */
export async function updateReportText(reportId: string, reportText: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('lab_reports').update({ report_text: reportText }).eq('id', reportId);
  return { error: error?.message };
}

export async function getMyPrescriptions(userId: string): Promise<Prescription[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from('prescriptions').select('*').eq('user_id', userId).order('date', { ascending: false });
  return (data || []).map((rx: any) => ({
    id: rx.id,
    userId: rx.user_id,
    userName: rx.user_name,
    reportId: rx.report_id,
    doctorName: rx.doctor_name,
    doctorPhone: rx.doctor_phone,
    date: rx.date,
    diagnosis: rx.diagnosis,
    medicines: rx.medicines || [],
    recommendedSupplements: rx.recommended_supplements || [],
    dietaryAdjustments: rx.dietary_adjustments || [],
    notes: rx.notes,
  }));
}

// ============================================================================
// DOCTORS — admin-managed directory (public read)
// ============================================================================

export async function getDoctors(): Promise<DoctorContact[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from('doctors').select('*').eq('active', true).order('created_at');
  return (data || []).map((d: any) => ({
    name: d.name,
    qualification: d.qualification || '',
    specialization: d.specialization || '',
    registrationNumber: d.registration_number || '',
    phone: d.phone || '',
    directDialNumber: d.direct_dial_number || (d.phone ? `tel:${d.phone}` : ''),
    availability: d.availability || '',
    hospitalAffiliation: d.hospital_affiliation || '',
  }));
}

// ============================================================================
// PRODUCTS & REVIEWS — public store catalog
// ============================================================================

export async function getProducts(): Promise<Product[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data: products } = await supabase.from('products').select('*').order('created_at');
  const { data: reviews } = await supabase.from('reviews').select('product_id, rating');
  const byProduct: Record<string, number[]> = {};
  (reviews || []).forEach((r: any) => {
    if (!r.product_id) return;
    (byProduct[r.product_id] ||= []).push(r.rating || 0);
  });
  return (products || []).map((p: any) => {
    const ratings = byProduct[p.id] || [];
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      discountPrice: p.discount_price,
      rating: Number(avg.toFixed(1)),
      reviewsCount: ratings.length,
      image: p.image,
      description: p.description,
      benefits: p.benefits || [],
      nutritionInfo: p.nutrition_info,
      inStock: p.in_stock,
      featured: p.featured,
    };
  });
}

export async function getReviews(productId?: string): Promise<UserReview[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });
  if (productId) query = query.eq('product_id', productId);
  const { data } = await query;
  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    rating: r.rating,
    comment: r.comment,
    date: r.created_at,
    productId: r.product_id,
    productName: r.product_name,
    verified: r.verified,
  }));
}

export async function addReview(userId: string, userName: string, productId: string, productName: string, rating: number, comment: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase.from('reviews').insert({
    user_id: userId, user_name: userName, product_id: productId, product_name: productName, rating, comment, verified: true,
  });
  return { error: error?.message };
}

// ============================================================================
// ORDERS — real store orders (via server, which also creates order_items)
// ============================================================================

/** Creates a new order. Returns the REAL server-generated order id — the
 *  app's client-side 'ORD-XXXXXX' id is only a display placeholder until then. */
export async function saveOrderAndReceiptToSupabase(order: Order): Promise<{ success: boolean; orderId: string; error?: string }> {
  const res = await authedFetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: order.items,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      // UPI-QR transactions carry a manually-entered reference; Razorpay
      // transactions carry the real payment id — either way it's the one
      // payment reference this order has, so it goes in the same slot.
      razorpayPaymentId: order.transactionId,
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, orderId: order.id, error: data.error };
  return { success: true, orderId: data.order?.id || order.id };
}

/** Updates an existing order the caller owns — e.g. attaching a payment
 *  reference / receipt screenshot and marking it verified. Pass the REAL id
 *  returned by saveOrderAndReceiptToSupabase, not the display placeholder. */
export async function updateOrderPayment(orderId: string, patch: { transactionId?: string; receiptImageUrl?: string; paymentStatus?: string }): Promise<{ success: boolean; error?: string }> {
  const res = await authedFetch(`/api/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(patch) });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return { success: true };
}

// ============================================================================
// NOTIFICATIONS — real rows only, written server-side when something real
// happens (prescription issued, report reviewed, order updated). These just
// read/mark-read the caller's own notifications.
// ============================================================================

export async function getNotifications(): Promise<AppNotification[]> {
  const res = await authedFetch('/api/notifications');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.notifications || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body || undefined,
    data: n.data || {},
    read: !!n.read,
    createdAt: n.created_at,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  await authedFetch(`/api/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await authedFetch('/api/notifications/read-all', { method: 'POST' });
}

/** Fires a real "your next plan step starts soon" notification — the
 *  server only actually writes it once per dedupeKey (see
 *  /api/notifications/reminder), so calling this more than once for the
 *  same section/day is harmless. */
export async function sendPlanReminder(title: string, body: string, dedupeKey: string): Promise<void> {
  await authedFetch('/api/notifications/reminder', { method: 'POST', body: JSON.stringify({ title, body, dedupeKey }) });
}

// ============================================================================
// MY TIMELINE — a real, immutable, GitHub-commit-style audit trail of this
// user's own actions (report uploaded/edited/deleted, a target changed, a
// plan uploaded, an assessment completed, etc.). Written directly by the
// user's own client (like daily_logs) for their own actions; admin-driven
// entries (a prescription issued, an order updated) are written server-side
// with service_role — see createActivityLog in server.ts.
// ============================================================================

export async function logActivity(
  userId: string,
  action: ActivityLogEntry['action'],
  category: ActivityLogEntry['category'],
  title: string,
  detail?: string,
  data?: Record<string, any>,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.from('activity_log').insert({ user_id: userId, action, category, title, detail: detail || null, data: data || {} });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('urcare:activity-logged'));
  } catch (err) {
    console.warn('logActivity failed:', err);
  }
}

export async function getActivityLog(userId: string, limit = 50): Promise<ActivityLogEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).map((r: any) => ({
    id: r.id,
    action: r.action,
    category: r.category,
    title: r.title,
    detail: r.detail || undefined,
    data: r.data || {},
    createdAt: r.created_at,
  }));
}

export async function getMyOrders(userId: string): Promise<Order[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from('orders').select('*, order_items(*)').eq('user_id', userId).order('created_at', { ascending: false });
  return (data || []).map((o: any) => ({
    id: o.id,
    userId: o.user_id,
    userName: o.customer_name,
    userEmail: o.customer_email,
    items: (o.order_items || []).map((it: any) => ({
      product: { id: it.product_id, name: it.product_name, image: it.product_image, price: it.price } as Product,
      quantity: it.quantity,
    })),
    shippingAddress: o.shipping_address,
    subtotal: o.total_amount,
    discount: 0,
    total: o.total_amount,
    paymentMethod: o.razorpay_order_id ? 'razorpay' : 'qr_upi',
    paymentStatus: o.payment_status,
    orderStatus: o.status,
    transactionId: o.razorpay_payment_id,
    createdAt: o.created_at,
    estimatedDelivery: '',
  }));
}

// ============================================================================
// CLINICAL FEEDBACK
// ============================================================================

export async function submitClinicalFeedback(feedback: FeedbackSubmission): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase is not configured.' };
  const { error } = await supabase.from('clinical_feedback').insert({
    id: feedback.id,
    user_id: feedback.userId,
    user_name: feedback.userName,
    day_cycle_number: feedback.dayCycleNumber,
    energy_rating: feedback.energyRating,
    digestion_rating: feedback.digestionRating,
    adherence_percentage: feedback.adherencePercentage,
    satiety_level: feedback.satietyLevel,
    improvement_suggestions: feedback.improvementSuggestions,
    created_at: feedback.createdAt,
  });
  return { success: !error, error: error?.message };
}

export async function getFeedbackHistory(userId: string): Promise<FeedbackSubmission[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from('clinical_feedback').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return (data || []).map((f: any) => ({
    id: f.id,
    userId: f.user_id,
    userName: f.user_name,
    dayCycleNumber: f.day_cycle_number,
    energyRating: f.energy_rating,
    digestionRating: f.digestion_rating,
    adherencePercentage: f.adherence_percentage,
    satietyLevel: f.satiety_level,
    improvementSuggestions: f.improvement_suggestions,
    createdAt: f.created_at,
  }));
}

// ============================================================================
// FOOD SCAN — persists every AI food scan result (server does the AI call and
// the insert; this just reads them back for history/logging views).
// ============================================================================

export async function getFoodScans(userId: string, sinceDate?: string): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  let query = supabase.from('food_scans').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (sinceDate) query = query.gte('created_at', sinceDate);
  const { data } = await query;
  return data || [];
}

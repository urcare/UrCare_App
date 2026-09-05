import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import {
  UserHealthProfile, UserAccount, DailyLog, MealItem,
  FeedbackSubmission, Order, Prescription, DoctorContact,
  MedicalReportAnalysis, Product, UserReview, CalculatedPlan,
  GoalType, GenderType, ActivityLevel, GoalPace,
} from '../types';
import { calculateNutritionPlan } from './calculator';

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseClient && supabaseUrl && supabaseAnonKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return { error: error?.message };
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

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
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
  return next;
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
// AI DAILY PLAN — fetched/generated via the server (needs Claude), but reads
// go straight to Supabase since that's just a select respecting RLS.
// ============================================================================

export async function getDailyPlan(userId: string, date: string): Promise<any | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from('ai_daily_plans').select('*').eq('user_id', userId).eq('plan_date', date).maybeSingle();
  return data;
}

export async function generateDailyPlan(date: string): Promise<{ plan?: any; error?: string }> {
  const res = await authedFetch('/api/daily-plan', { method: 'POST', body: JSON.stringify({ date }) });
  const data = await res.json();
  if (!res.ok) return { error: data.error || 'Could not generate today’s plan.' };
  return { plan: data.plan };
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
  }));
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

export async function saveOrderAndReceiptToSupabase(order: Order): Promise<{ success: boolean; orderId: string; error?: string }> {
  const res = await authedFetch('/api/orders', { method: 'POST', body: JSON.stringify(order) });
  const data = await res.json();
  if (!res.ok) return { success: false, orderId: order.id, error: data.error };
  return { success: true, orderId: data.order?.id || order.id };
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

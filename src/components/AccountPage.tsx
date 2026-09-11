import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, Phone, Flame, Edit3, LogOut, RefreshCw,
  Package, FileText, Camera, BadgeCheck, Sparkles, ChevronRight, Droplets,
  HeartPulse, Activity, Gauge, Zap, Wind, FlaskConical, Pencil, Check, X, ScanLine,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, MedicalReportAnalysis } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { updateAvatar, getDailyLog, addWaterIntake, resetWaterIntake, addQuickMacroLog, resetQuickMacroLog, addQuickCalorieLog, resetQuickCalorieLog, logActivity } from '../utils/supabase';
import { StreakWidget } from './StreakWidget';
import { MacroLogRow, BmiRangeBar, WaterIntakeRing } from './HealthCharts';
import { toDateKey } from './DailyCalendar';
import { REVERSAL_GOALS, DEFAULT_REVERSAL_GOAL } from './RecommendationsView';

function formatGoalLabel(goal?: string): string {
  if (!goal) return 'Reversal Plan';
  return goal.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// HEALTH VITALS — reads the user's own onboarding numbers (health deep-dive)
// and classifies each against standard clinical reference ranges. Nothing
// here is invented: a metric the user never entered renders as "Not
// Tracked" (grey) rather than a guessed value.
// ---------------------------------------------------------------------------
type VitalStatus = 'good' | 'attention' | 'high' | 'unknown';
const VITAL_STATUS_COLOR: Record<VitalStatus, string> = {
  good: '#008000', attention: '#f59e0b', high: '#ef4444', unknown: '#a1a1aa',
};
const VITAL_STATUS_LABEL: Record<VitalStatus, [string, string]> = {
  good: ['Normal', 'सामान्य'],
  attention: ['Needs Attention', 'ध्यान चाहिए'],
  high: ['High', 'अधिक'],
  unknown: ['Not Tracked', 'ट्रैक नहीं'],
};

function parseNum(v?: string): number | null {
  if (!v) return null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function fastingSugarStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 70) return 'attention';
  if (n <= 99) return 'good';
  if (n <= 125) return 'attention';
  return 'high';
}
function postMealSugarStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 140) return 'good';
  if (n < 200) return 'attention';
  return 'high';
}
function hba1cStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 5.7) return 'good';
  if (n < 6.5) return 'attention';
  return 'high';
}
function bpStatus(v?: string): VitalStatus {
  if (!v) return 'unknown';
  const m = String(v).match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return 'unknown';
  const sys = parseInt(m[1], 10);
  const dia = parseInt(m[2], 10);
  if (sys < 120 && dia < 80) return 'good';
  if (sys < 140 && dia < 90) return 'attention';
  return 'high';
}
function heartRateStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n >= 60 && n <= 100) return 'good';
  if (n >= 50 && n <= 110) return 'attention';
  return 'high';
}
function cholesterolStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 200) return 'good';
  if (n < 240) return 'attention';
  return 'high';
}
function spo2Status(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n >= 95) return 'good';
  if (n >= 90) return 'attention';
  return 'high';
}
function creatinineStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n <= 1.3) return 'good';
  if (n <= 2.0) return 'attention';
  return 'high';
}
function uricAcidStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n <= 7.2) return 'good';
  if (n <= 9) return 'attention';
  return 'high';
}

/** Maps a Biomarker's own 'normal'|'low'|'high'|'critical' status (as read
 *  straight off the uploaded report) onto our color notation — trusts the
 *  report's own call rather than re-parsing its value against a generic
 *  range, since the report already knows the right reference range for
 *  that specific test. */
function biomarkerToVitalStatus(status: string): VitalStatus {
  if (status === 'critical') return 'high';
  if (status === 'high' || status === 'low') return 'attention';
  if (status === 'normal') return 'good';
  return 'unknown';
}

/** Finds the first biomarker matching any of `keywords` (case-insensitive
 *  substring) across the user's reports, most recently uploaded first —
 *  so a newer report's reading always wins over an older one. */
function findBiomarker(reports: MedicalReportAnalysis[], keywords: string[]): { value: string; status: VitalStatus; reportName: string } | null {
  const sorted = [...reports].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  for (const report of sorted) {
    for (const b of report.biomarkers || []) {
      const name = (b.name || '').toLowerCase();
      if (keywords.some((k) => name.includes(k))) {
        return { value: b.value, status: biomarkerToVitalStatus(b.status), reportName: report.reportName };
      }
    }
  }
  return null;
}

/** Small three-band good/attention/high meter with an animated marker —
 *  same visual language as BmiRangeBar, positioned by status rather than
 *  the metric's exact value (each vital has its own scale/units, so one
 *  shared meter reads by "which zone" rather than claiming false
 *  precision). Hidden entirely when there's nothing to show a position for. */
function VitalStatusMeter({ status }: { status: VitalStatus }) {
  if (status === 'unknown') return null;
  const pct = status === 'good' ? 16 : status === 'attention' ? 50 : 84;
  return (
    <div className="relative h-1.5 rounded-full overflow-hidden flex">
      <div className="h-full bg-emerald-400" style={{ width: '33.33%' }} />
      <div className="h-full bg-amber-300" style={{ width: '33.33%' }} />
      <div className="h-full bg-rose-400" style={{ width: '33.34%' }} />
      <motion.div
        className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-zinc-950 ring-2 ring-white shadow"
        style={{ y: '-50%' }}
        initial={{ left: '0%', opacity: 0 }}
        animate={{ left: `${pct}%`, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
      />
    </div>
  );
}

const GOAL_LABEL_HI: Record<string, string> = {
  lose_weight: 'वज़न घटाना',
  build_muscle: 'मांसपेशी बनाना',
  maintain_tone: 'टोन बनाए रखना',
  improve_health: 'स्वास्थ्य सुधारना',
  reverse_condition: 'स्थिति को उलटना',
  '': 'रिवर्सल योजना',
};

// Hindi display text for the REVERSAL_GOALS tiles (imported from
// RecommendationsView) — keyed by the English label since that's what
// REVERSAL_GOALS itself uses as the display value, not a stored/matched id.
const REVERSAL_GOAL_LABEL_HI: Record<string, { label: string; note: string }> = {
  'Diabetes Reversal': { label: 'डायबिटीज रिवर्सल', note: 'कम-GI भोजन, स्थिर ब्लड शुगर' },
  'Weight Reversal': { label: 'वज़न रिवर्सल', note: 'कैलोरी डेफिसिट, उच्च प्रोटीन' },
  'Blood Pressure Control': { label: 'ब्लड प्रेशर नियंत्रण', note: 'कम सोडियम, पोटैशियम युक्त भोजन' },
  'Liver & Lipid Reversal': { label: 'लिवर व लिपिड रिवर्सल', note: 'कम सैचुरेटेड फैट, अधिक फाइबर' },
  'Thyroid Balance': { label: 'थायरॉइड संतुलन', note: 'आयोडीन के प्रति सजग, सूजन-रोधी' },
  'Hormonal Reversal': { label: 'हार्मोनल रिवर्सल', note: 'कम-GI, सूजन-रोधी आहार' },
  'Nerve Health': { label: 'नस स्वास्थ्य', note: 'विटामिन-B युक्त, ब्लड शुगर नियंत्रण' },
  'Eye Health Support': { label: 'आंखों के स्वास्थ्य हेतु सहयोग', note: 'एंटीऑक्सीडेंट युक्त, शुगर नियंत्रण' },
  'Heart Reversal': { label: 'हृदय रिवर्सल', note: 'कम सोडियम, ओमेगा-3 युक्त' },
  'Kidney Reversal': { label: 'किडनी रिवर्सल', note: 'नियंत्रित प्रोटीन व सोडियम' },
  'Joint & Mobility Support': { label: 'जोड़ व गतिशीलता सहयोग', note: 'सूजन-रोधी भोजन' },
  'Energy Restoration': { label: 'ऊर्जा पुनर्स्थापन', note: 'आयरन व B12 युक्त, स्थिर भोजन' },
  'Sleep Quality Support': { label: 'नींद गुणवत्ता सहयोग', note: 'हल्का रात्रि भोजन, देर रात कैफीन नहीं' },
  'Vascular Health': { label: 'रक्त वाहिका स्वास्थ्य', note: 'हृदय-अनुकूल, रक्त संचार सहयोग' },
  'Uric Acid Reversal': { label: 'यूरिक एसिड रिवर्सल', note: 'कम प्यूरीन, अधिक पानी' },
  'Gut Health Reversal': { label: 'आंत स्वास्थ्य रिवर्सल', note: 'फाइबर-संतुलित, आंत-अनुकूल' },
  'Metabolic Health': { label: 'मेटाबॉलिक स्वास्थ्य', note: 'संतुलित पोषण, स्थिर ऊर्जा' },
};

interface AccountPageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateProfile: (updated: UserHealthProfile) => void;
  onUpdateAccount?: (updated: UserAccount) => void;
  reports: MedicalReportAnalysis[];
  onOpenOrders: () => void;
  onOpenReports: () => void;
  onOpenAssessment: () => void;
  onLogOut: () => void;
}

/** Downscales/compresses an image file to a small square JPEG data URL before
 *  it's saved — a full-resolution photo has no business living inline in a
 *  database row that gets fetched on every page load. */
function resizeImageToDataUrl(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Could not read this image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read this file'));
    reader.readAsDataURL(file);
  });
}

/** "Profile" — identity, body/health stats, nutrition targets and quick
 *  actions, as its own destination (separate from "Your Daily Plan"). */
export const AccountPage: React.FC<AccountPageProps> = ({
  profile,
  account,
  onUpdateProfile,
  onUpdateAccount,
  reports,
  onOpenOrders,
  onOpenReports,
  onOpenAssessment,
  onLogOut,
}) => {
  const { t, language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Today's real logged water + macros — see WaterIntakeRing / MacroLogRow
  // (both editable) below. Macros are summed from the same real `meals`
  // array the food scanner writes to (a manual "+10g protein" tap just adds
  // a lightweight meal entry — see addQuickMacroLog), so a quick log and a
  // scanned meal both count toward the same real daily total.
  const userId = profile.id || '';
  const todayKey = toDateKey(new Date());
  const [waterMl, setWaterMl] = useState(0);
  const [consumedMacros, setConsumedMacros] = useState({ protein: 0, carbs: 0, fats: 0 });
  const [consumedCalories, setConsumedCalories] = useState(0);
  const [isSavingWater, setIsSavingWater] = useState(false);
  const [isSavingMacro, setIsSavingMacro] = useState(false);
  const [isSavingCalories, setIsSavingCalories] = useState(false);

  const refreshDailyLog = useCallback(() => {
    if (!userId) return;
    getDailyLog(userId, todayKey).then((log) => {
      setWaterMl(log?.waterMl || 0);
      const meals = log?.meals || [];
      setConsumedMacros({
        protein: meals.reduce((sum, m) => sum + (m.protein || 0), 0),
        carbs: meals.reduce((sum, m) => sum + (m.carbs || 0), 0),
        fats: meals.reduce((sum, m) => sum + (m.fats || 0), 0),
      });
      setConsumedCalories(meals.reduce((sum, m) => sum + (m.calories || 0), 0));
    });
  }, [userId, todayKey]);

  useEffect(() => {
    refreshDailyLog();
  }, [refreshDailyLog]);

  // Scanning a meal, or logging water/macros from elsewhere (e.g. Home),
  // fires this — keeps this screen in sync without needing its own polling.
  useEffect(() => {
    window.addEventListener('urcare:daily-log-changed', refreshDailyLog);
    return () => window.removeEventListener('urcare:daily-log-changed', refreshDailyLog);
  }, [refreshDailyLog]);

  // Real water intake, capped at the real target — never invents an
  // "over target" number the way the macros deliberately allow (protein/
  // carbs/fat going over is useful info; hydration is a simpler
  // "did you hit it" goal), and celebrates the moment it's actually hit.
  const handleAddWater = async (deltaMl: number) => {
    if (!userId) return;
    const remaining = Math.max(0, waterTargetMl - waterMl);
    if (remaining <= 0) return; // already at/over target — nothing more to log
    const cappedDelta = Math.min(deltaMl, remaining);
    const willReachTarget = waterMl + cappedDelta >= waterTargetMl;

    setIsSavingWater(true);
    setWaterMl((prev) => Math.min(waterTargetMl, prev + cappedDelta)); // optimistic
    try {
      const confirmed = await addWaterIntake(userId, todayKey, cappedDelta);
      setWaterMl(Math.min(waterTargetMl, confirmed));
      if (willReachTarget) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#0ea5e9', '#2dd4bf', '#ffffff'] });
      }
    } finally {
      setIsSavingWater(false);
    }
  };

  const handleResetWater = async () => {
    if (!userId) return;
    setIsSavingWater(true);
    setWaterMl(0); // optimistic — safe here, unlike macros every ml comes through this same UI
    try {
      await resetWaterIntake(userId, todayKey);
    } finally {
      setIsSavingWater(false);
    }
  };

  const handleEditWaterTarget = (newTargetMl: number) => {
    onUpdateProfile({
      ...profile,
      preferences: { ...(profile.preferences as any || {}), customWaterTargetMl: newTargetMl },
    });
    if (userId) logActivity(userId, 'updated', 'target', `Changed water target to ${(newTargetMl / 1000).toFixed(1)}L`).catch(() => {});
  };

  // Real macro intake, capped at the real target — same "won't go past,
  // celebrates the moment it's actually hit" treatment as water below.
  const handleAddMacro = async (macro: 'protein' | 'carbs' | 'fats', grams: number) => {
    if (!userId) return;
    const target = macroTargets[macro];
    const current = consumedMacros[macro];
    const remaining = Math.max(0, target - current);
    if (remaining <= 0) return; // already at/over target — nothing more to log
    const cappedGrams = Math.min(grams, remaining);
    const willReachTarget = current + cappedGrams >= target;

    setIsSavingMacro(true);
    setConsumedMacros((prev) => ({ ...prev, [macro]: Math.min(target, prev[macro] + cappedGrams) })); // optimistic
    try {
      await addQuickMacroLog(userId, todayKey, macro, cappedGrams);
      refreshDailyLog(); // addMealToLog doesn't return a confirmed total, so re-sync from the real row
      if (willReachTarget) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#ffffff'] });
      }
    } finally {
      setIsSavingMacro(false);
    }
  };

  // Clears only the manually-logged amount (never a real scanned meal — see
  // resetQuickMacroLog) — no optimistic zeroing, since a real scanned meal's
  // contribution to this macro should stay visible until refreshDailyLog
  // confirms the real post-reset total.
  const handleResetMacro = async (macro: 'protein' | 'carbs' | 'fats') => {
    if (!userId) return;
    setIsSavingMacro(true);
    try {
      await resetQuickMacroLog(userId, todayKey, macro);
      refreshDailyLog();
    } finally {
      setIsSavingMacro(false);
    }
  };

  // A macro's target is the profile's own calculated plan value, unless the
  // user has overridden it here (persisted to profile.preferences — see
  // customMacroTargets in types.ts).
  const handleEditMacroTarget = (macro: 'protein' | 'carbs' | 'fats', newTargetG: number) => {
    onUpdateProfile({
      ...profile,
      preferences: {
        ...(profile.preferences as any || {}),
        customMacroTargets: { ...(profile.preferences?.customMacroTargets || {}), [macro]: newTargetG },
      },
    });
    if (userId) logActivity(userId, 'updated', 'target', `Changed ${macro} target to ${newTargetG}g`).catch(() => {});
  };

  const handleAddCalories = async (kcal: number) => {
    if (!userId) return;
    const remaining = Math.max(0, calorieTarget - consumedCalories);
    if (remaining <= 0) return; // already at/over target — nothing more to log
    const cappedKcal = Math.min(kcal, remaining);
    const willReachTarget = consumedCalories + cappedKcal >= calorieTarget;

    setIsSavingCalories(true);
    setConsumedCalories((prev) => Math.min(calorieTarget, prev + cappedKcal)); // optimistic
    try {
      await addQuickCalorieLog(userId, todayKey, cappedKcal);
      refreshDailyLog();
      if (willReachTarget) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#f59e0b', '#ffffff'] });
      }
    } finally {
      setIsSavingCalories(false);
    }
  };

  const handleResetCalories = async () => {
    if (!userId) return;
    setIsSavingCalories(true);
    try {
      await resetQuickCalorieLog(userId, todayKey);
      refreshDailyLog();
    } finally {
      setIsSavingCalories(false);
    }
  };

  const handleEditCalorieTarget = (newTarget: number) => {
    onUpdateProfile({
      ...profile,
      preferences: { ...(profile.preferences as any || {}), customCalorieTarget: newTarget },
    });
    if (userId) logActivity(userId, 'updated', 'target', `Changed calorie target to ${newTarget} kcal`).catch(() => {});
  };

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError(tr('Please choose an image file.', 'कृपया एक इमेज फ़ाइल चुनें।'));
      return;
    }
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const { error } = await updateAvatar(account.uid, dataUrl);
      if (error) throw new Error(error);
      onUpdateAccount?.({ ...account, avatarUrl: dataUrl });
      if (account.uid) logActivity(account.uid, 'updated', 'profile', 'Updated profile photo').catch(() => {});
    } catch (err: any) {
      setAvatarError(err.message || tr('Could not save your photo. Please try again.', 'आपकी फोटो सहेजी नहीं जा सकी। कृपया पुनः प्रयास करें।'));
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const { calculatedPlan, heightCm = 170, age = 28, gender = 'male' } = profile;
  const bmi = calculatedPlan?.bmi || Number((profile.currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
  const waterTargetMl = profile.preferences?.customWaterTargetMl ?? (calculatedPlan?.waterLiters || 3.2) * 1000;
  const calorieTarget = profile.preferences?.customCalorieTarget ?? (calculatedPlan?.targetCalories || 1850);
  const macroTargets: Record<'protein' | 'carbs' | 'fats', number> = {
    protein: profile.preferences?.customMacroTargets?.protein ?? (calculatedPlan?.proteinGrams || 130),
    carbs: profile.preferences?.customMacroTargets?.carbs ?? (calculatedPlan?.carbsGrams || 180),
    fats: profile.preferences?.customMacroTargets?.fats ?? (calculatedPlan?.fatsGrams || 50),
  };

  // Same condition-by-condition "reversal focus" tiles the Daily Plan used
  // to lead with — purely derived from the profile, so it belongs here.
  const reversalGoals = useMemo(() => {
    const conditions = (profile.medicalConditions || []).filter((c) => c !== 'None' && c !== 'Other');
    const goals = conditions.map((c) => REVERSAL_GOALS[c]).filter(Boolean);
    return goals.length > 0 ? goals : [DEFAULT_REVERSAL_GOAL];
  }, [profile.medicalConditions]);

  // Key health vitals — one shared source of truth: profile.healthDeepDive
  // (the same object onboarding writes to, and RootCauseAssessmentModal
  // reads from). For any metric the user hasn't entered there, falls back
  // to a matching biomarker from their most recently uploaded lab report;
  // editing a row here writes straight back into healthDeepDive, so it's
  // instantly the value every other module sees too. Thyroid has no
  // numeric reading, so it's flagged from the reported condition list.
  const dd: any = profile.healthDeepDive || {};
  const hasThyroidCondition = (profile.medicalConditions || []).includes('Thyroid (Hypo/Hyper)');
  const [editingVital, setEditingVital] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingVital, setIsSavingVital] = useState(false);

  const vitals = useMemo(() => {
    // ddKey → { value, status, source, unit } — a report only fills in what
    // onboarding left blank; a value the user typed always wins.
    const resolve = (
      ddKey: string,
      unit: string,
      statusFn: (v?: string) => VitalStatus,
      keywords: string[],
    ) => {
      const ddRaw = dd[ddKey];
      if (ddRaw) {
        return { rawValue: String(ddRaw), value: `${ddRaw}${unit}`, status: statusFn(String(ddRaw)), source: 'onboarding' as const, sourceReportName: undefined as string | undefined };
      }
      const match = findBiomarker(reports, keywords);
      if (match) {
        return { rawValue: match.value.replace(/[^\d.\-/]/g, ''), value: match.value, status: match.status, source: 'report' as const, sourceReportName: match.reportName };
      }
      return { rawValue: '', value: null as string | null, status: 'unknown' as VitalStatus, source: 'unknown' as const, sourceReportName: undefined as string | undefined };
    };

    return [
      {
        key: 'fastingSugar', ddKey: 'fastingSugar', icon: Droplets, placeholder: 'e.g. 95',
        label: tr('Fasting Blood Sugar', 'फास्टिंग ब्लड शुगर'),
        hint: tr('Normal: 70–99 mg/dL', 'सामान्य: 70–99 mg/dL'),
        ...resolve('fastingSugar', ' mg/dL', fastingSugarStatus, ['fasting glucose', 'fasting blood sugar', 'fasting plasma glucose', 'fpg']),
      },
      {
        key: 'postMealSugar', ddKey: 'postMealSugar', icon: Droplets, placeholder: 'e.g. 130',
        label: tr('Post-Meal Blood Sugar', 'भोजन-बाद ब्लड शुगर'),
        hint: tr('Normal: below 140 mg/dL', 'सामान्य: 140 mg/dL से कम'),
        ...resolve('postMealSugar', ' mg/dL', postMealSugarStatus, ['post prandial', 'postprandial', 'pp glucose', 'post meal glucose', 'ppbs']),
      },
      {
        key: 'hba1c', ddKey: 'hba1c', icon: Gauge, placeholder: 'e.g. 5.6',
        label: tr('HbA1c', 'HbA1c'),
        hint: tr('Normal: below 5.7%', 'सामान्य: 5.7% से कम'),
        ...resolve('hba1c', '%', hba1cStatus, ['hba1c', 'glycated hemoglobin', 'a1c']),
      },
      {
        key: 'bloodPressure', ddKey: 'bloodPressure', icon: Activity, placeholder: 'e.g. 120/80',
        label: tr('Blood Pressure', 'ब्लड प्रेशर'),
        hint: tr('Normal: below 120/80 mmHg', 'सामान्य: 120/80 mmHg से कम'),
        ...resolve('bloodPressure', ' mmHg', bpStatus, ['blood pressure', ' bp ', 'bp:']),
      },
      {
        key: 'restingHeartRate', ddKey: 'restingHeartRate', icon: HeartPulse, placeholder: 'e.g. 72',
        label: tr('Resting Heart Rate', 'आराम में हृदय गति'),
        hint: tr('Normal: 60–100 bpm', 'सामान्य: 60–100 bpm'),
        ...resolve('restingHeartRate', ' bpm', heartRateStatus, ['heart rate', 'pulse rate', 'pulse']),
      },
      {
        key: 'totalCholesterol', ddKey: 'totalCholesterol', icon: FlaskConical, placeholder: 'e.g. 180',
        label: tr('Total Cholesterol', 'कुल कोलेस्ट्रॉल'),
        hint: tr('Normal: below 200 mg/dL', 'सामान्य: 200 mg/dL से कम'),
        ...resolve('totalCholesterol', ' mg/dL', cholesterolStatus, ['total cholesterol', 'cholesterol']),
      },
      {
        key: 'spo2', ddKey: 'spo2', icon: Wind, placeholder: 'e.g. 98',
        label: tr('Oxygen Saturation (SpO2)', 'ऑक्सीजन सैचुरेशन (SpO2)'),
        hint: tr('Normal: 95% and above', 'सामान्य: 95% व अधिक'),
        ...resolve('spo2', '%', spo2Status, ['spo2', 'oxygen saturation', 'sp02']),
      },
      {
        key: 'creatinine', ddKey: 'creatinine', icon: FlaskConical, placeholder: 'e.g. 0.9',
        label: tr('Creatinine (Kidney)', 'क्रिएटिनिन (किडनी)'),
        hint: tr('Normal: 0.6–1.3 mg/dL', 'सामान्य: 0.6–1.3 mg/dL'),
        ...resolve('creatinine', ' mg/dL', creatinineStatus, ['creatinine']),
      },
      {
        key: 'uricAcid', ddKey: 'uricAcid', icon: FlaskConical, placeholder: 'e.g. 5.5',
        label: tr('Uric Acid', 'यूरिक एसिड'),
        hint: tr('Normal: below 7.2 mg/dL', 'सामान्य: 7.2 mg/dL से कम'),
        ...resolve('uricAcid', ' mg/dL', uricAcidStatus, ['uric acid']),
      },
      {
        key: 'thyroid', ddKey: '', icon: Zap, placeholder: '',
        label: tr('Thyroid Status', 'थायरॉइड स्थिति'),
        hint: tr('Based on your reported conditions', 'आपकी दर्ज स्थितियों पर आधारित'),
        rawValue: '',
        value: hasThyroidCondition ? tr('Condition Reported', 'स्थिति दर्ज') : tr('No Concerns Flagged', 'कोई चिंता नहीं मिली'),
        status: hasThyroidCondition ? 'attention' as VitalStatus : 'good' as VitalStatus,
        source: 'onboarding' as const,
        sourceReportName: undefined as string | undefined,
      },
    ];
  }, [dd, reports, hasThyroidCondition, language]);

  const startEditVital = (key: string, rawValue: string) => {
    setEditValue(rawValue);
    setEditingVital(key);
  };

  // Writes straight into profile.healthDeepDive — the same field onboarding
  // and the Root Cause Assessment both read, so a value fixed here (or
  // pulled in from a report and confirmed here) is immediately the value
  // every module sees, not a separate copy.
  const handleSaveVital = (ddKey: string, label: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingVital(null); return; }
    setIsSavingVital(true);
    onUpdateProfile({
      ...profile,
      healthDeepDive: { ...dd, [ddKey]: trimmed },
    });
    if (userId) logActivity(userId, 'updated', 'profile', tr(`Updated ${label}`, `${label} अपडेट किया`)).catch(() => {});
    setIsSavingVital(false);
    setEditingVital(null);
  };

  return (
    <div id="urcare-account-page" className="min-h-screen bg-transparent text-zinc-900 pb-16">

      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-3 sm:px-8 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-emerald-700 tracking-wide whitespace-nowrap">{t('navProfile')}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-5 text-left">

        {/* IDENTITY — centered avatar with an edit badge, name, email below;
            a plain, calm identity header instead of a side-by-side card. */}
        <div className="flex flex-col items-center text-center pt-2 pb-1">
          <div className="relative shrink-0">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelected}
            />
            <div className="w-24 h-24 rounded-full bg-emerald-600 text-white flex items-center justify-center text-3xl font-black shadow-md overflow-hidden ring-4 ring-white">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (profile.name || account.displayName || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              title={tr('Change photo', 'फोटो बदलें')}
              className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-md flex items-center justify-center text-white hover:bg-emerald-500 cursor-pointer disabled:opacity-60"
            >
              {isUploadingAvatar ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center mt-3">
            <h1 className="text-xl font-black text-zinc-950 break-words">
              {profile.name || account.displayName || tr('UrCare Member', 'UrCare सदस्य')}
            </h1>
            <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/15 shrink-0" strokeWidth={2.5} />
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-0.5 break-all">
            {profile.email || account.email}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center text-[11px] text-zinc-400 font-semibold mt-1.5">
            {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{profile.phone}</span>}
            <span>{gender.toUpperCase()} • {age} {tr('YRS', 'वर्ष')}</span>
          </div>

          {avatarError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mt-3">{avatarError}</p>
          )}
        </div>

        {/* Streak — moved here from the Daily Plan's top header, since it's
            a personal stat about the user rather than part of today's plan. */}
        <div className="flex justify-start">
          <StreakWidget profile={profile} />
        </div>

        {/* YOUR REVERSAL FOCUS — condition-derived focus tiles, the same
            data the Daily Plan used to lead with; purely static (no daily
            task tracking), so it belongs here rather than on that page. */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-3">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-600">
            {tr('Your Reversal Focus', 'आपका रिवर्सल फोकस')}
          </h3>
          <div className={`grid gap-2.5 sm:gap-3 ${reversalGoals.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {reversalGoals.map((goal) => {
              const GoalIcon = goal.icon;
              return (
                <div key={goal.label} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${goal.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                    <GoalIcon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-black text-zinc-900 truncate">{tr(goal.label, REVERSAL_GOAL_LABEL_HI[goal.label]?.label || goal.label)}</div>
                    <div className="text-[10px] sm:text-[11px] text-zinc-500 font-semibold truncate">{tr(goal.note, REVERSAL_GOAL_LABEL_HI[goal.label]?.note || goal.note)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BODY & HEALTH OVERVIEW STATS (SIMPLE & EASY TO UNDERSTAND) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('Current Weight', 'वर्तमान वज़न')}</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {profile.currentWeightKg} <span className="text-xs font-semibold text-zinc-400">kg</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {(profile.currentWeightKg * 2.20462).toFixed(1)} lbs
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{tr('Target Goal', 'लक्ष्य वज़न')}</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">
              {profile.targetWeightKg} <span className="text-xs font-semibold text-emerald-700">kg</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-bold block">
              {tr(formatGoalLabel(profile.goal), GOAL_LABEL_HI[profile.goal || ''] || formatGoalLabel(profile.goal))}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('Height', 'कद')}</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {heightCm} <span className="text-xs font-semibold text-zinc-400">cm</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {Math.floor((heightCm / 2.54) / 12)} ft {Math.round((heightCm / 2.54) % 12)} in
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('BMI Status', 'बीएमआई स्थिति')}</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {bmi}
            </div>
            <span className="text-[10px] font-bold text-emerald-700 block">
              {bmi < 18.5 ? tr('Underweight', 'कम वज़न') : bmi < 25 ? tr('Normal (Healthy)', 'सामान्य (स्वस्थ)') : bmi < 30 ? tr('Overweight', 'अधिक वज़न') : tr('Need Reversal', 'रिवर्सल आवश्यक')}
            </span>
            <BmiRangeBar bmi={bmi} tr={tr} />
          </div>

        </div>

        {/* HEALTH VITALS & KEY MARKERS — same card language as Daily
            Nutrition & Water Targets below, but for the clinical numbers
            (blood sugar, BP, HbA1c, heart rate, thyroid) instead of diet.
            Every row is colour-coded (green/amber/red/grey) against
            standard reference ranges — now carried through the whole card
            (tinted wash + accent edge, not just a small badge) — and a
            metric never entered during onboarding shows plainly as
            "Not Tracked" rather than being hidden or guessed. */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <motion.span
                className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              >
                <HeartPulse className="w-4.5 h-4.5" />
              </motion.span>
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
                {tr('Health Vitals & Key Markers', 'स्वास्थ्य वाइटल्स व प्रमुख मार्कर')}
              </h3>
            </div>
            <div className="flex items-center gap-2.5 text-[9px] font-bold text-zinc-400 shrink-0">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: VITAL_STATUS_COLOR.good }} />{tr(...VITAL_STATUS_LABEL.good)}</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: VITAL_STATUS_COLOR.attention }} />{tr(...VITAL_STATUS_LABEL.attention)}</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: VITAL_STATUS_COLOR.high }} />{tr(...VITAL_STATUS_LABEL.high)}</span>
            </div>
          </div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          >
            {vitals.map((v) => {
              const color = VITAL_STATUS_COLOR[v.status];
              const VitalIcon = v.icon;
              const isEditing = editingVital === v.key;
              const isEditable = !!v.ddKey;
              const isHigh = v.status === 'high';
              return (
                <motion.div
                  key={v.key}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -2, boxShadow: '0 6px 16px -8px rgba(0,0,0,0.18)' }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="p-3 rounded-2xl space-y-2 border-l-[3px]"
                  style={{ background: `${color}0c`, borderColor: `${color}55`, borderLeftColor: color }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <motion.span
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${color}1a`, color }}
                        animate={isHigh ? { scale: [1, 1.1, 1] } : {}}
                        transition={isHigh ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                      >
                        <VitalIcon className="w-4 h-4" />
                      </motion.span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-800 truncate">{v.label}</div>
                        <div className="text-[9px] text-zinc-400 font-medium truncate">{v.hint}</div>
                      </div>
                    </div>

                    {!isEditing && (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${v.status}-${v.value}`}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.25 }}
                          className="text-right shrink-0"
                        >
                          <div className={`text-xs sm:text-sm font-black ${v.value ? 'text-zinc-900' : 'text-zinc-400'}`}>
                            {v.value || tr('Not tracked', 'ट्रैक नहीं')}
                          </div>
                          <span
                            className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide"
                            style={{ background: `${color}1a`, color }}
                          >
                            {tr(...VITAL_STATUS_LABEL[v.status])}
                          </span>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>

                  {!isEditing && <VitalStatusMeter status={v.status} />}

                  {/* Source tag — tells the user where this number came from,
                      and lets them tell a report-sourced value apart from
                      one they (or onboarding) confirmed themselves. */}
                  {!isEditing && v.source === 'report' && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-violet-600">
                      <ScanLine className="w-3 h-3 shrink-0" />
                      <span className="truncate">{tr('From report:', 'रिपोर्ट से:')} {v.sourceReportName}</span>
                    </div>
                  )}

                  <AnimatePresence mode="wait" initial={false}>
                    {isEditable && !isEditing && (
                      <motion.button
                        key="view"
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => startEditVital(v.key, v.rawValue)}
                        className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>{v.source === 'report' ? tr('Confirm or edit', 'पुष्टि करें या संपादित करें') : v.value ? tr('Edit', 'संपादित करें') : tr('Add manually', 'खुद जोड़ें')}</span>
                      </motion.button>
                    )}

                    {isEditable && isEditing && (
                      <motion.div
                        key="edit"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-1.5 overflow-hidden"
                      >
                        <input
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVital(v.ddKey, v.label); if (e.key === 'Escape') setEditingVital(null); }}
                          placeholder={v.placeholder}
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          disabled={isSavingVital}
                          onClick={() => handleSaveVital(v.ddKey, v.label)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer disabled:opacity-50"
                          title={tr('Save', 'सहेजें')}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingVital(null)}
                          className="p-1.5 rounded-lg bg-zinc-200 text-zinc-500 cursor-pointer"
                          title={tr('Cancel', 'रद्द करें')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>

          <p className="text-[10px] text-zinc-400 leading-relaxed">
            {tr('Auto-filled from your Root Cause Assessment or latest lab report where available — tap any card to confirm or edit it yourself. Saved changes update everywhere this number is used.', 'जहां उपलब्ध हो वहां आपके रूट कॉज़ असेसमेंट या नवीनतम लैब रिपोर्ट से भरा गया — किसी भी कार्ड को पुष्टि या संपादित करने के लिए टैप करें। सहेजे गए बदलाव हर जगह अपडेट होंगे जहां यह नंबर उपयोग होता है।')}
          </p>
        </div>

        {/* DAILY NUTRITION & WATER TARGETS */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <motion.span
              className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            >
              <Flame className="w-4.5 h-4.5" />
            </motion.span>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
              {tr('Daily Nutrition & Water Targets', 'दैनिक पोषण व पानी के लक्ष्य')}
            </h3>
          </div>

          {/* Calories — real logged-so-far vs the plan's calculated target,
              same as the macros below; full-width since it's the headline
              number. No edit-target control here (unlike the macros) — the
              calorie target is derived straight from the plan, not meant to
              be hand-tuned independently of it. */}
          <MacroLogRow
            label={tr('Calories', 'कैलोरी')}
            color="#f59e0b"
            unit=" kcal"
            currentG={Math.min(calorieTarget, Math.round(consumedCalories))}
            targetG={calorieTarget}
            quickAdds={[100, 250]}
            onAdd={handleAddCalories}
            onReset={handleResetCalories}
            isSaving={isSavingCalories}
            tr={tr}
          />

          {/* Macros — each one real, editable, logged-so-far vs target
              (with the target itself editable too), instead of three flat
              read-only stat boxes. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <MacroLogRow
              label={tr('Protein', 'प्रोटीन')}
              color="#1baf7a"
              currentG={Math.min(macroTargets.protein, Math.round(consumedMacros.protein))}
              targetG={macroTargets.protein}
              quickAdds={[10, 20]}
              onAdd={(g) => handleAddMacro('protein', g)}
              onEditTarget={(g) => handleEditMacroTarget('protein', g)}
              onReset={() => handleResetMacro('protein')}
              isSaving={isSavingMacro}
              tr={tr}
            />
            <MacroLogRow
              label={tr('Carbs', 'कार्ब्स')}
              color="#2a78d6"
              currentG={Math.min(macroTargets.carbs, Math.round(consumedMacros.carbs))}
              targetG={macroTargets.carbs}
              quickAdds={[15, 30]}
              onAdd={(g) => handleAddMacro('carbs', g)}
              onEditTarget={(g) => handleEditMacroTarget('carbs', g)}
              onReset={() => handleResetMacro('carbs')}
              isSaving={isSavingMacro}
              tr={tr}
            />
            <MacroLogRow
              label={tr('Fats', 'फैट्स')}
              color="#78716c"
              currentG={Math.min(macroTargets.fats, Math.round(consumedMacros.fats))}
              targetG={macroTargets.fats}
              quickAdds={[5, 10]}
              onAdd={(g) => handleAddMacro('fats', g)}
              onEditTarget={(g) => handleEditMacroTarget('fats', g)}
              onReset={() => handleResetMacro('fats')}
              isSaving={isSavingMacro}
              tr={tr}
            />
          </div>

          {/* Water — real, editable log against the plan's real target, not
              just a static number. Its own teal-tinted gradient card (vs.
              the macros' plain zinc-50) so hydration reads as its own
              premium moment rather than a fourth identical macro row. */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, boxShadow: '0 8px 20px -10px rgba(13,148,136,0.35)' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-50 via-sky-50/60 to-white border border-teal-100"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-teal-700 uppercase tracking-wide">
                <Droplets className="w-3 h-3" />
                {tr('Water Intake Today', 'आज पानी की मात्रा')}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">{tr('Daily hydration', 'दैनिक जल सेवन')}</span>
            </div>
            <WaterIntakeRing
              currentMl={Math.min(waterMl, waterTargetMl)}
              targetMl={waterTargetMl}
              onAdd={handleAddWater}
              onEditTarget={handleEditWaterTarget}
              onReset={handleResetWater}
              isSaving={isSavingWater}
              tr={tr}
            />
          </motion.div>
        </div>

        {/* ACCOUNT — a single tappable list, one row per action, instead of
            a grid of separate cards; each row keeps its real destination. */}
        <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100">
          <button
            type="button"
            onClick={onOpenAssessment}
            className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Edit3 className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-zinc-900 flex-1 min-w-0 truncate">{tr('Edit Health Profile', 'स्वास्थ्य प्रोफ़ाइल संपादित करें')}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenReports}
            className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-zinc-900 flex-1 min-w-0 truncate">{tr('Lab Reports', 'लैब रिपोर्ट्स')}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenOrders}
            className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Package className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-zinc-900 flex-1 min-w-0 truncate">{tr('My Orders', 'मेरे ऑर्डर')}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>
        </div>

        {/* LOG OUT */}
        <button
          type="button"
          onClick={onLogOut}
          className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{tr('Log Out', 'लॉग आउट')}</span>
        </button>

      </main>
    </div>
  );
};

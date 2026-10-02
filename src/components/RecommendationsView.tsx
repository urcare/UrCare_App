import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, ChevronRight, ChevronDown,
  FileText, Award, Circle, Check, Plus,
  RefreshCw, AlertCircle, Clock, Calendar as CalendarIcon,
  Sunrise, Sun, Sunset, Moon, Edit3, AlertTriangle, Trash2,
  Droplet, Scale, HeartPulse, Eye, Bone, Zap, Flame, Leaf, Activity, Sparkles, Utensils,
  Pill, Dumbbell, Bath, BedDouble, Youtube, Upload, Stethoscope, Info,
} from 'lucide-react';
import { UserHealthProfile, Prescription, CustomPlanStep, FamilyMember } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { DailyCalendar, toDateKey } from './DailyCalendar';
import { PlanSection } from './ReversalLibraryPanel';
import { WeeklyUpdatesPanel } from './WeeklyUpdatesPanel';
import { FamilyViewSwitcher } from './FamilyViewSwitcher';
import { unifiedProgramDay } from '../utils/programWeek';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import {
  getDailyPlan, getDailyLog, getTaskCompletion,
  toggleDailyTask, getActiveDates,
  addCustomPlanStep, getCustomPlanSteps, deleteCustomPlanStep,
  getFamilyMembers, getPlanChoice, savePlanChoice, updateUploadedPlan, deleteUploadedPlan,
  UploadedPlan,
} from '../utils/supabase';
import { UploadedPlanEditor } from './UploadedPlanEditor';

// Lazy — pulls in pdfjs-dist (for the "upload a long PDF" flow), which has
// no business being in everyone's initial bundle just because this tab
// exists; only fetched the first time someone actually opens this modal.
const UploadDailyPlanModal = React.lazy(() => import('./UploadDailyPlanModal').then((m) => ({ default: m.UploadDailyPlanModal })));

/** A timeline row is either a built-in reversal-plan section or the user's
 *  own addition (see custom_plan_steps) — the latter also carries the real
 *  safety verdict it was reviewed with at creation (see /api/custom-plan-steps). */
type TimelineItem = PlanSection & { isCustom?: boolean; verdict?: 'yellow' | 'red'; verdictReason?: string };

/** Converts an <input type="time"> value ("14:05") to this app's "2:05 PM"
 *  label convention, so a custom step sorts/groups exactly like a built-in
 *  one (see labelMinutes/periodFor above). */
function to12HourLabel(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

interface RecommendationsViewProps {
  profile: UserHealthProfile;
  prescriptions?: Prescription[];
  onOpenStore?: () => void;
  onOpenProModal?: (feature: string) => void;
  /** Called whenever this day's non-time-bound reference rows (condition
   *  library, recipes, vitamins...) change, so a parent can render them
   *  statically in its own sidebar instead of inline here. */
  onReferenceSections?: (sections: PlanSection[]) => void;
}

/** Maps each onboarding condition label (see CONDITION_LABEL_TO_TAG in
 *  server.ts — kept in sync with that exact label list) to a short,
 *  premium-looking "reversal focus" tile shown on today's goals card,
 *  instead of generic macro numbers. */
export const REVERSAL_GOALS: Record<string, { label: string; note: string; icon: typeof Droplet; gradient: string }> = {
  'Diabetes / Pre-Diabetes': { label: 'Diabetes Reversal', note: 'Low-GI meals, steady blood sugar', icon: Droplet, gradient: 'from-sky-500 to-blue-600' },
  'Obesity': { label: 'Weight Reversal', note: 'Calorie deficit, high protein', icon: Scale, gradient: 'from-amber-500 to-orange-600' },
  'High Blood Pressure': { label: 'Blood Pressure Control', note: 'Low sodium, potassium-rich foods', icon: HeartPulse, gradient: 'from-rose-500 to-red-600' },
  'High Cholesterol / Fatty Liver': { label: 'Liver & Lipid Reversal', note: 'Low saturated fat, more fiber', icon: Activity, gradient: 'from-yellow-500 to-amber-600' },
  'Thyroid (Hypo/Hyper)': { label: 'Thyroid Balance', note: 'Iodine-mindful, anti-inflammatory', icon: Zap, gradient: 'from-purple-500 to-indigo-600' },
  'PCOS / PCOD': { label: 'Hormonal Reversal', note: 'Low-GI, anti-inflammatory diet', icon: Sparkles, gradient: 'from-pink-500 to-rose-600' },
  'Neuropathy (Nerve Pain/Tingling)': { label: 'Nerve Health', note: 'B-vitamin rich, blood sugar control', icon: Zap, gradient: 'from-violet-500 to-purple-600' },
  'Diabetic Retinopathy': { label: 'Eye Health Support', note: 'Antioxidant-rich, sugar control', icon: Eye, gradient: 'from-cyan-500 to-sky-600' },
  'Heart Disease': { label: 'Heart Reversal', note: 'Low sodium, omega-3 rich', icon: HeartPulse, gradient: 'from-red-500 to-rose-600' },
  'Kidney Disease': { label: 'Kidney Reversal', note: 'Controlled protein & sodium', icon: Droplet, gradient: 'from-teal-500 to-emerald-600' },
  'Joint Pain / Arthritis': { label: 'Joint & Mobility Support', note: 'Anti-inflammatory foods', icon: Bone, gradient: 'from-orange-500 to-amber-600' },
  'Chronic Fatigue': { label: 'Energy Restoration', note: 'Iron & B12 rich, steady meals', icon: Zap, gradient: 'from-lime-500 to-green-600' },
  'Sleep Apnea / Sleep Issues': { label: 'Sleep Quality Support', note: 'Light dinner, no late caffeine', icon: Moon, gradient: 'from-indigo-500 to-blue-600' },
  'Erectile Dysfunction': { label: 'Vascular Health', note: 'Heart-healthy, circulation support', icon: HeartPulse, gradient: 'from-rose-500 to-pink-600' },
  'Uric Acid / Gout': { label: 'Uric Acid Reversal', note: 'Low purine, more water', icon: Flame, gradient: 'from-amber-500 to-yellow-600' },
  'Digestive / IBS': { label: 'Gut Health Reversal', note: 'Fiber-balanced, gut-friendly', icon: Leaf, gradient: 'from-emerald-500 to-lime-600' },
};

export const DEFAULT_REVERSAL_GOAL = { label: 'Metabolic Health', note: 'Balanced nutrition, steady energy', icon: Sparkles, gradient: 'from-emerald-500 to-teal-600' };

type Period = 'morning' | 'afternoon' | 'evening' | 'night';

const PERIODS: { key: Period; label: string; range: string; Icon: typeof Sunrise }[] = [
  { key: 'morning', label: 'Morning', range: '5 AM – 12 PM', Icon: Sunrise },
  { key: 'afternoon', label: 'Afternoon', range: '12 – 5 PM', Icon: Sun },
  { key: 'evening', label: 'Evening', range: '5 – 8:30 PM', Icon: Sunset },
  { key: 'night', label: 'Night', range: '8:30 PM onward', Icon: Moon },
];

// Purely presentational classification of each timeline step, inferred
// from its own title — adds a scannable "what kind of step is this" signal
// (and, paired with computeDurationLabel below, roughly how long it takes)
// without touching any of the actual herbal/medical content itself.
export type StepCategory = 'herbal' | 'exercise' | 'meal' | 'hygiene' | 'rest' | 'hydration' | 'other';
export const STEP_CATEGORY_META: Record<StepCategory, { Icon: typeof Pill; color: string; label: [string, string] }> = {
  herbal: { Icon: Pill, color: '#10b981', label: ['Herbal / Supplement', 'हर्बल / सप्लीमेंट'] },
  exercise: { Icon: Dumbbell, color: '#f97316', label: ['Exercise / Movement', 'व्यायाम / गतिविधि'] },
  meal: { Icon: Utensils, color: '#eab308', label: ['Meal', 'भोजन'] },
  hygiene: { Icon: Bath, color: '#0ea5e9', label: ['Hygiene', 'स्वच्छता'] },
  rest: { Icon: BedDouble, color: '#8b5cf6', label: ['Rest / Sleep', 'आराम / नींद'] },
  hydration: { Icon: Droplet, color: '#06b6d4', label: ['Hydration', 'जलयोजन'] },
  other: { Icon: Clock, color: '#71717a', label: ['Step', 'कदम'] },
};

/** A two-stop gradient per category — used for the bigger "poster" visuals
 *  (hero card banner, Home's Today's Plan tile) so those read as a real
 *  premium wellness-app visual instead of a flat icon chip. Kept as CSS
 *  gradients (not hotlinked stock photos) so every card always renders
 *  something polished, with zero dependency on an external image loading. */
export const CATEGORY_GRADIENT: Record<StepCategory, string> = {
  herbal: 'from-emerald-500 to-teal-600',
  exercise: 'from-orange-500 to-red-600',
  meal: 'from-amber-400 to-yellow-600',
  hygiene: 'from-sky-500 to-blue-600',
  rest: 'from-violet-500 to-indigo-600',
  hydration: 'from-cyan-500 to-sky-600',
  other: 'from-zinc-400 to-zinc-600',
};

export function categoryFor(title: string): StepCategory {
  const t = (title || '').toLowerCase();
  if (/herb|ayurvedic|churna|vati|guggulu|supplement|vitamin|medicine|reviv|glucolow/.test(t)) return 'herbal';
  if (/exercise|cardio|stretch|yoga|walk|movement|massage|pranayama|breathwork|abhyanga|strength|hiit/.test(t)) return 'exercise';
  if (/breakfast|lunch|dinner|snack|meal/.test(t)) return 'meal';
  if (/shower|hygiene|tongue|oil pulling|elimination/.test(t)) return 'hygiene';
  if (/sleep|rest|relax|screen shutdown|good night|meditation/.test(t)) return 'rest';
  if (/hydration|water/.test(t)) return 'hydration';
  return 'other';
}

/** Formats "5:00 AM" + next step's "5:08 AM" into a "5:00 – 5:08 AM" range —
 *  a simple, honest stand-in for "how long this step has" (the gap until
 *  whatever's next), rather than a made-up duration. Falls back to just the
 *  start time for the day's very last step. */
function computeDurationLabel(startLabel: string, nextStartLabel: string | undefined): string {
  if (!nextStartLabel) return startLabel;
  // A label that's already a range (e.g. "9:15 AM – 12:45 PM") already
  // states its own end time — don't overwrite it with the next step's start.
  if (startLabel.includes('–') || startLabel.includes('-')) return startLabel;
  const startTime = startLabel.replace(/\s*(AM|PM)$/i, '').trim();
  return `${startTime} – ${nextStartLabel}`;
}

/** Minutes since midnight parsed from a label like "7:35 PM" or a range like
 *  "9:15 AM – 12:45 PM" (uses the start of the range). */
export function labelMinutes(label: string): number {
  const m = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return 12 * 60;
  let h = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

function periodFor(label: string): Period {
  const mins = labelMinutes(label);
  if (mins < 12 * 60) return 'morning';
  if (mins < 17 * 60) return 'afternoon';
  if (mins < 20 * 60 + 30) return 'evening';
  return 'night';
}

function currentPeriod(): Period {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 12 * 60) return 'morning';
  if (mins < 17 * 60) return 'afternoon';
  if (mins < 20 * 60 + 30) return 'evening';
  return 'night';
}

function useToggleSet(): [Set<string>, (id: string) => void] {
  const [set, setSet] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSet((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return [set, toggle];
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  profile,
  prescriptions = [],
  onReferenceSections,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { t, language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const userId = profile.id || '';

  // "Viewing as" a family member — see FamilyViewSwitcher. activeDependentId
  // is a family_members.id (what the server's resolveActingUserId expects);
  // effectiveUserId is the dependent's own shadow account id (what every
  // direct-client Supabase call below needs instead) — null/self falls back
  // to the real signed-in user for both.
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [activeDependentId, setActiveDependentId] = useState<string | null>(null);
  useEffect(() => { getFamilyMembers().then(setFamilyMembers); }, []);
  const activeMember = activeDependentId ? familyMembers.find((m) => m.id === activeDependentId) : null;
  const effectiveUserId = activeMember?.dependentUserId || userId;

  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday);
  const todayDate = startOfToday();
  const isToday = toDateKey(selectedDate) === toDateKey(todayDate);
  const dateKey = toDateKey(selectedDate);

  // Mon–Sun of the week containing the selected date, for the always-visible
  // week strip in the header.
  const weekDates = useMemo(() => {
    const day = selectedDate.getDay(); // 0 = Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(selectedDate);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const [programDay, setProgramDay] = useState<number | null>(null);
  const [programTotalDays, setProgramTotalDays] = useState<number | null>(null);
  // The real calendar date "Day 1" was pinned to (see /api/daily-plan) — lets
  // Weekly Updates label each 4-week block with the real month it actually
  // falls in, instead of a generic "Month 1/2/3".
  const [builtInStartedAt, setBuiltInStartedAt] = useState<string | null>(null);
  // TWO separate plans: the built-in UrCare plan (never changed by an upload)
  // and the user's own uploaded plan (editable, deletable). `planSource` is
  // the one currently shown — the user picks it in the plan switcher below,
  // and the choice is saved to their account (see getPlanChoice).
  const [builtInSections, setBuiltInSections] = useState<PlanSection[]>([]);
  const [uploadedPlan, setUploadedPlan] = useState<UploadedPlan | null>(null);
  const [planSource, setPlanSource] = useState<'urcare' | 'mine'>('urcare');
  const [isPlanEditorOpen, setIsPlanEditorOpen] = useState(false);
  const [isConfirmingDeletePlan, setIsConfirmingDeletePlan] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [planActionError, setPlanActionError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  const [achieved, setAchieved] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [hasLoggedMeals, setHasLoggedMeals] = useState(false);
  const [mealCount, setMealCount] = useState(0);

  const [expandedItems, toggleItem] = useToggleSet();

  // The in-app YouTube player modal for whichever exercise step's "Watch
  // Exercise Video" button was tapped — a title, not a boolean, since it
  // doubles as which step's video is showing (hero card or any row).
  const [videoModalTitle, setVideoModalTitle] = useState<string | null>(null);

  // The user's own additions to the timeline (Plan tab → Edit → Add) — see
  // custom_plan_steps. Recurs every day, same as the built-in reversal plan.
  const [customSteps, setCustomSteps] = useState<CustomPlanStep[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newStepTime, setNewStepTime] = useState('');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepBody, setNewStepBody] = useState('');
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [addStepError, setAddStepError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveUserId) return;
    let cancelled = false;
    getCustomPlanSteps(effectiveUserId).then((steps) => { if (!cancelled) setCustomSteps(steps); });
    return () => { cancelled = true; };
  }, [effectiveUserId]);

  const handleAddStep = async () => {
    if (!newStepTime || !newStepTitle.trim()) return;
    setIsSubmittingStep(true);
    setAddStepError(null);
    const timeLabel = to12HourLabel(newStepTime);
    const { step, error } = await addCustomPlanStep(timeLabel, newStepTitle.trim(), newStepBody.trim(), activeDependentId);
    setIsSubmittingStep(false);
    if (error || !step) {
      setAddStepError(error || 'Could not add this step right now.');
      return;
    }
    setCustomSteps((prev) => [...prev, step]);
    setNewStepTime('');
    setNewStepTitle('');
    setNewStepBody('');
    setIsAddFormOpen(false);
  };

  const handleDeleteStep = (id: string) => {
    setCustomSteps((prev) => prev.filter((s) => s.id !== id));
    deleteCustomPlanStep(id).catch(() => {});
  };

  // The calendar starts collapsed — a "Change Date" button opens it, and
  // picking a date closes it again, instead of always taking up space.
  const [showCalendar, setShowCalendar] = useState(false);

  // "Upload Your Own Daily Plan" — bumping this forces the plan-fetch effect
  // below to re-run right after a successful upload, so the newly-extracted
  // plan shows up immediately instead of waiting for the next date change.
  const [isUploadPlanOpen, setIsUploadPlanOpen] = useState(false);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);

  // Same refresh, triggered from elsewhere — a report upload that adds a
  // new condition to this user's Daily Plan (see Dashboard's
  // handleUpdateReport) dispatches this so an already-open Plan tab picks
  // it up immediately instead of waiting for the next date change.
  useEffect(() => {
    const handler = () => setPlanRefreshKey((k) => k + 1);
    window.addEventListener('urcare:daily-plan-changed', handler);
    return () => window.removeEventListener('urcare:daily-plan-changed', handler);
  }, []);

  // Ticks once a minute purely to force a re-render, so "today"'s timeline
  // re-evaluates which period is current as the real clock moves — without
  // this, the page would keep showing whichever period was current at the
  // moment it was first opened, even hours later.
  const [clockTick, forceClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceClockTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Load this day's reversal-plan sections — a plain DB read + filter, no
  // AI call, so this is always fast (no "generating..." wait needed).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPlanLoading(true);
    setPlanError(null);
    setBuiltInSections([]);

    (async () => {
      const result = await getDailyPlan(dateKey, activeDependentId);
      if (cancelled) return;
      if (result.error) {
        setPlanError(result.error);
      } else {
        setProgramDay(result.plan?.programDay ?? null);
        setProgramTotalDays(result.plan?.totalDays ?? null);
        setBuiltInStartedAt(result.plan?.startedAt ?? null);
        setBuiltInSections(result.plan?.sections || []);
        setUploadedPlan(result.customPlan || null);
        setPlanSource(getPlanChoice(effectiveUserId, !!result.customPlan));
      }
      setPlanLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, activeDependentId, dateKey, planRefreshKey]);

  // What the rest of this screen renders: whichever plan is selected.
  const showingUploaded = planSource === 'mine' && !!uploadedPlan;
  const sections: PlanSection[] = showingUploaded ? (uploadedPlan!.sections as PlanSection[]) : builtInSections;
  const customPlanExpiresAt = showingUploaded ? uploadedPlan!.expiresAt : null;
  const customPlanUploadedAt = showingUploaded ? uploadedPlan!.uploadedAt : null;
  // An uploaded plan's weeks (and month names) count from its upload date.
  const programStartedAt = showingUploaded ? uploadedPlan!.uploadedAt : builtInStartedAt;
  const uploadedDaysLeft = uploadedPlan
    ? Math.max(0, Math.ceil((new Date(uploadedPlan.expiresAt).getTime() - Date.now()) / 86_400_000))
    : 0;
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });

  const choosePlan = (choice: 'urcare' | 'mine') => {
    setPlanSource(choice);
    savePlanChoice(effectiveUserId, choice);
    setIsEditMode(false);
    setIsConfirmingDeletePlan(false);
    setPlanActionError(null);
  };

  const handleSaveUploadedPlan = async (edited: { timeLabel: string; title: string; body: string }[]) => {
    const { customPlan, error } = await updateUploadedPlan(edited, activeDependentId);
    if (error || !customPlan) return error || tr('Could not save your changes.', 'बदलाव सेव नहीं हो सके।');
    setUploadedPlan(customPlan);
    setIsPlanEditorOpen(false);
    window.dispatchEvent(new Event('urcare:daily-plan-changed'));
    return undefined;
  };

  const handleDeleteUploadedPlan = async () => {
    setIsDeletingPlan(true);
    setPlanActionError(null);
    const { error } = await deleteUploadedPlan(activeDependentId);
    setIsDeletingPlan(false);
    if (error) {
      setPlanActionError(error);
      return;
    }
    setUploadedPlan(null);
    choosePlan('urcare');
    window.dispatchEvent(new Event('urcare:daily-plan-changed'));
  };

  // Load this day's actual logged activity (meals + task checkboxes).
  useEffect(() => {
    if (!effectiveUserId) return;
    let cancelled = false;

    getTaskCompletion(effectiveUserId, dateKey).then((c) => { if (!cancelled) setCompletedToday(c); });
    getDailyLog(effectiveUserId, dateKey).then((log) => {
      if (cancelled) return;
      const meals = log?.meals || [];
      setHasLoggedMeals(meals.length > 0);
      setMealCount(meals.length);
      setAchieved({
        calories: meals.reduce((s, m) => s + (Number(m.calories) || 0), 0),
        protein: meals.reduce((s, m) => s + (Number(m.protein) || 0), 0),
        carbs: meals.reduce((s, m) => s + (Number(m.carbs) || 0), 0),
        fats: meals.reduce((s, m) => s + (Number(m.fats) || 0), 0),
      });
    });

    return () => { cancelled = true; };
  }, [effectiveUserId, dateKey]);

  useEffect(() => {
    if (!effectiveUserId) return;
    getActiveDates(effectiveUserId).then(setMarkedDates);
  }, [effectiveUserId, dateKey]);

  // A little celebratory pop-up whenever a step is checked off — never shown
  // when un-checking, only on the way to "done".
  const [celebration, setCelebration] = useState<string | null>(null);
  const celebrationMessages = [
    'Well done!', 'Nicely done.', 'Great progress!', 'Step completed.',
    'Good work today.', 'One step closer to your goal.',
  ];

  const toggleTask = (taskId: string) => {
    if (!effectiveUserId) return;
    const willBeDone = !completedToday[taskId];
    setCompletedToday((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
    toggleDailyTask(effectiveUserId, dateKey, taskId);
    if (willBeDone) {
      setCelebration(celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)]);
      window.setTimeout(() => setCelebration(null), 1600);
    }
  };

  const { calculatedPlan } = profile;
  const targetCalories = calculatedPlan?.targetCalories || 1850;
  const targetProtein = calculatedPlan?.proteinGrams || 140;
  const targetCarbs = calculatedPlan?.carbsGrams || 180;
  const targetFats = calculatedPlan?.fatsGrams || 50;

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardClass = isDark ? 'bg-zinc-900/70 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';

  // Reference material (not time-bound — the herbal reference library and
  // advanced/optional therapies) is shown separately, below the timeline.
  // The user's own custom steps are folded in here too, so they sort/group
  // into the same Morning/Afternoon/Evening/Night timeline as everything else.
  const timelineSections = useMemo<TimelineItem[]>(() => {
    const builtIn: TimelineItem[] = sections.filter((s) => !!s.timeLabel);
    const custom: TimelineItem[] = showingUploaded ? [] : customSteps.map((cs) => ({
      id: cs.id, timeLabel: cs.timeLabel, title: cs.title, body: cs.body,
      isCustom: true, verdict: cs.verdict, verdictReason: cs.verdictReason,
    }));
    return [...builtIn, ...custom];
  }, [sections, customSteps, showingUploaded]);
  const referenceSections = useMemo(() => sections.filter((s) => !s.timeLabel), [sections]);

  const taskIds = timelineSections.map((s) => s.id);
  const doneCount = taskIds.filter((id) => completedToday[id]).length;
  const allDone = taskIds.length > 0 && doneCount === taskIds.length;

  // Bucket the day's timeline into Morning/Afternoon/Evening/Night, each
  // sorted by actual clock time — turns one long scroll into four short,
  // scannable groups.
  const grouped = useMemo(() => {
    const byPeriod: Record<Period, TimelineItem[]> = { morning: [], afternoon: [], evening: [], night: [] };
    for (const s of timelineSections) {
      byPeriod[periodFor(s.timeLabel || '')].push(s);
    }
    (Object.keys(byPeriod) as Period[]).forEach((p) => {
      byPeriod[p].sort((a, b) => labelMinutes(a.timeLabel || '') - labelMinutes(b.timeLabel || ''));
    });
    return byPeriod;
  }, [timelineSections]);

  const activePeriod = isToday ? currentPeriod() : null;

  // Always show the full day — Morning/Afternoon/Evening/Night all open at
  // once below, nothing collapsed or hidden. Only the "Right Now" hero card
  // above swaps by the real clock; this timeline is the complete plan for
  // whichever day is selected.
  const visiblePeriods = PERIODS;

  // The reference library (condition notes, recipes, vitamins...) is not
  // rendered here — it's lifted up so a parent can show it statically in its
  // own sidebar, always in view, instead of inline in this scrolling column.
  useEffect(() => {
    onReferenceSections?.(referenceSections);
  }, [referenceSections, onReferenceSections]);

  // "Right Now" — whichever step's time has arrived most recently is pinned
  // to the very top, enlarged, so there's never a need to scroll to find
  // what to do at this exact moment. Recomputes every minute (via the tick
  // above), so it swaps to the next step on its own the moment its time
  // arrives — nothing to refresh manually.
  const sortedToday = useMemo(
    () => [...timelineSections].sort((a, b) => labelMinutes(a.timeLabel || '') - labelMinutes(b.timeLabel || '')),
    [timelineSections]
  );

  // Each step's real "how long do I have for this" — the honest gap until
  // whichever step comes right after it in the full day's order (see
  // computeDurationLabel), not a fabricated duration.
  const durationLabelById = useMemo(() => {
    const map = new Map<string, string>();
    sortedToday.forEach((item, i) => {
      const next = sortedToday[i + 1];
      map.set(item.id, computeDurationLabel(item.timeLabel || '', next?.timeLabel));
    });
    return map;
  }, [sortedToday]);

  // Feeds the Weekly Updates panel — same programDay/totalDays the header's
  // "Day X of Y" badge already uses for the built-in plan (Y is that real
  // calendar month's own length — 28-31 — never a flat 14), or a
  // calendar-based day count for a custom uploaded plan.
  const weekProgress = useMemo(
    () => unifiedProgramDay({ isCustom: !!customPlanExpiresAt, programDay, totalDays: programTotalDays, uploadedAt: customPlanUploadedAt }),
    [customPlanExpiresAt, programDay, programTotalDays, customPlanUploadedAt]
  );

  const heroInfo = useMemo(() => {
    if (!isToday || sortedToday.length === 0) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let current: TimelineItem | null = null;
    let next: TimelineItem | null = null;
    for (const item of sortedToday) {
      const mins = labelMinutes(item.timeLabel || '');
      if (mins <= nowMinutes) current = item;
      else { next = item; break; }
    }
    if (!current && !next) return null;
    return { item: current || next!, isUpcoming: !current, next: current ? next : null };
  }, [sortedToday, isToday, clockTick]);

  return (
    <div id="diet-recommendations-section" className="space-y-5 sm:space-y-6 text-left min-w-0">

      {/* A brief, understated confirmation whenever a step is ticked off. */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full bg-white border border-emerald-200 text-zinc-800 text-xs font-bold shadow-lg pointer-events-none whitespace-nowrap"
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-white stroke-[3]" />
            </span>
            {celebration}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. HEADER — plain, clinical styling (solid text, bordered icon
          badge) instead of the previous gradient-text/gradient-badge
          treatment, to read as a professional schedule rather than a
          playful app screen. */}
      <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4`}>
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : ''}`}>
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg sm:text-xl font-black tracking-tight break-words ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                {t('dailyPlanTitle')}
              </h2>
              <p className="text-xs opacity-60 mt-0.5 break-words">
                {t('dailyPlanSubtitle')}
              </p>
            </div>
          </div>

        </div>

        {/* "Viewing as" — only shows up once a family member has actually
            been added (see AccountPage → Family Members). */}
        <FamilyViewSwitcher members={familyMembers} activeDependentId={activeDependentId} onChange={setActiveDependentId} isDark={isDark} tr={tr} />

        {/* Week strip — always visible (not tucked behind "Change Date"),
            matching the reference's persistent Mon–Sun row. Tapping a day
            jumps straight to it; "Change Date" below still opens the full
            month calendar for jumping further back. */}
        <div className="flex items-center justify-between gap-1">
          {weekDates.map((d) => {
            const key = toDateKey(d);
            const isSelectedDay = key === dateKey;
            const isFuture = d.getTime() > todayDate.getTime();
            return (
              <button
                key={key}
                type="button"
                disabled={isFuture}
                onClick={() => setSelectedDate(d)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all ${
                  isFuture ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                } ${isSelectedDay ? 'bg-emerald-600 text-white shadow-sm' : isDark ? 'text-zinc-400 hover:bg-white/5' : 'text-zinc-500 hover:bg-zinc-50'}`}
              >
                <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' })}</span>
                <span className={`text-sm font-black ${isSelectedDay ? 'text-white' : ''}`}>{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className={`pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'} flex items-center justify-between gap-3 flex-wrap`}>
          <div className="text-xs opacity-70 font-semibold flex items-center gap-2 flex-wrap min-w-0">
            <span className="break-words">{t('showingLabel')}: <span className="text-emerald-600 font-black">{isToday ? `${t('showingToday')} (${formatDate(selectedDate)})` : formatDate(selectedDate)}</span></span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(startOfToday())}
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>{t('backToToday')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCalendar((v) => !v)}
              className={`text-xs font-bold flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-lg border transition-colors ${
                showCalendar ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>{showCalendar ? 'Hide Calendar' : 'Change Date'}</span>
            </button>
          </div>
        </div>

        {/* Calendar — collapsed by default; opens only when "Change Date" is
            tapped, and closes itself again once a date is picked. */}
        <AnimatePresence initial={false}>
          {showCalendar && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                <DailyCalendar
                  selectedDate={selectedDate}
                  onSelectDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
                  markedDates={markedDates}
                  isDark={isDark}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 1.2 WHICH PLAN — two clearly separate plans. The UrCare plan is
          never changed by an upload; the user's own uploaded plan lives in
          its own slot, where it can be edited or deleted (deleting simply
          leaves the UrCare plan). */}
      <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4`}>
        <div>
          <h3 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>
            {tr('Which plan do you want to see?', 'आप कौन सा प्लान देखना चाहते हैं?')}
          </h3>
          <p className="text-xs opacity-60 mt-0.5">
            {tr('You have two separate plans. Tap one to see its steps below.', 'आपके पास दो अलग प्लान हैं। नीचे उसके steps देखने के लिए किसी एक पर टैप करें।')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* UrCare plan */}
          <button
            type="button"
            onClick={() => choosePlan('urcare')}
            className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
              !showingUploaded
                ? 'border-emerald-500 bg-emerald-500/5 shadow-sm'
                : isDark ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-black text-sm">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Stethoscope className="w-4 h-4" /></span>
                {tr('UrCare Plan', 'UrCare प्लान')}
              </span>
              {!showingUploaded && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">{tr('Showing', 'दिख रहा है')}</span>}
            </div>
            <p className="text-xs opacity-70 mt-2 leading-relaxed">
              {tr('Made by UrCare for your health profile. It changes by itself as your program goes on. Uploading your own plan never changes it.', 'आपकी हेल्थ प्रोफ़ाइल के हिसाब से UrCare का बनाया प्लान। प्रोग्राम आगे बढ़ने के साथ अपने आप बदलता है। आपका अपना प्लान अपलोड करने से इसमें कोई बदलाव नहीं होता।')}
            </p>
          </button>

          {/* The user's own uploaded plan */}
          <button
            type="button"
            onClick={() => (uploadedPlan ? choosePlan('mine') : setIsUploadPlanOpen(true))}
            className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
              showingUploaded
                ? 'border-amber-500 bg-amber-500/5 shadow-sm'
                : uploadedPlan
                ? isDark ? 'border-zinc-800 hover:border-zinc-700' : 'border-zinc-200 hover:border-zinc-300'
                : 'border-dashed border-amber-400/60 hover:bg-amber-500/5'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-black text-sm">
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></span>
                {tr('My Uploaded Plan', 'मेरा अपलोड किया प्लान')}
              </span>
              {showingUploaded && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">{tr('Showing', 'दिख रहा है')}</span>}
            </div>
            {uploadedPlan ? (
              <p className="text-xs opacity-70 mt-2 leading-relaxed">
                {tr(
                  `Your own plan, uploaded on ${shortDate(uploadedPlan.uploadedAt)} · ${uploadedPlan.sections.length} steps · active for ${uploadedDaysLeft} more day${uploadedDaysLeft === 1 ? '' : 's'} (till ${shortDate(uploadedPlan.expiresAt)}).`,
                  `आपका अपना प्लान, ${shortDate(uploadedPlan.uploadedAt)} को अपलोड किया · ${uploadedPlan.sections.length} steps · ${uploadedDaysLeft} दिन और चालू (${shortDate(uploadedPlan.expiresAt)} तक)।`
                )}
              </p>
            ) : (
              <p className="text-xs opacity-70 mt-2 leading-relaxed flex items-start gap-1.5">
                <Upload className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                <span>{tr("No plan uploaded yet. Tap here to upload a photo or PDF of your doctor's or dietitian's plan — it opens here as a separate plan.", 'अभी कोई प्लान अपलोड नहीं है। अपने डॉक्टर या डाइटीशियन के प्लान की फोटो या PDF अपलोड करने के लिए यहाँ टैप करें — ये यहाँ एक अलग प्लान के रूप में खुलेगा।')}</span>
              </p>
            )}
          </button>
        </div>

        {/* Actions for the uploaded plan — only while it's the one shown. */}
        {showingUploaded && uploadedPlan && (
          <div className={`p-3 sm:p-4 rounded-2xl border space-y-3 ${isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-xs flex items-start gap-1.5 ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{tr('You are seeing your uploaded plan. Edit it, replace it with a new upload, or delete it to go back to the UrCare plan.', 'आप अपना अपलोड किया प्लान देख रहे हैं। इसे बदलें, नया अपलोड करके बदलें, या डिलीट करके UrCare प्लान पर वापस जाएँ।')}</span>
            </p>
            {isConfirmingDeletePlan ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-rose-600">
                  {tr('Delete your uploaded plan? This cannot be undone. Your UrCare plan stays exactly as it is.', 'अपना अपलोड किया प्लान डिलीट करें? इसे वापस नहीं लाया जा सकता। आपका UrCare प्लान जैसा है वैसा ही रहेगा।')}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsConfirmingDeletePlan(false)} disabled={isDeletingPlan}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${isDark ? 'bg-zinc-900 text-zinc-300' : 'bg-white border border-zinc-200 text-zinc-700'}`}>
                    {tr('Keep it', 'रहने दें')}
                  </button>
                  <button type="button" onClick={handleDeleteUploadedPlan} disabled={isDeletingPlan}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">
                    {isDeletingPlan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {tr('Yes, delete', 'हाँ, डिलीट करें')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setIsPlanEditorOpen(true)}
                  className="py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 cursor-pointer">
                  <Edit3 className="w-3.5 h-3.5" /> {tr('Edit', 'बदलें')}
                </button>
                <button type="button" onClick={() => setIsUploadPlanOpen(true)}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${isDark ? 'bg-zinc-900 text-zinc-200' : 'bg-white border border-zinc-200 text-zinc-700'}`}>
                  <Upload className="w-3.5 h-3.5" /> {tr('Upload new', 'नया अपलोड')}
                </button>
                <button type="button" onClick={() => setIsConfirmingDeletePlan(true)}
                  className={`py-2.5 rounded-xl text-xs font-bold text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer ${isDark ? 'bg-zinc-900' : 'bg-white border border-rose-200'}`}>
                  <Trash2 className="w-3.5 h-3.5" /> {tr('Delete', 'डिलीट')}
                </button>
              </div>
            )}
            {planActionError && <p className="text-xs font-bold text-rose-500">{planActionError}</p>}
          </div>
        )}
      </div>

      {/* 1.5 WEEKLY UPDATES — fully automatic week-by-week progress, derived
          from the same program-day number the header's "Day X of Y" badge
          uses. No manual "mark week done" action anywhere: the moment the
          program crosses into a new week, the previous one flips to
          Completed and a one-time congratulations banner shows here. */}
      {weekProgress && (
        <WeeklyUpdatesPanel
          userId={effectiveUserId}
          dayNum={weekProgress.dayNum}
          totalDays={weekProgress.totalDays}
          programStartedAt={programStartedAt}
          isDark={isDark}
          language={language}
          tr={tr}
        />
      )}

      {/* 2. RIGHT NOW — the single step whose time has arrived, enlarged and
          pinned to the top so there's nothing to scroll for. Swaps to the
          next step on its own the moment its time passes. */}
      {heroInfo && (() => {
        const heroCat = categoryFor(heroInfo.item.title);
        const cat = STEP_CATEGORY_META[heroCat];
        const CatIcon = cat.Icon;
        const isExercise = heroCat === 'exercise';
        return (
        <div className={`relative overflow-hidden rounded-3xl ${isDark ? 'bg-zinc-950' : 'bg-white'} border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5`}>
          {/* Poster banner — a big category-gradient visual up top, the
              "professional, premium wellness app" treatment the plain
              icon chip alone couldn't give it. */}
          <div className={`relative h-20 sm:h-24 bg-gradient-to-br ${CATEGORY_GRADIENT[heroCat]} flex items-center px-5 sm:px-7 overflow-hidden`}>
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/15 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 left-16 w-24 h-24 rounded-full bg-black/10 blur-2xl pointer-events-none" />
            <CatIcon className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 text-white/20 rotate-[-8deg]" strokeWidth={1.25} />
            <span className="relative inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white bg-black/15 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
              {heroInfo.isUpcoming ? 'Coming Up' : 'Right Now'} · {tr(...cat.label)}
            </span>
          </div>

          <div className="relative p-5 sm:p-7 space-y-3">
            <div className="flex items-center justify-end gap-2 flex-wrap -mt-1">
              {heroInfo.item.timeLabel && (
                <span className="text-xs font-black opacity-60">{durationLabelById.get(heroInfo.item.id) || heroInfo.item.timeLabel}</span>
              )}
            </div>

            <div className="flex items-start gap-3.5">
              <button
                type="button"
                onClick={() => toggleTask(heroInfo.item.id)}
                aria-label={completedToday[heroInfo.item.id] ? 'Mark as not done' : 'Mark as done'}
                className="shrink-0 mt-0.5 cursor-pointer"
              >
                {completedToday[heroInfo.item.id] ? (
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/40">
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                  </div>
                ) : (
                  <Circle className="w-7 h-7 opacity-30" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-lg sm:text-xl font-black break-words ${completedToday[heroInfo.item.id] ? 'text-emerald-600' : ''}`}>
                    {heroInfo.item.title}
                  </h3>
                  {heroInfo.item.isCustom && (
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${heroInfo.item.verdict === 'red' ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-600'}`}>
                      {heroInfo.item.verdict === 'red' ? <AlertTriangle className="w-2.5 h-2.5" /> : null}
                      {heroInfo.item.verdict === 'red' ? tr('Flagged', 'चिह्नित') : tr('Your addition', 'आपका जोड़ा हुआ')}
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed mt-1.5 whitespace-pre-line break-words ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {heroInfo.item.body}
                </p>
                {heroInfo.item.isCustom && heroInfo.item.verdictReason && (
                  <p className={`text-xs mt-1.5 font-semibold ${heroInfo.item.verdict === 'red' ? 'text-rose-500' : 'text-amber-600'}`}>
                    {heroInfo.item.verdictReason}
                  </p>
                )}
                {isExercise && (
                  <button
                    type="button"
                    onClick={() => setVideoModalTitle(heroInfo.item.title)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-sm shadow-red-600/30 transition-colors cursor-pointer"
                  >
                    <Youtube className="w-4 h-4" />
                    {tr('Watch Exercise Video', 'व्यायाम वीडियो देखें')}
                  </button>
                )}
              </div>
            </div>

            {heroInfo.next && (
              <div className={`flex items-center gap-2 text-xs pt-3 border-t ${isDark ? 'border-zinc-800 text-zinc-400' : 'border-zinc-100 text-zinc-500'}`}>
                <span className="font-bold opacity-70">Up next:</span>
                <span className="font-black text-emerald-500 shrink-0">{heroInfo.next.timeLabel}</span>
                <span className="truncate">{heroInfo.next.title}</span>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Whole-day progress — the reversal-focus tiles that used to live in
          this card moved to the Profile page (a static, condition-derived
          summary that doesn't need "today"); this checklist is what's still
          genuinely daily-plan-specific, and folds the old steps-checked-off
          bar into one of its rows instead of showing it twice. Past days
          show meals logged instead, since there's no live task list to
          tick off. */}
      {isToday ? (
        <>
          {taskIds.length > 0 && allDone && (
            <div className={`p-3 rounded-2xl ${cardClass} flex items-center gap-2 text-xs font-bold text-emerald-600`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>All done for this day! 🎉</span>
            </div>
          )}
        </>
      ) : (
        <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4 min-w-0`}>
          <div className={`flex items-center justify-between pb-3 border-b flex-wrap gap-2 ${isDark ? 'border-zinc-800/40' : 'border-zinc-100'}`}>
            <div className="flex items-center gap-2 text-emerald-500 min-w-0">
              <Award className="w-5 h-5 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                {t('goalsVsWhatYouAte')}
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
              {hasLoggedMeals ? `${mealCount} Meal${mealCount > 1 ? 's' : ''} Logged` : 'Nothing Logged'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Calories</span>
              <div className="text-lg sm:text-xl font-black text-emerald-500">{targetCalories} <span className="text-[10px] sm:text-xs opacity-60">kcal</span></div>
              <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.calories)} kcal` : 'Not logged'}</div>
            </div>
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Protein</span>
              <div className="text-lg sm:text-xl font-black">{targetProtein} <span className="text-[10px] sm:text-xs opacity-60">g</span></div>
              <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.protein)} g` : 'Not logged'}</div>
            </div>
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Carbs</span>
              <div className="text-lg sm:text-xl font-black">{targetCarbs} <span className="text-[10px] sm:text-xs opacity-60">g</span></div>
              <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.carbs)} g` : 'Not logged'}</div>
            </div>
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Fats</span>
              <div className="text-lg sm:text-xl font-black">{targetFats} <span className="text-[10px] sm:text-xs opacity-60">g</span></div>
              <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.fats)} g` : 'Not logged'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. THE PLAN ITSELF — a fixed 24-hour timeline, grouped into
          Morning/Afternoon/Evening/Night so it reads as four short lists
          instead of one long scroll. Personalized only by which
          condition-specific steps are included (no AI text). */}
      {planLoading ? (
        <div className={`p-10 rounded-2xl sm:rounded-3xl ${cardClass} text-center space-y-3`}>
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-500" />
          <p className="text-sm font-bold opacity-70">Loading your plan...</p>
        </div>
      ) : planError ? (
        <div className={`p-6 rounded-2xl sm:rounded-3xl ${cardClass} text-center space-y-2`}>
          <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
          <p className="text-sm font-bold text-rose-500">{planError}</p>
        </div>
      ) : timelineSections.length === 0 ? (
        <div className={`p-10 rounded-2xl sm:rounded-3xl ${cardClass} text-center space-y-2`}>
          <p className="text-sm font-bold opacity-70">No plan available for this day.</p>
        </div>
      ) : (
        <>
          <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4 min-w-0`}>
            <div className={`flex items-center justify-between pb-3 border-b flex-wrap gap-2 ${isDark ? 'border-zinc-800/40' : 'border-zinc-100'}`}>
              <div className="flex items-center gap-2 text-emerald-500 min-w-0">
                <Clock className="w-5 h-5 shrink-0" />
                <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                  {showingUploaded ? tr('My Uploaded Plan — Steps', 'मेरा अपलोड किया प्लान — Steps') : tr('UrCare Plan — 24-Hour Timeline', 'UrCare प्लान — 24 घंटे की समय-सारणी')}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded ${showingUploaded ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {showingUploaded ? tr('Your plan', 'आपका प्लान') : tr('Matched to you', 'आपके लिए')}
                </span>
                {showingUploaded ? (
                  <button
                    type="button"
                    onClick={() => setIsPlanEditorOpen(true)}
                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border flex items-center gap-1 cursor-pointer transition-colors ${isDark ? 'border-zinc-700 text-zinc-300 hover:border-emerald-500/40' : 'border-zinc-200 text-zinc-600 hover:border-emerald-300'}`}
                  >
                    <Edit3 className="w-3 h-3" />
                    {tr('Edit plan', 'प्लान बदलें')}
                  </button>
                ) : (
                <button
                  type="button"
                  onClick={() => { setIsEditMode((v) => !v); setIsAddFormOpen(false); setAddStepError(null); }}
                  className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border flex items-center gap-1 cursor-pointer transition-colors ${
                    isEditMode
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : isDark ? 'border-zinc-700 text-zinc-300 hover:border-emerald-500/40' : 'border-zinc-200 text-zinc-600 hover:border-emerald-300'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  {isEditMode ? tr('Done', 'पूर्ण') : tr('Add my step', 'मेरा step जोड़ें')}
                </button>
                )}
              </div>
            </div>

            {/* Add-your-own-step panel — only shown in Edit mode. Every
                addition is reviewed against this user's real conditions and
                lab findings before it's saved (see /api/custom-plan-steps) —
                never inserted as a plain, unreviewed note. */}
            {isEditMode && (
              <div className={`p-3 sm:p-4 rounded-2xl border space-y-2.5 ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50'}`}>
                {!isAddFormOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsAddFormOpen(true)}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-400/50 text-emerald-600 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-500/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tr('Add your own step', 'अपना कदम जोड़ें')}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <input
                        type="time"
                        value={newStepTime}
                        onChange={(e) => setNewStepTime(e.target.value)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-bold border outline-none focus:border-emerald-500 ${isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}
                      />
                      <input
                        type="text"
                        placeholder={tr('e.g. Evening walk, Green tea…', 'जैसे शाम की सैर, ग्रीन टी…')}
                        value={newStepTitle}
                        onChange={(e) => setNewStepTitle(e.target.value)}
                        maxLength={80}
                        className={`min-w-0 px-3 py-2 rounded-lg text-xs font-semibold border outline-none focus:border-emerald-500 ${isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}
                      />
                    </div>
                    <textarea
                      placeholder={tr('Details (optional)', 'विवरण (वैकल्पिक)')}
                      value={newStepBody}
                      onChange={(e) => setNewStepBody(e.target.value)}
                      rows={2}
                      maxLength={300}
                      className={`w-full px-3 py-2 rounded-lg text-xs border outline-none focus:border-emerald-500 resize-none ${isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}
                    />
                    {addStepError && (
                      <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {addStepError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSubmittingStep || !newStepTime || !newStepTitle.trim()}
                        onClick={handleAddStep}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {isSubmittingStep ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {isSubmittingStep ? tr('Checking against your health data…', 'आपके स्वास्थ्य डेटा से जांच हो रही है…') : tr('Add & Check', 'जोड़ें व जांचें')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsAddFormOpen(false); setAddStepError(null); }}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer ${isDark ? 'border-zinc-700 text-zinc-300' : 'border-zinc-200 text-zinc-600'}`}
                      >
                        {tr('Cancel', 'रद्द करें')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-5">
              {visiblePeriods.map(({ key, label, range, Icon }) => {
                const items = grouped[key];
                if (items.length === 0) return null;
                const periodDone = items.filter((s) => completedToday[s.id]).length;
                const isActivePeriod = activePeriod === key;
                return (
                  <div key={key} className="space-y-2">
                    <div className={`flex items-center gap-2.5 px-1 ${isActivePeriod ? '' : 'opacity-80'}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActivePeriod ? 'bg-emerald-500 text-white' : `${subCardClass} text-emerald-500`}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black uppercase tracking-wide">{label}</span>
                        <span className="text-[10px] opacity-50 ml-1.5">{range}</span>
                      </div>
                      <span className="ml-auto text-[10px] font-bold opacity-50 shrink-0">{periodDone}/{items.length}</span>
                    </div>

                    <div className="space-y-2">
                      {items.filter((s) => s.id !== heroInfo?.item.id).map((section) => {
                        const done = !!completedToday[section.id];
                        const open = expandedItems.has(section.id);
                        const isRisky = section.isCustom && section.verdict === 'red';
                        const isCustomOk = section.isCustom && section.verdict === 'yellow';
                        return (
                          <div
                            key={section.id}
                            className={`rounded-xl sm:rounded-2xl border transition-colors overflow-hidden ${
                              done ? 'bg-emerald-500/10 border-emerald-500/40'
                              : isRisky ? 'bg-rose-500/10 border-rose-400/50'
                              : isCustomOk ? 'bg-amber-500/10 border-amber-400/40'
                              : `${subCardClass} border-transparent`
                            }`}
                          >
                            <div className="flex items-stretch">
                              <button
                                type="button"
                                onClick={() => toggleTask(section.id)}
                                aria-label={done ? 'Mark as not done' : 'Mark as done'}
                                className="flex items-center pl-3 pr-1 shrink-0 cursor-pointer"
                              >
                                {done ? (
                                  <div className="w-4.5 h-4.5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/40">
                                    <Check className="w-3 h-3 text-white stroke-[3]" />
                                  </div>
                                ) : (
                                  <Circle className="w-4 h-4 opacity-40" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleItem(section.id)}
                                className="flex-1 min-w-0 text-left py-3 pr-2 flex items-center gap-2 cursor-pointer"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    {section.timeLabel && (
                                      <span className="text-[10px] font-black text-emerald-500 shrink-0">{durationLabelById.get(section.id) || section.timeLabel}</span>
                                    )}
                                    {(() => {
                                      const sectionCat = categoryFor(section.title);
                                      const cat = STEP_CATEGORY_META[sectionCat];
                                      const CatIcon = cat.Icon;
                                      return (
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 bg-gradient-to-br ${CATEGORY_GRADIENT[sectionCat]} text-white shadow-sm`} title={tr(...cat.label)}>
                                          <CatIcon className="w-3 h-3" />
                                        </span>
                                      );
                                    })()}
                                    <span className={`text-xs sm:text-sm font-bold break-words ${done ? 'text-emerald-600' : ''}`}>{section.title}</span>
                                    {isRisky && (
                                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 shrink-0">
                                        <AlertTriangle className="w-2.5 h-2.5" />{tr('Flagged', 'चिह्नित')}
                                      </span>
                                    )}
                                    {isCustomOk && (
                                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 shrink-0">
                                        {tr('Your addition', 'आपका जोड़ा हुआ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 opacity-40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                              </button>
                              {isEditMode && section.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStep(section.id)}
                                  aria-label="Remove this step"
                                  className="flex items-center px-3 shrink-0 text-zinc-400 hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            {open && (
                              <div className={`px-3 sm:px-4 pb-3.5 space-y-1.5 ${done ? 'opacity-60' : ''}`}>
                                {section.body && (
                                  <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line break-words ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                    {section.body}
                                  </p>
                                )}
                                {section.isCustom && section.verdictReason && (
                                  <p className={`text-xs font-semibold flex items-start gap-1.5 ${isRisky ? 'text-rose-500' : 'text-amber-600'}`}>
                                    {isRisky ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                                    <span>{section.verdictReason}</span>
                                  </p>
                                )}
                                {categoryFor(section.title) === 'exercise' && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setVideoModalTitle(section.title); }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-black shadow-sm shadow-red-600/30 transition-colors cursor-pointer"
                                  >
                                    <Youtube className="w-3.5 h-3.5" />
                                    {tr('Watch Exercise Video', 'व्यायाम वीडियो देखें')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] opacity-50 flex items-start gap-1.5 px-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>This plan is general wellness guidance, not a substitute for professional medical advice. Consult your doctor before making major changes, especially around existing medication doses.</span>
          </p>
        </>
      )}

      {/* Doctor-issued prescriptions — real records from Admin, if any */}
      {prescriptions.length > 0 && (
        <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4 min-w-0`}>
          <div className={`flex items-center justify-between pb-3 border-b flex-wrap gap-2 ${isDark ? 'border-zinc-800/40' : 'border-zinc-100'}`}>
            <div className="flex items-center gap-2 text-emerald-500 min-w-0"><FileText className="w-5 h-5 shrink-0" /><h3 className="text-sm sm:text-base font-black tracking-tight truncate">{t('myPrescriptions')}</h3></div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0">{prescriptions.length} Issued</span>
          </div>
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <div key={rx.id} className={`p-4 rounded-2xl ${subCardClass} space-y-2 min-w-0`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <h4 className={`text-xs font-extrabold break-words ${isDark ? 'text-white' : 'text-zinc-900'}`}>{rx.diagnosis}</h4>
                    <p className="text-[11px] text-zinc-500 break-words">{rx.doctorName} • {rx.date}</p>
                  </div>
                </div>
                {rx.medicines.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rx.medicines.map((med, i) => (
                      <div key={i} className={`p-2.5 rounded-xl text-[11px] break-words ${isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
                        <span className="font-bold">{med.name}</span> — {med.dosage}, {med.frequency}
                      </div>
                    ))}
                  </div>
                )}
                {rx.notes && <p className={`text-[11px] leading-relaxed break-words ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{rx.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {isUploadPlanOpen && (
        <React.Suspense fallback={null}>
          <UploadDailyPlanModal
            isOpen={isUploadPlanOpen}
            onClose={() => setIsUploadPlanOpen(false)}
            onUploaded={() => {
              // A fresh upload is what the user wants to see next.
              savePlanChoice(effectiveUserId, 'mine');
              setSelectedDate(startOfToday());
              setPlanRefreshKey((k) => k + 1);
            }}
            dependentId={activeDependentId}
          />
        </React.Suspense>
      )}

      {isPlanEditorOpen && uploadedPlan && (
        <UploadedPlanEditor
          plan={uploadedPlan}
          isDark={isDark}
          tr={tr}
          onClose={() => setIsPlanEditorOpen(false)}
          onSave={handleSaveUploadedPlan}
        />
      )}

      <ExerciseVideoModal
        title={videoModalTitle || ''}
        isOpen={!!videoModalTitle}
        onClose={() => setVideoModalTitle(null)}
        tr={tr}
      />

    </div>
  );
};

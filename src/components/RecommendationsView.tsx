import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, ChevronRight, ChevronDown,
  FileText, Award, Circle, Check, Plus,
  RefreshCw, AlertCircle, Clock, Calendar as CalendarIcon,
  Sunrise, Sun, Sunset, Moon,
  Droplet, Scale, HeartPulse, Eye, Bone, Zap, Flame, Leaf, Activity, Sparkles, Utensils,
} from 'lucide-react';
import { UserHealthProfile, Prescription } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { DailyCalendar, toDateKey } from './DailyCalendar';
import { PlanSection } from './ReversalLibraryPanel';
import { UploadDailyPlanModal } from './UploadDailyPlanModal';
import { TodayChecklistCard, ChecklistRow } from './TodayChecklistCard';
import {
  getDailyPlan, getDailyLog, getTaskCompletion,
  toggleDailyTask, getActiveDates,
} from '../utils/supabase';

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

/** Minutes since midnight parsed from a label like "7:35 PM" or a range like
 *  "9:15 AM – 12:45 PM" (uses the start of the range). */
function labelMinutes(label: string): number {
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

  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday);
  const todayDate = startOfToday();
  const isToday = toDateKey(selectedDate) === toDateKey(todayDate);
  const dateKey = toDateKey(selectedDate);

  const [programDay, setProgramDay] = useState<number | null>(null);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [customPlanExpiresAt, setCustomPlanExpiresAt] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  const [achieved, setAchieved] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [hasLoggedMeals, setHasLoggedMeals] = useState(false);
  const [mealCount, setMealCount] = useState(0);
  const [waterMl, setWaterMl] = useState(0);

  const [expandedItems, toggleItem] = useToggleSet();

  // The calendar starts collapsed — a "Change Date" button opens it, and
  // picking a date closes it again, instead of always taking up space.
  const [showCalendar, setShowCalendar] = useState(false);

  // "Upload Your Own Daily Plan" — bumping this forces the plan-fetch effect
  // below to re-run right after a successful upload, so the newly-extracted
  // plan shows up immediately instead of waiting for the next date change.
  const [isUploadPlanOpen, setIsUploadPlanOpen] = useState(false);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);

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
    setSections([]);

    (async () => {
      const result = await getDailyPlan(dateKey);
      if (cancelled) return;
      if (result.error) {
        setPlanError(result.error);
      } else {
        setProgramDay(result.plan?.programDay ?? null);
        setSections(result.plan?.sections || []);
        setCustomPlanExpiresAt(result.plan?.isCustom ? result.plan?.expiresAt ?? null : null);
      }
      setPlanLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, dateKey, planRefreshKey]);

  // Load this day's actual logged activity (meals + task checkboxes).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getTaskCompletion(userId, dateKey).then((c) => { if (!cancelled) setCompletedToday(c); });
    getDailyLog(userId, dateKey).then((log) => {
      if (cancelled) return;
      const meals = log?.meals || [];
      setHasLoggedMeals(meals.length > 0);
      setMealCount(meals.length);
      setWaterMl(log?.waterMl || 0);
      setAchieved({
        calories: meals.reduce((s, m) => s + (Number(m.calories) || 0), 0),
        protein: meals.reduce((s, m) => s + (Number(m.protein) || 0), 0),
        carbs: meals.reduce((s, m) => s + (Number(m.carbs) || 0), 0),
        fats: meals.reduce((s, m) => s + (Number(m.fats) || 0), 0),
      });
    });

    return () => { cancelled = true; };
  }, [userId, dateKey]);

  useEffect(() => {
    if (!userId) return;
    getActiveDates(userId).then(setMarkedDates);
  }, [userId, dateKey]);

  // A little celebratory pop-up whenever a step is checked off — never shown
  // when un-checking, only on the way to "done".
  const [celebration, setCelebration] = useState<string | null>(null);
  const celebrationMessages = [
    'Well done!', 'Nicely done.', 'Great progress!', 'Step completed.',
    'Good work today.', 'One step closer to your goal.',
  ];

  const toggleTask = (taskId: string) => {
    if (!userId) return;
    const willBeDone = !completedToday[taskId];
    setCompletedToday((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
    toggleDailyTask(userId, dateKey, taskId);
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
  const targetWaterMl = (calculatedPlan?.waterLiters || 3) * 1000;

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardClass = isDark ? 'bg-zinc-900/70 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';

  // Reference material (not time-bound — the herbal reference library and
  // advanced/optional therapies) is shown separately, below the timeline.
  const timelineSections = useMemo(() => sections.filter((s) => !!s.timeLabel), [sections]);
  const referenceSections = useMemo(() => sections.filter((s) => !s.timeLabel), [sections]);

  const taskIds = timelineSections.map((s) => s.id);
  const doneCount = taskIds.filter((id) => completedToday[id]).length;
  const allDone = taskIds.length > 0 && doneCount === taskIds.length;

  // Bucket the day's timeline into Morning/Afternoon/Evening/Night, each
  // sorted by actual clock time — turns one long scroll into four short,
  // scannable groups.
  const grouped = useMemo(() => {
    const byPeriod: Record<Period, PlanSection[]> = { morning: [], afternoon: [], evening: [], night: [] };
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

  // Today's checklist — every value here is real (logged water/meals, the
  // plan's own step-completion, calories/protein actually eaten), never a
  // fabricated metric this app doesn't track.
  const checklistRows: ChecklistRow[] = useMemo(() => [
    {
      key: 'water', Icon: Droplet, label: 'Hydration', labelHi: 'पानी',
      value: `${(waterMl / 1000).toFixed(1)}L / ${(targetWaterMl / 1000).toFixed(1)}L`,
      met: waterMl >= targetWaterMl,
    },
    {
      key: 'steps', Icon: CheckCircle2, label: 'Plan Steps Completed', labelHi: 'प्लान स्टेप्स पूर्ण',
      value: `${doneCount}/${taskIds.length}`,
      met: taskIds.length > 0 && doneCount === taskIds.length,
    },
    {
      key: 'meals', Icon: Utensils, label: 'Meals Logged', labelHi: 'भोजन दर्ज',
      value: `${mealCount}`,
      met: mealCount >= 3,
    },
    {
      key: 'calories', Icon: Flame, label: 'Calories', labelHi: 'कैलोरी',
      value: `${Math.round(achieved.calories)} / ${targetCalories}`,
      met: hasLoggedMeals && achieved.calories > 0 && achieved.calories <= targetCalories,
    },
    {
      key: 'protein', Icon: Activity, label: 'Protein Target', labelHi: 'प्रोटीन लक्ष्य',
      value: `${Math.round(achieved.protein)}g / ${targetProtein}g`,
      met: achieved.protein >= targetProtein,
    },
  ], [waterMl, targetWaterMl, doneCount, taskIds.length, mealCount, achieved, targetCalories, targetProtein, hasLoggedMeals]);

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
  const heroInfo = useMemo(() => {
    if (!isToday || sortedToday.length === 0) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let current: PlanSection | null = null;
    let next: PlanSection | null = null;
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

          <button
            type="button"
            onClick={() => setIsUploadPlanOpen(true)}
            title={tr('Upload your own daily plan', 'अपना डेली प्लान अपलोड करें')}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40' : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-emerald-600 hover:border-emerald-300'
            }`}
          >
            <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>

        {customPlanExpiresAt && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 w-fit">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              {tr('Your uploaded plan is active', 'आपका अपलोड किया प्लान सक्रिय है')} — {tr('until', 'तक')} {new Date(customPlanExpiresAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}

        <div className={`pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-100'} flex items-center justify-between gap-3 flex-wrap`}>
          <div className="text-xs opacity-70 font-semibold flex items-center gap-2 flex-wrap min-w-0">
            <span className="break-words">{t('showingLabel')}: <span className="text-emerald-600 font-black">{isToday ? `${t('showingToday')} (${formatDate(selectedDate)})` : formatDate(selectedDate)}</span></span>
            {programDay != null && !customPlanExpiresAt && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Day {programDay} of 14</span>
            )}
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

      {/* 2. RIGHT NOW — the single step whose time has arrived, enlarged and
          pinned to the top so there's nothing to scroll for. Swaps to the
          next step on its own the moment its time passes. */}
      {heroInfo && (
        <div className={`relative overflow-hidden rounded-3xl p-5 sm:p-7 ${isDark ? 'bg-zinc-950' : 'bg-white'} border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5`}>
          <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="relative space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {heroInfo.isUpcoming ? 'Coming Up' : 'Right Now'}
              </span>
              {heroInfo.item.timeLabel && (
                <span className="text-xs font-black opacity-60">{heroInfo.item.timeLabel}</span>
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
                <h3 className={`text-lg sm:text-xl font-black break-words ${completedToday[heroInfo.item.id] ? 'text-emerald-600' : ''}`}>
                  {heroInfo.item.title}
                </h3>
                <p className={`text-sm leading-relaxed mt-1.5 whitespace-pre-line break-words ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {heroInfo.item.body}
                </p>
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
      )}

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
          <TodayChecklistCard rows={checklistRows} isDark={isDark} />
        </>
      ) : (
        <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4 min-w-0`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
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
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-emerald-500 min-w-0">
                <Clock className="w-5 h-5 shrink-0" />
                <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                  24-Hour Reversal Timeline
                </h3>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0">
                Matched to you
              </span>
            </div>

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
                        return (
                          <div
                            key={section.id}
                            className={`rounded-xl sm:rounded-2xl border transition-colors overflow-hidden ${done ? 'bg-emerald-500/10 border-emerald-500/40' : `${subCardClass} border-transparent`}`}
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
                                      <span className="text-[10px] font-black text-emerald-500 shrink-0">{section.timeLabel}</span>
                                    )}
                                    <span className={`text-xs sm:text-sm font-bold break-words ${done ? 'text-emerald-600' : ''}`}>{section.title}</span>
                                  </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 opacity-40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                            {open && (
                              <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line break-words px-3 sm:px-4 pb-3.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'} ${done ? 'opacity-60' : ''}`}>
                                {section.body}
                              </p>
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
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
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

      <UploadDailyPlanModal
        isOpen={isUploadPlanOpen}
        onClose={() => setIsUploadPlanOpen(false)}
        onUploaded={() => {
          setSelectedDate(startOfToday());
          setPlanRefreshKey((k) => k + 1);
        }}
      />

    </div>
  );
};

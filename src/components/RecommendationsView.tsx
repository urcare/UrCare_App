import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, Target, ChevronRight, ChevronDown,
  Stethoscope, FileText, Award, Circle, Check,
  RefreshCw, AlertCircle, Clock,
  Sunrise, Sun, Sunset, Moon,
} from 'lucide-react';
import { UserHealthProfile, Prescription } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { DailyCalendar, toDateKey } from './DailyCalendar';
import { PlanSection } from './ReversalLibraryPanel';
import {
  getDailyPlan, getDailyLog, getTaskCompletion,
  toggleDailyTask, getActiveDates,
} from '../utils/supabase';

interface RecommendationsViewProps {
  profile: UserHealthProfile;
  prescriptions?: Prescription[];
  onOpenStore?: () => void;
  onOpenConsultDoctor?: () => void;
  onOpenProModal?: (feature: string) => void;
  /** Called whenever this day's non-time-bound reference rows (condition
   *  library, recipes, vitamins...) change, so a parent can render them
   *  statically in its own sidebar instead of inline here. */
  onReferenceSections?: (sections: PlanSection[]) => void;
}

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
  onOpenConsultDoctor,
  onReferenceSections,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { t } = useLanguage();
  const userId = profile.id || '';

  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday);
  const todayDate = startOfToday();
  const isToday = toDateKey(selectedDate) === toDateKey(todayDate);
  const dateKey = toDateKey(selectedDate);

  const [programDay, setProgramDay] = useState<number | null>(null);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  const [achieved, setAchieved] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [hasLoggedMeals, setHasLoggedMeals] = useState(false);
  const [mealCount, setMealCount] = useState(0);

  const [expandedItems, toggleItem] = useToggleSet();

  // Ticks once a minute purely to force a re-render, so "today"'s timeline
  // re-evaluates which period is current as the real clock moves — without
  // this, the page would keep showing whichever period was current at the
  // moment it was first opened, even hours later.
  const [, forceClockTick] = useState(0);
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
      }
      setPlanLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, dateKey]);

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

  // For today, show ONLY the period matching the real clock right now — as
  // time moves into the next period, this section swaps to match (no other
  // period is shown until then). Viewing a past/future day via the calendar
  // has no "current time" to match, so it still shows the full day; today
  // also falls back to the full day if the live period happens to be empty
  // (e.g. nothing scheduled for "Night") so the timeline is never blank.
  const visiblePeriods = isToday && activePeriod && grouped[activePeriod].length > 0
    ? PERIODS.filter((p) => p.key === activePeriod)
    : PERIODS;

  // The reference library (condition notes, recipes, vitamins...) is not
  // rendered here — it's lifted up so a parent can show it statically in its
  // own sidebar, always in view, instead of inline in this scrolling column.
  useEffect(() => {
    onReferenceSections?.(referenceSections);
  }, [referenceSections, onReferenceSections]);

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

      {/* 1. FRIENDLY, SIMPLE HEADER */}
      <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black tracking-tight break-words bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {t('dailyPlanTitle')}
              </h2>
              <p className="text-xs opacity-70 mt-0.5 break-words">
                {t('dailyPlanSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenConsultDoctor?.()}
            className="px-3.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-teal-500/20 shrink-0 w-full sm:w-auto justify-center"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>{t('askADoctor')}</span>
          </button>
        </div>

        <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs opacity-75 font-semibold flex items-center gap-2 flex-wrap min-w-0">
            <span className="break-words">{t('showingLabel')}: <span className="text-emerald-500 font-black">{isToday ? `${t('showingToday')} (${formatDate(selectedDate)})` : formatDate(selectedDate)}</span></span>
            {programDay != null && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 shrink-0">Day {programDay} of 14</span>
            )}
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(startOfToday())}
              className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{t('backToToday')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CALENDAR + TARGET vs ACHIEVEMENT METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start min-w-0">
        <DailyCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markedDates={markedDates}
          isDark={isDark}
        />

        <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4 min-w-0`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-emerald-500 min-w-0">
              {isToday ? <Target className="w-5 h-5 shrink-0" /> : <Award className="w-5 h-5 shrink-0" />}
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                {isToday ? t('todaysNutritionGoals') : t('goalsVsWhatYouAte')}
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
              {isToday ? "Today's Goal" : hasLoggedMeals ? `${mealCount} Meal${mealCount > 1 ? 's' : ''} Logged` : 'Nothing Logged'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Calories</span>
              <div className="text-lg sm:text-xl font-black text-emerald-500">{targetCalories} <span className="text-[10px] sm:text-xs opacity-60">kcal</span></div>
              {!isToday && <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.calories)} kcal` : 'Not logged'}</div>}
            </div>
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Protein</span>
              <div className="text-lg sm:text-xl font-black">{targetProtein} <span className="text-[10px] sm:text-xs opacity-60">g</span></div>
              {!isToday && <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.protein)} g` : 'Not logged'}</div>}
            </div>
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Carbs</span>
              <div className="text-lg sm:text-xl font-black">{targetCarbs} <span className="text-[10px] sm:text-xs opacity-60">g</span></div>
              {!isToday && <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.carbs)} g` : 'Not logged'}</div>}
            </div>
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${subCardClass} text-center space-y-1 min-w-0`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Fats</span>
              <div className="text-lg sm:text-xl font-black">{targetFats} <span className="text-[10px] sm:text-xs opacity-60">g</span></div>
              {!isToday && <div className="text-[10px] sm:text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.fats)} g` : 'Not logged'}</div>}
            </div>
          </div>

          {taskIds.length > 0 && (
            <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 flex-wrap ${allDone ? 'bg-emerald-500/15 border border-emerald-500/40' : subCardClass}`}>
              <div className="flex items-center gap-2 min-w-0">
                {allDone ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 opacity-50 shrink-0" />}
                <span className="text-xs font-bold truncate">
                  {allDone ? "All done for this day! 🎉" : `${doneCount}/${taskIds.length} steps checked off`}
                </span>
              </div>
              <div className={`w-20 sm:w-24 h-1.5 rounded-full overflow-hidden shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / taskIds.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. THE PLAN ITSELF — a fixed 24-hour timeline, grouped into
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
                  {visiblePeriods.length === 1 ? `${visiblePeriods[0].label} Routine — Right Now` : '24-Hour Reversal Timeline'}
                </h3>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0 flex items-center gap-1">
                {visiblePeriods.length === 1 ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>Live Now</span>
                  </>
                ) : (
                  'Matched to you'
                )}
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
                      {items.map((section) => {
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

    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Target, ChevronRight, ChevronDown,
  Stethoscope, FileText, Award, Circle,
  RefreshCw, AlertCircle, Clock, Search,
  Sunrise, Sun, Sunset, Moon, X,
} from 'lucide-react';
import { UserHealthProfile, Prescription } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { DailyCalendar, toDateKey } from './DailyCalendar';
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
}

/** One step/branch of the static reversal-plan protocol, as assembled by the
 *  server for this user's own conditions + program day. Never AI-written. */
interface PlanSection {
  id: string;
  timeLabel: string | null;
  title: string;
  body: string;
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

/** Groups the non-time-bound reference library into readable categories,
 *  purely from the id prefix each row was seeded with — no extra DB column
 *  needed. Keep this in sync if new id prefixes are added to the seed data. */
function categoryFor(id: string): string {
  if (id.startsWith('p1-ref-')) return 'Herbal Reference by Condition';
  if (id.startsWith('p3-vit-')) return 'Vitamins';
  if (id.startsWith('p3-min-')) return 'Minerals';
  if (id.startsWith('p3-supp-')) return 'Therapeutic Supplements';
  if (id.startsWith('p3-meal-')) return 'Enhanced Meal Plans';
  if (id.startsWith('p4-b')) return 'Breakfast Recipes';
  if (id.startsWith('p4-l')) return 'Lunch Recipes';
  if (id === 'p4-formula' || id === 'p4-shopping-list') return 'Meal List Basics';
  if (id.startsWith('p1-advanced-exercise-')) return 'Advanced Exercise Plans';
  if (id.startsWith('p1-advanced-')) return 'Advanced Therapies';
  if (id.startsWith('p1-intensive-')) return 'Intensive Add-On Plans';
  if (id.startsWith('p1-diet-mod-')) return 'Condition-Specific Diet';
  if (id === 'p1-troubleshoot-guide' || id === 'p1-safety-reminders' || id === 'p1-supplement-schedule') {
    return 'Help, Safety & Quick Reference';
  }
  return 'Other';
}

const CATEGORY_ORDER = [
  'Herbal Reference by Condition',
  'Condition-Specific Diet',
  'Intensive Add-On Plans',
  'Advanced Exercise Plans',
  'Advanced Therapies',
  'Vitamins',
  'Minerals',
  'Therapeutic Supplements',
  'Enhanced Meal Plans',
  'Meal List Basics',
  'Breakfast Recipes',
  'Lunch Recipes',
  'Help, Safety & Quick Reference',
  'Other',
];

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
  const [expandedCategories, toggleCategory] = useToggleSet();
  const [refSearch, setRefSearch] = useState('');

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

  const toggleTask = (taskId: string) => {
    if (!userId) return;
    setCompletedToday((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
    toggleDailyTask(userId, dateKey, taskId);
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

  // Group + filter the reference library. When searching, categories with a
  // match auto-expand; otherwise expansion is manual (click to open).
  const search = refSearch.trim().toLowerCase();
  const referenceByCategory = useMemo(() => {
    const map = new Map<string, PlanSection[]>();
    for (const s of referenceSections) {
      if (search && !s.title.toLowerCase().includes(search) && !s.body.toLowerCase().includes(search)) continue;
      const cat = categoryFor(s.id);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, items: map.get(cat)! }));
  }, [referenceSections, search]);

  return (
    <div id="diet-recommendations-section" className="space-y-5 sm:space-y-6 text-left min-w-0">

      {/* 1. FRIENDLY, SIMPLE HEADER */}
      <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black tracking-tight break-words">
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
                <h3 className="text-sm sm:text-base font-black tracking-tight truncate">24-Hour Reversal Timeline</h3>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 shrink-0">
                Matched to you
              </span>
            </div>

            <div className="space-y-5">
              {PERIODS.map(({ key, label, range, Icon }) => {
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
                                {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 opacity-40" />}
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
                                    <span className={`text-xs sm:text-sm font-bold break-words ${done ? 'line-through opacity-60' : ''}`}>{section.title}</span>
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

          {/* Condition-specific herbal reference + the full reversal library —
              not time-bound, so shown as a searchable, collapsible reference
              instead of a wall of text. */}
          {referenceSections.length > 0 && (
            <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4 min-w-0`}>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-500 min-w-0">
                  <FileText className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm sm:text-base font-black tracking-tight truncate">Your Full Reversal Library</h3>
                </div>
                <span className="text-[10px] font-bold opacity-50 shrink-0">{referenceSections.length} items</span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                  placeholder="Search recipes, herbs, vitamins, supplements…"
                  className={`w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${subCardClass} ${isDark ? 'placeholder:text-zinc-500' : 'placeholder:text-zinc-400'}`}
                />
                {refSearch && (
                  <button type="button" onClick={() => setRefSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-90 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {referenceByCategory.length === 0 ? (
                <p className="text-xs opacity-60 text-center py-4">No matches for "{refSearch}".</p>
              ) : (
                <div className="space-y-2">
                  {referenceByCategory.map(({ category, items }) => {
                    const catOpen = !!search || expandedCategories.has(category);
                    return (
                      <div key={category} className={`rounded-xl sm:rounded-2xl border overflow-hidden ${subCardClass}`}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center gap-2 px-3.5 py-3 text-left cursor-pointer"
                        >
                          <span className="text-xs sm:text-sm font-black flex-1 min-w-0 truncate">{category}</span>
                          <span className="text-[10px] font-bold opacity-50 shrink-0">{items.length}</span>
                          <ChevronDown className={`w-4 h-4 opacity-40 shrink-0 transition-transform ${catOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {catOpen && (
                          <div className={`px-2.5 sm:px-3 pb-2.5 sm:pb-3 space-y-2 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                            {items.map((section) => {
                              const open = expandedItems.has(section.id);
                              return (
                                <div key={section.id} className={`rounded-xl border overflow-hidden mt-2.5 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                                  <button
                                    type="button"
                                    onClick={() => toggleItem(section.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer"
                                  >
                                    <span className="text-xs font-bold flex-1 min-w-0 break-words">{section.title}</span>
                                    <ChevronDown className={`w-3.5 h-3.5 opacity-40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                                  </button>
                                  {open && (
                                    <p className={`text-xs leading-relaxed whitespace-pre-line break-words px-3 pb-3 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                      {section.body}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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

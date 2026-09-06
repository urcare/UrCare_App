import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Target, ChevronRight,
  Stethoscope, FileText, Award, Circle,
  RefreshCw, AlertCircle, Clock,
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

  return (
    <div id="diet-recommendations-section" className="space-y-6 text-left">

      {/* 1. FRIENDLY, SIMPLE HEADER */}
      <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                {t('dailyPlanTitle')}
              </h2>
              <p className="text-xs opacity-70 mt-1 max-w-md">
                {t('dailyPlanSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenConsultDoctor?.()}
            className="px-3.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-teal-500/20 shrink-0 w-full md:w-auto justify-center"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>{t('askADoctor')}</span>
          </button>
        </div>

        <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs opacity-75 font-semibold flex items-center gap-2 flex-wrap">
            <span>{t('showingLabel')}: <span className="text-emerald-500 font-black">{isToday ? `${t('showingToday')} (${formatDate(selectedDate)})` : formatDate(selectedDate)}</span></span>
            {programDay != null && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">Day {programDay} of 14</span>
            )}
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(startOfToday())}
              className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{t('backToToday')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CALENDAR + TARGET vs ACHIEVEMENT METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        <DailyCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markedDates={markedDates}
          isDark={isDark}
        />

        <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-emerald-500">
              {isToday ? <Target className="w-5 h-5" /> : <Award className="w-5 h-5" />}
              <h3 className="text-sm font-black uppercase tracking-wider">
                {isToday ? t('todaysNutritionGoals') : t('goalsVsWhatYouAte')}
              </h3>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
              {isToday ? "Today's Goal" : hasLoggedMeals ? `${mealCount} Meal${mealCount > 1 ? 's' : ''} Logged` : 'Nothing Logged'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Calories</span>
              <div className="text-xl font-black text-emerald-500">{targetCalories} <span className="text-xs opacity-60">kcal</span></div>
              {!isToday && <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.calories)} kcal` : 'Not logged'}</div>}
            </div>
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Protein</span>
              <div className="text-xl font-black">{targetProtein} <span className="text-xs opacity-60">g</span></div>
              {!isToday && <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.protein)} g` : 'Not logged'}</div>}
            </div>
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Carbs</span>
              <div className="text-xl font-black">{targetCarbs} <span className="text-xs opacity-60">g</span></div>
              {!isToday && <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.carbs)} g` : 'Not logged'}</div>}
            </div>
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Fats</span>
              <div className="text-xl font-black">{targetFats} <span className="text-xs opacity-60">g</span></div>
              {!isToday && <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achieved.fats)} g` : 'Not logged'}</div>}
            </div>
          </div>

          {taskIds.length > 0 && (
            <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${allDone ? 'bg-emerald-500/15 border border-emerald-500/40' : subCardClass}`}>
              <div className="flex items-center gap-2">
                {allDone ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 opacity-50" />}
                <span className="text-xs font-bold">
                  {allDone ? "All done for this day! 🎉" : `${doneCount}/${taskIds.length} steps checked off`}
                </span>
              </div>
              <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / taskIds.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. THE PLAN ITSELF — a fixed 24-hour timeline, personalized only by
          which condition-specific steps are included (no AI text). */}
      {planLoading ? (
        <div className={`p-10 rounded-3xl ${cardClass} text-center space-y-3`}>
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-500" />
          <p className="text-sm font-bold opacity-70">Loading your plan...</p>
        </div>
      ) : planError ? (
        <div className={`p-6 rounded-3xl ${cardClass} text-center space-y-2`}>
          <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
          <p className="text-sm font-bold text-rose-500">{planError}</p>
        </div>
      ) : timelineSections.length === 0 ? (
        <div className={`p-10 rounded-3xl ${cardClass} text-center space-y-2`}>
          <p className="text-sm font-bold opacity-70">No plan available for this day.</p>
        </div>
      ) : (
        <>
          {/* 24-hour timeline */}
          <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-emerald-500">
                <Clock className="w-5 h-5" />
                <h3 className="text-base font-black tracking-tight">{t('todaysMeals') || '24-Hour Reversal Schedule'}</h3>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                Matched to your conditions
              </span>
            </div>

            <div className="space-y-3">
              {timelineSections.map((section) => {
                const done = !!completedToday[section.id];
                return (
                  <div
                    key={section.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${done ? 'bg-emerald-500/10 border-emerald-500/40' : `${subCardClass} border-transparent`}`}
                  >
                    <button type="button" onClick={() => toggleTask(section.id)} className="flex items-start gap-2.5 text-left cursor-pointer group w-full">
                      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 opacity-40 shrink-0 mt-0.5 group-hover:opacity-70" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {section.timeLabel && (
                            <span className="text-[10px] font-black uppercase text-emerald-500">{section.timeLabel}</span>
                          )}
                          <span className={`text-xs font-extrabold ${done ? 'line-through opacity-60' : ''}`}>{section.title}</span>
                        </div>
                        <p className={`text-xs leading-relaxed mt-1 whitespace-pre-line ${isDark ? 'text-zinc-300' : 'text-zinc-700'} ${done ? 'opacity-60' : ''}`}>
                          {section.body}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Condition-specific herbal reference + optional advanced therapies —
              not time-bound, so shown as a reference list rather than in the timeline. */}
          {referenceSections.length > 0 && (
            <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
                <div className="flex items-center gap-2 text-emerald-500">
                  <FileText className="w-5 h-5" />
                  <h3 className="text-base font-black tracking-tight">Your Condition-Specific Reference</h3>
                </div>
              </div>
              <div className="space-y-3">
                {referenceSections.map((section) => (
                  <div key={section.id} className={`p-3.5 sm:p-4 rounded-2xl ${subCardClass}`}>
                    <h4 className="text-xs font-extrabold mb-1">{section.title}</h4>
                    <p className={`text-xs leading-relaxed whitespace-pre-line ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{section.body}</p>
                  </div>
                ))}
              </div>
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
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
            <div className="flex items-center gap-2 text-emerald-500"><FileText className="w-5 h-5" /><h3 className="text-base font-black tracking-tight">{t('myPrescriptions')}</h3></div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">{prescriptions.length} Issued</span>
          </div>
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <div key={rx.id} className={`p-4 rounded-2xl ${subCardClass} space-y-2`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{rx.diagnosis}</h4>
                    <p className="text-[11px] text-zinc-500">{rx.doctorName} • {rx.date}</p>
                  </div>
                </div>
                {rx.medicines.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rx.medicines.map((med, i) => (
                      <div key={i} className={`p-2.5 rounded-xl text-[11px] ${isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200'}`}>
                        <span className="font-bold">{med.name}</span> — {med.dosage}, {med.frequency}
                      </div>
                    ))}
                  </div>
                )}
                {rx.notes && <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{rx.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

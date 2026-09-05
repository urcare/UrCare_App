import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Ban, Sparkles, Target, ChevronRight,
  Stethoscope, FileText, Dumbbell, Award, Circle, HelpCircle,
  Droplets, Quote, RefreshCw, AlertCircle
} from 'lucide-react';
import { UserHealthProfile, Prescription } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { DailyCalendar, toDateKey } from './DailyCalendar';
import {
  getDailyPlan, generateDailyPlan, getDailyLog, getTaskCompletion,
  toggleDailyTask, getActiveDates,
} from '../utils/supabase';

interface RecommendationsViewProps {
  profile: UserHealthProfile;
  prescriptions?: Prescription[];
  onOpenStore?: () => void;
  onOpenConsultDoctor?: () => void;
  onOpenProModal?: (feature: string) => void;
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

  const [plan, setPlan] = useState<any | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  const [achieved, setAchieved] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [hasLoggedMeals, setHasLoggedMeals] = useState(false);
  const [mealCount, setMealCount] = useState(0);

  // Load (or generate, if today and none exists yet) the plan for the selected day.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPlanLoading(true);
    setPlanError(null);
    setPlan(null);

    (async () => {
      let existing = await getDailyPlan(userId, dateKey);
      if (!existing && isToday) {
        // Only the very first visit each day hits this — Claude takes ~15-20s to
        // write a full personalized day, so show that it's genuinely working
        // rather than just spinning silently.
        if (!cancelled) setIsGeneratingPlan(true);
        const result = await generateDailyPlan(dateKey, profile);
        if (result.error) {
          if (!cancelled) setPlanError(result.error);
        } else {
          existing = result.plan;
        }
      }
      if (!cancelled) {
        setPlan(existing || null);
        setPlanLoading(false);
        setIsGeneratingPlan(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, dateKey, isToday]);

  // Rotating status line while the first-of-the-day plan is being generated —
  // purely cosmetic (doesn't change actual latency), but a wait with visible
  // progress reads very differently from a wait that looks stuck.
  const generatingMessages = [
    'Reviewing your goals and profile...',
    'Planning your meals for today...',
    'Picking the right exercises for you...',
    'Working out your hydration & macros...',
    'Almost ready...',
  ];
  const [generatingMsgIndex, setGeneratingMsgIndex] = useState(0);
  useEffect(() => {
    if (!isGeneratingPlan) { setGeneratingMsgIndex(0); return; }
    const interval = setInterval(() => {
      setGeneratingMsgIndex((i) => Math.min(i + 1, generatingMessages.length - 1));
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneratingPlan]);

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

  // Every checkable item for the day: one per meal slot + one per exercise activity.
  const mealSlots: { id: string; label: string; emoji: string; data: { meal: string; tip: string } | undefined }[] = useMemo(() => plan ? [
    { id: 'meal-morning', label: 'Morning', emoji: '🌅', data: plan.morning_plan },
    { id: 'meal-afternoon', label: 'Afternoon', emoji: '☀️', data: plan.afternoon_plan },
    { id: 'meal-evening', label: 'Evening', emoji: '🌇', data: plan.evening_plan },
    { id: 'meal-night', label: 'Night', emoji: '🌙', data: plan.night_plan },
  ] : [], [plan]);

  const exerciseActivities: { name: string; duration: string; benefit: string }[] = plan?.exercise_plan?.activities || [];
  const exerciseAvoid: string[] = plan?.exercise_plan?.avoid || [];
  const eatList: string[] = plan?.nutrition_guidance?.eat || [];
  const avoidList: string[] = plan?.nutrition_guidance?.avoid || [];

  const taskIds = [
    ...mealSlots.map((m) => m.id),
    ...exerciseActivities.map((_, i) => `exercise-${i}`),
  ];
  const doneCount = taskIds.filter((id) => completedToday[id]).length;
  const allDone = taskIds.length > 0 && doneCount === taskIds.length;

  return (
    <div id="diet-recommendations-section" className="space-y-6 text-left">

      {/* 1. FRIENDLY, SIMPLE HEADER */}
      <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-500" />
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
          <div className="text-xs opacity-75 font-semibold">
            {t('showingLabel')}: <span className="text-emerald-500 font-black">{isToday ? `${t('showingToday')} (${formatDate(selectedDate)})` : formatDate(selectedDate)}</span>
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
                  {allDone ? "All done for this day! 🎉" : `${doneCount}/${taskIds.length} things checked off`}
                </span>
              </div>
              <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / taskIds.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. THE PLAN ITSELF — loading / error / real content */}
      {planLoading ? (
        <div className={`p-10 rounded-3xl ${cardClass} text-center space-y-4`}>
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-500" />
          {isGeneratingPlan ? (
            <>
              <div className="space-y-1">
                <p className="text-sm font-bold">Building your personalized plan for today</p>
                <p className="text-xs opacity-60 transition-all">{generatingMessages[generatingMsgIndex]}</p>
              </div>
              <div className={`w-full max-w-xs mx-auto h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-[3000ms] ease-linear"
                  style={{ width: `${((generatingMsgIndex + 1) / generatingMessages.length) * 100}%` }}
                />
              </div>
              <p className="text-[11px] opacity-40">This only takes this long the first time each day — after that it loads instantly.</p>
            </>
          ) : (
            <p className="text-sm font-bold opacity-70">Loading...</p>
          )}
        </div>
      ) : planError ? (
        <div className={`p-6 rounded-3xl ${cardClass} text-center space-y-2`}>
          <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
          <p className="text-sm font-bold text-rose-500">{planError}</p>
        </div>
      ) : !plan ? (
        <div className={`p-10 rounded-3xl ${cardClass} text-center space-y-2`}>
          <p className="text-sm font-bold opacity-70">
            {isToday ? 'No plan yet — try refreshing this page.' : 'No plan was generated for this day.'}
          </p>
        </div>
      ) : (
        <>
          {/* Daily quote */}
          {plan.daily_quote && (
            <div className={`p-4 sm:p-5 rounded-3xl ${cardClass} flex items-start gap-3`}>
              <Quote className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-sm italic font-semibold opacity-90">{plan.daily_quote}</p>
            </div>
          )}

          {/* Meal-by-meal plan */}
          <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
              <div className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-base font-black tracking-tight">{t('todaysMeals')}</h3>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Personalized</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mealSlots.map((slot) => {
                const done = !!completedToday[slot.id];
                if (!slot.data) return null;
                return (
                  <div key={slot.id} className={`p-3.5 rounded-2xl space-y-1.5 border transition-all ${done ? 'bg-emerald-500/10 border-emerald-500/40' : `${subCardClass} border-transparent`}`}>
                    <button type="button" onClick={() => toggleTask(slot.id)} className="flex items-start gap-2 text-left cursor-pointer group w-full">
                      {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 opacity-40 shrink-0 mt-0.5 group-hover:opacity-70" />}
                      <span className={`text-xs font-extrabold flex items-center gap-1.5 ${done ? 'line-through opacity-60' : ''}`}>
                        <span>{slot.emoji}</span><span>{slot.label}</span>
                      </span>
                    </button>
                    <p className={`text-xs leading-relaxed pl-6 ${isDark ? 'text-zinc-300' : 'text-zinc-700'} ${done ? 'opacity-60' : ''}`}>{slot.data.meal}</p>
                    {slot.data.tip && <p className="text-[11px] pl-6 opacity-60 italic">💡 {slot.data.tip}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Foods to eat vs avoid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
                <div className="flex items-center gap-2 text-emerald-500"><CheckCircle2 className="w-5 h-5" /><h3 className="text-base font-black tracking-tight">{t('foodsToEat')}</h3></div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Recommended</span>
              </div>
              <ul className="space-y-2">
                {eatList.map((item, i) => (
                  <li key={i} className={`p-3 rounded-xl text-xs leading-relaxed ${subCardClass}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
                <div className="flex items-center gap-2 text-rose-500"><Ban className="w-5 h-5" /><h3 className="text-base font-black tracking-tight">{t('foodsToAvoid')}</h3></div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-500">Avoid</span>
              </div>
              <ul className="space-y-2">
                {avoidList.map((item, i) => (
                  <li key={i} className={`p-3 rounded-xl text-xs leading-relaxed ${subCardClass}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Exercise + Hydration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
                <div className="flex items-center gap-2 text-teal-400"><Dumbbell className="w-5 h-5 text-teal-500" /><h3 className="text-base font-black tracking-tight">{t('exerciseForToday')}</h3></div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-teal-500/10 text-teal-400">Today's Plan</span>
              </div>
              <div className="space-y-3">
                {exerciseActivities.map((ex, i) => {
                  const taskId = `exercise-${i}`;
                  const done = !!completedToday[taskId];
                  return (
                    <div key={i} className={`p-3.5 rounded-2xl space-y-1.5 border transition-all ${done ? 'bg-teal-500/10 border-teal-500/40' : `${subCardClass} border-transparent`}`}>
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => toggleTask(taskId)} className="flex items-start gap-2 text-left cursor-pointer group">
                          {done ? <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 opacity-40 shrink-0 mt-0.5 group-hover:opacity-70" />}
                          <span className={`text-xs font-extrabold ${done ? 'line-through opacity-60' : ''}`}>{ex.name}</span>
                        </button>
                        <span className="text-[10px] font-bold text-teal-400 px-2 py-0.5 rounded bg-teal-500/10 shrink-0">{ex.duration}</span>
                      </div>
                      <p className={`text-xs leading-relaxed pl-6 ${isDark ? 'text-zinc-300' : 'text-zinc-700'} ${done ? 'opacity-60' : ''}`}>{ex.benefit}</p>
                    </div>
                  );
                })}
                {exerciseAvoid.length > 0 && (
                  <div className={`p-3 rounded-xl text-[11px] ${subCardClass} opacity-80`}>
                    <span className="font-bold text-amber-500">Be careful with: </span>{exerciseAvoid.join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
                <div className="flex items-center gap-2 text-blue-400"><Droplets className="w-5 h-5 text-blue-500" /><h3 className="text-base font-black tracking-tight">{t('hydration')}</h3></div>
              </div>
              {plan.hydration_plan && (
                <div className="space-y-2">
                  <div className="text-2xl font-black text-blue-500">{plan.hydration_plan.targetLiters}L <span className="text-xs opacity-60 font-bold">today</span></div>
                  <p className="text-xs opacity-80 leading-relaxed">{plan.hydration_plan.tip}</p>
                </div>
              )}
              {plan.general_advice && (
                <div className={`p-3 rounded-xl text-xs leading-relaxed ${subCardClass}`}>
                  <span className="font-bold">Today's tip: </span>{plan.general_advice}
                </div>
              )}
            </div>
          </div>

          {plan.medical_disclaimer && (
            <p className="text-[11px] opacity-50 flex items-start gap-1.5 px-1">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{plan.medical_disclaimer}</span>
            </p>
          )}
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

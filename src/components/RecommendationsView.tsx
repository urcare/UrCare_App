import React, { useMemo, useState } from 'react';
import {
  CheckCircle2, AlertTriangle, Ban,
  Sparkles, Target, ChevronRight,
  Stethoscope, FileText,
  Dumbbell, Award, Circle, HelpCircle
} from 'lucide-react';
import { UserHealthProfile, Prescription, MealItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import { DailyCalendar, toDateKey } from './DailyCalendar';

const MEAL_LOG_KEY = 'urcare_meal_log';
const TASK_COMPLETION_KEY = 'urcare_daily_task_completion';

const readMealLog = (): Record<string, MealItem[]> => {
  try {
    const raw = localStorage.getItem(MEAL_LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const readTaskCompletion = (): Record<string, Record<string, boolean>> => {
  try {
    const raw = localStorage.getItem(TASK_COMPLETION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeTaskCompletion = (data: Record<string, Record<string, boolean>>) => {
  try {
    localStorage.setItem(TASK_COMPLETION_KEY, JSON.stringify(data));
  } catch {}
};

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
  onOpenStore,
  onOpenConsultDoctor,
  onOpenProModal,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Selected day being reviewed — defaults to today; the calendar lets the user browse any past day.
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday);
  const todayDate = startOfToday();
  const isToday = toDateKey(selectedDate) === toDateKey(todayDate);
  const dateKey = toDateKey(selectedDate);

  // Task completion — persisted per calendar day in localStorage so "done" state survives reloads.
  const [taskCompletion, setTaskCompletion] = useState<Record<string, Record<string, boolean>>>(() => readTaskCompletion());
  const completedToday = taskCompletion[dateKey] || {};

  const toggleTask = (taskId: string) => {
    setTaskCompletion((prev) => {
      const dayMap = { ...(prev[dateKey] || {}) };
      dayMap[taskId] = !dayMap[taskId];
      const next = { ...prev, [dateKey]: dayMap };
      writeTaskCompletion(next);
      return next;
    });
  };

  // Real meal log (written by the AI Food Scanner) — used to show actual achieved macros, never fabricated.
  const mealLog = useMemo(() => readMealLog(), [dateKey]);
  const mealsForSelectedDay: MealItem[] = mealLog[dateKey] || [];
  const achievedCalories = mealsForSelectedDay.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
  const achievedProtein = mealsForSelectedDay.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  const achievedCarbs = mealsForSelectedDay.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
  const achievedFats = mealsForSelectedDay.reduce((sum, m) => sum + (Number(m.fats) || 0), 0);
  const hasLoggedMeals = mealsForSelectedDay.length > 0;

  // Which past dates get a dot on the calendar (any logged meal or any completed task).
  const markedDates = useMemo(() => {
    const set = new Set<string>();
    Object.keys(mealLog).forEach((k) => { if (mealLog[k]?.length) set.add(k); });
    Object.keys(taskCompletion).forEach((k) => {
      if (Object.values(taskCompletion[k] || {}).some(Boolean)) set.add(k);
    });
    return set;
  }, [mealLog, taskCompletion]);

  const { calculatedPlan, dietaryPreference, goal } = profile;
  const targetCalories = calculatedPlan?.targetCalories || 1850;
  const targetProtein = calculatedPlan?.proteinGrams || 140;
  const targetCarbs = calculatedPlan?.carbsGrams || 180;
  const targetFats = calculatedPlan?.fatsGrams || 50;

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardClass = isDark ? 'bg-zinc-900/70 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';

  // Personalize protein sources to the user's actual dietary preference — not a generic one-size list.
  const dietLower = (dietaryPreference || '').toLowerCase();
  const proteinSources = dietLower.includes('vegan')
    ? 'pea/soy protein, tofu, tempeh, lentils, chickpeas, and edamame'
    : dietLower.includes('veg')
      ? 'whey protein, Greek yogurt, paneer, sprouted dal, and tofu'
      : 'whey protein, egg whites, grilled chicken or fish, Greek yogurt, and sprouted dal';

  // Foods to Eat Today — personalized to this user's targets & dietary preference, written in plain language
  const eatList = [
    {
      id: 'eat-protein',
      title: 'Protein-Rich Foods',
      emoji: '🍗',
      desc: `Try to get about ${targetProtein}g of protein a day, spread across 3-4 meals. Good picks: ${proteinSources}.`,
      metric: `${targetProtein}g / day`,
    },
    {
      id: 'eat-fiber',
      title: 'Fiber-Rich Foods',
      emoji: '🥦',
      desc: 'Oats, chia seeds, brown rice, quinoa, and leafy greens like spinach and broccoli. These keep your digestion smooth and help control blood sugar.',
      metric: '~35g fiber',
    },
    {
      id: 'eat-fats',
      title: 'Healthy Fats',
      emoji: '🥑',
      desc: 'Omega-3s (fish oil, 1000mg), a handful of walnuts, flaxseeds, and olive oil. Good for your heart.',
      metric: 'Good fats',
    },
    {
      id: 'eat-micros',
      title: 'Vitamins & Minerals',
      emoji: '💊',
      desc: 'Magnesium (400mg) can help you sleep and recover better, Vitamin D supports bones and immunity, and Vitamin C helps overall health. Ask your doctor before starting any supplement.',
      metric: 'Daily',
    },
  ];

  // What to Avoid Strictly — in plain language
  const avoidList = [
    {
      title: 'Fried & Packaged Fatty Foods',
      emoji: '🍟',
      desc: 'Bakery pastries, hydrogenated oils (vanaspati), and oil that has been reused for frying.',
      reason: 'Adds belly fat and irritates your blood vessels over time.',
    },
    {
      title: 'Sugary Drinks',
      emoji: '🥤',
      desc: 'Packaged fruit juice, soda, and extra sugar in tea or coffee.',
      reason: 'Spikes your blood sugar fast and adds fat to your liver.',
    },
    {
      title: 'Refined Flour & White Carbs',
      emoji: '🍞',
      desc: 'White flour (maida), instant noodles, and low-fiber white bread.',
      reason: 'Causes a sudden sugar spike, then makes you hungry again soon after.',
    },
    {
      title: 'Heavy, Salty Meals Late at Night',
      emoji: '🌙',
      desc: 'Eating salty, heavy food after 9:30 PM.',
      reason: 'Disturbs your sleep and digestion overnight.',
    },
  ];

  // Exercises to Do vs Exercises to Avoid — personalized to goal, written simply
  const exerciseDoList = [
    {
      id: 'ex-cardio',
      name: 'Easy Cardio (Walk, Cycle, or Swim)',
      emoji: '🚶',
      duration: goal === 'lose_weight' ? '40-50 mins' : '35-45 mins',
      benefit: 'Burns fat steadily without over-stressing your body.',
      intensity: 'Easy pace — you should still be able to talk',
    },
    {
      id: 'ex-resistance',
      name: 'Strength Training',
      emoji: '🏋️',
      duration: goal === 'build_muscle' ? '50-60 mins' : '40 mins',
      benefit: 'Builds muscle and helps your body use sugar better.',
      intensity: goal === 'build_muscle' ? 'Challenging — 4-5 sets of 6-10 reps' : 'Moderate — 3-4 sets of 8-12 reps',
    },
    {
      id: 'ex-walk',
      name: 'Short Walk After Meals',
      emoji: '🌤️',
      duration: '10-15 mins',
      benefit: 'A short walk right after eating can lower your blood sugar spike by up to 28%.',
      intensity: 'Brisk walk, within 20 minutes of eating',
    },
  ];

  const exerciseAvoidList = [
    {
      name: 'Extreme, To-Failure HIIT While Undereating',
      emoji: '⚠️',
      reason: 'Raises stress hormones and can burn muscle instead of fat.',
    },
    {
      name: 'Heavy Lifting With Poor Form',
      emoji: '🚫',
      reason: 'Raises the risk of back injury, especially when tired or dehydrated.',
    },
    {
      name: 'Long Fasted Cardio Over 60 Minutes',
      emoji: '⏱️',
      reason: 'Can break down muscle and slow down your metabolism.',
    },
  ];

  const taskIds = [...eatList.map((i) => i.id), ...exerciseDoList.map((i) => i.id)];
  const doneCount = taskIds.filter((id) => completedToday[id]).length;
  const allDone = doneCount === taskIds.length;

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
                Your Daily Health Plan
              </h2>
              <p className="text-xs opacity-70 mt-1 max-w-md">
                Simple, personalized food & exercise guidance made just for you. Pick any day on the calendar to see how you did.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenConsultDoctor?.()}
            className="px-3.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-teal-500/20 shrink-0 w-full md:w-auto justify-center"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Ask a Doctor</span>
          </button>
        </div>

        <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs opacity-75 font-semibold">
            Showing: <span className="text-emerald-500 font-black">{isToday ? `Today (${formatDate(selectedDate)})` : formatDate(selectedDate)}</span>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(startOfToday())}
              className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Back to Today</span>
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
                {isToday ? "Today's Nutrition Goals" : "Goals vs. What You Ate"}
              </h3>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
              {isToday ? "Today's Goal" : hasLoggedMeals ? `${mealsForSelectedDay.length} Meal${mealsForSelectedDay.length > 1 ? 's' : ''} Logged` : 'Nothing Logged'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Calories</span>
              <div className="text-xl font-black text-emerald-500">{targetCalories} <span className="text-xs opacity-60">kcal</span></div>
              {!isToday && (
                <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achievedCalories)} kcal` : 'Not logged'}</div>
              )}
            </div>
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Protein</span>
              <div className="text-xl font-black">{targetProtein} <span className="text-xs opacity-60">g</span></div>
              {!isToday && (
                <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achievedProtein)} g` : 'Not logged'}</div>
              )}
            </div>
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Carbs</span>
              <div className="text-xl font-black">{targetCarbs} <span className="text-xs opacity-60">g</span></div>
              {!isToday && (
                <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achievedCarbs)} g` : 'Not logged'}</div>
              )}
            </div>
            <div className={`p-4 rounded-2xl ${subCardClass} text-center space-y-1`}>
              <span className="text-[10px] font-bold uppercase opacity-60">Fats</span>
              <div className="text-xl font-black">{targetFats} <span className="text-xs opacity-60">g</span></div>
              {!isToday && (
                <div className="text-xs font-extrabold mt-1 opacity-90">{hasLoggedMeals ? `Ate: ${Math.round(achievedFats)} g` : 'Not logged'}</div>
              )}
            </div>
          </div>

          {/* Task completion progress for the selected day */}
          <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${
            allDone ? 'bg-emerald-500/15 border border-emerald-500/40' : subCardClass
          }`}>
            <div className="flex items-center gap-2">
              {allDone ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Circle className="w-4 h-4 opacity-50" />
              )}
              <span className="text-xs font-bold">
                {allDone ? "All done for this day! 🎉" : `${doneCount}/${taskIds.length} things checked off`}
              </span>
            </div>
            <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${taskIds.length ? (doneCount / taskIds.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. TWO COLUMNS: WHAT TO EAT vs WHAT TO AVOID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* RECOMMENDED EATS */}
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-base font-black tracking-tight">Foods to Eat</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
              Recommended
            </span>
          </div>

          <div className="space-y-3">
            {eatList.map((item) => {
              const done = !!completedToday[item.id];
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl space-y-1.5 border transition-all ${
                    done ? 'bg-emerald-500/10 border-emerald-500/40' : `${subCardClass} border-transparent`
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTask(item.id)}
                      className="flex items-start gap-2 text-left cursor-pointer group"
                      title={done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 opacity-40 shrink-0 mt-0.5 group-hover:opacity-70" />
                      )}
                      <h4 className={`text-xs font-extrabold flex items-center gap-1.5 ${done ? 'line-through opacity-60' : ''} ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        <span>{item.emoji}</span>
                        <span>{item.title}</span>
                      </h4>
                    </button>
                    <span className="text-[10px] font-bold text-emerald-500 px-2 py-0.5 rounded bg-emerald-500/10 shrink-0">
                      {item.metric}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed pl-6 ${isDark ? 'text-zinc-300' : 'text-zinc-700'} ${done ? 'opacity-60' : ''}`}>{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* PROHIBITED FOODS */}
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
            <div className="flex items-center gap-2 text-rose-500">
              <Ban className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-black tracking-tight">Foods to Avoid</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-500">
              Avoid
            </span>
          </div>

          <div className="space-y-3">
            {avoidList.map((item, idx) => (
              <div key={idx} className={`p-3.5 rounded-2xl ${subCardClass} space-y-1.5`}>
                <h4 className={`text-xs font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  <span>{item.emoji}</span>
                  <span>{item.title}</span>
                </h4>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{item.desc}</p>
                <div className={`text-[11px] font-semibold pt-1 border-t flex items-start gap-1 ${
                  isDark ? 'border-zinc-800/60 text-rose-400' : 'border-zinc-200 text-rose-600'
                }`}>
                  <HelpCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Why: {item.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4. EXERCISES TO PERFORM vs EXERCISES TO AVOID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* EXERCISES TO DO */}
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
            <div className="flex items-center gap-2 text-teal-400">
              <Dumbbell className="w-5 h-5 text-teal-500" />
              <h3 className="text-base font-black tracking-tight">Exercise for Today</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-teal-500/10 text-teal-400">
              Today's Plan
            </span>
          </div>

          <div className="space-y-3">
            {exerciseDoList.map((ex) => {
              const done = !!completedToday[ex.id];
              return (
                <div
                  key={ex.id}
                  className={`p-3.5 rounded-2xl space-y-1.5 border transition-all ${
                    done ? 'bg-teal-500/10 border-teal-500/40' : `${subCardClass} border-transparent`
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTask(ex.id)}
                      className="flex items-start gap-2 text-left cursor-pointer group"
                      title={done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 opacity-40 shrink-0 mt-0.5 group-hover:opacity-70" />
                      )}
                      <h4 className={`text-xs font-extrabold flex items-center gap-1.5 ${done ? 'line-through opacity-60' : ''} ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        <span>{ex.emoji}</span>
                        <span>{ex.name}</span>
                      </h4>
                    </button>
                    <span className="text-[10px] font-bold text-teal-400 px-2 py-0.5 rounded bg-teal-500/10 shrink-0">
                      {ex.duration}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed pl-6 ${isDark ? 'text-zinc-300' : 'text-zinc-700'} ${done ? 'opacity-60' : ''}`}>{ex.benefit}</p>
                  <div className="text-[11px] text-teal-400 font-bold pt-1 border-t border-zinc-800/40 pl-6">
                    How hard: {ex.intensity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* EXERCISES TO AVOID */}
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-black tracking-tight">Exercises to Skip</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
              Be Careful
            </span>
          </div>

          <div className="space-y-3">
            {exerciseAvoidList.map((ex, idx) => (
              <div key={idx} className={`p-3.5 rounded-2xl ${subCardClass} space-y-1.5`}>
                <h4 className={`text-xs font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  <span>{ex.emoji}</span>
                  <span>{ex.name}</span>
                </h4>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{ex.reason}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4b. DOCTOR-ISSUED PRESCRIPTIONS — real records from the Admin/clinical team, if any */}
      {prescriptions.length > 0 && (
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
            <div className="flex items-center gap-2 text-emerald-500">
              <FileText className="w-5 h-5" />
              <h3 className="text-base font-black tracking-tight">My Prescriptions</h3>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
              {prescriptions.length} Issued
            </span>
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
                {rx.notes && (
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{rx.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

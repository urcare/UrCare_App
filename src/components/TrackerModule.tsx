import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity, Flame, Droplets, Scale, ListChecks, CheckCircle2, Circle, Sparkles,
  Ruler,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, MedicalReportAnalysis } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { getDailyPlan, getTaskCompletion } from '../utils/supabase';
import { toDateKey } from './DailyCalendar';
import { StreakWidget } from './StreakWidget';
import { MacroLogRow, BmiRangeBar, WaterIntakeRing } from './HealthCharts';
import { BiomarkerTrackerVisual } from './BiomarkerTrackerVisual';
import { RadialGauge } from './RadialGauge';
import { useDailyNutrition } from '../hooks/useDailyNutrition';

interface TrackerModuleProps {
  profile: UserHealthProfile;
  account: UserAccount;
  reports: MedicalReportAnalysis[];
  onUpdateProfile: (updated: UserHealthProfile) => void;
}

/** Dynamic two-tone gradient for a 0-100 progress ring — red→amber→emerald
 *  as it climbs, instead of one fixed color, so the gauge itself tells the
 *  story of "how good is this number" at a glance. */
function progressGradient(pct: number): [string, string] {
  if (pct >= 70) return ['#34d399', '#059669'];
  if (pct >= 40) return ['#fbbf24', '#d97706'];
  return ['#fb7185', '#e11d48'];
}

function bmiCategory(bmi: number, tr: (en: string, hi: string) => string): { label: string; gradient: [string, string] } {
  if (bmi < 18.5) return { label: tr('Underweight', 'कम वज़न'), gradient: ['#38bdf8', '#0284c7'] };
  if (bmi < 25) return { label: tr('Normal', 'सामान्य'), gradient: ['#34d399', '#059669'] };
  if (bmi < 30) return { label: tr('Overweight', 'अधिक वज़न'), gradient: ['#fbbf24', '#d97706'] };
  return { label: tr('Obese', 'मोटापा'), gradient: ['#fb7185', '#e11d48'] };
}

/** One dedicated home for every automatic tracker already scattered across
 *  the app — body metrics, biomarkers/vitals, daily nutrition & hydration
 *  and today's plan progress — instead of a user having to visit Home,
 *  Profile and the Daily Plan separately to see the day's full picture.
 *  Deliberately its own vivid, chart-first visual identity throughout
 *  (gradient banners, radial gauges) rather than reusing the Profile
 *  page's flatter card look — while every section still reuses the exact
 *  same live component/hook the rest of the app already uses
 *  (useBiomarkerVitals, useDailyNutrition, MacroLogRow/WaterIntakeRing/
 *  BmiRangeBar, StreakWidget) — nothing here is a second, parallel copy of
 *  data tracked elsewhere. */
export const TrackerModule: React.FC<TrackerModuleProps> = ({ profile, account, reports, onUpdateProfile }) => {
  const { t, language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const userId = profile.id || '';
  const todayKey = toDateKey(new Date());

  const { calculatedPlan, heightCm = 170 } = profile;
  const bmi = calculatedPlan?.bmi || Number((profile.currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
  const bmiPct = Math.min(100, Math.max(0, ((bmi - 15) / (40 - 15)) * 100));
  const bmiInfo = bmiCategory(bmi, tr);

  const {
    waterMl, consumedMacros, consumedCalories,
    isSavingWater, isSavingMacro, isSavingCalories,
    waterTargetMl, calorieTarget, macroTargets,
    handleAddWater, handleResetWater, handleEditWaterTarget,
    handleAddMacro, handleResetMacro, handleEditMacroTarget,
    handleAddCalories, handleResetCalories, handleEditCalorieTarget,
  } = useDailyNutrition(profile, onUpdateProfile);

  const caloriePct = calorieTarget > 0 ? Math.min(100, Math.round((consumedCalories / calorieTarget) * 100)) : 0;
  const proteinPct = macroTargets.protein > 0 ? Math.min(100, Math.round((consumedMacros.protein / macroTargets.protein) * 100)) : 0;
  const carbsPct = macroTargets.carbs > 0 ? Math.min(100, Math.round((consumedMacros.carbs / macroTargets.carbs) * 100)) : 0;
  const fatsPct = macroTargets.fats > 0 ? Math.min(100, Math.round((consumedMacros.fats / macroTargets.fats) * 100)) : 0;

  // Today's real plan timeline + real completion state — the same two
  // calls Home/Profile already make — reduced here to a single done/total
  // count so the whole day's progress reads at a glance.
  const [planSections, setPlanSections] = useState<{ id: string; timeLabel: string | null }[]>([]);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [isPlanLoading, setIsPlanLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setIsPlanLoading(true);
    Promise.all([getDailyPlan(todayKey), getTaskCompletion(userId, todayKey)])
      .then(([{ plan }, completion]) => {
        if (cancelled) return;
        setPlanSections((plan?.sections || []).filter((s: any) => !!s.timeLabel));
        setCompletedToday(completion);
      })
      .finally(() => { if (!cancelled) setIsPlanLoading(false); });
    return () => { cancelled = true; };
  }, [userId, todayKey]);

  const planDoneCount = useMemo(
    () => planSections.filter((s) => completedToday[s.id]).length,
    [planSections, completedToday],
  );
  const planTotalCount = planSections.length;
  const planPct = planTotalCount > 0 ? Math.round((planDoneCount / planTotalCount) * 100) : 0;
  const planGradient = progressGradient(planPct);

  return (
    <div id="urcare-tracker-module" className="min-h-screen bg-transparent text-zinc-900 pb-16">

      {/* HEADER — a bold gradient banner (not the Profile page's plain
          white bar), so this module reads as its own vivid space the
          moment it opens. */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-3 sm:px-8 py-3 sm:py-3.5 shadow-md shadow-teal-900/10">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 min-w-0">
            <Activity className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="text-xs font-black text-white tracking-wide whitespace-nowrap">
              {tr('Tracker', 'ट्रैकर')}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-5 text-left">

        {/* HERO — colorful gradient banner with the streak baked in,
            instead of plain text + a bare widget. */}
        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700 text-white shadow-lg shadow-teal-900/15">
          <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
          <div className="absolute -bottom-14 -left-10 w-40 h-40 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" aria-hidden="true" />
          <div className="relative space-y-3">
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight">{tr('Your Health Tracker', 'आपका हेल्थ ट्रैकर')}</h1>
              <p className="text-xs text-white/80 font-medium max-w-sm">
                {tr('Everything the app tracks about you, automatically, in one place.', 'ऐप जो कुछ भी आपके बारे में ऑटोमैटिक ट्रैक करता है, वह सब एक ही जगह।')}
              </p>
            </div>
            <StreakWidget profile={profile} />
          </div>
        </div>

        {/* TODAY'S PLAN PROGRESS — a colorful radial gauge (red→amber→green
            as it climbs) instead of a plain linear bar. */}
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-violet-50 via-indigo-50/50 to-white border border-violet-200/70 shadow-sm space-y-4">
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-violet-300/25 to-transparent blur-2xl pointer-events-none" aria-hidden="true" />
          <div className="relative flex items-center gap-2 border-b border-violet-100 pb-3">
            <motion.span
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-violet-500/30"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            >
              <ListChecks className="w-4.5 h-4.5" />
            </motion.span>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
              {tr("Today's Plan Progress", 'आज की योजना प्रगति')}
            </h3>
          </div>

          {isPlanLoading ? (
            <div className="h-20 rounded-2xl bg-violet-100/50 animate-pulse" />
          ) : planTotalCount === 0 ? (
            <p className="relative text-xs text-zinc-400 font-medium">
              {tr('No timed steps in today’s plan yet.', 'आज की योजना में अभी कोई समयबद्ध चरण नहीं।')}
            </p>
          ) : (
            <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="relative flex items-center justify-center shrink-0">
                <RadialGauge pct={planPct} colorFrom={planGradient[0]} colorTo={planGradient[1]} size={100} strokeWidth={10} gradId="plan-progress-gauge" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-zinc-950 leading-none">{planPct}%</span>
                  <span className="text-[9px] font-bold text-zinc-400 mt-0.5">{planDoneCount}/{planTotalCount}</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-1.5">
                {planSections.map((s) => {
                  const done = !!completedToday[s.id];
                  return (
                    <div key={s.id} className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-xl ${done ? 'bg-emerald-50' : 'bg-white/70'}`}>
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                      )}
                      <span className={done ? 'text-emerald-700 line-through' : 'text-zinc-700'}>{s.timeLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BODY METRICS — vivid gradient tiles + a BMI radial gauge, instead
            of the Profile page's flat zinc-50 stat boxes. */}
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-sky-50 via-cyan-50/40 to-white border border-sky-200/70 shadow-sm space-y-4">
          <div className="absolute -bottom-14 -right-10 w-36 h-36 rounded-full bg-gradient-to-tr from-sky-300/25 to-transparent blur-2xl pointer-events-none" aria-hidden="true" />
          <div className="relative flex items-center gap-2 border-b border-sky-100 pb-3">
            <motion.span
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/30"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            >
              <Scale className="w-4.5 h-4.5" />
            </motion.span>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
              {tr('Body Metrics', 'शारीरिक मापदंड')}
            </h3>
          </div>

          <div className="relative grid grid-cols-2 gap-3">
            <motion.div
              whileHover={{ y: -2 }}
              className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white space-y-0.5 shadow-sm shadow-sky-500/20"
            >
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-sky-100"><Scale className="w-3 h-3" />{tr('Weight', 'वज़न')}</span>
              <div className="text-lg font-black">{profile.currentWeightKg} <span className="text-xs font-semibold text-sky-100">kg</span></div>
            </motion.div>
            <motion.div
              whileHover={{ y: -2 }}
              className="p-3.5 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white space-y-0.5 shadow-sm shadow-fuchsia-500/20"
            >
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-fuchsia-100"><Ruler className="w-3 h-3" />{tr('Height', 'कद')}</span>
              <div className="text-lg font-black">{heightCm} <span className="text-xs font-semibold text-fuchsia-100">cm</span></div>
            </motion.div>
          </div>

          <div className="relative flex items-center gap-4 p-3.5 rounded-2xl bg-white/70 border border-sky-100">
            <div className="relative flex items-center justify-center shrink-0">
              <RadialGauge pct={bmiPct} colorFrom={bmiInfo.gradient[0]} colorTo={bmiInfo.gradient[1]} size={76} strokeWidth={8} gradId="bmi-gauge" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-zinc-950 leading-none">{bmi}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('BMI Status', 'बीएमआई स्थिति')}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${bmiInfo.gradient[0]}, ${bmiInfo.gradient[1]})` }}
                >
                  {bmiInfo.label}
                </span>
              </div>
              <BmiRangeBar bmi={bmi} tr={tr} />
            </div>
          </div>
        </div>

        {/* BIOMARKER TRACKER — auto-built from the profile (onboarding /
            Root Cause Assessment values, falling back to the latest lab
            report). Deliberately a different, more colorful, chart-based
            presentation than the Profile page's card list (see
            BiomarkerTrackerVisual.tsx) — both share the exact same
            useBiomarkerVitals data/edit logic underneath. */}
        <BiomarkerTrackerVisual
          profile={profile}
          reports={reports}
          onUpdateProfile={onUpdateProfile}
        />

        {/* DAILY NUTRITION & WATER TARGETS — real edit controls
            (MacroLogRow/WaterIntakeRing) stay exactly the shared components
            the Profile page also uses, so editing here or there always
            agrees. The colorful radial gauges above them are purely this
            module's own additional "at a glance" chart layer. */}
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/40 to-white border border-amber-200/70 shadow-sm space-y-4">
          <div className="absolute -top-14 -left-10 w-36 h-36 rounded-full bg-gradient-to-br from-amber-300/25 to-transparent blur-2xl pointer-events-none" aria-hidden="true" />
          <div className="relative flex items-center gap-2 border-b border-amber-100 pb-3">
            <motion.span
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30"
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

          {/* At-a-glance gauge row — calories + each macro as its own tiny
              radial ring, colorful and immediate, before the detailed
              editable rows below. */}
          <div className="relative grid grid-cols-4 gap-2">
            {[
              { label: tr('Cal', 'कैल'), pct: caloriePct, from: '#f59e0b', to: '#ea580c' },
              { label: tr('Protein', 'प्रोटीन'), pct: proteinPct, from: '#34d399', to: '#059669' },
              { label: tr('Carbs', 'कार्ब्स'), pct: carbsPct, from: '#38bdf8', to: '#2563eb' },
              { label: tr('Fats', 'फैट्स'), pct: fatsPct, from: '#c084fc', to: '#9333ea' },
            ].map((g) => (
              <div key={g.label} className="flex flex-col items-center gap-1">
                <div className="relative flex items-center justify-center">
                  <RadialGauge pct={g.pct} colorFrom={g.from} colorTo={g.to} size={56} strokeWidth={6} gradId={`nutri-${g.label}`} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black text-zinc-800">{g.pct}%</span>
                  </div>
                </div>
                <span className="text-[8.5px] font-black uppercase tracking-wide text-zinc-500">{g.label}</span>
              </div>
            ))}
          </div>

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

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, boxShadow: '0 8px 20px -10px rgba(13,148,136,0.35)' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative p-3.5 rounded-2xl bg-gradient-to-br from-teal-500 via-sky-500 to-blue-600 text-white shadow-sm"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-white/90 uppercase tracking-wide">
                <Droplets className="w-3 h-3" />
                {tr('Water Intake Today', 'आज पानी की मात्रा')}
              </span>
              <span className="text-[10px] text-white/70 font-medium">{tr('Daily hydration', 'दैनिक जल सेवन')}</span>
            </div>
            <div className="bg-white/95 rounded-xl p-2.5">
              <WaterIntakeRing
                currentMl={waterMl}
                targetMl={waterTargetMl}
                onAdd={handleAddWater}
                onEditTarget={handleEditWaterTarget}
                onReset={handleResetWater}
                isSaving={isSavingWater}
                tr={tr}
              />
            </div>
          </motion.div>
        </div>

        <p className="text-[10px] text-zinc-400 leading-relaxed text-center flex items-center justify-center gap-1 pt-1">
          <Sparkles className="w-3 h-3 shrink-0 text-fuchsia-400" />
          {tr('Every number on this screen updates automatically as you use the app — nothing here needs to be tracked manually.', 'इस स्क्रीन का हर आंकड़ा ऐप उपयोग करते ही अपने आप अपडेट होता है — यहां कुछ भी मैन्युअली ट्रैक करने की ज़रूरत नहीं।')}
        </p>

      </main>
    </div>
  );
};

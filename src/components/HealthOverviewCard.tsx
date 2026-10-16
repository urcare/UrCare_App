import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronDown, ClipboardList } from 'lucide-react';
import { UserHealthProfile } from '../types';

/** Score at or above this counts as the optimal (green) range. */
const OPTIMAL_SCORE = 85;

interface Factor { label: [string, string]; points: number }

const num = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Health score out of 100, built only from the user's own Root Cause
 *  Analysis answers. Each finding takes points off 100, and every deduction
 *  is listed so the score is never a black box. Returns null until the
 *  assessment has been filled in. */
export function computeHealthOverview(profile: UserHealthProfile) {
  const a = profile.assessmentData;
  if (!a) return null;
  const factors: Factor[] = [];
  const add = (points: number, en: string, hi: string) => { if (points > 0) factors.push({ label: [en, hi], points }); };

  // Blood sugar
  const hba1c = num(a.bloodSugar?.latestHbA1c);
  if (hba1c != null) {
    if (hba1c >= 8) add(15, `HbA1c ${hba1c}% (high)`, `HbA1c ${hba1c}% (ज़्यादा)`);
    else if (hba1c >= 6.5) add(10, `HbA1c ${hba1c}% (diabetic range)`, `HbA1c ${hba1c}% (डायबिटीज़ रेंज)`);
    else if (hba1c >= 5.7) add(5, `HbA1c ${hba1c}% (pre-diabetic range)`, `HbA1c ${hba1c}% (प्री-डायबिटीज़ रेंज)`);
  }
  const fasting = num(a.bloodSugar?.averageFasting7Days);
  if (fasting != null) {
    if (fasting > 126) add(6, `Fasting sugar ${fasting} mg/dL`, `फास्टिंग शुगर ${fasting} mg/dL`);
    else if (fasting >= 100) add(3, `Fasting sugar ${fasting} mg/dL`, `फास्टिंग शुगर ${fasting} mg/dL`);
  }

  // Weight
  const heightM = ((Number(a.heightFeet) || 0) * 12 + (Number(a.heightInches) || 0)) * 0.0254 || (profile.heightCm || 0) / 100;
  const weight = Number(a.currentWeightKg) || profile.currentWeightKg || 0;
  if (heightM > 1 && weight > 0) {
    const bmi = Math.round((weight / (heightM * heightM)) * 10) / 10;
    if (bmi >= 30) add(8, `BMI ${bmi} (obese range)`, `BMI ${bmi} (मोटापा रेंज)`);
    else if (bmi >= 25) add(4, `BMI ${bmi} (overweight)`, `BMI ${bmi} (अधिक वज़न)`);
    else if (bmi < 18.5) add(4, `BMI ${bmi} (underweight)`, `BMI ${bmi} (कम वज़न)`);
  }

  // Blood pressure
  const bp = String(a.cardioVitals?.recentBp || a.cardioVitals?.usualBpRange || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (bp) {
    const [sys, dia] = [Number(bp[1]), Number(bp[2])];
    if (sys >= 140 || dia >= 90) add(6, `Blood pressure ${sys}/${dia}`, `ब्लड प्रेशर ${sys}/${dia}`);
    else if (sys >= 130 || dia >= 80) add(3, `Blood pressure ${sys}/${dia}`, `ब्लड प्रेशर ${sys}/${dia}`);
  }

  // Sleep
  const sleepHours = Number(a.sleep?.averageSleepHours) || 0;
  if (sleepHours > 0 && sleepHours < 6) add(5, `Sleep ${sleepHours} h a night`, `रोज़ ${sleepHours} घंटे नींद`);
  else if (a.sleep?.sleepQuality === 'poor' || a.sleep?.sleepQuality === 'very_poor') add(4, 'Poor sleep quality', 'नींद की खराब गुणवत्ता');

  // Stress
  if (a.stressMental?.stressLevel === 'overwhelming') add(7, 'Overwhelming stress', 'बहुत ज़्यादा तनाव');
  else if (a.stressMental?.stressLevel === 'high') add(4, 'High stress', 'ज़्यादा तनाव');

  // Activity
  if (a.lifestyle) {
    if (!a.lifestyle.regularExercise) add(6, 'No regular exercise', 'नियमित व्यायाम नहीं');
    else if ((a.lifestyle.frequencyDaysPerWeek || 0) < 3) add(3, 'Exercise under 3 days a week', 'हफ़्ते में 3 दिन से कम व्यायाम');
  }

  // Diet
  if (a.diet) {
    let diet = 0;
    if (a.diet.lateNightEating) diet += 2;
    if (a.diet.addsSugarOrHoney) diet += 2;
    if (/daily|every|रोज़/i.test(`${a.diet.sweetsFrequency} ${a.diet.friedFoodFrequency}`)) diet += 2;
    add(diet, 'Diet habits (late meals, sugar, sweets/fried)', 'खान-पान (देर से खाना, चीनी, मिठाई/तला)');
    if (a.diet.alcoholTobaccoUse && !/^\s*(no|none|never|nahi|नहीं)\b/i.test(a.diet.alcoholTobaccoUse)) add(4, 'Alcohol / tobacco use', 'शराब / तंबाकू');
  }

  // Conditions that aren't under control
  const uncontrolled = (a.diagnosedConditions || []).filter((c) => c.currentStatus === 'uncontrolled' || c.currentStatus === 'worsening');
  if (uncontrolled.length) add(Math.min(9, uncontrolled.length * 3), `${uncontrolled.length} condition(s) not under control`, `${uncontrolled.length} बीमारी नियंत्रण में नहीं`);

  const score = Math.max(20, Math.min(100, 100 - factors.reduce((s, f) => s + f.points, 0)));
  const age = Number(a.age) || profile.age || 0;
  // Estimated from the same answers: every 4 points below optimal ≈ one
  // year older, above it ≈ younger; capped at ±10 years.
  const ageShift = Math.max(-10, Math.min(10, Math.round((OPTIMAL_SCORE - score) / 4)));
  return {
    score,
    fromOptimal: score - OPTIMAL_SCORE,
    factors: factors.sort((x, y) => y.points - x.points),
    actualAge: age || null,
    biologicalAge: age ? age + ageShift : null,
  };
}

/** A row that drifts sideways on its own and can also be swiped (touch) or
 *  dragged (mouse). Any touch, drag, wheel or hover pauses the drift; it
 *  resumes a moment after the user lets go. The content is rendered twice
 *  so the drift loops without a jump. */
function AutoScrollRow({ children, speed = 28 }: { children: React.ReactNode; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      const half = el.scrollWidth / 2;
      if (half > el.clientWidth && !hovering.current && !drag.current && t > pausedUntil.current) {
        pos.current += (speed * dt) / 1000;
        if (pos.current >= half) pos.current -= half;
        el.scrollLeft = pos.current;
      } else {
        // Follow wherever the user scrolled to, wrapping at either end.
        if (el.scrollLeft >= half) el.scrollLeft -= half;
        else if (el.scrollLeft <= 0 && half > 0) el.scrollLeft += half;
        pos.current = el.scrollLeft;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const pause = () => { pausedUntil.current = performance.now() + 2500; };

  return (
    <div
      ref={ref}
      className="no-scrollbar flex gap-2 overflow-x-auto select-none touch-pan-x cursor-grab active:cursor-grabbing"
      onTouchStart={pause}
      onTouchMove={pause}
      onWheel={pause}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') hovering.current = true; }}
      onPointerLeave={() => { hovering.current = false; drag.current = null; pause(); }}
      onPointerDown={(e) => {
        pause();
        if (e.pointerType === 'mouse' && ref.current) drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !ref.current) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 4) d.moved = true;
        ref.current.scrollLeft = d.left - dx;
      }}
      onPointerUp={() => { pause(); window.setTimeout(() => { drag.current = null; }, 0); }}
      onClickCapture={(e) => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}
    >
      {children}
      <div className="contents" aria-hidden="true">{children}</div>
    </div>
  );
}

interface HealthOverviewCardProps {
  profile: UserHealthProfile;
  tr: (en: string, hi: string) => string;
  onAsk: (prompt: string) => void;
  onOpenAssessment: () => void;
}

/** "Your Health Overview" — health score gauge, Ask UrCare prompts and
 *  estimated biological age, all from the Root Cause Analysis answers. */
export const HealthOverviewCard: React.FC<HealthOverviewCardProps> = ({ profile, tr, onAsk, onOpenAssessment }) => {
  const overview = useMemo(() => computeHealthOverview(profile), [profile]);
  const [showDetails, setShowDetails] = useState(false);

  const prompts: [string, string][] = [
    ['Summarize my health insights', 'मेरी हेल्थ इनसाइट्स का सारांश दें'],
    ['Explain my focus', 'मेरा फोकस समझाएं'],
    ['How can I raise my health score?', 'मेरा हेल्थ स्कोर कैसे बढ़ाऊं?'],
    ['What should I eat today?', 'आज मुझे क्या खाना चाहिए?'],
    ['How do I lower my sugar?', 'मेरी शुगर कैसे कम करूं?'],
  ];

  if (!overview) {
    return (
      <div className="health-overview rounded-2xl bg-white border border-zinc-200 shadow-depth p-4 sm:p-5">
        <h2 className="text-base font-black text-emerald-800">{tr('Your Health Overview', 'आपका हेल्थ ओवरव्यू')}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{tr('Key insights calculated from your assessment results.', 'आपके असेसमेंट रिज़ल्ट से निकाली गई मुख्य जानकारी।')}</p>
        <button type="button" onClick={onOpenAssessment} className="mt-4 w-full flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left cursor-pointer hover:bg-emerald-100 transition-colors">
          <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><ClipboardList className="w-5 h-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-zinc-900">{tr('Complete your Root Cause Analysis', 'अपना रूट कॉज़ एनालिसिस पूरा करें')}</span>
            <span className="block text-[11px] text-zinc-500 font-semibold">{tr('Your health score and biological age appear here', 'आपका हेल्थ स्कोर और बायोलॉजिकल उम्र यहां दिखेगी')}</span>
          </span>
        </button>
      </div>
    );
  }

  const { score, fromOptimal, factors, actualAge, biologicalAge } = overview;
  const ageDiff = actualAge && biologicalAge ? actualAge - biologicalAge : 0;

  return (
    <div className="health-overview rounded-2xl bg-white border border-zinc-200 shadow-depth p-4 sm:p-5">
      <h2 className="text-base font-black text-emerald-800">{tr('Your Health Overview', 'आपका हेल्थ ओवरव्यू')}</h2>
      <p className="text-xs text-zinc-500 mt-0.5">{tr('Key insights calculated from your assessment results.', 'आपके असेसमेंट रिज़ल्ट से निकाली गई मुख्य जानकारी।')}</p>

      {/* Health score */}
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-zinc-900">{tr('Health score', 'हेल्थ स्कोर')}</div>
          <span className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[11px] font-black ${fromOptimal < 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {fromOptimal < 0 ? tr(`${fromOptimal}pt from optimal`, `ऑप्टिमल से ${fromOptimal} अंक`) : tr('In the optimal range', 'ऑप्टिमल रेंज में')}
          </span>
        </div>
        <div className="font-display leading-none text-zinc-900">
          <span className="text-4xl font-bold">{score}</span>
          <span className="text-sm font-semibold text-zinc-400"> / 100</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1">
          <span>0</span>
          <span>{OPTIMAL_SCORE - 5}+</span>
        </div>
        <div className="health-gauge relative h-3 rounded-full">
          <motion.span
            className="absolute -top-1 -bottom-1 w-[3px] rounded-full bg-zinc-900 shadow"
            initial={{ left: '0%' }}
            animate={{ left: `calc(${score}% - 1.5px)` }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
        <div className="relative h-4 mt-1">
          <motion.span
            className="absolute -translate-x-1/2 text-[10px] font-black text-zinc-600"
            initial={{ left: '0%' }}
            animate={{ left: `${score}%` }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
          >
            {score}
          </motion.span>
        </div>
      </div>

      {/* Ask UrCare — prompts slide past; tapping one opens the AI chat with it */}
      <div className="mt-3">
        <div className="flex items-center gap-1.5 text-sm font-black text-zinc-900">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          {tr('Ask UrCare', 'UrCare से पूछें')}
        </div>
        <div className="mt-2 -mx-1 p-1">
        <AutoScrollRow>
          {prompts.map(([en, hi]) => (
            <button
              key={en}
              type="button"
              onClick={() => onAsk(tr(en, hi))}
              className="shrink-0 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-emerald-100 transition-colors"
            >
              {tr(en, hi)}
            </button>
          ))}
        </AutoScrollRow>
        </div>
      </div>

      {/* Biological age */}
      {actualAge && biologicalAge ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-black text-zinc-900">{tr('Biological age', 'बायोलॉजिकल उम्र')}</div>
            <span className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[11px] font-black ${ageDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {ageDiff > 0 ? tr(`${ageDiff} ${ageDiff === 1 ? 'yr' : 'yrs'} younger`, `${ageDiff} साल कम`) : ageDiff < 0 ? tr(`${-ageDiff} ${ageDiff === -1 ? 'yr' : 'yrs'} older`, `${-ageDiff} साल ज़्यादा`) : tr('Same as your age', 'आपकी उम्र जितनी')}
            </span>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-display text-xl font-bold ${ageDiff >= 0 ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300' : 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'}`}>{biologicalAge}</div>
              <div className="mt-1 text-[10px] font-bold text-zinc-500">{tr('Biological', 'बायोलॉजिकल')}</div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 flex items-center justify-center font-display text-xl font-bold text-zinc-400">{actualAge}</div>
              <div className="mt-1 text-[10px] font-bold text-zinc-500">{tr('Actual', 'असली')}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* View details — every point taken off the score */}
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="mt-4 w-full flex items-center justify-between pt-3 border-t border-zinc-100 text-xs font-black text-zinc-700 cursor-pointer"
      >
        {tr('View Details', 'विवरण देखें')}
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-1.5">
              {factors.length === 0 ? (
                <p className="text-xs font-semibold text-emerald-700">{tr('Nothing in your assessment lowered your score. Keep it up!', 'आपके असेसमेंट में स्कोर घटाने वाली कोई बात नहीं। ऐसे ही रखें!')}</p>
              ) : factors.map((f) => (
                <div key={f.label[0]} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-600 font-semibold">{tr(f.label[0], f.label[1])}</span>
                  <span className="shrink-0 font-black text-rose-600">−{f.points}</span>
                </div>
              ))}
              <p className="pt-2 text-[10px] text-zinc-400 leading-snug">
                {tr('Score and biological age are estimates from your Root Cause Analysis answers — not a medical test. Update your answers to refresh them.', 'स्कोर और बायोलॉजिकल उम्र आपके रूट कॉज़ एनालिसिस के जवाबों से अनुमान हैं — मेडिकल टेस्ट नहीं। जवाब अपडेट करने पर ये बदलेंगे।')}
              </p>
              <button type="button" onClick={onOpenAssessment} className="text-[11px] font-black text-emerald-700 hover:underline cursor-pointer">
                {tr('Update my assessment →', 'मेरा असेसमेंट अपडेट करें →')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

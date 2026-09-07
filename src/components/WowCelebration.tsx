import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, ArrowRight, ShieldCheck, Zap, Activity, CheckCircle2, 
  ChevronRight, Calendar, UserCheck
} from 'lucide-react';
import { UserHealthProfile } from '../types';
import { Logo } from './Logo';
import { RiskAssessmentCard } from './RiskAssessmentCard';
import { BodyPainMap } from './BodyPainMap';

interface WowCelebrationProps {
  profile: UserHealthProfile;
  onEnterDashboard: () => void;
}

export const WowCelebration: React.FC<WowCelebrationProps> = ({ profile, onEnterDashboard }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedCals, setAnimatedCals] = useState(0);

  const { calculatedPlan, currentWeightKg, targetWeightKg } = profile;

  useEffect(() => {
    // 1. Trigger celebratory confetti bursts in emerald and white
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      try {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#059669', '#10b981', '#34d399', '#ffffff'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#059669', '#10b981', '#34d399', '#ffffff'],
        });
      } catch (e) {}

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // 2. Count up numbers smoothly
    const targetScore = calculatedPlan?.healthScore || 94;
    const targetCals = calculatedPlan?.targetCalories || 1850;

    const scoreInterval = setInterval(() => {
      setAnimatedScore((prev) => {
        if (prev >= targetScore) {
          clearInterval(scoreInterval);
          return targetScore;
        }
        return prev + 2;
      });
    }, 25);

    const calsInterval = setInterval(() => {
      setAnimatedCals((prev) => {
        if (prev >= targetCals) {
          clearInterval(calsInterval);
          return targetCals;
        }
        return prev + Math.ceil(targetCals / 40);
      });
    }, 20);

    return () => {
      clearInterval(scoreInterval);
      clearInterval(calsInterval);
    };
  }, [calculatedPlan]);

  const cardClass = 'bg-white border border-zinc-200 shadow-xl';
  const subCardClass = 'bg-zinc-50 border border-zinc-200';

  return (
    <div id="wow-celebration-screen" className="relative min-h-screen bg-[#F8FAFC] text-zinc-900 flex flex-col items-center justify-center py-10 px-4 text-center overflow-x-hidden">
      {/* Static brand backdrop — soft emerald glow, no motion/particles */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-[26rem] h-[26rem] rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-[26rem] h-[26rem] rounded-full bg-teal-100/50 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-emerald-50/60 blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl mx-auto space-y-6 z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Brand Header */}
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        {/* Top Status badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black tracking-wider uppercase shadow-xs">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>YOUR CLINICAL METABOLIC BLUEPRINT IS READY</span>
        </div>

        {/* Main Headline */}
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
            Metabolic Assessment <span className="text-emerald-600">Formulated</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 max-w-md mx-auto">
            Evidence-based daily caloric limits, protein ratios, and metabolic risk projections.
          </p>
        </div>

        {/* Main Calorie & Health Card */}
        <div className={`p-6 sm:p-7 rounded-3xl ${cardClass} space-y-5 text-left`}>
          
          <div className="grid grid-cols-2 gap-3 text-center">
            {/* Calorie Box */}
            <div className={`p-4 rounded-2xl ${subCardClass}`}>
              <div className="text-[10px] font-bold uppercase text-emerald-700">Daily Calorie Target</div>
              <div className="text-3xl font-black text-emerald-600 mt-1">
                {animatedCals} <span className="text-xs font-bold text-zinc-500">kcal</span>
              </div>
            </div>

            {/* Health Score */}
            <div className={`p-4 rounded-2xl ${subCardClass}`}>
              <div className="text-[10px] font-bold uppercase text-emerald-700">Metabolic Readiness</div>
              <div className="text-3xl font-black text-zinc-900 mt-1">
                {animatedScore} <span className="text-xs font-bold text-zinc-500">/ 100</span>
              </div>
            </div>
          </div>

          {/* Macronutrients Breakdown */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider">
              Calibrated Macronutrient Allocation
            </span>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`p-3 rounded-xl ${subCardClass}`}>
                <span className="text-[10px] text-zinc-500 block font-bold">Protein</span>
                <span className="text-base font-black text-emerald-600">{calculatedPlan?.proteinGrams ?? 140}g</span>
              </div>

              <div className={`p-3 rounded-xl ${subCardClass}`}>
                <span className="text-[10px] text-zinc-500 block font-bold">Carbohydrates</span>
                <span className="text-base font-black text-emerald-600">{calculatedPlan?.carbsGrams ?? 180}g</span>
              </div>

              <div className={`p-3 rounded-xl ${subCardClass}`}>
                <span className="text-[10px] text-zinc-500 block font-bold">Healthy Fats</span>
                <span className="text-base font-black text-emerald-600">{calculatedPlan?.fatsGrams ?? 50}g</span>
              </div>
            </div>
          </div>

          {/* Key Milestones */}
          <div className={`p-3.5 rounded-2xl ${subCardClass} flex items-center justify-between text-xs`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-zinc-800">Target Weight Goal</span>
            </div>
            <span className="font-black text-emerald-600">{targetWeightKg} kg (from {currentWeightKg} kg)</span>
          </div>

        </div>

        {/* Personalized body map — built from the user's own onboarding answers */}
        <BodyPainMap profile={profile} />

        {/* High Urgency Clinical Risk & Health Warnings Section */}
        <RiskAssessmentCard profile={profile} onTakeAction={onEnterDashboard} />

        {/* Enter Dashboard Button */}
        <button
          id="enter-dashboard-btn"
          type="button"
          onClick={onEnterDashboard}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
        >
          <span>Access Daily Metabolic Tracker</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};

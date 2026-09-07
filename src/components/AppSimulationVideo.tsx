import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Flame, CheckCircle2, Activity,
  Sparkles, Play, Pause, ChevronRight, ChevronLeft,
  Stethoscope, ShieldCheck, Search, TrendingDown
} from 'lucide-react';
import { playClickSound } from '../utils/soundEffects';

interface AppSimulationVideoProps {
  onGetStarted?: () => void;
}

export const AppSimulationVideo: React.FC<AppSimulationVideoProps> = ({ onGetStarted }) => {
  const [currentScene, setCurrentScene] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [sceneProgress, setSceneProgress] = useState<number>(0);
  const [scanLaserPos, setScanLaserPos] = useState<number>(0);

  // The 4-step reversal journey — matches how UrCare actually works end to end.
  const scenes = [
    { id: 'rootcause', title: '1. Find Your Root Causes', duration: 3800 },
    { id: 'plan', title: '2. Follow The Treatment Plan', duration: 4000 },
    { id: 'progress', title: '3. Track Your Progress', duration: 3800 },
    { id: 'scan', title: '4. UrCare Food Scan', duration: 4000 },
  ];

  // Timer loop for simulation scenes
  useEffect(() => {
    if (!isPlaying) return;

    const intervalTime = 50; // 50ms ticks
    const duration = scenes[currentScene].duration;
    const stepIncrement = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setSceneProgress((prev) => {
        if (prev >= 100) {
          setCurrentScene((s) => (s + 1) % scenes.length);
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, currentScene]);

  // Laser scanning animation for the AI Food Scan scene
  useEffect(() => {
    if (currentScene === 3) {
      const laserTimer = setInterval(() => {
        setScanLaserPos((p) => (p >= 100 ? 0 : p + 5));
      }, 50);
      return () => clearInterval(laserTimer);
    }
  }, [currentScene]);

  const handleNextScene = () => {
    playClickSound(600);
    setSceneProgress(0);
    setCurrentScene((prev) => (prev + 1) % scenes.length);
  };

  const handlePrevScene = () => {
    playClickSound(600);
    setSceneProgress(0);
    setCurrentScene((prev) => (prev - 1 + scenes.length) % scenes.length);
  };

  const handleSelectScene = (idx: number) => {
    playClickSound(650);
    setCurrentScene(idx);
    setSceneProgress(0);
  };

  const togglePlay = () => {
    playClickSound(700);
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between text-zinc-900 select-none relative overflow-hidden bg-[#FAFAFC]">

      {/* 1. TOP VIDEO SIMULATION HEADER & STORY BARS */}
      <div className="pt-2 px-4 pb-1.5 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-100">

        {/* Story Progress Indicators */}
        <div className="flex items-center gap-1 mb-1.5">
          {scenes.map((scene, idx) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => handleSelectScene(idx)}
              className="flex-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden cursor-pointer relative"
              title={scene.title}
            >
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-75"
                style={{
                  width:
                    idx < currentScene
                      ? '100%'
                      : idx === currentScene
                      ? `${sceneProgress}%`
                      : '0%',
                }}
              />
            </button>
          ))}
        </div>

        {/* Video Mode Control Banner */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-wider uppercase text-emerald-800">
              UrCare • LIVE SIMULATION
            </span>
          </div>

          {/* Video Player Controls */}
          <div className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
            <button
              type="button"
              onClick={handlePrevScene}
              className="p-0.5 text-zinc-500 hover:text-zinc-900 cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="p-0.5 text-zinc-800 hover:text-emerald-600 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-zinc-800" /> : <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" />}
            </button>

            <button
              type="button"
              onClick={handleNextScene}
              className="p-0.5 text-zinc-500 hover:text-zinc-900 cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC SIMULATION SCENES DISPLAY */}
      <div className="flex-1 px-3.5 py-2 relative overflow-hidden flex flex-col justify-start">
        <AnimatePresence mode="wait">

          {/* ========================================================================= */}
          {/* SCENE 0: FIND YOUR ROOT CAUSES                                             */}
          {/* ========================================================================= */}
          {currentScene === 0 && (
            <motion.div
              key="scene-rootcause"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="space-y-2.5 h-full flex flex-col justify-between text-left"
            >
              <div className="p-3 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Step 1: Root-Cause Assessment
                  </span>
                  <Search className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xs font-black text-zinc-900">
                  Diabetes & Other Conditions — We Find the Real Cause
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Type 2 Diabetes', 'Thyroid', 'PCOS', 'Insulin Resistance'].map((tag) => (
                    <span key={tag} className="text-[9px] font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Root Causes Identified Output */}
              <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-zinc-900">Root Causes Identified</span>
                  <span className="text-[10px] font-black text-emerald-600">Diagnosed ✓</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Chronic insulin resistance from processed carbs</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Sub-optimal sleep disrupting hormone balance</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Key nutrient deficiencies (D3, Magnesium)</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 pt-1 border-t border-zinc-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Reviewed by a Doctor Before Your Plan Starts</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* SCENE 1: FOLLOW THE TREATMENT PLAN                                         */}
          {/* ========================================================================= */}
          {currentScene === 1 && (
            <motion.div
              key="scene-plan"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 h-full flex flex-col justify-between text-left"
            >
              {/* Doctor Review Card */}
              <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-black shrink-0">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-zinc-950 flex items-center gap-1">
                      <span>Dr. Alok Sharma, MD</span>
                      <ShieldCheck className="w-3 h-3 text-emerald-600 fill-emerald-100" />
                    </div>
                    <span className="text-[9px] text-zinc-500 font-medium">Chief Diabetologist • UrCare</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-zinc-50 text-[9px] text-zinc-700 border border-zinc-200/70 leading-relaxed font-medium">
                  "Your reversal treatment plan is ready — a low-carb, high-protein meal split plus daily movement targets built around your root causes."
                </div>
              </div>

              {/* Personalized Blueprint */}
              <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-zinc-900">Your Reversal Treatment Plan</span>
                  <span className="text-[10px] font-black text-emerald-600">Active</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-black">
                    <div>1,850</div>
                    <span className="text-[8px] font-semibold text-emerald-600">kcal/day</span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-rose-50 text-rose-800 font-black">
                    <div>140g</div>
                    <span className="text-[8px] font-semibold text-rose-600">Protein</span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-teal-50 text-teal-800 font-black">
                    <div>3.2 L</div>
                    <span className="text-[8px] font-semibold text-teal-600">Water</span>
                  </div>
                </div>
              </div>

              {/* Clinical Botanical Supplement */}
              <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-emerald-950">Botanical Protocol</span>
                  <span className="text-[9px] font-bold text-emerald-700">Before Lunch</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-800 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Karela Jamun & Berberine Extract (500mg)</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* SCENE 2: TRACK YOUR PROGRESS                                               */}
          {/* ========================================================================= */}
          {currentScene === 2 && (
            <motion.div
              key="scene-progress"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 h-full flex flex-col justify-between text-left"
            >
              <div className="p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-zinc-950">Glucose Reversal Curve</span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    98 mg/dL (In Target)
                  </span>
                </div>

                {/* Animated Waveform Graph */}
                <div className="h-18 w-full bg-emerald-500/5 rounded-xl p-2 relative flex items-end justify-between border border-emerald-100">
                  <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <rect x="0" y="10" width="100" height="20" fill="#10b981" opacity="0.1" />
                    <path
                      d="M0,25 Q15,20 30,28 T60,16 T85,22 T100,20"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="85" cy="22" r="3" fill="#059669" className="animate-ping" />
                    <circle cx="85" cy="22" r="2.5" fill="#ffffff" stroke="#059669" strokeWidth="1.5" />
                  </svg>
                  <div className="absolute top-1 left-2 text-[8px] font-bold text-zinc-400">Target: 70-140 mg/dL</div>
                  <div className="absolute bottom-1 right-2 text-[8px] font-bold text-emerald-600">Zero Glycemic Spikes</div>
                </div>
              </div>

              {/* HbA1c Reversal Status */}
              <div className="p-2.5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-700">HbA1c Clinical Reversal</span>
                  <span className="font-black text-emerald-600">7.2% → 5.6%</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden flex">
                  <div className="w-[75%] bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-600 rounded-full" />
                </div>
                <span className="text-[9px] text-zinc-500 font-medium block">
                  Normal Non-Diabetic Range achieved within protocol.
                </span>
              </div>

              {/* Weight Progress */}
              <div className="p-2.5 rounded-2xl bg-white border border-zinc-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="text-xs font-black text-zinc-900">76 kg → 70.8 kg</div>
                    <span className="text-[9px] text-zinc-400">-5.2 kg lost so far</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black">
                  <Flame className="w-3 h-3" />
                  <span>On Track</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* SCENE 3: AI FOOD SCAN                                                      */}
          {/* ========================================================================= */}
          {currentScene === 3 && (
            <motion.div
              key="scene-scan"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 h-full flex flex-col justify-between"
            >
              <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-zinc-900 shadow-md border border-zinc-800">
                <img
                  src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80"
                  alt="Healthy Food"
                  className="w-full h-full object-cover opacity-85"
                />

                {/* Viewfinder & Corners */}
                <div className="absolute inset-2 border-2 border-emerald-400/50 rounded-xl pointer-events-none" />
                <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-400" />

                {/* Laser scan line */}
                <div
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] pointer-events-none transition-all duration-75"
                  style={{ top: `${scanLaserPos}%` }}
                />

                {/* AI Detection Pill */}
                <div className="absolute top-6 left-6 p-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-emerald-400/80 text-white text-[10px] space-y-0.5">
                  <div className="flex items-center gap-1 font-black text-emerald-400">
                    <Sparkles className="w-3 h-3" />
                    <span>Grilled Paneer & Quinoa</span>
                  </div>
                  <div className="text-[9px] text-zinc-300">Confidence: 99.4% • Low GI</div>
                </div>

                <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/80 text-white text-[9px] font-bold">
                  <Camera className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>Live Scanning</span>
                </div>
              </div>

              {/* Instant Nutrition Breakdown */}
              <div className="p-2.5 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-950">Nutritional Recognition</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    380 kcal
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="p-1 rounded-lg bg-rose-50 font-bold text-rose-700">
                    <div>26g</div>
                    <span className="text-[8px] font-semibold text-rose-500">Protein</span>
                  </div>
                  <div className="p-1 rounded-lg bg-amber-50 font-bold text-amber-700">
                    <div>22g</div>
                    <span className="text-[8px] font-semibold text-amber-500">Carbs</span>
                  </div>
                  <div className="p-1 rounded-lg bg-teal-50 font-bold text-teal-700">
                    <div>12g</div>
                    <span className="text-[8px] font-semibold text-teal-500">Fats</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* 3. BOTTOM QUICK ACTION CONTROLS */}
      <div className="p-2.5 bg-white border-t border-zinc-100 flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
          {scenes.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectScene(idx)}
              className={`px-2 py-1 rounded-lg text-[9px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                currentScene === idx
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {idx + 1}. {s.id.toUpperCase()}
            </button>
          ))}
        </div>

        {onGetStarted && (
          <button
            type="button"
            onClick={onGetStarted}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs shrink-0 cursor-pointer transition-all active:scale-95"
          >
            <span>Start</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

    </div>
  );
};

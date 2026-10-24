import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Dumbbell, Play, Clock, CheckCircle2 } from 'lucide-react';
import { PlanSection } from './ReversalLibraryPanel';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { movesForExercise } from './ExerciseAnimationPlayer';
import { ShineBorder } from './magicui/shine-border';

interface TodaysExerciseCardProps {
  step: PlanSection;
  isDone: boolean;
  onMarkDone: () => void;
  tr: (en: string, hi: string) => string;
}

const ROTATE_MS = 6000;

/** "Today's Exercise" on Home — today's real exercise step from the plan,
 *  with its animated moves (LottieFiles) playing right on the card. When the
 *  step has several moves they take turns. Tap to open the full guide. */
export const TodaysExerciseCard: React.FC<TodaysExerciseCardProps> = ({ step, isDone, onMarkDone, tr }) => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const moves = useMemo(() => movesForExercise(step.title, step.body || ''), [step.title, step.body]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (moves.length < 2) return;
    const id = setInterval(() => setIndex((n) => (n + 1) % moves.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [moves]);
  const move = moves[index % moves.length];

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17, ease: 'easeOut' }} className="space-y-3 urcare-exercise-block">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <Dumbbell className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold font-display text-foreground">{tr("Today's Exercise", 'आज का व्यायाम')}</h2>
          </div>
          {step.timeLabel && (
            <span className="flex items-center gap-1 text-[10px] font-black text-zinc-400">
              <Clock className="w-3 h-3" />
              {step.timeLabel}
            </span>
          )}
        </div>

        <motion.div whileHover={{ y: -2 }} className="relative rounded-2xl bg-card border border-border shadow-depth overflow-hidden">
          <ShineBorder borderWidth={2} duration={12} shineColor={['#fb923c', '#fde68a', '#34d399']} className="z-[3]" />
          <button
            type="button"
            onClick={() => setIsPlayerOpen(true)}
            className="exercise-visual group relative block w-full overflow-hidden cursor-pointer"
            aria-label={tr('Open exercise guide', 'व्यायाम गाइड खोलें')}
          >
            <span className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 30% 30%, #ffedd5 0%, #fff7ed 50%, #ecfdf5 100%)' }} />
            <AnimatePresence mode="wait">
              {move && (
                <motion.div key={move.file} className="absolute inset-0" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                  <DotLottieReact src={`/lottie/exercise/${move.file}.lottie`} autoplay loop style={{ width: '100%', height: '100%' }} />
                </motion.div>
              )}
            </AnimatePresence>
            {move && (
              <span className="absolute left-3 bottom-3 max-w-[70%] truncate px-2.5 py-1 rounded-full bg-white/90 border border-orange-200 text-[11px] font-black text-orange-700 shadow-sm">
                {tr(...move.name)}{moves.length > 1 ? ` · ${index % moves.length + 1}/${moves.length}` : ''}
              </span>
            )}
            <span className="absolute right-3 top-3 w-10 h-10 rounded-full bg-white/90 text-orange-600 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
              <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
            </span>
          </button>

          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {isDone ? tr('Completed', 'पूर्ण') : tr('Scheduled', 'निर्धारित')}
              </span>
              {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>

            <h3 className="text-lg font-bold font-display text-foreground leading-snug">{step.title}</h3>

            {step.body && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{step.body}</p>
            )}

            <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? 'bg-emerald-500' : 'bg-orange-500 animate-pulse'}`} />
                <span className="text-[11px] text-zinc-500 font-semibold truncate">
                  {isDone ? tr('Logged for today', 'आज के लिए लॉग किया गया') : tr('Not started yet', 'अभी शुरू नहीं हुआ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPlayerOpen(true)}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 active:scale-95 text-white text-xs font-black shadow-md shadow-orange-600/25 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" fill="white" />
                {tr('Begin', 'शुरू करें')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <ExerciseVideoModal
        title={step.title}
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        tr={tr}
        isDone={isDone}
        onMarkDone={onMarkDone}
      />
    </>
  );
};

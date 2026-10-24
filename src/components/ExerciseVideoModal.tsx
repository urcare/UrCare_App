import React, { useMemo } from 'react';
import { ExerciseAnimationPlayer, movesForExercise } from './ExerciseAnimationPlayer';
import { motion, AnimatePresence } from 'motion/react';
import { Dumbbell, X, CheckCircle2 } from 'lucide-react';

interface ExerciseVideoModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  tr: (en: string, hi: string) => string;
  /** Optional "Mark as Done" action — only shown when both are given, so
   *  this same modal works for a plain Watch Video click (Daily Plan rows)
   *  as well as a featured card that also wants to close the loop right
   *  from the player (Today's Exercise on Home). */
  isDone?: boolean;
  onMarkDone?: () => void;
}

/** The shared exercise guide: animated how-to moves (LottieFiles) with
 *  steps and a rep counter, plus an optional "Mark as Done". */
export const ExerciseVideoModal: React.FC<ExerciseVideoModalProps> = ({ title, isOpen, onClose, tr, isDone, onMarkDone }) => {
  // Animated how-to (LottieFiles), no YouTube.
  const moves = useMemo(() => movesForExercise(title), [title]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-zinc-100 max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <h4 className="font-black text-sm text-zinc-900 truncate">{title}</h4>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto">
              <ExerciseAnimationPlayer moves={moves} tr={tr} />
            </div>

            <div className="p-4 flex flex-col gap-2.5 bg-zinc-50 overflow-y-auto">
              {onMarkDone && (
                <button
                  type="button"
                  onClick={() => { onMarkDone(); onClose(); }}
                  disabled={isDone}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isDone ? tr('Already logged', 'पहले से लॉग किया गया') : tr('Mark as Done', 'पूर्ण के रूप में चिह्नित करें')}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

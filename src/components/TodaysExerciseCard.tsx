import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, Play, Clock, CheckCircle2 } from 'lucide-react';
import { PlanSection } from './ReversalLibraryPanel';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import exerciseImage from '../assets/urcare-exercise.jpg';

interface TodaysExerciseCardProps {
  step: PlanSection;
  isDone: boolean;
  onMarkDone: () => void;
  tr: (en: string, hi: string) => string;
}

/** A featured "Today's Exercise" card for Home — pulled straight from
 *  today's real Daily Plan (never invented content), styled as a video-led
 *  hero moment instead of a plain checklist row. Tapping the thumbnail or
 *  "Begin" opens an in-app player modal; since we have no YouTube Data API
 *  key to resolve one verified video id per (open-ended) exercise title, the
 *  modal embeds a live YouTube search instead of a single hardcoded id, and
 *  always shows a plain "Open in YouTube" link too so there's never a dead
 *  end if the embed doesn't play in a given browser. */
export const TodaysExerciseCard: React.FC<TodaysExerciseCardProps> = ({ step, isDone, onMarkDone, tr }) => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

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

        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl bg-card border border-border shadow-depth overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setIsPlayerOpen(true)}
            className="exercise-visual group relative block w-full overflow-hidden cursor-pointer"
            aria-label={tr('Play exercise guide', 'व्यायाम गाइड चलाएं')}
          >
            <img
              src={exerciseImage}
              alt=""
              width={1024}
              height={768}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <span className="exercise-visual-shade" />
            <span className="exercise-duration"><Clock className="w-3.5 h-3.5" />{step.timeLabel || tr('Guided session', 'निर्देशित सत्र')}</span>
            <span className="exercise-play"><Play className="w-5 h-5" fill="currentColor" /></span>
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
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 active:scale-95 text-white text-xs font-black shadow-md shadow-orange-600/25 transition-all cursor-pointer"
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

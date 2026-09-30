import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dumbbell, Play, X, Youtube, Clock, CheckCircle2, ExternalLink } from 'lucide-react';
import { PlanSection } from './ReversalLibraryPanel';
import { youtubeSearchUrl, youtubeSearchEmbedUrl } from './RecommendationsView';
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

      <AnimatePresence>
        {isPlayerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setIsPlayerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-zinc-100 max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <Youtube className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-sm text-zinc-900 truncate">{step.title}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlayerOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative w-full aspect-video bg-black shrink-0">
                <iframe
                  className="w-full h-full"
                  src={youtubeSearchEmbedUrl(step.title)}
                  title={step.title}
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className="p-4 flex flex-col gap-2.5 bg-zinc-50 overflow-y-auto">
                {/* Always visible, not just a failure fallback — the embed
                    above is a best-effort search-driven player, and this is
                    the one link guaranteed to always find the right video. */}
                <a
                  href={youtubeSearchUrl(step.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-bold hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {tr('Open in YouTube', 'YouTube में खोलें')}
                </a>
                <button
                  type="button"
                  onClick={() => { onMarkDone(); setIsPlayerOpen(false); }}
                  disabled={isDone}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isDone ? tr('Already logged', 'पहले से लॉग किया गया') : tr('Mark as Done', 'पूर्ण के रूप में चिह्नित करें')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

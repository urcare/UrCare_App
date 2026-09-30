import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, X, ExternalLink, CheckCircle2 } from 'lucide-react';
import { youtubeSearchUrl, youtubeSearchEmbedUrl } from '../utils/youtube';

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

/** The shared "watch this exercise" player — a live YouTube search embed
 *  (we have no YouTube Data API key to resolve one verified video id per
 *  open-ended exercise title, so a single hardcoded id would show the
 *  wrong video for most exercises) plus a plain "Open in YouTube" link
 *  that's always visible, not just a failure fallback, so there's never a
 *  dead end if the embed doesn't play in a given browser/webview. Used by
 *  every "Watch Exercise Video" entry point in the app (Daily Plan rows,
 *  the plan's hero card, and Home's Today's Exercise), so opening a video
 *  looks and behaves the same everywhere. */
export const ExerciseVideoModal: React.FC<ExerciseVideoModalProps> = ({ title, isOpen, onClose, tr, isDone, onMarkDone }) => (
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
              <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Youtube className="w-4 h-4" />
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

          <div className="relative w-full aspect-video bg-black shrink-0">
            <iframe
              key={title}
              className="w-full h-full"
              src={youtubeSearchEmbedUrl(title)}
              title={title}
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          <div className="p-4 flex flex-col gap-2.5 bg-zinc-50 overflow-y-auto">
            <a
              href={youtubeSearchUrl(title)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-bold hover:border-red-300 hover:text-red-600 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {tr('Open in YouTube', 'YouTube में खोलें')}
            </a>
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

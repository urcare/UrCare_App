import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, X, ExternalLink, CheckCircle2, RefreshCw, Play } from 'lucide-react';
import { youtubeSearchUrl, youtubeEmbedUrl, resolveYoutubeVideoId } from '../utils/youtube';

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

/** The shared "watch this exercise" player. Resolves one real, specific
 *  YouTube video id for the title via the server (real YouTube Data API,
 *  see /api/youtube-search) and embeds exactly that video — a plain "Open
 *  in YouTube" link is always shown too, never just a failure fallback.
 *  Without a YOUTUBE_API_KEY configured server-side, no id resolves and
 *  this shows a clean "watch on YouTube" card instead of a broken embed
 *  (an earlier version embedded a live YouTube *search*, which YouTube has
 *  since stopped supporting — it only ever showed "This video is
 *  unavailable"). Used by every "Watch Exercise Video" entry point in the
 *  app, so opening a video looks and behaves the same everywhere. */
export const ExerciseVideoModal: React.FC<ExerciseVideoModalProps> = ({ title, isOpen, onClose, tr, isDone, onMarkDone }) => {
  const [videoId, setVideoId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isOpen || !title) return;
    setVideoId(undefined);
    let cancelled = false;
    resolveYoutubeVideoId(title).then((id) => { if (!cancelled) setVideoId(id); });
    return () => { cancelled = true; };
  }, [isOpen, title]);

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
              {videoId === undefined ? (
                <div className="absolute inset-0 flex items-center justify-center text-white/60">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : videoId ? (
                <iframe
                  key={videoId}
                  className="w-full h-full"
                  src={youtubeEmbedUrl(videoId)}
                  title={title}
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <a
                  href={youtubeSearchUrl(title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white hover:bg-white/5 transition-colors"
                >
                  <span className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                    <Play className="w-6 h-6 ml-0.5" fill="white" />
                  </span>
                  <span className="text-xs font-bold text-white/80">{tr('Tap to watch on YouTube', 'YouTube पर देखने के लिए टैप करें')}</span>
                </a>
              )}
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
};

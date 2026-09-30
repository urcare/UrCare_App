import React, { useEffect, useRef, useState } from 'react';
import { X, Stethoscope } from 'lucide-react';
import { CareTeamStatus } from '../types';

const SLIDE_MS = 5000;

function timeAgo(iso: string, tr: (en: string, hi: string) => string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return tr('just now', 'अभी');
  if (mins < 60) return tr(`${mins}m ago`, `${mins} मिनट पहले`);
  const hrs = Math.floor(mins / 60);
  return tr(`${hrs}h ago`, `${hrs} घंटे पहले`);
}

interface StatusViewerProps {
  statuses: CareTeamStatus[];
  startIndex?: number;
  onClose: () => void;
  tr: (en: string, hi: string) => string;
}

/** A full-screen, WhatsApp-Status-style viewer — segmented auto-advancing
 *  progress bars, tap left/right to go back/forward, image + optional
 *  caption. Read-only (statuses are admin-posted only, see StatusRing). */
export const StatusViewer: React.FC<StatusViewerProps> = ({ statuses, startIndex = 0, onClose, tr }) => {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const current = statuses[index];

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused || !current) return;
    startRef.current = performance.now() - elapsedRef.current;
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(100, (elapsed / SLIDE_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        if (index < statuses.length - 1) setIndex((i) => i + 1);
        else onClose();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately re-runs on index/paused only
  }, [index, paused, statuses.length]);

  if (!current) return null;

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => { if (index < statuses.length - 1) setIndex((i) => i + 1); else onClose(); };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col select-none">
      {/* Progress bars */}
      <div className="flex gap-1 px-2.5 pt-2.5 shrink-0">
        {statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: `${i < index ? 100 : i === index ? progress : 0}%`, transition: i === index ? 'none' : undefined }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
          <Stethoscope className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white text-[13px] font-bold truncate">{current.createdBy || tr('UrCare Health Team', 'UrCare हेल्थ टीम')}</div>
          <div className="text-white/60 text-[11px]">{timeAgo(current.createdAt, tr)}</div>
        </div>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white cursor-pointer shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image + tap zones */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <img src={current.imageUrl} alt="" className="max-w-full max-h-full object-contain" />
        <button
          type="button"
          aria-label={tr('Previous', 'पिछला')}
          onClick={goPrev}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer"
        />
        <button
          type="button"
          aria-label={tr('Next', 'अगला')}
          onClick={goNext}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer"
        />
      </div>

      {current.caption && (
        <div className="px-4 py-3.5 shrink-0 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-sm font-medium text-center leading-relaxed">{current.caption}</p>
        </div>
      )}
    </div>
  );
};

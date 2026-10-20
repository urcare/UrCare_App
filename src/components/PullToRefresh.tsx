import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

/** Asks every screen to reload its data now (plan, progress, family status,
 *  timeline, notifications, rewards). */
export function refreshEverything(stagger = 0) {
  const names = ['urcare:refresh', 'urcare:daily-plan-changed', 'urcare:daily-log-changed', 'urcare:family-status-changed', 'urcare:activity-logged'];
  if (!stagger) { names.forEach((n) => window.dispatchEvent(new Event(n))); return; }
  // Spread the reloads out so the spinner keeps turning smoothly.
  names.forEach((n, i) => window.setTimeout(() => window.dispatchEvent(new Event(n)), i * stagger));
}

/** Waits until the browser has painted the spinner (two frames) plus a beat. */
const afterPaint = (extra = 120) => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, extra))));

const TRIGGER = 72; // px of pull needed to refresh
const MAX = 120;

/** Pull down from the top of the page to refresh — a spinning UrCare ring
 *  follows your finger, spins while everything reloads, then tucks away. */
export const PullToRefresh: React.FC<{ onRefresh?: () => Promise<unknown> | void; children: React.ReactNode }> = ({ onRefresh, children }) => {
  const pull = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ y: number; x: number; active: boolean } | null>(null);
  const busy = useRef(false);

  const opacity = useTransform(pull, [0, 24, TRIGGER], [0, 0.6, 1]);
  const scale = useTransform(pull, [0, TRIGGER], [0.5, 1]);
  const rotate = useTransform(pull, [0, MAX], [0, 300]);
  const progress = useTransform(pull, [0, TRIGGER], [0, 1]);
  const dash = useTransform(progress, (p) => 2 * Math.PI * 14 * (1 - Math.min(1, p) * 0.8));

  useEffect(() => {
    const atTop = () => (window.scrollY || document.documentElement.scrollTop) <= 0;
    // Don't hijack pulls inside sheets/modals or horizontally scrolling rows.
    const insideOverlay = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.('.fixed, [role="dialog"], .no-scrollbar');
    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1 || !atTop() || insideOverlay(e.target)) { start.current = null; return; }
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, active: false };
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s || busy.current) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = Math.abs(e.touches[0].clientX - s.x);
      if (!s.active) {
        if (dy > 8 && dy > dx && atTop()) s.active = true;
        else if (dy < 0 || dx > 12) { start.current = null; return; }
        else return;
      }
      // Rubber-band: the further you pull, the slower it follows.
      const eased = Math.min(MAX, dy * 0.5);
      pull.set(Math.max(0, eased));
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = async () => {
      const s = start.current;
      start.current = null;
      if (!s?.active) return;
      if (pull.get() >= TRIGGER) {
        busy.current = true;
        // Snap to the resting spot (CSS eases it) and spin on the GPU, so a
        // busy JavaScript thread can't make the spinner stutter.
        pull.set(TRIGGER);
        setRefreshing(true);
        try { navigator.vibrate?.(12); } catch {}
        const minSpin = new Promise((r) => setTimeout(r, 1100));
        await afterPaint();
        refreshEverything(90);
        try { await Promise.all([onRefresh?.(), minSpin]); } catch {}
        setRefreshing(false);
        busy.current = false;
      }
      animate(pull, 0, { type: 'spring', stiffness: 220, damping: 26 });
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh, pull]);

  return (
    <>
      {/* Rests just below the app header while spinning. */}
      <motion.div aria-hidden={!refreshing} className={`ptr-indicator ${refreshing ? 'is-refreshing' : ''}`} style={{ y: useTransform(pull, (v) => v * 1.8 - 56), opacity, scale }}>
        {refreshing ? (
          // CSS-only spinner: runs on the compositor, smooth even while data loads.
          <span className="ptr-ring ptr-spin">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#d1fae5" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="url(#ptrGrad)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 14 * 0.3} ${2 * Math.PI * 14}`} />
              <defs><linearGradient id="ptrGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#0ea5e9" /></linearGradient></defs>
            </svg>
          </span>
        ) : (
          <motion.span className="ptr-ring" style={{ rotate }}>
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#d1fae5" strokeWidth="3.5" />
              <motion.circle cx="18" cy="18" r="14" fill="none" stroke="url(#ptrGrad2)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 14} style={{ strokeDashoffset: dash }} />
              <defs><linearGradient id="ptrGrad2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#0ea5e9" /></linearGradient></defs>
            </svg>
          </motion.span>
        )}
        <img src="/urcare-logo-mark.png" alt="" className="ptr-logo" />
      </motion.div>
      {/* The page itself isn't moved: a transform here would break every
          position:fixed sheet rendered inside it. */}
      {children}
    </>
  );
};

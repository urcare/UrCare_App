import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const SEEN_KEY = 'urcare_splash_seen';
const WORD = 'UrCare';
// Total length of the intro before it starts zooming into the app (ms).
const EXIT_AT = 2250;
// Zoom + fade length; the overlay is removed after this.
const EXIT_MS = 700;

/** Shown once each time the app is opened: the logo pops in at the centre,
 *  slides left as "UrCare" slides in letter by letter, then bounces and
 *  zooms forward into the app. Tap to skip.
 *
 *  Every movement is a CSS animation of transform/opacity only, so the phone
 *  runs it on the GPU and it stays smooth even while the app loads
 *  underneath (JavaScript-driven animation stutters at that moment). */
export const SplashIntro: React.FC = () => {
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(SEEN_KEY); } catch { return true; }
  });
  const [exiting, setExiting] = useState(false);
  const wordRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // The logo starts in the middle of the screen: shift it right by half the
  // word's width (measured before the first paint, so nothing jumps).
  useLayoutEffect(() => {
    if (!visible || !wordRef.current || !rootRef.current) return;
    const w = wordRef.current.getBoundingClientRect().width;
    // half the word plus its left margin
    rootRef.current.style.setProperty('--splash-shift', `${Math.round(w / 2 + 4)}px`);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch {}
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setExiting(true), reduced ? 700 : EXIT_AT);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(() => setVisible(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [exiting]);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      className={`splash-intro fixed inset-0 z-[200] flex items-center justify-center overflow-hidden cursor-pointer ${exiting ? 'is-exiting' : ''}`}
      onClick={() => setExiting(true)}
      aria-label="UrCare"
      role="img"
    >
      <span className="splash-ring" style={{ animationDelay: '0.2s' }} />
      <span className="splash-ring" style={{ animationDelay: '0.9s' }} />
      <span className="splash-ring" style={{ animationDelay: '1.6s' }} />

      <div className="splash-group">
        {/* The whole row slides, so the letters come out right beside the logo. */}
        <div className="splash-row">
          <img src="/urcare-logo-mark.png" alt="" draggable={false} className="splash-logo w-24 h-24 sm:w-28 sm:h-28 object-contain" />
          <div className="ml-1 sm:ml-2 flex flex-col">
            <span ref={wordRef} className="splash-word font-display text-5xl sm:text-6xl font-bold tracking-tight leading-none" aria-hidden="true">
              {WORD.split('').map((ch, i) => (
                <span key={i} className="splash-letter" style={{ animationDelay: `${0.95 + i * 0.055}s` }}>{ch}</span>
              ))}
            </span>
            <span className="splash-tagline mt-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.28em]">True Healthcare Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
};

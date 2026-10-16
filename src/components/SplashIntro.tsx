import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TextAnimate } from './magicui/text-animate';

type Phase = 'logo' | 'reveal' | 'exit' | 'done';

const SEEN_KEY = 'urcare_splash_seen';

/** Shown once each time the app is opened: the UrCare logo pops in, slides
 *  aside as the "UrCare" wordmark slides in letter by letter (Magic UI Text
 *  Animate), then everything bounces and zooms forward into the app. Tap to
 *  skip. It sits on top of the app, which keeps loading underneath. */
export const SplashIntro: React.FC = () => {
  const [phase, setPhase] = useState<Phase>(() => {
    try { return sessionStorage.getItem(SEEN_KEY) ? 'done' : 'logo'; } catch { return 'logo'; }
  });

  useEffect(() => {
    if (phase === 'done') return;
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch {}
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = reduced
      ? [window.setTimeout(() => setPhase('exit'), 900)]
      : [
          window.setTimeout(() => setPhase('reveal'), 900),
          window.setTimeout(() => setPhase('exit'), 2300),
        ];
    return () => t.forEach(clearTimeout);
    // Runs once on mount; later phase changes come from the timers above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;
  const showWord = phase === 'reveal' || phase === 'exit';

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        className="splash-intro fixed inset-0 z-[200] flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={() => setPhase('exit')}
        animate={phase === 'exit' ? { opacity: 0 } : { opacity: 1 }}
        transition={phase === 'exit' ? { duration: 0.35, delay: 0.45, ease: 'easeIn' } : { duration: 0.2 }}
        onAnimationComplete={() => { if (phase === 'exit') setPhase('done'); }}
        aria-label="UrCare"
        role="img"
      >
        {/* soft ripples behind the logo */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="splash-ring"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 2.6], opacity: [0, 0.35, 0] }}
            transition={{ duration: 2.4, delay: 0.25 + i * 0.5, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}

        <motion.div
          className="relative flex items-center"
          animate={phase === 'exit'
            ? { scale: [1, 0.9, 1.08, 9], opacity: [1, 1, 1, 0] }
            : { scale: 1, opacity: 1 }}
          transition={phase === 'exit'
            ? { duration: 0.8, times: [0, 0.22, 0.45, 1], ease: 'easeInOut' }
            : { duration: 0.3 }}
        >
          <motion.img
            layout
            src="/urcare-logo-mark.png"
            alt=""
            draggable={false}
            className="splash-logo w-24 h-24 sm:w-28 sm:h-28 object-contain"
            initial={{ scale: 0, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, mass: 0.9, layout: { type: 'spring', stiffness: 170, damping: 20 } }}
          />
          {showWord && (
            <motion.div
              layout
              className="ml-1 sm:ml-2 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <TextAnimate
                as="span"
                by="character"
                animation="slideLeft"
                duration={0.55}
                startOnView={false}
                className="splash-word font-display text-5xl sm:text-6xl font-bold tracking-tight leading-none"
              >
                UrCare
              </TextAnimate>
              <motion.span
                className="mt-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.28em] text-emerald-700/70"
                initial={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, delay: 0.55 }}
              >
                True Healthcare Platform
              </motion.span>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

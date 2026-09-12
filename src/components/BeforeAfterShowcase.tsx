import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/** Auto-cycling BEFORE/AFTER showcase on the auth screen — replaces the old
 *  fake in-app "live simulation" phone mockup with the real transformation
 *  graphics (public/before.png, public/after.png). Each image already
 *  carries its own full design (headline, health markers, mood), so this
 *  stays deliberately minimal — a slow crossfade with a gentle Ken Burns
 *  drift and small tappable progress dots — rather than layering more text
 *  on top of artwork that's already saying it. */
const SLIDES = [
  { src: '/before.png', alt: 'Before UrCare — low energy, concerning health markers' },
  { src: '/after.png', alt: 'After UrCare — energetic, healthy markers in normal range' },
];

const INTERVAL_MS = 4200;

export const BeforeAfterShowcase: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-zinc-100">
      <AnimatePresence initial={false}>
        <motion.img
          key={SLIDES[index].src}
          src={SLIDES[index].src}
          alt={SLIDES[index].alt}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.9, ease: 'easeInOut' }, scale: { duration: INTERVAL_MS / 1000, ease: 'linear' } }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>

      {/* Progress dots — also tappable to jump straight to a slide */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={i === 0 ? 'Show before image' : 'Show after image'}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === index ? 'w-6 bg-white shadow-sm' : 'w-1.5 bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

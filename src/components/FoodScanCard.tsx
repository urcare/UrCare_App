import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { ShineBorder } from './magicui/shine-border';
import mealImage from '../assets/urcare-meal.jpg';

// Free-license Pexels photos (public/food-scan), with a scan animation.
const FOOD_SCAN_PHOTOS = Array.from({ length: 14 }, (_, i) => `/food-scan/scan-${i + 1}.jpg`);
const FOOD_SCAN_SLIDE_MS = 5000;

function FoodScanSlideshow({ tr }: { tr: (en: string, hi: string) => string }) {
  // Start on a different photo each visit.
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * FOOD_SCAN_PHOTOS.length));
  useEffect(() => {
    const id = setInterval(() => setSlide((n) => (n + 1) % FOOD_SCAN_PHOTOS.length), FOOD_SCAN_SLIDE_MS);
    return () => clearInterval(id);
  }, []);
  const count = FOOD_SCAN_PHOTOS.length;
  const prev = (slide - 1 + count) % count;
  const next = (slide + 1) % count;
  return (
    <>
      {FOOD_SCAN_PHOTOS.map((src, i) => (
        // Only the previous (fading out), current and next (preloading)
        // photos are mounted, so the rest load only when their turn comes.
        (i === prev || i === slide || i === next) && (
          <img
            key={src}
            src={src}
            alt=""
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = mealImage; }}
            className={`food-scan-photo absolute inset-0 h-full w-full object-cover ${i === slide ? 'is-active' : ''}`}
          />
        )
      ))}
      <span className="food-scan-frame" aria-hidden="true">
        <span /><span /><span /><span />
      </span>
      <span key={slide} className="food-scan-line" aria-hidden="true" />
      <span key={`chip-${slide}`} className="food-scan-chip">
        <span className="food-scan-chip-scanning">{tr('Scanning…', 'स्कैन हो रहा है…')}</span>
        <span className="food-scan-chip-done">✓ {tr('Analysed', 'विश्लेषण पूरा')}</span>
      </span>
    </>
  );
}

/** "Know what is on your plate" — the animated Food Scan card (Camera tab). */
export const FoodScanCard: React.FC<{ tr: (en: string, hi: string) => string; onOpen: () => void }> = ({ tr, onOpen }) => (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.18, ease: 'easeOut' }}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }}
      className="food-scan-card group block w-full relative overflow-hidden rounded-2xl bg-card border border-border shadow-depth text-left cursor-pointer"
    >
      <FoodScanSlideshow tr={tr} />
      <span className="food-visual-shade" />
      <ShineBorder borderWidth={2} duration={10} shineColor={['#34d399', '#fde68a', '#4ade80']} className="z-[3]" />
      <span className="absolute left-5 right-5 bottom-5 text-primary-foreground">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"><Sparkles className="w-3.5 h-3.5" />{tr('UrCare Food Scan', 'UrCare फूड स्कैन')}</span>
        <span className="mt-1 block font-display text-xl font-bold">{tr('Know what is on your plate', 'जानें आपकी प्लेट में क्या है')}</span>
        <span className="mt-1 block text-xs text-primary-foreground/80">{tr('Snap a meal for personalised guidance', 'व्यक्तिगत मार्गदर्शन के लिए भोजन स्कैन करें')}</span>
      </span>
    </motion.button>
);

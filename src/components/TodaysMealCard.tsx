import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { UtensilsCrossed, Clock, CheckCircle2, ScanLine, ChevronRight } from 'lucide-react';
import { PlanSection } from './ReversalLibraryPanel';
import { ShineBorder } from './magicui/shine-border';

// Food animations from LottieFiles (Lottie Simple License — free for
// commercial use), stored in public/lottie/food.
type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Someone eating — the big animation on the left. */
const EATERS: Record<MealKind, string[]> = {
  breakfast: ['woman-eating', 'woman-carrot'],
  lunch: ['man-eating', 'couple-eating', 'woman-eating'],
  dinner: ['family-dinner', 'friends-eating', 'couple-eating'],
  snack: ['woman-carrot', 'woman-eating'],
};
/** What's on the plate — rotates in the bubble on the right. */
const FOODS: Record<MealKind, string[]> = {
  breakfast: ['breakfast-plate', 'breakfast-tray', 'tea', 'fruit-water', 'healthy-food', 'avocado'],
  lunch: ['veg-plate', 'salad-bowl', 'salad', 'carrot-plate', 'broccoli', 'cooking-woman', 'cooking-pot'],
  dinner: ['veg-plate', 'salad', 'broccoli-buddy', 'cooking-chef', 'cooking-pot', 'tomato'],
  snack: ['fruit-basket', 'watermelon', 'avocado', 'salad-buddy', 'tomato', 'fruit-water'],
};
/** Healthy meal photos (Pexels, free license) in public/meal-photos. */
const PHOTOS: Record<MealKind, string[]> = {
  breakfast: ['/meal-photos/breakfast-11229122.jpg', '/meal-photos/breakfast-25402351.jpg', '/meal-photos/breakfast-30529077.jpg', '/meal-photos/breakfast-39865391.jpg', '/meal-photos/breakfast-4071738.jpg', '/meal-photos/breakfast-566564.jpg', '/meal-photos/breakfast-7413498.jpg', '/meal-photos/breakfast-8108219.jpg'],
  lunch: ['/meal-photos/main-17200447.jpg', '/meal-photos/main-28241682.jpg', '/meal-photos/main-29066704.jpg', '/meal-photos/main-33379362.jpg', '/meal-photos/main-35008222.jpg', '/meal-photos/main-36478888.jpg', '/meal-photos/main-7166541.jpg', '/meal-photos/main-9345638.jpg', '/meal-photos/main-9345658.jpg'],
  dinner: ['/meal-photos/main-17200447.jpg', '/meal-photos/main-28241682.jpg', '/meal-photos/main-29066704.jpg', '/meal-photos/main-33379362.jpg', '/meal-photos/main-35008222.jpg', '/meal-photos/main-36478888.jpg', '/meal-photos/main-7166541.jpg', '/meal-photos/main-9345638.jpg', '/meal-photos/main-9345658.jpg'],
  snack: ['/meal-photos/snack-10665501.jpg', '/meal-photos/snack-13803823.jpg', '/meal-photos/snack-28467237.jpg', '/meal-photos/snack-29843060.jpg', '/meal-photos/snack-7660442.jpg'],
};
const ROTATE_MS = 4500;

/** A plan step that is an actual meal (not "Post-Lunch Rest", "Pre-Breakfast Herbal"…). */
export function isMealStep(title: string): boolean {
  const t = title.toLowerCase();
  return /breakfast|lunch|dinner|snack|meal/.test(t) && !/post|pre-|pre |before|after|rest|walk|herbal|supplement|medicine|water|hydration|digest|ritual/.test(t);
}

export function mealKindFor(title: string): MealKind {
  const t = title.toLowerCase();
  if (/breakfast|morning|नाश्ता/.test(t)) return 'breakfast';
  if (/dinner|night|रात/.test(t)) return 'dinner';
  if (/snack|evening|fruit/.test(t)) return 'snack';
  return 'lunch';
}

/** The first few foods named in the plan step, shown as chips. */
function foodsFrom(body = ''): string[] {
  // Plan meals are written as numbered options: "1. Moong Dal Chilla — 2 chillas + …"
  const options = body.split('\n')
    .map((l) => l.match(/^\s*\d+[.)]\s*(.+)$/)?.[1] || '')
    .map((l) => l.split(/\s[—–?-]\s|:|\(/)[0].trim())
    .filter((l) => l.length > 2 && l.length < 36);
  if (options.length) return options.slice(0, 4);
  const lines = body.split(/\n|•|;/).map((l) => l.replace(/^[\s\-–\d.)]+/, '').trim()).filter(Boolean);
  const picks = lines.filter((l) => l.length > 2 && l.length < 60 && !/^(note|tip|important|critical|why)/i.test(l));
  return (picks.length ? picks : body.split(',').map((x) => x.trim()).filter((x) => x.length > 2 && x.length < 40)).slice(0, 4);
}

/** The whole plan text for the meal, laid out: the rules first, then each
 *  numbered option as its own card (name, what's in it, nutrition), then any
 *  notes after the options. */
function parseMeal(body: string) {
  const intro: string[] = [];
  const notes: string[] = [];
  const options: { name: string; detail: string; macros: string[] }[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const num = line.match(/^\d+[.)]\s*(.+)$/);
    if (num) {
      let text = num[1];
      // nutrition in brackets: (P22g F12g C38g Fiber12g ~340kcal)
      const macroMatch = text.match(/\(([^)]*\d+\s*k?cal[^)]*)\)\s*\.?$/i);
      const macros = macroMatch ? macroMatch[1].split(/\s+/).filter(Boolean) : [];
      if (macroMatch) text = text.slice(0, macroMatch.index).trim();
      const parts = text.split(/\s[—–?-]\s/);
      const name = parts.length > 1 && parts[0].length < 40 ? parts[0].trim() : '';
      const detail = (name ? parts.slice(1).join(' — ') : text).trim().replace(/\.$/, '');
      options.push({ name, detail, macros });
    } else if (options.length) {
      notes.push(line.replace(/^[-•]\s*/, ''));
    } else {
      intro.push(line.replace(/^[-•]\s*/, ''));
    }
  }
  return { intro, options, notes };
}

const MealDetails: React.FC<{ body: string; tr: (en: string, hi: string) => string }> = ({ body, tr }) => {
  const { intro, options, notes } = useMemo(() => parseMeal(body), [body]);
  if (!intro.length && !options.length && !notes.length) return null;
  return (
    <div className="space-y-3 text-left">
      {intro.length > 0 && (
        <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3 space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">{tr('How to eat', 'कैसे खाएं')}</div>
          {intro.map((t, i) => <p key={i} className="text-[12.5px] leading-relaxed text-zinc-700">{t}</p>)}
        </div>
      )}
      {options.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
            {options.length > 1 ? tr(`Choose one of ${options.length} options`, `${options.length} में से एक चुनें`) : tr('What to eat', 'क्या खाएं')}
          </div>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2.5 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
              <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
              <div className="min-w-0 space-y-1">
                {o.name && <div className="text-[13px] font-black text-zinc-900 leading-snug">{o.name}</div>}
                <p className="text-[12.5px] leading-relaxed text-zinc-600">{o.detail}</p>
                {o.macros.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {o.macros.map((m, j) => <span key={j} className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-[10px] font-bold text-zinc-600">{m}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <div className="space-y-1">
          {notes.map((t, i) => <p key={i} className="text-[12px] leading-relaxed text-zinc-500">• {t}</p>)}
        </div>
      )}
    </div>
  );
};

interface TodaysMealCardProps {
  step: PlanSection;
  isDone: boolean;
  onOpenPlan: () => void;
  onOpenScan: () => void;
  tr: (en: string, hi: string) => string;
}

/** "Today's Meal" on Home — the current/next meal from today's real plan,
 *  with someone eating, rotating food animations and food photos. */
export const TodaysMealCard: React.FC<TodaysMealCardProps> = ({ step, isDone, onOpenPlan, onOpenScan, tr }) => {
  const kind = mealKindFor(step.title);
  const eater = useMemo(() => EATERS[kind][Math.floor(Math.random() * EATERS[kind].length)], [kind]);
  const foods = FOODS[kind];
  const [tick, setTick] = useState(() => Math.floor(Math.random() * 100));
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, []);
  const food = foods[tick % foods.length];
  const photo = PHOTOS[kind][tick % PHOTOS[kind].length];
  const chips = useMemo(() => foodsFrom(step.body), [step.body]);
  const kindLabel: Record<MealKind, [string, string]> = {
    breakfast: ['Breakfast', 'नाश्ता'], lunch: ['Lunch', 'दोपहर का खाना'], dinner: ['Dinner', 'रात का खाना'], snack: ['Snack', 'स्नैक'],
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17, ease: 'easeOut' }} className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold font-display text-foreground">{tr("Today's Meal", 'आज का खाना')}</h2>
        </div>
        {step.timeLabel && (
          <span className="flex items-center gap-1 text-[10px] font-black text-zinc-400"><Clock className="w-3 h-3" />{step.timeLabel}</span>
        )}
      </div>

      <motion.div whileHover={{ y: -2 }} className="relative rounded-2xl bg-card border border-border shadow-depth overflow-hidden">
        <ShineBorder borderWidth={2} duration={12} shineColor={['#f59e0b', '#fde68a', '#22c55e']} className="z-[3]" />

        {/* Someone eating + what they're eating */}
        <button type="button" onClick={onOpenPlan} className="meal-visual relative block w-full cursor-pointer" aria-label={tr('Open today\'s meal in your plan', 'प्लान में आज का खाना खोलें')}>
          <span className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 20% 30%, #fef3c7 0%, #fff7ed 45%, #ecfdf5 100%)' }} />
          <span className="meal-blob" />
          <div className="relative grid grid-cols-[1.15fr_1fr] items-center h-full px-2">
            <div className="h-full">
              <DotLottieReact key={eater} src={`/lottie/food/${eater}.lottie`} autoplay loop style={{ width: '100%', height: '100%' }} />
            </div>
            <div className="relative flex flex-col items-center justify-center gap-2 pr-2">
              <div className="relative w-[7.5rem] h-[7.5rem] sm:w-36 sm:h-36 rounded-full bg-white shadow-lg ring-4 ring-white overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.img key={photo} src={photo} alt="" className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />
                </AnimatePresence>
              </div>
              <div className="absolute -bottom-1 -left-2 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/95 shadow-md border border-amber-100">
                <AnimatePresence mode="wait">
                  <motion.div key={food} className="w-full h-full" initial={{ opacity: 0, scale: 0.7, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                    <DotLottieReact src={`/lottie/food/${food}.lottie`} autoplay loop style={{ width: '100%', height: '100%' }} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 border border-amber-200 text-[10px] font-black text-amber-800 shadow-sm">
            🍽️ {tr(...kindLabel[kind])}
          </span>
        </button>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{isDone ? tr('Eaten', 'खा लिया') : tr('On your plan', 'आपके प्लान में')}</span>
            {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </div>
          <h3 className="text-lg font-bold font-display text-foreground leading-snug">{step.title}</h3>
          {chips.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-800 max-w-full truncate">{c}</span>
              ))}
            </div>
          )}
          <MealDetails body={step.body || ''} tr={tr} />
          <div className="pt-2.5 border-t border-zinc-100 grid grid-cols-2 gap-2">
            <button type="button" onClick={onOpenScan} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-white border border-emerald-600 text-emerald-700 text-xs font-black cursor-pointer active:scale-95 transition">
              <ScanLine className="w-3.5 h-3.5" />{tr('Scan my plate', 'प्लेट स्कैन करें')}
            </button>
            <button type="button" onClick={onOpenPlan} className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-emerald-600 text-white text-xs font-black shadow-md shadow-emerald-600/25 cursor-pointer active:scale-95 transition">
              {tr('Full meal', 'पूरा खाना')}<ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

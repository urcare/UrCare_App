import React, { useMemo } from 'react';
import { motion } from 'motion/react';

// Categorical palette for the 3 macro segments — validated for CVD/normal-vision
// separation with `validate_palette.js` (worst adjacent ΔE 16.7 protan / 17.5
// normal). Fats is deliberately the muted/neutral slot (least emphasized macro,
// same idea as this screen already treats it as secondary in plain text) rather
// than a 3rd fully-saturated hue competing with the other two.
const MACRO_COLORS = { protein: '#1baf7a', carbs: '#2a78d6', fats: '#78716c' };

/** Protein/Carbs/Fats as a single animated stacked bar (by kcal share, since
 *  1g protein/carb = 4 kcal but 1g fat = 9 kcal — a gram-only split would
 *  misrepresent how much of the day's energy budget each macro is actually
 *  worth). Real data only — comes straight from the profile's own calculated
 *  plan, nothing invented. A contrast WARN on the fats slot against white is
 *  covered by the direct labels below (never color-alone). */
export const MacroCompositionBar: React.FC<{
  proteinG: number;
  carbsG: number;
  fatsG: number;
  tr: (en: string, hi: string) => string;
}> = ({ proteinG, carbsG, fatsG, tr }) => {
  const { proteinPct, carbsPct, fatsPct } = useMemo(() => {
    const proteinKcal = proteinG * 4;
    const carbsKcal = carbsG * 4;
    const fatsKcal = fatsG * 9;
    const total = proteinKcal + carbsKcal + fatsKcal || 1;
    return {
      proteinPct: (proteinKcal / total) * 100,
      carbsPct: (carbsKcal / total) * 100,
      fatsPct: (fatsKcal / total) * 100,
    };
  }, [proteinG, carbsG, fatsG]);

  const segments = [
    { key: 'protein', pct: proteinPct, color: MACRO_COLORS.protein, label: tr('Protein', 'प्रोटीन'), grams: proteinG },
    { key: 'carbs', pct: carbsPct, color: MACRO_COLORS.carbs, label: tr('Carbs', 'कार्ब्स'), grams: carbsG },
    { key: 'fats', pct: fatsPct, color: MACRO_COLORS.fats, label: tr('Fats', 'फैट्स'), grams: fatsG },
  ];

  return (
    <div>
      <div
        className="flex h-3 rounded-full bg-zinc-100 overflow-hidden gap-[2px]"
        role="img"
        aria-label={`${tr('Protein', 'प्रोटीन')} ${Math.round(proteinPct)}%, ${tr('Carbs', 'कार्ब्स')} ${Math.round(carbsPct)}%, ${tr('Fats', 'फैट्स')} ${Math.round(fatsPct)}%`}
      >
        {segments.map((s, i) => (
          <motion.div
            key={s.key}
            className="h-full rounded-full"
            style={{ background: s.color }}
            initial={{ width: '0%' }}
            animate={{ width: `${s.pct}%` }}
            transition={{ duration: 0.8, delay: i * 0.12, ease: 'easeOut' }}
          />
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
            <span className="text-[11px] font-bold text-zinc-700">{s.label}</span>
            <span className="text-[11px] font-black text-zinc-950">{s.grams}g</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** BMI as a small animated range strip instead of just a number + text
 *  badge — the same real bmi value, now with visual context for where it
 *  falls (Under / Normal / Over / Obese) via a marker sliding to position. */
export const BmiRangeBar: React.FC<{ bmi: number; tr: (en: string, hi: string) => string }> = ({ bmi, tr }) => {
  // Clamp the visual range to 15-40 so the marker never runs off either end
  // for an extreme real value.
  const pct = Math.min(100, Math.max(0, ((bmi - 15) / (40 - 15)) * 100));
  return (
    <div className="pt-1">
      <div className="relative h-2 rounded-full overflow-hidden flex">
        <div className="h-full bg-sky-200" style={{ width: '14%' }} />
        <div className="h-full bg-emerald-400" style={{ width: '28%' }} />
        <div className="h-full bg-amber-300" style={{ width: '20%' }} />
        <div className="h-full bg-zinc-300" style={{ width: '38%' }} />
        <motion.div
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-zinc-950 ring-2 ring-white shadow"
          style={{ y: '-50%' }}
          initial={{ left: '0%' }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase mt-1">
        <span>{tr('Under', 'कम')}</span>
        <span>{tr('Normal', 'सामान्य')}</span>
        <span>{tr('Over', 'अधिक')}</span>
        <span>{tr('Obese', 'मोटापा')}</span>
      </div>
    </div>
  );
};

/** Today's real logged water vs the plan's target, as an animated ring —
 *  and, per the brief, directly editable right here (quick-add buttons +
 *  a custom amount) instead of only ever being a read-only target display. */
export const WaterIntakeRing: React.FC<{
  currentMl: number;
  targetMl: number;
  onAdd: (deltaMl: number) => void;
  isSaving: boolean;
  tr: (en: string, hi: string) => string;
}> = ({ currentMl, targetMl, onAdd, isSaving, tr }) => {
  const [customValue, setCustomValue] = React.useState('');
  const pct = targetMl > 0 ? Math.min(1, currentMl / targetMl) : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const handleCustomAdd = () => {
    const ml = parseInt(customValue, 10);
    if (!ml || ml <= 0) return;
    onAdd(ml);
    setCustomValue('');
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e4e4e7" strokeWidth="9" />
          <motion.circle
            cx="50" cy="50" r={radius} fill="none" stroke="#14b8a6" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black text-zinc-950">{(currentMl / 1000).toFixed(1)}L</span>
          <span className="text-[9px] font-semibold text-zinc-400">/ {(targetMl / 1000).toFixed(1)}L</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {[250, 500].map((ml) => (
            <button
              key={ml}
              type="button"
              disabled={isSaving}
              onClick={() => onAdd(ml)}
              className="px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
            >
              +{ml}ml
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder={tr('Custom ml', 'कस्टम ml')}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomAdd(); }}
            className="w-24 min-w-0 px-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-800 focus:border-teal-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={isSaving || !customValue}
            onClick={handleCustomAdd}
            className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            {tr('Add', 'जोड़ें')}
          </button>
        </div>
      </div>
    </div>
  );
};

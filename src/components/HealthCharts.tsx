import React from 'react';
import { motion } from 'motion/react';
import { Pencil, RotateCcw, Check, X, Droplet } from 'lucide-react';

/** One macro (Protein/Carbs/Fats) — today's real logged-so-far amount vs
 *  the day's real target, as an animated bar, and directly editable right
 *  here: quick-add chips sized to common servings, plus a custom amount,
 *  instead of only ever being a read-only target display. A manual add is
 *  logged as a lightweight "meal" entry (see addQuickMacroLog in
 *  utils/supabase) so it sums into the same real daily total the food
 *  scanner's own scanned meals do — never a separate, parallel tally. */
export const MacroLogRow: React.FC<{
  label: string;
  color: string;
  currentG: number;
  targetG: number;
  quickAdds: number[];
  onAdd: (deltaG: number) => void;
  /** Overrides this macro's target (persisted — see AccountPage's
   *  customMacroTargets). Omit to hide the edit-target control entirely. */
  onEditTarget?: (newTargetG: number) => void;
  /** Clears today's manually-logged amount for this macro (never a real
   *  scanned meal — see resetQuickMacroLog). Omit to hide the reset button. */
  onReset?: () => void;
  isSaving: boolean;
  tr: (en: string, hi: string) => string;
}> = ({ label, color, currentG, targetG, quickAdds, onAdd, onEditTarget, onReset, isSaving, tr }) => {
  const [customValue, setCustomValue] = React.useState('');
  const [isEditingTarget, setIsEditingTarget] = React.useState(false);
  const [targetInput, setTargetInput] = React.useState(String(targetG));
  const pct = targetG > 0 ? Math.min(1, currentG / targetG) : 0;
  const over = targetG > 0 && currentG > targetG;

  const handleCustomAdd = () => {
    const g = parseInt(customValue, 10);
    if (!g || g <= 0) return;
    onAdd(g);
    setCustomValue('');
  };

  const startEditTarget = () => {
    setTargetInput(String(targetG));
    setIsEditingTarget(true);
  };

  const confirmEditTarget = () => {
    const g = parseInt(targetInput, 10);
    if (g && g > 0) onEditTarget?.(g);
    setIsEditingTarget(false);
  };

  return (
    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
          <span className="text-xs font-black text-zinc-900 truncate">{label}</span>
        </div>

        {isEditingTarget ? (
          <div className="flex items-center gap-1 shrink-0">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={1}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEditTarget(); if (e.key === 'Escape') setIsEditingTarget(false); }}
              className="w-14 px-1.5 py-0.5 rounded-md border border-zinc-300 text-xs font-bold text-zinc-800 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-400 font-semibold">g</span>
            <button type="button" onClick={confirmEditTarget} className="p-1 rounded-md text-white cursor-pointer" style={{ background: color }} title={tr('Save target', 'लक्ष्य सहेजें')}>
              <Check className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => setIsEditingTarget(false)} className="p-1 rounded-md bg-zinc-200 text-zinc-500 cursor-pointer" title={tr('Cancel', 'रद्द करें')}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-black tabular-nums" style={{ color: over ? '#e11d48' : '#18181b' }}>
              {currentG}g <span className="text-zinc-400 font-semibold">/ {targetG}g</span>
            </span>
            {onEditTarget && (
              <button type="button" onClick={startEditTarget} className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer" title={tr('Edit target', 'लक्ष्य संपादित करें')}>
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                disabled={isSaving || currentG === 0}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
                title={tr("Reset today's manual log (doesn't remove scanned meals)", 'आज का मैनुअल लॉग रीसेट करें (स्कैन किए गए भोजन नहीं हटेंगे)')}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="h-2 rounded-full bg-white overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: over ? '#e11d48' : color }}
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(100, pct * 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        {quickAdds.map((g) => (
          <button
            key={g}
            type="button"
            disabled={isSaving}
            onClick={() => onAdd(g)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default hover:brightness-95"
            style={{ background: `${color}18`, borderColor: `${color}45`, color }}
          >
            +{g}g
          </button>
        ))}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          placeholder={tr('Custom g', 'कस्टम g')}
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCustomAdd(); }}
          className="w-[72px] min-w-0 px-2 py-1 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 focus:outline-none"
        />
        <button
          type="button"
          disabled={isSaving || !customValue}
          onClick={handleCustomAdd}
          className="px-2.5 py-1 rounded-lg text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
          style={{ background: color }}
        >
          {tr('Add', 'जोड़ें')}
        </button>
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
  /** Overrides the daily water target (persisted — see AccountPage's
   *  customWaterTargetMl). Omit to hide the edit-target control. */
  onEditTarget?: (newTargetMl: number) => void;
  /** Clears today's logged water back to 0. Omit to hide the reset button. */
  onReset?: () => void;
  isSaving: boolean;
  tr: (en: string, hi: string) => string;
}> = ({ currentMl, targetMl, onAdd, onEditTarget, onReset, isSaving, tr }) => {
  const [customValue, setCustomValue] = React.useState('');
  const [isEditingTarget, setIsEditingTarget] = React.useState(false);
  const [targetInput, setTargetInput] = React.useState(String((targetMl / 1000).toFixed(1)));
  const pct = targetMl > 0 ? Math.min(1, currentMl / targetMl) : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const handleCustomAdd = () => {
    const ml = parseInt(customValue, 10);
    if (!ml || ml <= 0) return;
    onAdd(ml);
    setCustomValue('');
  };

  const startEditTarget = () => {
    setTargetInput(String((targetMl / 1000).toFixed(1)));
    setIsEditingTarget(true);
  };

  const confirmEditTarget = () => {
    const l = parseFloat(targetInput);
    if (l && l > 0) onEditTarget?.(Math.round(l * 1000));
    setIsEditingTarget(false);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="waterRingGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e0f2f1" strokeWidth="9" />
          {/* Soft blurred glow copy, sitting under the crisp arc — the
              premium "neon" edge, not a literal separate progress value. */}
          <motion.circle
            cx="50" cy="50" r={radius} fill="none" stroke="url(#waterRingGradient)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ filter: 'blur(4px)', opacity: 0.55 }}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          <motion.circle
            cx="50" cy="50" r={radius} fill="none" stroke="url(#waterRingGradient)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
            <Droplet className="w-3.5 h-3.5 text-teal-500 fill-teal-100" />
          </motion.div>
          <span className="text-sm font-black text-zinc-950">{(currentMl / 1000).toFixed(1)}L</span>
          <span className="text-[9px] font-semibold text-zinc-400">/ {(targetMl / 1000).toFixed(1)}L</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {isEditingTarget ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="number"
              step="0.1"
              min={0.1}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEditTarget(); if (e.key === 'Escape') setIsEditingTarget(false); }}
              className="w-16 px-1.5 py-0.5 rounded-md border border-zinc-300 text-xs font-bold text-zinc-800 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-400 font-semibold">L</span>
            <button type="button" onClick={confirmEditTarget} className="p-1 rounded-md bg-teal-600 text-white cursor-pointer" title={tr('Save target', 'लक्ष्य सहेजें')}>
              <Check className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => setIsEditingTarget(false)} className="p-1 rounded-md bg-zinc-200 text-zinc-500 cursor-pointer" title={tr('Cancel', 'रद्द करें')}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (onEditTarget || onReset) && (
          <div className="flex items-center gap-1 justify-end">
            {onEditTarget && (
              <button type="button" onClick={startEditTarget} className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer" title={tr('Edit target', 'लक्ष्य संपादित करें')}>
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                disabled={isSaving || currentMl === 0}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
                title={tr("Reset today's water log", 'आज का पानी लॉग रीसेट करें')}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {[250, 500].map((ml) => (
            <button
              key={ml}
              type="button"
              disabled={isSaving}
              onClick={() => onAdd(ml)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
            >
              <Droplet className="w-3 h-3" />
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
            className="w-24 min-w-0 px-2 py-1.5 rounded-lg border border-teal-200 bg-white/70 text-xs font-semibold text-zinc-800 focus:border-teal-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={isSaving || !customValue}
            onClick={handleCustomAdd}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-sky-500 hover:brightness-95 text-white text-xs font-bold shadow-sm shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:shadow-none"
          >
            {tr('Add', 'जोड़ें')}
          </button>
        </div>
      </div>
    </div>
  );
};

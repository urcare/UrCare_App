import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Utensils, Footprints, HeartPulse, Leaf } from 'lucide-react';
import { PlanSettings } from '../utils/accountState';
import { SEASONS, MONTH_NAMES, MONTH_PRODUCE, seasonForMonth, SeasonKey } from './seasonalGuide';

/** Plan → season & month guide: tips for the chosen (or current) season and
 *  the fruits and vegetables in season that month. */
export const SeasonGuideCard: React.FC<{ settings: PlanSettings; tr: (en: string, hi: string) => string; onChange: () => void }> = ({ settings, tr, onChange }) => {
  const [open, setOpen] = useState(false);
  const month = typeof settings.month === 'number' ? settings.month : new Date().getMonth();
  const season: SeasonKey = settings.season && settings.season !== 'auto' ? settings.season : seasonForMonth(month);
  const info = SEASONS[season];
  const produce = MONTH_PRODUCE[month];
  const rows: { icon: React.ComponentType<{ className?: string }>; label: [string, string]; items: [string, string][] }[] = [
    { icon: Utensils, label: ['Food', 'खाना'], items: info.food },
    { icon: Footprints, label: ['Movement', 'एक्सरसाइज़'], items: info.move },
    { icon: HeartPulse, label: ['Care', 'देखभाल'], items: info.care },
  ];

  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-sm overflow-hidden text-left">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3.5 cursor-pointer">
        <motion.span animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }} className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-xl shrink-0">{info.emoji}</motion.span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-black text-zinc-900">{tr(...info.name)} · {tr(...MONTH_NAMES[month])}</span>
          <span className="block text-[11px] font-semibold text-zinc-500 truncate">{tr('Season & month tips for your plan', 'आपके प्लान के लिए मौसम व महीने के टिप्स')}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-3.5 pb-3.5 space-y-3">
              {rows.map(({ icon: Icon, label, items }) => (
                <div key={label[0]}>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700"><Icon className="w-3.5 h-3.5" />{tr(...label)}</div>
                  <ul className="mt-1 space-y-1">
                    {items.map((t, i) => <li key={i} className="text-[12.5px] leading-relaxed text-zinc-700">• {tr(...t)}</li>)}
                  </ul>
                </div>
              ))}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700"><Leaf className="w-3.5 h-3.5" />{tr(`In season in ${MONTH_NAMES[month][0]}`, `${MONTH_NAMES[month][1]} में मौसमी`)}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {produce.map((p) => <span key={p[0]} className="px-2.5 py-1 rounded-full bg-white border border-emerald-100 text-[11px] font-bold text-emerald-800">{tr(...p)}</span>)}
                </div>
              </div>
              <button type="button" onClick={onChange} className="text-[11px] font-black text-emerald-700 underline underline-offset-2 cursor-pointer">{tr('Change season or month', 'मौसम या महीना बदलें')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

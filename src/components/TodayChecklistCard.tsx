import React from 'react';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface ChecklistRow {
  key: string;
  Icon: React.FC<{ className?: string }>;
  label: string;
  labelHi: string;
  value: string;
  met: boolean;
}

/** A soft, glassy checklist card — each row fades and slides in a beat after
 *  the last one, and its check/cross badge pops in right after. Every value
 *  passed in is real (today's logged water, meals, plan steps...); this
 *  component only owns the look, never invents what it shows. */
export const TodayChecklistCard: React.FC<{ rows: ChecklistRow[]; isDark?: boolean }> = ({ rows, isDark = false }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  return (
    <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-2.5 ${isDark ? 'bg-zinc-950/60 border border-zinc-800' : 'bg-white/70 border border-zinc-200'} backdrop-blur-md shadow-sm`}>
      <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'} px-1`}>
        {tr("Today's Checklist", 'आज की चेकलिस्ट')}
      </h3>
      <div className="space-y-2">
        {rows.map((row, i) => {
          const RowIcon = row.Icon;
          return (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.09, ease: 'easeOut' }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-white/80'} shadow-xs`}
            >
              <RowIcon className={`w-4.5 h-4.5 shrink-0 ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`} />
              <span className={`text-sm font-bold flex-1 min-w-0 truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                {tr(row.label, row.labelHi)}
              </span>
              <span className={`text-xs font-bold shrink-0 ${row.met ? 'text-emerald-600' : (isDark ? 'text-zinc-400' : 'text-zinc-500')}`}>
                {row.value}
              </span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25, delay: i * 0.09 + 0.2, type: 'spring', stiffness: 400, damping: 18 }}
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  row.met ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-500'
                }`}
              >
                {row.met ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5 stroke-[3]" />}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

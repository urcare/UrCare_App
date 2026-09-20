import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarCheck, PartyPopper, CheckCircle2, Lock, X, ChevronDown } from 'lucide-react';
import { computeWeeks, computeMonths } from '../utils/programWeek';

interface WeeklyUpdatesPanelProps {
  userId: string;
  dayNum: number;
  totalDays: number;
  isDark: boolean;
  tr: (en: string, hi: string) => string;
}

/** Fully automatic — the only inputs are "what day of the program is it"
 *  and "how many days does the program run" (see programWeek.ts, fed by
 *  either the built-in plan's programDay or a custom uploaded plan's
 *  calendar-based day count). Nobody has to mark a week done by hand: as
 *  soon as the program crosses into a new week, the previous one flips to
 *  "Completed" here and a one-time congratulations banner appears. */
export const WeeklyUpdatesPanel: React.FC<WeeklyUpdatesPanelProps> = ({ userId, dayNum, totalDays, isDark, tr }) => {
  const weeks = useMemo(() => computeWeeks(dayNum, totalDays), [dayNum, totalDays]);
  const months = useMemo(() => computeMonths(weeks), [weeks]);
  const currentWeek = weeks.find((w) => w.status === 'current') || weeks[weeks.length - 1];
  const currentMonth = months.find((m) => m.status === 'current') || months[months.length - 1];
  const lastCompletedWeek = [...weeks].reverse().find((w) => w.status === 'completed')?.week ?? 0;

  // Locked months start collapsed (just the header), since there's nothing
  // actionable in them yet — tapping one still opens it to preview which
  // weeks are coming, it just isn't sprawled open by default like the
  // current/completed months are.
  const [openMonths, setOpenMonths] = useState<Set<number>>(() => new Set());
  const isMonthOpen = (m: typeof months[number]) => m.status !== 'upcoming' || openMonths.has(m.month);
  const toggleMonth = (month: number) => setOpenMonths((prev) => {
    const next = new Set(prev);
    if (next.has(month)) next.delete(month); else next.add(month);
    return next;
  });

  const ackKey = `urcare_week_ack_${userId}`;
  const [dismissedUpTo, setDismissedUpTo] = useState<number>(() => {
    try { return Number(localStorage.getItem(ackKey) || 0); } catch { return 0; }
  });

  const showCelebration = lastCompletedWeek > 0 && lastCompletedWeek > dismissedUpTo;

  useEffect(() => {
    // Once the celebration for a freshly-completed week has actually been
    // rendered, treat it as seen — reloading the page (or the program
    // advancing further) shouldn't keep re-showing week 1's banner forever.
  }, []);

  const dismissCelebration = () => {
    setDismissedUpTo(lastCompletedWeek);
    try { localStorage.setItem(ackKey, String(lastCompletedWeek)); } catch {}
  };

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardClass = isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200';
  const textPrimary = isDark ? 'text-white' : 'text-zinc-950';
  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';

  return (
    <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : ''}`}>
          <CalendarCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <h3 className={`text-base font-black tracking-tight ${textPrimary}`}>{tr('Weekly Updates', 'साप्ताहिक अपडेट')}</h3>
          <p className={`text-xs ${textMuted}`}>
            {tr(
              `Month ${currentMonth.month} · Week ${currentWeek.week} of ${weeks.length} — Day ${dayNum} of ${totalDays}`,
              `महीना ${currentMonth.month} · सप्ताह ${currentWeek.week} / ${weeks.length} — दिन ${dayNum} / ${totalDays}`
            )}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm">
              <PartyPopper className="w-5 h-5 shrink-0" />
              <p className="flex-1 text-xs font-bold leading-snug">
                {tr(
                  `Congratulations! Week ${lastCompletedWeek} Completed 🎉 Week ${Math.min(weeks.length, lastCompletedWeek + 1)}'s plan is now available.`,
                  `बधाई हो! सप्ताह ${lastCompletedWeek} पूरा हुआ 🎉 सप्ताह ${Math.min(weeks.length, lastCompletedWeek + 1)} की योजना अब उपलब्ध है।`
                )}
              </p>
              <button
                type="button"
                onClick={dismissCelebration}
                aria-label={tr('Dismiss', 'बंद करें')}
                className="shrink-0 p-1 rounded-lg hover:bg-white/20 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2.5">
        {months.map((m) => {
          const isLocked = m.status === 'upcoming';
          const isOpen = isMonthOpen(m);
          return (
            <div
              key={m.month}
              className={`rounded-2xl border overflow-hidden ${
                m.status === 'current'
                  ? 'border-emerald-300'
                  : isDark ? 'border-zinc-800' : 'border-zinc-200'
              } ${isLocked ? 'opacity-60' : ''}`}
            >
              <button
                type="button"
                onClick={() => isLocked && toggleMonth(m.month)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                  isLocked ? 'cursor-pointer' : 'cursor-default'
                } ${m.status === 'current' ? 'bg-emerald-50' : subCardClass}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {m.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : isLocked ? (
                    <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  )}
                  <span className={`text-sm font-black ${isLocked ? textMuted : textPrimary}`}>
                    {tr(`Month ${m.month}`, `महीना ${m.month}`)}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                      m.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : m.status === 'current'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {m.status === 'completed'
                      ? tr('Completed', 'पूर्ण')
                      : m.status === 'current'
                      ? tr('Active', 'सक्रिय')
                      : tr('Locked', 'लॉक्ड')}
                  </span>
                </div>
                {isLocked && (
                  <ChevronDown className={`w-4 h-4 shrink-0 ${textMuted} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={isLocked ? { height: 0, opacity: 0 } : false}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-2 space-y-1.5">
                      {m.weeks.map((w) => (
                        <div
                          key={w.week}
                          className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl ${
                            w.status === 'current' ? 'bg-emerald-50 border border-emerald-200' : subCardClass
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {w.status === 'completed' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : w.status === 'upcoming' ? (
                              <Lock className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className={`text-xs font-black ${w.status === 'upcoming' ? textMuted : textPrimary}`}>
                                {tr(`Week ${w.week}`, `सप्ताह ${w.week}`)}
                              </div>
                              <div className={`text-[10px] font-semibold ${textMuted}`}>
                                {tr(`Day ${w.dayStart}–${w.dayEnd}`, `दिन ${w.dayStart}–${w.dayEnd}`)}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${
                              w.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : w.status === 'current'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-100 text-zinc-400'
                            }`}
                          >
                            {w.status === 'completed'
                              ? tr('Completed', 'पूर्ण')
                              : w.status === 'current'
                              ? tr('Active', 'सक्रिय')
                              : tr('Locked', 'लॉक्ड')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

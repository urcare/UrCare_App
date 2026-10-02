import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag, PartyPopper, Check, X, Info } from 'lucide-react';
import { computeWeeks } from '../utils/programWeek';
import { getCachedAccountState, saveAccountState } from '../utils/accountState';

interface WeeklyUpdatesPanelProps {
  userId: string;
  dayNum: number;
  totalDays: number;
  /** The real calendar date "Day 1" fell on (the built-in plan's pinned
   *  start, or an uploaded plan's upload date) — turns "Day 8–14" into real
   *  dates like "19–25 Sep". Null while loading; day numbers are shown then. */
  programStartedAt: string | null;
  isDark: boolean;
  language: string;
  tr: (en: string, hi: string) => string;
}

/** Day N of the program as a real date (UTC, matching how the server pins
 *  and counts program days), or null if there's no start date. */
function dateForDay(startedAtIso: string | null, day: number): Date | null {
  if (!startedAtIso) return null;
  const start = new Date(startedAtIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + day - 1));
}

/** "Your Program Progress" — a plain-language view of where the user is in
 *  their plan: today's day number, a progress bar, the start/end dates, and
 *  each week as a tile with its real dates (done / this week / coming up).
 *  Fully automatic: weeks advance with the calendar, nobody marks them done.
 *  When a new week starts, a one-time congratulations banner shows. */
export const WeeklyUpdatesPanel: React.FC<WeeklyUpdatesPanelProps> = ({ userId, dayNum, totalDays, programStartedAt, isDark, language, tr }) => {
  const weeks = useMemo(() => computeWeeks(dayNum, totalDays), [dayNum, totalDays]);
  const currentWeek = weeks.find((w) => w.status === 'current') || weeks[weeks.length - 1];
  const lastCompletedWeek = [...weeks].reverse().find((w) => w.status === 'completed')?.week ?? 0;

  const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, { timeZone: 'UTC', ...opts });
  const startDate = dateForDay(programStartedAt, 1);
  const endDate = dateForDay(programStartedAt, totalDays);
  const daysLeft = Math.max(0, totalDays - dayNum);
  const percent = Math.min(100, Math.round((dayNum / totalDays) * 100));

  /** "12–18 Sep", or "28 Sep – 4 Oct" across months; day numbers if no dates. */
  const weekRange = (dayStart: number, dayEnd: number) => {
    const a = dateForDay(programStartedAt, dayStart);
    const b = dateForDay(programStartedAt, dayEnd);
    if (!a || !b) return tr(`Day ${dayStart}–${dayEnd}`, `दिन ${dayStart}–${dayEnd}`);
    return a.getUTCMonth() === b.getUTCMonth()
      ? `${a.getUTCDate()}–${fmt(b, { day: 'numeric', month: 'short' })}`
      : `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short' })}`;
  };

  // "Seen up to week N" is saved to the account (accountState.ts) so a
  // dismissed celebration stays dismissed on every device; this device's
  // copy is kept as a fallback. Keyed by userId so a family member's
  // progress is tracked separately from the account holder's.
  const ackKey = `urcare_week_ack_${userId}`;
  const [dismissedUpTo, setDismissedUpTo] = useState<number>(() => {
    let local = 0;
    try { local = Number(localStorage.getItem(ackKey) || 0); } catch {}
    return Math.max(local, getCachedAccountState().weeklyAck?.[userId] || 0);
  });
  const showCelebration = lastCompletedWeek > 0 && lastCompletedWeek > dismissedUpTo;
  const dismissCelebration = () => {
    setDismissedUpTo(lastCompletedWeek);
    try { localStorage.setItem(ackKey, String(lastCompletedWeek)); } catch {}
    saveAccountState({ weeklyAck: { ...(getCachedAccountState().weeklyAck || {}), [userId]: lastCompletedWeek } });
  };

  const cardClass = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const textPrimary = isDark ? 'text-white' : 'text-zinc-950';
  const textMuted = isDark ? 'text-zinc-400' : 'text-zinc-500';

  return (
    <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${cardClass} space-y-5`}>
      {/* Header: what this is + today's day number */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
            <Flag className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h3 className={`text-base font-black tracking-tight ${textPrimary}`}>{tr('Your Program Progress', 'आपकी प्रोग्राम प्रगति')}</h3>
            <p className={`text-xs ${textMuted}`}>{tr('How far you are in this plan', 'आप इस प्लान में कितना आगे बढ़ चुके हैं')}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-black leading-none ${textPrimary}`}>
            {tr('Day', 'दिन')} {dayNum}
            <span className={`text-sm font-bold ${textMuted}`}> / {totalDays}</span>
          </div>
          <div className="text-[11px] font-bold text-emerald-600 mt-1">
            {daysLeft === 0
              ? tr('Last day!', 'आखिरी दिन!')
              : tr(`${daysLeft} day${daysLeft === 1 ? '' : 's'} to go`, `${daysLeft} दिन बाकी`)}
          </div>
        </div>
      </div>

      {/* Progress bar + start/end dates */}
      <div className="space-y-1.5">
        <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className={`flex items-center justify-between text-[11px] font-semibold ${textMuted}`}>
          <span>{startDate ? tr(`Started ${fmt(startDate, { day: 'numeric', month: 'short' })}`, `शुरू ${fmt(startDate, { day: 'numeric', month: 'short' })}`) : tr('Start', 'शुरुआत')}</span>
          <span className="text-emerald-600 font-black">{percent}% {tr('done', 'पूरा')}</span>
          <span>{endDate ? tr(`Ends ${fmt(endDate, { day: 'numeric', month: 'short' })}`, `समाप्त ${fmt(endDate, { day: 'numeric', month: 'short' })}`) : tr('End', 'अंत')}</span>
        </div>
      </div>

      {/* One-time "new week" celebration */}
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
                  `Great job! You finished Week ${lastCompletedWeek}. You're now in Week ${currentWeek.week} — keep following today's steps.`,
                  `बहुत बढ़िया! आपने सप्ताह ${lastCompletedWeek} पूरा कर लिया। अब आप सप्ताह ${currentWeek.week} में हैं — आज के steps करते रहें।`
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

      {/* Week tiles — real dates, three plain states */}
      <div>
        <div className={`text-[11px] font-black uppercase tracking-wider mb-2 ${textMuted}`}>{tr('Your weeks', 'आपके सप्ताह')}</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(weeks.length, 5)}, minmax(0, 1fr))` }}>
          {weeks.map((w) => {
            const done = w.status === 'completed';
            const now = w.status === 'current';
            return (
              <div
                key={w.week}
                className={`relative rounded-2xl p-2 sm:p-3 text-center border transition-all ${
                  now
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                    : done
                    ? isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-100 bg-emerald-50/60'
                    : isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <div className={`mx-auto w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mb-1.5 ${
                  done ? 'bg-emerald-500 text-white' : now ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20' : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-white border border-zinc-200 text-zinc-400'
                }`}>
                  {done ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-xs font-black">{w.week}</span>}
                </div>
                <div className={`text-[11px] sm:text-xs font-black ${done || now ? textPrimary : textMuted}`}>{tr(`Week ${w.week}`, `सप्ताह ${w.week}`)}</div>
                <div className={`text-[9px] sm:text-[10px] font-semibold leading-tight mt-0.5 ${textMuted}`}>{weekRange(w.dayStart, w.dayEnd)}</div>
                <div className={`mt-1.5 text-[9px] font-black uppercase tracking-wide ${now ? 'text-emerald-600' : done ? 'text-emerald-600/80' : textMuted}`}>
                  {done ? tr('Done', 'पूरा') : now ? tr('This week', 'यह सप्ताह') : tr('Coming up', 'आगे')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* What this means, in one line */}
      <p className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${textMuted}`}>
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{tr(
          'Your plan moves to the next week on its own — you don’t need to do anything. Just complete today’s steps below.',
          'आपका प्लान अपने आप अगले सप्ताह में चला जाता है — आपको कुछ नहीं करना है। बस नीचे दिए आज के steps पूरे करें।'
        )}</span>
      </p>
    </div>
  );
};

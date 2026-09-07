import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, ChevronDown, Check } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { toDateKey } from './DailyCalendar';
import { getActiveDates, getDailyPlan, getTaskCompletion } from '../utils/supabase';

interface StreakWidgetProps {
  profile: UserHealthProfile;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A day's worth of full plan completion is worth this many points. Every
 *  30-day streak milestone adds a one-time bonus on top. */
const POINTS_PER_DAY = 30;
const BONUS_PER_MONTH = 10;

/** Monday..Sunday of the current week, as Date objects at local midnight. */
function currentWeekDates(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay(); // 0 = Sun ... 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Consecutive days of activity ending today — or ending yesterday if
 *  nothing has been logged yet today, so the streak isn't lost the moment
 *  the clock rolls over before the user opens the app. */
function computeStreak(markedDates: Set<string>): number {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!markedDates.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (markedDates.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}
function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

const HEART_WHITE = '#f1f5f9';
const HEART_RED = '#ef4444';
const HEART_GREEN = '#22c55e';

/** White at the start of the day, gradually reddening as today's tasks get
 *  checked off, then easing into green a little before everything is done
 *  — the color reflects real progress, it never just loops on its own. */
function heartColorForProgress(pct: number): string {
  if (pct <= 0) return HEART_WHITE;
  if (pct < 55) return lerpColor(HEART_WHITE, HEART_RED, pct / 55);
  return lerpColor(HEART_RED, HEART_GREEN, Math.min(1, (pct - 55) / 35));
}

/** A heart that beats gently, colors itself by real progress (white → red →
 *  green, easing smoothly whenever progress changes rather than snapping),
 *  and gives a satisfying fast-spin-then-settle flourish on tap. A fixed
 *  soft outline keeps it visible even at its palest point. */
const AnimatedHeart: React.FC<{ size?: number; progressPct?: number; spinTrigger?: number }> = ({
  size = 20, progressPct = 0, spinTrigger = 0,
}) => {
  const targetColor = heartColorForProgress(progressPct);
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full blur-md"
        animate={{ opacity: [0.25, 0.55, 0.25], scale: [0.85, 1.1, 0.85], backgroundColor: targetColor }}
        transition={{
          opacity: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
          scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
          backgroundColor: { duration: 1.6, ease: 'easeInOut' },
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.16, 1, 1.1, 1], rotate: spinTrigger * 360 }}
        transition={{
          scale: { duration: 1, repeat: Infinity, repeatDelay: 0.7, ease: 'easeInOut', times: [0, 0.25, 0.45, 0.65, 1] },
          rotate: { duration: 0.7, ease: 'easeOut' },
        }}
      >
        <motion.div animate={{ color: targetColor }} transition={{ duration: 1.6, ease: 'easeInOut' }}>
          <Heart
            style={{ width: size, height: size }}
            fill="currentColor"
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

/** A small "Streak" pill — sized to its own content, not a full-width bar —
 *  that opens a compact dropdown card on tap. Rendered once outside the tab
 *  content, so it stays visible no matter which module you switch to. */
export const StreakWidget: React.FC<StreakWidgetProps> = ({ profile }) => {
  const userId = profile.id || '';
  const [expanded, setExpanded] = useState(false);
  // Bumped on every tap of the pill so both hearts (collapsed + expanded)
  // do their spin-and-settle flourish together.
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [todayDone, setTodayDone] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    const todayKey = toDateKey(new Date());
    getActiveDates(userId).then(setMarkedDates);
    Promise.all([getDailyPlan(todayKey), getTaskCompletion(userId, todayKey)]).then(([plan, completion]) => {
      const taskIds: string[] = (plan.plan?.sections || []).filter((s: any) => s.timeLabel).map((s: any) => s.id);
      setTodayTotal(taskIds.length);
      setTodayDone(taskIds.filter((id) => completion[id]).length);
    });
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Ticking a task anywhere in the app (the daily plan) fires this event —
  // without listening for it, this widget would only ever pick up the
  // change the next time it happens to remount, which reads as a very
  // delayed / stuck streak.
  useEffect(() => {
    window.addEventListener('urcare:daily-log-changed', refresh);
    return () => window.removeEventListener('urcare:daily-log-changed', refresh);
  }, [refresh]);

  const streak = useMemo(() => computeStreak(markedDates), [markedDates]);
  const weekDates = useMemo(() => currentWeekDates(), []);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = toDateKey(today);
  const progressPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  // Points: a full day of the plan is worth 30 — every 30-day streak
  // milestone adds a one-time 10-point bonus on top.
  const bonusPoints = Math.floor(streak / 30) * BONUS_PER_MONTH;
  const streakPoints = streak * POINTS_PER_DAY + bonusPoints;
  const todayPoints = todayTotal > 0 ? Math.round((todayDone / todayTotal) * POINTS_PER_DAY) : 0;

  return (
    <div className="relative inline-block">
      {/* The pill — sized to its content, opens the card on tap. */}
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); setSpinTrigger((n) => n + 1); }}
        className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-white shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-50 to-emerald-50 flex items-center justify-center shrink-0">
          <AnimatedHeart size={15} progressPct={progressPct} spinTrigger={spinTrigger} />
        </div>
        <span className="text-xs font-black text-zinc-900">Streak</span>
        {streak > 0 && <span className="text-xs font-bold text-zinc-500">{streak}d</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* The card — floats over the page as an overlay so the rest of the
          page never shifts down to make room for it. Clicking outside (the
          invisible backdrop) closes it, same as tapping the pill again. */}
      <AnimatePresence>
        {expanded && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute top-full left-0 mt-2 z-50 w-72 max-w-[85vw] rounded-2xl overflow-hidden shadow-xl border border-zinc-800/50 p-4 bg-gradient-to-br from-zinc-950 to-zinc-900 text-white space-y-4"
            >
              <div className="flex items-center gap-3.5">
                <AnimatedHeart size={36} progressPct={progressPct} spinTrigger={spinTrigger} />
                <div className="min-w-0">
                  <div className="text-2xl font-black leading-none">{streakPoints} <span className="text-sm font-bold text-zinc-400">pts</span></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{streak}-Day Streak</span>
                </div>
                {bonusPoints > 0 && (
                  <span className="ml-auto text-[9px] font-black uppercase px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
                    +{bonusPoints} Bonus
                  </span>
                )}
              </div>

              {todayTotal > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                    <span>Today's Progress</span>
                    <span className="text-white">{todayDone}/{todayTotal} · +{todayPoints} pts</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                {weekDates.map((d) => {
                  const key = toDateKey(d);
                  const isToday = key === todayKey;
                  const isDone = markedDates.has(key);
                  const isFuture = d.getTime() > today.getTime();
                  return (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isDone
                            ? 'bg-gradient-to-br from-rose-500 to-emerald-500 shadow-sm shadow-emerald-500/30'
                            : 'bg-white/10'
                        } ${isToday && !isDone ? 'ring-2 ring-white/50' : ''}`}
                      >
                        {isDone ? (
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${isFuture ? 'bg-white/20' : 'bg-white/30'}`} />
                        )}
                      </div>
                      <span className={`text-[9px] font-bold ${isToday ? 'text-white' : 'text-zinc-500'}`}>
                        {WEEKDAY_LABELS[weekDates.indexOf(d)]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

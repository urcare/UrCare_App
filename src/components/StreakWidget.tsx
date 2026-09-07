import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ChevronDown, Check } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { toDateKey } from './DailyCalendar';
import { getActiveDates, getDailyPlan, getTaskCompletion } from '../utils/supabase';

interface StreakWidgetProps {
  profile: UserHealthProfile;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

/** A small flickering flame — two layered icons animating out of phase, plus
 *  a soft pulsing glow behind them, so it reads as actually moving rather
 *  than a static icon. */
const AnimatedFlame: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
    <motion.div
      className="absolute inset-0 rounded-full bg-orange-500/50 blur-md"
      animate={{ opacity: [0.4, 0.85, 0.5, 0.7, 0.4], scale: [0.85, 1.15, 0.95, 1.05, 0.85] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute"
      animate={{ scaleY: [1, 1.12, 0.94, 1.08, 1], scaleX: [1, 0.94, 1.06, 0.97, 1], rotate: [-4, 3, -2, 4, -4] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Flame style={{ width: size, height: size }} className="text-rose-500 fill-rose-500/90" />
    </motion.div>
    <motion.div
      className="absolute"
      animate={{ scaleY: [1, 0.9, 1.1, 0.95, 1], rotate: [3, -3, 2, -4, 3] }}
      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
    >
      <Flame style={{ width: size * 0.62, height: size * 0.62 }} className="text-amber-300 fill-amber-300/90" />
    </motion.div>
  </div>
);

/** A collapsed streak bar that opens into a full streak card on tap — how
 *  many days in a row the reversal plan has been followed, plus this week
 *  at a glance and today's task progress. */
export const StreakWidget: React.FC<StreakWidgetProps> = ({ profile }) => {
  const userId = profile.id || '';
  const [expanded, setExpanded] = useState(false);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [todayDone, setTodayDone] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const todayKey = toDateKey(new Date());

    getActiveDates(userId).then((dates) => { if (!cancelled) setMarkedDates(dates); });
    Promise.all([getDailyPlan(todayKey), getTaskCompletion(userId, todayKey)]).then(([plan, completion]) => {
      if (cancelled) return;
      const taskIds: string[] = (plan.plan?.sections || []).filter((s: any) => s.timeLabel).map((s: any) => s.id);
      setTodayTotal(taskIds.length);
      setTodayDone(taskIds.filter((id) => completion[id]).length);
    });

    return () => { cancelled = true; };
  }, [userId]);

  const streak = useMemo(() => computeStreak(markedDates), [markedDates]);
  const weekDates = useMemo(() => currentWeekDates(), []);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = toDateKey(today);
  const progressPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  return (
    <div className="rounded-3xl overflow-hidden border border-zinc-200 shadow-sm">
      {/* Collapsed bar — always visible, opens the full card on tap. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 bg-white hover:bg-zinc-50 transition-colors cursor-pointer text-left"
      >
        <AnimatedFlame size={22} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-black text-zinc-950">{streak} Day Streak</span>
          {todayTotal > 0 && (
            <span className="text-xs text-zinc-500 font-semibold ml-2">· {todayDone}/{todayTotal} tasks today</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded — the full streak card. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-5 sm:p-6 bg-gradient-to-br from-zinc-950 to-zinc-900 text-white space-y-5">
              <div className="flex items-center gap-4">
                <AnimatedFlame size={44} />
                <div>
                  <div className="text-3xl font-black leading-none">{streak} <span className="text-base font-bold text-zinc-400">days</span></div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Reversal Plan Streak</span>
                </div>
              </div>

              {todayTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <span>Today's Progress</span>
                    <span className="text-white">{todayDone}/{todayTotal}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
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
                    <div key={key} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                          isDone
                            ? 'bg-gradient-to-br from-rose-500 to-amber-400 shadow-md shadow-rose-500/30'
                            : 'bg-white/10'
                        } ${isToday && !isDone ? 'ring-2 ring-white/50' : ''}`}
                      >
                        {isDone ? (
                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${isFuture ? 'bg-white/20' : 'bg-white/30'}`} />
                        )}
                      </div>
                      <span className={`text-[10px] font-bold ${isToday ? 'text-white' : 'text-zinc-500'}`}>
                        {WEEKDAY_LABELS[weekDates.indexOf(d)]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
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

/** A heart that beats and slowly cycles color (white → red → green) —
 *  animated in both motion and color, not a static icon. A fixed soft
 *  outline keeps it visible even at its palest point. */
const AnimatedHeart: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
    <motion.div
      className="absolute inset-0 rounded-full bg-rose-500/40 blur-md"
      animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.1, 0.85] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      animate={{ scale: [1, 1.16, 1, 1.1, 1] }}
      transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.7, ease: 'easeInOut', times: [0, 0.25, 0.45, 0.65, 1] }}
    >
      <motion.div
        animate={{ color: ['#ffffff', '#ef4444', '#22c55e', '#ffffff'] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      >
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

/** A collapsed streak bar that opens into a full streak card on tap — points
 *  earned, days in a row the reversal plan has been followed, this week at
 *  a glance, and today's task progress. Rendered once outside the tab
 *  content, so it stays visible no matter which module you switch to. */
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

  // Points: a full day of the plan is worth 30 — every 30-day streak
  // milestone adds a one-time 10-point bonus on top.
  const bonusPoints = Math.floor(streak / 30) * BONUS_PER_MONTH;
  const streakPoints = streak * POINTS_PER_DAY + bonusPoints;
  const todayPoints = todayTotal > 0 ? Math.round((todayDone / todayTotal) * POINTS_PER_DAY) : 0;

  return (
    <div className="rounded-3xl overflow-hidden border border-zinc-200 shadow-sm">
      {/* Collapsed bar — always visible, opens the full card on tap. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 bg-white hover:bg-zinc-50 transition-colors cursor-pointer text-left"
      >
        <AnimatedHeart size={22} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-black text-zinc-950">{streakPoints} Points</span>
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
                <AnimatedHeart size={44} />
                <div>
                  <div className="text-3xl font-black leading-none">{streakPoints} <span className="text-base font-bold text-zinc-400">pts</span></div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{streak}-Day Reversal Streak</span>
                </div>
                {bonusPoints > 0 && (
                  <span className="ml-auto text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
                    +{bonusPoints} Monthly Bonus
                  </span>
                )}
              </div>

              {todayTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <span>Today's Progress</span>
                    <span className="text-white">{todayDone}/{todayTotal} tasks · +{todayPoints} pts</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-emerald-500"
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
                            ? 'bg-gradient-to-br from-rose-500 to-emerald-500 shadow-md shadow-emerald-500/30'
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Check, X, Calendar, Target, BarChart3, Trophy } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { toDateKey } from './DailyCalendar';
import { getActiveDates } from '../utils/supabase';

interface StreakWidgetProps {
  profile: UserHealthProfile;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The uploaded 3D green heart-with-flame asset — resized/compressed from
 *  the original 2.1MB upload (public/Streak.png) down to a ~420px-wide,
 *  ~75KB PNG that still looks identical at the small sizes this actually
 *  renders at. Used as-is (never redrawn/recolored) everywhere a "streak
 *  heart" appears, per the brief. */
const STREAK_HEART_SRC = '/streak-heart.png';

/** A day's worth of full plan completion is worth this many points. Every
 *  30-day streak milestone adds a one-time bonus on top. */
const POINTS_PER_DAY = 30;
const BONUS_PER_MONTH = 10;

const HEART_GREEN = '#22c55e';

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

/** The longest run of consecutive active days anywhere in the user's
 *  history (not just the streak currently running) — shown as "Your
 *  longest streak" in the expanded card. */
function computeLongestStreak(markedDates: Set<string>): number {
  if (markedDates.size === 0) return 0;
  const days = Array.from(markedDates)
    .map((key) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    })
    .sort((a, b) => a - b);

  let longest = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const diffDays = Math.round((days[i] - days[i - 1]) / 86400000);
    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return longest;
}

/** The streak glyph: the uploaded green 3D heart-with-flame image, brought
 *  to life with layered CSS/JS effects only — the image pixels themselves
 *  are never redrawn, recolored, or distorted. Two soft glow layers pulse
 *  behind it out of phase for depth, the heart itself gently floats and
 *  breathes, a light shimmer sweeps across it on a loop, and it tilts in
 *  3D on hover. */
const StreakHeartImage: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <motion.div
    className="relative inline-flex items-center justify-center shrink-0"
    style={{ width: size, height: size, perspective: 200 }}
    whileHover={{ rotateY: 18, rotateX: -8, scale: 1.08 }}
    whileTap={{ scale: 0.94 }}
    transition={{ type: 'spring', stiffness: 260, damping: 14 }}
  >
    {/* Layered ambient glow — two blurred halos pulsing out of phase */}
    <motion.div
      className="absolute inset-0 rounded-full bg-emerald-500/35 blur-lg"
      animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.85, 1.25, 0.85] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute inset-0 rounded-full bg-lime-300/40 blur-md"
      animate={{ opacity: [0.25, 0.55, 0.25], scale: [0.75, 1.05, 0.75] }}
      transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
    />

    {/* The heart itself — floats and breathes gently, never distorted */}
    <motion.img
      src={STREAK_HEART_SRC}
      alt="Streak"
      draggable={false}
      className="relative pointer-events-none select-none"
      style={{ width: size, height: size, objectFit: 'contain' }}
      animate={{ y: [0, -2, 0], scale: [1, 1.045, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* A light shimmer sweeping across the heart on a loop */}
    <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none" style={{ mixBlendMode: 'plus-lighter' }}>
      <motion.div
        className="absolute inset-y-0 w-1/3 bg-white/60 blur-[2px]"
        style={{ transform: 'skewX(-20deg)' }}
        animate={{ x: ['-140%', '240%'] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
      />
    </div>
  </motion.div>
);

/** The compact "Days" trigger that sits next to the '⋮' module menu — the
 *  heart glyph, a small label, and this week's Mon..Sun positions shown as
 *  numbered chips (1-7), colored by real progress: filled for days already
 *  completed, a solid ring for today, and a plain inactive dot for days
 *  not yet reached. Tapping it opens the same full streak card below. */
const StreakDaysBar: React.FC<{
  weekDates: Date[];
  markedDates: Set<string>;
  todayKey: string;
  onOpen: () => void;
}> = ({ weekDates, markedDates, todayKey, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    title="Streak"
    className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-white shadow-sm hover:shadow-md border border-zinc-100 transition-all cursor-pointer"
  >
    <StreakHeartImage size={26} />
    <span className="text-[9px] sm:text-[10px] font-black text-zinc-900 uppercase tracking-wide shrink-0">Days</span>
    <div className="flex items-center gap-[3px] shrink-0">
      {weekDates.map((d, i) => {
        const key = toDateKey(d);
        const isToday = key === todayKey;
        const isDone = markedDates.has(key);
        return (
          <span
            key={key}
            className={`w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-black transition-colors ${
              isToday
                ? 'bg-emerald-600 text-white'
                : isDone
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-400'
            }`}
          >
            {i + 1}
          </span>
        );
      })}
    </div>
  </button>
);

/** The "Days" trigger next to the '⋮' module menu, and the full streak
 *  card it opens — unchanged data/behavior from before, just re-skinned
 *  with the uploaded heart asset per the brief. Rendered once outside the
 *  tab content, so it stays visible no matter which module you switch to. */
export const StreakWidget: React.FC<StreakWidgetProps> = ({ profile }) => {
  const userId = profile.id || '';
  const [expanded, setExpanded] = useState(false);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!userId) return;
    getActiveDates(userId).then(setMarkedDates);
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
  const longestStreak = useMemo(() => Math.max(computeLongestStreak(markedDates), streak), [markedDates, streak]);
  const totalActiveDays = markedDates.size;
  const weekDates = useMemo(() => currentWeekDates(), []);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = toDateKey(today);

  // Points: a full day of the plan is worth 30 — every 30-day streak
  // milestone adds a one-time 10-point bonus on top.
  const bonusPoints = Math.floor(streak / 30) * BONUS_PER_MONTH;
  const streakPoints = streak * POINTS_PER_DAY + bonusPoints;

  const close = () => setExpanded(false);

  return (
    <div className="relative inline-block">
      <StreakDaysBar
        weekDates={weekDates}
        markedDates={markedDates}
        todayKey={todayKey}
        onOpen={() => setExpanded((v) => !v)}
      />

      {/* The full streak card — a centered modal over the whole page, with
          real data: current streak, all-time longest streak, this week's
          activity, and total active days. Unchanged from before, aside
          from the heart glyph now being the uploaded image.
          Portaled to <body>: the trigger now lives inside the sticky mobile
          header, which has a backdrop-blur — and backdrop-filter (like
          filter/transform/perspective) makes its own box the containing
          block for any `position: fixed` descendant. Left as a normal
          descendant, this modal would end up clipped to the header's own
          small box instead of covering the viewport; portaling it out from
          under that ancestor is the standard fix. */}
      {createPortal(
        <AnimatePresence>
        {expanded && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                className="relative w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6 space-y-5 text-left"
              >
                <div className="w-10 h-1 rounded-full bg-zinc-200 mx-auto -mt-1" />
                <button
                  type="button"
                  onClick={close}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>

                <div>
                  <h2 className="text-2xl font-black text-zinc-950">Your Streak</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Small steps. A healthier you!</p>
                </div>

                <div className="flex items-center gap-3.5">
                  <StreakHeartImage size={68} />
                  <div className="flex-1 min-w-0">
                    <div className="text-3xl font-black text-zinc-950 leading-none">{streak}</div>
                    <div className="text-xs font-bold text-zinc-500 mt-1">Day Streak</div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                      {streak > 0 ? 'Great job! Keep going and stay consistent.' : 'Complete a task today to start your streak!'}
                    </p>
                  </div>
                  <div className="shrink-0 w-[92px] flex flex-col items-center text-center gap-1 px-2.5 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="text-[9px] font-bold text-emerald-700 leading-tight">Your longest streak</span>
                    <span className="text-sm font-black text-emerald-700">{longestStreak} days</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {weekDates.map((d) => {
                    const key = toDateKey(d);
                    const isToday = key === todayKey;
                    const isDone = markedDates.has(key);
                    return (
                      <div key={key} className="flex flex-col items-center gap-1.5">
                        <div className={`relative w-8 h-8 flex items-center justify-center ${isToday && !isDone ? 'ring-2 ring-emerald-400 rounded-full' : ''}`}>
                          <Heart
                            className="absolute inset-0 w-8 h-8"
                            fill={isDone ? HEART_GREEN : 'none'}
                            stroke={isDone ? HEART_GREEN : '#cbd5e1'}
                            strokeWidth={1.5}
                          />
                          {isDone && <Check className="relative w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                        <span className={`text-[10px] font-bold ${isToday ? 'text-emerald-600' : 'text-zinc-400'}`}>
                          {WEEKDAY_LABELS[weekDates.indexOf(d)]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                    <div className="w-7 h-7 rounded-xl bg-white border border-zinc-200 flex items-center justify-center">
                      <Target className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-xs font-black text-zinc-900 mt-1.5">Streak Goal</div>
                    <p className="text-[10px] text-zinc-500 leading-snug">Build a healthier tomorrow, one day at a time.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                    <div className="w-7 h-7 rounded-xl bg-white border border-zinc-200 flex items-center justify-center">
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-xs font-black text-zinc-900 mt-1.5">Total Active Days</div>
                    <div className="text-lg font-black text-emerald-600 leading-none mt-0.5">{totalActiveDays} days</div>
                    <p className="text-[10px] text-zinc-500 leading-snug">
                      {streakPoints > 0 ? `${streakPoints} pts earned so far` : "You're on the right track!"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={close}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Keep Going!</span>
                </button>
              </motion.div>
            </div>
          </>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

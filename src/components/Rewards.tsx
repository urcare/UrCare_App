import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Lock, X } from 'lucide-react';
import { getActiveDates, getFamily, getReferralStatus } from '../utils/supabase';
import { toDateKey } from './DailyCalendar';

export interface Badge {
  id: string;
  emoji: string;
  title: [string, string];
  detail: [string, string];
  unlocked: boolean;
  /** 0–1 progress towards unlocking. */
  progress: number;
}

function currentStreak(dates: Set<string>): number {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (!dates.has(toDateKey(d))) d.setDate(d.getDate() - 1); // today not done yet — count from yesterday
  let n = 0;
  while (dates.has(toDateKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** This month's badges and milestones — from the member's real activity:
 *  active days, streak, family and friends who joined. */
export function computeBadges(dates: Set<string>, familyCount: number, friendsJoined: number): Badge[] {
  const now = new Date();
  const monthPrefix = toDateKey(now).slice(0, 7);
  const monthDays = [...dates].filter((k) => k.startsWith(monthPrefix)).length;
  const streak = currentStreak(dates);
  const dayOfMonth = now.getDate();
  const b = (id: string, emoji: string, title: [string, string], detail: [string, string], value: number, goal: number): Badge =>
    ({ id, emoji, title, detail, unlocked: value >= goal, progress: Math.min(1, value / goal) });
  return [
    b('first-day', '🌱', ['First step', 'पहला कदम'], ['Complete your plan on 1 day', '1 दिन प्लान पूरा करें'], dates.size, 1),
    b('streak-3', '🔥', ['3-day streak', '3 दिन की स्ट्रीक'], ['3 days in a row', 'लगातार 3 दिन'], streak, 3),
    b('streak-7', '⚡', ['Week warrior', 'वीक वॉरियर'], ['7 days in a row', 'लगातार 7 दिन'], streak, 7),
    b('streak-30', '👑', ['30-day legend', '30 दिन लीजेंड'], ['30 days in a row', 'लगातार 30 दिन'], streak, 30),
    b(`month-10-${monthPrefix}`, '🥉', ['Bronze month', 'ब्रॉन्ज़ महीना'], ['10 active days this month', 'इस महीने 10 एक्टिव दिन'], monthDays, 10),
    b(`month-20-${monthPrefix}`, '🥈', ['Silver month', 'सिल्वर महीना'], ['20 active days this month', 'इस महीने 20 एक्टिव दिन'], monthDays, 20),
    b(`month-perfect-${monthPrefix}`, '🥇', ['Gold month', 'गोल्ड महीना'], ['Active every day this month', 'इस महीने हर दिन एक्टिव'], dayOfMonth >= 7 ? monthDays : 0, dayOfMonth >= 7 ? dayOfMonth : 28),
    b('family-1', '❤️', ['Family first', 'परिवार पहले'], ['Add 1 family member or friend', '1 परिवार सदस्य या दोस्त जोड़ें'], familyCount, 1),
    b('family-3', '👨‍👩‍👧', ['Health circle', 'हेल्थ सर्कल'], ['Add 3 family & friends', '3 परिवार/दोस्त जोड़ें'], familyCount, 3),
    b('referral-5', '🎁', ['Super inviter', 'सुपर इनवाइटर'], ['5 friends join with your link', 'आपके लिंक से 5 दोस्त जुड़ें'], friendsJoined, 5),
  ];
}

/** Loads the member's badges (and refreshes when a plan step is ticked). */
export function useBadges(userId: string) {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = () => Promise.all([getActiveDates(userId), getFamily(), getReferralStatus()]).then(([dates, fam, ref]) => {
      if (!cancelled) setBadges(computeBadges(dates, fam?.members.length || 0, ref?.joined || 0));
    });
    load();
    window.addEventListener('urcare:daily-log-changed', load);
    return () => { cancelled = true; window.removeEventListener('urcare:daily-log-changed', load); };
  }, [userId]);
  return badges;
}

export const BadgeGrid: React.FC<{ badges: Badge[]; tr: (en: string, hi: string) => string }> = ({ badges, tr }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
    {badges.map((bd) => (
      <motion.div key={bd.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`relative p-3 rounded-2xl border text-left overflow-hidden ${bd.unlocked ? 'bg-gradient-to-br from-amber-50 to-white border-amber-200 shadow-sm' : 'bg-white border-zinc-200'}`}>
        <div className={`text-3xl leading-none ${bd.unlocked ? '' : 'grayscale opacity-40'}`}>{bd.emoji}</div>
        {!bd.unlocked && <Lock className="absolute top-3 right-3 w-3.5 h-3.5 text-zinc-300" />}
        <div className="mt-2 text-xs font-black text-zinc-900 leading-tight">{tr(bd.title[0], bd.title[1])}</div>
        <div className="text-[10px] font-semibold text-zinc-500 leading-snug mt-0.5">{tr(bd.detail[0], bd.detail[1])}</div>
        <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
          <motion.div className={`h-full rounded-full ${bd.unlocked ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-emerald-400'}`} initial={{ width: 0 }} animate={{ width: `${Math.round(bd.progress * 100)}%` }} transition={{ duration: 0.8 }} />
        </div>
      </motion.div>
    ))}
  </div>
);

const SEEN_KEY = (uid: string) => `urcare_badges_seen_${uid}`;

/** Pops up once for each newly unlocked badge. */
export const RewardUnlockWatcher: React.FC<{ userId: string; tr: (en: string, hi: string) => string }> = ({ userId, tr }) => {
  const badges = useBadges(userId);
  const [queue, setQueue] = useState<Badge[]>([]);
  useEffect(() => {
    if (!badges) return;
    let seen: string[] | null = null;
    try { const raw = localStorage.getItem(SEEN_KEY(userId)); seen = raw ? JSON.parse(raw) : null; } catch {}
    const unlocked = badges.filter((b) => b.unlocked).map((b) => b.id);
    // First run on this device: remember what's already unlocked without a burst of pop-ups.
    if (!seen) { try { localStorage.setItem(SEEN_KEY(userId), JSON.stringify(unlocked)); } catch {} return; }
    const fresh = badges.filter((b) => b.unlocked && !seen!.includes(b.id));
    if (fresh.length) {
      try { localStorage.setItem(SEEN_KEY(userId), JSON.stringify([...seen, ...fresh.map((b) => b.id)])); } catch {}
      setQueue((q) => [...q, ...fresh]);
    }
  }, [badges, userId]);
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    try { confetti({ particleCount: 100, spread: 75, origin: { y: 0.5 }, colors: ['#f59e0b', '#fde68a', '#10b981', '#ffffff'] }); } catch {}
  }, [current?.id]);
  if (!current) return null;
  return createPortal(
    <AnimatePresence>
      <motion.div key="bg" className="fixed inset-0 z-[72] bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQueue((q) => q.slice(1))} />
      <div key="card" className="fixed inset-0 z-[73] flex items-center justify-center p-5 pointer-events-none">
        <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 16 }} className="pointer-events-auto relative w-full max-w-xs rounded-[1.75rem] bg-white shadow-2xl overflow-hidden text-center">
          <button type="button" onClick={() => setQueue((q) => q.slice(1))} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/5 cursor-pointer"><X className="w-4 h-4 text-zinc-600" /></button>
          <div className="pt-7 pb-4 bg-gradient-to-b from-amber-100 via-amber-50 to-white">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">{tr('Reward unlocked', 'रिवॉर्ड मिला')}</div>
            <motion.div className="mt-3 text-7xl" animate={{ scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1 }}>{current.emoji}</motion.div>
          </div>
          <div className="px-6 pb-6">
            <div className="text-xl font-black text-zinc-900">{tr(current.title[0], current.title[1])}</div>
            <div className="text-sm text-zinc-500 mt-1">{tr(current.detail[0], current.detail[1])}</div>
            <div className="mx-auto mt-3 w-16 h-16"><DotLottieReact src="/lottie/buddy-cheer.lottie" autoplay loop /></div>
            <button type="button" onClick={() => setQueue((q) => q.slice(1))} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-black cursor-pointer">{tr('Awesome!', 'शानदार!')}</button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
};

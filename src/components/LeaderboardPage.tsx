import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, Medal, Sparkles } from 'lucide-react';
import { BorderBeam } from './magicui/border-beam';
import { MagicCard } from './magicui/magic-card';
import { BadgeGrid, useBadges } from './Rewards';

// Sample players — mostly India, then the USA and the Gulf (illustrated avatars, not real people).
const PLAYERS: [string, string][] = [
  ['Aarav Mehta', '🇮🇳'], ['Priya Nair', '🇮🇳'], ['Arjun Reddy', '🇮🇳'], ['Ethan Brooks', '🇺🇸'], ['Ananya Iyer', '🇮🇳'],
  ['Fatima Al-Sayed', '🇦🇪'], ['Rohan Gupta', '🇮🇳'], ['Ishita Sharma', '🇮🇳'], ['Ava Thompson', '🇺🇸'], ['Vikram Singh', '🇮🇳'],
  ['Kabir Malhotra', '🇮🇳'], ['Mohammed Al-Harbi', '🇸🇦'], ['Diya Patel', '🇮🇳'], ['Maya Goldberg', '🇺🇸'], ['Aditya Verma', '🇮🇳'],
  ['Neha Joshi', '🇮🇳'], ['Rahul Kapoor', '🇮🇳'], ['Tariq Al-Thani', '🇶🇦'], ['Liam Carter', '🇺🇸'], ['Sneha Kulkarni', '🇮🇳'],
  ['Manish Yadav', '🇮🇳'], ['Anjali Desai', '🇮🇳'], ['Olivia Martinez', '🇺🇸'], ['Layla Al-Mansoori', '🇦🇪'], ['Kavya Menon', '🇮🇳'],
  ['Siddharth Rao', '🇮🇳'], ['Pooja Agarwal', '🇮🇳'], ['Noah Bennett', '🇺🇸'], ['Harsh Vardhan', '🇮🇳'], ['Omar Al-Rashid', '🇰🇼'],
  ['Sanjay Pillai', '🇮🇳'], ['Meera Krishnan', '🇮🇳'], ['Emma Rodriguez', '🇺🇸'], ['Arnav Chopra', '🇮🇳'], ['Riya Banerjee', '🇮🇳'],
  ['Noura Al-Qahtani', '🇸🇦'], ['Karan Bhatia', '🇮🇳'], ['James Walker', '🇺🇸'], ['Tanvi Shah', '🇮🇳'], ['Nikhil Saxena', '🇮🇳'],
  ['Shreya Ghosh', '🇮🇳'], ['Khalid Al-Balushi', '🇴🇲'], ['Sophia Turner', '🇺🇸'], ['Yash Thakur', '🇮🇳'], ['Aisha Qureshi', '🇮🇳'],
  ['Dev Malhotra', '🇮🇳'], ['Benjamin Hayes', '🇺🇸'], ['Mariam Al-Khalifa', '🇧🇭'], ['Simran Kaur', '🇮🇳'], ['Varun Nair', '🇮🇳'],
  ['Isha Mishra', '🇮🇳'], ['Isabella Morgan', '🇺🇸'], ['Aryan Tiwari', '🇮🇳'], ['Yousef Al-Otaibi', '🇸🇦'], ['Nandini Rao', '🇮🇳'],
  ['Gaurav Sinha', '🇮🇳'], ['Lucas Reed', '🇺🇸'], ['Pallavi Deshmukh', '🇮🇳'], ['Rajat Arora', '🇮🇳'], ['Hessa Al-Kuwari', '🇶🇦'],
  ['Kriti Jain', '🇮🇳'], ['Mia Collins', '🇺🇸'], ['Amit Chauhan', '🇮🇳'], ['Sakshi Pandey', '🇮🇳'], ['Rohit Shetty', '🇮🇳'],
  ['Saeed Al-Maktoum', '🇦🇪'], ['Henry Foster', '🇺🇸'], ['Divya Menon', '🇮🇳'], ['Harpreet Gill', '🇮🇳'], ['Mohit Bansal', '🇮🇳'],
  ['Charlotte Price', '🇺🇸'], ['Reem Al-Sabah', '🇰🇼'], ['Lakshmi Subramanian', '🇮🇳'], ['Abhishek Dubey', '🇮🇳'], ['Shruti Hegde', '🇮🇳'],
  ['Daniel Russell', '🇺🇸'], ['Vivek Pillai', '🇮🇳'], ['Faisal Al-Shamsi', '🇦🇪'], ['Neelam Rathore', '🇮🇳'], ['Kunal Mehra', '🇮🇳'],
  ['Amelia Ward', '🇺🇸'], ['Bhavna Joshi', '🇮🇳'], ['Suresh Iyer', '🇮🇳'], ['Aisha Al-Hinai', '🇴🇲'], ['Payal Agrawal', '🇮🇳'],
  ['Jackson Hughes', '🇺🇸'], ['Tarun Goyal', '🇮🇳'], ['Ritu Bhardwaj', '🇮🇳'], ['Imran Sheikh', '🇮🇳'], ['Hamad Al-Zayani', '🇧🇭'],
  ['Harper Cole', '🇺🇸'], ['Sonal Kapoor', '🇮🇳'], ['Ajay Rawat', '🇮🇳'], ['Megha Kulkarni', '🇮🇳'], ['Logan Perry', '🇺🇸'],
  ['Evelyn Ross', '🇺🇸'], ['Mason Griffin', '🇺🇸'], ['Abigail Fisher', '🇺🇸'], ['Elijah Murphy', '🇺🇸'], ['Grace Patterson', '🇺🇸'],
];

const PRIZES = [100000, 50000, 10000];
const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=d1fae5,dcfce7,ecfccb,bbf7d0,a7f3d0,f0fdf4`;

/** Deterministic points so the table doesn't reshuffle on every visit. */
function buildBoard() {
  let pts = 148_760;
  return PLAYERS.map(([name, flag], i) => {
    const step = 380 + ((i * 7919) % 900);
    pts -= i === 0 ? 0 : step;
    return { rank: i + 1, name, flag, points: pts, streak: 60 - Math.floor(i / 2) };
  });
}

const fmt = (n: number) => n.toLocaleString('en-IN');
/** ₹1,00,000 → "1 Lakh", ₹50,000 → "50 Thousand". */
const prizeWords = (n: number, tr: (en: string, hi: string) => string) =>
  n >= 100000 ? `${n / 100000} ${tr('Lakh', 'लाख')}` : `${n / 1000} ${tr('Thousand', 'हज़ार')}`;

const TROPHY_COLORS: Record<number, [string, string, string]> = {
  1: ['#fff7cc', '#facc15', '#b45309'], // gold
  2: ['#ffffff', '#cbd5e1', '#64748b'], // silver
  3: ['#ffedd5', '#fb923c', '#9a3412'], // bronze
};

/** Gold / silver / bronze trophy cup. */
const TrophyCup: React.FC<{ place: number; size?: number }> = ({ place, size = 34 }) => {
  const [light, mid, dark] = TROPHY_COLORS[place] || TROPHY_COLORS[1];
  const id = `cup${place}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="drop-shadow-[0_3px_6px_rgba(0,0,0,0.25)]">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <path d="M18 10h28v6h8a2 2 0 0 1 2 2c0 9-6 15-13 16-2 4-5 6-9 7v6h7a3 3 0 0 1 3 3v4H20v-4a3 3 0 0 1 3-3h7v-6c-4-1-7-3-9-7-7-1-13-7-13-16a2 2 0 0 1 2-2h8zm0 10h-6c1 5 4 8 7 9-1-3-1-6-1-9zm28 0c0 3 0 6-1 9 3-1 6-4 7-9z" fill={`url(#${id}g)`} stroke={dark} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M24 14c0 9 2 15 6 18" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.4" strokeLinecap="round" />
      <text x="32" y="27" textAnchor="middle" fontSize="11" fontWeight="900" fill={dark}>{place}</text>
    </svg>
  );
};

interface LeaderboardPageProps {
  tr: (en: string, hi: string) => string;
  userId: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ tr, userId }) => {
  const badges = useBadges(userId);
  const board = useMemo(buildBoard, []);
  const [top3, rest] = [board.slice(0, 3), board.slice(3)];
  return (
    <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-left">
      {/* Hero + podium */}
      <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="lb-hero relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7 text-white">
        <span className="home-hero-blob home-hero-blob-a" aria-hidden="true" />
        <span className="home-hero-blob home-hero-blob-b" aria-hidden="true" />
        <BorderBeam size={120} duration={9} colorFrom="#fde68a" colorTo="#ffffff" borderWidth={2} />
        <div className="flex items-center justify-between gap-2">
          <span className="hero-chip"><Trophy className="w-3.5 h-3.5" />{tr('UrCare Leaderboard', 'UrCare लीडरबोर्ड')}</span>
          <span className="text-[10px] font-bold text-white/70">{tr('Sample rankings', 'नमूना रैंकिंग')}</span>
        </div>
        <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold leading-tight">{tr('Top 100 this season', 'इस सीज़न के टॉप 100')}</h1>
        <p className="mt-1 text-sm text-white/85">{tr('Complete your daily plan to climb. Top 3 win bonus points.', 'डेली प्लान पूरा करें और ऊपर चढ़ें। टॉप 3 को बोनस पॉइंट्स।')}</p>

        <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
          {[top3[1], top3[0], top3[2]].map((p) => {
            const place = p.rank;
            const h = place === 1 ? 'h-32' : place === 2 ? 'h-28' : 'h-24';
            const ring = place === 1 ? 'ring-amber-300' : place === 2 ? 'ring-slate-200' : 'ring-orange-300';
            return (
              <motion.div key={p.rank} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * (place === 1 ? 0 : place), type: 'spring', stiffness: 200, damping: 18 }} className="flex flex-col items-center text-center">
                {place === 1 && <Crown className="w-6 h-6 text-amber-300 mb-1 drop-shadow" />}
                <img src={avatarUrl(p.name)} alt="" className={`rounded-full bg-white ring-4 ${ring} ${place === 1 ? 'w-20 h-20' : 'w-16 h-16'}`} />
                <div className="mt-2 text-[12px] sm:text-sm font-black leading-tight line-clamp-1">{p.flag} {p.name.split(' ')[0]}</div>
                <div className="text-[10px] font-bold text-white/80">{fmt(p.points)} {tr('pts', 'पॉइंट्स')}</div>
                <div className={`podium-step mt-2 w-full ${h} rounded-t-2xl flex flex-col items-center justify-start pt-2`}>
                  <TrophyCup place={place} size={place === 1 ? 40 : 32} />
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-white/95 text-emerald-800 text-[10px] sm:text-xs font-black whitespace-nowrap tabular-nums">₹{fmt(PRIZES[place - 1])}</span>
                  <span className="mt-0.5 text-[9px] sm:text-[10px] font-bold text-white/90 whitespace-nowrap">{prizeWords(PRIZES[place - 1], tr)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Monthly rewards & badges */}
      <section>
        <div className="flex items-center justify-between px-0.5 mb-2">
          <h2 className="flex items-center gap-2 text-sm font-black text-zinc-900"><Crown className="w-4 h-4 text-amber-500" />{tr('Monthly rewards & badges', 'मासिक रिवॉर्ड व बैज')}</h2>
          {badges && <span className="text-[11px] font-black text-amber-700">{badges.filter((b) => b.unlocked).length}/{badges.length} {tr('unlocked', 'मिले')}</span>}
        </div>
        {badges ? <BadgeGrid badges={badges} tr={tr} /> : <div className="h-40 rounded-2xl bg-zinc-100 animate-pulse" />}
      </section>

      {/* Ranks 4–100 */}
      <section>
        <div className="flex items-center justify-between px-0.5 mb-2">
          <h2 className="flex items-center gap-2 text-sm font-black text-zinc-900"><Medal className="w-4 h-4 text-emerald-600" />{tr('Rankings', 'रैंकिंग')}</h2>
          <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1"><Sparkles className="w-3 h-3" />{tr('Sample players', 'नमूना खिलाड़ी')}</span>
        </div>
        <MagicCard className="rounded-2xl shadow-depth" gradientSize={240} gradientColor="#d1fae5" gradientOpacity={0.5} gradientFrom="#10b981" gradientTo="#4ade80">
          <ol className="divide-y divide-zinc-100">
            {rest.map((p) => (
              <li key={p.rank} className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
                <span className="w-7 text-center text-xs font-black text-zinc-400 tabular-nums">{p.rank}</span>
                <img src={avatarUrl(p.name)} alt="" loading="lazy" className="w-10 h-10 rounded-full bg-emerald-50 border border-zinc-100 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-zinc-900 truncate">{p.name} <span className="text-xs">{p.flag}</span></div>
                  <div className="text-[10px] font-semibold text-zinc-400">🔥 {p.streak} {tr('day streak', 'दिन स्ट्रीक')}</div>
                </div>
                <span className="shrink-0 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-black tabular-nums">{fmt(p.points)}</span>
              </li>
            ))}
          </ol>
        </MagicCard>
      </section>
    </main>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="p-2 rounded-xl bg-white border border-emerald-100">
    <div className="text-base font-black text-zinc-900 tabular-nums">{value.toLocaleString('en-IN')}</div>
    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
  </div>
);

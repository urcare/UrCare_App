import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, Medal, Gift, Copy, Check, Share2, Users, Sparkles, ShoppingBag, Link2 } from 'lucide-react';
import { siWhatsapp } from 'simple-icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { getReferralStatus, referralLink, ReferralStatus } from '../utils/supabase';
import { NumberTicker } from './magicui/number-ticker';
import { BorderBeam } from './magicui/border-beam';
import { ShineBorder } from './magicui/shine-border';
import { MagicCard } from './magicui/magic-card';
import { BadgeGrid, useBadges } from './Rewards';

// Sample players from around the world (illustrated avatars, not real people).
const PLAYERS: [string, string][] = [
  ['Aarav Mehta', '🇮🇳'], ['Sofia Rossi', '🇮🇹'], ['Liam Walker', '🇬🇧'], ['Yuki Tanaka', '🇯🇵'], ['Amara Okafor', '🇳🇬'],
  ['Lucas Silva', '🇧🇷'], ['Fatima Al-Sayed', '🇦🇪'], ['Noah Müller', '🇩🇪'], ['Chloé Dubois', '🇫🇷'], ['Mateo García', '🇪🇸'],
  ['Priya Nair', '🇮🇳'], ['Ethan Brooks', '🇺🇸'], ['Mei Lin', '🇨🇳'], ['Omar Haddad', '🇯🇴'], ['Isabella Costa', '🇵🇹'],
  ['Arjun Reddy', '🇮🇳'], ['Hana Kim', '🇰🇷'], ['Oliver Smith', '🇦🇺'], ['Zara Khan', '🇵🇰'], ['Elijah Johnson', '🇨🇦'],
  ['Ana Popescu', '🇷🇴'], ['Kofi Mensah', '🇬🇭'], ['Emma Jansen', '🇳🇱'], ['Diego Hernández', '🇲🇽'], ['Aisha Rahman', '🇧🇩'],
  ['Rohan Gupta', '🇮🇳'], ['Freya Larsen', '🇩🇰'], ['Mohammed Ali', '🇸🇦'], ['Valentina López', '🇦🇷'], ['Kenji Sato', '🇯🇵'],
  ['Ishita Sharma', '🇮🇳'], ['William Chen', '🇸🇬'], ['Nadia Petrova', '🇧🇬'], ['Samuel Adeyemi', '🇳🇬'], ['Lea Schmidt', '🇦🇹'],
  ['Vikram Singh', '🇮🇳'], ['Mia Andersson', '🇸🇪'], ['Hamza Yilmaz', '🇹🇷'], ['Camila Rojas', '🇨🇱'], ['Daniel Cohen', '🇮🇱'],
  ['Ananya Iyer', '🇮🇳'], ['Lukas Novák', '🇨🇿'], ['Grace Wanjiru', '🇰🇪'], ['Thiago Pereira', '🇧🇷'], ['Sara Lindqvist', '🇫🇮'],
  ['Kabir Malhotra', '🇮🇳'], ['Nora Hansen', '🇳🇴'], ['Ali Hosseini', '🇮🇷'], ['Lucía Fernández', '🇺🇾'], ['Jack Murphy', '🇮🇪'],
  ['Diya Patel', '🇮🇳'], ['Minh Nguyen', '🇻🇳'], ['Olga Ivanova', '🇺🇦'], ['Tunde Bakare', '🇳🇬'], ['Julia Kowalska', '🇵🇱'],
  ['Aditya Verma', '🇮🇳'], ['Siti Rahmah', '🇲🇾'], ['George Papadopoulos', '🇬🇷'], ['Carlos Mendoza', '🇵🇪'], ['Amelia Wilson', '🇳🇿'],
  ['Neha Joshi', '🇮🇳'], ['Arif Hakim', '🇮🇩'], ['Elena Morales', '🇨🇴'], ['Youssef Benali', '🇲🇦'], ['Ingrid Berg', '🇳🇴'],
  ['Rahul Kapoor', '🇮🇳'], ['Chen Wei', '🇹🇼'], ['Ava Thompson', '🇺🇸'], ['Kwame Asante', '🇬🇭'], ['Marta Nowak', '🇵🇱'],
  ['Sneha Kulkarni', '🇮🇳'], ['Takeshi Mori', '🇯🇵'], ['Layla Hassan', '🇪🇬'], ['Felipe Souza', '🇧🇷'], ['Hannah Weber', '🇨🇭'],
  ['Manish Yadav', '🇮🇳'], ['Anjali Desai', '🇮🇳'], ['Ravi Shankar', '🇳🇵'], ['Tariq Aziz', '🇶🇦'], ['Sophie Martin', '🇧🇪'],
  ['Kavya Menon', '🇮🇳'], ['Juan Pablo Ruiz', '🇪🇨'], ['Ngozi Eze', '🇳🇬'], ['Erik Johansson', '🇸🇪'], ['Leila Farah', '🇱🇧'],
  ['Siddharth Rao', '🇮🇳'], ['Maya Goldberg', '🇺🇸'], ['Joon-ho Park', '🇰🇷'], ['Paula Gómez', '🇪🇸'], ['Benjamin Lee', '🇨🇦'],
  ['Pooja Agarwal', '🇮🇳'], ['Abdul Karim', '🇧🇩'], ['Chiara Bianchi', '🇮🇹'], ['Daniel Osei', '🇬🇭'], ['Lina Svensson', '🇸🇪'],
  ['Harsh Vardhan', '🇮🇳'], ['Mariam Siddiqui', '🇵🇰'], ['Tomás Navarro', '🇦🇷'], ['Ella Fischer', '🇩🇪'], ['Sanjay Pillai', '🇱🇰'],
];

const PRIZES = [100000, 50000, 10000];
const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=d1fae5,ccfbf1,e0f2fe,fef3c7,fce7f3,ede9fe`;

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

interface LeaderboardPageProps {
  tr: (en: string, hi: string) => string;
  userId: string;
  onOpenStore: () => void;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ tr, userId, onOpenStore }) => {
  const badges = useBadges(userId);
  const board = useMemo(buildBoard, []);
  const [top3, rest] = [board.slice(0, 3), board.slice(3)];
  const [referral, setReferral] = useState<ReferralStatus | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { getReferralStatus().then(setReferral); }, []);

  const link = referral ? referralLink(referral.code) : '';
  const perReward = referral?.perReward || 5;
  const towardsNext = referral ? referral.joined % perReward : 0;
  const message = tr(
    `I'm reversing my health with UrCare — doctor-guided plans, food scan and more. Join me with my link: ${link}`,
    `मैं UrCare से अपनी सेहत सुधार रहा/रही हूँ — डॉक्टर-गाइडेड प्लान, फूड स्कैन और भी बहुत कुछ। मेरे लिंक से जुड़ें: ${link}`,
  );
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch {}
  };
  const shareLink = async () => {
    try {
      if (Capacitor.isNativePlatform()) { await Share.share({ title: 'UrCare', text: message, dialogTitle: tr('Invite friends', 'दोस्तों को बुलाएं') }); return; }
      if (navigator.share) { await navigator.share({ title: 'UrCare', text: message }); return; }
    } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };

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
            const h = place === 1 ? 'h-28' : place === 2 ? 'h-20' : 'h-16';
            const ring = place === 1 ? 'ring-amber-300' : place === 2 ? 'ring-slate-200' : 'ring-orange-300';
            return (
              <motion.div key={p.rank} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * (place === 1 ? 0 : place), type: 'spring', stiffness: 200, damping: 18 }} className="flex flex-col items-center text-center">
                {place === 1 && <Crown className="w-6 h-6 text-amber-300 mb-1 drop-shadow" />}
                <img src={avatarUrl(p.name)} alt="" className={`rounded-full bg-white ring-4 ${ring} ${place === 1 ? 'w-20 h-20' : 'w-16 h-16'}`} />
                <div className="mt-2 text-[12px] sm:text-sm font-black leading-tight line-clamp-1">{p.flag} {p.name.split(' ')[0]}</div>
                <div className="text-[10px] font-bold text-white/80">{fmt(p.points)} {tr('pts', 'पॉइंट्स')}</div>
                <div className={`podium-step mt-2 w-full ${h} rounded-t-2xl flex flex-col items-center justify-start pt-2`}>
                  <span className="text-2xl font-black">{place}</span>
                  <span className="mt-0.5 px-2 py-0.5 rounded-full bg-white/90 text-emerald-800 text-[9px] sm:text-[10px] font-black whitespace-nowrap">🏆 {fmt(PRIZES[place - 1])}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Referral & rewards */}
      <section className="relative rounded-[1.5rem] bg-white border border-violet-200 shadow-depth overflow-hidden">
        <ShineBorder borderWidth={2} duration={11} shineColor={['#a78bfa', '#f472b6', '#fde68a']} />
        <div className="p-5 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-wider"><Gift className="w-3.5 h-3.5" />{tr('Refer & earn', 'रेफ़र करें, कमाएं')}</span>
              <h2 className="mt-2 text-lg font-black text-zinc-900 leading-snug">{tr(`Invite ${perReward} friends, get 500 points`, `${perReward} दोस्तों को बुलाएं, 500 पॉइंट्स पाएं`)}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{tr('500 points = ₹500 off in UrCare Medical Pharmacy', '500 पॉइंट्स = UrCare मेडिकल फ़ार्मेसी में ₹500 की छूट')}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-violet-600">{tr('Your points', 'आपके पॉइंट्स')}</div>
              <div className="font-display text-3xl font-bold text-violet-700 leading-none mt-1">
                <NumberTicker value={referral?.balance || 0} className="text-violet-700 tracking-normal" />
              </div>
              <div className="text-[10px] font-bold text-zinc-400 mt-1">≈ ₹{fmt(referral?.balance || 0)}</div>
            </div>
          </div>

          {/* progress to the next reward */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{tr(`${towardsNext} of ${perReward} friends joined`, `${perReward} में से ${towardsNext} दोस्त जुड़े`)}</span>
              <span className="text-violet-700">{tr(`${perReward - towardsNext} more for +500`, `+500 के लिए ${perReward - towardsNext} और`)}</span>
            </div>
            <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${perReward}, minmax(0, 1fr))` }}>
              {Array.from({ length: perReward }, (_, i) => (
                <motion.span key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.1 * i }} className={`h-2.5 rounded-full origin-left ${i < towardsNext ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'bg-violet-100'}`} />
              ))}
            </div>
            {referral && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label={tr('Friends joined', 'जुड़े दोस्त')} value={referral.joined} />
                <Stat label={tr('Points earned', 'कमाए पॉइंट्स')} value={referral.earned} />
                <Stat label={tr('Points used', 'इस्तेमाल पॉइंट्स')} value={referral.spent} />
              </div>
            )}
          </div>

          {/* link */}
          <div className="mt-4 flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-white border border-violet-200">
            <Link2 className="w-4 h-4 text-violet-500 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-xs font-bold text-zinc-700">{link || tr('Loading your link…', 'आपका लिंक आ रहा है…')}</span>
            <button type="button" onClick={copy} disabled={!link} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-violet-600 text-white text-[11px] font-black cursor-pointer disabled:opacity-50">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? tr('Copied', 'कॉपी') : tr('Copy', 'कॉपी')}
            </button>
          </div>
          {referral && <div className="mt-1.5 text-[10px] font-bold text-zinc-400">{tr('Your code', 'आपका कोड')}: <span className="font-mono text-violet-700">{referral.code}</span></div>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')} disabled={!link} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-black cursor-pointer disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true"><path d={siWhatsapp.path} /></svg>WhatsApp
            </button>
            <button type="button" onClick={shareLink} disabled={!link} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-black cursor-pointer disabled:opacity-50">
              <Share2 className="w-4 h-4" />{tr('More apps', 'और ऐप्स')}
            </button>
          </div>
          {(referral?.balance || 0) >= (referral?.block || 100) && (
            <button type="button" onClick={onOpenStore} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-violet-300 text-violet-700 text-xs font-black cursor-pointer hover:bg-violet-50">
              <ShoppingBag className="w-4 h-4" />{tr('Use my points in the Pharmacy', 'फ़ार्मेसी में पॉइंट्स इस्तेमाल करें')}
            </button>
          )}
          <ol className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              [tr('Share your link', 'लिंक शेयर करें'), '1'],
              [tr(`${perReward} friends join`, `${perReward} दोस्त जुड़ें`), '2'],
              [tr('Get ₹500 off', '₹500 की छूट'), '3'],
            ].map(([label, n]) => (
              <li key={n} className="p-2 rounded-xl bg-white/80 border border-violet-100">
                <span className="mx-auto w-6 h-6 rounded-full bg-violet-600 text-white text-[11px] font-black flex items-center justify-center">{n}</span>
                <span className="mt-1 block text-[10px] font-bold text-zinc-600 leading-tight">{label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

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
        <MagicCard className="rounded-2xl shadow-depth" gradientSize={240} gradientColor="#d1fae5" gradientOpacity={0.5} gradientFrom="#10b981" gradientTo="#22d3ee">
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
  <div className="p-2 rounded-xl bg-white border border-violet-100">
    <div className="text-base font-black text-zinc-900 tabular-nums">{value.toLocaleString('en-IN')}</div>
    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
  </div>
);

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lottie as DotLottieReact } from './Lottie';
import confetti from 'canvas-confetti';
import { X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// UrCare Buddy animations from LottieFiles (Lottie Simple License):
// "cute girl smiling", "Girl giving thumbs up" and "Walking girl" by Pyoconosuke.
const SMILE = '/lottie/buddy/girl-smile.lottie';
const THUMBS = '/lottie/buddy-thumbs-up.lottie';
const WALK = '/lottie/buddy/girl-walk.lottie';

export type BuddyMood = 'happy' | 'sad' | 'wave';
const EVENT = 'urcare:buddy';
const HIDE_KEY = 'urcare_buddy_hidden';

/** Anywhere in the app: make the Buddy react, optionally with a line to say. */
export function buddyReact(mood: BuddyMood, say?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { mood, say } }));
}

const TIPS: [string, string][] = [
  ['A 10-minute walk after meals lowers sugar spikes.', 'खाने के बाद 10 मिनट टहलने से शुगर कम बढ़ती है।'],
  ['Drink a glass of water now 💧', 'अभी एक गिलास पानी पी लो 💧'],
  ['Eat salad and dal first, roti and rice last.', 'पहले सलाद और दाल, रोटी-चावल आख़िर में।'],
  ['7–8 hours of sleep helps insulin work better.', '7–8 घंटे की नींद से इंसुलिन बेहतर काम करता है।'],
  ['Small steps every day — you are doing great!', 'हर दिन छोटे कदम — आप बहुत अच्छा कर रहे हो!'],
  ['Take 5 slow, deep breaths to calm stress.', 'तनाव कम करने के लिए 5 धीमी गहरी सांसें लो।'],
];
const PAGE_LINES: Record<string, [string, string]> = {
  profile: ['Welcome back! Let’s finish today’s plan 🌱', 'वापस आने पर स्वागत! आज का प्लान पूरा करें 🌱'],
  plan: ['Tick each step when it’s time ✅', 'समय आने पर हर स्टेप पर टिक करें ✅'],
  tracker: ['Add this week’s readings 📈', 'इस हफ़्ते की रीडिंग जोड़ें 📈'],
  reports: ['Upload a new report to see your progress 📄', 'प्रगति देखने के लिए नई रिपोर्ट अपलोड करें 📄'],
  premium: ['Scan your plate before you eat 🍽️', 'खाने से पहले अपनी प्लेट स्कैन करें 🍽️'],
  store: ['Your reversal kits are here 🛍️', 'आपकी रिवर्सल किट्स यहां हैं 🛍️'],
  family: ['Add family and cheer each other on 👨‍👩‍👧', 'परिवार को जोड़ें और एक-दूसरे का हौसला बढ़ाएं 👨‍👩‍👧'],
  leaderboard: ['Keep your streak going 🔥', 'अपनी स्ट्रीक बनाए रखें 🔥'],
  account: ['Keep your profile up to date 👤', 'अपनी प्रोफ़ाइल अपडेट रखें 👤'],
};

const SIZE = 84;
const SPEED = 160; // px per second while walking

/** The UrCare Buddy: lives at the bottom of every screen, walks to where you
 *  tap or to a new spot when you change page, cheers with a thumbs-up when
 *  something good happens and looks down when the tracker shows trouble. */
export const BuddyCompanion: React.FC<{ page: string }> = ({ page }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });
  const [x, setX] = useState(() => Math.max(8, window.innerWidth - SIZE - 16));
  const [walking, setWalking] = useState<{ ms: number; left: boolean } | null>(null);
  const [mood, setMood] = useState<BuddyMood | 'idle'>('wave');
  const [line, setLine] = useState<string | null>(null);
  const moodTimer = useRef<number | undefined>(undefined);
  const lineTimer = useRef<number | undefined>(undefined);
  const walkTimer = useRef<number | undefined>(undefined);
  const xRef = useRef(x);
  xRef.current = x;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const say = useCallback((text: string, ms = 3800) => {
    setLine(text);
    window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), ms);
  }, []);

  const react = useCallback((m: BuddyMood, ms = 3200) => {
    setMood(m);
    window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood('idle'), ms);
  }, []);

  const walkTo = useCallback((target: number) => {
    const max = window.innerWidth - SIZE - 8;
    const to = Math.max(8, Math.min(max, target - SIZE / 2));
    const dist = Math.abs(to - xRef.current);
    if (dist < 12) return;
    const ms = reduced ? 0 : Math.min(2600, (dist / SPEED) * 1000);
    setWalking({ ms, left: to < xRef.current });
    setX(to);
    window.clearTimeout(walkTimer.current);
    walkTimer.current = window.setTimeout(() => setWalking(null), ms);
  }, [reduced]);

  // Walk toward wherever the person taps (not on the Buddy itself).
  useEffect(() => {
    if (hidden) return;
    let last = 0;
    const onTap = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.urcare-buddy')) return;
      const now = Date.now();
      if (now - last < 900) return;
      last = now;
      walkTo(e.clientX);
    };
    window.addEventListener('pointerdown', onTap, { passive: true });
    return () => window.removeEventListener('pointerdown', onTap);
  }, [hidden, walkTo]);

  // Moods from anywhere in the app.
  useEffect(() => {
    const onEvent = (e: Event) => {
      const { mood: m, say: text } = (e as CustomEvent).detail || {};
      if (!m) return;
      react(m, m === 'sad' ? 6000 : 3400);
      if (text) say(text, m === 'sad' ? 6000 : 3800);
      if (m === 'happy' && !reduced && !hidden) {
        const r = document.querySelector('.urcare-buddy')?.getBoundingClientRect();
        if (r) confetti({ particleCount: 40, spread: 60, startVelocity: 26, origin: { x: (r.left + r.width / 2) / window.innerWidth, y: r.top / window.innerHeight }, scalar: 0.7, disableForReducedMotion: true });
      }
    };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, [react, say, reduced, hidden]);

  // New page: stroll to a new spot and say something about it.
  useEffect(() => {
    if (hidden) return;
    const w = window.innerWidth;
    walkTo(w * (0.25 + Math.random() * 0.6));
    const l = PAGE_LINES[page];
    if (l) window.setTimeout(() => say(tr(...l)), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, hidden]);

  // Keep on screen when the window resizes.
  useEffect(() => {
    const onResize = () => setX((v) => Math.min(v, window.innerWidth - SIZE - 8));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => () => { window.clearTimeout(moodTimer.current); window.clearTimeout(lineTimer.current); window.clearTimeout(walkTimer.current); }, []);

  const hide = () => { setHidden(true); try { localStorage.setItem(HIDE_KEY, '1'); } catch {} };
  if (hidden) return null;

  const onBuddyTap = () => {
    react('wave', 2600);
    const t = TIPS[Math.floor(Math.random() * TIPS.length)];
    say(tr(...t));
  };

  const src = walking ? WALK : mood === 'happy' ? THUMBS : SMILE;
  const bubbleOnLeft = x > window.innerWidth / 2;

  return (
    <div
      className="urcare-buddy fixed z-40 pointer-events-none"
      style={{ left: 0, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)', transform: `translate3d(${x}px, 0, 0)`, transition: walking ? `transform ${walking.ms}ms linear` : 'transform 300ms ease-out', width: SIZE, height: SIZE }}
    >
      <AnimatePresence>
        {line && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }}
            className={`absolute bottom-full mb-1 w-56 pointer-events-auto rounded-2xl bg-white border border-emerald-100 shadow-lg px-3 py-2 text-[12px] font-bold text-zinc-800 ${bubbleOnLeft ? 'right-2' : 'left-2'}`}
          >
            {line}
            <button type="button" onClick={hide} className="ml-1 inline-flex align-middle text-zinc-300 hover:text-zinc-500 cursor-pointer" aria-label={tr('Hide UrCare Buddy', 'UrCare Buddy छुपाएं')} title={tr('Hide Buddy', 'Buddy छुपाएं')}>
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={onBuddyTap}
        aria-label={tr('UrCare Buddy — tap for a tip', 'UrCare Buddy — टिप के लिए टैप करें')}
        className={`buddy-body relative w-full h-full pointer-events-auto cursor-pointer ${mood === 'sad' && !walking ? 'is-sad' : ''} ${!walking && mood === 'idle' ? 'is-idle' : ''}`}
        style={{ transform: walking?.left ? 'scaleX(-1)' : undefined }}
      >
        <span className="buddy-shadow" aria-hidden="true" />
        <DotLottieReact key={src} src={src} autoplay loop style={{ width: '100%', height: '100%' }} />
      </button>
    </div>
  );
};

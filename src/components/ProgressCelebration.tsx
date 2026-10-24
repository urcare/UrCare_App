import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import confetti from 'canvas-confetti';
import { Share2, X, Check, Eye } from 'lucide-react';
import { getFamily, setFamilyShareProgress } from '../utils/supabase';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Animations from LottieFiles (Lottie Simple License — free for commercial use).
const BUDDY_THUMBS_UP = '/lottie/buddy-thumbs-up.lottie';
const BUDDY_CLAP = '/lottie/buddy-cheer.lottie';

export type BuddyMood = 'start' | 'going' | 'almost' | 'done';
export const buddyMood = (pct: number): BuddyMood => (pct >= 100 ? 'done' : pct >= 90 ? 'almost' : pct >= 50 ? 'going' : 'start');

/** The UrCare Buddy — smiles while you work through the day, then winks
 *  and gives a thumbs-up (with clapping) once the day is done. */
export const UrCareBuddy: React.FC<{ pct: number; size?: number }> = ({ pct, size = 140 }) => {
  const mood = buddyMood(pct);
  const celebrate = mood === 'almost' || mood === 'done';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <DotLottieReact
        key={mood}
        src={BUDDY_THUMBS_UP}
        autoplay={celebrate}
        loop={mood === 'done'}
        speed={mood === 'done' ? 1 : 0.8}
        style={{ width: size, height: size }}
      />
      {mood === 'done' && (
        <div className="absolute -right-3 -bottom-2" style={{ width: size * 0.45, height: size * 0.45 }}>
          <DotLottieReact src={BUDDY_CLAP} autoplay loop style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </div>
  );
};

export function progressMessage(pct: number, tr: (en: string, hi: string) => string): { title: string; body: string } {
  if (pct >= 100) return { title: tr('Day complete! 🎉', 'आज का दिन पूरा! 🎉'), body: tr('You did every step today. You are 1% better every day.', 'आपने आज हर कदम पूरा किया। आप हर दिन 1% बेहतर हो रहे हैं।') };
  if (pct >= 90) return { title: tr('Almost there! 💪', 'बस थोड़ा और! 💪'), body: tr(`${pct}% done — finish strong, one more step.`, `${pct}% हो गया — एक और कदम, शानदार खत्म करें।`) };
  if (pct >= 50) return { title: tr('Halfway there! 🌱', 'आधा रास्ता पूरा! 🌱'), body: tr(`${pct}% of today's plan done. Keep the rhythm going.`, `आज के प्लान का ${pct}% पूरा। ऐसे ही लगे रहें।`) };
  return { title: tr('Great start!', 'बढ़िया शुरुआत!'), body: tr('Every step counts. Small changes, big results.', 'हर कदम मायने रखता है। छोटे बदलाव, बड़े नतीजे।') };
}

/** A 1080×1920 story-sized image of today's progress — for WhatsApp Status,
 *  Instagram Stories or any app. */
async function renderProgressStory(pct: number, name: string, message: string): Promise<Blob | null> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const font = (w: number, s: number) => `${w} ${s}px Inter, "Segoe UI", Roboto, system-ui, sans-serif`;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#064e3b'); bg.addColorStop(0.5, '#047857'); bg.addColorStop(1, '#047857');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  [[150, 260, 260], [950, 420, 220], [880, 1600, 320], [120, 1500, 180]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(900, 72); ctx.fillText('UrCare', W / 2, 220);
  ctx.font = font(600, 36); ctx.globalAlpha = 0.85; ctx.fillText(name ? `${name}'s day` : "Today's progress", W / 2, 285); ctx.globalAlpha = 1;
  // ring
  const cx = W / 2, cy = 820, r = 300;
  ctx.lineWidth = 56; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#fde68a'; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(1, pct)) / 100); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = font(900, 200); ctx.fillText(`${pct}%`, cx, cy + 70);
  ctx.font = font(700, 40); ctx.globalAlpha = 0.85; ctx.fillText("of today's health plan", cx, cy + 140); ctx.globalAlpha = 1;
  // message
  ctx.font = font(800, 58);
  const words = message.split(' ');
  let line = ''; let y = 1330;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 160 && line) { ctx.fillText(line, W / 2, y); line = w; y += 76; } else line = test;
  }
  if (line) ctx.fillText(line, W / 2, y);
  ctx.font = font(800, 46); ctx.fillStyle = '#fde68a';
  ctx.fillText('1% better every day', W / 2, y + 120);
  ctx.font = font(600, 32); ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('urcare.org', W / 2, H - 120);
  return await new Promise((res) => c.toBlob(res, 'image/png'));
}

/** Shares today's progress as a story image through any app. */
export async function shareProgressStory(pct: number, name: string, message: string, tr: (en: string, hi: string) => string): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await renderProgressStory(pct, name, message);
  if (!blob) return 'failed';
  const text = tr(`I completed ${pct}% of today's UrCare health plan! 1% better every day 💪`, `मैंने आज UrCare हेल्थ प्लान का ${pct}% पूरा किया! हर दिन 1% बेहतर 💪`);
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share') && Capacitor.isPluginAvailable('Filesystem')) {
      const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
      const { uri } = await Filesystem.writeFile({ path: 'urcare-progress.png', data: base64, directory: Directory.Cache });
      await Share.share({ text, files: [uri], dialogTitle: tr('Share to your status', 'अपने स्टेटस पर शेयर करें') });
      return 'shared';
    }
    const file = new File([blob], 'urcare-progress.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  } catch (e: any) {
    if (e?.name === 'AbortError' || /cancel/i.test(String(e?.message))) return 'shared';
  }
  // No share sheet (desktop) — save the image instead.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'urcare-progress.png';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

interface ProgressCelebrationProps {
  pct: number;
  done: number;
  total: number;
  name: string;
  onClose: () => void;
  tr: (en: string, hi: string) => string;
}

/** The pop-up shown when today's plan crosses 50%, 90% and 100%. */
export const ProgressCelebration: React.FC<ProgressCelebrationProps> = ({ pct, done, total, name, onClose, tr }) => {
  const msg = useMemo(() => progressMessage(pct, tr), [pct, tr]);
  const [sharing, setSharing] = useState(false);
  // Is this progress already showing on the member's in-app family status?
  const [familyShare, setFamilyShare] = useState<boolean | null>(null);
  React.useEffect(() => { getFamily().then((s) => setFamilyShare(s ? s.shareProgress : null)); }, []);
  React.useEffect(() => {
    if (pct >= 100) {
      try { confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#10b981', '#fde68a', '#4ade80', '#ffffff'] }); } catch {}
    }
  }, [pct]);
  const r = 34, c = 2 * Math.PI * r;
  return createPortal(
    <AnimatePresence>
      <motion.div key="bg" className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <div key="card" className="fixed inset-0 z-[71] flex items-center justify-center p-5 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="pointer-events-auto relative w-full max-w-sm rounded-[1.75rem] bg-white shadow-2xl overflow-hidden text-center"
        >
          <button type="button" onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/5 hover:bg-black/10 cursor-pointer"><X className="w-4 h-4 text-zinc-600" /></button>
          <div className="pt-6 pb-3 bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center">
            <UrCareBuddy pct={pct} size={150} />
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-center justify-center gap-3">
              <span className="relative w-20 h-20">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r={r} fill="none" stroke="#e4e4e7" strokeWidth="8" />
                  <motion.circle cx="40" cy="40" r={r} fill="none" stroke="url(#celebGrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 1.1, ease: 'easeOut' }} />
                  <defs><linearGradient id="celebGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#16a34a" /></linearGradient></defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-emerald-700">{pct}%</span>
              </span>
              <div className="text-left">
                <div className="text-lg font-black text-zinc-900 leading-tight">{msg.title}</div>
                <div className="text-[11px] font-bold text-zinc-400">{tr(`${done} of ${total} steps today`, `आज ${total} में से ${done} कदम`)}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{msg.body}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="py-3 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-700 cursor-pointer">{tr('Continue', 'आगे बढ़ें')}</button>
              <button
                type="button"
                disabled={sharing}
                onClick={async () => { setSharing(true); await shareProgressStory(pct, name, msg.body, tr); setSharing(false); }}
                className="py-3 rounded-2xl bg-brand-gradient text-white text-sm font-black cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Share2 className="w-4 h-4" />{tr('Share status', 'स्टेटस शेयर')}
              </button>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-zinc-400">{tr('WhatsApp Status, Instagram Story or any app', 'WhatsApp स्टेटस, Instagram स्टोरी या कोई भी ऐप')}</p>
            {familyShare !== null && (
              familyShare ? (
                <p className="mt-3 text-[11px] font-black text-emerald-700 flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" />{tr('Posted to your in-app status for your family', 'परिवार के लिए आपके ऐप स्टेटस पर लग गया')}</p>
              ) : (
                <button type="button" onClick={async () => { setFamilyShare(true); await setFamilyShareProgress(true); window.dispatchEvent(new Event('urcare:family-status-changed')); }} className="mt-3 w-full py-2.5 rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-700 text-xs font-black cursor-pointer flex items-center justify-center gap-1.5">
                  <Eye className="w-4 h-4" />{tr('Show my status to my family & friends', 'मेरा स्टेटस परिवार व दोस्तों को दिखाएं')}
                </button>
              )
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
};

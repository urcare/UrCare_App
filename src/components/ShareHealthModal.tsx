import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { siWhatsapp, siTelegram, siFacebook } from 'simple-icons';
import { X, Share2, Copy, Check, Download, MessageSquare, Mail, ShieldAlert } from 'lucide-react';
import { UserHealthProfile, Prescription, MedicalReportAnalysis } from '../types';
import { computeHealthOverview } from './HealthOverviewCard';
import { ShineBorder } from './magicui/shine-border';

type SectionKey = 'basics' | 'conditions' | 'score' | 'medicines' | 'report';

/** QR codes hold at most ~2.9 KB; keep the text comfortably under that. */
const MAX_QR_BYTES = 2200;
const byteLength = (s: string) => new TextEncoder().encode(s).length;

interface ShareHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  displayName: string;
  prescriptions: Prescription[];
  reports: MedicalReportAnalysis[];
  tr: (en: string, hi: string) => string;
}

/** Builds the plain-text health summary that goes into both the QR code and
 *  the message — the same words either way, so scanning the QR gives exactly
 *  what's written under it. */
function buildSummary(
  sections: Record<SectionKey, boolean>,
  { profile, displayName, prescriptions, reports }: Pick<ShareHealthModalProps, 'profile' | 'displayName' | 'prescriptions' | 'reports'>,
  tr: ShareHealthModalProps['tr'],
): string {
  const lines: string[] = [tr('UrCare Health Summary', 'UrCare हेल्थ सारांश')];
  if (sections.basics) {
    const bits = [displayName, profile.age ? tr(`Age ${profile.age}`, `उम्र ${profile.age}`) : '', profile.gender ? String(profile.gender) : ''].filter(Boolean);
    if (bits.length) lines.push(bits.join(' | '));
    const body = [profile.heightCm ? `${profile.heightCm} cm` : '', profile.currentWeightKg ? `${profile.currentWeightKg} kg` : ''].filter(Boolean);
    if (body.length) lines.push(tr('Height/Weight: ', 'लंबाई/वज़न: ') + body.join(', '));
  }
  if (sections.conditions) {
    const conds = (profile.medicalConditions || []).filter((c) => c && c !== 'None');
    lines.push(tr('Conditions: ', 'बीमारियाँ: ') + (conds.length ? conds.join(', ') : tr('None reported', 'कोई नहीं')));
  }
  if (sections.score) {
    const o = computeHealthOverview(profile);
    if (o) {
      lines.push(tr(`Health score: ${o.score}/100 (from Root Cause Analysis)`, `हेल्थ स्कोर: ${o.score}/100 (रूट कॉज़ एनालिसिस से)`));
      if (o.biologicalAge && o.actualAge) lines.push(tr(`Estimated biological age: ${o.biologicalAge} (actual ${o.actualAge})`, `अनुमानित बायोलॉजिकल उम्र: ${o.biologicalAge} (असली ${o.actualAge})`));
    }
  }
  if (sections.medicines) {
    const meds = prescriptions.flatMap((p) => p.medicines || []).slice(0, 8);
    if (meds.length) {
      lines.push(tr('Medicines:', 'दवाइयाँ:'));
      meds.forEach((m) => lines.push(`- ${[m.name, m.dosage, m.frequency].filter(Boolean).join(' · ')}`));
    }
  }
  if (sections.report) {
    const latest = [...reports].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))[0];
    if (latest) {
      const date = latest.uploadedAt ? new Date(latest.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      lines.push(tr(`Latest report: ${latest.reportName}${date ? ` (${date})` : ''}`, `ताज़ा रिपोर्ट: ${latest.reportName}${date ? ` (${date})` : ''}`));
      const flagged = (latest.biomarkers || []).filter((b) => b.status !== 'normal').slice(0, 8);
      flagged.forEach((b) => lines.push(`- ${b.name}: ${b.value} (${b.status})`));
      if (!flagged.length) lines.push(tr('- All listed values in range', '- सभी वैल्यू रेंज में'));
    }
  }
  lines.push(tr('Shared from the UrCare app — not a prescription.', 'UrCare ऐप से साझा — यह पर्चा नहीं है।'));

  // Trim from the end of the body until it fits in a QR code.
  let text = lines.join('\n');
  while (byteLength(text) > MAX_QR_BYTES && lines.length > 3) {
    lines.splice(lines.length - 2, 1);
    text = lines.join('\n');
  }
  return text;
}

/** Draws the share card (QR on top, the same text below) to a PNG. */
async function renderCardPng(qrDataUrl: string, text: string): Promise<Blob | null> {
  const W = 1080, pad = 72, qrSize = 560;
  const ctx0 = document.createElement('canvas').getContext('2d');
  if (!ctx0) return null;
  ctx0.font = '500 34px Inter, system-ui, sans-serif';
  // Wrap each line to the card width.
  const wrapped: string[] = [];
  for (const raw of text.split('\n').slice(1)) {
    let line = '';
    for (const word of raw.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx0.measureText(test).width > W - pad * 2 && line) { wrapped.push(line); line = word; } else line = test;
    }
    wrapped.push(line);
  }
  const lineH = 48;
  const H = 210 + qrSize + 80 + wrapped.length * lineH + 110;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const bg = ctx.createLinearGradient(0, 0, W, 240);
  bg.addColorStop(0, '#047857'); bg.addColorStop(1, '#0d9488');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 170);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px Inter, system-ui, sans-serif';
  ctx.fillText('UrCare', pad, 100);
  ctx.font = '600 30px Inter, system-ui, sans-serif';
  ctx.globalAlpha = 0.85; ctx.fillText(text.split('\n')[0], pad, 142); ctx.globalAlpha = 1;

  const qr = new Image();
  await new Promise<void>((res, rej) => { qr.onload = () => res(); qr.onerror = () => rej(); qr.src = qrDataUrl; });
  const qx = (W - qrSize) / 2, qy = 210;
  ctx.fillStyle = '#f0fdf4';
  ctx.beginPath(); ctx.roundRect(qx - 24, qy - 24, qrSize + 48, qrSize + 48, 32); ctx.fill();
  ctx.drawImage(qr, qx, qy, qrSize, qrSize);

  ctx.fillStyle = '#18181b';
  ctx.font = '500 34px Inter, system-ui, sans-serif';
  let y = qy + qrSize + 100;
  for (const l of wrapped) { ctx.fillText(l, pad, y); y += lineH; }
  ctx.fillStyle = '#71717a';
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.fillText('Scan the QR code to read this summary', pad, H - 50);
  return await new Promise((res) => canvas.toBlob(res, 'image/png'));
}

const BrandIcon: React.FC<{ icon: { path: string }; className?: string }> = ({ icon, className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d={icon.path} /></svg>
);

/** "Share my health data" — the user picks what to include; it becomes one
 *  QR code plus the same text, shared through any app. Nothing is uploaded:
 *  the QR holds the text itself. */
export const ShareHealthModal: React.FC<ShareHealthModalProps> = ({ isOpen, onClose, profile, displayName, prescriptions, reports, tr }) => {
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ basics: true, conditions: true, score: true, medicines: true, report: true });
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const text = useMemo(
    () => buildSummary(sections, { profile, displayName, prescriptions, reports }, tr),
    [sections, profile, displayName, prescriptions, reports, tr],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    QRCode.toDataURL(text, { errorCorrectionLevel: 'L', margin: 1, width: 600, color: { dark: '#064e3b', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(''); });
    return () => { cancelled = true; };
  }, [text, isOpen]);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 2200); };
  const copyText = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); return true; } catch { return false; }
  };
  const open = (url: string) => { window.open(url, '_blank', 'noopener'); };
  const enc = encodeURIComponent(text);

  const shareNative = async () => {
    const blob = qr ? await renderCardPng(qr, text) : null;
    const file = blob ? new File([blob], 'urcare-health-summary.png', { type: 'image/png' }) : null;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: 'UrCare Health Summary' });
        return;
      }
      if (navigator.share) { await navigator.share({ text, title: 'UrCare Health Summary' }); return; }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
    // No share sheet here (e.g. the Android app's WebView) — fall back to WhatsApp.
    open(`https://wa.me/?text=${enc}`);
  };
  const downloadImage = async () => {
    const blob = qr ? await renderCardPng(qr, text) : null;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'urcare-health-summary.png'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const channels: { key: string; label: string; bg: string; icon: React.ReactNode; onClick: () => void }[] = [
    { key: 'wa', label: 'WhatsApp', bg: '#25D366', icon: <BrandIcon icon={siWhatsapp} className="w-6 h-6" />, onClick: () => open(`https://wa.me/?text=${enc}`) },
    { key: 'tg', label: 'Telegram', bg: '#26A5E4', icon: <BrandIcon icon={siTelegram} className="w-6 h-6" />, onClick: () => open(`https://t.me/share/url?url=${encodeURIComponent('https://urcare.org')}&text=${enc}`) },
    {
      key: 'fb', label: 'Facebook', bg: '#0866FF', icon: <BrandIcon icon={siFacebook} className="w-6 h-6" />,
      // Facebook won't take pre-filled text, so the summary is copied first to paste in.
      onClick: async () => { await copyText(); flash(tr('Summary copied — paste it in your Facebook post', 'सारांश कॉपी हो गया — Facebook पोस्ट में पेस्ट करें')); open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://urcare.org')}`); },
    },
    { key: 'sms', label: tr('Message', 'मैसेज'), bg: '#16a34a', icon: <MessageSquare className="w-6 h-6" />, onClick: () => open(`sms:?&body=${enc}`) },
    { key: 'mail', label: 'Email', bg: '#ea4335', icon: <Mail className="w-6 h-6" />, onClick: () => open(`mailto:?subject=${encodeURIComponent('UrCare Health Summary')}&body=${enc}`) },
    { key: 'more', label: tr('More apps', 'और ऐप्स'), bg: '#334155', icon: <Share2 className="w-6 h-6" />, onClick: shareNative },
  ];

  const toggles: [SectionKey, string, string][] = [
    ['basics', 'Name & basics', 'नाम व बेसिक'],
    ['conditions', 'Conditions', 'बीमारियाँ'],
    ['score', 'Health score', 'हेल्थ स्कोर'],
    ['medicines', 'Medicines', 'दवाइयाँ'],
    ['report', 'Latest report', 'ताज़ा रिपोर्ट'],
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col text-left overflow-hidden"
            >
              <div className="notif-header flex items-center justify-between px-5 pt-5 pb-4 shrink-0 text-white">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center"><Share2 className="w-5 h-5" /></span>
                  <div>
                    <h2 className="text-lg font-black leading-tight">{tr('Share my health data', 'मेरा हेल्थ डेटा शेयर करें')}</h2>
                    <p className="text-[11px] font-semibold text-white/80">{tr('QR code + text, through any app', 'QR कोड + टेक्स्ट, किसी भी ऐप से')}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>

              <div className="overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">{tr('Include', 'शामिल करें')}</div>
                  <div className="flex flex-wrap gap-2">
                    {toggles.map(([key, en, hi]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${sections[key] ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-500'}`}
                      >
                        {sections[key] && <Check className="w-3 h-3" />}{tr(en, hi)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview: the QR and the very text it contains */}
                <div className="relative rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white p-4 overflow-hidden">
                  <ShineBorder borderWidth={2} duration={12} shineColor={['#34d399', '#22d3ee', '#a7f3d0']} />
                  <div className="flex justify-center">
                    {qr ? <img src={qr} alt={tr('Health summary QR code', 'हेल्थ सारांश QR कोड')} className="w-48 h-48 rounded-xl bg-white p-2 shadow-sm" /> : <div className="w-48 h-48 rounded-xl bg-zinc-100 animate-pulse" />}
                  </div>
                  <p className="mt-1 text-center text-[10px] font-bold text-emerald-700">{tr('Scan to read the full summary', 'पूरा सारांश पढ़ने के लिए स्कैन करें')}</p>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-zinc-700 bg-white rounded-xl border border-zinc-100 p-3 max-h-48 overflow-y-auto">{text}</pre>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {channels.map((c) => (
                    <button key={c.key} type="button" onClick={c.onClick} className="flex flex-col items-center gap-1.5 cursor-pointer group">
                      <span className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-md transition-transform group-hover:-translate-y-0.5 group-active:scale-95" style={{ background: c.bg }}>{c.icon}</span>
                      <span className="text-[11px] font-bold text-zinc-700">{c.label}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={copyText} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}{copied ? tr('Copied', 'कॉपी हुआ') : tr('Copy text', 'टेक्स्ट कॉपी')}
                  </button>
                  <button type="button" onClick={downloadImage} disabled={!qr} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-50">
                    <Download className="w-4 h-4" />{tr('Save image', 'इमेज सेव')}
                  </button>
                </div>

                <p className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
                  {tr('This is your private health information. Share it only with people you trust, like your doctor or family.', 'यह आपकी निजी हेल्थ जानकारी है। इसे सिर्फ़ भरोसेमंद लोगों जैसे डॉक्टर या परिवार से ही शेयर करें।')}
                </p>
              </div>

              <AnimatePresence>
                {notice && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-zinc-900 text-white text-xs font-bold shadow-lg whitespace-nowrap">
                    {notice}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

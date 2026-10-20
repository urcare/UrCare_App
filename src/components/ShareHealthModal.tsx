import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { siWhatsapp, siTelegram, siFacebook } from 'simple-icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
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

export const QR_HINT = 'Scan the QR code for more details';

/** One line of the summary, typed for display: a heading ("Medicines:"),
 *  a bullet ("- Metformin"), a labelled row ("Conditions: X") or plain text. */
type SummaryRow = { kind: 'heading' | 'bullet' | 'row' | 'text'; label?: string; value: string };
function parseSummary(text: string): { title: string; name: string; rows: SummaryRow[] } {
  const lines = text.split('\n');
  const rows: SummaryRow[] = [];
  for (const raw of lines.slice(2)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('- ')) rows.push({ kind: 'bullet', value: line.slice(2) });
    else if (/:$/.test(line)) rows.push({ kind: 'heading', value: line.slice(0, -1) });
    else {
      const i = line.indexOf(': ');
      if (i > 0 && i < 40) rows.push({ kind: 'row', label: line.slice(0, i), value: line.slice(i + 2) });
      else rows.push({ kind: 'text', value: line });
    }
  }
  return { title: lines[0] || 'UrCare Health Summary', name: lines[1] || '', rows };
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error('image'));
  img.src = src;
});

/** A rounded rectangle path that also works on older Android WebViews (no ctx.roundRect). */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the share card to a PNG: branded header, the name in bold, every
 *  row with a bold label, then the QR code with "Scan the QR code for more
 *  details" under it. */
async function renderShareCard(qrDataUrl: string, text: string): Promise<Blob | null> {
  const W = 1080, pad = 76, inner = W - pad * 2, qrSize = 460;
  const font = (weight: number, size: number) => `${weight} ${size}px Inter, "Segoe UI", Roboto, system-ui, sans-serif`;
  const { title, name, rows } = parseSummary(text);
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  const wrap = (str: string, f: string, width: number) => {
    measure.font = f;
    const out: string[] = [];
    let line = '';
    for (const word of str.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (measure.measureText(test).width > width && line) { out.push(line); line = word; } else line = test;
    }
    if (line) out.push(line);
    return out;
  };

  // Lay out first so the canvas is exactly as tall as it needs to be.
  const ops: ((c: CanvasRenderingContext2D) => void)[] = [];
  let y = 330;
  wrap(name, font(800, 50), inner).forEach((l) => { const yy = y; ops.push((c) => { c.font = font(800, 50); c.fillStyle = '#052e16'; c.fillText(l, pad, yy); }); y += 62; });
  y += 18;
  for (const r of rows) {
    if (r.kind === 'heading') {
      y += 18;
      const yy = y;
      ops.push((c) => { c.font = font(800, 26); c.fillStyle = '#047857'; c.fillText(r.value.toUpperCase(), pad, yy); });
      y += 48;
    } else if (r.kind === 'bullet') {
      wrap(r.value, font(600, 33), inner - 40).forEach((l, i) => {
        const yy = y;
        ops.push((c) => {
          if (i === 0) { c.fillStyle = '#10b981'; c.beginPath(); c.arc(pad + 10, yy - 11, 7, 0, Math.PI * 2); c.fill(); }
          c.font = font(600, 33); c.fillStyle = '#27272a'; c.fillText(l, pad + 40, yy);
        });
        y += 46;
      });
    } else if (r.kind === 'row') {
      const yy = y;
      ops.push((c) => { c.font = font(800, 24); c.fillStyle = '#047857'; c.fillText(String(r.label).toUpperCase(), pad, yy); });
      y += 42;
      wrap(r.value, font(700, 36), inner).forEach((l) => { const y2 = y; ops.push((c) => { c.font = font(700, 36); c.fillStyle = '#18181b'; c.fillText(l, pad, y2); }); y += 48; });
      y += 14;
    } else {
      wrap(r.value, font(500, 27), inner).forEach((l) => { const yy = y; ops.push((c) => { c.font = font(500, 27); c.fillStyle = '#71717a'; c.fillText(l, pad, yy); }); y += 40; });
    }
  }
  const qrTop = y + 50;
  const H = qrTop + qrSize + 200;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ecfdf5'; ctx.fillRect(0, 0, W, H);
  const head = ctx.createLinearGradient(0, 0, W, 240);
  head.addColorStop(0, '#047857'); head.addColorStop(0.55, '#059669'); head.addColorStop(1, '#0d9488');
  ctx.fillStyle = head; ctx.fillRect(0, 0, W, 230);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath(); ctx.arc(W - 90, 30, 170, 0, Math.PI * 2); ctx.fill();
  try {
    const logo = await loadImage('/urcare-logo-mark.png');
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(pad + 52, 110, 54, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(logo, pad + 12, 70, 80, 80);
  } catch { /* the card still works without the logo */ }
  ctx.fillStyle = '#ffffff';
  ctx.font = font(900, 60); ctx.fillText('UrCare', pad + 130, 116);
  ctx.font = font(600, 28); ctx.globalAlpha = 0.9;
  ctx.fillText(title.replace(/^UrCare\s*/i, '') || 'Health Summary', pad + 132, 158);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, 36, 260, W - 72, H - 260 - 36, 36); ctx.fill();
  ctx.strokeStyle = '#a7f3d0'; ctx.lineWidth = 3; ctx.stroke();
  ops.forEach((draw) => draw(ctx));

  const qr = await loadImage(qrDataUrl);
  const qx = (W - qrSize) / 2;
  ctx.fillStyle = '#ecfdf5';
  roundedRect(ctx, qx - 28, qrTop - 28, qrSize + 56, qrSize + 56, 32); ctx.fill();
  ctx.drawImage(qr, qx, qrTop, qrSize, qrSize);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#047857'; ctx.font = font(800, 32);
  ctx.fillText(QR_HINT, W / 2, qrTop + qrSize + 84);
  ctx.fillStyle = '#a1a1aa'; ctx.font = font(600, 24);
  ctx.fillText('urcare.org · Not a prescription', W / 2, qrTop + qrSize + 124);
  ctx.textAlign = 'left';
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

  // The message that goes with the image points people at the QR code.
  const shareText = `${text}\n\n${QR_HINT}.`;
  const isNative = Capacitor.isNativePlatform();
  // An older installed APK may not have the Share/Filesystem plugins yet.
  const nativeShareReady = isNative && Capacitor.isPluginAvailable('Share') && Capacitor.isPluginAvailable('Filesystem');
  const needsAppUpdate = isNative && !nativeShareReady;

  /** Writes the card PNG into the app's cache and returns its file:// uri (Android/iOS app). */
  const cardFileUri = async (dir: Directory, path: string): Promise<string | null> => {
    const blob = qr ? await renderShareCard(qr, text) : null;
    if (!blob) return null;
    const base64 = await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onloadend = () => res(String(reader.result).split(',')[1] || '');
      reader.onerror = () => rej(reader.error);
      reader.readAsDataURL(blob);
    });
    const written = await Filesystem.writeFile({ path, data: base64, directory: dir, recursive: true });
    return written.uri;
  };

  /** The phone's own share sheet with the QR card image + text — every installed app. */
  const shareWithImage = async () => {
    if (needsAppUpdate) {
      // No native share in this build — send the text (with the QR hint) to WhatsApp.
      flash(tr('Update the UrCare app to share the QR image — sending the text now', 'QR इमेज शेयर के लिए UrCare ऐप अपडेट करें — अभी टेक्स्ट भेज रहे हैं'));
      open(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
      return;
    }
    try {
      if (isNative) {
        const uri = await cardFileUri(Directory.Cache, 'urcare-health-summary.png');
        await Share.share({ title: 'UrCare Health Summary', text: shareText, files: uri ? [uri] : undefined, dialogTitle: tr('Share with', 'इसके साथ शेयर करें') });
        return;
      }
      const blob = qr ? await renderShareCard(qr, text) : null;
      const file = blob ? new File([blob], 'urcare-health-summary.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: shareText, title: 'UrCare Health Summary' }); return; }
      if (navigator.share) { await navigator.share({ text: shareText, title: 'UrCare Health Summary' }); return; }
      // Desktop browsers without a share sheet: save the card, then open WhatsApp Web.
      await saveImage();
      open(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
    } catch (e: any) {
      if (e?.name === 'AbortError' || /cancel/i.test(String(e?.message))) return;
      flash(tr('Could not open sharing. Please try again.', 'शेयर नहीं खुल सका। फिर कोशिश करें।'));
    }
  };

  /** Saves the QR card image — to Documents/UrCare in the app, a download on the web. */
  const saveImage = async () => {
    if (needsAppUpdate) {
      flash(tr('Update the UrCare app to save the image', 'इमेज सेव करने के लिए UrCare ऐप अपडेट करें'));
      return;
    }
    try {
      if (isNative) {
        await cardFileUri(Directory.Documents, `UrCare/urcare-health-summary-${Date.now()}.png`);
        flash(tr('Image saved to Documents › UrCare', 'इमेज Documents › UrCare में सेव हुई'));
        return;
      }
      const blob = qr ? await renderShareCard(qr, text) : null;
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'urcare-health-summary.png';
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash(tr('Image saved', 'इमेज सेव हुई'));
    } catch {
      // Some phones block writing to Documents — hand the image to the share sheet instead.
      if (isNative) await shareWithImage();
      else flash(tr('Could not save the image.', 'इमेज सेव नहीं हो सकी।'));
    }
  };

  // Image sharing works in the app and in phone browsers with a share sheet.
  const canShareImage = nativeShareReady || (!isNative && typeof navigator !== 'undefined' && !!navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent));

  const channels: { key: string; label: string; bg: string; icon: React.ReactNode; onClick: () => void }[] = [
    // In the app (and phone browsers) these open the share sheet with the QR
    // card image + text so the QR goes along; on desktop they open the site.
    { key: 'wa', label: 'WhatsApp', bg: '#25D366', icon: <BrandIcon icon={siWhatsapp} className="w-6 h-6" />, onClick: () => (canShareImage ? shareWithImage() : open(`https://wa.me/?text=${encodeURIComponent(shareText)}`)) },
    { key: 'tg', label: 'Telegram', bg: '#26A5E4', icon: <BrandIcon icon={siTelegram} className="w-6 h-6" />, onClick: () => (canShareImage ? shareWithImage() : open(`https://t.me/share/url?url=${encodeURIComponent('https://urcare.org')}&text=${encodeURIComponent(shareText)}`)) },
    {
      key: 'fb', label: 'Facebook', bg: '#0866FF', icon: <BrandIcon icon={siFacebook} className="w-6 h-6" />,
      // Facebook won't take pre-filled text, so the summary is copied first to paste in.
      onClick: async () => {
        if (canShareImage) { await shareWithImage(); return; }
        await copyText(); flash(tr('Summary copied — paste it in your Facebook post', 'सारांश कॉपी हो गया — Facebook पोस्ट में पेस्ट करें')); open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://urcare.org')}`);
      },
    },
    { key: 'sms', label: tr('Message', 'मैसेज'), bg: '#16a34a', icon: <MessageSquare className="w-6 h-6" />, onClick: () => open(`sms:?&body=${encodeURIComponent(shareText)}`) },
    { key: 'mail', label: 'Email', bg: '#ea4335', icon: <Mail className="w-6 h-6" />, onClick: () => open(`mailto:?subject=${encodeURIComponent('UrCare Health Summary')}&body=${encodeURIComponent(shareText)}`) },
    { key: 'more', label: tr('More apps', 'और ऐप्स'), bg: '#334155', icon: <Share2 className="w-6 h-6" />, onClick: shareWithImage },
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
                  <p className="mt-1.5 text-center text-[11px] font-black text-emerald-700">{tr(QR_HINT, 'ज़्यादा जानकारी के लिए QR कोड स्कैन करें')}</p>
                  {(() => {
                    const card = parseSummary(text);
                    return (
                      <div className="share-preview mt-3 bg-white rounded-xl border border-emerald-100 overflow-hidden">
                        <div className="px-3 py-2 bg-gradient-to-r from-emerald-700 to-teal-600 text-white flex items-center gap-2">
                          <img src="/urcare-logo-mark.png" alt="" className="w-6 h-6 rounded-full bg-white p-0.5" />
                          <span className="text-sm font-black tracking-tight">UrCare</span>
                          <span className="text-[10px] font-semibold opacity-85">{card.title.replace(/^UrCare\s*/i, '')}</span>
                        </div>
                        <div className="p-3 max-h-56 overflow-y-auto space-y-2">
                          {card.name && <div className="text-[15px] font-black text-emerald-950 leading-snug">{card.name}</div>}
                          {card.rows.map((r, i) =>
                            r.kind === 'heading' ? (
                              <div key={i} className="pt-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">{r.value}</div>
                            ) : r.kind === 'bullet' ? (
                              <div key={i} className="flex items-start gap-2 text-[12px] font-semibold text-zinc-800"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{r.value}</div>
                            ) : r.kind === 'row' ? (
                              <div key={i}>
                                <div className="text-[9px] font-black uppercase tracking-wider text-emerald-700">{r.label}</div>
                                <div className="text-[13px] font-bold text-zinc-900 leading-snug">{r.value}</div>
                              </div>
                            ) : (
                              <div key={i} className="text-[11px] text-zinc-500">{r.value}</div>
                            ),
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
                  <button type="button" onClick={saveImage} disabled={!qr} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-50">
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

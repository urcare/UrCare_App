import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { X, AtSign, Check, Loader2, QrCode, Share2, Copy, Download, ScanLine, Camera } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { checkUsername, setUsername, profileLink, handleFromScan } from '../utils/supabase';

type Tr = (en: string, hi: string) => string;

const Sheet: React.FC<{ open: boolean; onClose: () => void; icon: React.ReactNode; title: string; subtitle: string; dark?: boolean; children: React.ReactNode }> = ({ open, onClose, icon, title, subtitle, dark, children }) =>
  createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="fixed inset-0 z-[61] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }} className={`w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left ${dark ? 'bg-zinc-950 text-white' : 'bg-white'}`}>
              <div className="notif-header flex items-center justify-between px-5 pt-5 pb-4 text-white shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center">{icon}</span>
                  <div>
                    <h2 className="text-lg font-black leading-tight">{title}</h2>
                    <p className="text-[11px] font-semibold text-white/80">{subtitle}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto p-5 space-y-4">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );

// ---------------------------------------------------------------- @username

export const UsernameSheet: React.FC<{ open: boolean; onClose: () => void; current: string | null; suggestion: string; onSaved: (u: string) => void; tr: Tr }> = ({ open, onClose, current, suggestion, onSaved, tr }) => {
  const [value, setValue] = useState('');
  const [state, setState] = useState<{ checking: boolean; available?: boolean; message?: string | null }>({ checking: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setValue(current || suggestion); setState({ checking: false }); } }, [open, current, suggestion]);
  useEffect(() => {
    if (!open) return;
    const name = value.replace(/^@/, '');
    if (!name) { setState({ checking: false }); return; }
    if (name === current) { setState({ checking: false, available: true }); return; }
    setState({ checking: true });
    const t = window.setTimeout(() => { checkUsername(name).then((r) => setState({ checking: false, available: r.available, message: r.message })); }, 450);
    return () => window.clearTimeout(t);
  }, [value, open, current]);
  const save = async () => {
    setSaving(true);
    const r = await setUsername(value.replace(/^@/, ''));
    setSaving(false);
    if (r.ok && r.username) { onSaved(r.username); onClose(); } else setState({ checking: false, available: false, message: r.error });
  };
  const name = value.replace(/^@/, '');
  return (
    <Sheet open={open} onClose={onClose} icon={<AtSign className="w-5 h-5" />} title={tr('Your username', 'आपका यूज़रनेम')} subtitle={tr('People can find and add you with it', 'लोग इससे आपको ढूंढकर जोड़ सकेंगे')}>
      <div className={`flex items-center gap-1 px-4 py-3 rounded-2xl border-2 ${state.available === false ? 'border-rose-300' : state.available ? 'border-emerald-400' : 'border-zinc-200'}`}>
        <span className="text-xl font-black text-zinc-400">@</span>
        <input autoFocus value={name} onChange={(e) => setValue(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20))} placeholder="Aditya1" className="flex-1 min-w-0 text-lg font-black outline-none bg-transparent text-zinc-900" />
        {state.checking ? <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" /> : state.available ? <Check className="w-5 h-5 text-emerald-600" /> : null}
      </div>
      <p className={`text-xs font-semibold ${state.available === false ? 'text-rose-600' : state.available ? 'text-emerald-700' : 'text-zinc-500'}`}>
        {state.available === false ? state.message || tr('Not available', 'उपलब्ध नहीं') : state.available ? tr(`@${name} is available`, `@${name} उपलब्ध है`) : tr('4–20 letters, numbers or _, starting with a letter.', '4–20 अक्षर, अंक या _, अक्षर से शुरू।')}
      </p>
      <button type="button" onClick={save} disabled={!state.available || saving || name === current} className="w-full py-3.5 rounded-2xl bg-brand-gradient text-white text-sm font-black shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}{tr('Save username', 'यूज़रनेम सेव करें')}
      </button>
    </Sheet>
  );
};

// ---------------------------------------------------------------- my QR

async function renderQrCard(qrUrl: string, name: string, handle: string, avatar: string | null): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); if (!ctx) return null;
  const font = (w: number, s: number) => `${w} ${s}px Inter, "Segoe UI", Roboto, system-ui, sans-serif`;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#047857'); bg.addColorStop(0.55, '#0d9488'); bg.addColorStop(1, '#047857');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  [[140, 160, 220], [960, 260, 180], [900, 1240, 260]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // card
  ctx.fillStyle = '#ffffff';
  const x = 110, y = 250, w = W - 220, h = 960, r = 60;
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  // avatar circle overlapping the card top
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(W / 2, 250, 110, 0, Math.PI * 2); ctx.fill();
  try {
    const img = await load(avatar || '/urcare-logo-mark.png');
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 250, 96, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, W / 2 - 96, 154, 192, 192); ctx.restore();
  } catch {
    ctx.fillStyle = '#059669'; ctx.beginPath(); ctx.arc(W / 2, 250, 96, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = font(900, 80); ctx.textAlign = 'center'; ctx.fillText(name.slice(0, 1).toUpperCase(), W / 2, 278);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#052e16'; ctx.font = font(900, 58); ctx.fillText(name.slice(0, 26), W / 2, 430);
  ctx.fillStyle = '#047857'; ctx.font = font(800, 44); ctx.fillText(handle, W / 2, 492);
  const qr = await load(qrUrl);
  ctx.drawImage(qr, W / 2 - 260, 540, 520, 520);
  ctx.fillStyle = '#71717a'; ctx.font = font(700, 32); ctx.fillText('Scan to add me on UrCare', W / 2, 1130);
  ctx.fillStyle = '#ffffff'; ctx.font = font(900, 64); ctx.fillText('UrCare', W / 2, 150);
  ctx.font = font(600, 30); ctx.globalAlpha = 0.8; ctx.fillText('urcare.org', W / 2, H - 70); ctx.globalAlpha = 1;
  return await new Promise((res) => c.toBlob(res, 'image/png'));
}

export const MyQrSheet: React.FC<{ open: boolean; onClose: () => void; name: string; id: string; username: string | null; avatar: string | null; onSetUsername: () => void; tr: Tr }> = ({ open, onClose, name, id, username, avatar, onSetUsername, tr }) => {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const link = profileLink({ username, id });
  const handle = username ? `@${username}` : id;
  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(link, { errorCorrectionLevel: 'M', margin: 1, width: 640, color: { dark: '#064e3b', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [open, link]);
  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(null), 2200); };
  const text = tr(`Add me on UrCare: ${handle}\n${link}`, `UrCare पर मुझे जोड़ें: ${handle}\n${link}`);
  const nativeOk = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share') && Capacitor.isPluginAvailable('Filesystem');
  const cardBlob = () => (qr ? renderQrCard(qr, name, handle, avatar) : Promise.resolve(null));
  const toBase64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

  const share = async () => {
    try {
      const blob = await cardBlob();
      if (nativeOk && blob) {
        const { uri } = await Filesystem.writeFile({ path: 'urcare-my-qr.png', data: await toBase64(blob), directory: Directory.Cache });
        await Share.share({ text, files: [uri], dialogTitle: tr('Share my UrCare QR', 'मेरा UrCare QR शेयर करें') });
        return;
      }
      const file = blob ? new File([blob], 'urcare-my-qr.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
      if (navigator.share) { await navigator.share({ text }); return; }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch (e: any) {
      if (!(e?.name === 'AbortError' || /cancel/i.test(String(e?.message)))) flash(tr('Could not share. Try again.', 'शेयर नहीं हुआ। फिर कोशिश करें।'));
    }
  };
  const save = async () => {
    const blob = await cardBlob();
    if (!blob) return;
    try {
      if (nativeOk) {
        await Filesystem.writeFile({ path: `UrCare/urcare-my-qr-${Date.now()}.png`, data: await toBase64(blob), directory: Directory.Documents, recursive: true });
        flash(tr('Saved to Documents › UrCare', 'Documents › UrCare में सेव हुआ'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'urcare-my-qr.png';
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash(tr('Image saved', 'इमेज सेव हुई'));
    } catch { await share(); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch {} };

  return (
    <Sheet open={open} onClose={onClose} icon={<QrCode className="w-5 h-5" />} title={tr('My QR code', 'मेरा QR कोड')} subtitle={tr('Anyone can scan it to add you', 'कोई भी स्कैन करके आपको जोड़ सकता है')}>
      <div className="relative rounded-[1.5rem] p-5 pt-20 bg-brand-gradient text-center overflow-hidden">
        <div className="absolute top-3.5 left-0 right-0 text-white text-lg font-black tracking-tight">UrCare</div>
        <div className="relative bg-white rounded-3xl px-4 pt-12 pb-4 shadow-xl">
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-[72px] h-[72px] rounded-full bg-white p-1 shadow-md">
            {avatar ? <img src={avatar} referrerPolicy="no-referrer" alt="" className="w-full h-full rounded-full object-cover" /> : <span className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-2xl font-black flex items-center justify-center">{name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="text-base font-black text-emerald-950 truncate">{name}</div>
          <div className="text-sm font-black text-emerald-700">{handle}</div>
          {qr ? <img src={qr} alt="QR" className="mx-auto mt-3 w-52 h-52" /> : <div className="mx-auto mt-3 w-52 h-52 rounded-xl bg-zinc-100 animate-pulse" />}
          <div className="mt-1 text-[11px] font-bold text-zinc-500">{tr('Scan to add me on UrCare', 'UrCare पर जोड़ने के लिए स्कैन करें')}</div>
        </div>
      </div>
      {!username && (
        <button type="button" onClick={onSetUsername} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-xs font-black cursor-pointer"><AtSign className="w-4 h-4" />{tr('Set a @username for a nicer QR', 'बेहतर QR के लिए @यूज़रनेम रखें')}</button>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={share} className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-emerald-600 text-white text-[11px] font-black cursor-pointer"><Share2 className="w-5 h-5" />{tr('Share', 'शेयर')}</button>
        <button type="button" onClick={copy} className="flex flex-col items-center gap-1 py-3 rounded-2xl border border-zinc-200 text-zinc-700 text-[11px] font-black cursor-pointer">{copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}{copied ? tr('Copied', 'कॉपी') : tr('Copy link', 'लिंक कॉपी')}</button>
        <button type="button" onClick={save} className="flex flex-col items-center gap-1 py-3 rounded-2xl border border-zinc-200 text-zinc-700 text-[11px] font-black cursor-pointer"><Download className="w-5 h-5" />{tr('Save', 'सेव')}</button>
      </div>
      <p className="text-center text-[11px] text-zinc-500">{tr('Share on WhatsApp, Telegram, Instagram or any app. Friends who join through it count as your referral.', 'WhatsApp, Telegram, Instagram या किसी भी ऐप पर शेयर करें। इससे जुड़ने वाले दोस्त आपके रेफ़रल गिने जाएंगे।')}</p>
      <AnimatePresence>{notice && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-xs font-bold text-emerald-700">{notice}</motion.div>}</AnimatePresence>
    </Sheet>
  );
};

// ---------------------------------------------------------------- scanner

/** Camera QR scanner (jsQR). Calls onFound with "@name" / "UC…" from a UrCare QR. */
export const QrScannerSheet: React.FC<{ open: boolean; onClose: () => void; onFound: (handle: string) => void; tr: Tr }> = ({ open, onClose, onFound, tr }) => {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [badCode, setBadCode] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    setError(null); setBadCode(false);
    const scan = () => {
      if (stopped) return;
      const v = video.current, c = canvas.current;
      if (v && c && v.readyState >= 2 && v.videoWidth) {
        const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480);
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            const handle = handleFromScan(code.data);
            if (handle) { stopped = true; onFound(handle); return; }
            setBadCode(true);
          }
        }
      }
      raf = requestAnimationFrame(scan);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } raf = requestAnimationFrame(scan); })
      .catch(() => setError(tr('Camera not available. Allow camera access, or pick a QR image instead.', 'कैमरा उपलब्ध नहीं। कैमरा अनुमति दें, या QR की इमेज चुनें।')));
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [open, onFound, tr]);

  const fromImage = async (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); const s = Math.min(1, 1200 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      const handle = code?.data ? handleFromScan(code.data) : null;
      URL.revokeObjectURL(url);
      if (handle) onFound(handle); else setBadCode(true);
    };
    img.src = url;
  };

  return (
    <Sheet open={open} onClose={onClose} icon={<ScanLine className="w-5 h-5" />} title={tr('Scan a QR code', 'QR कोड स्कैन करें')} subtitle={tr("Point at someone's UrCare QR", 'किसी के UrCare QR की ओर रखें')}>
      <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white/80"><Camera className="w-10 h-10 mb-2" /><span className="text-xs font-bold">{error}</span></div>
        ) : (
          <video ref={video} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}
        <span className="qr-scan-frame" aria-hidden="true"><span /><span /><span /><span /></span>
        <span className="qr-scan-line" aria-hidden="true" />
      </div>
      <canvas ref={canvas} className="hidden" />
      {badCode && <p className="text-center text-xs font-bold text-rose-600">{tr("That QR isn't a UrCare profile.", 'यह UrCare प्रोफ़ाइल QR नहीं है।')}</p>}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => fromImage(e.target.files?.[0])} />
      <button type="button" onClick={() => fileInput.current?.click()} className="w-full py-3 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-700 cursor-pointer">{tr('Pick a QR image from gallery', 'गैलरी से QR इमेज चुनें')}</button>
    </Sheet>
  );
};

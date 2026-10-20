import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Search, Check, X, Copy, Share2, Gift, Heart, UserPlus, Trash2, Eye, EyeOff, Loader2, QrCode, ScanLine, ShoppingBag } from 'lucide-react';
import { UsernameSheet, MyQrSheet, QrScannerSheet } from './ProfileQr';
import { StatusStrip } from './FamilyStatus';
import { NumberTicker } from './magicui/number-ticker';
import { siWhatsapp } from 'simple-icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  getFamily, searchFamilyMember, sendFamilyRequest, respondFamilyRequest, removeFamilyMember, setFamilyShareProgress,
  FamilyState, FamilyPerson, FamilyLink, profileLink, getReferralStatus, ReferralStatus,
} from '../utils/supabase';
import { BorderBeam } from './magicui/border-beam';
import { MagicCard } from './magicui/magic-card';
import { AnimatedListItem } from './magicui/animated-list';

const RELATION_LABELS: Record<string, [string, string, string]> = {
  mother: ['Mother', 'माँ', '👩'], father: ['Father', 'पिता', '👨'], brother: ['Brother', 'भाई', '🧑'], sister: ['Sister', 'बहन', '👧'],
  son: ['Son', 'बेटा', '👦'], daughter: ['Daughter', 'बेटी', '👧'], spouse: ['Spouse', 'जीवनसाथी', '💑'], grandparent: ['Grandparent', 'दादा/दादी', '👴'],
  friend: ['Friend', 'दोस्त', '🤝'], other: ['Other', 'अन्य', '🙂'],
};

const Avatar: React.FC<{ person: FamilyPerson; size?: number }> = ({ person, size = 44 }) =>
  person.avatar ? (
    <img src={person.avatar} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover shrink-0 border-2 border-white shadow-sm" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full shrink-0 flex items-center justify-center text-white font-black bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-white shadow-sm" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {person.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
  );

const ProgressRing: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 18, c = 2 * Math.PI * r;
  const tone = pct >= 100 ? '#059669' : pct >= 50 ? '#16a34a' : '#f59e0b';
  return (
    <span className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e4e4e7" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black" style={{ color: tone }}>{pct}%</span>
    </span>
  );
};

interface FamilyPageProps {
  tr: (en: string, hi: string) => string;
  /** Opens the add-person sheet straight away (from the Home "+" button). */
  startAdding?: boolean;
  /** A @username / UrCare ID to look up straight away (from a scanned QR link). */
  initialQuery?: string;
  /** The signed-in member's own name and photo, for their QR card. */
  selfName?: string;
  selfAvatar?: string | null;
  /** Opens the Pharmacy (to spend points). */
  onOpenStore?: () => void;
}

export const FamilyPage: React.FC<FamilyPageProps> = ({ tr, startAdding, initialQuery, selfName, selfAvatar, onOpenStore }) => {
  const [state, setState] = useState<FamilyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'family' | 'friends'>('family');
  const [isAdding, setIsAdding] = useState(!!startAdding || !!initialQuery);
  const [addQuery, setAddQuery] = useState(initialQuery || '');
  const [isUsernameOpen, setIsUsernameOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  // Points from family bonuses + friends who joined with this member's link.
  const [referral, setReferral] = useState<ReferralStatus | null>(null);
  useEffect(() => {
    const load = () => getReferralStatus().then(setReferral);
    load();
    window.addEventListener('urcare:refresh', load);
    window.addEventListener('urcare:family-status-changed', load);
    return () => { window.removeEventListener('urcare:refresh', load); window.removeEventListener('urcare:family-status-changed', load); };
  }, []);
  const perReward = referral?.perReward || 5;
  const towardsNext = referral ? referral.joined % perReward : 0;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const relLabel = (r: string) => { const l = RELATION_LABELS[r] || RELATION_LABELS.other; return `${l[2]} ${tr(l[0], l[1])}`; };

  const refresh = useCallback(() => { getFamily().then((s) => { setState(s); setLoading(false); }); }, []);
  useEffect(() => {
    refresh();
    // Live: requests, members and their progress update every 15 s, and right
    // away on pull-to-refresh or when a status changes.
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
    window.addEventListener('urcare:refresh', refresh);
    window.addEventListener('urcare:family-status-changed', refresh);
    return () => { window.clearInterval(poll); window.removeEventListener('urcare:refresh', refresh); window.removeEventListener('urcare:family-status-changed', refresh); };
  }, [refresh]);
  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(null), 2400); };

  const myId = state?.myId || '';
  const handle = state?.username ? `@${state.username}` : myId;
  const inviteText = tr(
    `Add me on UrCare so we can keep each other healthy! ${handle}\n${profileLink({ username: state?.username, id: myId })}`,
    `UrCare पर मुझे जोड़ें ताकि हम एक-दूसरे को स्वस्थ रखें! ${handle}\n${profileLink({ username: state?.username, id: myId })}`,
  );
  const copyId = async () => { try { await navigator.clipboard.writeText(myId); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch {} };
  const shareId = async () => {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) { await Share.share({ text: inviteText, dialogTitle: tr('Share your UrCare ID', 'अपनी UrCare ID शेयर करें') }); return; }
      if (navigator.share) { await navigator.share({ text: inviteText }); return; }
    } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank', 'noopener');
  };

  const toggleShare = async () => {
    if (!state) return;
    const next = !state.shareProgress;
    setState({ ...state, shareProgress: next });
    if (!(await setFamilyShareProgress(next))) { setState({ ...state }); flash(tr('Could not save. Try again.', 'सेव नहीं हुआ। फिर कोशिश करें।')); }
  };

  const respond = async (id: string, accept: boolean, relation: string) => {
    setBusy(id);
    const ok = await respondFamilyRequest(id, accept, relation);
    setBusy(null);
    if (!ok) { flash(tr('Could not update the request.', 'रिक्वेस्ट अपडेट नहीं हुई।')); return; }
    flash(accept ? tr('Added to your family 🎉', 'परिवार में जुड़ गए 🎉') : tr('Request declined', 'रिक्वेस्ट मना की'));
    refresh();
  };
  const remove = async (m: FamilyLink) => {
    if (!window.confirm(tr(`Remove ${m.name}?`, `${m.name} को हटाएं?`))) return;
    setBusy(m.id);
    await removeFamilyMember(m.id);
    setBusy(null);
    refresh();
  };

  const members = (state?.members || []).filter((m) => m.group === tab);

  return (
    <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5 text-left">
      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="home-hero relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white">
        <span className="home-hero-blob home-hero-blob-a" aria-hidden="true" />
        <span className="home-hero-blob home-hero-blob-b" aria-hidden="true" />
        <BorderBeam size={110} duration={9} colorFrom="#fde68a" colorTo="#ffffff" borderWidth={2} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="hero-chip"><Users className="w-3.5 h-3.5" />{tr('Family & Friends', 'परिवार व दोस्त')}</span>
            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold leading-tight">{tr('Get healthy together', 'साथ मिलकर स्वस्थ बनें')}</h1>
            <p className="mt-1 text-sm text-white/85">{tr('Add the people you care about and cheer each other on.', 'अपनों को जोड़ें और एक-दूसरे का हौसला बढ़ाएं।')}</p>
          </div>
          <button type="button" onClick={() => setIsAdding(true)} className="shrink-0 w-12 h-12 rounded-2xl bg-white text-emerald-700 flex items-center justify-center shadow-lg cursor-pointer active:scale-95 transition-transform" title={tr('Add someone', 'किसी को जोड़ें')}>
            <Plus className="w-6 h-6" />
          </button>
        </div>
        {/* @username + QR (Telegram-style) */}
        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
          <button type="button" onClick={() => setIsUsernameOpen(true)} disabled={!state} className="min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white/15 border border-white/25 text-left cursor-pointer hover:bg-white/20">
            <span className="text-lg font-black opacity-80">@</span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/75">{tr('Username', 'यूज़रनेम')}</span>
              <span className="block truncate text-sm font-black">{state?.username ? state.username : tr('Set your username', 'यूज़रनेम रखें')}</span>
            </span>
          </button>
          <button type="button" onClick={() => setIsQrOpen(true)} disabled={!state} className="w-12 rounded-2xl bg-white text-emerald-700 flex flex-col items-center justify-center shadow cursor-pointer" title={tr('My QR code', 'मेरा QR कोड')}><QrCode className="w-5 h-5" /><span className="text-[8px] font-black mt-0.5">{tr('MY QR', 'मेरा QR')}</span></button>
          <button type="button" onClick={() => setIsScanOpen(true)} className="w-12 rounded-2xl bg-white/15 border border-white/25 flex flex-col items-center justify-center cursor-pointer" title={tr('Scan QR', 'QR स्कैन')}><ScanLine className="w-5 h-5" /><span className="text-[8px] font-black mt-0.5">{tr('SCAN', 'स्कैन')}</span></button>
        </div>
        <div className="mt-2 flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-white/10 border border-white/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/75 shrink-0">{tr('Your UrCare ID', 'आपकी UrCare ID')}</span>
          <span className="flex-1 min-w-0 truncate font-mono text-base font-black tracking-wider">{myId || '…'}</span>
          <button type="button" onClick={copyId} disabled={!myId} className="shrink-0 p-2 rounded-xl bg-white/20 hover:bg-white/30 cursor-pointer" title={tr('Copy', 'कॉपी')}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
          <button type="button" onClick={shareId} disabled={!myId} className="shrink-0 p-2 rounded-xl bg-white text-emerald-700 cursor-pointer" title={tr('Share', 'शेयर')}><Share2 className="w-4 h-4" /></button>
        </div>
      </motion.section>

      {/* Today's status — mine + family & friends */}
      <StatusStrip key={state?.shareProgress ? 'on' : 'off'} tr={tr} />

      {/* Invite & earn — family bonus and referrals in one place */}
      <section className="relative rounded-[1.5rem] bg-white border border-emerald-200 shadow-depth overflow-hidden">
        <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50 via-white to-green-50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider"><Gift className="w-3.5 h-3.5" />{tr('Invite & earn', 'बुलाएं और कमाएं')}</span>
              <h2 className="mt-2 text-base font-black text-zinc-900 leading-snug">{tr('Bring your family & friends to UrCare', 'अपने परिवार व दोस्तों को UrCare पर लाएं')}</h2>
              <p className="text-[11px] text-zinc-500 font-semibold">{tr('1 point = ₹1 off in UrCare Medical Pharmacy', '1 पॉइंट = UrCare मेडिकल फ़ार्मेसी में ₹1 की छूट')}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{tr('Your points', 'आपके पॉइंट्स')}</div>
              <div className="font-display text-3xl font-bold text-emerald-700 leading-none mt-1"><NumberTicker value={referral?.balance || 0} className="text-emerald-700 tracking-normal" /></div>
              <div className="text-[10px] font-bold text-zinc-400 mt-1">≈ ₹{(referral?.balance || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-emerald-100">
              <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><Heart className="w-4.5 h-4.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-zinc-900">{tr(`+₹${state?.bonusPerPerson || 150} for each person you add`, `हर जोड़े गए व्यक्ति पर +₹${state?.bonusPerPerson || 150}`)}</span>
                <span className="block text-[11px] text-zinc-500 font-semibold">{tr('Added when they accept your request', 'जब वो आपकी रिक्वेस्ट मानें')}</span>
              </span>
              <span className="text-sm font-black text-emerald-700 shrink-0">+{referral?.familyBonus || 0}</span>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-emerald-100">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-green-700 text-white flex items-center justify-center shrink-0"><Users className="w-4.5 h-4.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black text-zinc-900">{tr(`+₹${referral?.rewardPoints || 500} extra for every ${perReward} people`, `हर ${perReward} लोगों पर +₹${referral?.rewardPoints || 500} और`)}</span>
                  <span className="block text-[11px] text-zinc-500 font-semibold">{tr(`${towardsNext} of ${perReward} — family you add and friends who join with your link both count`, `${perReward} में से ${towardsNext} — जोड़े गए परिवार व लिंक से जुड़े दोस्त, दोनों गिने जाते हैं`)}</span>
                </span>
                <span className="text-sm font-black text-emerald-700 shrink-0">{referral?.joined || 0}</span>
              </div>
              <div className="mt-2.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${perReward}, minmax(0, 1fr))` }}>
                {Array.from({ length: perReward }, (_, i) => (
                  <motion.span key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.08 * i }} className={`h-2 rounded-full origin-left ${i < towardsNext ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-emerald-100'}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank', 'noopener')} disabled={!myId} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-black cursor-pointer disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true"><path d={siWhatsapp.path} /></svg>{tr('Invite on WhatsApp', 'WhatsApp पर बुलाएं')}
            </button>
            <button type="button" onClick={shareId} disabled={!myId} className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-black cursor-pointer disabled:opacity-50">
              <Share2 className="w-4 h-4" />{tr('More apps', 'और ऐप्स')}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] font-semibold text-zinc-400">{tr('Your link, QR and UrCare ID all count as your invite.', 'आपका लिंक, QR और UrCare ID — सब आपके इनवाइट गिने जाते हैं।')}</p>
          {(referral?.balance || 0) >= (referral?.block || 50) && onOpenStore && (
            <button type="button" onClick={onOpenStore} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-emerald-300 text-emerald-800 text-xs font-black cursor-pointer hover:bg-emerald-50">
              <ShoppingBag className="w-4 h-4" />{tr('Use my points in the Pharmacy', 'फ़ार्मेसी में पॉइंट्स इस्तेमाल करें')}
            </button>
          )}
        </div>
      </section>

      {/* Share-progress switch */}
      <button type="button" onClick={toggleShare} disabled={!state} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-zinc-200 shadow-depth text-left cursor-pointer">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${state?.shareProgress ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>{state?.shareProgress ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-zinc-900">{tr('Show my daily progress to my family', 'मेरी रोज़ की प्रोग्रेस परिवार को दिखाएं')}</span>
          <span className="block text-[11px] text-zinc-500 font-semibold">{tr('They see your % for today and get a notification at 50% and 100%. Off until you turn it on.', 'उन्हें आज का % दिखेगा और 50% व 100% पर सूचना जाएगी। आपके ON करने तक बंद।')}</span>
        </span>
        <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${state?.shareProgress ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${state?.shareProgress ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>

      {/* Requests */}
      {!!state?.requests.length && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-black text-zinc-900"><UserPlus className="w-4 h-4 text-emerald-600" />{tr('Requests for you', 'आपके लिए रिक्वेस्ट')}</h2>
          {state.requests.map((r) => <RequestCard key={r.id} req={r} relations={state.relations} relLabel={relLabel} tr={tr} busy={busy === r.id} onRespond={respond} />)}
        </section>
      )}

      {/* Members */}
      <section className="space-y-3">
        <div className="relative grid grid-cols-2 p-1 rounded-xl bg-zinc-100">
          <span className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-transform duration-300" style={{ transform: tab === 'friends' ? 'translateX(100%)' : 'none' }} />
          {(['family', 'friends'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`relative z-10 py-2 text-xs font-black cursor-pointer ${tab === k ? 'text-emerald-700' : 'text-zinc-500'}`}>
              {k === 'family' ? tr(`👨‍👩‍👧 Family (${(state?.members || []).filter((m) => m.group === 'family').length})`, `👨‍👩‍👧 परिवार (${(state?.members || []).filter((m) => m.group === 'family').length})`) : tr(`🤝 Friends (${(state?.members || []).filter((m) => m.group === 'friends').length})`, `🤝 दोस्त (${(state?.members || []).filter((m) => m.group === 'friends').length})`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>
        ) : members.length === 0 ? (
          <button type="button" onClick={() => setIsAdding(true)} className="w-full py-10 rounded-2xl border-2 border-dashed border-emerald-200 text-center cursor-pointer hover:bg-emerald-50/50">
            <span className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Heart className="w-7 h-7" /></span>
            <span className="mt-3 block text-sm font-black text-zinc-800">{tab === 'family' ? tr('Add your first family member', 'पहला परिवार सदस्य जोड़ें') : tr('Add your first friend', 'पहला दोस्त जोड़ें')}</span>
            <span className="block text-[11px] text-zinc-500 font-semibold">{tr('Tap + and enter their UrCare ID', '+ दबाएं और उनकी UrCare ID डालें')}</span>
          </button>
        ) : (
          <MagicCard className="rounded-2xl shadow-depth" gradientSize={220} gradientColor="#d1fae5" gradientOpacity={0.5} gradientFrom="#10b981" gradientTo="#4ade80">
            <ul className="divide-y divide-zinc-100">
              {members.map((m) => (
                <AnimatedListItem key={m.id}>
                  <li className="flex items-center gap-3 px-3.5 py-3">
                    <Avatar person={m} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-zinc-900 truncate">{m.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-black">{relLabel(m.relation)}</span>
                        <span className="text-[10px] font-mono text-zinc-400">{m.id}</span>
                      </div>
                      {m.status && <p className="mt-1 text-[11px] text-zinc-600 italic line-clamp-2">“{m.status}”</p>}
                    </div>
                    {m.progress ? <ProgressRing pct={m.progress.pct} /> : (
                      <span className="text-[10px] font-bold text-zinc-400 text-right leading-tight w-16">{m.sharesProgress ? tr('Not started today', 'आज शुरू नहीं') : tr('Progress private', 'प्रोग्रेस निजी')}</span>
                    )}
                    <button type="button" onClick={() => remove(m)} disabled={busy === m.id} className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 cursor-pointer" title={tr('Remove', 'हटाएं')}><Trash2 className="w-4 h-4" /></button>
                  </li>
                </AnimatedListItem>
              ))}
            </ul>
          </MagicCard>
        )}
      </section>

      <AddPersonSheet open={isAdding} onClose={() => { setIsAdding(false); setAddQuery(''); }} initialQuery={addQuery} onScan={() => setIsScanOpen(true)} relations={state?.relations || Object.keys(RELATION_LABELS)} relLabel={relLabel} tr={tr} onSent={() => { flash(tr('Request sent! They will see it in their app.', 'रिक्वेस्ट भेज दी! उन्हें उनकी ऐप में दिखेगी।')); refresh(); }} />
      <UsernameSheet
        open={isUsernameOpen}
        onClose={() => setIsUsernameOpen(false)}
        current={state?.username || null}
        suggestion={(selfName || '').split(' ')[0].replace(/[^A-Za-z0-9_]/g, '').slice(0, 14) + (myId ? myId.slice(-2) : '')}
        onSaved={(u) => { if (state) setState({ ...state, username: u }); flash(tr(`You're now @${u}`, `अब आप @${u} हैं`)); }}
        tr={tr}
      />
      <MyQrSheet
        open={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        name={selfName || 'UrCare member'}
        id={myId}
        username={state?.username || null}
        avatar={selfAvatar || null}
        onSetUsername={() => { setIsQrOpen(false); setIsUsernameOpen(true); }}
        tr={tr}
      />
      <QrScannerSheet
        open={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onFound={(handle) => { setIsScanOpen(false); setAddQuery(handle); setIsAdding(true); }}
        tr={tr}
      />

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-zinc-900 text-white text-xs font-bold shadow-lg whitespace-nowrap">{notice}</motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

const RequestCard: React.FC<{
  req: FamilyPerson & { relation: string }; relations: string[]; relLabel: (r: string) => string; tr: (en: string, hi: string) => string;
  busy: boolean; onRespond: (id: string, accept: boolean, relation: string) => void;
}> = ({ req, relations, relLabel, tr, busy, onRespond }) => {
  const [relation, setRelation] = useState('other');
  return (
    <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-depth">
      <div className="flex items-center gap-3">
        <Avatar person={req} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-zinc-900 truncate">{req.name}</div>
          <div className="text-[11px] text-zinc-500 font-semibold">{tr(`Added you as their ${relLabel(req.relation)}`, `आपको अपना ${relLabel(req.relation)} जोड़ा`)}</div>
        </div>
      </div>
      <div className="mt-3 text-[11px] font-black text-zinc-500">{tr('They are my…', 'ये मेरे…')}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {relations.map((r) => (
          <button key={r} type="button" onClick={() => setRelation(r)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${relation === r ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-600'}`}>{relLabel(r)}</button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => onRespond(req.id, false, relation)} className="py-2.5 rounded-xl border border-zinc-200 text-xs font-black text-zinc-600 cursor-pointer flex items-center justify-center gap-1"><X className="w-4 h-4" />{tr('Decline', 'मना करें')}</button>
        <button type="button" disabled={busy} onClick={() => onRespond(req.id, true, relation)} className="py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer flex items-center justify-center gap-1">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{tr('Accept', 'स्वीकार करें')}</button>
      </div>
    </div>
  );
};

const AddPersonSheet: React.FC<{
  open: boolean; onClose: () => void; relations: string[]; relLabel: (r: string) => string;
  tr: (en: string, hi: string) => string; onSent: () => void; initialQuery?: string; onScan: () => void;
}> = ({ open, onClose, relations, relLabel, tr, onSent, initialQuery, onScan }) => {
  const [id, setId] = useState('');
  const [found, setFound] = useState<{ person: FamilyPerson; already?: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [relation, setRelation] = useState('friend');
  const [working, setWorking] = useState(false);
  useEffect(() => { if (!open) { setId(''); setFound(null); setMessage(null); setRelation('friend'); } }, [open]);
  // Opened from a scanned QR / profile link: look the person up right away.
  useEffect(() => { if (open && initialQuery) { setId(initialQuery); search(initialQuery); } }, [open, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalise = (q: string) => { const t = q.trim(); return /^UC[0-9A-F]{6}$/i.test(t) ? t.toUpperCase() : t.startsWith('@') ? t : /^UC/i.test(t) ? t.toUpperCase() : `@${t}`; };
  const search = async (q?: string) => {
    const query = normalise(q ?? id);
    setWorking(true); setMessage(null); setFound(null);
    const r = await searchFamilyMember(query);
    setWorking(false);
    if (r.found && r.person) setFound({ person: r.person, already: r.already });
    else setMessage(r.message || tr('No member found.', 'कोई सदस्य नहीं मिला।'));
  };
  const send = async () => {
    if (!found) return;
    setWorking(true);
    const ok = await sendFamilyRequest(found.person.id, relation);
    setWorking(false);
    if (ok) { onSent(); onClose(); } else setMessage(tr('Could not send the request. Try again.', 'रिक्वेस्ट नहीं गई। फिर कोशिश करें।'));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden text-left">
              <div className="notif-header flex items-center justify-between px-5 pt-5 pb-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center"><UserPlus className="w-5 h-5" /></span>
                  <div>
                    <h2 className="text-lg font-black leading-tight">{tr('Add family or a friend', 'परिवार या दोस्त जोड़ें')}</h2>
                    <p className="text-[11px] font-semibold text-white/80">{tr('Search their @username or UrCare ID, or scan their QR', 'उनका @यूज़रनेम या UrCare ID खोजें, या QR स्कैन करें')}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <input value={id} onChange={(e) => setId(e.target.value.replace(/\s/g, '').slice(0, 21))} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} placeholder={tr('@username or UC1A2B3C', '@यूज़रनेम या UC1A2B3C')} autoCapitalize="none" autoCorrect="off" className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-zinc-200 text-base font-black outline-none focus:border-emerald-500" />
                  <button type="button" onClick={() => search()} disabled={working || id.trim().replace(/^@/, '').length < 4} className="px-4 rounded-xl bg-emerald-600 text-white cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-black">
                    {working && !found ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{tr('Find', 'खोजें')}
                  </button>
                </div>
                <button type="button" onClick={onScan} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-xs font-black cursor-pointer hover:bg-emerald-50">
                  <ScanLine className="w-4 h-4" />{tr('Scan their QR code', 'उनका QR कोड स्कैन करें')}
                </button>
                {message && <p className="text-xs font-semibold text-rose-600">{message}</p>}
                {found && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <Avatar person={found.person} size={48} />
                      <div className="min-w-0">
                        <div className="text-sm font-black text-zinc-900 truncate">{found.person.name}</div>
                        <div className="text-[11px] font-bold text-emerald-700">{found.person.username ? `@${found.person.username}` : ''} <span className="font-mono text-zinc-400">{found.person.id}</span></div>
                      </div>
                    </div>
                    {found.already ? (
                      <p className="text-xs font-bold text-emerald-700">{tr('Already in your family & friends.', 'पहले से आपके परिवार/दोस्तों में हैं।')}</p>
                    ) : (
                      <>
                        <div className="text-[11px] font-black text-zinc-500">{tr('They are my…', 'ये मेरे…')}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {relations.map((r) => (
                            <button key={r} type="button" onClick={() => setRelation(r)} className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer ${relation === r ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-600'}`}>{relLabel(r)}</button>
                          ))}
                        </div>
                        <button type="button" onClick={send} disabled={working} className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-black shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
                          {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}{tr('Send request', 'रिक्वेस्ट भेजें')}
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

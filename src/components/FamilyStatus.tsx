import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, EyeOff } from 'lucide-react';
import { getFamily, setFamilyShareProgress, FamilyState, FamilyPerson, StatusUpdate } from '../utils/supabase';
import { progressMessage, shareProgressStory } from './ProgressCelebration';

type Tr = (en: string, hi: string) => string;
interface StatusOwner extends FamilyPerson { updates: StatusUpdate[]; isMe?: boolean; relation?: string }

const SEEN_KEY = 'urcare_status_seen';
const seenMap = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };
const markSeen = (id: string, at: string) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...seenMap(), [id]: at })); } catch {} };

const timeAgo = (iso: string, tr: Tr) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return tr('just now', 'अभी');
  if (m < 60) return tr(`${m}m ago`, `${m} मिनट पहले`);
  return tr(`${Math.floor(m / 60)}h ago`, `${Math.floor(m / 60)} घंटे पहले`);
};

const Face: React.FC<{ person: FamilyPerson; size: number }> = ({ person, size }) =>
  person.avatar ? (
    <img src={person.avatar} referrerPolicy="no-referrer" alt="" className="rounded-full object-cover bg-white" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black flex items-center justify-center" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {person.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
  );

/** Loads today's statuses (mine + family who share), refreshing when a step is ticked. */
export function useFamilyStatuses() {
  const [state, setState] = useState<FamilyState | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => getFamily().then((s) => { if (!cancelled && s) setState(s); });
    load();
    const onChange = () => window.setTimeout(load, 1200);
    window.addEventListener('urcare:daily-log-changed', onChange);
    window.addEventListener('urcare:family-status-changed', onChange);
    window.addEventListener('urcare:refresh', load);
    // Live: family statuses update by themselves every 15 s while the app is open.
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener('urcare:daily-log-changed', onChange);
      window.removeEventListener('urcare:family-status-changed', onChange);
      window.removeEventListener('urcare:refresh', load);
    };
  }, []);
  const owners = useMemo<StatusOwner[]>(() => {
    if (!state) return [];
    const list: StatusOwner[] = [{ ...state.me, updates: state.me?.statusUpdates || [], isMe: true }];
    for (const m of state.members) if (m.statusUpdates?.length) list.push({ ...m, updates: m.statusUpdates });
    return list;
  }, [state]);
  return { state, owners, setState };
}

/** The round "status" avatars (WhatsApp-style): yours first, then family & friends. */
export const StatusStrip: React.FC<{ tr: Tr; compact?: boolean }> = ({ tr, compact }) => {
  const { state, owners } = useFamilyStatuses();
  const [open, setOpen] = useState<number | null>(null);
  const [, force] = useState(0);
  if (!state) return null;
  const seen = seenMap();
  const others = owners.filter((o) => !o.isMe);
  const mine = owners[0];
  if (compact && !mine?.updates.length && !others.length) return null;
  return (
    <div className={compact ? '' : 'rounded-2xl bg-white border border-zinc-200 shadow-depth p-3'}>
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-black text-zinc-900">{tr("Today's status", 'आज का स्टेटस')}</span>
        {!state.shareProgress && <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1"><EyeOff className="w-3 h-3" />{tr('Yours is private', 'आपका निजी है')}</span>}
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {owners.map((o, i) => {
          const latest = o.updates[o.updates.length - 1];
          const unseen = !!latest && seen[o.id] !== latest.at && !o.isMe;
          const has = !!latest;
          return (
            <button key={o.id} type="button" onClick={() => has && setOpen(i)} className={`shrink-0 w-16 flex flex-col items-center gap-1 ${has ? 'cursor-pointer' : 'cursor-default opacity-60'}`}>
              <span className={`relative p-[3px] rounded-full ${unseen ? 'bg-gradient-to-tr from-amber-400 via-emerald-500 to-teal-500' : has ? 'bg-zinc-300' : 'bg-zinc-200'}`}>
                <span className="block p-[2px] rounded-full bg-white"><Face person={o} size={52} /></span>
                {latest && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-emerald-600 text-white text-[9px] font-black border-2 border-white">{latest.pct}%</span>}
              </span>
              <span className="w-full truncate text-center text-[10px] font-bold text-zinc-700">{o.isMe ? tr('My status', 'मेरा स्टेटस') : o.name.split(' ')[0]}</span>
            </button>
          );
        })}
        {!others.length && (
          <div className="shrink-0 self-center text-[11px] font-semibold text-zinc-400 pl-1 pr-3 leading-snug max-w-[11rem]">{tr('Family statuses show here when they share their progress.', 'परिवार के लोग प्रोग्रेस शेयर करें तो उनका स्टेटस यहां दिखेगा।')}</div>
        )}
      </div>
      {open !== null && <StatusViewer owners={owners.filter((o) => o.updates.length)} startId={owners[open].id} shareOn={state.shareProgress} tr={tr} onClose={() => { setOpen(null); force((n) => n + 1); }} />}
    </div>
  );
};

/** Full-screen story viewer: tap right/left to move, auto-advances every 5 s. */
const StatusViewer: React.FC<{ owners: StatusOwner[]; startId: string; shareOn: boolean; tr: Tr; onClose: () => void }> = ({ owners, startId, shareOn, tr, onClose }) => {
  const [oi, setOi] = useState(Math.max(0, owners.findIndex((o) => o.id === startId)));
  const [ui, setUi] = useState(0);
  const [sharing, setSharing] = useState(shareOn);
  const owner = owners[oi];
  const update = owner?.updates[Math.min(ui, owner.updates.length - 1)];
  useEffect(() => { if (owner && update && !owner.isMe) markSeen(owner.id, owner.updates[owner.updates.length - 1].at); }, [owner, update]);
  const next = () => {
    if (!owner) return;
    if (ui < owner.updates.length - 1) setUi(ui + 1);
    else if (oi < owners.length - 1) { setOi(oi + 1); setUi(0); }
    else onClose();
  };
  const prev = () => { if (ui > 0) setUi(ui - 1); else if (oi > 0) { setOi(oi - 1); setUi(owners[oi - 1].updates.length - 1); } };
  useEffect(() => { const t = window.setTimeout(next, 5000); return () => window.clearTimeout(t); }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!owner || !update) return null;
  const msg = progressMessage(update.pct, tr);
  const r = 70, c = 2 * Math.PI * r;
  return createPortal(
    <AnimatePresence>
      <motion.div key="viewer" className="fixed inset-0 z-[80] flex items-center justify-center bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="status-story relative w-full h-full sm:max-w-sm sm:h-[90vh] sm:rounded-3xl overflow-hidden text-white">
          {/* progress bars */}
          <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
            {owner.updates.map((u, i) => (
              <span key={u.at} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
                <motion.span key={`${oi}-${ui}-${i}`} className="block h-full bg-white" initial={{ width: i < ui ? '100%' : '0%' }} animate={{ width: i <= ui ? '100%' : '0%' }} transition={{ duration: i === ui ? 5 : 0, ease: 'linear' }} />
              </span>
            ))}
          </div>
          {/* header */}
          <div className="absolute top-7 left-3 right-3 z-20 flex items-center gap-2.5">
            <span className="rounded-full border-2 border-white/80"><Face person={owner} size={38} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black truncate">{owner.isMe ? tr('My status', 'मेरा स्टेटस') : owner.name}</div>
              <div className="text-[11px] font-semibold text-white/75">{timeAgo(update.at, tr)}</div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/15 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          {/* tap zones */}
          <button type="button" aria-label="previous" onClick={prev} className="absolute left-0 top-20 bottom-28 w-1/3 z-10" />
          <button type="button" aria-label="next" onClick={next} className="absolute right-0 top-20 bottom-28 w-2/3 z-10" />
          {/* content */}
          <motion.div key={`${oi}-${ui}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="14" />
                <motion.circle cx="80" cy="80" r={r} fill="none" stroke="#fde68a" strokeWidth="14" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - update.pct / 100) }} transition={{ duration: 1, ease: 'easeOut' }} />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-5xl font-bold">{update.pct}%</span>
                <span className="text-[11px] font-bold text-white/80">{tr(`${update.done}/${update.total} steps`, `${update.done}/${update.total} कदम`)}</span>
              </span>
            </div>
            <div className="mt-6 text-2xl font-black">{msg.title}</div>
            <p className="mt-2 text-sm text-white/85 leading-relaxed">{update.text && update.text.trim() !== msg.title.replace(/[^\p{L}\p{N}\s!]/gu, '').trim() ? update.text : msg.body}</p>
            <div className="mt-4 px-3 py-1 rounded-full bg-white/15 text-xs font-black text-amber-200">1% better every day</div>
          </motion.div>
          {/* footer (my status only) */}
          {owner.isMe && (
            <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/50 to-transparent space-y-2">
              <button
                type="button"
                onClick={async () => { const next = !sharing; setSharing(next); await setFamilyShareProgress(next); window.dispatchEvent(new Event('urcare:family-status-changed')); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/15 border border-white/25 text-xs font-black cursor-pointer"
              >
                {sharing ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {sharing ? tr('Visible to your family & friends', 'आपके परिवार व दोस्तों को दिख रहा है') : tr('Only you can see this — tap to show your family', 'सिर्फ़ आप देख सकते हैं — परिवार को दिखाने के लिए टैप करें')}
              </button>
              <button type="button" onClick={() => shareProgressStory(update.pct, '', update.text || msg.body, tr)} className="w-full py-2.5 rounded-2xl bg-white text-emerald-800 text-xs font-black cursor-pointer">{tr('Share to WhatsApp / Instagram', 'WhatsApp / Instagram पर शेयर करें')}</button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

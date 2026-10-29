import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import {
  FamilyPerson, acceptFamilyCall, endFamilyCall, getFamilyCall, sendFamilyCallAnswer,
  sendFamilyCallCandidate, sendFamilyCallOffer,
} from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

interface FamilyCallModalProps {
  open: boolean;
  onClose: () => void;
  callId: string | null;
  person: FamilyPerson | null;
  /** 'outgoing' — we just started this call and are waiting for them to
   *  pick up. 'incoming' — they're calling us; shows Accept/Decline first. */
  mode: 'outgoing' | 'incoming';
}

/** Free public STUN only (no TURN/relay server) — enough for most home/
 *  mobile networks to find a direct path to each other, but a call can
 *  occasionally fail to connect on a strict/corporate network. Good enough
 *  for a first, entirely in-app voice call without standing up paid relay
 *  infrastructure. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** A real, in-app (never WhatsApp/SMS) voice call with one specific Health
 *  Circle member — plain WebRTC, signaled by polling one `family_calls` row
 *  every 1.5s (see server.ts /api/family/call/*). No background push: this
 *  only rings while the person has the app open somewhere, because the
 *  signal is this same poll, not a phone-style ring. */
export const FamilyCallModal: React.FC<FamilyCallModalProps> = ({ open, onClose, callId, person, mode }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [phase, setPhase] = useState<'incoming' | 'connecting' | 'live' | 'ended' | 'failed'>(mode === 'incoming' ? 'incoming' : 'connecting');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const appliedCandidatesRef = useRef(0);
  const remoteSetRef = useRef(false);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const cleanup = () => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    remoteSetRef.current = false;
    appliedCandidatesRef.current = 0;
  };

  const setupPeerConnection = (id: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.onicecandidate = (e) => { if (e.candidate) sendFamilyCallCandidate(id, e.candidate.toJSON()); };
    pc.ontrack = (e) => { if (audioRef.current) { audioRef.current.srcObject = e.streams[0]; audioRef.current.play().catch(() => {}); } };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setPhase('live');
      if (pc.connectionState === 'failed') setPhase('failed');
    };
    return pc;
  };

  const startAsCaller = async (id: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const pc = setupPeerConnection(id);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendFamilyCallOffer(id, offer);
    } catch {
      setErrorMsg(tr("Couldn't access your microphone.", 'माइक्रोफ़ोन एक्सेस नहीं हो सका।'));
      setPhase('failed');
    }
  };

  const acceptAsCallee = async () => {
    if (!callId) return;
    setPhase('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const pc = setupPeerConnection(callId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await acceptFamilyCall(callId);
      // The offer may not have landed in the row yet — poll briefly for it.
      let state = await getFamilyCall(callId);
      let tries = 0;
      while (!state?.offer && tries < 20) { await new Promise((r) => setTimeout(r, 300)); state = await getFamilyCall(callId); tries++; }
      if (!state?.offer) { setPhase('failed'); return; }
      await pc.setRemoteDescription(new RTCSessionDescription(state.offer));
      remoteSetRef.current = true;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendFamilyCallAnswer(callId, answer);
    } catch {
      setErrorMsg(tr("Couldn't access your microphone.", 'माइक्रोफ़ोन एक्सेस नहीं हो सका।'));
      setPhase('failed');
    }
  };

  const declineAsCallee = async () => {
    if (callId) await endFamilyCall(callId);
    setPhase('ended');
  };

  const hangUp = async () => {
    if (callId) await endFamilyCall(callId);
    cleanup();
    setPhase('ended');
  };

  // Outgoing call: dial immediately on open.
  useEffect(() => {
    if (!open || !callId || mode !== 'outgoing') return;
    setPhase('connecting');
    startAsCaller(callId);
    return cleanup;
  }, [open, callId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll the call row: pick up the answer, the other side's ICE candidates,
  // and hang up automatically the moment either side ends/declines.
  useEffect(() => {
    if (!open || !callId) return;
    pollRef.current = window.setInterval(async () => {
      const state = await getFamilyCall(callId);
      if (!state) return;
      if (state.status === 'declined' || state.status === 'ended') {
        cleanup();
        setPhase('ended');
        return;
      }
      const pc = pcRef.current;
      if (!pc) return;
      if (mode === 'outgoing' && state.answer && !remoteSetRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(state.answer));
        remoteSetRef.current = true;
      }
      if (remoteSetRef.current && Array.isArray(state.candidates)) {
        for (let i = appliedCandidatesRef.current; i < state.candidates.length; i++) {
          try { await pc.addIceCandidate(new RTCIceCandidate(state.candidates[i])); } catch {}
        }
        appliedCandidatesRef.current = state.candidates.length;
      }
    }, 1500);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [open, callId, mode]);

  // Call duration, once live.
  useEffect(() => {
    if (phase !== 'live') return;
    setSeconds(0);
    tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [phase]);

  useEffect(() => {
    if (!open) cleanup();
  }, [open]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  if (!open) return null;

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const name = person?.name || tr('Health Circle member', 'हेल्थ सर्कल सदस्य');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-gradient-to-b from-emerald-800 via-emerald-900 to-zinc-950 text-white py-10 px-6"
      >
        <audio ref={audioRef} autoPlay />

        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          {person?.avatar ? (
            <img src={person.avatar} alt="" referrerPolicy="no-referrer" className="w-28 h-28 rounded-full object-cover border-4 border-white/20 shadow-xl" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-white/15 border-4 border-white/20 flex items-center justify-center text-4xl font-black shadow-xl">{initials(name)}</div>
          )}
          <h2 className="text-xl font-black mt-2">{name}</h2>
          <p className="text-sm text-white/70 font-semibold">
            {phase === 'incoming' && tr('is calling you…', 'आपको कॉल कर रहे हैं…')}
            {phase === 'connecting' && tr('Connecting…', 'कनेक्ट हो रहा है…')}
            {phase === 'live' && mmss}
            {phase === 'ended' && tr('Call ended', 'कॉल समाप्त')}
            {phase === 'failed' && (errorMsg || tr("Couldn't connect — try again.", 'कनेक्ट नहीं हो पाया — फिर कोशिश करें।'))}
          </p>
          {phase === 'live' && <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300"><Volume2 className="w-3.5 h-3.5" />{tr('In-app voice call', 'ऐप के अंदर वॉइस कॉल')}</span>}
        </div>

        <div className="flex items-center gap-6 pb-4">
          {phase === 'incoming' ? (
            <>
              <button type="button" onClick={declineAsCallee} className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center shadow-xl cursor-pointer active:scale-95 transition-transform">
                <PhoneOff className="w-7 h-7" />
              </button>
              <button type="button" onClick={acceptAsCallee} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-xl cursor-pointer active:scale-95 transition-transform">
                <Phone className="w-7 h-7" />
              </button>
            </>
          ) : phase === 'ended' || phase === 'failed' ? (
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-full bg-white/15 hover:bg-white/25 text-sm font-black cursor-pointer">
              {tr('Close', 'बंद करें')}
            </button>
          ) : (
            <>
              <button type="button" onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl cursor-pointer active:scale-95 transition-transform ${muted ? 'bg-white text-emerald-900' : 'bg-white/15 hover:bg-white/25'}`}>
                {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              <button type="button" onClick={hangUp} className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center shadow-xl cursor-pointer active:scale-95 transition-transform">
                <PhoneOff className="w-7 h-7" />
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

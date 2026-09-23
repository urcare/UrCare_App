import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Paperclip, MessageCircleMore, RefreshCw, FileText, Phone, CheckCheck, X } from 'lucide-react';
import { ChatMessage } from '../types';
import { getMyChatThread, sendMyChatMessage, markMyChatRead, pingMyChatTyping, getCareTeamPhone } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

/** Three dots rising/brightening in a staggered wave — the universal
 *  "someone is typing" glyph, styled closer to WhatsApp's own than a flat
 *  bounce (see the typing-wave keyframe in index.css). */
const TypingDots: React.FC = () => (
  <span className="inline-flex items-center gap-1.5">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="typing-dot w-2 h-2 rounded-full bg-emerald-600"
        style={{ animationDelay: `${i * 0.2}s` }}
      />
    ))}
  </span>
);

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDayLabel(iso: string, tr: (en: string, hi: string) => string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return tr('Today', 'आज');
  if (isYesterday) return tr('Yesterday', 'कल');
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A support-style chat with the admin/doctor team — not user-to-user — laid
 *  out as a true full-screen takeover with a WhatsApp-style look: dark-green
 *  header, tan chat wallpaper, light-green outgoing bubbles / white incoming
 *  ones, and a working call button that dials the admin-set Care Team phone
 *  number. Polls every 2.5s while open (simple, no Supabase Realtime setup
 *  required) so a reply — and the typing indicator — show up live. */
export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [careTeamTyping, setCareTeamTyping] = useState(false);
  const [carePhone, setCarePhone] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingPingRef = useRef(0);

  const load = (showSpinner: boolean) => {
    if (showSpinner) setIsLoading(true);
    getMyChatThread().then((result) => {
      if (result) { setMessages(result.messages); setCareTeamTyping(result.otherTyping); }
      if (showSpinner) setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    load(true);
    markMyChatRead();
    getCareTeamPhone().then(setCarePhone);
    // 2.5s — fast enough for the typing indicator to feel live without a
    // real Supabase Realtime subscription.
    const interval = setInterval(() => load(false), 2500);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, careTeamTyping]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    const now = Date.now();
    // Throttled — no point pinging on every keystroke; once every 1.5s
    // while actively typing is plenty for a 4s server-side TTL.
    if (value.trim() && now - lastTypingPingRef.current > 1500) {
      lastTypingPingRef.current = now;
      pingMyChatTyping();
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { window.alert(tr('This file is too large (max 10MB).', 'यह फ़ाइल बहुत बड़ी है (अधिकतम 10MB)।')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) setAttachedFile({ url: reader.result as string, name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (!draft.trim() && !attachedFile) return;
    setIsSending(true);
    const { message, error } = await sendMyChatMessage({
      body: draft.trim() || undefined,
      fileUrl: attachedFile?.url,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type,
    });
    setIsSending(false);
    if (message) {
      setMessages((prev) => [...prev, message]);
      setDraft('');
      setAttachedFile(null);
    } else if (error) {
      window.alert(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#e5ddd5]">
      {/* WhatsApp-style tan wallpaper — a very light repeating dot texture
          instead of copying WhatsApp's own trademarked doodle graphic. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle, #d4cbc0 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        aria-hidden="true"
      />

      {/* HEADER — WhatsApp's dark teal-green bar. */}
      <div className="relative z-10 flex items-center gap-3 px-3 py-3 bg-[#075E54] text-white shrink-0 shadow-md">
        <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <MessageCircleMore className="w-5.5 h-5.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold truncate leading-tight">{tr('UrCare Care Team', 'UrCare केयर टीम')}</div>
          <div className="text-[11px] text-white/75 leading-tight">
            {careTeamTyping ? tr('typing...', 'टाइप कर रहे हैं...') : tr('online', 'ऑनलाइन')}
          </div>
        </div>
        {carePhone && (
          <a
            href={`tel:${carePhone.replace(/[^0-9+]/g, '')}`}
            title={tr('Call Care Team', 'केयर टीम को कॉल करें')}
            className="p-2 rounded-full hover:bg-white/10 cursor-pointer shrink-0"
          >
            <Phone className="w-5 h-5" />
          </a>
        )}
      </div>

      {/* MESSAGE LIST */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 md:px-16 lg:px-32 py-3 space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
            <MessageCircleMore className="w-10 h-10 text-zinc-400" />
            <p className="text-xs text-zinc-500 font-semibold">
              {tr('No messages yet — say hello to your care team.', 'अभी तक कोई संदेश नहीं — अपने केयर टीम को नमस्ते कहें।')}
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isUser = m.senderType === 'user';
            const prev = messages[i - 1];
            const showDay = !prev || formatDayLabel(prev.createdAt, tr) !== formatDayLabel(m.createdAt, tr);
            return (
              <React.Fragment key={m.id}>
                {showDay && (
                  <div className="flex justify-center py-2">
                    <span className="text-[11px] font-bold text-zinc-600 bg-white/90 shadow-sm px-3 py-1 rounded-lg">
                      {formatDayLabel(m.createdAt, tr)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] sm:max-w-[70%] px-2.5 pt-1.5 pb-1 rounded-lg shadow-sm ${
                      isUser ? 'bg-[#dcf8c6] text-zinc-900 rounded-tr-none' : 'bg-white text-zinc-900 rounded-tl-none'
                    }`}
                  >
                    {!isUser && m.senderName && (
                      <div className="text-[11px] font-black text-emerald-700 mb-0.5">{m.senderName}</div>
                    )}
                    {m.fileUrl && (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg mb-1 bg-black/5"
                      >
                        {m.fileType?.startsWith('image/') ? (
                          <img src={m.fileUrl} alt={m.fileName || ''} className="w-10 h-10 rounded-md object-cover shrink-0" />
                        ) : (
                          <FileText className="w-5 h-5 shrink-0 text-emerald-700" />
                        )}
                        <span className="text-[11px] font-bold truncate text-zinc-700">{m.fileName || tr('Attachment', 'अटैचमेंट')}</span>
                      </a>
                    )}
                    {m.body && <p className="text-[14.5px] leading-snug whitespace-pre-wrap break-words">{m.body}</p>}
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px] text-zinc-500">{formatTime(m.createdAt)}</span>
                      {isUser && <CheckCheck className="w-3.5 h-3.5 text-sky-500" />}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        {careTeamTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg rounded-tl-none px-3.5 py-3 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <div className="relative z-10 p-2 sm:p-3 bg-[#f0f0f0] shrink-0">
        {attachedFile && (
          <div className="flex items-center gap-2 p-2 mb-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-emerald-700">
            <Paperclip className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1">{attachedFile.name}</span>
            <button type="button" onClick={() => setAttachedFile(null)} className="shrink-0 cursor-pointer text-zinc-400 hover:text-rose-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-white rounded-full px-2 py-1.5 shadow-sm min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
            <input
              type="text"
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSend(); }}
              placeholder={tr('Message', 'संदेश')}
              className="flex-1 min-w-0 py-1.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || (!draft.trim() && !attachedFile)}
            className="shrink-0 w-11 h-11 rounded-full bg-[#075E54] hover:bg-[#0a6b5f] disabled:opacity-40 text-white flex items-center justify-center cursor-pointer shadow-md"
          >
            {isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

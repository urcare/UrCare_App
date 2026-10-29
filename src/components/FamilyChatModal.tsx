import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, RefreshCw, CheckCheck, MessageCircleMore, Phone } from 'lucide-react';
import { FamilyChatMessage, FamilyPerson, getFamilyChatMessages, sendFamilyChatMessage } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

interface FamilyChatModalProps {
  open: boolean;
  onClose: () => void;
  threadId: string | null;
  person: FamilyPerson | null;
  onCall?: () => void;
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
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

/** In-app chat with one specific Health Circle member — same WhatsApp-style
 *  look as the Care Team chat, but entirely between the two app accounts
 *  (never WhatsApp/SMS). Polls every 2.5s while open — no Realtime setup
 *  needed, same pattern as the Care Team chat. */
export const FamilyChatModal: React.FC<FamilyChatModalProps> = ({ open, onClose, threadId, person, onCall }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [messages, setMessages] = useState<FamilyChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = (showSpinner: boolean) => {
    if (!threadId) return;
    if (showSpinner) setIsLoading(true);
    getFamilyChatMessages(threadId).then((list) => {
      setMessages(list);
      if (showSpinner) setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!open || !threadId) return;
    load(true);
    const interval = setInterval(() => load(false), 2500);
    return () => clearInterval(interval);
  }, [open, threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  if (!open) return null;

  const handleSend = async () => {
    if (!draft.trim() || !threadId) return;
    setIsSending(true);
    const { message, error } = await sendFamilyChatMessage(threadId, draft.trim());
    setIsSending(false);
    if (message) { setMessages((prev) => [...prev, message]); setDraft(''); }
    else if (error) window.alert(error);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#e5ddd5]">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle, #d4cbc0 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center gap-3 px-3 py-3 bg-[#075E54] text-white shrink-0 shadow-md">
        <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {person?.avatar ? (
          <img src={person.avatar} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0 font-black">
            {(person?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold truncate leading-tight">{person?.name || tr('Chat', 'चैट')}</div>
          <div className="text-[11px] text-white/75 leading-tight">{tr('In-app chat', 'ऐप के अंदर चैट')}</div>
        </div>
        {onCall && (
          <button type="button" onClick={onCall} title={tr('Call', 'कॉल करें')} className="p-2 rounded-full hover:bg-white/10 cursor-pointer shrink-0">
            <Phone className="w-5 h-5" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 md:px-16 lg:px-32 py-3 space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><RefreshCw className="w-5 h-5 text-zinc-400 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
            <MessageCircleMore className="w-10 h-10 text-zinc-400" />
            <p className="text-xs text-zinc-500 font-semibold">{tr('No messages yet — say hello!', 'अभी तक कोई संदेश नहीं — नमस्ते कहें!')}</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay = !prev || formatDayLabel(prev.createdAt, tr) !== formatDayLabel(m.createdAt, tr);
            return (
              <React.Fragment key={m.id}>
                {showDay && (
                  <div className="flex justify-center py-2">
                    <span className="text-[11px] font-bold text-zinc-600 bg-white/90 shadow-sm px-3 py-1 rounded-lg">{formatDayLabel(m.createdAt, tr)}</span>
                  </div>
                )}
                <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] sm:max-w-[70%] px-2.5 pt-1.5 pb-1 rounded-lg shadow-sm ${m.mine ? 'bg-[#dcf8c6] text-zinc-900 rounded-tr-none' : 'bg-white text-zinc-900 rounded-tl-none'}`}>
                    <p className="text-[14.5px] leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px] text-zinc-500">{formatTime(m.createdAt)}</span>
                      {m.mine && <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      <div className="relative z-10 p-2 sm:p-3 bg-[#f0f0f0] shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm min-w-0">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSend(); }}
              placeholder={tr('Message', 'संदेश')}
              className="flex-1 min-w-0 py-1.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !draft.trim()}
            className="shrink-0 w-11 h-11 rounded-full bg-[#075E54] hover:bg-[#0a6b5f] disabled:opacity-40 text-white flex items-center justify-center cursor-pointer shadow-md"
          >
            {isSending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

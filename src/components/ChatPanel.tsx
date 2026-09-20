import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Paperclip, MessageCircle, RefreshCw, FileText } from 'lucide-react';
import { ChatMessage } from '../types';
import { getMyChatThread, sendMyChatMessage, markMyChatRead } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

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

/** A support-style chat with the admin/doctor team — not user-to-user.
 *  Polls every 4s while open (simple, no Supabase Realtime setup required)
 *  so a reply from the care team shows up without the user refreshing. */
export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = (showSpinner: boolean) => {
    if (showSpinner) setIsLoading(true);
    getMyChatThread().then((result) => {
      if (result) setMessages(result.messages);
      if (showSpinner) setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    load(true);
    markMyChatRead();
    const interval = setInterval(() => load(false), 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-md h-[88vh] sm:h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black truncate">{tr('Care Team Chat', 'केयर टीम चैट')}</div>
              <div className="text-[11px] text-white/80">{tr('Message your doctor / care team', 'अपने डॉक्टर / केयर टीम को संदेश भेजें')}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer shrink-0">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-zinc-50">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-5 h-5 text-zinc-300 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
              <MessageCircle className="w-8 h-8 text-zinc-300" />
              <p className="text-xs text-zinc-400 font-semibold">
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
                    <div className="flex justify-center py-1">
                      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200/60 px-2.5 py-1 rounded-full">
                        {formatDayLabel(m.createdAt, tr)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${isUser ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-md shadow-sm'}`}>
                      {!isUser && m.senderName && (
                        <div className="text-[10px] font-black text-emerald-600 mb-0.5">{m.senderName}</div>
                      )}
                      {m.fileUrl && (
                        <a
                          href={m.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 p-2 rounded-xl mb-1.5 ${isUser ? 'bg-white/15' : 'bg-zinc-50 border border-zinc-200'}`}
                        >
                          {m.fileType?.startsWith('image/') ? (
                            <img src={m.fileUrl} alt={m.fileName || ''} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          ) : (
                            <FileText className={`w-5 h-5 shrink-0 ${isUser ? 'text-white' : 'text-emerald-600'}`} />
                          )}
                          <span className={`text-[11px] font-bold truncate ${isUser ? 'text-white' : 'text-zinc-700'}`}>{m.fileName || tr('Attachment', 'अटैचमेंट')}</span>
                        </a>
                      )}
                      {m.body && <p className="text-sm leading-snug whitespace-pre-wrap break-words">{m.body}</p>}
                      <div className={`text-[9px] mt-1 ${isUser ? 'text-white/70' : 'text-zinc-400'}`}>{formatTime(m.createdAt)}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-zinc-100 bg-white shrink-0 space-y-2">
          {attachedFile && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1">{attachedFile.name}</span>
              <button type="button" onClick={() => setAttachedFile(null)} className="shrink-0 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center cursor-pointer"
            >
              <Paperclip className="w-4.5 h-4.5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSend(); }}
              placeholder={tr('Type a message...', 'संदेश लिखें...')}
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || (!draft.trim() && !attachedFile)}
              className="shrink-0 w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer"
            >
              {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

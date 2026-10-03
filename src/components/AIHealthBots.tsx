import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, X, Bot, Stethoscope, Leaf, Salad, Dumbbell, HeartPulse, Sprout, ShieldAlert, Trash2, Phone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { chatWithHealthBot, getHealthBotHistory, clearHealthBotHistory } from '../utils/supabase';
import { BotAvatar, BotLook } from './BotAvatar';
import { ensureAIConsent, AI_CONSENT_DECLINED_MESSAGE } from '../utils/aiConsent';

/** The six AI Health Bots. Names are made up and every one is labelled as an
 *  AI ("… Bot" + AI badge) — none of them is, or pretends to be, a real
 *  person. Their personalities live server-side (HEALTH_BOT_PERSONAS). */
const BOTS = [
  { id: 'sharma', name: 'Dr. Sharma Health Bot', role: ['General Health · MBBS track', 'सामान्य स्वास्थ्य · MBBS ट्रैक'], icon: Stethoscope, color: 'from-sky-500 to-blue-600', look: { gender: 'male', skin: '#e0ac69', hair: '#2b1b10', outfit: 'coat', outfitColor: '#0ea5e9', bg: ['#38bdf8', '#2563eb'] } as BotLook,
    hello: ["Namaste! I'm Dr. Sharma Health Bot, an AI health assistant. Tell me what's bothering you — when did it start and how is it affecting your day?", 'नमस्ते! मैं Dr. Sharma Health Bot हूँ, एक AI हेल्थ असिस्टेंट। बताइए क्या परेशानी है — कब से है और रोज़मर्रा पर कितना असर है?'],
    chips: [['Explain my report', 'मेरी रिपोर्ट समझाइए'], ['I feel tired all day', 'दिन भर थकान रहती है'], ['What should I check?', 'कौन से टेस्ट कराऊँ?']] },
  { id: 'mehra', name: 'Dr. Mehra Sugar Bot', role: ['Diabetes & Sugar · MBBS track', 'डायबिटीज़ व शुगर · MBBS ट्रैक'], icon: HeartPulse, color: 'from-rose-500 to-red-600', look: { gender: 'female', skin: '#f1c27d', hair: '#3b2416', outfit: 'coat', outfitColor: '#e11d48', bg: ['#fb7185', '#dc2626'], extras: ['glasses'] } as BotLook,
    hello: ["Hi, I'm Dr. Mehra Sugar Bot, an AI assistant for blood sugar. Share your latest fasting or after-meal reading and I'll help you make sense of it.", 'नमस्ते, मैं Dr. Mehra Sugar Bot हूँ, ब्लड शुगर के लिए AI असिस्टेंट। अपनी ताज़ा fasting या खाने के बाद की reading बताइए, मैं समझाने में मदद करूँगी।'],
    chips: [['My fasting sugar is high', 'मेरी fasting शुगर ज़्यादा है'], ['What is a good HbA1c?', 'अच्छा HbA1c कितना होता है?'], ['Sugar drops at night', 'रात में शुगर गिर जाती है']] },
  { id: 'joshi', name: 'Vaidya Joshi Ayur Bot', role: ['Ayurveda · BAMS track', 'आयुर्वेद · BAMS ट्रैक'], icon: Leaf, color: 'from-amber-500 to-orange-600', look: { gender: 'male', skin: '#c68642', hair: '#9ca3af', outfit: 'kurta', outfitColor: '#ea580c', bg: ['#fbbf24', '#ea580c'], extras: ['tilak', 'moustache'] } as BotLook,
    hello: ["Namaskar! I'm Vaidya Joshi Ayur Bot, an AI Ayurveda assistant. Tell me about your daily routine and digestion, and we'll find simple ways to bring balance.", 'नमस्कार! मैं वैद्य जोशी आयुर बॉट हूँ, एक AI आयुर्वेद असिस्टेंट। अपनी दिनचर्या और पाचन के बारे में बताइए, हम संतुलन के आसान उपाय ढूँढेंगे।'],
    chips: [['Ayurvedic daily routine', 'आयुर्वेदिक दिनचर्या'], ['Herbs for sugar — safe?', 'शुगर के लिए जड़ी-बूटी — सुरक्षित?'], ['Seasonal diet', 'मौसम के हिसाब से आहार']] },
  { id: 'iyer', name: 'Dr. Iyer Ayurveda Bot', role: ['Gut & Metabolism · BAMS track', 'पाचन व मेटाबॉलिज़्म · BAMS ट्रैक'], icon: Sprout, color: 'from-lime-500 to-green-600', look: { gender: 'female', skin: '#d29a63', hair: '#1f130b', outfit: 'kurta', outfitColor: '#16a34a', bg: ['#a3e635', '#16a34a'], extras: ['bindi'] } as BotLook,
    hello: ["Hello! I'm Dr. Iyer Ayurveda Bot, an AI assistant for gut health and metabolism. How is your appetite, digestion and sleep these days?", 'नमस्ते! मैं Dr. Iyer Ayurveda Bot हूँ, पाचन और मेटाबॉलिज़्म के लिए AI असिस्टेंट। आजकल भूख, पाचन और नींद कैसी है?'],
    chips: [['Bloating after meals', 'खाने के बाद पेट फूलता है'], ['Constipation', 'कब्ज़ की समस्या'], ['Improve metabolism', 'मेटाबॉलिज़्म कैसे बढ़ाएँ']] },
  { id: 'priya', name: 'Coach Priya Diet Bot', role: ['Diet & Nutrition Coach', 'डाइट व पोषण कोच'], icon: Salad, color: 'from-emerald-500 to-teal-600', look: { gender: 'female', skin: '#c68642', hair: '#2b1b10', outfit: 'tee', outfitColor: '#0d9488', bg: ['#34d399', '#0d9488'], extras: ['ponytail'] } as BotLook,
    hello: ["Hey! I'm Coach Priya Diet Bot, your AI diet coach. What did you eat today? I'll suggest easy swaps that fit your plan.", 'हाय! मैं Coach Priya Diet Bot हूँ, आपकी AI डाइट कोच। आज क्या खाया? मैं आपके प्लान के हिसाब से आसान बदलाव बताऊँगी।'],
    chips: [['What should I eat today?', 'आज क्या खाऊँ?'], ['Healthy Indian breakfast', 'हेल्दी भारतीय नाश्ता'], ['Snacks for sugar control', 'शुगर कंट्रोल के लिए स्नैक्स']] },
  { id: 'arjun', name: 'Coach Arjun Fitness Bot', role: ['Fitness, Yoga & Lifestyle', 'फिटनेस, योग व लाइफस्टाइल'], icon: Dumbbell, color: 'from-violet-500 to-purple-600', look: { gender: 'male', skin: '#d29a63', hair: '#111827', outfit: 'tee', outfitColor: '#7c3aed', bg: ['#a78bfa', '#7c3aed'] } as BotLook,
    hello: ["Hey champ! I'm Coach Arjun Fitness Bot, your AI fitness coach. How active are you right now? Let's build a routine you'll actually stick to.", 'हाय चैंपियन! मैं Coach Arjun Fitness Bot हूँ, आपका AI फिटनेस कोच। अभी आप कितने एक्टिव हैं? चलिए ऐसा रूटीन बनाएँ जो आप रोज़ कर सकें।'],
    chips: [['10-minute home workout', '10 मिनट का होम वर्कआउट'], ['Yoga for diabetes', 'डायबिटीज़ के लिए योग'], ['Walking plan', 'वॉकिंग प्लान']] },
] as const;

type ChatMsg = { role: 'user' | 'assistant'; content: string; at: string };

/** Renders the little formatting bots use — **bold** and "- " list items —
 *  without showing raw markdown symbols. */
const FormattedText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.replace(/^#{1,6}\s*/gm, '').replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2').split('\n').map((line, i) => {
      const isItem = /^\s*[-*•]\s+/.test(line);
      const body = isItem ? line.replace(/^\s*[-*•]\s+/, '') : line;
      const parts = body.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        /^\*\*[^*]+\*\*$/.test(part) ? <strong key={j}>{part.slice(2, -2)}</strong> : <React.Fragment key={j}>{part}</React.Fragment>
      );
      return isItem
        ? <div key={i} className="flex gap-1.5 pl-1"><span>•</span><span>{parts}</span></div>
        : <div key={i} className={line.trim() ? '' : 'h-2'}>{parts}</div>;
    })}
  </>
);
const MAX_SAVED = 80;

interface AIHealthBotsProps {
  userId: string;
  onClose: () => void;
  /** Opens the real care team (Doctor Hotline) — for anything that needs a person. */
  onOpenCareTeam: () => void;
}

/** Chats with the six AI Health Bots. Conversations are kept per account and
 *  per bot on this device. */
export const AIHealthBots: React.FC<AIHealthBotsProps> = ({ userId, onClose, onOpenCareTeam }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const pick = (pair: readonly [string, string]) => (language === 'hi' ? pair[1] : pair[0]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [chats, setChats] = useState<Record<string, ChatMsg[]>>({});
  const [draft, setDraft] = useState('');
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const storageKey = (botId: string) => `urcare_bot_chat_${userId}_${botId}`;

  // Chats load from the account (so they're the same on every device), with
  // this device's copy as the fallback until account storage is set up.
  useEffect(() => {
    const local: Record<string, ChatMsg[]> = {};
    for (const b of BOTS) {
      try { local[b.id] = JSON.parse(localStorage.getItem(storageKey(b.id)) || '[]'); } catch { local[b.id] = []; }
    }
    setChats(local);
    let cancelled = false;
    getHealthBotHistory().then(({ stored, chats: remote }) => {
      if (cancelled || !stored) return;
      const merged: Record<string, ChatMsg[]> = {};
      for (const b of BOTS) {
        const fromAccount = (remote[b.id] || []) as ChatMsg[];
        // Prefer the account copy; keep a device-only chat if the account has none yet.
        merged[b.id] = fromAccount.length ? fromAccount : local[b.id] || [];
        try { localStorage.setItem(storageKey(b.id), JSON.stringify(merged[b.id])); } catch {}
      }
      setChats(merged);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const saveChat = (botId: string, msgs: ChatMsg[]) => {
    const trimmed = msgs.slice(-MAX_SAVED);
    setChats((prev) => ({ ...prev, [botId]: trimmed }));
    try { localStorage.setItem(storageKey(botId), JSON.stringify(trimmed)); } catch {}
  };

  const active = useMemo(() => BOTS.find((b) => b.id === activeId) || null, [activeId]);
  const messages = activeId ? chats[activeId] || [] : [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, sendingFor, activeId]);

  const send = async (text: string) => {
    if (!active || !text.trim() || sendingFor) return;
    setError(null);
    if (!(await ensureAIConsent())) {
      setError(language === 'hi' ? AI_CONSENT_DECLINED_MESSAGE.hi : AI_CONSENT_DECLINED_MESSAGE.en);
      return;
    }
    const botId = active.id;
    const withUser: ChatMsg[] = [...(chats[botId] || []), { role: 'user', content: text.trim(), at: new Date().toISOString() }];
    saveChat(botId, withUser);
    setDraft('');
    setSendingFor(botId);
    const { reply, error: err } = await chatWithHealthBot(botId, withUser.map(({ role, content }) => ({ role, content })));
    setSendingFor(null);
    if (err || !reply) {
      setError(err || tr('No reply right now. Please try again.', 'अभी जवाब नहीं आया। कृपया दोबारा कोशिश करें।'));
      return;
    }
    saveChat(botId, [...withUser, { role: 'assistant', content: reply, at: new Date().toISOString() }]);
  };

  const clearChat = () => {
    if (!active) return;
    if (!window.confirm(tr('Clear this conversation?', 'यह बातचीत मिटाएँ?'))) return;
    saveChat(active.id, []);
    clearHealthBotHistory(active.id);
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString(language === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' });

  const Avatar: React.FC<{ bot: typeof BOTS[number]; size?: number }> = ({ bot, size = 46 }) => (
    <div className="relative shrink-0 rounded-full shadow-sm" style={{ width: size, height: size }}>
      <BotAvatar look={bot.look} size={size} id={bot.id} />
      <span className="absolute -bottom-0.5 -right-0.5 px-1 rounded-md bg-zinc-900 text-white text-[7px] font-black leading-[12px]">AI</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-4xl h-full sm:h-[85vh] bg-white sm:rounded-3xl shadow-2xl flex overflow-hidden">
        {/* Bot list */}
        <aside className={`${active ? 'hidden sm:flex' : 'flex'} w-full sm:w-80 flex-col border-r border-zinc-100`}>
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-zinc-950 flex items-center gap-2"><Bot className="w-5 h-5 text-emerald-600" /> {tr('AI Health Bots', 'AI हेल्थ बॉट्स')}</h2>
              <p className="text-[11px] text-zinc-500">{tr('Chat any time · powered by AI', 'कभी भी चैट करें · AI द्वारा संचालित')}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 cursor-pointer" aria-label={tr('Close', 'बंद करें')}><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {BOTS.map((bot) => {
              const last = (chats[bot.id] || []).slice(-1)[0];
              return (
                <button key={bot.id} type="button" onClick={() => { setActiveId(bot.id); setError(null); }}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-zinc-50 hover:bg-emerald-50/50 cursor-pointer ${activeId === bot.id ? 'bg-emerald-50' : ''}`}>
                  <Avatar bot={bot} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-zinc-900 truncate">{bot.name}</span>
                      {last && <span className="text-[10px] text-zinc-400 shrink-0">{time(last.at)}</span>}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">{last ? last.content : pick(bot.role)}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="p-3 m-3 rounded-2xl bg-amber-50 border border-amber-200 text-[10.5px] text-amber-900 leading-relaxed flex gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{tr('These are AI assistants, not real doctors. They give general guidance only. For a real doctor, use the Doctor Hotline.', 'ये AI असिस्टेंट हैं, असली डॉक्टर नहीं। ये सिर्फ़ सामान्य जानकारी देते हैं। असली डॉक्टर के लिए Doctor Hotline का उपयोग करें।')}</span>
          </div>
        </aside>

        {/* Conversation */}
        <section className={`${active ? 'flex' : 'hidden sm:flex'} flex-1 flex-col bg-[#efeae2] min-w-0`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <Bot className="w-12 h-12 text-emerald-600 mb-3" />
              <p className="text-sm font-bold text-zinc-700">{tr('Pick a bot to start chatting', 'चैट शुरू करने के लिए कोई बॉट चुनें')}</p>
            </div>
          ) : (
            <>
              <header className="bg-white px-3 py-2.5 flex items-center gap-3 border-b border-zinc-100 shrink-0">
                <button type="button" onClick={() => setActiveId(null)} className="sm:hidden p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer" aria-label={tr('Back', 'वापस')}><ArrowLeft className="w-5 h-5" /></button>
                <Avatar bot={active} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-zinc-950 truncate">{active.name}</div>
                  <div className="text-[11px] text-emerald-600 font-semibold truncate">
                    {sendingFor === active.id ? tr('typing…', 'लिख रहे हैं…') : `${tr('AI assistant', 'AI असिस्टेंट')} · ${pick(active.role)}`}
                  </div>
                </div>
                <button type="button" onClick={onOpenCareTeam} title={tr('Talk to a real doctor', 'असली डॉक्टर से बात करें')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black cursor-pointer hover:bg-emerald-500 shrink-0">
                  <Phone className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{tr('Real doctor', 'असली डॉक्टर')}</span>
                </button>
                <button type="button" onClick={clearChat} className="p-2 rounded-full hover:bg-zinc-100 cursor-pointer" title={tr('Clear chat', 'चैट मिटाएँ')}><Trash2 className="w-4 h-4 text-zinc-500" /></button>
                <button type="button" onClick={onClose} className="hidden sm:block p-2 rounded-full hover:bg-zinc-100 cursor-pointer" aria-label={tr('Close', 'बंद करें')}><X className="w-5 h-5" /></button>
              </header>

              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-2">
                <div className="mx-auto max-w-md text-center text-[10.5px] text-zinc-600 bg-[#fff8c5] rounded-lg px-3 py-1.5 shadow-sm">
                  {tr('AI assistant — not a human doctor. Not for emergencies: call 112.', 'AI असिस्टेंट — इंसानी डॉक्टर नहीं। इमरजेंसी में 112 पर कॉल करें।')}
                </div>
                {/* Greeting (not saved, not sent to the AI) */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] bg-white rounded-2xl rounded-tl-none px-3 py-2 shadow-sm text-[14px] text-zinc-900 leading-snug">{pick(active.hello)}</div>
                </div>
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm text-[14px] leading-snug whitespace-pre-wrap break-words ${
                      m.role === 'user' ? 'bg-[#dcf8c6] rounded-tr-none text-zinc-900' : 'bg-white rounded-tl-none text-zinc-900'
                    }`}>
                      {m.role === 'assistant' ? <FormattedText text={m.content} /> : m.content}
                      <div className="text-[10px] text-zinc-500 text-right mt-0.5">{time(m.at)}</div>
                    </div>
                  </div>
                ))}
                {sendingFor === active.id && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                {error && <p className="text-center text-xs font-bold text-rose-600">{error}</p>}
                <div ref={endRef} />
              </div>

              {messages.length === 0 && (
                <div className="px-3 pb-2 flex gap-2 overflow-x-auto shrink-0">
                  {active.chips.map((c) => (
                    <button key={c[0]} type="button" onClick={() => send(pick(c))}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-emerald-700 text-xs font-bold shadow-sm cursor-pointer hover:bg-emerald-50">
                      {pick(c)}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); send(draft); }}
                className="bg-[#f0f2f5] px-3 py-2 flex items-end gap-2 shrink-0"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); } }}
                  rows={1}
                  placeholder={tr('Type a message', 'मैसेज लिखें')}
                  className="flex-1 resize-none max-h-32 rounded-2xl bg-white px-4 py-2.5 text-[14px] text-zinc-900 focus:outline-none"
                />
                <button type="submit" disabled={!draft.trim() || !!sendingFor}
                  className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, Star, Send, RefreshCw, CheckCircle2, MessageSquareHeart } from 'lucide-react';
import { submitAppFeedback } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

interface AppFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { id: string; label: [string, string] }[] = [
  { id: 'plan', label: ['Daily Plan', 'डेली प्लान'] },
  { id: 'scan', label: ['Food Scan', 'फूड स्कैन'] },
  { id: 'store', label: ['Store', 'स्टोर'] },
  { id: 'tracker', label: ['Tracker', 'ट्रैकर'] },
  { id: 'chat', label: ['Chat / Doctor', 'चैट / डॉक्टर'] },
  { id: 'design', label: ['Look & Feel', 'लुक और फील'] },
  { id: 'other', label: ['Other', 'अन्य'] },
];

const HELPING: { id: 'yes' | 'somewhat' | 'no'; label: [string, string] }[] = [
  { id: 'yes', label: ['Yes, a lot', 'हां, काफी'] },
  { id: 'somewhat', label: ['Somewhat', 'कुछ हद तक'] },
  { id: 'no', label: ['Not really', 'बिल्कुल नहीं'] },
];

/** Lets a user say whether the app is actually helping them and what is
 *  missing — stored in app_feedback and shown to admins in their Feedback
 *  tab. Separate from the per-cycle clinical check-in. */
export const AppFeedbackModal: React.FC<AppFeedbackModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [rating, setRating] = useState(0);
  const [isHelping, setIsHelping] = useState<'yes' | 'somewhat' | 'no' | ''>('');
  const [category, setCategory] = useState('other');
  const [whatHelps, setWhatHelps] = useState('');
  const [whatLacking, setWhatLacking] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setRating(0); setIsHelping(''); setCategory('other'); setWhatHelps(''); setWhatLacking('');
    setError(null); setDone(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!rating) { setError(tr('Please pick a star rating.', 'कृपया स्टार रेटिंग चुनें।')); return; }
    if (!isHelping) { setError(tr('Please tell us if the app is helping you.', 'कृपया बताएं कि ऐप आपकी मदद कर रहा है या नहीं।')); return; }
    if (!whatHelps.trim() && !whatLacking.trim()) { setError(tr('Please write what helps or what is missing.', 'कृपया लिखें क्या मदद करता है या क्या कमी है।')); return; }
    setError(null);
    setIsSending(true);
    const { error: err } = await submitAppFeedback({ rating, isHelping, whatHelps, whatLacking, category });
    setIsSending(false);
    if (err) { setError(err); return; }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-2.5">
            <MessageSquareHeart className="w-5 h-5" />
            <div>
              <div className="text-sm font-black">{tr('Share Your Feedback', 'अपनी प्रतिक्रिया दें')}</div>
              <div className="text-[11px] text-white/80">{tr('Help us make UrCare better for you', 'UrCare को बेहतर बनाने में मदद करें')}</div>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-black text-zinc-900">{tr('Thank you!', 'धन्यवाद!')}</h3>
            <p className="text-sm text-zinc-500">{tr('Your feedback has reached our team.', 'आपकी प्रतिक्रिया हमारी टीम तक पहुंच गई है।')}</p>
            <button type="button" onClick={handleClose} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wide cursor-pointer">{tr('Close', 'बंद करें')}</button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div>
              <label className="block text-xs font-black text-zinc-700 mb-2">{tr('How would you rate UrCare overall?', 'आप UrCare को कैसे रेट करेंगे?')}</label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} className="cursor-pointer">
                    <Star className={`w-8 h-8 transition-colors ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-2">{tr('Is this app helping you?', 'क्या यह ऐप आपकी मदद कर रहा है?')}</label>
              <div className="grid grid-cols-3 gap-2">
                {HELPING.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setIsHelping(h.id)}
                    className={`py-2.5 rounded-xl text-xs font-black border cursor-pointer transition-colors ${
                      isHelping === h.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-emerald-300'
                    }`}
                  >
                    {tr(h.label[0], h.label[1])}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-2">{tr('Which part is this about?', 'यह किस हिस्से के बारे में है?')}</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
                      category === c.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-emerald-300'
                    }`}
                  >
                    {tr(c.label[0], c.label[1])}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-1.5">{tr('What helps you the most?', 'आपको सबसे ज़्यादा क्या मदद करता है?')}</label>
              <textarea
                rows={3}
                value={whatHelps}
                onChange={(e) => setWhatHelps(e.target.value)}
                placeholder={tr('e.g. the daily plan keeps me on track', 'जैसे डेली प्लान मुझे सही रास्ते पर रखता है')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-emerald-600 resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-1.5">{tr('What is missing or could be better?', 'क्या कमी है या क्या बेहतर हो सकता है?')}</label>
              <textarea
                rows={3}
                value={whatLacking}
                onChange={(e) => setWhatLacking(e.target.value)}
                placeholder={tr('Tell us what you wish this app could do', 'बताएं कि आप इस ऐप से और क्या चाहते हैं')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-emerald-600 resize-y"
              />
            </div>

            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSending}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSending ? tr('Sending...', 'भेजा जा रहा है...') : tr('Send Feedback', 'प्रतिक्रिया भेजें')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { AIConsentRequest, onAIConsentRequest, saveAIConsent } from '../utils/aiConsent';
import { LEGAL_PAGES, openExternalPage } from '../utils/externalPages';

/** Mounted once (App.tsx). Shows the one-time "your data goes to an AI
 *  service" permission prompt whenever ensureAIConsent() asks for it. */
export const AIConsentGate: React.FC = () => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [pending, setPending] = useState<AIConsentRequest[]>([]);

  useEffect(() => onAIConsentRequest((request) => setPending((prev) => [...prev, request])), []);

  if (pending.length === 0) return null;

  const answer = (granted: boolean) => {
    saveAIConsent(granted);
    pending.forEach((request) => request.resolve(granted));
    setPending([]);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-zinc-900">
          {tr('Allow AI analysis?', 'AI विश्लेषण की अनुमति दें?')}
        </h2>
        <div className="text-sm text-zinc-600 space-y-2">
          <p>
            {tr(
              'To analyze your lab reports, meal photos and daily plans, UrCare sends the file or text you choose to our AI providers — Anthropic (Claude) and Groq — over an encrypted connection.',
              'आपकी लैब रिपोर्ट, खाने की फोटो और डेली प्लान का विश्लेषण करने के लिए UrCare आपकी चुनी हुई फ़ाइल या टेक्स्ट को एन्क्रिप्टेड कनेक्शन से हमारे AI प्रदाताओं — Anthropic (Claude) और Groq — को भेजता है।'
            )}
          </p>
          <p>
            {tr(
              'They process it only to return the result to you and do not use it to train their models. Nothing is sent until you tap Allow.',
              'वे इसे केवल आपको परिणाम देने के लिए प्रोसेस करते हैं और इससे अपने मॉडल ट्रेन नहीं करते। जब तक आप "अनुमति दें" नहीं दबाते, कुछ नहीं भेजा जाता।'
            )}
          </p>
          <button
            type="button"
            onClick={() => openExternalPage(LEGAL_PAGES.privacy)}
            className="text-emerald-700 font-bold underline cursor-pointer"
          >
            {tr('Read our Privacy Policy', 'हमारी गोपनीयता नीति पढ़ें')}
          </button>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => answer(false)}
            className="flex-1 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-sm cursor-pointer"
          >
            {tr('Not now', 'अभी नहीं')}
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm cursor-pointer"
          >
            {tr('Allow', 'अनुमति दें')}
          </button>
        </div>
      </div>
    </div>
  );
};

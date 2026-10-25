import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Lock, CalendarClock } from 'lucide-react';
import { authedFetch } from '../utils/supabase';

/** UrCare AI features limited to once a week (server-enforced). The food scan is unlimited. */
export type AiFeature = 'report' | 'plan_upload' | 'ai_plan' | 'alternative';

const NAMES: Record<AiFeature, [string, string]> = {
  report: ['report analysis', 'रिपोर्ट एनालिसिस'],
  plan_upload: ['plan upload', 'प्लान अपलोड'],
  ai_plan: ['AI plan', 'AI प्लान'],
  alternative: ['AI alternative', 'AI विकल्प'],
};

type Ask = { feature: AiFeature; available: boolean; nextAt: string | null; tr: (en: string, hi: string) => string; resolve: (ok: boolean) => void };
const EVENT = 'urcare:ai-confirm';

const fmtDate = (d: Date, hi: boolean) => d.toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** Before using an AI feature: tells the person this is their one use this
 *  week (and when the next one opens), or that it's already used. Resolves
 *  true only when they choose to go ahead. */
export async function confirmAiUse(feature: AiFeature, tr: (en: string, hi: string) => string): Promise<boolean> {
  let available = true;
  let nextAt: string | null = null;
  try {
    const res = await authedFetch('/api/ai-quota');
    const data = await res.json();
    const f = data?.features?.[feature];
    if (f) { available = !!f.available; nextAt = f.nextAt || null; }
  } catch {
    // Offline or server busy — let the server decide.
    return true;
  }
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { feature, available, nextAt, tr, resolve } as Ask }));
  });
}

/** Mount once (Dashboard). Shows the weekly-use popup. */
export const AiUseConfirmHost: React.FC = () => {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    const on = (e: Event) => setAsk((e as CustomEvent).detail as Ask);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const close = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };
  const tr = ask?.tr || ((en: string) => en);
  const hi = tr('en', 'hi') === 'hi';
  const name = ask ? tr(...NAMES[ask.feature]) : '';
  const nextUse = ask?.available ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : ask?.nextAt ? new Date(ask.nextAt) : null;

  return createPortal(
    <AnimatePresence>
      {ask && (
        <motion.div className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 text-left"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${ask.available ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
              {ask.available ? <Sparkles className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            {ask.available ? (
              <>
                <h3 className="mt-3 text-lg font-black text-zinc-900">{tr(`Use this week's ${name}?`, `इस हफ़्ते का ${name} इस्तेमाल करें?`)}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">
                  {tr(`You get one ${name} each week. Once you use it, you can't use it again until next week.`, `हर हफ़्ते एक ${name} मिलता है। इस्तेमाल करने के बाद अगले हफ़्ते तक दोबारा नहीं कर पाएंगे।`)}
                </p>
              </>
            ) : (
              <>
                <h3 className="mt-3 text-lg font-black text-zinc-900">{tr(`This week's ${name} is used`, `इस हफ़्ते का ${name} हो चुका है`)}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{tr('You can use it once a week.', 'इसे हफ़्ते में एक बार इस्तेमाल कर सकते हैं।')}</p>
              </>
            )}
            {nextUse && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[13px] font-bold text-amber-800">
                <CalendarClock className="w-4 h-4 shrink-0" />
                {ask.available ? tr(`Next one after this: ${fmtDate(nextUse, hi)}`, `इसके बाद अगला: ${fmtDate(nextUse, hi)}`) : tr(`Available again: ${fmtDate(nextUse, hi)}`, `फिर से मिलेगा: ${fmtDate(nextUse, hi)}`)}
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {ask.available ? (
                <>
                  <button type="button" onClick={() => close(false)} className="py-3 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-700 cursor-pointer">{tr('Not now', 'अभी नहीं')}</button>
                  <button type="button" onClick={() => close(true)} className="py-3 rounded-2xl bg-brand-gradient text-white text-sm font-black cursor-pointer">{tr('Yes, use it', 'हां, इस्तेमाल करें')}</button>
                </>
              ) : (
                <button type="button" onClick={() => close(false)} className="col-span-2 py-3 rounded-2xl bg-brand-gradient text-white text-sm font-black cursor-pointer">{tr('OK', 'ठीक है')}</button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

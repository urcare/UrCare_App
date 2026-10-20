import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { authedFetch } from '../utils/supabase';
import { ensureAIConsent } from '../utils/aiConsent';
import { getPlanSettings } from './PlanSettingsAndLogs';

interface Option { title: string; body: string; why?: string; calories?: number | null }

interface PlanAlternativeProps {
  stepId: string;
  dateKey: string;
  title: string;
  body: string;
  kind: 'meal' | 'exercise';
  profile: UserHealthProfile;
  language: string;
  isDark: boolean;
  tr: (en: string, hi: string) => string;
}

/** The step's details with ← / → to flip between the plan's own option and
 *  AI alternatives for THIS item only (similar calories / effort, suited to
 *  the user's profile). Alternatives are kept for the day on this device. */
export const PlanAlternative: React.FC<PlanAlternativeProps> = ({ stepId, dateKey, title, body, kind, profile, language, isDark, tr }) => {
  const storageKey = `urcare_alt_${dateKey}_${stepId}`;
  const [alts, setAlts] = useState<Option[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved?.alts) { setAlts(saved.alts); setIndex(saved.index || 0); }
    } catch {}
  }, [storageKey]);
  const persist = (a: Option[], i: number) => { try { localStorage.setItem(storageKey, JSON.stringify({ alts: a, index: i })); } catch {} };

  const options: Option[] = [{ title, body }, ...alts];
  const current = options[Math.min(index, options.length - 1)];

  const next = async () => {
    setError(null);
    if (index < options.length - 1) { setIndex(index + 1); persist(alts, index + 1); return; }
    if (!(await ensureAIConsent())) return;
    setLoading(true);
    try {
      const res = await authedFetch('/api/plan/alternative', {
        method: 'POST',
        body: JSON.stringify({
          title, body, kind, language,
          exclude: options.map((o) => o.title),
          profile: { age: profile.age, gender: profile.gender, dietaryPreference: profile.dietaryPreference, medicalConditions: profile.medicalConditions, goal: profile.goal, calculatedPlan: profile.calculatedPlan },
          settings: getPlanSettings(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || !data.title) throw new Error(data.error || 'failed');
      const updated = [...alts, { title: data.title, body: data.body, why: data.why, calories: data.calories }];
      setAlts(updated);
      setIndex(updated.length);
      persist(updated, updated.length);
    } catch {
      setError(tr('Could not get an alternative right now. Try again.', 'अभी विकल्प नहीं मिला। फिर कोशिश करें।'));
    } finally {
      setLoading(false);
    }
  };
  const prev = () => { if (index > 0) { setIndex(index - 1); persist(alts, index - 1); } };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} disabled={index === 0} aria-label={tr('Previous option', 'पिछला विकल्प')} className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 disabled:opacity-30 cursor-pointer shrink-0"><ChevronLeft className="w-4 h-4" /></button>
        <div className="min-w-0 flex-1 text-center">
          <div className={`text-[10px] font-black uppercase tracking-wider ${index === 0 ? 'text-zinc-400' : 'text-violet-600'}`}>
            {index === 0 ? tr('Your plan', 'आपका प्लान') : tr(`AI alternative ${index}`, `AI विकल्प ${index}`)}
            {options.length > 1 && <span className="text-zinc-300"> · {index + 1}/{options.length}</span>}
          </div>
          {index > 0 && <div className="text-xs sm:text-sm font-black text-zinc-900 leading-snug">{current.title}</div>}
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} disabled={loading} aria-label={tr('Show an alternative', 'विकल्प दिखाएं')} className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-md shadow-violet-500/30 cursor-pointer shrink-0 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      {index === 0 && !alts.length && (
        <p className="text-center text-[10px] font-semibold text-violet-600 flex items-center justify-center gap-1"><Sparkles className="w-3 h-3" />{kind === 'meal' ? tr("Don't like this? Tap → for a similar meal", 'पसंद नहीं? मिलते-जुलते खाने के लिए → दबाएं') : tr("Can't do this? Tap → for a similar exercise", 'नहीं कर सकते? मिलती-जुलती एक्सरसाइज़ के लिए → दबाएं')}</p>
      )}
      <AnimatePresence mode="wait">
        <motion.div key={index} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className={index > 0 ? 'p-3 rounded-xl bg-violet-50/70 border border-violet-100' : ''}>
          {current.body && <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line break-words ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{current.body}</p>}
          {index > 0 && (current.why || current.calories) && (
            <p className="mt-1.5 text-[11px] font-semibold text-violet-700">
              {current.calories ? `≈ ${Math.round(current.calories)} kcal · ` : ''}{current.why}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
      {error && <p className="text-[11px] font-semibold text-rose-600 text-center">{error}</p>}
    </div>
  );
};

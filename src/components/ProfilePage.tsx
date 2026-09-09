import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, BadgeCheck } from 'lucide-react';
import { UserHealthProfile, UserAccount, Prescription } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { RecommendationsView, REVERSAL_GOALS, DEFAULT_REVERSAL_GOAL } from './RecommendationsView';
import { ReversalLibraryPanel, PlanSection } from './ReversalLibraryPanel';
import { StreakWidget } from './StreakWidget';

// Hindi for the primary reversal-goal label used in the greeting subtitle —
// same English keys/values as REVERSAL_GOALS (see AccountPage's own copy).
const GOAL_LABEL_HI: Record<string, string> = {
  'Diabetes Reversal': 'डायबिटीज रिवर्सल', 'Weight Reversal': 'वज़न रिवर्सल', 'Blood Pressure Control': 'ब्लड प्रेशर नियंत्रण',
  'Liver & Lipid Reversal': 'लिवर व लिपिड रिवर्सल', 'Thyroid Balance': 'थायरॉइड संतुलन', 'Hormonal Reversal': 'हार्मोनल रिवर्सल',
  'Nerve Health': 'नस स्वास्थ्य', 'Eye Health Support': 'आंखों के स्वास्थ्य हेतु सहयोग', 'Heart Reversal': 'हृदय रिवर्सल',
  'Kidney Reversal': 'किडनी रिवर्सल', 'Joint & Mobility Support': 'जोड़ व गतिशीलता सहयोग', 'Energy Restoration': 'ऊर्जा पुनर्स्थापन',
  'Sleep Quality Support': 'नींद गुणवत्ता सहयोग', 'Vascular Health': 'रक्त वाहिका स्वास्थ्य', 'Uric Acid Reversal': 'यूरिक एसिड रिवर्सल',
  'Gut Health Reversal': 'आंत स्वास्थ्य रिवर्सल', 'Metabolic Health': 'मेटाबॉलिक स्वास्थ्य',
};

interface ProfilePageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  prescriptions?: Prescription[];
  /** Jumps to the standalone Profile tab (full identity/stats/edit page). */
  onOpenProfile: () => void;
}

/** "Your Daily Plan" — the app's default/main screen. The condition-specific
 *  reference library is fetched inside RecommendationsView (it already knows
 *  the day's plan) and lifted up here so it can render statically in the
 *  sidebar instead of inline in the scrolling daily-plan column. */
export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  account,
  prescriptions = [],
  onOpenProfile,
}) => {
  const { t, language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [referenceSections, setReferenceSections] = useState<PlanSection[]>([]);

  // Time-of-day greeting, and the same real condition-derived reversal focus
  // AccountPage leads with — reused here just for the subtitle line, so it
  // never claims a condition the user doesn't actually have.
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? tr('Good Morning', 'सुप्रभात') : hour < 17 ? tr('Good Afternoon', 'नमस्कार') : tr('Good Evening', 'शुभ संध्या');
  }, [language]);
  const firstName = (profile.name || account.displayName || '').trim().split(/\s+/)[0];
  const primaryGoal = useMemo(() => {
    const conditions = (profile.medicalConditions || []).filter((c) => c !== 'None' && c !== 'Other');
    const goal = conditions.map((c) => REVERSAL_GOALS[c]).find(Boolean);
    return goal || DEFAULT_REVERSAL_GOAL;
  }, [profile.medicalConditions]);

  return (
    <div id="urcare-profile-page" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16">

      {/* Top Header — no logo here on purpose: Dashboard's own sidebar/mobile
          header already shows the UrCare brand (and the '⋮' module switcher)
          on every tab, so repeating either here just looked like it was
          printed twice on the same screen. This bar only titles the page. */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-3 sm:px-8 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-emerald-700 tracking-wide whitespace-nowrap">{t('navHome')}</span>
          </div>
        </div>
      </header>

      {/* Main Container — a two-column dashboard on wide screens: the daily
          plan is the one thing in the main column (the actual "main focus"
          for today), while the reversal reference library sits statically in
          a sticky sidebar on the right, always in view rather than requiring
          a menu. On narrow screens it stacks: plan first, library below. */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-4 space-y-5 text-left">

        {/* Personal greeting hero — a warm "who's plan this is" opener above
            the plan itself, with today's streak at a glance. Tapping it
            still opens the full identity card on the standalone Profile
            tab, same as the old compact strip did. */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200 shadow-sm flex items-center gap-3"
        >
          <button
            type="button"
            onClick={onOpenProfile}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-base font-black shadow-xs overflow-hidden shrink-0 cursor-pointer"
          >
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (profile.name || account.displayName || 'U').charAt(0).toUpperCase()
            )}
          </button>

          <button type="button" onClick={onOpenProfile} className="min-w-0 flex-1 text-left cursor-pointer">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm sm:text-base font-black text-zinc-950 truncate">
                {greeting}{firstName ? `, ${firstName}` : ''} <span className="inline-block">👋</span>
              </h2>
              <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/15 shrink-0" strokeWidth={2.5} />
            </div>
            <p className="text-[11px] text-zinc-500 font-semibold truncate mt-0.5">
              {tr('Small steps.', 'छोटे कदम।')} {tr(primaryGoal.label, GOAL_LABEL_HI[primaryGoal.label] || primaryGoal.label)} {tr('is on track.', 'सही दिशा में है।')}
            </p>
          </button>

          <div className="shrink-0">
            <StreakWidget profile={profile} />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">

          <div className="min-w-0">
            <RecommendationsView
              profile={profile}
              prescriptions={prescriptions}
              onReferenceSections={setReferenceSections}
            />
          </div>

          <aside className="min-w-0 xl:sticky xl:top-20">
            <ReversalLibraryPanel sections={referenceSections} />
          </aside>
        </div>
      </main>

    </div>
  );
};

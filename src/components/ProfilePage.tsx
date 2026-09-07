import React, { useState } from 'react';
import { Sparkles, Mail, BadgeCheck, Edit3 } from 'lucide-react';
import { UserHealthProfile, UserAccount, Prescription } from '../types';
import { useLanguage, LanguageSwitchButton } from '../context/LanguageContext';
import { RecommendationsView } from './RecommendationsView';
import { ReversalLibraryPanel, PlanSection } from './ReversalLibraryPanel';

interface ProfilePageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  prescriptions?: Prescription[];
  onOpenDoctorConsult: () => void;
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
  onOpenDoctorConsult,
  onOpenProfile,
}) => {
  const { t } = useLanguage();
  const [referenceSections, setReferenceSections] = useState<PlanSection[]>([]);

  return (
    <div id="urcare-profile-page" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16">

      {/* Top Header — no logo here on purpose: Dashboard's own sidebar/mobile
          header already shows the UrCare brand (and the '⋮' module switcher)
          on every tab, so repeating either here just looked like it was
          printed twice on the same screen. This bar only titles the page. */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-3 sm:px-8 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-emerald-700 tracking-wide whitespace-nowrap">{t('navHome')}</span>
          </div>

          <div className="flex items-center justify-end shrink-0">
            <LanguageSwitchButton />
          </div>
        </div>
      </header>

      {/* Main Container — a two-column dashboard on wide screens: the daily
          plan is the one thing in the main column (the actual "main focus"
          for today), while the reversal reference library sits statically in
          a sticky sidebar on the right, always in view rather than requiring
          a menu. On narrow screens it stacks: plan first, library below. */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-4 space-y-5 text-left">

        {/* A compact identity strip — a quick "who's plan this is" glance
            above the plan itself. Deliberately slimmer than the full
            identity card on the standalone Profile tab (opened via the edit
            button here) rather than a duplicate of it. */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full p-4 rounded-3xl bg-white border border-zinc-200 shadow-sm flex items-center gap-3.5 text-left transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-base font-black shadow-xs overflow-hidden shrink-0">
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (profile.name || account.displayName || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-black text-zinc-950 truncate">{profile.name || account.displayName || 'UrCare Member'}</h2>
              <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/15 shrink-0" strokeWidth={2.5} />
            </div>
            {profile.email && (
              <p className="flex items-center gap-1 text-[11px] text-zinc-500 font-medium truncate mt-0.5">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </p>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-50 group-hover:bg-emerald-50 text-zinc-500 group-hover:text-emerald-600 flex items-center justify-center shrink-0 transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
          </div>
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">

          <div className="min-w-0">
            <RecommendationsView
              profile={profile}
              prescriptions={prescriptions}
              onOpenConsultDoctor={onOpenDoctorConsult}
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

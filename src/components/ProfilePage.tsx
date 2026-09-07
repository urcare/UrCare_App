import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { UserHealthProfile, Prescription } from '../types';
import { useLanguage, LanguageSwitchButton } from '../context/LanguageContext';
import { RecommendationsView } from './RecommendationsView';
import { ReversalLibraryPanel, PlanSection } from './ReversalLibraryPanel';

interface ProfilePageProps {
  profile: UserHealthProfile;
  prescriptions?: Prescription[];
  onOpenDoctorConsult: () => void;
}

/** "Your Daily Plan" — the app's default/main screen. The condition-specific
 *  reference library is fetched inside RecommendationsView (it already knows
 *  the day's plan) and lifted up here so it can render statically in the
 *  sidebar instead of inline in the scrolling daily-plan column. */
export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  prescriptions = [],
  onOpenDoctorConsult,
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-4 text-left">
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

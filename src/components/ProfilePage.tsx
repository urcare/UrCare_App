import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Bell, ChevronRight, Camera, FileText, BookOpen, ShoppingBag, Utensils, Sparkles, Leaf, MoreVertical } from 'lucide-react';
import { UserHealthProfile, UserAccount, Prescription } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { RecommendationsView, REVERSAL_GOALS, DEFAULT_REVERSAL_GOAL, labelMinutes } from './RecommendationsView';
import { ReversalLibraryPanel, PlanSection } from './ReversalLibraryPanel';
import { StreakWidget } from './StreakWidget';
import { BrandMark } from './Logo';
import { getDailyPlan, getTaskCompletion } from '../utils/supabase';
import { toDateKey } from './DailyCalendar';

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
  /** Jumps to the full Daily Plan timeline tab. */
  onOpenPlan: () => void;
  /** Jumps to the UrCare Camera (food scanner) tab. */
  onOpenScan: () => void;
  /** Jumps to the Reports tab. */
  onOpenReports: () => void;
  /** Jumps to the Store tab. */
  onOpenStore: () => void;
  /** Opens the '⋮' module drawer (Assessment/Store/Settings/Sign Out) —
   *  Home has its own full header instead of the shared one every other tab
   *  uses, so it needs its own trigger for the same drawer. */
  onOpenMoreMenu: () => void;
}

/** "Home" — a calm, focused landing summary: today's next step, this
 *  program's overall progress, and one-tap shortcuts to everywhere else.
 *  The full day-by-day timeline lives on its own Plan tab now. */
export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  account,
  prescriptions = [],
  onOpenProfile,
  onOpenPlan,
  onOpenScan,
  onOpenReports,
  onOpenStore,
  onOpenMoreMenu,
}) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const userId = profile.id || '';
  const todayKey = toDateKey(new Date());

  const [programDay, setProgramDay] = useState<number | null>(null);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getDailyPlan(todayKey).then((result) => {
      if (cancelled) return;
      setProgramDay(result.plan?.programDay ?? null);
      setSections(result.plan?.sections || []);
    });
    getTaskCompletion(userId, todayKey).then((c) => { if (!cancelled) setCompletedToday(c); });
    return () => { cancelled = true; };
  }, [userId, todayKey]);

  const timelineSections = useMemo(() => sections.filter((s) => !!s.timeLabel), [sections]);
  const referenceSections = useMemo(() => sections.filter((s) => !s.timeLabel), [sections]);
  const doneCount = timelineSections.filter((s) => completedToday[s.id]).length;

  // The next step whose time hasn't fully passed yet — same "what's up next"
  // logic RecommendationsView's own hero card uses, kept in sync since both
  // read labelMinutes the same way.
  const { current, next } = useMemo(() => {
    const sorted = [...timelineSections].sort((a, b) => labelMinutes(a.timeLabel || '') - labelMinutes(b.timeLabel || ''));
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    let cur: PlanSection | null = null;
    let nxt: PlanSection | null = null;
    for (const item of sorted) {
      const mins = labelMinutes(item.timeLabel || '');
      if (mins <= nowMinutes) cur = item;
      else { nxt = item; break; }
    }
    return { current: cur || nxt, next: cur ? nxt : null };
  }, [timelineSections]);

  // Time-of-day greeting, and the same real condition-derived reversal focus
  // AccountPage leads with — reused here for the plan-continue card + the
  // greeting subtitle, so it never claims a condition the user doesn't have.
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
  const PlanIcon = primaryGoal.icon;

  return (
    <div id="urcare-profile-page" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16 relative overflow-hidden">

      {/* Faint decorative leaf watermark, matching the mockup's soft branded
          backdrop — purely decorative, sits behind everything. */}
      <Leaf className="absolute -top-6 -right-10 w-56 h-56 text-emerald-100 rotate-12 pointer-events-none" strokeWidth={1} aria-hidden="true" />

      {/* Header — brand mark + tagline on the left; a (decorative, for now)
          notification bell and the account avatar on the right. */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-8 py-3 sm:py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BrandMark className="w-8 h-8 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight truncate">
                <span className="text-zinc-950">UR</span><span className="text-emerald-500">CARE</span>
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 truncate">
                {tr('Your Health, Our Care', 'आपका स्वास्थ्य, हमारी देखभाल')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenMoreMenu}
              className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer"
              title={tr('More', 'अधिक')}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer"
              title={tr('Notifications', 'सूचनाएं')}
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenProfile}
              className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black overflow-hidden shrink-0 cursor-pointer"
            >
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (profile.name || account.displayName || 'U').slice(0, 2).toUpperCase()
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-4 space-y-5 text-left">

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-950">
            {greeting}{firstName ? `, ${firstName}` : ''} <span className="inline-block">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-semibold mt-1">
            {tr('Small steps.', 'छोटे कदम।')} {tr('A healthier tomorrow.', 'एक स्वस्थ कल।')}
          </p>
        </motion.div>

        {/* Quote card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5"
        >
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-emerald-900 italic">
            "{tr('Discipline today, freedom tomorrow.', 'आज अनुशासन, कल आज़ादी।')}"
          </p>
        </motion.div>

        {/* Plan-continue card */}
        <motion.button
          type="button"
          onClick={onOpenPlan}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="w-full p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center gap-3 text-left cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${primaryGoal.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
            <PlanIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-zinc-950 truncate">{tr(primaryGoal.label, GOAL_LABEL_HI[primaryGoal.label] || primaryGoal.label)}</div>
            <div className="text-[11px] text-zinc-500 font-semibold">{tr('Continue today', 'आज जारी रखें')}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
        </motion.button>

        {/* Today's Plan */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }} className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-black text-zinc-950">{tr("Today's Plan", 'आज की योजना')}</h2>
              {programDay != null && (
                <span className="text-[10px] font-bold text-zinc-400">{tr(`Day ${programDay} of 14`, `दिन ${programDay} / 14`)}</span>
              )}
            </div>
            <button type="button" onClick={onOpenPlan} className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer">
              {tr('View All', 'सभी देखें')}
            </button>
          </div>

          {current ? (
            <button
              type="button"
              onClick={onOpenPlan}
              className="w-full p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center gap-3 text-left cursor-pointer hover:border-emerald-300 transition-all"
            >
              <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 ${completedToday[current.id] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-emerald-400 text-emerald-500'}`}>
                <Utensils className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-zinc-400">{tr('Next', 'अगला')}</div>
                <div className="text-sm font-black text-zinc-950 truncate">{current.title}</div>
                <div className="text-[11px] text-emerald-600 font-bold">{current.timeLabel}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
            </button>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-sm text-xs font-semibold text-zinc-400 text-center">
              {tr('No plan available for today.', 'आज के लिए कोई योजना उपलब्ध नहीं है।')}
            </div>
          )}

          {next && (
            <div className="w-full p-3 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-500">
                <Utensils className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-zinc-400 uppercase">{tr('Up next', 'इसके बाद')}</div>
                <div className="text-xs font-bold text-zinc-800 truncate">{next.timeLabel} — {next.title}</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Quick actions — 2x2 grid, matching the mockup's four shortcuts. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-3"
        >
          <button type="button" onClick={onOpenScan} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center gap-1.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
            <Camera className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-800">{tr('Scan Food', 'फूड स्कैन करें')}</span>
          </button>
          <button type="button" onClick={onOpenReports} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center gap-1.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-800">{tr('My Reports', 'मेरी रिपोर्ट्स')}</span>
          </button>
          <button type="button" onClick={() => setIsLibraryOpen(true)} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center gap-1.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-800">{tr('Reversal Library', 'रिवर्सल लाइब्रेरी')}</span>
          </button>
          <button type="button" onClick={onOpenStore} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center gap-1.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-800">{tr('Store', 'स्टोर')}</span>
          </button>
        </motion.div>

        {/* Streak — kept here at a glance too (in addition to the Profile
            tab), since it's a quick daily-motivation signal like the quote
            above it. */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.25 }} className="flex justify-center">
          <StreakWidget profile={profile} />
        </motion.div>

        {/* Bottom quote banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
          className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2 text-center"
        >
          <Leaf className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-emerald-800 italic">
            {tr('Discipline today, freedom tomorrow.', 'आज अनुशासन, कल आज़ादी।')}
          </span>
        </motion.div>
      </main>

      {/* Reversal Library — a bottom sheet on mobile/tablet since it doesn't
          have a permanent sidebar spot outside the Plan tab's wide layout. */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIsLibraryOpen(false)}>
          <div
            className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3">
              <ReversalLibraryPanel sections={referenceSections} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

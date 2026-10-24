import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, ChevronRight, Utensils, Sparkles, Leaf, MoreVertical,
  Stethoscope, GitCommit, MessageCircleMore, CalendarDays, Clock3, CheckCircle2, Share2,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, Prescription, MedicalReportAnalysis, ActivityLogEntry, CareTeamStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { RecommendationsView, REVERSAL_GOALS, DEFAULT_REVERSAL_GOAL, labelMinutes, categoryFor, STEP_CATEGORY_META, CATEGORY_GRADIENT } from './RecommendationsView';
import { PlanSection } from './ReversalLibraryPanel';
import { StreakWidget } from './StreakWidget';
import { NotificationsPanel } from './NotificationsPanel';
import { ChatPanel } from './ChatPanel';
import { TodaysExerciseCard } from './TodaysExerciseCard';
import { TodaysMealCard, isMealStep } from './TodaysMealCard';
import { HealthOverviewCard } from './HealthOverviewCard';
import { RootCausesCard } from './RootCausesCard';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { ShareHealthModal } from './ShareHealthModal';
import { UrCareBuddy, progressMessage } from './ProgressCelebration';
import { StatusStrip } from './FamilyStatus';
// Premium UI components from Magic UI (MIT) — see ./magicui/LICENSE.md.
import { AnimatedCircularProgressBar } from './magicui/animated-circular-progress-bar';
import { NumberTicker } from './magicui/number-ticker';
import { BorderBeam } from './magicui/border-beam';
import { MagicCard } from './magicui/magic-card';
import { ShineBorder } from './magicui/shine-border';
import { PulsatingButton } from './magicui/pulsating-button';
import { RippleButton } from './magicui/ripple-button';
import { StatusViewer } from './StatusViewer';
import { getDailyPlan, activePlanSections, getTaskCompletion, getNotifications, getDailyQuote, getMyChatThread, toggleDailyTask, getActiveStatuses } from '../utils/supabase';
import { toDateKey } from './DailyCalendar';

// Food Scan card: people scanning meals (Pexels, free licence) in
// public/food-scan/, cross-fading every 5 seconds under a scanning overlay.
/** Hero ring (Magic UI progress bar + number ticker) — today's real plan steps done out of total. */
function TodayRing({ done, total, onClick, tr }: { done: number; total: number; onClick: () => void; tr: (en: string, hi: string) => string }) {
  const pct = total > 0 ? Math.round(Math.min(1, done / total) * 100) : 0;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      className="hero-ring relative shrink-0 w-[96px] h-[96px] sm:w-[132px] sm:h-[132px] cursor-pointer"
      title={tr("Open today's plan", 'आज की योजना खोलें')}
    >
      <AnimatedCircularProgressBar
        value={pct}
        gaugePrimaryColor="#fde68a"
        gaugeSecondaryColor="rgba(255,255,255,0.22)"
        className="absolute inset-0 size-full text-transparent [&>span]:hidden"
      />
      <span className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="font-display text-xl sm:text-3xl font-bold leading-none">
          <NumberTicker value={pct} className="text-white tracking-normal" />
          <span className="text-sm">%</span>
        </span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/80">{total > 0 ? tr(`${done}/${total} done`, `${done}/${total} पूरे`) : tr('No plan yet', 'प्लान नहीं')}</span>
      </span>
    </motion.button>
  );
}

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

/** A live "time until this starts" readout — ticks every real second, not
 *  just every minute, so it's genuinely counting down rather than a static
 *  label. Shows H:MM:SS once over an hour away, MM:SS under that. */
const LiveCountdown: React.FC<{ timeLabel: string }> = ({ timeLabel }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const targetMs = useMemo(() => {
    const mins = labelMinutes(timeLabel);
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d.getTime();
  }, [timeLabel]);

  const diffSec = Math.max(0, Math.round((targetMs - now) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span className="tabular-nums font-black text-emerald-600 text-sm">
      {diffSec <= 0 ? '00:00' : h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
    </span>
  );
};

interface ProfilePageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  prescriptions?: Prescription[];
  /** Uploaded lab reports, newest first — already fetched once in
   *  Dashboard, just passed down here so this doesn't need its own fetch. */
  reports?: MedicalReportAnalysis[];
  /** Jumps to the standalone Profile tab (full identity/stats/edit page). */
  onOpenProfile: () => void;
  /** Jumps to the full Daily Plan timeline tab. */
  onOpenPlan: () => void;
  /** Jumps to the UrCare Camera (food scanner) tab. */
  onOpenScan: () => void;
  /** Jumps to the Reports tab. */
  onOpenReports: () => void;
  /** Opens the Root Cause Assessment — where blood-sugar/kidney readings
   *  actually live, and the natural place to add them when missing. */
  onOpenAssessment: () => void;
  /** Opens the '⋮' module drawer (Assessment/Store/Settings/Sign Out) —
   *  Home has its own full header instead of the shared one every other tab
   *  uses, so it needs its own trigger for the same drawer. */
  onOpenMoreMenu: () => void;
  /** Opens the AI chat with this question ready to send. */
  onAskUrCare?: (prompt: string) => void;
}

/** "Home" — a calm, focused landing summary: today's next step, this
 *  program's overall progress, and one-tap shortcuts to everywhere else.
 *  The full day-by-day timeline lives on its own Plan tab now. */
export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  account,
  prescriptions = [],
  reports = [],
  onOpenProfile,
  onOpenPlan,
  onOpenScan,
  onOpenReports,
  onOpenAssessment,
  onOpenMoreMenu,
  onAskUrCare,
}) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  // Real notifications (prescriptions/reports/orders) — see NotificationsPanel.
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Care Team Chat — see ChatPanel.
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  // Care Team Status — a WhatsApp-Status-style feed, admin-posted only (see
  // StatusViewer). "Seen" is tracked per-device via localStorage, same as
  // any other purely-cosmetic per-viewer convenience — it never needs to be
  // shared across devices or read back by anyone else.
  const [statuses, setStatuses] = useState<CareTeamStatus[]>([]);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [lastSeenStatusAt, setLastSeenStatusAt] = useState<string | null>(() => {
    try { return localStorage.getItem('urcare-status-last-seen'); } catch { return null; }
  });
  useEffect(() => { getActiveStatuses().then(setStatuses); }, []);
  const hasUnseenStatus = statuses.some((s) => !lastSeenStatusAt || new Date(s.createdAt).getTime() > new Date(lastSeenStatusAt).getTime());
  const handleCloseStatusViewer = () => {
    setIsStatusOpen(false);
    const latest = statuses[statuses.length - 1]?.createdAt;
    if (!latest) return;
    try { localStorage.setItem('urcare-status-last-seen', latest); } catch { /* per-viewer convenience only */ }
    setLastSeenStatusAt(latest);
  };
  const [isShareOpen, setIsShareOpen] = useState(false);

  const userId = profile.id || '';
  const todayKey = toDateKey(new Date());

  const [programDay, setProgramDay] = useState<number | null>(null);
  const [programTotalDays, setProgramTotalDays] = useState<number | null>(null);
  const [sections, setSections] = useState<PlanSection[]>([]);
  // Bumped whenever a report upload adds a new condition to this user's
  // Daily Plan (see Dashboard's handleUpdateReport) — forces the plan fetch
  // below to re-run immediately instead of waiting for the next date change.
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  // Live: the notification badge checks every 30 s while the app is open.
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') getNotifications().then((list) => setUnreadCount(list.filter((n) => !n.read).length)).catch(() => {});
    }, 30000);
    return () => window.clearInterval(poll);
  }, []);
  useEffect(() => {
    const handler = () => setPlanRefreshKey((k) => k + 1);
    window.addEventListener('urcare:daily-plan-changed', handler);
    return () => window.removeEventListener('urcare:daily-plan-changed', handler);
  }, []);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});

  // Today's real quote — same one for everyone, regenerated by the AI once
  // per calendar day server-side (see getDailyQuote/api/daily-quote), not
  // re-fetched per render. Starts on the same static line the server falls
  // back to, so the card never shows nothing while this loads.
  const [dailyQuote, setDailyQuote] = useState({ en: 'Discipline today, freedom tomorrow.', hi: 'आज अनुशासन, कल आज़ादी।' });
  useEffect(() => {
    let cancelled = false;
    getDailyQuote().then((q) => { if (!cancelled) setDailyQuote(q); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getDailyPlan(todayKey).then((result) => {
      if (cancelled) return;
      setProgramDay(result.plan?.programDay ?? null);
      setProgramTotalDays(result.plan?.totalDays ?? null);
      // Home shows whichever plan the user is following (UrCare or uploaded).
      setSections(activePlanSections(result, userId));
    });
    getTaskCompletion(userId, todayKey).then((c) => { if (!cancelled) setCompletedToday(c); });
    // Just the unread badge count for the bell — the panel re-fetches the
    // full list itself when it's actually opened.
    getNotifications().then((list) => { if (!cancelled) setUnreadCount(list.filter((n) => !n.read).length); });
    return () => { cancelled = true; };
  }, [userId, todayKey, planRefreshKey]);

  // Chat unread badge — polled independently of the plan/notifications
  // effect above (its own cadence, doesn't need to re-fire on planRefreshKey).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const check = () => getMyChatThread().then((result) => { if (!cancelled && result) setChatUnread(result.thread.unreadByUser); });
    check();
    const interval = setInterval(check, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userId]);

  const timelineSections = useMemo(() => sections.filter((s) => !!s.timeLabel), [sections]);


  // The next step whose time hasn't fully passed yet — same "what's up next"
  // logic RecommendationsView's own hero card uses, kept in sync since both
  // read labelMinutes the same way. Recomputed every 30s off `nowTick` (not
  // just when the sections themselves change) so "Next" rolls forward into
  // "Up Next" automatically as the day goes on, instead of freezing at
  // whatever was current the moment this page happened to mount.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nowTick is a deliberate re-run trigger, not a real input
  }, [timelineSections, nowTick]);

  // The one exercise/movement step to feature on Home — same "current, else
  // next upcoming" logic as `current`/`next` above, scoped to just the
  // exercise-category steps from today's real plan (never invented).
  const todaysExercise = useMemo(() => {
    const exerciseSteps = timelineSections.filter((s) => categoryFor(s.title) === 'exercise');
    if (exerciseSteps.length === 0) return null;
    const sorted = [...exerciseSteps].sort((a, b) => labelMinutes(a.timeLabel || '') - labelMinutes(b.timeLabel || ''));
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    let cur: PlanSection | null = null;
    let nxt: PlanSection | null = null;
    for (const item of sorted) {
      const mins = labelMinutes(item.timeLabel || '');
      if (mins <= nowMinutes) cur = item;
      else { nxt = item; break; }
    }
    return cur || nxt || sorted[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nowTick is a deliberate re-run trigger, not a real input
  }, [timelineSections, nowTick]);

  // Today's Meal — the meal happening now, else the next one (same rule as exercise).
  const todaysMeal = useMemo(() => {
    const meals = timelineSections.filter((s) => isMealStep(s.title));
    if (meals.length === 0) return null;
    const sorted = [...meals].sort((a, b) => labelMinutes(a.timeLabel || '') - labelMinutes(b.timeLabel || ''));
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    let cur: PlanSection | null = null;
    let nxt: PlanSection | null = null;
    for (const item of sorted) {
      const mins = labelMinutes(item.timeLabel || '');
      if (mins <= nowMinutes) cur = item;
      else { nxt = item; break; }
    }
    // Once a meal is eaten, show the next one.
    if (cur && completedToday[cur.id] && nxt) return nxt;
    return cur || nxt || sorted[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nowTick is a deliberate re-run trigger
  }, [timelineSections, nowTick, completedToday]);

  const handleMarkExerciseDone = () => {
    if (!todaysExercise || !userId) return;
    toggleDailyTask(userId, todayKey, todaysExercise.id).then(setCompletedToday);
  };

  // Time-of-day greeting, and the same real condition-derived reversal focus
  // AccountPage leads with — reused here for the plan-continue card + the
  // greeting subtitle, so it never claims a condition the user doesn't have.
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? tr('Good Morning', 'सुप्रभात') : hour < 17 ? tr('Good Afternoon', 'नमस्कार') : tr('Good Evening', 'शुभ संध्या');
  }, [language]);
  const firstName = (profile.name || account.displayName || '').trim().split(/\s+/)[0];

  // All of the user's real condition-derived reversal focuses — the same
  // mapping AccountPage's "Your Reversal Focus" grid uses, deduped by label
  // (two different conditions can map to the same goal). The hero card
  // below cycles through these one at a time rather than only ever
  // showing the first, so someone with several real conditions doesn't see
  // just one of them here while Profile shows all of them.
  const reversalGoals = useMemo(() => {
    const conditions = (profile.medicalConditions || []).filter((c) => c !== 'None' && c !== 'Other');
    const goals = conditions.map((c) => REVERSAL_GOALS[c]).filter(Boolean);
    const deduped = goals.filter((g, i) => goals.findIndex((g2) => g2.label === g.label) === i);
    return deduped.length > 0 ? deduped : [DEFAULT_REVERSAL_GOAL];
  }, [profile.medicalConditions]);

  const [goalIndex, setGoalIndex] = useState(0);
  useEffect(() => {
    if (reversalGoals.length <= 1) return;
    const id = setInterval(() => setGoalIndex((i) => (i + 1) % reversalGoals.length), 4000);
    return () => clearInterval(id);
  }, [reversalGoals.length]);

  // Today's real progress for the hero ring.
  const stepsTotal = timelineSections.length;
  const stepsDone = timelineSections.filter((sec) => completedToday[sec.id]).length;
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    [language],
  );
  // Pointer-following glow on the hero (CSS vars, no re-render).
  const heroRef = useRef<HTMLDivElement>(null);
  const handleHeroPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    el.style.setProperty('--hero-x', `${((e.clientX - box.left) / box.width) * 100}%`);
    el.style.setProperty('--hero-y', `${((e.clientY - box.top) / box.height) * 100}%`);
  };

  const primaryGoal = reversalGoals[goalIndex % reversalGoals.length];
  const PlanIcon = primaryGoal.icon;

  return (
    <div id="urcare-profile-page" className="urcare-home min-h-screen text-foreground pb-16 relative overflow-hidden">


      {/* Header — the '⋮' module menu now sits on the left (the URCARE
          logo/wordmark was dropped per the brief); the streak, a
          (decorative, for now) notification bell, and the account avatar
          on the right. */}
      <header className="home-header sticky top-0 z-30 px-4 sm:px-8 py-3 sm:py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <RippleButton
            type="button"
            onClick={onOpenMoreMenu}
            rippleColor="#10b981"
            className="header-icon-btn shrink-0"
            title={tr('More', 'अधिक')}
          >
            <MoreVertical className="w-4 h-4" />
          </RippleButton>

          <div className="flex items-center gap-2 shrink-0">
            <StreakWidget profile={profile} />
            {statuses.length > 0 && (
              <button
                type="button"
                onClick={() => setIsStatusOpen(true)}
                className="relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                title={tr('Health Team Status', 'हेल्थ टीम स्टेटस')}
              >
                <span className={`absolute inset-0 rounded-full ${hasUnseenStatus ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-emerald-500' : 'bg-zinc-300'}`} />
                <span className="absolute inset-0.5 rounded-full bg-white flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-emerald-600" />
                </span>
              </button>
            )}
            {/* Magic UI Pulsating Button — pulses only while a reply is unread. */}
            <div className="relative shrink-0">
            <PulsatingButton
              type="button"
              onClick={() => { setChatUnread(false); setIsChatOpen(true); }}
              pulseColor={chatUnread ? 'rgba(16, 185, 129, 0.45)' : 'transparent'}
              distance="7px"
              duration="1.8s"
              className="header-chat-btn w-9 h-9 p-0 rounded-full text-white"
              title={tr('Health Team Chat', 'हेल्थ टीम चैट')}
            >
              <MessageCircleMore className="w-[18px] h-[18px]" />
            </PulsatingButton>
            {chatUnread && <span className="absolute -top-0.5 -right-0.5 z-20 w-3 h-3 rounded-full bg-rose-500 border-2 border-white pointer-events-none" />}
            </div>
            <div className="relative shrink-0">
              <RippleButton
                type="button"
                onClick={() => setIsNotificationsOpen(true)}
                rippleColor="#10b981"
                className="header-icon-btn"
                title={tr('Notifications', 'सूचनाएं')}
              >
                <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'bell-ring text-emerald-600' : ''}`} />
              </RippleButton>
              {unreadCount > 0 && (
                <span className="header-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="urcare-home-grid relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-6 text-left">

        {/* Greeting — a vivid gradient hero card instead of plain page text,
            so Home opens with a real "front door" moment. The daily quote
            still lives right here as the subtitle. */}
        {/* Welcome + Your Health Overview, one card. */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}
          className="home-merged rounded-[1.75rem] overflow-hidden bg-white border border-emerald-100 shadow-depth"
        >
        <div
          ref={heroRef as any}
          onPointerMove={handleHeroPointer as any}
          className="home-welcome home-hero relative overflow-hidden p-5 sm:p-7 text-white"
        >
          <span className="home-hero-blob home-hero-blob-a" aria-hidden="true" />
          <span className="home-hero-blob home-hero-blob-b" aria-hidden="true" />
          <span className="home-hero-glow" aria-hidden="true" />
          <BorderBeam size={120} duration={9} colorFrom="#fde68a" colorTo="#ffffff" borderWidth={2} />
          <div className="relative w-full">
          <div className="flex items-start sm:items-center gap-3 sm:gap-6">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm text-[10px] sm:text-[11px] font-bold tracking-wide">
                <CalendarDays className="w-3.5 h-3.5" />
                {todayLabel}
              </span>
              <motion.h1
                className="mt-3 font-display text-xl sm:text-3xl font-bold leading-tight"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              >
                {greeting}{firstName ? `, ${firstName}` : ''} <span className="inline-block align-middle w-9 h-9 sm:w-12 sm:h-12 -my-2" aria-hidden="true">
                  {/* waving hand — LottieFiles (Lottie Simple License) */}
                  <DotLottieReact src="/lottie/wave-hand.lottie" autoplay loop style={{ width: '100%', height: '100%' }} />
                </span>
              </motion.h1>
              <p className="flex items-start gap-1.5 text-xs sm:text-sm text-white/85 font-medium mt-2 max-w-xl">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="italic line-clamp-3 sm:line-clamp-2">"{language === 'hi' ? dailyQuote.hi : dailyQuote.en}"</span>
              </p>
            </div>
            <TodayRing done={stepsDone} total={stepsTotal} onClick={onOpenPlan} tr={tr} />
          </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {programDay != null && (
                  <span className="hero-chip"><Leaf className="w-3.5 h-3.5" />{tr(`Day ${programDay} of ${programTotalDays || 30}`, `दिन ${programDay} / ${programTotalDays || 30}`)}</span>
                )}
                {stepsTotal > 0 && (
                  <span className="hero-chip"><CheckCircle2 className="w-3.5 h-3.5" />{tr(`${stepsDone} of ${stepsTotal} steps done`, `${stepsTotal} में से ${stepsDone} चरण पूरे`)}</span>
                )}
                {next?.timeLabel && (
                  <button type="button" onClick={onOpenPlan} className="hero-chip cursor-pointer hover:bg-white/25"><Clock3 className="w-3.5 h-3.5" />{tr(`Next at ${next.timeLabel}`, `अगला ${next.timeLabel} पर`)}</button>
                )}
              </div>
          </div>
        </div>
        <HealthOverviewCard embedded profile={profile} tr={tr} onAsk={(q) => onAskUrCare?.(q)} onOpenAssessment={onOpenAssessment} />
        </motion.div>

        {/* Plan-continue card — cycles through every real condition-derived
            focus (not just the first) when there's more than one, so this
            stays a compact single card instead of growing into a list. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="home-focus space-y-2"
        >
          <MagicCard className="rounded-2xl shadow-depth" gradientSize={220} gradientColor="#d1fae5" gradientOpacity={0.55} gradientFrom="#10b981" gradientTo="#4ade80">
          <motion.button
            type="button"
            onClick={onOpenPlan}
            whileTap={{ scale: 0.98 }}
            className="relative w-full p-5 rounded-2xl bg-transparent overflow-hidden text-left cursor-pointer"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={primaryGoal.label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex items-center gap-3"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${primaryGoal.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                  <PlanIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-zinc-950 truncate">{tr(primaryGoal.label, GOAL_LABEL_HI[primaryGoal.label] || primaryGoal.label)}</div>
                  <div className="text-[11px] text-zinc-500 font-semibold">{tr('Continue today', 'आज जारी रखें')}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
              </motion.div>
            </AnimatePresence>
          </motion.button>
          </MagicCard>

          {reversalGoals.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {reversalGoals.map((g, i) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => setGoalIndex(i)}
                  title={tr(g.label, GOAL_LABEL_HI[g.label] || g.label)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${i === goalIndex ? 'w-5 bg-emerald-500' : 'w-1.5 bg-zinc-200 hover:bg-zinc-300'}`}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* Today's Plan */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }} className="home-plan space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Utensils className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-black text-zinc-950">{tr("Today's Plan", 'आज की योजना')}</h2>
                {programDay != null && (
                  <span className="text-[10px] font-bold text-zinc-400">{tr(`Day ${programDay} of ${programTotalDays || 30}`, `दिन ${programDay} / ${programTotalDays || 30}`)}</span>
                )}
              </div>
            </div>
            <button type="button" onClick={onOpenPlan} className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer">
              {tr('View All', 'सभी देखें')}
            </button>
          </div>

          {current ? (
            <MagicCard className="rounded-2xl shadow-depth" gradientSize={220} gradientColor="#d1fae5" gradientOpacity={0.55} gradientFrom="#10b981" gradientTo="#4ade80">
            <div className="w-full rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={onOpenPlan}
                className="w-full p-3.5 flex items-center gap-3 text-left cursor-pointer hover:bg-emerald-50/40 transition-colors"
              >
                {(() => {
                  const curCat = categoryFor(current.title);
                  const CurIcon = STEP_CATEGORY_META[curCat].Icon;
                  return (
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br ${CATEGORY_GRADIENT[curCat]} ${completedToday[current.id] ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}>
                      <CurIcon className="w-4.5 h-4.5 text-white" />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-zinc-400">{tr('Next', 'अगला')}</div>
                  <div className="text-sm font-black text-zinc-950 truncate">{current.title}</div>
                  <div className="text-[11px] text-emerald-600 font-bold">{current.timeLabel}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
              </button>

              {next ? (
                <div className="px-3.5 py-2.5 border-t border-zinc-100 bg-zinc-50/70 flex items-center gap-3">
                  {(() => {
                    const nextCat = categoryFor(next.title);
                    const NextIcon = STEP_CATEGORY_META[nextCat].Icon;
                    return (
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${CATEGORY_GRADIENT[nextCat]}`}>
                        <NextIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">{tr('Up next', 'इसके बाद')}</span>
                    <div className="text-xs font-bold text-zinc-700 truncate">{next.timeLabel} — {next.title}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end">
                    <LiveCountdown timeLabel={next.timeLabel || ''} />
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wide">{tr('remaining', 'शेष')}</span>
                  </div>
                </div>
              ) : (
                // `current` is the day's last timed step and nothing comes
                // after it — a real, honest state (not a bug), so it says
                // so instead of "Up Next" just silently disappearing.
                <div className="px-3.5 py-2.5 border-t border-zinc-100 bg-emerald-50/70 flex items-center justify-center gap-2 text-center">
                  <span className="text-xs">🎉</span>
                  <span className="text-[11px] font-bold text-emerald-800">{tr("That's everything for today — see you tomorrow!", 'आज के लिए सब कुछ पूरा — कल मिलते हैं!')}</span>
                </div>
              )}
            </div>
            </MagicCard>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-sm text-xs font-semibold text-zinc-400 text-center">
              {tr('No plan available for today.', 'आज के लिए कोई योजना उपलब्ध नहीं है।')}
            </div>
          )}
        </motion.div>

        {/* Today's status — mine + family & friends (WhatsApp-style). */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.11 }} className="home-status">
          <StatusStrip tr={tr} />
        </motion.div>

        {/* UrCare Buddy — its expression follows today's progress. */}
        {stepsTotal > 0 && (() => {
          const pct = Math.round((stepsDone / stepsTotal) * 100);
          const msg = progressMessage(pct, tr);
          return (
            <motion.button
              type="button"
              onClick={onOpenPlan}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
              whileTap={{ scale: 0.99 }}
              className="home-buddy w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-200 shadow-depth text-left cursor-pointer"
            >
              <UrCareBuddy pct={pct} size={72} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-700">{tr('UrCare Buddy', 'UrCare बडी')}</span>
                <span className="block text-sm font-black text-zinc-900 leading-snug">{msg.title}</span>
                <span className="block text-[11px] text-zinc-500 font-semibold leading-snug">{msg.body}</span>
              </span>
            </motion.button>
          );
        })()}


        {/* Today's Exercise — a featured video-led card for the day's one
            exercise/movement step (if there is one), pulled straight off
            the same real timeline as "Today's Plan" above. */}
        {todaysExercise && (
          <div className="home-exercise">
          <TodaysExerciseCard
            step={todaysExercise}
            isDone={!!completedToday[todaysExercise.id]}
            onMarkDone={handleMarkExerciseDone}
            tr={tr}
          />
          </div>
        )}

        {/* Today's Meal — someone eating + the day's meal from the plan. */}
        {todaysMeal && (
          <div className="home-meal">
            <TodaysMealCard step={todaysMeal} isDone={!!completedToday[todaysMeal.id]} onOpenPlan={onOpenPlan} onOpenScan={onOpenScan} tr={tr} />
          </div>
        )}


        {/* Your Root Causes — at the bottom of Home. */}
        <RootCausesCard profile={profile} tr={tr} onOpenAssessment={onOpenAssessment} onOpenPlan={onOpenPlan} />

      </main>

      <ShareHealthModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        profile={profile}
        displayName={(profile.name || account.displayName || '').trim()}
        prescriptions={prescriptions}
        reports={reports}
        tr={tr}
      />

      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />

      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {isStatusOpen && statuses.length > 0 && (
        <StatusViewer statuses={statuses} onClose={handleCloseStatusViewer} tr={tr} />
      )}
    </div>
  );
};

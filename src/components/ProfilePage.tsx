import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, ChevronRight, FileText, BookOpen, Utensils, Sparkles, Leaf, MoreVertical,
  Activity, Stethoscope, Droplets, Pill, GitCommit, MessageCircleMore,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, Prescription, MedicalReportAnalysis, DailyLog, ActivityLogEntry, CareTeamStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { RecommendationsView, REVERSAL_GOALS, DEFAULT_REVERSAL_GOAL, labelMinutes, categoryFor, STEP_CATEGORY_META, CATEGORY_GRADIENT } from './RecommendationsView';
import { ReversalLibraryPanel, PlanSection } from './ReversalLibraryPanel';
import { StreakWidget } from './StreakWidget';
import { CompletionTicker, TickerItem } from './CompletionTicker';
import { NotificationsPanel } from './NotificationsPanel';
import { MyTimelinePanel, ACTION_META, CATEGORY_META, relativeTime } from './MyTimelinePanel';
import { ChatPanel } from './ChatPanel';
import { TodaysExerciseCard } from './TodaysExerciseCard';
import mealImage from '../assets/urcare-meal.jpg';
import { StatusViewer } from './StatusViewer';
import { getDailyPlan, getTaskCompletion, getDailyLog, getNotifications, getDailyQuote, getActivityLog, getMyChatThread, toggleDailyTask, getActiveStatuses } from '../utils/supabase';
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
}) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
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
  // My Timeline — a real GitHub-commit-style audit trail of this user's own
  // actions (upload/edit/update/delete); see MyTimelinePanel/logActivity.
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);

  const userId = profile.id || '';
  const todayKey = toDateKey(new Date());

  const [programDay, setProgramDay] = useState<number | null>(null);
  const [programTotalDays, setProgramTotalDays] = useState<number | null>(null);
  const [sections, setSections] = useState<PlanSection[]>([]);
  // Bumped whenever a report upload adds a new condition to this user's
  // Daily Plan (see Dashboard's handleUpdateReport) — forces the plan fetch
  // below to re-run immediately instead of waiting for the next date change.
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setPlanRefreshKey((k) => k + 1);
    window.addEventListener('urcare:daily-plan-changed', handler);
    return () => window.removeEventListener('urcare:daily-plan-changed', handler);
  }, []);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [isDailyLogLoading, setIsDailyLogLoading] = useState(true);

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
      setSections(result.plan?.sections || []);
    });
    getTaskCompletion(userId, todayKey).then((c) => { if (!cancelled) setCompletedToday(c); });
    // Powers the Hydration/Nutrition/Medication cards in Today's Health below
    // — the same daily_logs row every other screen already reads/writes.
    setIsDailyLogLoading(true);
    getDailyLog(userId, todayKey)
      .then((log) => { if (!cancelled) setDailyLog(log); })
      .finally(() => { if (!cancelled) setIsDailyLogLoading(false); });
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

  // My Timeline preview — the 3 most recent real actions, live-refreshed
  // whenever anything anywhere in the app calls logActivity().
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadRecent = () => getActivityLog(userId, 3).then((list) => { if (!cancelled) setRecentActivity(list); });
    loadRecent();
    window.addEventListener('urcare:activity-logged', loadRecent);
    return () => { cancelled = true; window.removeEventListener('urcare:activity-logged', loadRecent); };
  }, [userId]);

  const timelineSections = useMemo(() => sections.filter((s) => !!s.timeLabel), [sections]);
  const referenceSections = useMemo(() => sections.filter((s) => !s.timeLabel), [sections]);

  // "Today's Health" — real, per-user data only. Anything not actually on
  // file becomes an 'empty' card with a genuine next action (never an
  // invented number); see CompletionTicker's TickerItem for the contract.
  const healthCards: TickerItem[] = useMemo(() => {
    const cards: TickerItem[] = [];
    const bloodSugar = profile.assessmentData?.bloodSugar;
    const cardioVitals = profile.assessmentData?.cardioVitals;

    // 1. Blood Sugar — from the Root Cause Assessment's real readings.
    const bsValue = bloodSugar?.latestHbA1c
      ? tr(`HbA1c ${bloodSugar.latestHbA1c}%`, `HbA1c ${bloodSugar.latestHbA1c}%`)
      : bloodSugar?.averageFasting7Days
        ? tr(`${bloodSugar.averageFasting7Days} mg/dL fasting avg`, `${bloodSugar.averageFasting7Days} mg/dL औसत फास्टिंग`)
        : null;
    cards.push({
      id: 'blood-sugar',
      icon: Activity,
      title: tr('Blood Sugar', 'ब्लड शुगर'),
      value: bsValue || tr('Add your blood sugar readings', 'अपनी ब्लड शुगर रीडिंग जोड़ें'),
      state: bsValue ? 'ok' : 'empty',
      onClick: onOpenAssessment,
    });

    // 2. Kidney Health — assessment readings first, else a matching
    // biomarker from the most recent uploaded lab report.
    const latestReport = reports[0];
    const kidneyBiomarker = latestReport?.biomarkers?.find((b) => /creatinine|egfr|kidney|urea/i.test(b.name));
    const kidneyFromAssessment = cardioVitals?.egfr
      ? `eGFR ${cardioVitals.egfr}`
      : cardioVitals?.creatinine
        ? tr(`Creatinine ${cardioVitals.creatinine}`, `क्रिएटिनिन ${cardioVitals.creatinine}`)
        : null;
    const kidneyValue = kidneyFromAssessment || (kidneyBiomarker ? `${kidneyBiomarker.name} ${kidneyBiomarker.value}` : null);
    cards.push({
      id: 'kidney-health',
      icon: Stethoscope,
      title: tr('Kidney Health', 'किडनी स्वास्थ्य'),
      value: kidneyValue || tr('No kidney data yet — upload a report', 'अभी किडनी डेटा नहीं — रिपोर्ट अपलोड करें'),
      state: kidneyValue ? 'ok' : 'empty',
      onClick: kidneyFromAssessment ? onOpenAssessment : onOpenReports,
    });

    // Note: no separate "Today's Plan" card here — the dedicated Today's
    // Plan section right above this ticker already shows that (with a live
    // countdown, even), so repeating it here would just be the same
    // information twice on the same screen.

    // 4. Nutrition — real scanned/typed meals only. Quick macro/calorie
    // logs (Profile's +10g protein etc. buttons) are also stored as
    // lightweight "meal" entries (id prefixed "quick_") so they sum into
    // the same real totals — but they aren't an actual food item, so they
    // shouldn't inflate "meals logged" here.
    const mealsCount = (dailyLog?.meals || []).filter((m) => !m.id.startsWith('quick_')).length;
    cards.push({
      id: 'nutrition',
      icon: Utensils,
      title: tr('Nutrition', 'पोषण'),
      value: mealsCount > 0
        ? tr(`${mealsCount} meal${mealsCount === 1 ? '' : 's'} logged today`, `आज ${mealsCount} भोजन लॉग किया`)
        : tr('No meals logged yet', 'अभी तक कोई भोजन लॉग नहीं'),
      state: mealsCount > 0 ? 'ok' : 'empty',
      onClick: onOpenScan,
    });

    // 5. Hydration — real water intake vs the plan's own target, if it has one.
    const waterMl = dailyLog?.waterMl ?? 0;
    const waterTargetL = profile.calculatedPlan?.waterLiters;
    cards.push({
      id: 'hydration',
      icon: Droplets,
      title: tr('Hydration', 'हाइड्रेशन'),
      value: waterMl > 0
        ? waterTargetL
          ? tr(`${(waterMl / 1000).toFixed(1)} / ${waterTargetL} L today`, `आज ${(waterMl / 1000).toFixed(1)} / ${waterTargetL} लीटर`)
          : tr(`${(waterMl / 1000).toFixed(1)} L logged today`, `आज ${(waterMl / 1000).toFixed(1)} लीटर लॉग किया`)
        : tr('No hydration logged yet', 'अभी तक हाइड्रेशन लॉग नहीं'),
      state: waterMl > 0 ? 'ok' : 'empty',
      onClick: onOpenPlan,
    });

    // 6. Lab Reports — the most recent upload, if any.
    cards.push({
      id: 'lab-reports',
      icon: FileText,
      title: tr('Lab Reports', 'लैब रिपोर्ट्स'),
      value: latestReport
        ? (latestReport.reportName || tr('Report available', 'रिपोर्ट उपलब्ध'))
        : tr('No reports uploaded yet', 'अभी तक कोई रिपोर्ट अपलोड नहीं'),
      state: latestReport ? 'ok' : 'empty',
      onClick: onOpenReports,
    });

    // 7. Medication adherence — today's real taken/not-taken log, only
    // shown against actual prescriptions on file.
    const todaysMeds = dailyLog?.medications ?? [];
    const takenCount = todaysMeds.filter((m) => m.taken).length;
    const hasMedsOnFile = prescriptions.length > 0 || todaysMeds.length > 0;
    cards.push({
      id: 'medication',
      icon: Pill,
      title: tr('Medication', 'दवा'),
      value: !hasMedsOnFile
        ? tr('No medications on file', 'कोई दवा दर्ज नहीं')
        : todaysMeds.length > 0
          ? tr(`${takenCount}/${todaysMeds.length} taken today`, `आज ${takenCount}/${todaysMeds.length} ली गई`)
          : tr('Not marked taken yet today', 'आज अभी तक चिह्नित नहीं'),
      state: todaysMeds.length > 0 && takenCount > 0 ? 'ok' : 'empty',
      onClick: onOpenPlan,
    });

    return cards;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tr` closes over `language`, listed directly instead (same pattern as `greeting` above)
  }, [profile.assessmentData, profile.calculatedPlan, reports, timelineSections, dailyLog, prescriptions, onOpenAssessment, onOpenReports, onOpenPlan, onOpenScan, language]);

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

  const primaryGoal = reversalGoals[goalIndex % reversalGoals.length];
  const PlanIcon = primaryGoal.icon;

  return (
    <div id="urcare-profile-page" className="urcare-home min-h-screen text-foreground pb-16 relative overflow-hidden">


      {/* Header — the '⋮' module menu now sits on the left (the URCARE
          logo/wordmark was dropped per the brief); the streak, a
          (decorative, for now) notification bell, and the account avatar
          on the right. */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-4 sm:px-8 py-3 sm:py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenMoreMenu}
            className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer shrink-0"
            title={tr('More', 'अधिक')}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

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
            <button
              type="button"
              onClick={() => { setChatUnread(false); setIsChatOpen(true); }}
              className="relative w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 shadow-sm flex items-center justify-center text-white transition-colors cursor-pointer"
              title={tr('Health Team Chat', 'हेल्थ टीम चैट')}
            >
              <MessageCircleMore className="w-4.5 h-4.5" />
              {chatUnread && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-white" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="relative w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer"
              title={tr('Notifications', 'सूचनाएं')}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
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

      <main className="urcare-home-grid relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-6 text-left">

        {/* Greeting — a vivid gradient hero card instead of plain page text,
            so Home opens with a real "front door" moment. The daily quote
            still lives right here as the subtitle. */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}
          className="home-welcome relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-primary text-primary-foreground shadow-hero"
        >
          <div className="health-orbit" aria-hidden="true">
            <span className="health-orbit-ring health-orbit-ring-a" />
            <span className="health-orbit-ring health-orbit-ring-b" />
            <span className="health-orbit-ring health-orbit-ring-c" />
            <span className="health-orbit-core"><Activity className="w-7 h-7" /></span>
            <span className="health-orbit-node health-orbit-node-a" />
            <span className="health-orbit-node health-orbit-node-b" />
          </div>
          <div className="relative">
            <motion.h1
              className="font-display text-2xl sm:text-4xl font-bold leading-tight max-w-2xl"
              animate={{ scale: [1, 1.015, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              {greeting}{firstName ? `, ${firstName}` : ''} <motion.span
                className="inline-block"
                animate={{ rotate: [0, 14, -8, 14, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
              >👋</motion.span>
            </motion.h1>
            <p className="flex items-center gap-1.5 text-xs sm:text-sm text-primary-foreground/80 font-medium mt-3 max-w-xl">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="italic truncate">"{language === 'hi' ? dailyQuote.hi : dailyQuote.en}"</span>
            </p>
          </div>
        </motion.div>

        {/* Plan-continue card — cycles through every real condition-derived
            focus (not just the first) when there's more than one, so this
            stays a compact single card instead of growing into a list. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="home-focus space-y-2"
        >
          <motion.button
            type="button"
            onClick={onOpenPlan}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full p-5 rounded-2xl bg-card border border-border shadow-depth overflow-hidden text-left cursor-pointer hover:border-primary/30 hover:shadow-float transition-[border-color,box-shadow]"
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
            <motion.div
              whileHover={{ y: -2 }}
              className="w-full rounded-2xl bg-card border border-border shadow-depth overflow-hidden transition-shadow hover:shadow-float"
            >
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
            </motion.div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-sm text-xs font-semibold text-zinc-400 text-center">
              {tr('No plan available for today.', 'आज के लिए कोई योजना उपलब्ध नहीं है।')}
            </div>
          )}
        </motion.div>

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

        <motion.button
          type="button"
          onClick={onOpenScan}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: 'easeOut' }}
          whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }}
          className="home-food group relative overflow-hidden rounded-2xl bg-card border border-border shadow-depth text-left cursor-pointer"
        >
          <img src={mealImage} alt="" width={768} height={768} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]" />
          <span className="food-visual-shade" />
          <span className="absolute left-5 right-5 bottom-5 text-primary-foreground">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"><Sparkles className="w-3.5 h-3.5" />{tr('UrCare Food Scan', 'UrCare फूड स्कैन')}</span>
            <span className="mt-1 block font-display text-xl font-bold">{tr('Know what is on your plate', 'जानें आपकी प्लेट में क्या है')}</span>
            <span className="mt-1 block text-xs text-primary-foreground/80">{tr('Snap a meal for personalised guidance', 'व्यक्तिगत मार्गदर्शन के लिए भोजन स्कैन करें')}</span>
          </span>
        </motion.button>

        {/* Today's Health — a calm, continuously-scrolling stack of your
            real diabetes/reversal-focused stats (blood sugar, kidney
            health, plan/medication/meal/hydration progress, lab reports).
            Hover pauses it in place; nothing here is ever invented — a
            metric with nothing on file shows a genuine "add data" action
            instead of a fake number. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="home-health space-y-3"
        >
          <div className="flex items-center gap-2 px-0.5">
            <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-black text-zinc-950">{tr("Today's Health", 'आज का स्वास्थ्य')}</h2>
          </div>
          {isDailyLogLoading ? (
            <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm divide-y divide-zinc-100" aria-live="polite" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-3.5">
                  <div className="h-8 w-8 rounded-full bg-zinc-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <CompletionTicker items={healthCards} />
          )}
        </motion.div>

        {/* Quick actions — Scan Food and Store were dropped from here per
            the brief (both stay reachable from the '⋮' module menu / their
            own nav tabs, so nothing is orphaned); "My Reports" was dropped
            too (still reachable from Profile → Lab & Diab Reports), leaving
            just this one shortcut that doesn't live anywhere else on Home. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.22, ease: 'easeOut' }}
          className="home-library"
        >
          <motion.button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/70 shadow-sm flex items-center gap-3 cursor-pointer hover:border-emerald-300 hover:shadow-lg transition-[border-color,box-shadow]"
          >
            <motion.div whileHover={{ rotate: 8 }} className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </motion.div>
            <div className="min-w-0 flex-1 text-left">
              <span className="text-sm font-black text-zinc-900 block">{tr('Reversal Library', 'रिवर्सल लाइब्रेरी')}</span>
              <span className="text-[11px] text-zinc-500 font-semibold">{tr('Browse every reference step', 'हर संदर्भ चरण ब्राउज़ करें')}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </motion.button>
        </motion.div>

        {/* My Timeline — a compact preview of the real GitHub-commit-style
            audit trail (see MyTimelinePanel); tapping it, or "View All",
            opens the full history. Only ever the 3 most recent real
            actions here, so Home stays calm — the full log is one tap away. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.24, ease: 'easeOut' }}
          className="home-timeline space-y-3"
        >
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <GitCommit className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-black text-zinc-950">{tr('My Timeline', 'मेरी टाइमलाइन')}</h2>
            </div>
            <button type="button" onClick={() => setIsTimelineOpen(true)} className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer">
              {tr('View All', 'सभी देखें')}
            </button>
          </div>

          <motion.button
            type="button"
            onClick={() => setIsTimelineOpen(true)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            className="w-full rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden text-left cursor-pointer hover:border-emerald-300 hover:shadow-lg transition-[border-color,box-shadow]"
          >
            {recentActivity.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs font-semibold text-zinc-400">{tr('No activity yet — your uploads and edits will show up here.', 'अभी तक कोई गतिविधि नहीं — आपके अपलोड व संपादन यहां दिखेंगे।')}</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {recentActivity.map((item) => {
                  const action = ACTION_META[item.action];
                  const category = CATEGORY_META[item.category];
                  const CategoryIcon = category?.icon || GitCommit;
                  return (
                    <div key={item.id} className="p-3 flex items-center gap-2.5 hover:bg-emerald-50/50 transition-colors">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${action?.dot || 'bg-zinc-300'}`} />
                      <div className="w-7 h-7 rounded-lg bg-zinc-50 text-zinc-400 flex items-center justify-center shrink-0">
                        <CategoryIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-zinc-800 truncate">{item.title}</p>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 shrink-0">{relativeTime(item.createdAt, tr)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.button>
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

      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />

      <MyTimelinePanel
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        userId={userId}
      />

      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {isStatusOpen && statuses.length > 0 && (
        <StatusViewer statuses={statuses} onClose={handleCloseStatusViewer} tr={tr} />
      )}
    </div>
  );
};

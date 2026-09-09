import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bell, ChevronRight, FileText, BookOpen, Utensils, Sparkles, Leaf, MoreVertical,
  Activity, Stethoscope, ClipboardCheck, Droplets, Pill,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, Prescription, MedicalReportAnalysis, DailyLog } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { RecommendationsView, REVERSAL_GOALS, DEFAULT_REVERSAL_GOAL, labelMinutes } from './RecommendationsView';
import { ReversalLibraryPanel, PlanSection } from './ReversalLibraryPanel';
import { StreakWidget } from './StreakWidget';
import { CompletionTicker, TickerItem } from './CompletionTicker';
import { NotificationsPanel } from './NotificationsPanel';
import { BrandMark } from './Logo';
import { getDailyPlan, getTaskCompletion, getDailyLog, getNotifications } from '../utils/supabase';
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
  // The header shows the real UrCare artwork, same as the sidebar/loading
  // screen — not the generic vector mark. Falls back to that vector mark
  // only if the PNG itself ever fails to load (flaky network/cache miss).
  const [brandImgFailed, setBrandImgFailed] = useState(false);
  // Real notifications (prescriptions/reports/orders) — see NotificationsPanel.
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const userId = profile.id || '';
  const todayKey = toDateKey(new Date());

  const [programDay, setProgramDay] = useState<number | null>(null);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [isDailyLogLoading, setIsDailyLogLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getDailyPlan(todayKey).then((result) => {
      if (cancelled) return;
      setProgramDay(result.plan?.programDay ?? null);
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
  }, [userId, todayKey]);

  const timelineSections = useMemo(() => sections.filter((s) => !!s.timeLabel), [sections]);
  const referenceSections = useMemo(() => sections.filter((s) => !s.timeLabel), [sections]);
  const doneCount = timelineSections.filter((s) => completedToday[s.id]).length;

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

    // 3. Today's Plan / Treatment — the same completion count shown above.
    cards.push({
      id: 'todays-plan',
      icon: ClipboardCheck,
      title: tr("Today's Plan", 'आज की योजना'),
      value: timelineSections.length > 0
        ? tr(`${doneCount}/${timelineSections.length} completed`, `${doneCount}/${timelineSections.length} पूर्ण`)
        : tr('No plan available for today', 'आज के लिए कोई योजना नहीं'),
      state: timelineSections.length > 0 ? 'ok' : 'empty',
      onClick: onOpenPlan,
    });

    // 4. Nutrition — meals actually logged today (daily_logs.meals).
    const mealsCount = dailyLog?.meals?.length ?? 0;
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
  }, [profile.assessmentData, profile.calculatedPlan, reports, timelineSections, doneCount, dailyLog, prescriptions, onOpenAssessment, onOpenReports, onOpenPlan, onOpenScan, language]);

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
    <div id="urcare-profile-page" className="min-h-screen bg-transparent text-zinc-900 pb-16 relative overflow-hidden">

      {/* Faint decorative leaf watermark, matching the mockup's soft branded
          backdrop — purely decorative, sits behind everything. */}
      <Leaf className="absolute -top-6 -right-10 w-56 h-56 text-emerald-100 rotate-12 pointer-events-none" strokeWidth={1} aria-hidden="true" />

      {/* Header — brand mark + wordmark on the left (no tagline, per the
          brief); the streak, the '⋮' module menu, a (decorative, for now)
          notification bell, and the account avatar on the right. */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-8 py-3 sm:py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {brandImgFailed ? (
              <BrandMark className="w-8 h-8 text-emerald-600 shrink-0" />
            ) : (
              <img
                src="/UrCare.png"
                alt="UrCare"
                width={64}
                height={64}
                decoding="async"
                onError={() => setBrandImgFailed(true)}
                className="w-8 h-8 shrink-0 object-contain"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight truncate">
                <span className="text-zinc-950">UR</span><span className="text-emerald-500">CARE</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StreakWidget profile={profile} />
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

          {next ? (
            <div className="w-full p-3 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-500">
                <Utensils className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-zinc-400 uppercase">{tr('Up next', 'इसके बाद')}</div>
                <div className="text-xs font-bold text-zinc-800 truncate">{next.timeLabel} — {next.title}</div>
              </div>
              <div className="shrink-0 flex flex-col items-end">
                <LiveCountdown timeLabel={next.timeLabel || ''} />
                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wide">{tr('remaining', 'शेष')}</span>
              </div>
            </div>
          ) : current && (
            // `current` is the day's last timed step and nothing comes after
            // it — a real, honest state (not a bug), so it says so instead
            // of "Up Next" just silently disappearing.
            <div className="w-full p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-2.5 justify-center text-center">
              <span className="text-sm">🎉</span>
              <span className="text-xs font-bold text-emerald-800">{tr("That's everything for today — see you tomorrow!", 'आज के लिए सब कुछ पूरा — कल मिलते हैं!')}</span>
            </div>
          )}
        </motion.div>

        {/* Today's Health — a calm, continuously-scrolling stack of your
            real diabetes/reversal-focused stats (blood sugar, kidney
            health, plan/medication/meal/hydration progress, lab reports).
            Hover pauses it in place; nothing here is ever invented — a
            metric with nothing on file shows a genuine "add data" action
            instead of a fake number. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18, ease: 'easeOut' }}
          className="space-y-2.5"
        >
          <h2 className="text-sm font-black text-zinc-950 px-0.5">{tr("Today's Health", 'आज का स्वास्थ्य')}</h2>
          {isDailyLogLoading ? (
            <div className="rounded-3xl bg-emerald-50/50 border border-emerald-100 p-3 space-y-2.5" aria-live="polite" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-white/70 animate-pulse" />
              ))}
            </div>
          ) : (
            <CompletionTicker items={healthCards} />
          )}
        </motion.div>

        {/* Quick actions — Scan Food and Store were dropped from here per
            the brief (both stay reachable from the '⋮' module menu / their
            own nav tabs, so nothing is orphaned); just the two shortcuts
            that don't live anywhere else on Home. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-3"
        >
          <button type="button" onClick={onOpenReports} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center gap-1.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-800">{tr('My Reports', 'मेरी रिपोर्ट्स')}</span>
          </button>
          <button type="button" onClick={() => setIsLibraryOpen(true)} className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col items-center gap-1.5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-800">{tr('Reversal Library', 'रिवर्सल लाइब्रेरी')}</span>
          </button>
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

      <NotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </div>
  );
};

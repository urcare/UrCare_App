import React, { useState, useEffect, useRef } from 'react';
import { BuddyCompanion, showBuddy, buddyReact } from './BuddyCompanion';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Settings, Clock,
  ChevronRight, Sparkles, Trash2, Calendar, ShieldCheck, Activity,
  ShoppingBag, Stethoscope, Camera, Lock, ClipboardCheck,
  Package, User, Check, FileText, CheckCircle2, HeartPulse,
  LogOut, MessageSquare, AlertCircle, MoreVertical, X, Bot,
  Flame, Scale, Heart, Droplets, Target, UserCheck, Edit3, Hash, MessageSquareHeart, Trophy, ShoppingCart, Smile,
} from 'lucide-react';
import { RewardUnlockWatcher } from './Rewards';
import { PullToRefresh, refreshEverything } from './PullToRefresh';
import { getCachedAccountState } from '../utils/accountState';
import { ensurePhoneNotifications, showPhoneNotification, schedulePlanReminders, phoneNotificationsAreNative } from '../utils/phoneNotifications';
import { initPush, pushIsActive } from '../utils/pushNotifications';
import { 
  UserHealthProfile, MealItem, UserAccount, MedicalReportAnalysis, 
  Order, Prescription, BurnActivity, MedicationLogItem 
} from '../types';
import AppBackground from './AppBackground';
import { ProfilePage } from './ProfilePage';
import { RecommendationsView } from './RecommendationsView';
import { AccountPage } from './AccountPage';
import { ReportTimeline } from './ReportTimeline';
import { MyTimelineCard } from './MyTimelineCard';
import { FoodScanCard } from './FoodScanCard';
import { ReportPhotoViewer } from './ReportPhotoViewer';
import { MyCareFilesPanel } from './MyCareFilesPanel';
import { Logo } from './Logo';
import { toDateKey } from './DailyCalendar';
import { signOutUser, activePlanSections, addMealToLog, getMyOrders, getMyPrescriptions, getMyReports, deleteReport, updateReportText, getDailyPlan, getTaskCompletion, sendPlanReminder, logActivity, getMyQueueEntry, takePendingAdd, getNotifications, getIncomingFamilyCall, FamilyPerson } from '../utils/supabase';
import { FamilyCallModal } from './FamilyCallModal';
import { trackPageView } from '../utils/analytics';
import { calculateNutritionPlan } from '../utils/calculator';
import { labelMinutes } from './RecommendationsView';
import { useLanguage } from '../context/LanguageContext';
import { lazyComponent, PageLoader, prefetchLazyParts } from '../utils/lazyComponent';

// Loaded only when first opened (smaller, faster app start).
const LeaderboardPage = lazyComponent<typeof import('./LeaderboardPage')['LeaderboardPage']>(() => import('./LeaderboardPage'), 'LeaderboardPage', <PageLoader />);
const FamilyPage = lazyComponent<typeof import('./FamilyPage')['FamilyPage']>(() => import('./FamilyPage'), 'FamilyPage', <PageLoader />);
const HealthReportModal = lazyComponent<typeof import('./HealthReportModal')['HealthReportModal']>(() => import('./HealthReportModal'), 'HealthReportModal');
const SettingsModal = lazyComponent<typeof import('./SettingsModal')['SettingsModal']>(() => import('./SettingsModal'), 'SettingsModal');
const ProductsModule = lazyComponent<typeof import('./ProductsModule')['ProductsModule']>(() => import('./ProductsModule'), 'ProductsModule', <PageLoader />);
const FoodScannerModal = lazyComponent<typeof import('./FoodScannerModal')['FoodScannerModal']>(() => import('./FoodScannerModal'), 'FoodScannerModal');
const MyOrdersModal = lazyComponent<typeof import('./MyOrdersModal')['MyOrdersModal']>(() => import('./MyOrdersModal'), 'MyOrdersModal');
const DoctorConsultModal = lazyComponent<typeof import('./DoctorConsultModal')['DoctorConsultModal']>(() => import('./DoctorConsultModal'), 'DoctorConsultModal');
const ClinicalFeedbackModal = lazyComponent<typeof import('./ClinicalFeedbackModal')['ClinicalFeedbackModal']>(() => import('./ClinicalFeedbackModal'), 'ClinicalFeedbackModal');
const AppFeedbackModal = lazyComponent<typeof import('./AppFeedbackModal')['AppFeedbackModal']>(() => import('./AppFeedbackModal'), 'AppFeedbackModal');
const RootCauseAssessmentModal = lazyComponent<typeof import('./RootCauseAssessmentModal')['RootCauseAssessmentModal']>(() => import('./RootCauseAssessmentModal'), 'RootCauseAssessmentModal');
const TrackerModule = lazyComponent<typeof import('./TrackerModule')['TrackerModule']>(() => import('./TrackerModule'), 'TrackerModule', <PageLoader />);
const RiskAssessmentModal = lazyComponent<typeof import('./RiskAssessmentModal')['RiskAssessmentModal']>(() => import('./RiskAssessmentModal'), 'RiskAssessmentModal');

interface DashboardProps {
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateProfile: (updated: UserHealthProfile) => void;
  onUpdateAccount?: (updated: UserAccount) => void;
  onResetOnboarding: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  account,
  onUpdateProfile,
  onUpdateAccount,
  onResetOnboarding,
}) => {
  const { t, language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  // Navigation Tabs — 'profile' is Home (the default/main summary screen),
  // 'plan' is the full Daily Plan timeline, 'premium' is UrCare Camera (the
  // food scanner, free for everyone — the tab id is just historical),
  // 'account' is the standalone Profile page
  // (identity, stats, quick actions). 'reports', 'assessment' + 'store' are
  // always free — 'store' isn't in the primary nav (see navItems below) but
  // is still reachable from Home's quick-actions grid.
  // Quietly fetch the on-demand screens a few seconds after opening.
  useEffect(() => { prefetchLazyParts(); }, []);
  const [activeTab, setActiveTab] = useState<'profile' | 'plan' | 'premium' | 'account' | 'reports' | 'assessment' | 'store' | 'tracker' | 'leaderboard' | 'family'>('profile');
  // Pharmacy sub-sections (Shop / Cart / My Orders) opened from the menu or the
  // header cart button; the cart count shown on that button.
  const openPharmacy = (view: 'shop' | 'cart' | 'orders') => {
    (window as any).__urcarePharmacyView = view;
    setActiveTab('store');
    window.dispatchEvent(new CustomEvent('urcare:pharmacy', { detail: view }));
  };
  // "Shop Now" on a plan step opens that product in the pharmacy.
  useEffect(() => {
    const onOpen = (e: Event) => openPharmacy(`product:${(e as CustomEvent).detail}` as any);
    window.addEventListener('urcare:open-product', onOpen);
    return () => window.removeEventListener('urcare:open-product', onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [cartCount, setCartCount] = useState<number>(() => (getCachedAccountState().cart || []).reduce((n, it) => n + (it.quantity || 0), 0));
  useEffect(() => {
    const onCount = (e: Event) => setCartCount(Number((e as CustomEvent).detail) || 0);
    window.addEventListener('urcare:cart-count', onCount);
    return () => window.removeEventListener('urcare:cart-count', onCount);
  }, []);

  // The Home "+" opens Family & Friends straight into "add someone".
  const [familyStartAdding, setFamilyStartAdding] = useState(false);
  // Opened from a scanned profile QR (?add=@name): show that person with "Add".
  const [familyQuery, setFamilyQuery] = useState('');
  useEffect(() => {
    const pending = takePendingAdd();
    if (pending) { setFamilyQuery(pending); setFamilyStartAdding(true); setActiveTab('family'); }
  }, []);

  // '⋮' module switcher — a single drawer, opened from one fixed spot in the
  // persistent header/sidebar (never inline in a tab's scrolling content), so
  // it never jumps position when the tab changes or the page scrolls.
  const [isModuleMenuOpen, setIsModuleMenuOpen] = useState(false);
  // 'Daily Plan', 'UrCare Camera' and 'Profile' are deliberately left out
  // here — they already have their own permanent spot in the bottom/side
  // nav bar, so listing them again in this drawer was pure duplication.
  // Reports/Store are now also in the primary bottom/side nav (see navItems
  // below), so they're not duplicated here too — only what's genuinely
  // drawer-only stays.
  const moduleMenuItems = [
    { id: 'reports' as const, label: tr('My Reports', 'मेरी रिपोर्ट्स'), icon: FileText },
    { id: 'assessment' as const, label: tr('Assessment', 'असेसमेंट'), icon: ClipboardCheck },
    { id: 'store' as const, label: tr('UrCare Medical Pharmacy', 'UrCare मेडिकल फार्मेसी'), icon: ShoppingBag },
    { id: 'family' as const, label: tr('Health Circle', 'हेल्थ सर्कल'), icon: Heart },
    { id: 'leaderboard' as const, label: tr('Leaderboard & Rewards', 'लीडरबोर्ड व रिवॉर्ड्स'), icon: Trophy },
    // Not a tab — opens the Doctor Consult modal directly (see the drawer's
    // onClick). Used to be its own persistent sidebar card; moved in here to
    // declutter the sidebar.
    { id: 'doctor_hotline' as const, label: tr('Doctor Hotline', 'डॉक्टर हॉटलाइन'), icon: Stethoscope },
    // Not a tab — opens the app-feedback form (what helps / what is missing).
    { id: 'app_feedback' as const, label: tr('Give Feedback', 'प्रतिक्रिया दें'), icon: MessageSquareHeart },
    // Not a tab — brings the UrCare Buddy back if it was hidden.
    { id: 'buddy' as const, label: tr('Show UrCare Buddy', 'UrCare Buddy दिखाएं'), icon: Smile },
    // Not a tab — opens the Settings modal directly (see the drawer's onClick).
    { id: 'settings' as const, label: tr('Settings', 'सेटिंग्स'), icon: Settings },
    // Not a tab either — opens the sign-out confirmation (see the drawer's onClick).
    { id: 'logout' as const, label: tr('Sign Out', 'साइन आउट'), icon: LogOut },
  ];

  // Without this, switching tabs while scrolled down on the previous tab
  // (e.g. scrolled through Home, then tapping UrCare Camera) opens the new tab at that
  // same leftover scroll position instead of its top — looking like the old
  // tab's content bled into the new one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    trackPageView(`/${activeTab}`);
  }, [activeTab]);

  const [isFoodScannerOpen, setIsFoodScannerOpen] = useState(false);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isRiskAssessmentOpen, setIsRiskAssessmentOpen] = useState(false);

  // Incoming Health Circle voice calls — rings from anywhere in the app
  // (not just while Family & Friends is open), by polling every 3s. Once a
  // call is showing, polling pauses so it isn't re-triggered mid-call.
  const [incomingCall, setIncomingCall] = useState<{ id: string; person: FamilyPerson } | null>(null);
  useEffect(() => {
    if (incomingCall) return;
    const poll = () => { if (document.visibilityState === 'visible') getIncomingFamilyCall().then((c) => { if (c) setIncomingCall(c); }); };
    const interval = window.setInterval(poll, 3000);
    return () => window.clearInterval(interval);
  }, [incomingCall]);

  // Daily target macros (used to personalize the AI food scan & recommendations)
  const targetProtein = profile.calculatedPlan?.proteinGrams || 130;
  const targetCarbs = profile.calculatedPlan?.carbsGrams || 180;
  const targetFats = profile.calculatedPlan?.fatsGrams || 50;

  // Meals logged via the AI Food Scanner (kept in-memory for this session)
  const [meals, setMeals] = useState<MealItem[]>([]);

  // Doctor Prescriptions — real ones issued by Admin for THIS account, fetched below.
  // (Never seeded with demo data: showing another user's prescription here would be a real bug.)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  // User Orders — real ones placed by THIS account, fetched below + appended live on checkout.
  const [userOrders, setUserOrders] = useState<Order[]>([]);

  // This user's real reports — fetched from Supabase (never seeded/mocked).
  const [myReports, setMyReports] = useState<MedicalReportAnalysis[]>([]);

  // Pull this account's real orders, admin-issued prescriptions, and lab reports
  // straight from Supabase (respecting row-level security) so Admin-side actions
  // (issuing an Rx, order status updates, report review) are reflected here too.
  const refreshAccountData = () => {
    if (!account?.uid) return;
    getMyOrders(account.uid).then(setUserOrders).catch(() => {});
    getMyPrescriptions(account.uid).then(setPrescriptions).catch(() => {});
    getMyReports(account.uid).then(setMyReports).catch(() => {});
  };

  useEffect(() => {
    refreshAccountData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.uid]);

  // Coming back to the app (switching apps, unlocking the phone) reloads
  // everything at once, so what you see is always current.
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 10000) return;
      last = Date.now();
      refreshEverything();
      refreshAccountData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.uid]);

  // "Up Next" plan reminder — checks the day's real timeline every 30s and
  // fires one real notification ~5 minutes before whichever step is next,
  // once per step per day (deduped both locally and, belt-and-suspenders,
  // server-side — see /api/notifications/reminder). Lives here rather than
  // inside Home/Plan specifically so it keeps checking no matter which tab
  // is open. Note: this only works while the app itself is open in a tab —
  // there's no service-worker/push setup yet for a true background alert
  // when the app or browser is fully closed. Respects the real Notifications
  // toggle in Settings (profile.preferences.enableNotifications) — off means
  // this reminder simply never fires, rather than the switch being decorative.
  useEffect(() => {
    if (!account?.uid) return;
    if (profile.preferences?.enableNotifications === false) return;
    let cancelled = false;

    // Phone notification bar (app) / browser notifications (web).
    ensurePhoneNotifications();
    let scheduledSignature = '';

    const check = async () => {
      const todayKey = toDateKey(new Date());
      const [planResult, completedToday] = await Promise.all([
        getDailyPlan(todayKey),
        getTaskCompletion(account.uid, todayKey),
      ]);
      if (cancelled) return;

      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      // On the phone, schedule a reminder before every step still to come
      // today, so they arrive in the notification bar even with the app closed.
      const upcoming = activePlanSections(planResult, account.uid)
        .filter((s: any) => !!s.timeLabel && !completedToday[s.id])
        .map((s: any) => { const m = labelMinutes(s.timeLabel); const at = new Date(); at.setHours(Math.floor(m / 60), m % 60, 0, 0); return { id: s.id, title: s.title, timeLabel: s.timeLabel, at }; })
        .filter((s: any) => s.at.getTime() > Date.now());
      const signature = `${todayKey}|${upcoming.map((u: any) => u.id + u.timeLabel).join(',')}`;
      if (signature !== scheduledSignature) { scheduledSignature = signature; schedulePlanReminders(upcoming, tr); }

      // Remind about whichever plan the user is actually following.
      const next = activePlanSections(planResult, account.uid)
        .filter((s: any) => !!s.timeLabel && !completedToday[s.id])
        .map((s: any) => ({ ...s, mins: labelMinutes(s.timeLabel) }))
        .filter((s: any) => s.mins > nowMinutes)
        .sort((a: any, b: any) => a.mins - b.mins)[0];
      if (!next) return;

      const minsUntil = next.mins - nowMinutes;
      if (minsUntil > 5) return;

      const remindedKey = `urcare:reminded:${account.uid}:${todayKey}:${next.id}`;
      if (localStorage.getItem(remindedKey)) return;
      localStorage.setItem(remindedKey, '1');

      sendPlanReminder(
        `${next.title} starts ${minsUntil <= 1 ? 'in a minute' : `in ${minsUntil} minutes`}`,
        next.timeLabel,
        `${todayKey}:${next.id}`,
      ).catch(() => {});

      // The phone already has this one scheduled; on the web show it now.
      if (!phoneNotificationsAreNative()) showPhoneNotification(next.title, `Starting at ${next.timeLabel}`, remindedKey);
    };

    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [account?.uid, profile.preferences?.enableNotifications]);

  // Every new in-app notification (family progress, orders, doctor replies…)
  // also goes to the phone's notification bar. Checked every 30 s while the
  // app is open or in the background; the first check only remembers what's
  // already there, so old ones don't pop up again.
  useEffect(() => {
    if (!account?.uid) return;
    if (profile.preferences?.enableNotifications === false) return;
    const seenKey = `urcare_pushed_notifications_${account.uid}`;
    let seen: Set<string> | null = null;
    try { const raw = localStorage.getItem(seenKey); if (raw) seen = new Set(JSON.parse(raw)); } catch {}
    let cancelled = false;
    // With Firebase push on, the server sends these to the phone itself.
    initPush();
    const check = async () => {
      const list = await getNotifications().catch(() => []);
      if (cancelled) return;
      if (pushIsActive()) { seen = new Set(list.map((n) => n.id)); return; }
      if (!seen) {
        seen = new Set(list.map((n) => n.id));
      } else {
        for (const n of list) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          // Plan reminders are scheduled on the phone already.
          if (!n.read && !(n.data as any)?.dedupeKey) showPhoneNotification(n.title, n.body || '', `notif:${n.id}`);
        }
      }
      try { localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-300))); } catch {}
    };
    check();
    const interval = setInterval(check, 30000);
    window.addEventListener('urcare:refresh', check);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('urcare:refresh', check); };
  }, [account?.uid, profile.preferences?.enableNotifications]);

  // Modals state
  const [isHealthReportOpen, setIsHealthReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [isDoctorConsultOpen, setIsDoctorConsultOpen] = useState(false);
  const [isAppFeedbackOpen, setIsAppFeedbackOpen] = useState(false);
  const [doctorConsultReason, setDoctorConsultReason] = useState<string>('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Handler for meals logged from the AI Food Scanner — persisted to Supabase
  // (daily_logs) so the Premium tab's daily calendar shows real logged macros
  // for any past day, from any device.
  const handleAddMeal = (meal: MealItem) => {
    setMeals((prev) => [meal, ...prev]);
    if (account?.uid) {
      addMealToLog(account.uid, toDateKey(new Date()), meal).catch(() => {});
      logActivity(account.uid, 'created', 'meal', `Logged meal: ${meal.name}`, `${meal.calories} kcal`).catch(() => {});
    }
  };

  // Store Order Placement
  const handleOrderPlaced = (newOrder: Order) => {
    setUserOrders((prev) => [newOrder, ...prev]);
  };

  // `addedConditions` — real condition labels the server already merged into
  // health_profiles.existing_concerns because of THIS report's own abnormal
  // findings (deterministic, see /api/analyze-report — not AI-decided).
  // Mirroring them into local profile state here keeps this tab in sync
  // immediately, and tells any open Daily Plan screen to refetch so it
  // actually reflects the new condition right away instead of on next visit.
  const handleUpdateReport = (newAnalysis: MedicalReportAnalysis, addedConditions?: string[]) => {
    const mergedConditions = addedConditions && addedConditions.length > 0
      ? Array.from(new Set([...(profile.medicalConditions || []), ...addedConditions]))
      : profile.medicalConditions;

    const recalculatedPlan = calculateNutritionPlan(
      profile.gender || 'male',
      profile.age || 30,
      profile.heightCm || 172,
      profile.currentWeightKg || 75,
      profile.targetWeightKg || 68,
      profile.goal || 'lose_weight',
      profile.activityLevel || 'moderately_active',
      profile.pace || 'steady',
      newAnalysis
    );

    const updated: UserHealthProfile = {
      ...profile,
      reportAnalysis: newAnalysis,
      medicalConditions: mergedConditions,
      calculatedPlan: recalculatedPlan,
      updatedAt: new Date().toISOString(),
    };
    onUpdateProfile(updated);

    if (addedConditions && addedConditions.length > 0) {
      window.dispatchEvent(new CustomEvent('urcare:daily-plan-changed'));
      // The server already wrote this user's activity_log row directly —
      // this just wakes up any already-open My Timeline / recent-activity
      // preview to refetch and pick it up immediately.
      window.dispatchEvent(new CustomEvent('urcare:activity-logged'));
    }
  };

  // Permanently remove one uploaded report from this user's submission log.
  const handleDeleteReport = (reportId?: string, reportName?: string) => {
    if (!reportId) return;
    // Snapshot the full report (photo, extracted data, biomarkers — everything)
    // into this deletion's own timeline entry BEFORE it's gone from
    // lab_reports for good, so the Report Timeline can still open it exactly
    // as it looked, even long after the row itself no longer exists.
    const reportSnapshot = myReports.find((r) => r.id === reportId)
      || (profile.reportAnalysis?.id === reportId ? profile.reportAnalysis : undefined);
    deleteReport(reportId).then(() => {
      setMyReports((prev) => prev.filter((r) => r.id !== reportId));
    }).catch(() => {});
    if (account?.uid) {
      logActivity(
        account.uid, 'deleted', 'report',
        `Deleted report: ${reportName || 'Diagnostic Lab Report'}`,
        undefined,
        reportSnapshot ? { reportId, reportSnapshot } : { reportId },
      ).catch(() => {});
    }

    // If the deleted report was the one currently driving the diet plan, fall back to
    // the plan calculated from onboarding answers alone (no report data).
    if (profile.reportAnalysis?.id === reportId) {
      const recalculatedPlan = calculateNutritionPlan(
        profile.gender || 'male',
        profile.age || 30,
        profile.heightCm || 172,
        profile.currentWeightKg || 75,
        profile.targetWeightKg || 68,
        profile.goal || 'lose_weight',
        profile.activityLevel || 'moderately_active',
        profile.pace || 'steady'
      );
      onUpdateProfile({
        ...profile,
        reportAnalysis: undefined,
        calculatedPlan: recalculatedPlan,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Lets the user correct the extracted text on their own report (e.g. a
  // misread OCR value) instead of it being permanently stuck wrong.
  const handleSaveReportText = async (reportId: string, reportName: string | undefined, newText: string) => {
    const { error } = await updateReportText(reportId, newText);
    if (error) return;
    setMyReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, reportText: newText } : r)));
    if (account?.uid) {
      logActivity(account.uid, 'updated', 'report', `Edited extracted data: ${reportName || 'Diagnostic Lab Report'}`, undefined, { reportId }).catch(() => {});
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setShowLogoutConfirm(false);
    onResetOnboarding();
  };

  const handleOpenDoctorConsult = (reason?: any) => {
    const finalReason = typeof reason === 'string' && reason.trim().length > 0
      ? reason.trim()
      : 'Clinical consultation regarding metabolic diet and medical biomarkers.';
    setDoctorConsultReason(finalReason);
    setIsDoctorConsultOpen(true);
  };

  // Consultation queue popup — a real-time-feeling alert that shows up
  // no matter which tab is open (not just while the Doctor Consult modal
  // itself happens to be open), for the moment it becomes this patient's
  // turn, and for any other live change to their queue position. A real
  // DB notification (bell) is also fired server-side when the admin calls
  // someone in — this is the immediate, hard-to-miss version of that same
  // event, so the patient doesn't have to be staring at the bell to notice.
  const [queueAlert, setQueueAlert] = useState<{ tone: 'turn' | 'update'; message: string } | null>(null);
  const prevQueueStateRef = useRef<{ status: string; position: number } | null>(null);

  useEffect(() => {
    if (!account?.uid) return;
    let cancelled = false;

    const poll = () => {
      getMyQueueEntry().then(({ entry, position }) => {
        if (cancelled) return;
        if (!entry) { prevQueueStateRef.current = null; return; }
        const prev = prevQueueStateRef.current;

        if (entry.status === 'in_progress' && prev?.status !== 'in_progress') {
          setQueueAlert({ tone: 'turn', message: tr(`It's your turn! Token #${entry.tokenNumber} is being called now.`, `आपकी बारी है! टोकन #${entry.tokenNumber} को बुलाया जा रहा है।`) });
        } else if (entry.status === 'waiting' && prev && prev.status === 'waiting' && prev.position !== position) {
          setQueueAlert({
            tone: 'update',
            message: position > 0
              ? tr(`Queue updated — ${position} patient${position === 1 ? '' : 's'} ahead of you now.`, `कतार अपडेट हुई — अब ${position} मरीज़ आपसे आगे हैं।`)
              : tr("Queue updated — you're next!", 'कतार अपडेट हुई — अगली बारी आपकी है!'),
          });
        }
        prevQueueStateRef.current = { status: entry.status, position };
      });
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [account?.uid]);

  useEffect(() => {
    if (!queueAlert) return;
    const timeout = setTimeout(() => setQueueAlert(null), queueAlert.tone === 'turn' ? 10000 : 5000);
    return () => clearTimeout(timeout);
  }, [queueAlert]);

  // Pure Light Mode Style Constants
  const cardClass = 'bg-white border border-zinc-200/90 shadow-sm';
  const subCardClass = 'bg-zinc-50 border border-zinc-200/80';
  const activeTabClass = 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20';
  const inactiveTabClass = 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100';

  // The five primary destinations stay in the persistent nav — Assessment/
  // Settings moved into the '⋮' side menu instead, to avoid cluttering the
  // always-visible nav with less-frequent destinations. UrCare Camera (the
  // food scanner) sits alone as the raised center action, not in this list —
  // see the mobile dock below.
  const navItems = [
    { id: 'profile', label: t('navHome'), icon: Clock },
    { id: 'plan', label: t('navPlan'), icon: Calendar },
    { id: 'reports', label: tr('My Reports', 'मेरी रिपोर्ट्स'), icon: FileText },
    { id: 'account', label: t('navProfile'), icon: User },
  ];

  return (
    <div id="urcare-dashboard-root" className="w-full min-h-screen bg-[#F8FAFC] text-zinc-900 pb-24 md:pb-12">

      {/* App-wide backdrop — shown everywhere once onboarding is done (this
          root only ever mounts post-onboarding, see App.tsx). AppBackground
          positions itself fixed with z-index:-1 (see AppBackground.css), so
          every tab's content (which leaves its own root transparent, see
          ProfilePage/AccountPage) scrolls over this one same still backdrop
          instead of each tab carrying its own flat page color. */}
      <AppBackground />
      {/* Pops up whenever a new badge / milestone is unlocked. */}
      <RewardUnlockWatcher userId={account.uid} tr={tr} />

      {/* QUEUE ALERT POPUP — shows on top of whatever tab is open the
          instant this patient's turn comes up (or their position changes),
          not just while the Doctor Consult modal happens to be open. */}
      <AnimatePresence>
        {queueAlert && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md"
          >
            <div className={`rounded-2xl shadow-2xl p-4 flex items-start gap-3 ${
              queueAlert.tone === 'turn'
                ? 'bg-brand-gradient text-white'
                : 'bg-white border border-emerald-200 text-zinc-900'
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                queueAlert.tone === 'turn' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <Hash className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-black leading-snug ${queueAlert.tone === 'turn' ? 'text-white' : 'text-zinc-900'}`}>
                  {queueAlert.message}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => { setQueueAlert(null); handleOpenDoctorConsult(); }}
                    className={`text-xs font-black uppercase tracking-wide cursor-pointer ${
                      queueAlert.tone === 'turn' ? 'text-white underline' : 'text-emerald-700 underline'
                    }`}
                  >
                    {tr('View Queue', 'कतार देखें')}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQueueAlert(null)}
                className={`shrink-0 p-1 rounded-lg cursor-pointer ${queueAlert.tone === 'turn' ? 'hover:bg-white/15' : 'hover:bg-zinc-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. STATIC SIDEBAR NAVIGATION (DESKTOP) */}
      <aside className="hidden md:flex flex-col justify-between w-64 fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-zinc-200 p-5 shadow-xs">
        <div className="space-y-6">
          
          {/* Logo & Brand — no subtitle once inside the app itself, only
              during onboarding/auth (see Logo's other call sites). */}
          <div className="pb-4 border-b border-zinc-100 flex justify-center">
            <Logo size="sm" showSubtitle={false} />
          </div>

          {/* User Quick Info with My Profile Button */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs overflow-hidden">
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile.name ? profile.name.slice(0, 2).toUpperCase() : 'UC'
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black truncate text-zinc-950">{profile.name || tr('Member', 'सदस्य')}</span>
                </div>
                <p className="text-[10px] text-zinc-500 truncate font-medium">{profile.phone || profile.email || account.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="p-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer shrink-0"
              title={t('openMyProfile')}
            >
              <User className="w-4 h-4 text-emerald-700" />
            </button>
          </div>

          {/* Main Navigation Tabs — UrCare Camera (the food scanner) is
              inserted right after Home, mirroring its raised, prominent spot
              in the mobile dock below even though there's no "floating
              center button" concept in a plain vertical sidebar list. */}
          <nav className="space-y-1.5">
            {navItems.slice(0, 2).map((item) => {
              const ItemIcon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full px-3.5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
                    isActive ? activeTabClass : inactiveTabClass
                  }`}
                >
                  <ItemIcon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setActiveTab('premium')}
              className={`w-full px-3.5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === 'premium' ? activeTabClass : inactiveTabClass
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{t('navCamera')}</span>
            </button>

            {navItems.slice(2).map((item) => {
              const ItemIcon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full px-3.5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
                    isActive ? activeTabClass : inactiveTabClass
                  }`}
                >
                  <ItemIcon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-zinc-100 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsModuleMenuOpen(true)}
              className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title={tr('More', 'अधिक')}
            >
              <MoreVertical className="w-4 h-4 text-zinc-700" />
            </button>

            <button
              type="button"
              onClick={() => openPharmacy('cart')}
              className="relative p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title={tr('Cart', 'कार्ट')}
            >
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">{cartCount}</span>}
            </button>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer"
              title={tr('Sign Out', 'साइन आउट')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MOBILE TOP HEADER — module menu on the left, actions on the
          right; no logo here (it already lives in the desktop sidebar and
          at the top of the '⋮' drawer, so it doesn't need a third spot).
          Hidden on Home specifically — that tab has its own full header
          (brand mark, notification bell, account avatar) with its own '⋮'
          trigger, so this one would just be a second header stacked above
          it otherwise. */}
      {activeTab !== 'profile' && (
      <header className="app-topbar md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        {/* '⋮' module switcher — lives here, in the one persistent sticky
            header shown on every tab, so it never jumps position when you
            switch tabs or scroll (unlike an inline element placed inside
            each tab's content). The streak widget used to sit next to it
            here; it now lives on the Profile page instead. */}
        <div className="shrink-0 flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsModuleMenuOpen(true)}
            className="p-2 rounded-xl text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 bg-white transition-all cursor-pointer shrink-0"
            title={tr('More', 'अधिक')}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => openPharmacy('cart')}
            className="relative p-2 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 shrink-0"
            title={tr('Cart', 'कार्ट')}
          >
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </header>
      )}

      {/* 3. MOBILE BOTTOM NAVIGATION DOCK — a raised, animated circular
          button for UrCare Camera (the food scanner) floats dead-center
          above the bar, absolutely positioned against this `relative`
          wrapper instead of nudged with a negative margin inside the flex
          row (which never centered cleanly against the bar). A center
          spacer the same width as the button keeps the flanking items from
          drifting into its footprint.
          Each of the 4 tab buttons is `flex-1` (equal width) rather than
          `justify-around`-spaced — around-spacing puts half-size gaps at
          the outer edges too, so the two end tabs never sit as flush/even
          as the two beside the spacer; equal-width flex fixes that
          regardless of viewport width. Bottom padding adds the device's
          safe-area inset on top of its own space, so the bar clears the
          home-indicator gesture area on notched phones instead of the
          labels sitting flush against it. */}
      <nav
        className="app-bottomnav md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-1 pt-1.5"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <div className="relative flex items-center">
          {navItems.slice(0, 2).map((item) => {
            const ItemIcon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as any)}
                className={`flex-1 min-w-0 flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-emerald-600 font-extrabold' : 'text-zinc-500 font-medium'
                }`}
              >
                <ItemIcon className="w-4 h-4" />
                <span className="text-[10px] tracking-tight truncate max-w-full">{item.label}</span>
              </button>
            );
          })}

          {/* Spacer — reserves the center button's footprint in the flex
              row so the flanking tabs space out around it instead of
              crowding toward the middle. */}
          <div className="w-14 shrink-0" aria-hidden="true" />

          {navItems.slice(2).map((item) => {
            const ItemIcon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as any)}
                className={`flex-1 min-w-0 flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-emerald-600 font-extrabold' : 'text-zinc-500 font-medium'
                }`}
              >
                <ItemIcon className="w-4 h-4" />
                <span className="text-[10px] tracking-tight truncate max-w-full">{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveTab('premium')}
            title={t('navCamera')}
            className="absolute left-1/2 -translate-x-1/2 -top-7 cursor-pointer"
          >
            <motion.span
              className="absolute inset-0 rounded-full bg-emerald-500"
              animate={{ opacity: [0.35, 0, 0.35], scale: [1, 1.35, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span
              className={`relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-600/40 ring-4 ring-white transition-transform active:scale-95 ${
                activeTab === 'premium' ? 'bg-emerald-600' : 'bg-emerald-500'
              }`}
            >
              <Camera className="w-6 h-6" />
            </span>
          </button>
        </div>
      </nav>

      {/* '⋮' module switcher drawer — a single instance, mounted once here (not
          inside either tab branch below), so it's the exact same drawer no
          matter which tab is active or how far the page is scrolled. Its
          trigger buttons live in the persistent mobile header and the
          desktop sidebar footer, above. */}
      <AnimatePresence>
        {isModuleMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModuleMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[80vw] bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <Logo size="sm" showSubtitle={false} />
                <button
                  type="button"
                  onClick={() => setIsModuleMenuOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
              <nav className="module-menu flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1">
                {moduleMenuItems.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = item.id !== 'settings' && item.id !== 'logout' && item.id !== 'doctor_hotline' && item.id !== 'app_feedback' && activeTab === (item.id as typeof activeTab);
                  return (
                    <React.Fragment key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id === 'settings') {
                          setIsSettingsOpen(true);
                        } else if (item.id === 'logout') {
                          setShowLogoutConfirm(true);
                        } else if (item.id === 'doctor_hotline') {
                          handleOpenDoctorConsult();
                        } else if (item.id === 'app_feedback') {
                          setIsAppFeedbackOpen(true);
                        } else if (item.id === 'buddy') {
                          showBuddy();
                          buddyReact('wave', tr("Hi! I'm back 👋", 'हाय! मैं वापस आ गई 👋'));
                        } else {
                          setFamilyStartAdding(false);
                          setActiveTab(item.id);
                        }
                        setIsModuleMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left text-[14px] font-semibold leading-snug tracking-[-0.01em] transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.id === 'logout'
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-zinc-800 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.id === 'logout'
                            ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100'
                            : 'bg-zinc-100 group-hover:bg-emerald-100 text-zinc-600 group-hover:text-emerald-700'
                      }`}>
                        <ItemIcon className="w-4.5 h-4.5" />
                      </div>
                      <span className="flex-1 min-w-0 text-left">{item.label}</span>
                      <ChevronRight className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all" />
                    </button>
                    {item.id === 'store' && (
                      <div className="ml-7 pl-4 border-l-2 border-emerald-100 space-y-0.5 pb-1">
                        {([
                          ['shop', tr('Shop', 'शॉप'), ShoppingBag],
                          ['cart', tr(cartCount ? `Cart (${cartCount})` : 'Cart', cartCount ? `कार्ट (${cartCount})` : 'कार्ट'), ShoppingCart],
                          ['orders', tr('My Orders & history', 'मेरे ऑर्डर व हिस्ट्री'), Package],
                        ] as const).map(([view, label, SubIcon]) => (
                          <button
                            key={view}
                            type="button"
                            onClick={() => { openPharmacy(view); setIsModuleMenuOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] font-semibold text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                          >
                            <SubIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="flex-1 min-w-0">{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    </React.Fragment>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* UrCare Buddy — walks around every screen */}
      <BuddyCompanion page={activeTab} />

      {/* 4. MAIN CONTENT CONTAINER (Desktop pl-64) */}
      <PullToRefresh onRefresh={() => refreshAccountData()}>
      <div className="md:pl-64 w-full">

        {activeTab === 'profile' ? (
          <ProfilePage
            profile={profile}
            account={account}
            prescriptions={prescriptions}
            reports={myReports}
            onOpenProfile={() => setActiveTab('account')}
            onOpenPlan={() => setActiveTab('plan')}
            onOpenScan={() => setActiveTab('premium')}
            onOpenReports={() => setActiveTab('reports')}
            onOpenAssessment={() => setIsAssessmentModalOpen(true)}
            onOpenMoreMenu={() => setIsModuleMenuOpen(true)}
          />
        ) : activeTab === 'family' ? (
          <FamilyPage
            key={`${familyStartAdding ? 'adding' : 'view'}-${familyQuery}`}
            tr={tr}
            startAdding={familyStartAdding}
            initialQuery={familyQuery || undefined}
            selfName={profile.name || account.displayName || ''}
            selfAvatar={account.avatarUrl || null}
            onOpenStore={() => setActiveTab('store')}
          />
        ) : activeTab === 'leaderboard' ? (
          <LeaderboardPage tr={tr} userId={account.uid} />
        ) : activeTab === 'plan' || activeTab === 'tracker' ? (
          <main className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
            {/* Daily Plan | My Tracker — the tracker lives inside Plan. */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-emerald-50 border border-emerald-100">
              {(['plan', 'tracker'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setActiveTab(v)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black cursor-pointer transition ${activeTab === v ? 'bg-brand-gradient text-white shadow-md' : 'text-emerald-800 hover:bg-white/70'}`}>
                  {v === 'plan' ? <Calendar className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                  {v === 'plan' ? tr('Daily Plan', 'डेली प्लान') : tr('My Tracker', 'मेरा ट्रैकर')}
                </button>
              ))}
            </div>
            {activeTab === 'tracker' ? (
              <div className="-mx-4 sm:-mx-8 -mt-2">
                <TrackerModule
                  profile={profile}
                  account={account}
                  reports={myReports}
                  onUpdateProfile={onUpdateProfile}
                  onOpenReports={() => setActiveTab('reports')}
                />
              </div>
            ) : (<>
            {/* Leaderboard & referral teaser, right above the plan */}
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className="lb-teaser w-full flex items-center gap-3 p-4 rounded-2xl text-left text-white cursor-pointer active:scale-[0.99] transition-transform"
            >
              <span className="w-11 h-11 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0"><Trophy className="w-5 h-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{tr('Leaderboard & Rewards', 'लीडरबोर्ड व रिवॉर्ड्स')}</span>
                <span className="block text-[11px] font-semibold text-white/85">{tr('See the top 100 and your monthly badges', 'टॉप 100 और अपने मासिक बैज देखें')}</span>
              </span>
              <ChevronRight className="w-5 h-5 shrink-0 opacity-80" />
            </button>
            <RecommendationsView profile={profile} prescriptions={prescriptions} />
            </>)}
          </main>
        ) : activeTab === 'account' ? (
          <AccountPage
            profile={profile}
            account={account}
            reports={myReports}
            onUpdateProfile={onUpdateProfile}
            onUpdateAccount={onUpdateAccount}
            onOpenOrders={() => setIsMyOrdersOpen(true)}
            onOpenReports={() => setIsHealthReportOpen(true)}
            onOpenAssessment={() => setIsAssessmentModalOpen(true)}
            onLogOut={() => setShowLogoutConfirm(true)}
            onOpenFamily={() => setActiveTab('family')}
            prescriptions={prescriptions}
          />
        ) : (
          <main className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

          {/* ========================================================================= */}
          {/* TAB VIEWS CONTENT                                                         */}
          {/* ========================================================================= */}

          {/* ===================================================================== */}
          {/* UrCare Camera tab — AI Food Scan. The Daily Plan lives directly on Home. */}
          {/* ===================================================================== */}
          {activeTab === 'premium' && (
            <div className="space-y-6 text-left">
              <FoodScanCard tr={tr} onOpen={() => setIsFoodScannerOpen(true)} />
              <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-zinc-950">{tr('UrCare Food Scan', 'UrCare फूड स्कैन')}</h3>
                    <p className="text-xs text-zinc-500 max-w-md mt-0.5">
                      {tr("Snap a photo or describe your meal — UrCare tells you if it's good for your health profile, or not, and why.", 'फोटो लें या अपना भोजन बताएं — UrCare आपको बताएगा कि यह आपकी स्वास्थ्य प्रोफ़ाइल के लिए अच्छा है या नहीं, और क्यों।')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFoodScannerOpen(true)}
                  className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{tr('Scan Food Now', 'अभी भोजन स्कैन करें')}</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* STORE TAB — free for everyone, unchanged shopping experience           */}
          {/* ===================================================================== */}
          {activeTab === 'store' && (
            <ProductsModule
              account={account}
              onOrderPlaced={handleOrderPlaced}
              onOpenMyOrders={() => setIsMyOrdersOpen(true)}
              orders={userOrders}
            />
          )}

          {/* ===================================================================== */}
          {/* REPORTS TAB — free manual report upload + a log of everything you've   */}
          {/* submitted (also visible to admin under the same user).                 */}
          {/* ===================================================================== */}
          {activeTab === 'reports' && (() => {
            let reportsToShow = myReports;
            if (profile.reportAnalysis && !reportsToShow.find((r) => r.id === profile.reportAnalysis!.id)) {
              reportsToShow = [profile.reportAnalysis, ...reportsToShow];
            }
            // Newest first
            reportsToShow = reportsToShow.slice().sort(
              (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
            );
            // A report slot is freed up by deleting one (already-built feature)
            // — enforced for real server-side too (/api/analyze-report), this
            // is just the proactive, no-wasted-click version of that same cap.
            const reportLimitReached = reportsToShow.length >= 2;

            return (
              <div className="space-y-6 text-left">
                <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-zinc-950">{tr('My Reports', 'मेरी रिपोर्ट्स')}</h3>
                      <p className="text-xs text-zinc-500 max-w-md mt-0.5">
                        {reportLimitReached
                          ? tr('Maximum 2 reports on file. Delete one below to upload a new one.', 'अधिकतम 2 रिपोर्ट्स दर्ज हैं। नई अपलोड करने के लिए नीचे से एक हटाएं।')
                          : tr("Free for everyone — upload a lab report photo or document. It's saved to your log below, and your doctor/admin can review it too.", 'सभी के लिए मुफ्त — लैब रिपोर्ट फोटो या दस्तावेज़ अपलोड करें। यह नीचे आपके लॉग में सहेजा जाता है, और आपका डॉक्टर/एडमिन भी इसकी समीक्षा कर सकता है।')}
                      </p>
                    </div>
                  </div>
                  {!reportLimitReached && (
                    <button
                      type="button"
                      onClick={() => setIsHealthReportOpen(true)}
                      className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{tr('Upload Report', 'रिपोर्ट अपलोड करें')}</span>
                    </button>
                  )}
                </div>

                {/* Report Log — every report this user has ever submitted (from Supabase) */}
                {reportsToShow.length === 0 ? (
                  <div className={`p-12 rounded-3xl ${cardClass} text-center space-y-3`}>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                      <Stethoscope className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-black text-zinc-900">{tr('No Reports Uploaded Yet', 'अभी तक कोई रिपोर्ट अपलोड नहीं की गई')}</p>
                      <p className="text-xs max-w-sm mx-auto text-zinc-500">
                        {tr('Upload a photo or document with fasting sugar, HbA1c, or lipid panel to receive personalized guidance.', 'व्यक्तिगत मार्गदर्शन पाने हेतु फास्टिंग शुगर, HbA1c, या लिपिड पैनल के साथ फोटो या दस्तावेज़ अपलोड करें।')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 px-1">
                      {tr('Submission Log', 'सबमिशन लॉग')} ({reportsToShow.length})
                    </h4>
                    {reportsToShow.map((report, idx) => (
                      <ReportPhotoViewer
                        key={report.id || idx}
                        report={report}
                        onReupload={() => setIsHealthReportOpen(true)}
                        onRequestDoctorReview={() => handleOpenDoctorConsult('Review my uploaded lab report and calibrate medications')}
                        onDelete={() => handleDeleteReport(report.id, report.reportName)}
                        onSaveReportText={report.id ? (text) => handleSaveReportText(report.id!, report.reportName, text) : undefined}
                        userName={profile.name || account.displayName || 'Member'}
                        theme="light"
                      />
                    ))}
                  </div>
                )}

                {/* REPORT TIMELINE — a separate, date/month/year-ordered
                    history of every report ever uploaded or deleted, only
                    here in Reports (not the general My Timeline, not the
                    Tracker module). Every entry is clickable and opens the
                    exact report it refers to — live if it still exists, or
                    the full snapshot captured the moment it was deleted. */}
                {/* MY TIMELINE — everything you did in the app, next to the report history. */}
                <MyTimelineCard userId={profile.id || account.uid} tr={tr} />

                <ReportTimeline
                  userId={account.uid}
                  reports={reportsToShow}
                  userName={profile.name || account.displayName || 'Member'}
                  onReupload={() => setIsHealthReportOpen(true)}
                  onRequestDoctorReview={() => handleOpenDoctorConsult('Review my uploaded lab report and calibrate medications')}
                  onDelete={handleDeleteReport}
                  onSaveReportText={handleSaveReportText}
                />

                {/* Admin-assigned files + personalized plan — only ever
                    rendered if the care team has actually put something
                    here for this user (see MyCareFilesPanel). */}
                <MyCareFilesPanel userId={account.uid} tr={tr} />
              </div>
            );
          })()}

          {/* ===================================================================== */}
          {/* ASSESSMENT TAB — free, standalone Root-Cause Reversal Form             */}
          {/* ===================================================================== */}
          {activeTab === 'assessment' && (
            <div className="space-y-6 text-left">
              <div className="rounded-3xl p-6 sm:p-8 relative overflow-hidden bg-brand-gradient text-white shadow-lg shadow-emerald-900/10">
                <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute right-10 bottom-0 w-24 h-24 rounded-full bg-white/10 blur-xl" />

                <div className="relative max-w-xl space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shrink-0">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-xs font-bold">
                      {tr('UrCare Clinical Root-Cause Reversal', 'UrCare क्लीनिकल रूट-कॉज़ रिवर्सल')}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                    {tr('Your Full Root-Cause Assessment', 'आपका पूरा रूट-कॉज़ असेसमेंट')}
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-50/90 leading-relaxed">
                    {tr('Blood sugar patterns, insulin resistance, polyherbal treatment, sleep, gut and organ health — one complete picture your doctor reviews. Free for everyone, fill at your own pace — your progress is saved automatically.', 'ब्लड शुगर पैटर्न, इंसुलिन प्रतिरोध, पॉलीहर्बल ट्रीटमेंट, नींद, गट व अंग स्वास्थ्य — एक पूरी तस्वीर जिसे आपका डॉक्टर देखता है। सभी के लिए मुफ्त, अपनी गति से भरें — प्रगति अपने आप सहेजी जाती है।')}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[
                      tr('Blood Sugar & Vitals', 'ब्लड शुगर व वाइटल्स'),
                      tr('Sleep & Stress', 'नींद व तनाव'),
                      tr('Gut Health', 'गट हेल्थ'),
                      tr('Organ Health', 'अंग स्वास्थ्य'),
                      tr('Lifestyle & Readiness', 'जीवनशैली व तैयारी'),
                    ].map((chip) => (
                      <span key={chip} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/10 border border-white/20">
                        {chip}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAssessmentModalOpen(true)}
                    className="mt-2 px-6 py-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{profile.assessmentData ? tr('Review / Update Assessment', 'असेसमेंट देखें / अपडेट करें') : tr('Start Assessment', 'असेसमेंट शुरू करें')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          </main>
        )}
      </div>
      </PullToRefresh>

      {/* MODALS */}
      {isHealthReportOpen && (
        <HealthReportModal
          isOpen={isHealthReportOpen}
          onClose={() => setIsHealthReportOpen(false)}
          reportAnalysis={profile.reportAnalysis}
          reports={myReports}
          onUpdateReport={(analysis, addedConditions) => {
            handleUpdateReport(analysis, addedConditions);
            refreshAccountData();
          }}
          onDeleteReport={handleDeleteReport}
          onRequestDoctorReview={handleOpenDoctorConsult}
          onSaveReportText={handleSaveReportText}
          userAccount={account}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          profile={profile}
          account={account}
          onClose={() => setIsSettingsOpen(false)}
          onUpdateProfile={onUpdateProfile}
          onOpenAccountTab={() => setActiveTab('account')}
          onOpenReports={() => setActiveTab('reports')}
          onOpenOrders={() => setIsMyOrdersOpen(true)}
          onOpenDoctorConsult={() => handleOpenDoctorConsult()}
          onLogOut={() => { setIsSettingsOpen(false); setShowLogoutConfirm(true); }}
          onAccountDeleted={() => { setIsSettingsOpen(false); handleLogout(); }}
        />
      )}

      {isFoodScannerOpen && (
        <FoodScannerModal
          isOpen={isFoodScannerOpen}
          onClose={() => setIsFoodScannerOpen(false)}
          onAddMeal={handleAddMeal}
          profile={profile}
        />
      )}

      {isMyOrdersOpen && (
        <MyOrdersModal
          isOpen={isMyOrdersOpen}
          onClose={() => setIsMyOrdersOpen(false)}
          orders={userOrders}
        />
      )}

      <AppFeedbackModal isOpen={isAppFeedbackOpen} onClose={() => setIsAppFeedbackOpen(false)} />

      {isDoctorConsultOpen && (
        <DoctorConsultModal
          isOpen={isDoctorConsultOpen}
          onClose={() => setIsDoctorConsultOpen(false)}
          profile={profile}
          reason={doctorConsultReason}
        />
      )}

      {isAssessmentModalOpen && (
        <RootCauseAssessmentModal
          isOpen={isAssessmentModalOpen}
          onClose={() => setIsAssessmentModalOpen(false)}
          profile={profile}
          onSaveAssessment={(assessmentData) => {
            const updated = {
              ...profile,
              assessmentData,
              updatedAt: new Date().toISOString(),
            };
            onUpdateProfile(updated);
            if (account?.uid) {
              logActivity(account.uid, 'updated', 'assessment', 'Completed Root Cause Assessment').catch(() => {});
            }
          }}
        />
      )}

      <FamilyCallModal
        open={!!incomingCall}
        onClose={() => setIncomingCall(null)}
        callId={incomingCall?.id || null}
        person={incomingCall?.person || null}
        mode="incoming"
      />

      {isRiskAssessmentOpen && (
        <RiskAssessmentModal
          isOpen={isRiskAssessmentOpen}
          onClose={() => setIsRiskAssessmentOpen(false)}
          profile={profile}
          onOpenDoctorConsult={handleOpenDoctorConsult}
        />
      )}

      {isFeedbackOpen && (
        <ClinicalFeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          userId={account.uid || 'usr_active'}
          userName={profile.name || account.displayName || 'Valued Member'}
          dayCycleNumber={4}
        />
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className={`w-full max-w-sm p-6 rounded-3xl ${cardClass} space-y-4 text-left`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-950">{tr('Sign Out', 'साइन आउट')}</h3>
                <p className="text-xs text-zinc-500">{tr('Are you sure you want to log out of your session?', 'क्या आप वाकई अपने सत्र से लॉग आउट करना चाहते हैं?')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
              >
                {tr('Cancel', 'रद्द करें')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white uppercase tracking-wider transition-colors shadow-sm"
              >
                {tr('Sign Out', 'साइन आउट')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

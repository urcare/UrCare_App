import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Settings, Clock,
  ChevronRight, Sparkles, Trash2, Calendar, ShieldCheck, Activity,
  ShoppingBag, Stethoscope, Crown, Camera, Lock, ClipboardCheck,
  Package, User, Check, PhoneCall, FileText, CheckCircle2, HeartPulse,
  LogOut, MessageSquare, AlertCircle, MoreVertical, X,
  Flame, Scale, Heart, Droplets, Target, UserCheck, Edit3
} from 'lucide-react';
import { 
  UserHealthProfile, MealItem, UserAccount, MedicalReportAnalysis, 
  Order, Prescription, BurnActivity, MedicationLogItem 
} from '../types';
import { HealthReportModal } from './HealthReportModal';
import { SettingsModal } from './SettingsModal';
import { ProductsModule } from './ProductsModule';
import { ProUpgradeModal } from './ProUpgradeModal';
import { FoodScannerModal } from './FoodScannerModal';
import { MyOrdersModal } from './MyOrdersModal';
import { DoctorConsultModal } from './DoctorConsultModal';
import { ClinicalFeedbackModal } from './ClinicalFeedbackModal';
import { RootCauseAssessmentModal } from './RootCauseAssessmentModal';
import { ProfilePage } from './ProfilePage';
import { AccountPage } from './AccountPage';
import { StreakWidget } from './StreakWidget';
import { RiskAssessmentModal } from './RiskAssessmentModal';
import { ReportPhotoViewer } from './ReportPhotoViewer';
import { Logo } from './Logo';
import { toDateKey } from './DailyCalendar';
import { signOutUser, addMealToLog, getMyOrders, getMyPrescriptions, getMyReports, deleteReport } from '../utils/supabase';
import { calculateNutritionPlan } from '../utils/calculator';
import { useLanguage } from '../context/LanguageContext';

interface DashboardProps {
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateProfile: (updated: UserHealthProfile) => void;
  onUpdateAccount?: (updated: UserAccount) => void;
  onResetOnboarding: () => void;
  onOpenAdminPortal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  account,
  onUpdateProfile,
  onUpdateAccount,
  onResetOnboarding,
  onOpenAdminPortal,
}) => {
  const { t } = useLanguage();

  // Navigation Tabs — 'profile' is Your Daily Plan (the default/main screen),
  // 'premium' is UrCare Camera (the food scanner, gated), 'account' is the
  // standalone Profile page (identity, stats, quick actions). 'reports',
  // 'assessment' + 'store' are always free.
  const [activeTab, setActiveTab] = useState<'profile' | 'premium' | 'account' | 'reports' | 'assessment' | 'store'>('profile');

  // '⋮' module switcher — a single drawer, opened from one fixed spot in the
  // persistent header/sidebar (never inline in a tab's scrolling content), so
  // it never jumps position when the tab changes or the page scrolls.
  const [isModuleMenuOpen, setIsModuleMenuOpen] = useState(false);
  const moduleMenuItems = [
    { id: 'profile' as const, label: t('navHome'), icon: Clock },
    { id: 'premium' as const, label: account.isPro ? t('navPro') : t('navPremium'), icon: Camera },
    { id: 'account' as const, label: t('navProfile'), icon: User },
    { id: 'reports' as const, label: 'My Reports', icon: FileText },
    { id: 'assessment' as const, label: 'Assessment', icon: ClipboardCheck },
    { id: 'store' as const, label: 'Store', icon: ShoppingBag },
    // Not a tab — opens the Settings modal directly (see the drawer's onClick).
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  // Without this, switching tabs while scrolled down on the previous tab
  // (e.g. scrolled through Home, then tapping Pro) opens the new tab at that
  // same leftover scroll position instead of its top — looking like the old
  // tab's content bled into the new one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  const [isFoodScannerOpen, setIsFoodScannerOpen] = useState(false);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isRiskAssessmentOpen, setIsRiskAssessmentOpen] = useState(false);

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

  // Modals state
  const [isHealthReportOpen, setIsHealthReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProUpgradeOpen, setIsProUpgradeOpen] = useState(false);
  const [proTriggerFeature, setProTriggerFeature] = useState('UrCare Premium');
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [isDoctorConsultOpen, setIsDoctorConsultOpen] = useState(false);
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
    }
  };

  // Store Order Placement
  const handleOrderPlaced = (newOrder: Order) => {
    setUserOrders((prev) => [newOrder, ...prev]);
  };

  const handleOpenProModalFor = (featureName?: any) => {
    const validFeature = typeof featureName === 'string' && featureName.trim().length > 0
      ? featureName.trim()
      : 'UrCare Premium';
    setProTriggerFeature(validFeature);
    setIsProUpgradeOpen(true);
  };

  const handleUpdateReport = (newAnalysis: MedicalReportAnalysis) => {
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
      calculatedPlan: recalculatedPlan,
      updatedAt: new Date().toISOString(),
    };
    onUpdateProfile(updated);
  };

  // Permanently remove one uploaded report from this user's submission log.
  const handleDeleteReport = (reportId?: string) => {
    if (!reportId) return;
    deleteReport(reportId).then(() => {
      setMyReports((prev) => prev.filter((r) => r.id !== reportId));
    }).catch(() => {});

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

  // Pure Light Mode Style Constants
  const cardClass = 'bg-white border border-zinc-200/90 shadow-sm';
  const subCardClass = 'bg-zinc-50 border border-zinc-200/80';
  const activeTabClass = 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20';
  const inactiveTabClass = 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100';

  // The three primary destinations stay in the persistent nav — Reports/
  // Assessment/Store/Settings moved into the '⋮' side menu instead, to avoid
  // cluttering the always-visible nav with less-frequent destinations.
  const navItems = [
    { id: 'profile', label: t('navHome'), icon: Clock },
    { id: 'premium', label: account.isPro ? t('navPro') : t('navPremium'), icon: Camera },
    { id: 'account', label: t('navProfile'), icon: User },
  ];

  return (
    <div id="urcare-dashboard-root" className="w-full min-h-screen bg-[#F8FAFC] text-zinc-900 pb-24 md:pb-12">
      
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
                  <span className="text-xs font-black truncate text-zinc-950">{profile.name || 'Member'}</span>
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

          {/* Main Navigation Tabs */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
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

          {/* Direct Doctor Hotline Banner in Sidebar */}
          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-950 space-y-2">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <span className="text-[11px] font-black uppercase tracking-wider text-teal-900">Doctor Hotline</span>
            </div>
            <p className="text-[10px] text-teal-700 leading-tight font-medium">Board-certified clinical supervision available.</p>
            <button
              type="button"
              onClick={() => handleOpenDoctorConsult()}
              className="w-full py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <PhoneCall className="w-3 h-3" />
              <span>Call Specialist</span>
            </button>
          </div>

        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-zinc-100 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsModuleMenuOpen(true)}
              className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title="More"
            >
              <MoreVertical className="w-4 h-4 text-zinc-700" />
            </button>

            <button
              type="button"
              onClick={() => setIsMyOrdersOpen(true)}
              className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title="Orders & Receipts"
            >
              <Package className="w-4 h-4 text-emerald-600" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title="My Profile"
            >
              <User className="w-4 h-4 text-zinc-700" />
            </button>

            {onOpenAdminPortal && (
              <button
                type="button"
                onClick={onOpenAdminPortal}
                className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
                title="Admin Portal"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MOBILE TOP HEADER — a real 3-track flex row (spacer / logo / buttons)
          instead of absolute-centering the logo over the row. Absolute
          positioning let the logo's box visually overlap the button cluster
          on narrow phones; a dedicated flex-1 track for the logo can only
          shrink/truncate into the space it's actually given, so it can never
          sit on top of the buttons. The left spacer mirrors the button
          cluster's width so the logo still lands at the true visual center. */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2">
        {/* '⋮' module switcher — lives here, in the one persistent sticky header
            shown on every tab, so it never jumps position when you switch tabs
            or scroll (unlike an inline button placed inside each tab's content). */}
        <div className="w-28 shrink-0 flex items-center">
          <button
            type="button"
            onClick={() => setIsModuleMenuOpen(true)}
            className="p-2 rounded-xl text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 bg-white transition-all cursor-pointer shrink-0"
            title="More"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex justify-center px-1">
          <Logo size="sm" showSubtitle={false} compact className="min-w-0 max-w-full" />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className="p-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0"
            title="Profile"
          >
            <User className="w-4 h-4 text-emerald-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setIsMyOrdersOpen(true)}
            className="p-2 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 shrink-0"
          >
            <Package className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      </header>

      {/* 3. MOBILE BOTTOM NAVIGATION DOCK */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-2 py-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const ItemIcon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-emerald-600 font-extrabold' : 'text-zinc-500 font-medium'
              }`}
            >
              <ItemIcon className="w-4 h-4" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
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
              <nav className="flex-1 p-3 space-y-1">
                {moduleMenuItems.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = item.id !== 'settings' && activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.id === 'settings') {
                          setIsSettingsOpen(true);
                        } else {
                          setActiveTab(item.id);
                        }
                        setIsModuleMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all cursor-pointer group ${
                        isActive ? 'bg-emerald-50 text-emerald-700' : 'text-zinc-800 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 group-hover:bg-emerald-100 text-zinc-600 group-hover:text-emerald-700'
                      }`}>
                        <ItemIcon className="w-4.5 h-4.5" />
                      </div>
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-40 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 4. MAIN CONTENT CONTAINER (Desktop pl-64) */}
      <div className="md:pl-64 w-full">

        {/* Streak & points — rendered once here, outside every tab's own
            content, so it stays visible no matter which module you switch
            to, instead of only showing on the Daily Plan tab. */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-1">
          <StreakWidget profile={profile} />
        </div>

        {activeTab === 'profile' ? (
          <ProfilePage
            profile={profile}
            account={account}
            prescriptions={prescriptions}
            onOpenDoctorConsult={handleOpenDoctorConsult}
            onOpenProfile={() => setActiveTab('account')}
          />
        ) : activeTab === 'account' ? (
          <AccountPage
            profile={profile}
            account={account}
            onUpdateProfile={onUpdateProfile}
            onUpdateAccount={onUpdateAccount}
            onOpenOrders={() => setIsMyOrdersOpen(true)}
            onOpenReports={() => setIsHealthReportOpen(true)}
            onOpenDoctorConsult={handleOpenDoctorConsult}
            onLogOut={() => setShowLogoutConfirm(true)}
          />
        ) : (
          <main className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">

          {/* ========================================================================= */}
          {/* TAB VIEWS CONTENT                                                         */}
          {/* ========================================================================= */}

          {/* ===================================================================== */}
          {/* PRO TAB — AI Food Scan only. The Daily Plan now lives directly on Home. */}
          {/* ===================================================================== */}
          {activeTab === 'premium' && (
            <div className="space-y-6 text-left">
              {!account.isPro ? (
                <div className={`p-6 sm:p-10 rounded-3xl ${cardClass} text-center space-y-5`}>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-green-400 p-0.5 shadow-lg mx-auto">
                    <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                      <Crown className="w-8 h-8 text-amber-500" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-zinc-950">Unlock UrCare Premium</h3>
                    <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
                      Premium gives you one powerful thing — nothing complicated.
                    </p>
                  </div>
                  <div className="max-w-sm mx-auto text-left">
                    <div className={`p-4 rounded-2xl ${subCardClass} space-y-1.5`}>
                      <Camera className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-sm font-black text-zinc-900">UrCare Food Scan</h4>
                      <p className="text-xs text-zinc-500">Scan any meal — instantly know if it's good for YOUR health, or not.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenProModalFor('UrCare Premium')}
                    className="px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 mx-auto cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Upgrade to Premium — ₹400/mo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pro Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-black uppercase tracking-wider">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Pro Member</span>
                  </div>

                  {/* AI Food Scan */}
                  <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-zinc-950">UrCare Food Scan</h3>
                        <p className="text-xs text-zinc-500 max-w-md mt-0.5">
                          Snap a photo or describe your meal — UrCare tells you if it's good for your health profile, or not, and why.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFoodScannerOpen(true)}
                      className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Scan Food Now</span>
                    </button>
                  </div>
                </div>
              )}
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
            />
          )}

          {/* ===================================================================== */}
          {/* REPORTS TAB — free manual report upload + a log of everything you've   */}
          {/* submitted (also visible to admin under the same user).                 */}
          {/* ===================================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6 text-left">
              <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-950">My Reports</h3>
                    <p className="text-xs text-zinc-500 max-w-md mt-0.5">
                      Free for everyone — upload a lab report photo or document. It's saved to your log below, and your doctor/admin can review it too.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHealthReportOpen(true)}
                  className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Report</span>
                </button>
              </div>

              {/* Report Log — every report this user has ever submitted (from Supabase) */}
              {(() => {
                let reportsToShow = myReports;
                if (profile.reportAnalysis && !reportsToShow.find((r) => r.id === profile.reportAnalysis!.id)) {
                  reportsToShow = [profile.reportAnalysis, ...reportsToShow];
                }
                // Newest first
                reportsToShow = reportsToShow.slice().sort(
                  (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
                );

                if (reportsToShow.length === 0) {
                  return (
                    <div className={`p-12 rounded-3xl ${cardClass} text-center space-y-3`}>
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                        <Stethoscope className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-black text-zinc-900">No Reports Uploaded Yet</p>
                        <p className="text-xs max-w-sm mx-auto text-zinc-500">
                          Upload a photo or document with fasting sugar, HbA1c, or lipid panel to receive personalized guidance.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 px-1">
                      Submission Log ({reportsToShow.length})
                    </h4>
                    {reportsToShow.map((report, idx) => (
                      <ReportPhotoViewer
                        key={report.id || idx}
                        report={report}
                        onReupload={() => setIsHealthReportOpen(true)}
                        onRequestDoctorReview={() => handleOpenDoctorConsult('Review my uploaded lab report and calibrate medications')}
                        onDelete={() => handleDeleteReport(report.id)}
                        userName={profile.name || account.displayName || 'Member'}
                        theme="light"
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===================================================================== */}
          {/* ASSESSMENT TAB — free, standalone 22-Module Root-Cause Reversal Form   */}
          {/* ===================================================================== */}
          {activeTab === 'assessment' && (
            <div className="space-y-6 text-left">
              <div className={`p-6 sm:p-8 rounded-3xl ${cardClass} space-y-5`}>
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        UrCare Clinical Reversal
                      </span>
                      <span className="text-xs text-zinc-500 font-medium">22 Root-Cause Modules</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-zinc-950 mt-0.5">
                      All-Condition Personalised Root-Cause Reversal Form
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-xl mt-0.5">
                      Calibrate blood sugar patterns, insulin resistance, polyherbal treatment, sleep, gut, and organ health reversal. Free for everyone — fill at your own pace, your progress is saved automatically.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssessmentModalOpen(true)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Open 22-Module Form</span>
                </button>
              </div>
            </div>
          )}

          </main>
        )}
      </div>

      {/* MODALS */}
      {isHealthReportOpen && (
        <HealthReportModal
          isOpen={isHealthReportOpen}
          onClose={() => setIsHealthReportOpen(false)}
          reportAnalysis={profile.reportAnalysis}
          onUpdateReport={(analysis) => {
            handleUpdateReport(analysis);
            refreshAccountData();
          }}
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
        />
      )}

      {isProUpgradeOpen && (
        <ProUpgradeModal
          isOpen={isProUpgradeOpen}
          account={account}
          featureTriggerName={proTriggerFeature}
          onClose={() => setIsProUpgradeOpen(false)}
          onUpgradeSuccess={(updatedAccount) => {
            setIsProUpgradeOpen(false);
            if (onUpdateAccount) onUpdateAccount(updatedAccount);
          }}
        />
      )}

      {isFoodScannerOpen && (
        <FoodScannerModal
          isOpen={isFoodScannerOpen}
          onClose={() => setIsFoodScannerOpen(false)}
          onAddMeal={handleAddMeal}
          isPro={!!account.isPro}
          profile={profile}
          onOpenProUpgrade={() => {
            setIsFoodScannerOpen(false);
            handleOpenProModalFor('UrCare Food Scan');
          }}
        />
      )}

      {isMyOrdersOpen && (
        <MyOrdersModal
          isOpen={isMyOrdersOpen}
          onClose={() => setIsMyOrdersOpen(false)}
          orders={userOrders}
        />
      )}

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
          }}
        />
      )}

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
                <h3 className="text-base font-black text-zinc-950">Sign Out</h3>
                <p className="text-xs text-zinc-500">Are you sure you want to log out of your session?</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white uppercase tracking-wider transition-colors shadow-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

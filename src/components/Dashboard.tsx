import React, { useState, useEffect } from 'react';
import { 
  Plus, Settings, 
  ChevronRight, Sparkles, Trash2, Calendar, ShieldCheck, Activity, 
  ShoppingBag, Lightbulb, Stethoscope, Crown, Camera, Lock,
  Package, User, Check, PhoneCall, FileText, CheckCircle2, HeartPulse,
  LogOut, MessageSquare, AlertCircle, LayoutGrid, Home,
  Flame, Scale, Heart, Droplets, Target, UserCheck, Edit3
} from 'lucide-react';
import { 
  UserHealthProfile, MealItem, UserAccount, MedicalReportAnalysis, 
  Order, Prescription, BurnActivity, MedicationLogItem 
} from '../types';
import { HealthReportModal } from './HealthReportModal';
import { SettingsModal } from './SettingsModal';
import { ProductsModule } from './ProductsModule';
import { RecommendationsView } from './RecommendationsView';
import { ProUpgradeModal } from './ProUpgradeModal';
import { FoodScannerModal } from './FoodScannerModal';
import { MyOrdersModal } from './MyOrdersModal';
import { DoctorConsultModal } from './DoctorConsultModal';
import { ClinicalFeedbackModal } from './ClinicalFeedbackModal';
import { RootCauseAssessmentModal } from './RootCauseAssessmentModal';
import { ProfilePage } from './ProfilePage';
import { RiskAssessmentModal } from './RiskAssessmentModal';
import { ReportPhotoViewer } from './ReportPhotoViewer';
import { Logo } from './Logo';
import { toDateKey } from './DailyCalendar';
import { signOutUser, addMealToLog, getMyOrders, getMyPrescriptions, getMyReports, deleteReport } from '../utils/supabase';
import { calculateNutritionPlan } from '../utils/calculator';

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
  // Navigation Tabs — simplified: 'profile' (Home) is the default/main screen.
  // 'premium' = AI Scan + Daily Plan (gated). 'reports', 'assessment' + 'store' are always free.
  const [activeTab, setActiveTab] = useState<'profile' | 'premium' | 'reports' | 'assessment' | 'store'>('profile');
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

  const navItems = [
    { id: 'profile', label: 'Home', icon: Home },
    { id: 'premium', label: account.isPro ? 'Pro' : 'Premium', icon: Crown },
    { id: 'reports', label: 'My Reports', icon: FileText },
    { id: 'assessment', label: 'Assessment', icon: Stethoscope },
    { id: 'store', label: 'Store', icon: ShoppingBag },
  ];

  return (
    <div id="urcare-dashboard-root" className="w-full min-h-screen bg-[#F8FAFC] text-zinc-900 pb-24 md:pb-12">
      
      {/* 1. STATIC SIDEBAR NAVIGATION (DESKTOP) */}
      <aside className="hidden md:flex flex-col justify-between w-64 fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-zinc-200 p-5 shadow-xs">
        <div className="space-y-6">
          
          {/* Logo & Brand */}
          <div className="pb-4 border-b border-zinc-100">
            <Logo size="sm" showSubtitle={true} />
          </div>

          {/* User Quick Info with My Profile Button */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'UC'}
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
              onClick={() => setActiveTab('profile')}
              className="p-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer shrink-0"
              title="Open My Profile"
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
              onClick={() => setIsMyOrdersOpen(true)}
              className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title="Orders & Receipts"
            >
              <Package className="w-4 h-4 text-emerald-600" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title="My Profile"
            >
              <User className="w-4 h-4 text-zinc-700" />
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:text-black hover:bg-zinc-200 border border-zinc-200 transition-all cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-zinc-700" />
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

      {/* 2. MOBILE TOP HEADER */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <Logo size="sm" showSubtitle={false} />
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="p-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"
          >
            <User className="w-4 h-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase">Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMyOrdersOpen(true)}
            className="p-2 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200"
          >
            <Package className="w-4 h-4 text-emerald-600" />
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200"
          >
            <Settings className="w-4 h-4" />
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

      {/* 4. MAIN CONTENT CONTAINER (Desktop pl-64) */}
      <div className="md:pl-64 w-full">
        {activeTab === 'profile' ? (
          <ProfilePage
            profile={profile}
            account={account}
            onBackToDashboard={() => setActiveTab('profile')}
            onUpdateProfile={onUpdateProfile}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenOrders={() => setIsMyOrdersOpen(true)}
            onOpenReports={() => setIsHealthReportOpen(true)}
            onOpenDoctorConsult={handleOpenDoctorConsult}
            onOpenRiskAssessment={() => setIsRiskAssessmentOpen(true)}
            onLogOut={() => setShowLogoutConfirm(true)}
          />
        ) : (
          <main className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
          
          {/* ========================================================================= */}
          {/* TAB VIEWS CONTENT                                                         */}
          {/* ========================================================================= */}

          {/* ===================================================================== */}
          {/* PREMIUM TAB — exactly 2 features: AI Food Scan + Daily Personalized Plan */}
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
                      Premium gives you exactly 2 powerful things — nothing complicated.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
                    <div className={`p-4 rounded-2xl ${subCardClass} space-y-1.5`}>
                      <Camera className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-sm font-black text-zinc-900">AI Food Scan</h4>
                      <p className="text-xs text-zinc-500">Scan any meal — instantly know if it's good for YOUR health, or not.</p>
                    </div>
                    <div className={`p-4 rounded-2xl ${subCardClass} space-y-1.5`}>
                      <Lightbulb className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-sm font-black text-zinc-900">Daily Goals</h4>
                      <p className="text-xs text-zinc-500">Every day: what to eat, what to avoid, sleep timing & exercises for you.</p>
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

                  {/* Feature 1: AI Food Scan */}
                  <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-zinc-950">AI Food Scan</h3>
                        <p className="text-xs text-zinc-500 max-w-md mt-0.5">
                          Snap a photo or describe your meal — the AI tells you if it's good for your health profile, or not, and why.
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

                  {/* Feature 2: Daily Personalized Plan */}
                  <RecommendationsView
                    profile={profile}
                    prescriptions={prescriptions}
                    onOpenStore={() => setActiveTab('store')}
                    onOpenConsultDoctor={handleOpenDoctorConsult}
                    onOpenProModal={handleOpenProModalFor}
                  />
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
          onResetOnboarding={onResetOnboarding}
          onOpenAdminPortal={onOpenAdminPortal}
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
            handleOpenProModalFor('AI Food Scan');
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

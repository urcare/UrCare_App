import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, Phone, Calendar, ShieldCheck, Scale,
  Target, Flame, Droplets, Edit3, Heart,
  Stethoscope, Award, ChevronRight, LogOut, RefreshCw,
  Package, FileText, CheckCircle2, Camera, BadgeCheck, Sparkles,
  MoreVertical, X, ShoppingBag, ClipboardCheck, Lightbulb, Crown
} from 'lucide-react';
import { UserHealthProfile, UserAccount } from '../types';
import { useLanguage, LanguageSwitchButton } from '../context/LanguageContext';
import { updateAvatar } from '../utils/supabase';
import { Logo } from './Logo';
import { EditHealthProfileModal } from './EditHealthProfileModal';

interface ProfilePageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateProfile: (updated: UserHealthProfile) => void;
  onUpdateAccount?: (updated: UserAccount) => void;
  onOpenSettings: () => void;
  onOpenOrders: () => void;
  onOpenReports: () => void;
  onOpenDoctorConsult: () => void;
  onOpenRiskAssessment: () => void;
  onLogOut: () => void;
  onGoToReportsTab: () => void;
  onGoToAssessmentTab: () => void;
  onGoToStoreTab: () => void;
  onGoToDailyPlanTab: () => void;
  onGoToPremiumTab: () => void;
}

/** Downscales/compresses an image file to a small square JPEG data URL before
 *  it's saved — a full-resolution photo has no business living inline in a
 *  database row that gets fetched on every page load. */
function resizeImageToDataUrl(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Could not read this image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read this file'));
    reader.readAsDataURL(file);
  });
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  account,
  onUpdateProfile,
  onUpdateAccount,
  onOpenSettings,
  onOpenOrders,
  onOpenReports,
  onOpenDoctorConsult,
  onLogOut,
  onGoToReportsTab,
  onGoToAssessmentTab,
  onGoToStoreTab,
  onGoToDailyPlanTab,
  onGoToPremiumTab,
}) => {
  const { language, t } = useLanguage();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const menuItems = [
    { label: account.isPro ? t('navPro') : t('navPremium'), icon: Crown, onClick: onGoToPremiumTab },
    { label: 'Daily Plan', icon: Lightbulb, onClick: onGoToDailyPlanTab },
    { label: 'My Reports', icon: FileText, onClick: onGoToReportsTab },
    { label: 'Assessment', icon: ClipboardCheck, onClick: onGoToAssessmentTab },
    { label: 'Store', icon: ShoppingBag, onClick: onGoToStoreTab },
  ];

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const { error } = await updateAvatar(account.uid, dataUrl);
      if (error) throw new Error(error);
      onUpdateAccount?.({ ...account, avatarUrl: dataUrl });
    } catch (err: any) {
      setAvatarError(err.message || 'Could not save your photo. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const { calculatedPlan, heightCm = 170, age = 28, gender = 'male' } = profile;
  const bmi = calculatedPlan?.bmi || Number((profile.currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
  const assessment = profile.assessmentData;

  return (
    <div id="urcare-profile-page" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16">
      
      {/* Top Header — no logo here on purpose: Dashboard's own sidebar/mobile
          header already shows the UrCare brand on every tab, so repeating it
          here just looked like it was printed twice on the same screen. This
          bar instead titles the page, centered the same overflow-safe way. */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-3 sm:px-8 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto relative flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="shrink-0 p-2.5 rounded-xl text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-all cursor-pointer"
            title="More"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Hidden below sm — on narrow phones there isn't room for this next to
              the language toggle without the two overlapping/sticking together. */}
          <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-emerald-700 tracking-wide whitespace-nowrap">My Profile</span>
          </div>

          <div className="flex items-center justify-end shrink-0">
            <LanguageSwitchButton />
          </div>
        </div>
      </header>

      {/* Side drawer — My Reports / Assessment / Store, sliding in with animation */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
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
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                {menuItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { item.onClick(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold text-zinc-800 hover:bg-emerald-50 hover:text-emerald-700 transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-zinc-100 group-hover:bg-emerald-100 text-zinc-600 group-hover:text-emerald-700 flex items-center justify-center shrink-0 transition-colors">
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

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-5 text-left">
        
        {/* 1. SIMPLE USER INFO CARD */}
        <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

            <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
              <div className="relative shrink-0">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelected}
                />
                <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl font-black shadow-md overflow-hidden">
                  {account.avatarUrl ? (
                    <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profile.name || account.displayName || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  title="Change photo"
                  className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border-2 border-white shadow-md flex items-center justify-center text-emerald-600 hover:text-emerald-700 cursor-pointer disabled:opacity-60"
                >
                  {isUploadingAvatar ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-zinc-950 break-words">
                    {profile.name || account.displayName || 'UrCare Member'}
                  </h1>
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/15 shrink-0" strokeWidth={2.5} />
                    <span>Verified Member</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-medium mt-1">
                  {profile.email && <span className="flex items-center gap-1 min-w-0 break-all"><Mail className="w-3.5 h-3.5 shrink-0" />{profile.email}</span>}
                  {profile.phone && <span className="flex items-center gap-1 shrink-0"><Phone className="w-3.5 h-3.5" />{profile.phone}</span>}
                  <span className="shrink-0">{gender.toUpperCase()} • {age} YRS</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditProfileOpen(true)}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 w-full sm:w-auto justify-center"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Edit Health Profile</span>
            </button>
          </div>

          {avatarError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{avatarError}</p>
          )}
        </div>

        {/* 2. BODY & HEALTH OVERVIEW STATS (SIMPLE & EASY TO UNDERSTAND) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Current Weight</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {profile.currentWeightKg} <span className="text-xs font-semibold text-zinc-400">kg</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {(profile.currentWeightKg * 2.20462).toFixed(1)} lbs
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Target Goal</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">
              {profile.targetWeightKg} <span className="text-xs font-semibold text-emerald-700">kg</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-bold block">
              {profile.goal?.replace('_', ' ') || 'Reversal Plan'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Height</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {heightCm} <span className="text-xs font-semibold text-zinc-400">cm</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {Math.floor((heightCm / 2.54) / 12)} ft {Math.round((heightCm / 2.54) % 12)} in
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">BMI Status</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {bmi}
            </div>
            <span className="text-[10px] font-bold text-emerald-700 block">
              {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal (Healthy)' : bmi < 30 ? 'Overweight' : 'Need Reversal'}
            </span>
          </div>

        </div>

        {/* 3. DAILY NUTRITION TARGETS */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
                Daily Nutrition & Water Targets
              </h3>
            </div>
            <span className="text-xs font-extrabold text-emerald-700">
              {calculatedPlan?.targetCalories || 1850} kcal / day
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Protein Target</span>
              <div className="text-lg font-black text-emerald-600">{calculatedPlan?.proteinGrams || 130}g</div>
              <span className="text-[10px] text-zinc-500 font-medium">For muscle & sugar control</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Carb Target</span>
              <div className="text-lg font-black text-zinc-900">{calculatedPlan?.carbsGrams || 180}g</div>
              <span className="text-[10px] text-zinc-500 font-medium">Whole grains & fiber</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Healthy Fats</span>
              <div className="text-lg font-black text-zinc-900">{calculatedPlan?.fatsGrams || 50}g</div>
              <span className="text-[10px] text-zinc-500 font-medium">Nuts & seeds</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Water Intake</span>
              <div className="text-lg font-black text-teal-600">{calculatedPlan?.waterLiters || 3.2}L</div>
              <span className="text-[10px] text-zinc-500 font-medium">Daily hydration</span>
            </div>
          </div>
        </div>

        {/* 5. QUICK SHORTCUTS & SUPPORT */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onOpenReports}
            className="p-4 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs flex items-center gap-3 transition-all cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-zinc-900">Lab & Diab Reports</div>
              <span className="text-[10px] text-zinc-500">Upload PDF or type text</span>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenDoctorConsult}
            className="p-4 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs flex items-center gap-3 transition-all cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-zinc-900">Doctor Hotline</div>
              <span className="text-[10px] text-zinc-500">Consult clinical MD</span>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenOrders}
            className="p-4 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs flex items-center gap-3 transition-all cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-zinc-900">My Orders</div>
              <span className="text-[10px] text-zinc-500">Supplements & delivery</span>
            </div>
          </button>
        </div>

        {/* 6. SIGN OUT */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={onLogOut}
            className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of UrCare</span>
          </button>
        </div>

      </main>

      <EditHealthProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        profile={profile}
        onUpdateProfile={onUpdateProfile}
      />
    </div>
  );
};

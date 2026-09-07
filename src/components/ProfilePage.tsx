import React, { useRef, useState } from 'react';
import {
  Mail, Phone,
  Flame, Edit3,
  Stethoscope, LogOut, RefreshCw,
  Package, FileText, Camera, BadgeCheck, Sparkles,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, Prescription } from '../types';
import { useLanguage, LanguageSwitchButton } from '../context/LanguageContext';
import { updateAvatar } from '../utils/supabase';
import { RecommendationsView } from './RecommendationsView';
import { ReversalLibraryPanel, PlanSection } from './ReversalLibraryPanel';
import { EditHealthProfileModal } from './EditHealthProfileModal';

interface ProfilePageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  prescriptions?: Prescription[];
  onUpdateProfile: (updated: UserHealthProfile) => void;
  onUpdateAccount?: (updated: UserAccount) => void;
  onOpenSettings: () => void;
  onOpenOrders: () => void;
  onOpenReports: () => void;
  onOpenDoctorConsult: () => void;
  onOpenRiskAssessment: () => void;
  onLogOut: () => void;
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
  prescriptions = [],
  onUpdateProfile,
  onUpdateAccount,
  onOpenSettings,
  onOpenOrders,
  onOpenReports,
  onOpenDoctorConsult,
  onLogOut,
}) => {
  const { language, t } = useLanguage();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  // The condition-specific reference library is fetched inside
  // RecommendationsView (it already knows the day's plan) and lifted up here
  // so it can render statically in the sidebar instead of inline in the
  // scrolling daily-plan column.
  const [referenceSections, setReferenceSections] = useState<PlanSection[]>([]);

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
          header already shows the UrCare brand (and the '⋮' module switcher)
          on every tab, so repeating either here just looked like it was
          printed twice on the same screen. This bar only titles the page. */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-3 sm:px-8 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-emerald-700 tracking-wide whitespace-nowrap">My Profile</span>
          </div>

          <div className="flex items-center justify-end shrink-0">
            <LanguageSwitchButton />
          </div>
        </div>
      </header>

      {/* Main Container — a two-column dashboard on wide screens: the daily
          plan is the one thing in the main column (the actual "main focus"
          for today), while identity/stats and the reversal reference
          library sit statically in a sticky sidebar on the right, always in
          view rather than requiring a menu. On narrow screens it stacks:
          plan first, sidebar content below. */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-4 text-left">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">

          {/* MAIN — today's daily plan, shown directly on Home, not as a
              separate module a user has to navigate to. */}
          <div className="min-w-0">
            <RecommendationsView
              profile={profile}
              prescriptions={prescriptions}
              onOpenConsultDoctor={onOpenDoctorConsult}
              onReferenceSections={setReferenceSections}
            />
          </div>

          {/* SIDE — static on wide screens (sticky under the header), so your
              profile snapshot and reversal library stay visible on the side
              instead of needing the '⋮' menu. */}
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-20">

            {/* SIMPLE USER INFO CARD */}
            <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-4">
              <div className="flex flex-col items-start gap-4">

                <div className="flex items-center gap-4 min-w-0 w-full">
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
                      <h1 className="text-base font-black text-zinc-950 break-words">
                        {profile.name || account.displayName || 'UrCare Member'}
                      </h1>
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-500/15 shrink-0" strokeWidth={2.5} />
                        <span>Verified</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 font-medium mt-1">
                      {profile.email && <span className="flex items-center gap-1 min-w-0 break-all"><Mail className="w-3 h-3 shrink-0" />{profile.email}</span>}
                      {profile.phone && <span className="flex items-center gap-1 shrink-0"><Phone className="w-3 h-3" />{profile.phone}</span>}
                      <span className="shrink-0">{gender.toUpperCase()} • {age} YRS</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer w-full justify-center"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Edit Health Profile</span>
                </button>
              </div>

              {avatarError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{avatarError}</p>
              )}
            </div>

            {/* BODY & HEALTH OVERVIEW STATS (SIMPLE & EASY TO UNDERSTAND) */}
            <div className="grid grid-cols-2 gap-3">

              <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Current Weight</span>
                <div className="text-xl font-black text-zinc-950">
                  {profile.currentWeightKg} <span className="text-xs font-semibold text-zinc-400">kg</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-medium block">
                  {(profile.currentWeightKg * 2.20462).toFixed(1)} lbs
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Target Goal</span>
                <div className="text-xl font-black text-emerald-600">
                  {profile.targetWeightKg} <span className="text-xs font-semibold text-emerald-700">kg</span>
                </div>
                <span className="text-[10px] text-emerald-800 font-bold block">
                  {profile.goal?.replace('_', ' ') || 'Reversal Plan'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Height</span>
                <div className="text-xl font-black text-zinc-950">
                  {heightCm} <span className="text-xs font-semibold text-zinc-400">cm</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-medium block">
                  {Math.floor((heightCm / 2.54) / 12)} ft {Math.round((heightCm / 2.54) % 12)} in
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">BMI Status</span>
                <div className="text-xl font-black text-zinc-950">
                  {bmi}
                </div>
                <span className="text-[10px] font-bold text-emerald-700 block">
                  {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal (Healthy)' : bmi < 30 ? 'Overweight' : 'Need Reversal'}
                </span>
              </div>

            </div>

            {/* DAILY NUTRITION TARGETS */}
            <div className="p-5 rounded-3xl bg-white border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 flex-wrap gap-1.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-black text-zinc-950 uppercase tracking-tight">
                    Nutrition & Water
                  </h3>
                </div>
                <span className="text-xs font-extrabold text-emerald-700">
                  {calculatedPlan?.targetCalories || 1850} kcal/day
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-left">
                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Protein</span>
                  <div className="text-base font-black text-emerald-600">{calculatedPlan?.proteinGrams || 130}g</div>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Carbs</span>
                  <div className="text-base font-black text-zinc-900">{calculatedPlan?.carbsGrams || 180}g</div>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Fats</span>
                  <div className="text-base font-black text-zinc-900">{calculatedPlan?.fatsGrams || 50}g</div>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Water</span>
                  <div className="text-base font-black text-teal-600">{calculatedPlan?.waterLiters || 3.2}L</div>
                </div>
              </div>
            </div>

            {/* CONDITION-SPECIFIC REVERSAL LIBRARY — blood sugar, diabetes
                reversal, kidney and everything else not tied to a specific
                time, always visible here rather than tucked in a menu. */}
            <ReversalLibraryPanel sections={referenceSections} />

            {/* QUICK SHORTCUTS & SUPPORT */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onOpenReports}
                className="w-full p-3.5 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs flex items-center gap-3 transition-all cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-zinc-900">Lab & Diab Reports</div>
                  <span className="text-[10px] text-zinc-500">Upload PDF or type text</span>
                </div>
              </button>

              <button
                type="button"
                onClick={onOpenDoctorConsult}
                className="w-full p-3.5 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs flex items-center gap-3 transition-all cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                  <Stethoscope className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-zinc-900">Doctor Hotline</div>
                  <span className="text-[10px] text-zinc-500">Consult clinical MD</span>
                </div>
              </button>

              <button
                type="button"
                onClick={onOpenOrders}
                className="w-full p-3.5 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200 shadow-xs flex items-center gap-3 transition-all cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <Package className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-zinc-900">My Orders</div>
                  <span className="text-[10px] text-zinc-500">Supplements & delivery</span>
                </div>
              </button>
            </div>

            {/* SIGN OUT */}
            <div className="pt-1 flex justify-center">
              <button
                type="button"
                onClick={onLogOut}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of UrCare</span>
              </button>
            </div>

          </aside>
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

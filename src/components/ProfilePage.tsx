import React, { useRef, useState } from 'react';
import {
  User, Mail, Phone, Calendar, ShieldCheck, Scale,
  Target, Flame, Droplets, ArrowLeft, Edit3, Heart,
  Stethoscope, Award, ChevronRight, LogOut, RefreshCw,
  Package, FileText, CheckCircle2, Camera
} from 'lucide-react';
import { UserHealthProfile, UserAccount } from '../types';
import { useLanguage, LanguageSwitchButton } from '../context/LanguageContext';
import { updateAvatar } from '../utils/supabase';

interface ProfilePageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  onBackToDashboard: () => void;
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
  onBackToDashboard,
  onUpdateProfile,
  onUpdateAccount,
  onOpenSettings,
  onOpenOrders,
  onOpenReports,
  onOpenDoctorConsult,
  onLogOut,
}) => {
  const { language, t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  // Editable quick values
  const [weight, setWeight] = useState(profile.currentWeightKg || 70);
  const [targetWeight, setTargetWeight] = useState(profile.targetWeightKg || 65);
  const [dietary, setDietary] = useState(profile.dietaryPreference || 'Vegetarian');

  const { calculatedPlan, heightCm = 170, age = 28, gender = 'male' } = profile;
  const bmi = calculatedPlan?.bmi || Number((weight / Math.pow(heightCm / 100, 2)).toFixed(1));
  const assessment = profile.assessmentData;

  const handleSave = () => {
    const updated: UserHealthProfile = {
      ...profile,
      currentWeightKg: Number(weight),
      targetWeightKg: Number(targetWeight),
      dietaryPreference: dietary,
      updatedAt: new Date().toISOString(),
    };
    onUpdateProfile(updated);
    setIsEditing(false);
  };

  return (
    <div id="urcare-profile-page" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-700 hover:text-zinc-950 px-3 py-2 rounded-xl hover:bg-zinc-100 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'hi' ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-emerald-600 tracking-wider">UrCare PROFILE</span>
            <LanguageSwitchButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-5 text-left">
        
        {/* 1. SIMPLE USER INFO CARD */}
        <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
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

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-zinc-950">
                    {profile.name || account.displayName || 'UrCare Member'}
                  </h1>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Verified Member
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-medium mt-1">
                  {profile.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{profile.email}</span>}
                  {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{profile.phone}</span>}
                  <span>•</span>
                  <span>{gender.toUpperCase()} • {age} YRS</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isEditing ? 'Cancel' : 'Edit Stats'}</span>
            </button>
          </div>

          {avatarError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{avatarError}</p>
          )}

          {/* Quick Edit Drawer */}
          {isEditing && (
            <div className="pt-4 border-t border-zinc-100 space-y-3 bg-zinc-50 p-4 rounded-2xl">
              <h3 className="text-xs font-black uppercase text-zinc-700">Update Weight & Food Preference</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1">Current Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white text-xs font-bold text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1">Target Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white text-xs font-bold text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1">Dietary Preference</label>
                  <select
                    value={dietary}
                    onChange={(e) => setDietary(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white text-xs font-bold text-zinc-900"
                  >
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Non-Vegetarian">Non-Vegetarian</option>
                    <option value="Eggetarian">Eggetarian</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Jain">Jain</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-600 hover:bg-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
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
    </div>
  );
};

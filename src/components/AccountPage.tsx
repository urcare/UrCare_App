import React, { useMemo, useRef, useState } from 'react';
import {
  Mail, Phone, Flame, Edit3, Stethoscope, LogOut, RefreshCw,
  Package, FileText, Camera, BadgeCheck, Sparkles, ChevronRight,
} from 'lucide-react';
import { UserHealthProfile, UserAccount } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { updateAvatar } from '../utils/supabase';
import { EditHealthProfileModal } from './EditHealthProfileModal';
import { StreakWidget } from './StreakWidget';
import { REVERSAL_GOALS, DEFAULT_REVERSAL_GOAL } from './RecommendationsView';

function formatGoalLabel(goal?: string): string {
  if (!goal) return 'Reversal Plan';
  return goal.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const GOAL_LABEL_HI: Record<string, string> = {
  lose_weight: 'वज़न घटाना',
  build_muscle: 'मांसपेशी बनाना',
  maintain_tone: 'टोन बनाए रखना',
  improve_health: 'स्वास्थ्य सुधारना',
  reverse_condition: 'स्थिति को उलटना',
  '': 'रिवर्सल योजना',
};

// Hindi display text for the REVERSAL_GOALS tiles (imported from
// RecommendationsView) — keyed by the English label since that's what
// REVERSAL_GOALS itself uses as the display value, not a stored/matched id.
const REVERSAL_GOAL_LABEL_HI: Record<string, { label: string; note: string }> = {
  'Diabetes Reversal': { label: 'डायबिटीज रिवर्सल', note: 'कम-GI भोजन, स्थिर ब्लड शुगर' },
  'Weight Reversal': { label: 'वज़न रिवर्सल', note: 'कैलोरी डेफिसिट, उच्च प्रोटीन' },
  'Blood Pressure Control': { label: 'ब्लड प्रेशर नियंत्रण', note: 'कम सोडियम, पोटैशियम युक्त भोजन' },
  'Liver & Lipid Reversal': { label: 'लिवर व लिपिड रिवर्सल', note: 'कम सैचुरेटेड फैट, अधिक फाइबर' },
  'Thyroid Balance': { label: 'थायरॉइड संतुलन', note: 'आयोडीन के प्रति सजग, सूजन-रोधी' },
  'Hormonal Reversal': { label: 'हार्मोनल रिवर्सल', note: 'कम-GI, सूजन-रोधी आहार' },
  'Nerve Health': { label: 'नस स्वास्थ्य', note: 'विटामिन-B युक्त, ब्लड शुगर नियंत्रण' },
  'Eye Health Support': { label: 'आंखों के स्वास्थ्य हेतु सहयोग', note: 'एंटीऑक्सीडेंट युक्त, शुगर नियंत्रण' },
  'Heart Reversal': { label: 'हृदय रिवर्सल', note: 'कम सोडियम, ओमेगा-3 युक्त' },
  'Kidney Reversal': { label: 'किडनी रिवर्सल', note: 'नियंत्रित प्रोटीन व सोडियम' },
  'Joint & Mobility Support': { label: 'जोड़ व गतिशीलता सहयोग', note: 'सूजन-रोधी भोजन' },
  'Energy Restoration': { label: 'ऊर्जा पुनर्स्थापन', note: 'आयरन व B12 युक्त, स्थिर भोजन' },
  'Sleep Quality Support': { label: 'नींद गुणवत्ता सहयोग', note: 'हल्का रात्रि भोजन, देर रात कैफीन नहीं' },
  'Vascular Health': { label: 'रक्त वाहिका स्वास्थ्य', note: 'हृदय-अनुकूल, रक्त संचार सहयोग' },
  'Uric Acid Reversal': { label: 'यूरिक एसिड रिवर्सल', note: 'कम प्यूरीन, अधिक पानी' },
  'Gut Health Reversal': { label: 'आंत स्वास्थ्य रिवर्सल', note: 'फाइबर-संतुलित, आंत-अनुकूल' },
  'Metabolic Health': { label: 'मेटाबॉलिक स्वास्थ्य', note: 'संतुलित पोषण, स्थिर ऊर्जा' },
};

interface AccountPageProps {
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateProfile: (updated: UserHealthProfile) => void;
  onUpdateAccount?: (updated: UserAccount) => void;
  onOpenOrders: () => void;
  onOpenReports: () => void;
  onOpenDoctorConsult: () => void;
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

/** "Profile" — identity, body/health stats, nutrition targets and quick
 *  actions, as its own destination (separate from "Your Daily Plan"). */
export const AccountPage: React.FC<AccountPageProps> = ({
  profile,
  account,
  onUpdateProfile,
  onUpdateAccount,
  onOpenOrders,
  onOpenReports,
  onOpenDoctorConsult,
  onLogOut,
}) => {
  const { t, language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError(tr('Please choose an image file.', 'कृपया एक इमेज फ़ाइल चुनें।'));
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
      setAvatarError(err.message || tr('Could not save your photo. Please try again.', 'आपकी फोटो सहेजी नहीं जा सकी। कृपया पुनः प्रयास करें।'));
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const { calculatedPlan, heightCm = 170, age = 28, gender = 'male' } = profile;
  const bmi = calculatedPlan?.bmi || Number((profile.currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1));

  // Same condition-by-condition "reversal focus" tiles the Daily Plan used
  // to lead with — purely derived from the profile, so it belongs here.
  const reversalGoals = useMemo(() => {
    const conditions = (profile.medicalConditions || []).filter((c) => c !== 'None' && c !== 'Other');
    const goals = conditions.map((c) => REVERSAL_GOALS[c]).filter(Boolean);
    return goals.length > 0 ? goals : [DEFAULT_REVERSAL_GOAL];
  }, [profile.medicalConditions]);

  return (
    <div id="urcare-account-page" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16">

      <header className="sticky top-0 z-30 bg-white border-b border-zinc-200 px-3 sm:px-8 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-black text-emerald-700 tracking-wide whitespace-nowrap">{t('navProfile')}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-5 text-left">

        {/* IDENTITY — centered avatar with an edit badge, name, email below;
            a plain, calm identity header instead of a side-by-side card. */}
        <div className="flex flex-col items-center text-center pt-2 pb-1">
          <div className="relative shrink-0">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarSelected}
            />
            <div className="w-24 h-24 rounded-full bg-emerald-600 text-white flex items-center justify-center text-3xl font-black shadow-md overflow-hidden ring-4 ring-white">
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
              title={tr('Change photo', 'फोटो बदलें')}
              className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-md flex items-center justify-center text-white hover:bg-emerald-500 cursor-pointer disabled:opacity-60"
            >
              {isUploadingAvatar ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center mt-3">
            <h1 className="text-xl font-black text-zinc-950 break-words">
              {profile.name || account.displayName || tr('UrCare Member', 'UrCare सदस्य')}
            </h1>
            <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/15 shrink-0" strokeWidth={2.5} />
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-0.5 break-all">
            {profile.email || account.email}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center text-[11px] text-zinc-400 font-semibold mt-1.5">
            {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{profile.phone}</span>}
            <span>{gender.toUpperCase()} • {age} {tr('YRS', 'वर्ष')}</span>
          </div>

          {avatarError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mt-3">{avatarError}</p>
          )}
        </div>

        {/* Streak — moved here from the Daily Plan's top header, since it's
            a personal stat about the user rather than part of today's plan. */}
        <div className="flex justify-start">
          <StreakWidget profile={profile} />
        </div>

        {/* YOUR REVERSAL FOCUS — condition-derived focus tiles, the same
            data the Daily Plan used to lead with; purely static (no daily
            task tracking), so it belongs here rather than on that page. */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-3">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-600">
            {tr('Your Reversal Focus', 'आपका रिवर्सल फोकस')}
          </h3>
          <div className={`grid gap-2.5 sm:gap-3 ${reversalGoals.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {reversalGoals.map((goal) => {
              const GoalIcon = goal.icon;
              return (
                <div key={goal.label} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${goal.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                    <GoalIcon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-black text-zinc-900 truncate">{tr(goal.label, REVERSAL_GOAL_LABEL_HI[goal.label]?.label || goal.label)}</div>
                    <div className="text-[10px] sm:text-[11px] text-zinc-500 font-semibold truncate">{tr(goal.note, REVERSAL_GOAL_LABEL_HI[goal.label]?.note || goal.note)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BODY & HEALTH OVERVIEW STATS (SIMPLE & EASY TO UNDERSTAND) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('Current Weight', 'वर्तमान वज़न')}</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {profile.currentWeightKg} <span className="text-xs font-semibold text-zinc-400">kg</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {(profile.currentWeightKg * 2.20462).toFixed(1)} lbs
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{tr('Target Goal', 'लक्ष्य वज़न')}</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">
              {profile.targetWeightKg} <span className="text-xs font-semibold text-emerald-700">kg</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-bold block">
              {tr(formatGoalLabel(profile.goal), GOAL_LABEL_HI[profile.goal || ''] || formatGoalLabel(profile.goal))}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('Height', 'कद')}</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {heightCm} <span className="text-xs font-semibold text-zinc-400">cm</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block">
              {Math.floor((heightCm / 2.54) / 12)} ft {Math.round((heightCm / 2.54) % 12)} in
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('BMI Status', 'बीएमआई स्थिति')}</span>
            <div className="text-xl sm:text-2xl font-black text-zinc-950">
              {bmi}
            </div>
            <span className="text-[10px] font-bold text-emerald-700 block">
              {bmi < 18.5 ? tr('Underweight', 'कम वज़न') : bmi < 25 ? tr('Normal (Healthy)', 'सामान्य (स्वस्थ)') : bmi < 30 ? tr('Overweight', 'अधिक वज़न') : tr('Need Reversal', 'रिवर्सल आवश्यक')}
            </span>
          </div>

        </div>

        {/* DAILY NUTRITION TARGETS */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
                {tr('Daily Nutrition & Water Targets', 'दैनिक पोषण व पानी के लक्ष्य')}
              </h3>
            </div>
            <span className="text-xs font-extrabold text-emerald-700">
              {calculatedPlan?.targetCalories || 1850} kcal / {tr('day', 'दिन')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">{tr('Protein Target', 'प्रोटीन लक्ष्य')}</span>
              <div className="text-lg font-black text-emerald-600">{calculatedPlan?.proteinGrams || 130}g</div>
              <span className="text-[10px] text-zinc-500 font-medium">{tr('For muscle & sugar control', 'मांसपेशी व शुगर नियंत्रण हेतु')}</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">{tr('Carb Target', 'कार्ब्स लक्ष्य')}</span>
              <div className="text-lg font-black text-zinc-900">{calculatedPlan?.carbsGrams || 180}g</div>
              <span className="text-[10px] text-zinc-500 font-medium">{tr('Whole grains & fiber', 'साबुत अनाज व फाइबर')}</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">{tr('Healthy Fats', 'हेल्दी फैट्स')}</span>
              <div className="text-lg font-black text-zinc-900">{calculatedPlan?.fatsGrams || 50}g</div>
              <span className="text-[10px] text-zinc-500 font-medium">{tr('Nuts & seeds', 'मेवे व बीज')}</span>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">{tr('Water Intake', 'पानी की मात्रा')}</span>
              <div className="text-lg font-black text-teal-600">{calculatedPlan?.waterLiters || 3.2}L</div>
              <span className="text-[10px] text-zinc-500 font-medium">{tr('Daily hydration', 'दैनिक जल सेवन')}</span>
            </div>
          </div>
        </div>

        {/* ACCOUNT — a single tappable list, one row per action, instead of
            a grid of separate cards; each row keeps its real destination. */}
        <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100">
          <button
            type="button"
            onClick={() => setIsEditProfileOpen(true)}
            className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Edit3 className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-zinc-900 flex-1 min-w-0 truncate">{tr('Edit Health Profile', 'स्वास्थ्य प्रोफ़ाइल संपादित करें')}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenReports}
            className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-zinc-900 flex-1 min-w-0 truncate">{tr('Lab & Diab Reports', 'लैब व डायबिटीज़ रिपोर्ट्स')}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenDoctorConsult}
            className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-zinc-900 flex-1 min-w-0 truncate">{tr('Doctor Hotline', 'डॉक्टर हॉटलाइन')}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenOrders}
            className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Package className="w-4.5 h-4.5" />
            </div>
            <span className="text-sm font-bold text-zinc-900 flex-1 min-w-0 truncate">{tr('My Orders', 'मेरे ऑर्डर')}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>
        </div>

        {/* LOG OUT */}
        <button
          type="button"
          onClick={onLogOut}
          className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{tr('Log Out', 'लॉग आउट')}</span>
        </button>

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

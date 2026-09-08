import React, { useState } from 'react';
import { X, RefreshCw, Scale, Target, ShieldCheck, Mail, CheckCircle2, SlidersHorizontal, Globe2 } from 'lucide-react';
import { UserHealthProfile, UserAccount } from '../types';
import { calculateNutritionPlan } from '../utils/calculator';
import { LanguageSwitchButton, useLanguage } from '../context/LanguageContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateProfile: (updated: UserHealthProfile) => void;
}

// Turns 'lose_weight' / 'steady' style enum values into readable labels.
const formatLabel = (value?: string): string => {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const GOAL_LABEL_HI: Record<string, string> = {
  lose_weight: 'वज़न घटाना',
  build_muscle: 'मांसपेशी बनाना',
  maintain_tone: 'टोन बनाए रखना',
  improve_health: 'स्वास्थ्य सुधारना',
  reverse_condition: 'स्थिति को उलटना',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  account,
  onUpdateProfile,
}) => {
  const [weightInput, setWeightInput] = useState(profile.currentWeightKg.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  if (!isOpen) return null;

  const handleSaveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 30 || val >= 250) return;

    setIsSaving(true);
    const recalculatedPlan = calculateNutritionPlan(
      profile.gender || 'male',
      profile.age || 30,
      profile.heightCm || 172,
      val,
      profile.targetWeightKg || 68,
      profile.goal || 'lose_weight',
      profile.activityLevel || 'moderately_active',
      profile.pace || 'steady'
    );

    onUpdateProfile({
      ...profile,
      currentWeightKg: val,
      calculatedPlan: recalculatedPlan,
      updatedAt: new Date().toISOString(),
    });

    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const weightDelta = +(profile.currentWeightKg - profile.targetWeightKg).toFixed(1);

  return (
    <div id="settings-modal-backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="settings-modal" className="w-full max-w-lg bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 text-zinc-900 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950">{tr('Settings', 'सेटिंग्स')}</h3>
              <p className="text-[11px] text-zinc-500 font-medium">{tr('Account, language & health metrics', 'खाता, भाषा व स्वास्थ्य मेट्रिक्स')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account card — real identity, no fabricated backend jargon */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {account.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt={account.displayName}
                className="w-11 h-11 rounded-full object-cover border border-zinc-200 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white font-black flex items-center justify-center text-sm shrink-0">
                {account.displayName ? account.displayName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-zinc-950 truncate">{account.displayName}</h4>
              <p className="text-xs text-zinc-500 flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{account.email}</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0">
            <ShieldCheck className="w-3 h-3" />
            <span>{account.authProvider === 'google' ? 'Google' : tr('Email', 'ईमेल')}</span>
          </span>
        </div>

        {/* App Language */}
        <div className="p-4 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200 shrink-0">
              <Globe2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900">{tr('App Language', 'ऐप की भाषा')}</h4>
              <p className="text-[10px] text-zinc-500">{tr('Switch between English & Hindi', 'अंग्रेज़ी व हिंदी के बीच स्विच करें')}</p>
            </div>
          </div>
          <LanguageSwitchButton />
        </div>

        {/* Body Metrics */}
        <form onSubmit={handleSaveWeight} className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-emerald-600" />
              <span>{tr("Update Today's Body Weight (kg)", 'आज का वज़न अपडेट करें (kg)')}</span>
            </label>
            <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
              <Target className="w-3 h-3" />
              {tr('Goal:', 'लक्ष्य:')} {profile.targetWeightKg} kg
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-2 text-sm text-zinc-900 font-semibold"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
            >
              {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />}
              <span>{saved ? tr('Saved', 'सहेजा गया') : tr('Save', 'सहेजें')}</span>
            </button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-center">
              <div className="text-xs font-black text-zinc-900">
                {weightDelta > 0 ? tr(`${weightDelta} kg to go`, `${weightDelta} kg शेष`) : weightDelta < 0 ? tr(`${Math.abs(weightDelta)} kg past goal`, `लक्ष्य से ${Math.abs(weightDelta)} kg आगे`) : tr('Goal reached', 'लक्ष्य पूरा हुआ')}
              </div>
              <span className="text-[9px] text-zinc-500 font-semibold">{tr('Progress to Target', 'लक्ष्य की ओर प्रगति')}</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-center">
              <div className="text-xs font-black text-zinc-900">{tr(formatLabel(profile.goal), GOAL_LABEL_HI[profile.goal || ''] || formatLabel(profile.goal))}</div>
              <span className="text-[9px] text-zinc-500 font-semibold">{tr('Health Goal', 'स्वास्थ्य लक्ष्य')}</span>
            </div>
          </div>
        </form>

        {/* Data reassurance — accurate, no exposed schema/table names */}
        <p className="text-[10px] text-center text-zinc-400 font-medium px-2">
          {tr('Your health data is private, encrypted in transit, and saved securely to your account automatically.', 'आपका स्वास्थ्य डेटा निजी है, ट्रांज़िट में एन्क्रिप्टेड है, और आपके खाते में स्वतः सुरक्षित रूप से सहेजा जाता है।')}
        </p>

        {/* Pointer to the full profile editor, which now lives as its own
            module on the Profile page instead of a destructive "retake
            onboarding" reset here. */}
        <p className="text-[10px] text-center text-zinc-400 font-medium px-2 pt-1 border-t border-zinc-100">
          {tr('Want to update your goal, activity level, or medical history? Open', 'अपना लक्ष्य, गतिविधि स्तर, या मेडिकल इतिहास अपडेट करना चाहते हैं? खोलें')}{' '}
          <span className="font-bold text-emerald-600">{tr('Profile → Edit Health Profile', 'प्रोफ़ाइल → स्वास्थ्य प्रोफ़ाइल संपादित करें')}</span>.
        </p>

      </div>
    </div>
  );
};

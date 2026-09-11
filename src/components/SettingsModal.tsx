import React, { useState } from 'react';
import {
  X, RefreshCw, Scale, ChevronRight, Leaf, BadgeCheck, Crown, Globe2, Ruler,
  Palette, Bell, Activity, FileText, Lock, UploadCloud, User, Package,
  HelpCircle, Info, LogOut, Edit3, Check,
} from 'lucide-react';
import { UserHealthProfile, UserAccount } from '../types';
import { calculateNutritionPlan } from '../utils/calculator';
import { logActivity } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  account: UserAccount;
  onUpdateProfile: (updated: UserHealthProfile) => void;
  /** Opens the Pro upgrade flow (or, for an existing Pro member, its plan
   *  details) — reused as-is, not duplicated here. */
  onOpenProUpgrade: () => void;
  /** "Health Metrics" — jumps to the Profile tab, where Edit Health Profile
   *  (weight/height/goals) already lives, rather than duplicating that form. */
  onOpenAccountTab: () => void;
  onOpenReports: () => void;
  onOpenOrders: () => void;
  onOpenDoctorConsult: () => void;
  onLogOut: () => void;
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

/** One tappable row — icon, title, subtitle, and either a fixed trailing
 *  value + chevron (navigates) or a custom trailing control (a toggle). */
const Row: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  disabled?: boolean;
}> = ({ icon: Icon, title, subtitle, onClick, trailing, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick || disabled}
    className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
      onClick && !disabled ? 'hover:bg-zinc-50 cursor-pointer' : 'cursor-default'
    } ${disabled ? 'opacity-50' : ''}`}
  >
    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-sm font-bold text-zinc-900 truncate">{title}</div>
      <div className="text-[11px] text-zinc-500 truncate">{subtitle}</div>
    </div>
    {trailing !== undefined ? trailing : (onClick && <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />)}
  </button>
);

/** A section label ("App Preferences", "Health & Data", ...) above a group
 *  of rows in one rounded card. */
const SectionCard: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider px-1">{label}</h3>
    <div className="rounded-2xl bg-white border border-zinc-200 shadow-xs divide-y divide-zinc-100 overflow-hidden">
      {children}
    </div>
  </div>
);

/** An info-only row that expands in place with real, accurate detail text
 *  instead of pretending to navigate somewhere. */
const ExpandableRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  detail: string;
  value?: string;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ icon: Icon, title, subtitle, detail, value, isOpen, onToggle }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
    >
      <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-zinc-900 truncate">{title}</div>
        <div className="text-[11px] text-zinc-500 truncate">{subtitle}</div>
      </div>
      {value && <span className="text-xs font-bold text-zinc-600 shrink-0">{value}</span>}
      <ChevronRight className={`w-4 h-4 text-zinc-300 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
    </button>
    {isOpen && (
      <div className="px-3.5 pb-3.5 -mt-1">
        <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-50 border border-zinc-100 rounded-xl p-3">{detail}</p>
      </div>
    )}
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  account,
  onUpdateProfile,
  onOpenProUpgrade,
  onOpenAccountTab,
  onOpenReports,
  onOpenOrders,
  onOpenDoctorConsult,
  onLogOut,
}) => {
  const { language, setLanguage } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [weightInput, setWeightInput] = useState(profile.currentWeightKg.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name || account.displayName || '');
  const [expanded, setExpanded] = useState<'appearance' | 'privacy' | 'backup' | 'about' | null>(null);

  if (!isOpen) return null;

  const units = profile.preferences?.units || 'metric';
  const notificationsEnabled = profile.preferences?.enableNotifications !== false;

  const savePreferences = (patch: Partial<{ units: 'metric' | 'imperial'; enableNotifications: boolean }>) => {
    onUpdateProfile({
      ...profile,
      preferences: { ...(profile.preferences as any || {}), ...patch },
    });
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    onUpdateProfile({ ...profile, name: trimmed, updatedAt: new Date().toISOString() });
    if (account.uid) logActivity(account.uid, 'updated', 'profile', `Changed name to ${trimmed}`).catch(() => {});
    setIsEditingName(false);
  };

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
    if (account.uid) logActivity(account.uid, 'updated', 'profile', `Updated body weight to ${val}kg`).catch(() => {});

    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const weightDelta = +(profile.currentWeightKg - profile.targetWeightKg).toFixed(1);
  const heightImperial = `${Math.floor((profile.heightCm || 172) / 2.54 / 12)} ft ${Math.round(((profile.heightCm || 172) / 2.54) % 12)} in`;

  return (
    <div id="settings-modal-backdrop" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div id="settings-modal" className="relative w-full max-w-lg bg-[#F8FAFC] border border-zinc-200 rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#F8FAFC]/95 backdrop-blur-md px-5 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-zinc-950 leading-tight">{tr('Settings', 'सेटिंग्स')}</h2>
              <p className="text-xs text-zinc-500 font-medium">{tr('Manage your account, preferences and health data', 'अपना खाता, प्राथमिकताएं व स्वास्थ्य डेटा प्रबंधित करें')}</p>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 pt-1">
            <Leaf className="w-4 h-4 text-emerald-500" />
            <span className="text-[9px] font-semibold text-zinc-400 leading-tight text-right">{tr('Live Healthier', 'बेहतर जिएं')}</span>
            <span className="text-[9px] font-black text-emerald-600 leading-tight">{tr('Everyday', 'हर दिन')}</span>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-6 space-y-5">

          {/* IDENTITY */}
          <div className="p-4 rounded-2xl bg-white border border-zinc-200 shadow-xs flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white font-black flex items-center justify-center text-lg overflow-hidden shrink-0">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt={account.displayName} className="w-full h-full object-cover" />
              ) : (
                (profile.name || account.displayName || 'U')[0].toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
                    className="min-w-0 flex-1 px-2 py-1 rounded-lg border border-emerald-300 text-sm font-bold text-zinc-900 focus:outline-none"
                  />
                  <button type="button" onClick={handleSaveName} className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-base font-black text-zinc-950 truncate">{profile.name || account.displayName || tr('UrCare Member', 'UrCare सदस्य')}</h4>
                  <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/15 shrink-0" strokeWidth={2.5} />
                </div>
              )}
              <p className="text-xs text-zinc-500 flex items-center gap-1 truncate mt-0.5">
                <span className="truncate">{profile.email || account.email}</span>
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-1">
                <BadgeCheck className="w-3 h-3" />
                {tr('Verified Account', 'सत्यापित खाता')}
              </span>
            </div>
            {!isEditingName && (
              <button
                type="button"
                onClick={() => { setNameInput(profile.name || account.displayName || ''); setIsEditingName(true); }}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {tr('Edit', 'संपादित')}
              </button>
            )}
          </div>

          {/* MEMBERSHIP */}
          <button
            type="button"
            onClick={onOpenProUpgrade}
            className="w-full p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3 text-left hover:bg-emerald-100/70 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
              <Crown className={`w-5 h-5 ${account.isPro ? 'text-amber-500' : 'text-emerald-600'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-zinc-950">{account.isPro ? tr('UrCare Pro Member', 'UrCare प्रो सदस्य') : tr('UrCare Free Member', 'UrCare फ्री सदस्य')}</div>
              <div className="text-[11px] text-zinc-500 font-medium">
                {account.isPro ? tr('Manage your premium plan', 'अपनी प्रीमियम योजना प्रबंधित करें') : tr('Access all core features for everyone', 'सभी के लिए मुख्य फीचर्स उपलब्ध हैं')}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>

          {/* APP PREFERENCES */}
          <SectionCard label={tr('App Preferences', 'ऐप प्राथमिकताएं')}>
            <div className="flex items-center gap-3 p-3.5">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Globe2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-zinc-900">{tr('App Language', 'ऐप की भाषा')}</div>
                <div className="text-[11px] text-zinc-500">{tr('Switch between English & Hindi', 'अंग्रेज़ी व हिंदी के बीच स्विच करें')}</div>
              </div>
              <div className="shrink-0 inline-flex rounded-full bg-zinc-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${language === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${language === 'hi' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                  हिंदी
                </button>
              </div>
            </div>

            <Row
              icon={Ruler}
              title={tr('Units', 'इकाइयां')}
              subtitle={tr('Choose your preferred units', 'अपनी पसंदीदा इकाइयां चुनें')}
              onClick={() => savePreferences({ units: units === 'metric' ? 'imperial' : 'metric' })}
              trailing={
                <span className="flex items-center gap-1 text-xs font-bold text-zinc-600 shrink-0">
                  {units === 'metric' ? tr('Metric (kg, cm)', 'मीट्रिक (kg, cm)') : tr('Imperial (lbs, ft)', 'इंपीरियल (lbs, ft)')}
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </span>
              }
            />

            <ExpandableRow
              icon={Palette}
              title={tr('Appearance', 'रूप-रंग')}
              subtitle={tr('Choose app theme', 'ऐप थीम चुनें')}
              value={tr('Light', 'लाइट')}
              detail={tr(
                'Light theme is the only option right now — dark mode is on the roadmap and will show up here once it ships.',
                'अभी सिर्फ लाइट थीम उपलब्ध है — डार्क मोड आने वाला है और लॉन्च होते ही यहां दिखेगा।'
              )}
              isOpen={expanded === 'appearance'}
              onToggle={() => setExpanded(expanded === 'appearance' ? null : 'appearance')}
            />

            <Row
              icon={Bell}
              title={tr('Notifications', 'सूचनाएं')}
              subtitle={tr('Manage your reminders and alerts', 'अपनी रिमाइंडर व अलर्ट प्रबंधित करें')}
              onClick={() => savePreferences({ enableNotifications: !notificationsEnabled })}
              trailing={
                <span
                  className={`shrink-0 relative w-10 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-emerald-600' : 'bg-zinc-200'}`}
                  aria-hidden="true"
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationsEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </span>
              }
            />
          </SectionCard>

          {/* HEALTH & DATA */}
          <SectionCard label={tr('Health & Data', 'स्वास्थ्य व डेटा')}>
            <Row
              icon={Activity}
              title={tr('Health Metrics', 'स्वास्थ्य मेट्रिक्स')}
              subtitle={tr('Weight, height, goals and more', 'वज़न, कद, लक्ष्य व अधिक')}
              onClick={() => { onOpenAccountTab(); onClose(); }}
            />
            <Row
              icon={FileText}
              title={tr('Lab & Diabetes Data', 'लैब व डायबिटीज़ डेटा')}
              subtitle={tr('Manage your reports and health data', 'अपनी रिपोर्ट्स व स्वास्थ्य डेटा प्रबंधित करें')}
              onClick={() => { onOpenReports(); onClose(); }}
            />
            <ExpandableRow
              icon={Lock}
              title={tr('Data Privacy', 'डेटा गोपनीयता')}
              subtitle={tr('Your data is secure with us', 'आपका डेटा हमारे पास सुरक्षित है')}
              detail={tr(
                'Your health data is private, encrypted in transit, and saved securely to your account automatically. It is never sold or shared with advertisers.',
                'आपका स्वास्थ्य डेटा निजी है, ट्रांज़िट में एन्क्रिप्टेड है, और आपके खाते में स्वतः सुरक्षित रूप से सहेजा जाता है। इसे कभी भी विज्ञापनदाताओं को नहीं बेचा या साझा नहीं किया जाता।'
              )}
              isOpen={expanded === 'privacy'}
              onToggle={() => setExpanded(expanded === 'privacy' ? null : 'privacy')}
            />
            <ExpandableRow
              icon={UploadCloud}
              title={tr('Backup & Sync', 'बैकअप व सिंक')}
              subtitle={tr('Keep your data safe across devices', 'अपने डेटा को हर डिवाइस पर सुरक्षित रखें')}
              detail={
                profile.updatedAt
                  ? tr(`Automatically synced to the cloud — last updated ${new Date(profile.updatedAt).toLocaleString()}. Sign in on any device to see the same data.`, `क्लाउड पर स्वतः सिंक होता है — आखिरी बार ${new Date(profile.updatedAt).toLocaleString()} को अपडेट हुआ। किसी भी डिवाइस पर साइन इन करें और वही डेटा देखें।`)
                  : tr('Automatically synced to the cloud in real time. Sign in on any device to see the same data.', 'क्लाउड पर रीयल-टाइम में स्वतः सिंक होता है। किसी भी डिवाइस पर साइन इन करें और वही डेटा देखें।')
              }
              isOpen={expanded === 'backup'}
              onToggle={() => setExpanded(expanded === 'backup' ? null : 'backup')}
            />
          </SectionCard>

          {/* ACCOUNT & SUPPORT */}
          <SectionCard label={tr('Account & Support', 'खाता व सहायता')}>
            <Row
              icon={User}
              title={tr('Connected Devices', 'जुड़े हुए डिवाइस')}
              subtitle={tr('Sync health data from wearables — coming soon', 'वियरेबल्स से स्वास्थ्य डेटा सिंक करें — जल्द आ रहा है')}
              disabled
              trailing={<span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full shrink-0">{tr('Soon', 'जल्द')}</span>}
            />
            <Row
              icon={Package}
              title={tr('My Orders', 'मेरे ऑर्डर')}
              subtitle={tr('View your store orders', 'अपने स्टोर ऑर्डर देखें')}
              onClick={() => { onOpenOrders(); onClose(); }}
            />
            <Row
              icon={HelpCircle}
              title={tr('Help & Support', 'सहायता व समर्थन')}
              subtitle={tr('Get help or contact us', 'सहायता पाएं या हमसे संपर्क करें')}
              onClick={() => { onOpenDoctorConsult(); onClose(); }}
            />
            <ExpandableRow
              icon={Info}
              title={tr('About UrCare', 'UrCare के बारे में')}
              subtitle={tr('App version, terms and policies', 'ऐप वर्शन, नियम व नीतियां')}
              detail={tr(
                'UrCare — Doctor-Led Reversal & Metabolic Health. Version 1.0.0. By continuing to use the app you agree to our Terms of Service and Privacy Policy.',
                'UrCare — डॉक्टर-नेतृत्व वाला रिवर्सल व मेटाबॉलिक स्वास्थ्य। वर्शन 1.0.0। ऐप का उपयोग जारी रखकर आप हमारी सेवा शर्तों व गोपनीयता नीति से सहमत होते हैं।'
              )}
              isOpen={expanded === 'about'}
              onToggle={() => setExpanded(expanded === 'about' ? null : 'about')}
            />
          </SectionCard>

          {/* BODY METRICS — quick weight update, unchanged from before */}
          <form onSubmit={handleSaveWeight} className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                <span>{units === 'metric' ? tr("Update Today's Body Weight (kg)", 'आज का वज़न अपडेट करें (kg)') : tr("Update Today's Body Weight (lbs)", 'आज का वज़न अपडेट करें (lbs)')}</span>
              </label>
              <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                {tr('Goal:', 'लक्ष्य:')} {units === 'metric' ? `${profile.targetWeightKg} kg` : `${(profile.targetWeightKg * 2.20462).toFixed(1)} lbs`}
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
                {saved ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />}
                <span>{saved ? tr('Saved', 'सहेजा गया') : tr('Save', 'सहेजें')}</span>
              </button>
            </div>

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
            {units === 'imperial' && (
              <p className="text-[10px] text-zinc-400 text-center">{tr(`Height on file: ${heightImperial}`, `दर्ज कद: ${heightImperial}`)}</p>
            )}
          </form>

          <button
            type="button"
            onClick={onLogOut}
            className="w-full py-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-black text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {tr('Log Out', 'लॉग आउट')}
          </button>

          <div className="text-center pt-1 pb-1 space-y-0.5">
            <p className="text-[10px] text-zinc-400 font-semibold">{tr('Version 1.0.0', 'वर्शन 1.0.0')}</p>
            <p className="text-[10px] text-zinc-400">{tr('Made with ❤️ for a healthier you', 'एक स्वस्थ आप के लिए ❤️ से बनाया गया')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, User, Scale, Target, Activity, Gauge, Apple, Stethoscope, Check, Save } from 'lucide-react';
import { UserHealthProfile, GenderType, GoalType, ActivityLevel, GoalPace } from '../types';
import { calculateNutritionPlan } from '../utils/calculator';
import { useLanguage } from '../context/LanguageContext';

interface EditHealthProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  onUpdateProfile: (updated: UserHealthProfile) => void;
}

const GOAL_OPTIONS: { id: GoalType; title: string; desc: string }[] = [
  { id: 'lose_weight', title: 'Lose Weight & Burn Fat', desc: 'Caloric deficit, high-protein satiety' },
  { id: 'build_muscle', title: 'Build Lean Muscle & Tone', desc: 'Hypertrophy macro split' },
  { id: 'maintain_tone', title: 'Maintain Weight & Stay Fit', desc: 'Iso-caloric metabolic balance' },
  { id: 'improve_health', title: 'Manage Blood Sugar & Vitality', desc: 'Low glycemic index focus' },
  { id: 'reverse_condition', title: 'Reverse Diabetes & Other Conditions', desc: 'Doctor-led root-cause reversal' },
];

const ACTIVITY_OPTIONS: { id: ActivityLevel; title: string }[] = [
  { id: 'sedentary', title: 'Sedentary (little/no exercise)' },
  { id: 'lightly_active', title: 'Lightly Active (1-2 days/wk)' },
  { id: 'moderately_active', title: 'Moderately Active (3-5 days/wk)' },
  { id: 'very_active', title: 'Very Active (6+ days/wk)' },
  { id: 'athlete', title: 'Athlete (intense daily training)' },
];

const PACE_OPTIONS: { id: GoalPace; title: string; rate: string }[] = [
  { id: 'slow', title: 'Gentle', rate: '~0.25 kg/wk' },
  { id: 'steady', title: 'Recommended', rate: '~0.5 kg/wk' },
  { id: 'moderate', title: 'Moderate', rate: '~0.75 kg/wk' },
  { id: 'fast', title: 'Aggressive', rate: '~1 kg/wk' },
];

const DIET_OPTIONS = ['Vegetarian', 'Eggetarian', 'Non-Vegetarian', 'Vegan', 'Jain', 'Keto / Low-Carb', 'Gluten-Free', 'Other'];

// This exact label list is mirrored server-side (CONDITION_LABEL_TO_TAG in
// server.ts) to match each user into the right condition-specific sections
// of the reversal plan — keep the two in sync if this changes.
const CONDITION_OPTIONS = [
  'None',
  'Diabetes / Pre-Diabetes',
  'Obesity',
  'High Blood Pressure',
  'High Cholesterol / Fatty Liver',
  'Thyroid (Hypo/Hyper)',
  'PCOS / PCOD',
  'Neuropathy (Nerve Pain/Tingling)',
  'Diabetic Retinopathy',
  'Heart Disease',
  'Kidney Disease',
  'Joint Pain / Arthritis',
  'Chronic Fatigue',
  'Sleep Apnea / Sleep Issues',
  'Erectile Dysfunction',
  'Uric Acid / Gout',
  'Digestive / IBS',
];

const pillActive = 'bg-emerald-600 border-emerald-600 text-white shadow-sm';
const pillInactive = 'bg-white border-zinc-200 text-zinc-700 hover:border-emerald-300';

// Hindi display labels — the English id/value stored in state (and matched
// server-side for conditions) is never translated, only what's shown.
const GOAL_LABEL_HI: Record<GoalType, { title: string; desc: string }> = {
  lose_weight: { title: 'वज़न घटाएं व चर्बी कम करें', desc: 'कैलोरी डेफिसिट, उच्च-प्रोटीन तृप्ति' },
  build_muscle: { title: 'मांसपेशी बनाएं व टोन करें', desc: 'हाइपरट्रॉफी मैक्रो विभाजन' },
  maintain_tone: { title: 'वज़न बनाए रखें व फिट रहें', desc: 'आइसो-कैलोरिक मेटाबॉलिक संतुलन' },
  improve_health: { title: 'ब्लड शुगर प्रबंधित करें व ऊर्जा बढ़ाएं', desc: 'कम ग्लाइसेमिक इंडेक्स पर फोकस' },
  reverse_condition: { title: 'डायबिटीज व अन्य स्थितियों को उलटें', desc: 'डॉक्टर-निर्देशित मूल-कारण रिवर्सल' },
};

const ACTIVITY_LABEL_HI: Record<ActivityLevel, string> = {
  sedentary: 'निष्क्रिय (कोई/बहुत कम व्यायाम)',
  lightly_active: 'हल्की सक्रियता (सप्ताह में 1-2 दिन)',
  moderately_active: 'मध्यम सक्रियता (सप्ताह में 3-5 दिन)',
  very_active: 'अत्यधिक सक्रिय (सप्ताह में 6+ दिन)',
  athlete: 'एथलीट (गहन दैनिक प्रशिक्षण)',
};

const PACE_LABEL_HI: Record<GoalPace, string> = {
  slow: 'सौम्य',
  steady: 'अनुशंसित',
  moderate: 'मध्यम',
  fast: 'तेज़',
};

const DIET_LABEL_HI: Record<string, string> = {
  Vegetarian: 'शाकाहारी',
  Eggetarian: 'अंडा-शाकाहारी',
  'Non-Vegetarian': 'मांसाहारी',
  Vegan: 'वीगन',
  Jain: 'जैन',
  'Keto / Low-Carb': 'कीटो / लो-कार्ब',
  'Gluten-Free': 'ग्लूटेन-फ्री',
  Other: 'अन्य',
};

const CONDITION_LABEL_HI: Record<string, string> = {
  'None': 'कोई नहीं',
  'Diabetes / Pre-Diabetes': 'डायबिटीज / प्री-डायबिटीज',
  'Obesity': 'मोटापा',
  'High Blood Pressure': 'उच्च रक्तचाप (बीपी)',
  'High Cholesterol / Fatty Liver': 'उच्च कोलेस्ट्रॉल / फैटी लिवर',
  'Thyroid (Hypo/Hyper)': 'थायरॉइड (हाइपो/हाइपर)',
  'PCOS / PCOD': 'PCOS / PCOD',
  'Neuropathy (Nerve Pain/Tingling)': 'न्यूरोपैथी (नस दर्द/झनझनाहट)',
  'Diabetic Retinopathy': 'डायबिटिक रेटिनोपैथी',
  'Heart Disease': 'हृदय रोग',
  'Kidney Disease': 'किडनी रोग',
  'Joint Pain / Arthritis': 'जोड़ों का दर्द / गठिया',
  'Chronic Fatigue': 'लगातार थकान',
  'Sleep Apnea / Sleep Issues': 'स्लीप एपनिया / नींद की समस्या',
  'Erectile Dysfunction': 'इरेक्टाइल डिसफंक्शन',
  'Uric Acid / Gout': 'यूरिक एसिड / गठिया रोग',
  'Digestive / IBS': 'पाचन संबंधी समस्या / IBS',
};

const GENDER_LABEL_HI: Record<GenderType, string> = { male: 'पुरुष', female: 'महिला', other: 'अन्य' };

export const EditHealthProfileModal: React.FC<EditHealthProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
}) => {
  const [name, setName] = useState(profile.name || '');
  const [gender, setGender] = useState<GenderType>(profile.gender || 'male');
  const [age, setAge] = useState(profile.age?.toString() || '28');
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() || '170');
  const [currentWeightKg, setCurrentWeightKg] = useState(profile.currentWeightKg?.toString() || '70');
  const [targetWeightKg, setTargetWeightKg] = useState(profile.targetWeightKg?.toString() || '65');
  const [goal, setGoal] = useState<GoalType>(profile.goal || 'lose_weight');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel || 'moderately_active');
  const [pace, setPace] = useState<GoalPace>(profile.pace || 'steady');
  const [dietaryPreference, setDietaryPreference] = useState(profile.dietaryPreference || 'Vegetarian');
  const [medicalConditions, setMedicalConditions] = useState<string[]>(profile.medicalConditions || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  if (!isOpen) return null;

  const toggleCondition = (cond: string) => {
    if (cond === 'None') {
      setMedicalConditions(['None']);
      return;
    }
    setMedicalConditions((prev) => {
      const withoutNone = prev.filter((c) => c !== 'None');
      return withoutNone.includes(cond) ? withoutNone.filter((c) => c !== cond) : [...withoutNone, cond];
    });
  };

  const handleSave = () => {
    setIsSaving(true);
    const parsedAge = Math.max(10, Math.min(100, parseInt(age, 10) || profile.age));
    const parsedHeight = Math.max(100, Math.min(250, parseFloat(heightCm) || profile.heightCm));
    const parsedCurrentWeight = Math.max(30, Math.min(250, parseFloat(currentWeightKg) || profile.currentWeightKg));
    const parsedTargetWeight = Math.max(30, Math.min(250, parseFloat(targetWeightKg) || profile.targetWeightKg));

    const recalculatedPlan = calculateNutritionPlan(
      gender,
      parsedAge,
      parsedHeight,
      parsedCurrentWeight,
      parsedTargetWeight,
      goal,
      activityLevel,
      pace
    );

    const updated: UserHealthProfile = {
      ...profile,
      name: name.trim() || profile.name,
      gender,
      age: parsedAge,
      heightCm: parsedHeight,
      currentWeightKg: parsedCurrentWeight,
      targetWeightKg: parsedTargetWeight,
      goal,
      activityLevel,
      pace,
      dietaryPreference,
      medicalConditions,
      calculatedPlan: recalculatedPlan,
      updatedAt: new Date().toISOString(),
    };

    onUpdateProfile(updated);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white border border-zinc-200 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-zinc-950">{tr('Edit Health Profile', 'स्वास्थ्य प्रोफ़ाइल संपादित करें')}</h3>
              <p className="text-[11px] text-zinc-500 font-medium truncate">{tr('Update the details you gave us at sign-up, any time', 'साइन-अप के समय दी गई जानकारी कभी भी अपडेट करें')}</p>
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-5 text-left">

          {/* Personal Details */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Personal Details', 'व्यक्तिगत जानकारी')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">{tr('Full Name', 'पूरा नाम')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">{tr('Age (years)', 'आयु (वर्ष)')}</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">{tr('Height (cm)', 'कद (cm)')}</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">{tr('Gender', 'लिंग')}</label>
                <div className="flex gap-1.5">
                  {(['male', 'female', 'other'] as GenderType[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 py-2.5 rounded-xl border text-[11px] font-bold capitalize transition-all cursor-pointer ${gender === g ? pillActive : pillInactive}`}
                    >
                      {tr(g, GENDER_LABEL_HI[g])}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Weight Goals */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Weight Goals', 'वज़न लक्ष्य')}
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">{tr('Current Weight (kg)', 'वर्तमान वज़न (kg)')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" /> {tr('Target Weight (kg)', 'लक्ष्य वज़न (kg)')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Primary Goal */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Primary Goal', 'मुख्य लक्ष्य')}
            </h4>
            <div className="space-y-1.5">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between gap-2 text-left transition-all cursor-pointer ${goal === g.id ? pillActive : pillInactive}`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-black truncate">{tr(g.title, GOAL_LABEL_HI[g.id].title)}</div>
                    <div className={`text-[10px] truncate ${goal === g.id ? 'text-emerald-50' : 'text-zinc-500'}`}>{tr(g.desc, GOAL_LABEL_HI[g.id].desc)}</div>
                  </div>
                  {goal === g.id && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>
          </section>

          {/* Activity Level */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Activity Level', 'गतिविधि स्तर')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {ACTIVITY_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActivityLevel(a.id)}
                  className={`p-2.5 rounded-xl border text-[11px] font-bold text-left transition-all cursor-pointer ${activityLevel === a.id ? pillActive : pillInactive}`}
                >
                  {tr(a.title, ACTIVITY_LABEL_HI[a.id])}
                </button>
              ))}
            </div>
          </section>

          {/* Pace */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Reversal Pace', 'रिवर्सल गति')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PACE_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPace(p.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${pace === p.id ? pillActive : pillInactive}`}
                >
                  <div className="text-[11px] font-black">{tr(p.title, PACE_LABEL_HI[p.id])}</div>
                  <div className={`text-[9px] ${pace === p.id ? 'text-emerald-50' : 'text-zinc-500'}`}>{p.rate}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Dietary Preference */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Apple className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Dietary Preference', 'खानपान की प्राथमिकता')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {DIET_OPTIONS.map((diet) => (
                <button
                  key={diet}
                  type="button"
                  onClick={() => setDietaryPreference(diet)}
                  className={`p-2.5 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${dietaryPreference === diet ? pillActive : pillInactive}`}
                >
                  {tr(diet, DIET_LABEL_HI[diet] || diet)}
                </button>
              ))}
            </div>
          </section>

          {/* Medical Conditions */}
          <section className="space-y-2.5 pb-1">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Medical Conditions', 'मेडिकल स्थितियां')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {CONDITION_OPTIONS.map((cond) => {
                const isSelected = medicalConditions.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleCondition(cond)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${isSelected ? pillActive : pillInactive}`}
                  >
                    <span className="text-[11px] font-bold">{tr(cond, CONDITION_LABEL_HI[cond] || cond)}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-zinc-100 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-70"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saved ? tr('Saved to Your Account', 'आपके खाते में सहेजा गया') : tr('Save Changes', 'बदलाव सहेजें')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

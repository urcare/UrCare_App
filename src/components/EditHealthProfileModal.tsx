import React, { useState } from 'react';
import { X, User, Scale, Target, Activity, Gauge, Apple, Stethoscope, Check, Save } from 'lucide-react';
import { UserHealthProfile, GenderType, GoalType, ActivityLevel, GoalPace } from '../types';
import { calculateNutritionPlan } from '../utils/calculator';

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

const CONDITION_OPTIONS = [
  'None',
  'Diabetes / Pre-Diabetes',
  'Thyroid (Hypo/Hyper)',
  'PCOS / PCOD',
  'High Blood Pressure',
  'High Cholesterol / Fatty Liver',
  'Uric Acid / Gout',
  'Digestive / IBS',
];

const pillActive = 'bg-emerald-600 border-emerald-600 text-white shadow-sm';
const pillInactive = 'bg-white border-zinc-200 text-zinc-700 hover:border-emerald-300';

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
              <h3 className="text-base font-black text-zinc-950">Edit Health Profile</h3>
              <p className="text-[11px] text-zinc-500 font-medium truncate">Update the details you gave us at sign-up, any time</p>
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
              Personal Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Age (years)</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Gender</label>
                <div className="flex gap-1.5">
                  {(['male', 'female', 'other'] as GenderType[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 py-2.5 rounded-xl border text-[11px] font-bold capitalize transition-all cursor-pointer ${gender === g ? pillActive : pillInactive}`}
                    >
                      {g}
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
              Weight Goals
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">Current Weight (kg)</label>
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
                  <Target className="w-3 h-3" /> Target Weight (kg)
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
              Primary Goal
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
                    <div className="text-xs font-black truncate">{g.title}</div>
                    <div className={`text-[10px] truncate ${goal === g.id ? 'text-emerald-50' : 'text-zinc-500'}`}>{g.desc}</div>
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
              Activity Level
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {ACTIVITY_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActivityLevel(a.id)}
                  className={`p-2.5 rounded-xl border text-[11px] font-bold text-left transition-all cursor-pointer ${activityLevel === a.id ? pillActive : pillInactive}`}
                >
                  {a.title}
                </button>
              ))}
            </div>
          </section>

          {/* Pace */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-600" />
              Reversal Pace
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PACE_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPace(p.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${pace === p.id ? pillActive : pillInactive}`}
                >
                  <div className="text-[11px] font-black">{p.title}</div>
                  <div className={`text-[9px] ${pace === p.id ? 'text-emerald-50' : 'text-zinc-500'}`}>{p.rate}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Dietary Preference */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Apple className="w-3.5 h-3.5 text-emerald-600" />
              Dietary Preference
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {DIET_OPTIONS.map((diet) => (
                <button
                  key={diet}
                  type="button"
                  onClick={() => setDietaryPreference(diet)}
                  className={`p-2.5 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${dietaryPreference === diet ? pillActive : pillInactive}`}
                >
                  {diet}
                </button>
              ))}
            </div>
          </section>

          {/* Medical Conditions */}
          <section className="space-y-2.5 pb-1">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              Medical Conditions
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
                    <span className="text-[11px] font-bold">{cond}</span>
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
            <span>{saved ? 'Saved to Your Account' : 'Save Changes'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, ArrowLeft, Check, Sparkles, Flame, Target, User, Heart, 
  Activity, ShieldCheck, Dumbbell, Apple, Clock, Scale, Zap, Lock, Globe,
  CheckCircle2, ChevronRight, Moon, Sun, Star, Bell, Calendar, Award,
  Sparkle, Volume2, Camera, Phone, Compass, CheckSquare, Stethoscope,
  AlertCircle
} from 'lucide-react';
import { 
  GoalType, GenderType, ActivityLevel, GoalPace, 
  UserHealthProfile, UserAccount, UserPreferences 
} from '../types';
import { calculateNutritionPlan } from '../utils/calculator';
import { Language, translations } from '../utils/translations';
import { WheelPicker } from './WheelPicker';
import { RulerWheelPicker } from './RulerWheelPicker';
import { Logo } from './Logo';
import { playClickSound, playScrollTickSound, playSuccessChime } from '../utils/soundEffects';

interface OnboardingFlowProps {
  onComplete: (profile: UserHealthProfile, account: UserAccount) => void;
  onOpenAdmin?: () => void;
  initialAccount?: UserAccount | null;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onOpenAdmin, initialAccount }) => {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang] || translations.en;

  // Total Onboarding Steps
  const TOTAL_QUESTIONS_COUNT = 23;
  const [currentStep, setCurrentStep] = useState(0);

  // 1. Gender & Activity
  const [gender, setGender] = useState<GenderType>('male');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<'0-2' | '3-5' | '6+'>('3-5');
  const [heardFrom, setHeardFrom] = useState<string>('instagram');
  const [triedOtherApps, setTriedOtherApps] = useState<boolean>(true);

  // 2. Age Wheel & Birth Date
  const currentYear = new Date().getFullYear();
  const [age, setAge] = useState<number>(26);
  const [agePickerMode, setAgePickerMode] = useState<'direct_age' | 'dob'>('direct_age');
  const [birthYear, setBirthYear] = useState<number>(1998);
  const [birthMonth, setBirthMonth] = useState<number>(6);
  const [birthDay, setBirthDay] = useState<number>(15);

  // 3. Height Wheel / Ruler (CM & FT/IN)
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightCm, setHeightCm] = useState<number>(175);
  const [heightFeet, setHeightFeet] = useState<number>(5);
  const [heightInches, setHeightInches] = useState<number>(9);

  // Sync FT/IN with CM
  const updateHeightFromCm = (cm: number) => {
    setHeightCm(cm);
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    setHeightFeet(feet);
    setHeightInches(inches >= 12 ? 0 : inches);
  };

  const updateHeightFromFtIn = (ft: number, inch: number) => {
    setHeightFeet(ft);
    setHeightInches(inch);
    const cm = Math.round((ft * 12 + inch) * 2.54);
    setHeightCm(cm);
  };

  // 4. Weight Wheel / Ruler (KG & LBS)
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(76.0);
  const [currentWeightLbs, setCurrentWeightLbs] = useState<number>(167.5);

  const updateCurrentWeightKg = (kg: number) => {
    setCurrentWeightKg(kg);
    setCurrentWeightLbs(Number((kg * 2.20462).toFixed(1)));
  };

  const updateCurrentWeightLbs = (lbs: number) => {
    setCurrentWeightLbs(lbs);
    setCurrentWeightKg(Number((lbs / 2.20462).toFixed(1)));
  };

  // 5. Target Weight Wheel / Ruler (KG & LBS)
  const [targetWeightUnit, setTargetWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [targetWeightKg, setTargetWeightKg] = useState<number>(68.0);
  const [targetWeightLbs, setTargetWeightLbs] = useState<number>(150.0);
  const [pace, setPace] = useState<GoalPace>('steady');

  const updateTargetWeightKg = (kg: number) => {
    setTargetWeightKg(kg);
    setTargetWeightLbs(Number((kg * 2.20462).toFixed(1)));
  };

  const updateTargetWeightLbs = (lbs: number) => {
    setTargetWeightLbs(lbs);
    setTargetWeightKg(Number((lbs / 2.20462).toFixed(1)));
  };

  // 6. Goals, Focus Areas & Conditions
  const [goal, setGoal] = useState<GoalType>('lose_weight');
  const [selectedAccomplishments, setSelectedAccomplishments] = useState<string[]>(['belly', 'energy']);
  const [dietaryPreference, setDietaryPreference] = useState<string>('Vegetarian');
  const [customDietText, setCustomDietText] = useState<string>('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [worksWithTrainer, setWorksWithTrainer] = useState<boolean>(false);

  // 6b. Health Deep-Dive (medicines, allergies, vitals, sleep, stress, gut, lifestyle,
  // family history, gender-specific, symptoms & readiness) — additive, non-destructive fields
  type YesNo = '' | 'yes' | 'no' | 'not_sure';
  interface DeepDiveState {
    onMedicines: YesNo; medicinesText: string;
    onInsulin: YesNo; insulinDetails: string;
    onSupplements: YesNo; supplementsText: string;
    medicineAllergy: YesNo; foodAllergy: YesNo; envAllergy: YesNo; allergyReactions: string[];
    monitorsSugar: YesNo; fastingSugar: string; postMealSugar: string; hba1c: string;
    bloodPressure: string; restingHeartRate: string; otherLabValues: string;
    sleepTime: string; wakeTime: string; sleepHours: string; sleepQuality: string;
    snoring: YesNo; sleepApnea: YesNo;
    stressLevel: string; stressSources: string[]; emotionalSymptoms: string[]; stressManagement: string[];
    bowelFrequency: string; stoolType: string; digestiveSymptoms: string[]; digestiveConditions: string[];
    alcohol: string; tobacco: string; waterIntake: string; teaCoffee: string;
    friedFoodFreq: string; screenTimeHours: string; sittingHours: string;
    familyHistory: string[];
    menstrualStatus: string; cycleLength: string; pcos: YesNo; pregnant: YesNo; menopauseSymptoms: string[];
    energyLevel: string; libido: string; lowTestosterone: YesNo; prostateSymptoms: string[];
    organSymptoms: string[];
    biggestBarrier: string; helpNeeded: string[]; commitmentLevel: string; hoursPerWeek: string;
    pastMedicalHistory: string[]; seeingSpecialist: YesNo; specialistDetails: string; doctorNotes: string;
  }
  const [dd, setDd] = useState<DeepDiveState>({
    onMedicines: '', medicinesText: '',
    onInsulin: '', insulinDetails: '',
    onSupplements: '', supplementsText: '',
    medicineAllergy: '', foodAllergy: '', envAllergy: '', allergyReactions: [],
    monitorsSugar: '', fastingSugar: '', postMealSugar: '', hba1c: '',
    bloodPressure: '', restingHeartRate: '', otherLabValues: '',
    sleepTime: '', wakeTime: '', sleepHours: '', sleepQuality: '',
    snoring: '', sleepApnea: '',
    stressLevel: '', stressSources: [], emotionalSymptoms: [], stressManagement: [],
    bowelFrequency: '', stoolType: '', digestiveSymptoms: [], digestiveConditions: [],
    alcohol: '', tobacco: '', waterIntake: '', teaCoffee: '',
    friedFoodFreq: '', screenTimeHours: '', sittingHours: '',
    familyHistory: [],
    menstrualStatus: '', cycleLength: '', pcos: '', pregnant: '', menopauseSymptoms: [],
    energyLevel: '', libido: '', lowTestosterone: '', prostateSymptoms: [],
    organSymptoms: [],
    biggestBarrier: '', helpNeeded: [], commitmentLevel: '', hoursPerWeek: '',
    pastMedicalHistory: [], seeingSpecialist: '', specialistDetails: '', doctorNotes: '',
  });
  const setDdField = <K extends keyof DeepDiveState>(field: K, value: DeepDiveState[K]) => {
    setDd((prev) => ({ ...prev, [field]: value }));
  };
  const toggleDdItem = (field: keyof DeepDiveState, item: string) => {
    playClickSound(720);
    setDd((prev) => {
      const arr = (prev[field] as unknown as string[]) || [];
      const next = arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
      return { ...prev, [field]: next } as DeepDiveState;
    });
  };

  // 7. User Details (pre-fill from initialAccount if valid, otherwise empty for required entry)
  const [name, setName] = useState(
    initialAccount?.displayName && initialAccount.displayName !== 'New Member'
      ? initialAccount.displayName
      : ''
  );
  const [email, setEmail] = useState(
    initialAccount?.email && !initialAccount.email.startsWith('user_')
      ? initialAccount.email
      : ''
  );
  const [phone, setPhone] = useState(initialAccount?.phoneNumber || '');
  const [referralCode, setReferralCode] = useState('');
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [colorBurnsBack, setColorBurnsBack] = useState(true);
  const [rolloverCalories, setRolloverCalories] = useState(false);

  // Validation state for Step 11 (Contact details are mandatory)
  const [contactErrors, setContactErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  const validateAndProceedFromContact = () => {
    const errors: { name?: string; email?: string; phone?: string } = {};

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.toLowerCase() === 'new member') {
      errors.name = 'Full name is mandatory. Please enter your name.';
    } else if (trimmedName.length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = 'Email address is mandatory for receiving clinical reports.';
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address (e.g. name@gmail.com).';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!phone.trim()) {
      errors.phone = 'Phone number is mandatory for WhatsApp diet updates & physician sync.';
    } else if (cleanPhone.length < 10) {
      errors.phone = 'Please enter a valid 10-digit phone number.';
    }

    setContactErrors(errors);

    if (Object.keys(errors).length === 0) {
      nextStep();
    } else {
      playClickSound(350);
    }
  };

  // 9. Commitment Hold Button
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 10. Diagnostics Calculation Screen & Trial Modal
  const [calcProgress, setCalcProgress] = useState(0);
  const [calcPhaseText, setCalcPhaseText] = useState('Analyzing baseline metabolic index...');
  const [showPlanPopUp, setShowPlanPopUp] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);

  // Dynamic calculations
  const finalAge = agePickerMode === 'direct_age' ? age : Math.max(14, currentYear - birthYear);
  const bmi = Number((currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
  const weightDiff = Number((targetWeightKg - currentWeightKg).toFixed(1));
  const isLosing = weightDiff < 0;

  // Step Navigation
  const nextStep = () => {
    playClickSound(680);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep((prev) => Math.min(prev + 1, 24));
  };

  const prevStep = () => {
    playClickSound(520);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const toggleAccomplishment = (id: string) => {
    playClickSound(750);
    setSelectedAccomplishments((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleCondition = (cond: string) => {
    playClickSound(720);
    if (cond === 'None') {
      setSelectedConditions(['None']);
      return;
    }
    setSelectedConditions((prev) => {
      const filtered = prev.filter((c) => c !== 'None');
      return filtered.includes(cond) ? filtered.filter((c) => c !== cond) : [...filtered, cond];
    });
  };

  // Hold button logic
  const startHold = () => {
    playClickSound(600);
    setIsHolding(true);
    let current = 0;
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = setInterval(() => {
      current += 6;
      setHoldProgress(current);
      if (current >= 100) {
        clearInterval(holdIntervalRef.current!);
        setIsHolding(false);
        playSuccessChime();
        startPlanGeneration();
      }
    }, 50);
  };

  const stopHold = () => {
    if (holdProgress < 100) {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      setIsHolding(false);
      setHoldProgress(0);
    }
  };

  // Multi-Phase UrCare Metabolic Engine
  const startPlanGeneration = () => {
    setCurrentStep(24);
    setCalcProgress(10);
    setCalcPhaseText(lang === 'hi' ? 'आपकी बुनियादी मेटाबोलिक दर (BMR) का विश्लेषण...' : 'Calibrating Basal Metabolic Rate (BMR)...');

    setTimeout(() => {
      setCalcProgress(30);
      setCalcPhaseText(lang === 'hi' ? 'TDEE और दैनिक कैलोरी डेफिसिट की गणना...' : 'Computing Total Daily Energy Expenditure (TDEE)...');
    }, 700);

    setTimeout(() => {
      setCalcProgress(60);
      setCalcPhaseText(lang === 'hi' ? 'प्रोटीन, कार्ब्स और फैट मैक्रो विभाजन निर्धारित...' : 'Structuring macro split: Protein, Carbs & Healthy Fats...');
    }, 1400);

    setTimeout(() => {
      setCalcProgress(85);
      setCalcPhaseText(lang === 'hi' ? 'कस्टम डाइट और हाइड्रेशन लक्ष्य अंतिम रूप में...' : 'Finalizing personalized metabolic roadmap & hydration...');
    }, 2100);

    setTimeout(() => {
      setCalcProgress(100);
      setCalcPhaseText('Your Personalized Plan is Ready!');
      setShowPlanPopUp(true);
    }, 2800);
  };

  // Finish Onboarding
  const handleFinishOnboarding = (trialTier: '3_day' | 'free') => {
    const finalPlan = calculateNutritionPlan(
      gender,
      finalAge,
      heightCm,
      currentWeightKg,
      targetWeightKg,
      goal,
      workoutsPerWeek === '6+' ? 'very_active' : workoutsPerWeek === '3-5' ? 'moderately_active' : 'lightly_active',
      pace
    );

    const userPrefs: UserPreferences = {
      enableNotifications,
      colorBurnsBack,
      rolloverCalories,
      workoutDaysPerWeek: workoutsPerWeek,
      heardFrom,
      triedOtherApps,
      worksWithTrainerOrDietitian: worksWithTrainer,
      birthYear,
      birthMonth,
      birthDay,
      accomplishments: selectedAccomplishments,
      referralCode: referralCode.trim() || undefined,
      customDietNote: dietaryPreference === 'Other' ? customDietText : undefined,
      trialTier,
      autoPayEnabled,
    };

    const finalName = name.trim() || initialAccount?.displayName || (lang === 'hi' ? 'UrCare Member' : 'UrCare Member');
    const finalEmail = email.trim() || initialAccount?.email || 'member@urcare.app';
    const finalPhone = phone.trim() || initialAccount?.phoneNumber || '+91 98765 43210';

    const profile: UserHealthProfile = {
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      gender,
      age: finalAge,
      heightCm,
      currentWeightKg,
      targetWeightKg,
      goal,
      activityLevel: workoutsPerWeek === '6+' ? 'very_active' : workoutsPerWeek === '3-5' ? 'moderately_active' : 'lightly_active',
      pace,
      obstacles: selectedAccomplishments,
      dietaryPreference: dietaryPreference === 'Other' ? (customDietText || 'Custom') : dietaryPreference,
      medicalConditions: selectedConditions,
      healthDeepDive: dd,
      calculatedPlan: finalPlan,
      preferences: userPrefs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const registeredAccount: UserAccount = {
      uid: initialAccount?.uid || 'usr_' + Date.now(),
      email: finalEmail,
      displayName: finalName,
      phoneNumber: finalPhone,
      authProvider: initialAccount?.authProvider || 'email',
      supabaseSynced: true,
      isPro: trialTier === '3_day',
      proPlanType: trialTier === '3_day' ? 'trial_3day' : undefined,
      proExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };

    onComplete(profile, registeredAccount);
  };

  // Pure Light Mode Card & Button Classes
  const cardClass = 'bg-white border border-zinc-200 shadow-sm';
  const itemActive = 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-md shadow-emerald-600/20';
  const itemInactive = 'bg-white border-zinc-200 text-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-50/20';

  // Age Items for Drum Wheel (14 to 90 years)
  const ageItems = Array.from({ length: 77 }, (_, i) => {
    const a = 14 + i;
    return {
      label: `${a}`,
      value: a,
      sublabel: a < 25 ? 'Prime' : a < 45 ? 'Optimal' : a < 65 ? 'Active' : 'Longevity',
    };
  });

  // Day, Month, Year Items for DOB Wheel
  const dayItems = Array.from({ length: 31 }, (_, i) => ({ label: `${i + 1}`, value: i + 1 }));
  const monthItems = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => ({ label: m, value: i + 1 }));
  const yearItems = Array.from({ length: 75 }, (_, i) => {
    const y = currentYear - 14 - i;
    return { label: `${y}`, value: y };
  });

  // Feet & Inches items
  const feetItems = [3, 4, 5, 6, 7].map((f) => ({ label: `${f}`, value: f, sublabel: 'ft' }));
  const inchItems = Array.from({ length: 12 }, (_, i) => ({ label: `${i}`, value: i, sublabel: 'in' }));

  // ---- Small reusable helpers for the Health Deep-Dive steps (same visual language as rest of form) ----
  const DDHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <h2 className="text-2xl font-black text-zinc-950">{title}</h2>
      <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
    </div>
  );

  const DDYesNo = ({
    value, onChange, options,
  }: { value: string; onChange: (v: string) => void; options?: { id: string; label: string }[] }) => (
    <div className="grid grid-cols-2 gap-2.5">
      {(options || [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]).map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => { playClickSound(700); onChange(o.id); }}
          className={`py-3.5 rounded-2xl border font-black text-xs transition-all ${value === o.id ? itemActive : itemInactive}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const DDChips = ({
    options, selected, onToggle, columns = 2,
  }: { options: string[]; selected: string[]; onToggle: (v: string) => void; columns?: 1 | 2 }) => (
    <div className={`grid ${columns === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5`}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`p-3 rounded-2xl flex items-center justify-between border font-bold text-left transition-all ${isSelected ? itemActive : itemInactive}`}
          >
            <span className="text-[11px] font-extrabold leading-tight">{opt}</span>
            <div className={`w-4 h-4 shrink-0 ml-2 rounded-md border flex items-center justify-center ${isSelected ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
          </button>
        );
      })}
    </div>
  );

  const DDInput = ({
    label, value, onChange, placeholder, type = 'text',
  }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-xs font-bold text-zinc-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
      />
    </div>
  );

  const DDTextArea = ({
    label, value, onChange, placeholder,
  }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-bold text-zinc-700 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs resize-none"
      />
    </div>
  );

  const DDContinue = ({ label = 'Continue' }: { label?: string }) => (
    <button
      type="button"
      onClick={nextStep}
      className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer active:scale-98 transition-all"
    >
      <span>{label}</span>
      <ArrowRight className="w-4 h-4" />
    </button>
  );

  return (
    <div id="yourcare-onboarding-root" className="w-full min-h-screen bg-[#F8FAFC] text-zinc-900 flex flex-col justify-between py-6 px-4 sm:px-8">
      
      {/* TOP HEADER */}
      <header className="w-full max-w-xl mx-auto flex items-center justify-between mb-4">
        {/* Brand Logo */}
        <Logo size="md" />

        {/* Header Controls */}
        <div className="flex items-center gap-2">
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="p-2 rounded-xl text-xs font-bold flex items-center gap-1 bg-white text-zinc-600 hover:text-black border border-zinc-200 shadow-xs"
              title="Admin Portal"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </button>
          )}

          {/* Language Switch */}
          <div className="flex items-center gap-1 rounded-xl p-1 text-xs bg-white border border-zinc-200 shadow-xs">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${lang === 'en' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('hi')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${lang === 'hi' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </header>

      {/* Progress Bar (During questionnaire) */}
      {currentStep > 0 && currentStep < 25 && (
        <div className="w-full max-w-xl mx-auto mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 mb-1.5">
            <span>{t.stepOf || 'Step'} {currentStep} {t.of || 'of'} {TOTAL_QUESTIONS_COUNT}</span>
            <span className="text-emerald-600 font-extrabold">{Math.round((currentStep / TOTAL_QUESTIONS_COUNT) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-zinc-200">
            <div 
              className="h-full bg-emerald-600 rounded-full transition-all duration-300 ease-out shadow-xs"
              style={{ width: `${(currentStep / TOTAL_QUESTIONS_COUNT) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* MAIN STEP CONTENT */}
      <main className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-center my-2">
        <AnimatePresence mode="wait">

          {/* STEP 0: WELCOME HERO */}
          {currentStep === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-center py-4"
            >
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>India's #1 Metabolic & Calorie Coach</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                  Get <span className="text-emerald-600">Healthified</span> with UrCare
                </h1>
                <p className="text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
                  Join over 35 million users who transformed their metabolic health, reversed pre-diabetes, and achieved sustainable fat loss.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left pt-2">
                <div className={`p-4 rounded-2xl ${cardClass}`}>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-extrabold text-zinc-900">Instant Calorie AI</div>
                  <p className="text-xs text-zinc-500 mt-0.5">Automated meal tracking with clinical macro splits.</p>
                </div>

                <div className={`p-4 rounded-2xl ${cardClass}`}>
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-2 font-bold">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-extrabold text-zinc-900">Doctor Supervision</div>
                  <p className="text-xs text-zinc-500 mt-0.5">Continuous clinical biomarker and lab review.</p>
                </div>
              </div>

              <div className="pt-4 flex flex-col items-center gap-3">
                <button
                  id="yourcare-start-onboarding-btn"
                  type="button"
                  onClick={nextStep}
                  className="w-full max-w-md py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-base transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Begin Personal Onboarding</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <p className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Free 3-Day Precision Trial • Instant Calibration</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 1: GENDER */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">{t.genderTitle || 'What is your biological sex?'}</h2>
                <p className="text-xs text-zinc-500 mt-1">{t.genderSubtitle || 'We calibrate your baseline BMR and hormonal balance based on this.'}</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'male', title: 'Male', desc: 'Higher baseline lean muscle ratio & BMR' },
                  { id: 'female', title: 'Female', desc: 'Hormonal and cyclical metabolic rhythm' },
                  { id: 'other', title: 'Other / Prefer not to say', desc: 'Standardized balanced metabolic baseline' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGender(g.id as GenderType);
                      setTimeout(nextStep, 180);
                    }}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between border font-bold text-left transition-all ${
                      gender === g.id ? itemActive : itemInactive
                    }`}
                  >
                    <div>
                      <div className="text-base font-extrabold">{g.title}</div>
                      <div className="text-xs opacity-75 mt-0.5">{g.desc}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${gender === g.id ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
                      {gender === g.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2: PRIMARY GOAL */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">What is your primary goal?</h2>
                <p className="text-xs text-zinc-500 mt-1">UrCare AI tailors your daily calorie deficit and macro targets accordingly.</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'lose_weight', title: 'Lose Weight & Burn Fat', desc: 'Caloric deficit with high-protein satiety' },
                  { id: 'build_muscle', title: 'Build Lean Muscle & Tone', desc: 'Hypertrophy macro split with progressive reload' },
                  { id: 'maintain_weight', title: 'Maintain Weight & Stay Fit', desc: 'Iso-caloric metabolic balance and sustained energy' },
                  { id: 'health_wellness', title: 'Manage Blood Sugar & Vitality', desc: 'Low glycemic index focus with insulin optimization' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGoal(g.id as GoalType);
                      setTimeout(nextStep, 180);
                    }}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between border font-bold text-left transition-all ${
                      goal === g.id ? itemActive : itemInactive
                    }`}
                  >
                    <div>
                      <div className="text-base font-extrabold">{g.title}</div>
                      <div className="text-xs opacity-75 mt-0.5">{g.desc}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${goal === g.id ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
                      {goal === g.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 3: TARGET FOCUS AREAS */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">Select your focus areas</h2>
                <p className="text-xs text-zinc-500 mt-1">Choose the key health domains you want UrCare to focus on.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'belly', label: 'Belly Fat Reduction', icon: Flame },
                  { id: 'energy', label: 'All-Day Energy & Stamina', icon: Zap },
                  { id: 'muscle', label: 'Upper Body & Arms Toning', icon: Dumbbell },
                  { id: 'thighs', label: 'Legs & Core Strength', icon: Activity },
                  { id: 'sleep', label: 'Deep Sleep & Recovery', icon: Moon },
                  { id: 'stress', label: 'Cortisol & Stress Balance', icon: Heart },
                ].map((item) => {
                  const isSelected = selectedAccomplishments.includes(item.id);
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleAccomplishment(item.id)}
                      className={`p-4 rounded-2xl flex items-center justify-between border font-bold text-left transition-all ${
                        isSelected ? itemActive : itemInactive
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <ItemIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                        <span className="text-xs font-black">{item.label}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 4: ACTIVITY LEVEL */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">{t.workoutTitle || 'How active are you?'}</h2>
                <p className="text-xs text-zinc-500 mt-1">{t.workoutSubtitle || 'This determines your daily non-exercise activity thermogenesis (NEAT).'}</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: '0-2', title: 'Sedentary / Light (0-2 workouts/wk)', desc: 'Desk job, < 5,000 steps daily' },
                  { id: '3-5', title: 'Moderately Active (3-5 workouts/wk)', desc: 'Active routine, 7,000 - 10,000 steps daily' },
                  { id: '6+', title: 'Very Active (6+ workouts/wk)', desc: 'Intense training, athlete or high physical work' },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setWorkoutsPerWeek(w.id as any);
                      setTimeout(nextStep, 180);
                    }}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between border font-bold text-left transition-all ${
                      workoutsPerWeek === w.id ? itemActive : itemInactive
                    }`}
                  >
                    <div>
                      <div className="text-base font-extrabold">{w.title}</div>
                      <div className="text-xs opacity-75 mt-0.5">{w.desc}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${workoutsPerWeek === w.id ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
                      {workoutsPerWeek === w.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 5: AGE WHEEL PICKER */}
          {currentStep === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">How old are you?</h2>
                <p className="text-xs text-zinc-500 mt-1">Scroll the age wheel picker to select your exact age.</p>
              </div>

              {/* Mode Toggle: Direct Age vs DOB */}
              <div className="flex items-center justify-center gap-2 p-1 rounded-2xl bg-zinc-100 border border-zinc-200 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setAgePickerMode('direct_age')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    agePickerMode === 'direct_age' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Age Wheel
                </button>
                <button
                  type="button"
                  onClick={() => setAgePickerMode('dob')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    agePickerMode === 'dob' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Date of Birth
                </button>
              </div>

              {/* DIRECT AGE WHEEL PICKER */}
              {agePickerMode === 'direct_age' ? (
                <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                  <div className="text-center">
                    <span className="text-xs text-zinc-400 uppercase font-black tracking-wider">Selected Age</span>
                    <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
                      <span className="text-4xl font-black text-emerald-600">{age}</span>
                      <span className="text-sm font-bold text-zinc-500">Years Old</span>
                    </div>
                  </div>

                  {/* Vertical Drum Wheel Picker */}
                  <WheelPicker
                    items={ageItems}
                    value={age}
                    onChange={(val) => setAge(Number(val))}
                    unit="yrs"
                    visibleCount={5}
                    itemHeight={46}
                    isDark={false}
                    className="py-2"
                  />

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-center text-emerald-800">
                    {age < 30 ? '🔥 High Metabolic Elasticity Zone' : age < 50 ? '⚡ Optimized Nutrient Partitioning' : '🌿 Longevity & Metabolic Preservation Focus'}
                  </div>
                </div>
              ) : (
                /* DOB TRIPLE DRUM WHEEL PICKERS */
                <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                  <div className="text-center">
                    <span className="text-xs text-zinc-400 uppercase font-black tracking-wider">Calculated Age</span>
                    <div className="text-3xl font-black text-emerald-600">{finalAge} Years Old</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Day */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 text-center mb-1">DAY</span>
                      <WheelPicker
                        items={dayItems}
                        value={birthDay}
                        onChange={(val) => setBirthDay(Number(val))}
                        visibleCount={3}
                        itemHeight={40}
                        isDark={false}
                      />
                    </div>
                    {/* Month */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 text-center mb-1">MONTH</span>
                      <WheelPicker
                        items={monthItems}
                        value={birthMonth}
                        onChange={(val) => setBirthMonth(Number(val))}
                        visibleCount={3}
                        itemHeight={40}
                        isDark={false}
                      />
                    </div>
                    {/* Year */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 text-center mb-1">YEAR</span>
                      <WheelPicker
                        items={yearItems}
                        value={birthYear}
                        onChange={(val) => setBirthYear(Number(val))}
                        visibleCount={3}
                        itemHeight={40}
                        isDark={false}
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 6: HEIGHT WHEEL & RULER PICKER (CM & FT/IN) */}
          {currentStep === 6 && (
            <motion.div
              key="step-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">What is your height?</h2>
                <p className="text-xs text-zinc-500 mt-1">Scroll the interactive ruler dial or use wheel pickers.</p>
              </div>

              {/* Unit Toggle */}
              <div className="flex items-center justify-center gap-2 p-1 rounded-2xl bg-zinc-100 border border-zinc-200 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setHeightUnit('cm')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    heightUnit === 'cm' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Centimeters (cm)
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit('ft')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    heightUnit === 'ft' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Feet & Inches (ft/in)
                </button>
              </div>

              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                {heightUnit === 'cm' ? (
                  /* CM HORIZONTAL RULER WHEEL */
                  <div className="space-y-4">
                    <RulerWheelPicker
                      min={120}
                      max={225}
                      step={1}
                      majorStep={5}
                      mediumStep={1}
                      value={heightCm}
                      onChange={(val) => updateHeightFromCm(val)}
                      unit="cm"
                      isDark={false}
                    />
                    <div className="text-center text-xs text-zinc-500 font-semibold">
                      Equivalent to <strong className="text-emerald-600 font-black">{heightFeet} ft {heightInches} in</strong>
                    </div>
                  </div>
                ) : (
                  /* FT & IN DUAL DRUM WHEELS */
                  <div className="space-y-4">
                    <div className="text-center pb-2">
                      <span className="text-xs text-zinc-400 uppercase font-black">Selected Stature</span>
                      <div className="text-3xl font-black text-emerald-600">
                        {heightFeet} ft {heightInches} in <span className="text-sm font-semibold text-zinc-400">({heightCm} cm)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-black text-zinc-400 text-center mb-1">FEET</span>
                        <WheelPicker
                          items={feetItems}
                          value={heightFeet}
                          onChange={(val) => updateHeightFromFtIn(Number(val), heightInches)}
                          visibleCount={3}
                          itemHeight={44}
                          isDark={false}
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-black text-zinc-400 text-center mb-1">INCHES</span>
                        <WheelPicker
                          items={inchItems}
                          value={heightInches}
                          onChange={(val) => updateHeightFromFtIn(heightFeet, Number(val))}
                          visibleCount={3}
                          itemHeight={44}
                          isDark={false}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 7: CURRENT WEIGHT WHEEL & RULER */}
          {currentStep === 7 && (
            <motion.div
              key="step-7"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">What is your current weight?</h2>
                <p className="text-xs text-zinc-500 mt-1">Scroll the ruler to set your weight and see your live BMI index.</p>
              </div>

              {/* Unit Toggle */}
              <div className="flex items-center justify-center gap-2 p-1 rounded-2xl bg-zinc-100 border border-zinc-200 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setWeightUnit('kg')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    weightUnit === 'kg' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Kilograms (kg)
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit('lbs')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    weightUnit === 'lbs' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Pounds (lbs)
                </button>
              </div>

              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                {weightUnit === 'kg' ? (
                  <RulerWheelPicker
                    min={35}
                    max={180}
                    step={0.5}
                    majorStep={5}
                    mediumStep={1}
                    decimals={1}
                    value={currentWeightKg}
                    onChange={(val) => updateCurrentWeightKg(val)}
                    unit="kg"
                    isDark={false}
                  />
                ) : (
                  <RulerWheelPicker
                    min={75}
                    max={395}
                    step={1}
                    majorStep={10}
                    mediumStep={5}
                    decimals={0}
                    value={currentWeightLbs}
                    onChange={(val) => updateCurrentWeightLbs(val)}
                    unit="lbs"
                    isDark={false}
                  />
                )}

                {/* Real-time Dynamic BMI Gauge Card */}
                <div className="p-4 rounded-2xl border bg-zinc-50 border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-zinc-700">Calculated BMI Index</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-black text-emerald-600">{bmi}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy Optimal' : bmi < 30 ? 'Overweight' : 'Obese'}
                      </span>
                    </div>
                  </div>

                  {/* Visual BMI Bar */}
                  <div className="w-full h-2 rounded-full bg-zinc-200 flex overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '18.5%' }} title="Underweight (< 18.5)" />
                    <div className="h-full bg-emerald-500" style={{ width: '25%' }} title="Normal (18.5 - 24.9)" />
                    <div className="h-full bg-amber-500" style={{ width: '25%' }} title="Overweight (25.0 - 29.9)" />
                    <div className="h-full bg-rose-500" style={{ width: '31.5%' }} title="Obese (30.0+)" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 8: TARGET WEIGHT WHEEL & RULER PICKER */}
          {currentStep === 8 && (
            <motion.div
              key="step-8"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">What is your target weight?</h2>
                <p className="text-xs text-zinc-500 mt-1">Select your desired goal weight and weekly target pace.</p>
              </div>

              {/* Unit Toggle */}
              <div className="flex items-center justify-center gap-2 p-1 rounded-2xl bg-zinc-100 border border-zinc-200 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => setTargetWeightUnit('kg')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    targetWeightUnit === 'kg' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Kilograms (kg)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetWeightUnit('lbs')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    targetWeightUnit === 'lbs' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Pounds (lbs)
                </button>
              </div>

              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                {targetWeightUnit === 'kg' ? (
                  <RulerWheelPicker
                    min={35}
                    max={180}
                    step={0.5}
                    majorStep={5}
                    mediumStep={1}
                    decimals={1}
                    value={targetWeightKg}
                    onChange={(val) => updateTargetWeightKg(val)}
                    unit="kg"
                    isDark={false}
                  />
                ) : (
                  <RulerWheelPicker
                    min={75}
                    max={395}
                    step={1}
                    majorStep={10}
                    mediumStep={5}
                    decimals={0}
                    value={targetWeightLbs}
                    onChange={(val) => updateTargetWeightLbs(val)}
                    unit="lbs"
                    isDark={false}
                  />
                )}

                {/* Weight Difference & Projected Pace */}
                <div className="p-4 rounded-2xl border bg-zinc-50 border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-extrabold text-zinc-700">
                    <span>Required Transformation</span>
                    <span className="text-emerald-600 font-black text-sm">
                      {isLosing ? `${weightDiff} kg (Fat Loss)` : `+${weightDiff} kg (Muscle Gain)`}
                    </span>
                  </div>

                  {/* Pace Selector */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'relaxed', label: 'Relaxed', rate: '0.25 kg/wk' },
                      { id: 'steady', label: 'Recommended', rate: '0.5 kg/wk' },
                      { id: 'aggressive', label: 'Aggressive', rate: '0.75 kg/wk' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPace(p.id as GoalPace)}
                        className={`p-2 rounded-xl text-center border font-bold transition-all ${
                          pace === p.id 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                            : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <div className="text-xs font-black">{p.label}</div>
                        <div className="text-[10px] opacity-80">{p.rate}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 9: DIETARY PREFERENCE */}
          {currentStep === 9 && (
            <motion.div
              key="step-9"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">Dietary Preferences</h2>
                <p className="text-xs text-zinc-500 mt-1">We customize all meal recommendations and macros to match your lifestyle.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  'Vegetarian',
                  'Eggetarian',
                  'Non-Vegetarian',
                  'Vegan',
                  'Jain',
                  'Keto / Low-Carb',
                  'Gluten-Free',
                  'Other',
                ].map((diet) => (
                  <button
                    key={diet}
                    type="button"
                    onClick={() => setDietaryPreference(diet)}
                    className={`p-4 rounded-2xl border font-bold text-center transition-all ${
                      dietaryPreference === diet ? itemActive : itemInactive
                    }`}
                  >
                    <span className="text-xs font-black">{diet}</span>
                  </button>
                ))}
              </div>

              {dietaryPreference === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify your dietary guidelines (e.g. Dairy-free, Halal)..."
                  value={customDietText}
                  onChange={(e) => setCustomDietText(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
                />
              )}

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 10: MEDICAL & HEALTH CONDITIONS */}
          {currentStep === 10 && (
            <motion.div
              key="step-10"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">Medical & Health Profile</h2>
                <p className="text-xs text-zinc-500 mt-1">Our clinical AI algorithm adjusts micronutrient and glycemic limits for your health.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'None',
                  'Diabetes / Pre-Diabetes',
                  'Thyroid (Hypo/Hyper)',
                  'PCOS / PCOD',
                  'High Blood Pressure',
                  'High Cholesterol / Fatty Liver',
                  'Uric Acid / Gout',
                  'Digestive / IBS',
                ].map((cond) => {
                  const isSelected = selectedConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleCondition(cond)}
                      className={`p-3.5 rounded-2xl flex items-center justify-between border font-bold text-left transition-all ${
                        isSelected ? itemActive : itemInactive
                      }`}
                    >
                      <span className="text-xs font-extrabold">{cond}</span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 11: MEDICINES, INSULIN & SUPPLEMENTS */}
          {currentStep === 11 && (
            <motion.div key="step-11" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Medicines & Supplements" subtitle="Tell us what you are currently taking, so our clinical AI never conflicts with your prescriptions." />

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">Are you currently taking any medicines?</span>
                  <DDYesNo value={dd.onMedicines} onChange={(v) => setDdField('onMedicines', v as YesNo)} />
                  {dd.onMedicines === 'yes' && (
                    <DDTextArea label="List each medicine, dose, timing & since when" value={dd.medicinesText} onChange={(v) => setDdField('medicinesText', v)} placeholder="e.g. Metformin 500mg, twice daily, since 2022" />
                  )}
                </div>

                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">Are you taking insulin?</span>
                  <DDYesNo value={dd.onInsulin} onChange={(v) => setDdField('onInsulin', v as YesNo)} />
                  {dd.onInsulin === 'yes' && (
                    <DDTextArea label="Insulin type, units & timing (basal / mealtime)" value={dd.insulinDetails} onChange={(v) => setDdField('insulinDetails', v)} placeholder="e.g. Basal 12 units at night, rapid-acting 6 units before meals" />
                  )}
                </div>

                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">Any vitamins, supplements, herbal or Ayurvedic medicines?</span>
                  <DDYesNo value={dd.onSupplements} onChange={(v) => setDdField('onSupplements', v as YesNo)} />
                  {dd.onSupplements === 'yes' && (
                    <DDTextArea label="Name, dose & frequency" value={dd.supplementsText} onChange={(v) => setDdField('supplementsText', v)} placeholder="e.g. Vitamin D3 60K weekly, Ashwagandha daily" />
                  )}
                </div>
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 12: ALLERGIES */}
          {currentStep === 12 && (
            <motion.div key="step-12" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Allergies" subtitle="This keeps your meal plan and any recommended medicines safe." />

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">Medicine allergies?</span>
                  <DDYesNo value={dd.medicineAllergy} onChange={(v) => setDdField('medicineAllergy', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'not_sure', label: 'Not sure' }]} />
                </div>
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">Food allergies?</span>
                  <DDYesNo value={dd.foodAllergy} onChange={(v) => setDdField('foodAllergy', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'not_sure', label: 'Not sure' }]} />
                </div>
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">Environmental allergies?</span>
                  <DDYesNo value={dd.envAllergy} onChange={(v) => setDdField('envAllergy', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'not_sure', label: 'Not sure' }]} />
                </div>
                {(dd.medicineAllergy === 'yes' || dd.foodAllergy === 'yes' || dd.envAllergy === 'yes') && (
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">What reaction have you experienced?</span>
                    <DDChips options={['Rash', 'Swelling', 'Breathing difficulty', 'Stomach problems', 'Other']} selected={dd.allergyReactions} onToggle={(v) => toggleDdItem('allergyReactions', v)} />
                  </div>
                )}
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 13: BLOOD SUGAR, BP & VITALS */}
          {currentStep === 13 && (
            <motion.div key="step-13" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Blood Sugar, BP & Vitals" subtitle="Recent readings help us calibrate your glycemic and cardiovascular limits precisely." />

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                <span className="text-xs font-black text-zinc-800">Do you monitor your blood sugar?</span>
                <DDYesNo value={dd.monitorsSugar} onChange={(v) => setDdField('monitorsSugar', v as YesNo)} />

                {dd.monitorsSugar === 'yes' && (
                  <div className="grid grid-cols-2 gap-3">
                    <DDInput label="Avg. Fasting Sugar (mg/dL)" value={dd.fastingSugar} onChange={(v) => setDdField('fastingSugar', v)} placeholder="e.g. 110" />
                    <DDInput label="Avg. Post-Meal Sugar (mg/dL)" value={dd.postMealSugar} onChange={(v) => setDdField('postMealSugar', v)} placeholder="e.g. 160" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <DDInput label="Latest HbA1c (%)" value={dd.hba1c} onChange={(v) => setDdField('hba1c', v)} placeholder="e.g. 6.2" />
                  <DDInput label="Latest Blood Pressure" value={dd.bloodPressure} onChange={(v) => setDdField('bloodPressure', v)} placeholder="e.g. 120/80" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DDInput label="Resting Heart Rate (BPM)" value={dd.restingHeartRate} onChange={(v) => setDdField('restingHeartRate', v)} placeholder="e.g. 74" />
                  <DDInput label="Other labs (optional)" value={dd.otherLabValues} onChange={(v) => setDdField('otherLabValues', v)} placeholder="Creatinine, eGFR, uric acid..." />
                </div>
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 14: SLEEP PROFILE */}
          {currentStep === 14 && (
            <motion.div key="step-14" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Sleep Profile" subtitle="Sleep quality directly impacts your cortisol, hunger hormones and recovery." />

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                <div className="grid grid-cols-2 gap-3">
                  <DDInput label="Usual sleep time" value={dd.sleepTime} onChange={(v) => setDdField('sleepTime', v)} placeholder="e.g. 11:30 PM" />
                  <DDInput label="Usual wake time" value={dd.wakeTime} onChange={(v) => setDdField('wakeTime', v)} placeholder="e.g. 7:00 AM" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black text-zinc-800">How many hours do you sleep?</span>
                  <DDChips options={['Less than 5', '5–6', '6–7', '7–8', '8–9', 'More than 9']} selected={dd.sleepHours ? [dd.sleepHours] : []} onToggle={(v) => setDdField('sleepHours', v)} />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black text-zinc-800">How would you rate your sleep?</span>
                  <DDChips options={['Good', 'Average', 'Poor', 'Very poor']} selected={dd.sleepQuality ? [dd.sleepQuality] : []} onToggle={(v) => setDdField('sleepQuality', v)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Do you snore?</span>
                    <DDYesNo value={dd.snoring} onChange={(v) => setDdField('snoring', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Diagnosed sleep apnea?</span>
                    <DDYesNo value={dd.sleepApnea} onChange={(v) => setDdField('sleepApnea', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
                  </div>
                </div>
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 15: STRESS & EMOTIONAL WELLBEING */}
          {currentStep === 15 && (
            <motion.div key="step-15" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Stress & Emotional Wellbeing" subtitle="Chronic stress affects cortisol, sleep and blood sugar — help us understand yours." />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">How would you rate your current stress?</span>
                <DDChips options={['Low', 'Moderate', 'High', 'Overwhelming']} selected={dd.stressLevel ? [dd.stressLevel] : []} onToggle={(v) => setDdField('stressLevel', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Main sources of stress</span>
                <DDChips options={['Work', 'Family', 'Financial', 'Relationship', 'Health', 'Studies', 'Sleep', 'Other']} selected={dd.stressSources} onToggle={(v) => toggleDdItem('stressSources', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Emotional symptoms you currently experience</span>
                <DDChips options={['Constant worry', 'Racing thoughts', 'Difficulty relaxing', 'Sadness/low mood', 'Low motivation', 'None']} selected={dd.emotionalSymptoms} onToggle={(v) => toggleDdItem('emotionalSymptoms', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">How do you usually manage stress?</span>
                <DDChips options={['Exercise', 'Meditation/Yoga', 'Talking to someone', 'Music', 'Sleep', 'Nothing currently']} selected={dd.stressManagement} onToggle={(v) => toggleDdItem('stressManagement', v)} />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 16: GUT & DIGESTION */}
          {currentStep === 16 && (
            <motion.div key="step-16" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Gut & Digestion" subtitle="Digestive health affects nutrient absorption and our meal timing recommendations." />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Bowel movement frequency</span>
                <DDChips options={['Less than once/day', 'Once/day', '2 times/day', 'More than 2/day', 'Irregular']} selected={dd.bowelFrequency ? [dd.bowelFrequency] : []} onToggle={(v) => setDdField('bowelFrequency', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Usual stool type</span>
                <DDChips options={['Normal', 'Hard', 'Loose', 'Watery', 'Alternating']} selected={dd.stoolType ? [dd.stoolType] : []} onToggle={(v) => setDdField('stoolType', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Digestive symptoms</span>
                <DDChips options={['Constipation', 'Loose motions', 'Acidity/heartburn', 'Bloating/gas', 'Nausea', 'None']} selected={dd.digestiveSymptoms} onToggle={(v) => toggleDdItem('digestiveSymptoms', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Diagnosed digestive conditions</span>
                <DDChips options={['IBS', 'GERD', 'Gastritis', 'Ulcer', 'Lactose intolerance', 'None']} selected={dd.digestiveConditions} onToggle={(v) => toggleDdItem('digestiveConditions', v)} />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 17: LIFESTYLE HABITS */}
          {currentStep === 17 && (
            <motion.div key="step-17" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Lifestyle Habits" subtitle="Alcohol, tobacco, hydration and screen time all factor into your metabolic plan." />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Alcohol consumption</span>
                <DDChips options={['Never', 'Occasionally', 'Weekly', 'Daily', 'Previously used, stopped']} selected={dd.alcohol ? [dd.alcohol] : []} onToggle={(v) => setDdField('alcohol', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Smoking / tobacco use</span>
                <DDChips options={['Never', 'Occasionally', 'Daily', 'Previously used, stopped']} selected={dd.tobacco ? [dd.tobacco] : []} onToggle={(v) => setDdField('tobacco', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Daily water intake</span>
                <DDChips options={['Less than 1 L', '1–2 L', '2–3 L', 'More than 3 L']} selected={dd.waterIntake ? [dd.waterIntake] : []} onToggle={(v) => setDdField('waterIntake', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Tea / coffee per day</span>
                <DDChips options={['None', '1 cup', '2 cups', '3+ cups']} selected={dd.teaCoffee ? [dd.teaCoffee] : []} onToggle={(v) => setDdField('teaCoffee', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">How often do you eat fried food?</span>
                <DDChips options={['Rarely', '1–2 times/week', '3–4 times/week', 'Daily']} selected={dd.friedFoodFreq ? [dd.friedFoodFreq] : []} onToggle={(v) => setDdField('friedFoodFreq', v)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DDInput label="Daily screen time (hrs)" value={dd.screenTimeHours} onChange={(v) => setDdField('screenTimeHours', v)} placeholder="e.g. 6" />
                <DDInput label="Daily sitting hours" value={dd.sittingHours} onChange={(v) => setDdField('sittingHours', v)} placeholder="e.g. 8" />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 18: FAMILY HISTORY */}
          {currentStep === 18 && (
            <motion.div key="step-18" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Family History" subtitle="Genetic predisposition helps us flag risks earlier and personalize prevention." />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Does anyone in your family have these conditions?</span>
                <DDChips
                  options={['Diabetes', 'High BP', 'Heart disease', 'Thyroid disease', 'PCOS/PCOD', 'High cholesterol', 'Obesity', 'Cancer', 'Kidney disease', 'Mental health condition', 'No known history']}
                  selected={dd.familyHistory}
                  onToggle={(v) => toggleDdItem('familyHistory', v)}
                />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 19: GENDER-SPECIFIC HEALTH */}
          {currentStep === 19 && (
            <motion.div key="step-19" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              {gender === 'female' ? (
                <>
                  <DDHeader title="Women's Health" subtitle="Hormonal and reproductive health context for your personalized plan." />
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Menstrual status</span>
                    <DDChips options={['Regular periods', 'Irregular periods', 'Menopause', 'Post-menopause']} selected={dd.menstrualStatus ? [dd.menstrualStatus] : []} onToggle={(v) => setDdField('menstrualStatus', v)} />
                  </div>
                  {(dd.menstrualStatus === 'Regular periods' || dd.menstrualStatus === 'Irregular periods') && (
                    <DDInput label="Average cycle length (days)" value={dd.cycleLength} onChange={(v) => setDdField('cycleLength', v)} placeholder="e.g. 28" />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <span className="text-xs font-black text-zinc-800">Diagnosed with PCOS/PCOD?</span>
                      <DDYesNo value={dd.pcos} onChange={(v) => setDdField('pcos', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'not_sure', label: 'Not sure' }]} />
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-black text-zinc-800">Currently pregnant?</span>
                      <DDYesNo value={dd.pregnant} onChange={(v) => setDdField('pregnant', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'not_sure', label: 'Not sure' }]} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Menopause/perimenopause symptoms (if any)</span>
                    <DDChips options={['Hot flashes', 'Night sweats', 'Mood changes', 'Weight gain', 'None']} selected={dd.menopauseSymptoms} onToggle={(v) => toggleDdItem('menopauseSymptoms', v)} />
                  </div>
                </>
              ) : (
                <>
                  <DDHeader title="Men's Hormonal Health" subtitle="Energy, muscle mass and hormonal balance context for your personalized plan." />
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Energy throughout the day</span>
                    <DDChips options={['Very low', 'Low', 'Moderate', 'Good', 'Excellent']} selected={dd.energyLevel ? [dd.energyLevel] : []} onToggle={(v) => setDdField('energyLevel', v)} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Libido / sexual drive</span>
                    <DDChips options={['Very low', 'Low', 'Normal', 'High', 'Prefer not to answer']} selected={dd.libido ? [dd.libido] : []} onToggle={(v) => setDdField('libido', v)} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Diagnosed with low testosterone or hormonal problem?</span>
                    <DDYesNo value={dd.lowTestosterone} onChange={(v) => setDdField('lowTestosterone', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'not_sure', label: 'Not sure' }]} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">Prostate / urination symptoms</span>
                    <DDChips options={['Frequent urination', 'Difficulty urinating', 'Enlarged prostate diagnosed', 'None']} selected={dd.prostateSymptoms} onToggle={(v) => toggleDdItem('prostateSymptoms', v)} />
                  </div>
                </>
              )}

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 20: SYMPTOMS, READINESS & PERSONALIZATION */}
          {currentStep === 20 && (
            <motion.div key="step-20" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title="Symptoms, Readiness & Notes" subtitle="A final check on how you feel day-to-day, and anything the doctor should know." />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Any of these symptoms bothering you?</span>
                <DDChips
                  options={['Tingling/numbness in hands or feet', 'Blurry vision', 'Swelling in feet/legs', 'Chest pain/breathlessness', 'Joint pain/stiffness', 'Headaches/brain fog', 'Skin dryness/dark patches', 'None']}
                  selected={dd.organSymptoms}
                  onToggle={(v) => toggleDdItem('organSymptoms', v)}
                />
              </div>

              <DDInput label="Biggest thing stopping you from improving your health" value={dd.biggestBarrier} onChange={(v) => setDdField('biggestBarrier', v)} placeholder="e.g. Lack of time, no motivation..." />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">What would help you the most?</span>
                <DDChips options={['Simple meal plans', 'Quick home workouts', 'Daily accountability', 'Flexible timings', 'Health education', 'Stress management']} selected={dd.helpNeeded} onToggle={(v) => toggleDdItem('helpNeeded', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">Are you currently seeing another doctor/specialist?</span>
                <DDYesNo value={dd.seeingSpecialist} onChange={(v) => setDdField('seeingSpecialist', v as YesNo)} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
                {dd.seeingSpecialist === 'yes' && (
                  <DDInput label="Specialist & condition being treated" value={dd.specialistDetails} onChange={(v) => setDdField('specialistDetails', v)} placeholder="e.g. Endocrinologist, thyroid management" />
                )}
              </div>

              <DDTextArea label="Anything specific you want the doctor/health team to know? (optional)" value={dd.doctorNotes} onChange={(v) => setDdField('doctorNotes', v)} placeholder="Food preferences, medicine concerns, work timings, budget, family situation..." />

              <DDContinue label="Continue to Profile" />
            </motion.div>
          )}

          {/* STEP 21: USER CONTACT & PROFILE REVIEW */}
          {currentStep === 21 && (
            <motion.div
              key="step-21"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">Confirm Your Profile</h2>
                <p className="text-xs text-zinc-500 mt-1">We will send your daily nutrition reports and physician sync alerts here.</p>
              </div>

              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                {/* 1. Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black text-zinc-800">
                      Full Name <span className="text-rose-600 font-black">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Mandatory
                    </span>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (contactErrors.name) setContactErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. Rahul Sharma"
                    className={`w-full p-3.5 rounded-xl border text-zinc-900 text-xs font-medium outline-none shadow-xs transition-all ${
                      contactErrors.name 
                        ? 'border-rose-500 bg-rose-50/50 focus:border-rose-600 ring-2 ring-rose-500/20' 
                        : 'border-zinc-200 bg-zinc-50 focus:bg-white focus:border-emerald-600'
                    }`}
                  />
                  {contactErrors.name && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{contactErrors.name}</span>
                    </div>
                  )}
                </div>

                {/* 2. Email Address */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black text-zinc-800">
                      Email Address <span className="text-rose-600 font-black">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Mandatory
                    </span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (contactErrors.email) setContactErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="e.g. rahul@gmail.com"
                    className={`w-full p-3.5 rounded-xl border text-zinc-900 text-xs font-medium outline-none shadow-xs transition-all ${
                      contactErrors.email 
                        ? 'border-rose-500 bg-rose-50/50 focus:border-rose-600 ring-2 ring-rose-500/20' 
                        : 'border-zinc-200 bg-zinc-50 focus:bg-white focus:border-emerald-600'
                    }`}
                  />
                  {contactErrors.email && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{contactErrors.email}</span>
                    </div>
                  )}
                </div>

                {/* 3. Phone Number */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black text-zinc-800">
                      Phone Number (WhatsApp Sync) <span className="text-rose-600 font-black">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      Mandatory
                    </span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (contactErrors.phone) setContactErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder="+91 98765 43210"
                    className={`w-full p-3.5 rounded-xl border text-zinc-900 text-xs font-medium outline-none shadow-xs transition-all ${
                      contactErrors.phone 
                        ? 'border-rose-500 bg-rose-50/50 focus:border-rose-600 ring-2 ring-rose-500/20' 
                        : 'border-zinc-200 bg-zinc-50 focus:bg-white focus:border-emerald-600'
                    }`}
                  />
                  {contactErrors.phone && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{contactErrors.phone}</span>
                    </div>
                  )}
                </div>

                {/* 4. Referral Code */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Referral / Promo Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="e.g. HEALTHIFY50"
                    className="w-full p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs uppercase"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={validateAndProceedFromContact}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all active:scale-98"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 22: HABITS & MOTIVATION */}
          {currentStep === 22 && (
            <motion.div
              key="step-22"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">Daily Preferences</h2>
                <p className="text-xs text-zinc-500 mt-1">Customize your calorie burn and tracking behavior.</p>
              </div>

              <div className="space-y-3">
                <div className={`p-4 rounded-2xl ${cardClass} flex items-center justify-between`}>
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">Exercise Burns Calories Back</div>
                    <div className="text-[10px] text-zinc-500">Add workout calories to your daily food budget</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={colorBurnsBack}
                    onChange={(e) => setColorBurnsBack(e.target.checked)}
                    className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                  />
                </div>

                <div className={`p-4 rounded-2xl ${cardClass} flex items-center justify-between`}>
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">Weekend Rollover Calories</div>
                    <div className="text-[10px] text-zinc-500">Save unconsumed calories for weekend social meals</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rolloverCalories}
                    onChange={(e) => setRolloverCalories(e.target.checked)}
                    className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                  />
                </div>

                <div className={`p-4 rounded-2xl ${cardClass} flex items-center justify-between`}>
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">Smart Water & Meal Reminders</div>
                    <div className="text-[10px] text-zinc-500">Pushes timely hydration alerts throughout the day</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableNotifications}
                    onChange={(e) => setEnableNotifications(e.target.checked)}
                    className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>Continue to Commitment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 23: COMMITMENT HOLD BUTTON (HEALTHIFY SIGNATURE) */}
          {currentStep === 23 && (
            <motion.div
              key="step-23"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-center py-4"
            >
              <div className="space-y-2">
                <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                  <Award className="w-7 h-7" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950">Commit to Your 90-Day Plan</h2>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Hold the button below for 2 seconds to seal your commitment and trigger clinical calibration.
                </p>
              </div>

              {/* Summary Card */}
              <div className={`p-5 rounded-3xl ${cardClass} text-left space-y-2.5 max-w-md mx-auto`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">Current Weight:</span>
                  <span className="text-zinc-900 font-extrabold">{currentWeightKg} kg</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">Target Goal:</span>
                  <span className="text-emerald-600 font-black">{targetWeightKg} kg ({pace})</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">Diet Type:</span>
                  <span className="text-zinc-900 font-extrabold">{dietaryPreference}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">Clinical Focus:</span>
                  <span className="text-zinc-900 font-extrabold">{selectedAccomplishments.join(', ')}</span>
                </div>
              </div>

              {/* HOLD TO COMMIT BUTTON */}
              <div className="pt-4 max-w-md mx-auto">
                <button
                  type="button"
                  onMouseDown={startHold}
                  onMouseUp={stopHold}
                  onTouchStart={startHold}
                  onTouchEnd={stopHold}
                  className="w-full relative overflow-hidden py-5 rounded-3xl bg-zinc-900 text-white font-black text-base transition-all select-none shadow-xl cursor-pointer active:scale-98"
                >
                  {/* Progress Fill Indicator */}
                  <div
                    className="absolute inset-0 bg-emerald-600 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    <Flame className="w-5 h-5 text-emerald-400" />
                    <span>{isHolding ? `Calibrating (${holdProgress}%)...` : 'Press & Hold to Commit'}</span>
                  </div>
                </button>
                <span className="block text-[11px] text-zinc-400 mt-2 font-semibold">
                  Hold down until the green bar fills 100%
                </span>
              </div>
            </motion.div>
          )}

          {/* STEP 24: LIVE MULTI-PHASE CALIBRATION SCREEN */}
          {currentStep === 24 && (
            <motion.div
              key="step-24"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6 text-center py-8"
            >
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="#E2E8F0"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke="#059669"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={301.6}
                    strokeDashoffset={301.6 - (301.6 * calcProgress) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-emerald-600">{calcProgress}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-zinc-950">Generating UrCare Metabolic Roadmap</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium leading-relaxed">
                  {calcPhaseText}
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-2 text-left pt-2">
                {[
                  { label: 'Metabolic BMR Index', done: calcProgress >= 30 },
                  { label: 'Macro Split: Protein, Carbs & Fats', done: calcProgress >= 60 },
                  { label: 'Target Calorie Budget & Water Index', done: calcProgress >= 85 },
                  { label: 'Physician Review Ready', done: calcProgress >= 100 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-bold">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-400'}`}>
                      {item.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span className={item.done ? 'text-zinc-900' : 'text-zinc-400'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER NAVIGATION BUTTONS */}
      {currentStep > 0 && currentStep < 24 && (
        <footer className="w-full max-w-xl mx-auto flex items-center justify-between pt-4 border-t border-zinc-200/80">
          <button
            type="button"
            onClick={prevStep}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <span className="text-[11px] font-bold text-zinc-400">
            UrCare Precision Engine
          </span>
        </footer>
      )}

      {/* FINAL POPUP MODAL: 3-DAY PRECISION TRIAL LAUNCH */}
      {showPlanPopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-zinc-200 shadow-2xl space-y-6 text-left relative overflow-hidden">

            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-zinc-950">Your Plan is Ready!</h3>
              <p className="text-xs text-zinc-500">
                Unlock full AI meal scanning, clinical biomarker tracking, and doctor consults.
              </p>
            </div>

            {/* 3-Day Trial — the only trial tier offered */}
            <div className="w-full p-4 rounded-2xl border border-emerald-600 bg-emerald-50/70 shadow-sm flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-zinc-950">3-Day Full Access Trial</span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase">
                    Included
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">₹0 today • Unlimited AI Scan & Doctor Line</div>
              </div>
              <div className="w-5 h-5 rounded-full border-2 border-emerald-600 bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </div>

            {/* Launch Button */}
            <button
              id="yourcare-activate-trial-btn"
              type="button"
              onClick={() => handleFinishOnboarding('3_day')}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <span>Activate Plan & Enter Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[10px] text-center text-zinc-400 font-semibold">
              Cancel anytime • 256-Bit Encrypted Healthcare Architecture
            </p>

          </div>
        </div>
      )}

    </div>
  );
};

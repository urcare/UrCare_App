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
import { useLanguage } from '../context/LanguageContext';
import { WheelPicker } from './WheelPicker';
import { RulerWheelPicker } from './RulerWheelPicker';
import { Logo } from './Logo';
import { playClickSound, playScrollTickSound, playSuccessChime } from '../utils/soundEffects';

interface OnboardingFlowProps {
  onComplete: (profile: UserHealthProfile, account: UserAccount) => void;
  onOpenAdmin?: () => void;
  initialAccount?: UserAccount | null;
}

// Hindi display labels for the medical conditions list — the English value
// itself (used as the map key) is what's stored and matched against
// CONDITION_LABEL_TO_TAG server-side, so it's never translated, only shown.
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
  'Other': 'अन्य',
};

// Hindi display labels for every DDChips option value used across the
// "deep dive" steps (11–20) — same rule as CONDITION_LABEL_HI above: the
// English string is the stored value, this only changes what's shown.
const CHIP_LABEL_HI: Record<string, string> = {
  // Allergens
  'Peanut': 'मूंगफली', 'Tree Nuts': 'ड्राई फ्रूट्स', 'Dairy / Milk': 'डेयरी / दूध', 'Egg': 'अंडा',
  'Gluten / Wheat': 'ग्लूटेन / गेहूं', 'Soy': 'सोया', 'Shellfish': 'शेलफिश', 'Fish': 'मछली', 'Sesame': 'तिल',
  // Allergy reactions
  'Rash': 'त्वचा पर चकत्ते', 'Swelling': 'सूजन', 'Breathing difficulty': 'सांस लेने में तकलीफ', 'Stomach problems': 'पेट की समस्या',
  // Sleep hours / quality
  'Less than 5': '5 से कम', '5–6': '5–6', '6–7': '6–7', '7–8': '7–8', '8–9': '8–9', 'More than 9': '9 से ज़्यादा',
  'Good': 'अच्छा', 'Average': 'औसत', 'Poor': 'खराब', 'Very poor': 'बहुत खराब',
  // Daily routine — exercise duration & work schedule
  'Not Applicable': 'लागू नहीं', 'Less than 15 min': '15 मिनट से कम', '15–30 min': '15–30 मिनट',
  '30–60 min': '30–60 मिनट', 'More than 60 min': '60 मिनट से ज़्यादा',
  'Regular day shift': 'नियमित दिन की शिफ्ट', 'Night shift': 'रात की शिफ्ट', 'Rotating shift': 'बदलती शिफ्ट',
  'Work from home': 'घर से काम', 'Not working / Student': 'काम नहीं करते / छात्र',
  // Stress level / sources / symptoms / management
  'Low': 'कम', 'Moderate': 'मध्यम', 'High': 'ज़्यादा', 'Overwhelming': 'असहनीय',
  'Work': 'काम', 'Family': 'परिवार', 'Financial': 'आर्थिक', 'Relationship': 'रिश्ते', 'Health': 'स्वास्थ्य', 'Studies': 'पढ़ाई', 'Sleep': 'नींद',
  'Constant worry': 'लगातार चिंता', 'Racing thoughts': 'बेचैन विचार', 'Difficulty relaxing': 'आराम करने में कठिनाई',
  'Sadness/low mood': 'उदासी / मन खराब रहना', 'Low motivation': 'प्रेरणा की कमी', 'None': 'कोई नहीं',
  'Exercise': 'व्यायाम', 'Meditation/Yoga': 'ध्यान / योग', 'Talking to someone': 'किसी से बात करना', 'Music': 'संगीत', 'Nothing currently': 'फिलहाल कुछ नहीं',
  // Gut & digestion
  'Less than once/day': 'दिन में एक बार से कम', 'Once/day': 'दिन में एक बार', '2 times/day': 'दिन में 2 बार',
  'More than 2/day': 'दिन में 2 से ज़्यादा बार', 'Irregular': 'अनियमित',
  'Normal': 'सामान्य', 'Hard': 'सख्त', 'Loose': 'ढीला', 'Watery': 'पानी जैसा', 'Alternating': 'बदलता रहता है',
  'Constipation': 'कब्ज़', 'Loose motions': 'दस्त', 'Acidity/heartburn': 'एसिडिटी / सीने में जलन', 'Bloating/gas': 'गैस / पेट फूलना', 'Nausea': 'जी मिचलाना',
  'IBS': 'IBS', 'GERD': 'GERD', 'Gastritis': 'गैस्ट्राइटिस', 'Ulcer': 'अल्सर', 'Lactose intolerance': 'लैक्टोज़ असहिष्णुता',
  // Lifestyle
  'Never': 'कभी नहीं', 'Occasionally': 'कभी-कभी', 'Weekly': 'साप्ताहिक', 'Daily': 'रोज़ाना', 'Previously used, stopped': 'पहले लेते थे, अब छोड़ दिया',
  'Less than 1 L': '1 लीटर से कम', '1–2 L': '1–2 लीटर', '2–3 L': '2–3 लीटर', 'More than 3 L': '3 लीटर से ज़्यादा',
  '1 cup': '1 कप', '2 cups': '2 कप', '3+ cups': '3+ कप',
  'Rarely': 'कभी-कभार', '1–2 times/week': 'हफ्ते में 1–2 बार', '3–4 times/week': 'हफ्ते में 3–4 बार',
  // Family history
  'Diabetes': 'डायबिटीज', 'High BP': 'उच्च बीपी', 'Heart disease': 'हृदय रोग', 'Thyroid disease': 'थायरॉइड रोग',
  'PCOS/PCOD': 'PCOS/PCOD', 'High cholesterol': 'उच्च कोलेस्ट्रॉल', 'Obesity': 'मोटापा', 'Cancer': 'कैंसर',
  'Kidney disease': 'किडनी रोग', 'Mental health condition': 'मानसिक स्वास्थ्य समस्या', 'No known history': 'कोई ज्ञात इतिहास नहीं',
  // Women's health
  'Regular periods': 'नियमित मासिक धर्म', 'Irregular periods': 'अनियमित मासिक धर्म', 'Menopause': 'मेनोपॉज़', 'Post-menopause': 'मेनोपॉज़ के बाद',
  'Hot flashes': 'हॉट फ्लैशेज़', 'Night sweats': 'रात में पसीना', 'Mood changes': 'मूड बदलना', 'Weight gain': 'वज़न बढ़ना',
  // Men's health
  'Very low': 'बहुत कम', 'Excellent': 'बेहतरीन', 'Prefer not to answer': 'बताना नहीं चाहते',
  'Frequent urination': 'बार-बार पेशाब आना', 'Difficulty urinating': 'पेशाब में कठिनाई', 'Enlarged prostate diagnosed': 'बढ़ा हुआ प्रोस्टेट निदान',
  // Symptoms / readiness
  'Tingling/numbness in hands or feet': 'हाथ-पैर में झनझनाहट/सुन्नपन', 'Blurry vision': 'धुंधला दिखना',
  'Swelling in feet/legs': 'पैरों में सूजन', 'Chest pain/breathlessness': 'सीने में दर्द/सांस फूलना',
  'Joint pain/stiffness': 'जोड़ों में दर्द/जकड़न', 'Headaches/brain fog': 'सिरदर्द/दिमागी थकान',
  'Skin dryness/dark patches': 'त्वचा में रूखापन/काले धब्बे',
  'Simple meal plans': 'आसान भोजन योजना', 'Quick home workouts': 'त्वरित घरेलू वर्कआउट', 'Daily accountability': 'दैनिक जवाबदेही',
  'Flexible timings': 'लचीला समय', 'Health education': 'स्वास्थ्य शिक्षा', 'Stress management': 'तनाव प्रबंधन',
};

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onOpenAdmin, initialAccount }) => {
  // Single global language state (shared with the whole app, persisted to
  // localStorage) — this used to be its own local, disconnected toggle here,
  // which is why switching language mid-onboarding didn't stick once you
  // reached the dashboard (and vice versa).
  const { language, setLanguage } = useLanguage();
  const lang = language;
  /** tr(english, hindi) — inline bilingual text, used throughout this file
   *  instead of a separate key-based dictionary so every string's Hindi
   *  translation sits right next to the English it replaces. */
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  // Total Onboarding Steps
  const TOTAL_QUESTIONS_COUNT = 24;
  const [currentStep, setCurrentStep] = useState(0);

  // 1. Gender & Activity
  const [gender, setGender] = useState<GenderType>('male');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState<'0-2' | '3-5' | '6+' | 'other'>('3-5');
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
    foodAllergens: string[];
    // Free text captured whenever a question's "Other" option is selected,
    // keyed by that question's own field name — one shared bucket instead of
    // a dedicated string field per question.
    otherTexts: Record<string, string>;
    monitorsSugar: YesNo; fastingSugar: string; postMealSugar: string; hba1c: string;
    bloodPressure: string; restingHeartRate: string; otherLabValues: string;
    sleepTime: string; wakeTime: string; sleepHours: string; sleepQuality: string;
    snoring: YesNo; sleepApnea: YesNo;
    // Daily Routine (step 15) — a full picture of when the user actually
    // does things day to day, used alongside sleep/activity data above.
    wakeUpTime: string; breakfastTime: string; lunchTime: string; dinnerTime: string;
    exerciseTime: string; exerciseDuration: string; workSchedule: string; dailyRoutineNotes: string;
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
    foodAllergens: [],
    otherTexts: {},
    monitorsSugar: '', fastingSugar: '', postMealSugar: '', hba1c: '',
    bloodPressure: '', restingHeartRate: '', otherLabValues: '',
    sleepTime: '', wakeTime: '', sleepHours: '', sleepQuality: '',
    snoring: '', sleepApnea: '',
    wakeUpTime: '', breakfastTime: '', lunchTime: '', dinnerTime: '',
    exerciseTime: '', exerciseDuration: '', workSchedule: '', dailyRoutineNotes: '',
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
  // Free-text captured for any question's "Other" choice, keyed by that
  // question's own field name (works for the deep-dive steps' DDChips).
  const setOtherText = (key: string, text: string) => {
    setDd((prev) => ({ ...prev, otherTexts: { ...prev.otherTexts, [key]: text } }));
  };
  // Same idea, for questions that live outside the `dd` deep-dive state
  // (goal, focus areas, activity level, pace, conditions, gender).
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const setOtherTextTop = (key: string, text: string) => {
    setOtherTexts((prev) => ({ ...prev, [key]: text }));
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

  // 10. Diagnostics Calculation Screen & Plan-Ready Modal
  const [calcProgress, setCalcProgress] = useState(0);
  const [calcPhaseText, setCalcPhaseText] = useState('Analyzing baseline metabolic index...');
  const [showPlanPopUp, setShowPlanPopUp] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);

  // Dynamic calculations
  const finalAge = agePickerMode === 'direct_age' ? age : Math.max(14, currentYear - birthYear);
  const bmi = Number((currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
  const weightDiff = Number((targetWeightKg - currentWeightKg).toFixed(1));
  const isLosing = weightDiff < 0;

  // A short, varied "nice progress" toast shown after every step forward —
  // picked from a pool per progress tier so it never repeats the same line
  // twice in a row.
  const [celebration, setCelebration] = useState<{ message: string; percent: number } | null>(null);
  const lastCelebrationRef = useRef<string | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CELEBRATION_TIERS: { max: number; messages: string[] }[] = [
    { max: 0.2, messages: [tr('Great start!', 'बढ़िया शुरुआत!'), tr('Nice beginning!', 'शानदार शुरुआत!'), tr("You're on your way!", 'आप सही राह पर हैं!'), tr('Off to a strong start!', 'मजबूत शुरुआत हुई!'), tr('Good first step!', 'अच्छा पहला कदम!')] },
    { max: 0.45, messages: [tr('Making great progress!', 'बहुत अच्छी प्रगति!'), tr("You're doing well!", 'आप बढ़िया कर रहे हैं!'), tr('Good momentum!', 'अच्छी गति है!'), tr('Keep it up!', 'ऐसे ही जारी रखें!'), tr('Nicely done so far!', 'अब तक बहुत बढ़िया!')] },
    { max: 0.7, messages: [tr('More than halfway there!', 'आधे से ज़्यादा हो गया!'), tr('Strong progress!', 'शानदार प्रगति!'), tr("You're doing great!", 'आप बहुत अच्छा कर रहे हैं!'), tr('Keep going!', 'चलते रहें!'), tr('Steady progress!', 'स्थिर प्रगति!')] },
    { max: 0.9, messages: [tr('Almost there!', 'लगभग पूरा हो गया!'), tr("You're very close!", 'आप बहुत करीब हैं!'), tr('Just a few more steps!', 'बस कुछ ही कदम बाकी!'), tr('Nearly done!', 'लगभग पूर्ण!'), tr('So close now!', 'बिल्कुल पास आ गए!')] },
    { max: 1.01, messages: [tr('One last step!', 'एक आखिरी कदम!'), tr('Almost ready!', 'लगभग तैयार!'), tr('Final stretch!', 'अंतिम चरण!'), tr('Your plan is nearly ready!', 'आपकी योजना लगभग तैयार है!')] },
  ];

  const triggerCelebration = (step: number) => {
    const percent = Math.min(1, step / TOTAL_QUESTIONS_COUNT);
    const tier = CELEBRATION_TIERS.find((t) => percent <= t.max) || CELEBRATION_TIERS[CELEBRATION_TIERS.length - 1];
    const options = tier.messages.filter((m) => m !== lastCelebrationRef.current);
    const pool = options.length > 0 ? options : tier.messages;
    const message = pool[Math.floor(Math.random() * pool.length)];
    lastCelebrationRef.current = message;

    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    setCelebration({ message, percent: Math.round(percent * 100) });
    celebrationTimerRef.current = setTimeout(() => setCelebration(null), 1700);
  };

  // Step Navigation
  const nextStep = () => {
    playClickSound(680);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const next = Math.min(currentStep + 1, 25);
    setCurrentStep(next);
    if (next >= 1 && next <= TOTAL_QUESTIONS_COUNT) {
      triggerCelebration(next);
    }
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
    setCurrentStep(25);
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

  // Finish Onboarding — no trial tier: everyone starts on the free plan and
  // upgrades to Pro explicitly via the paywall, same as any returning user.
  const handleFinishOnboarding = () => {
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
      // Merge the top-level "Other" free-text answers (gender, goal, focus
      // areas, activity level, conditions) in with the deep-dive ones so
      // every "Other" answer from the whole form ends up in one place.
      healthDeepDive: { ...dd, otherTexts: { ...dd.otherTexts, ...otherTexts } },
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
      isPro: false,
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
      {(options || [{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }]).map((o) => (
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
    options, selected, onToggle, columns = 2, otherValue, onOtherChange,
  }: {
    options: string[]; selected: string[]; onToggle: (v: string) => void; columns?: 1 | 2;
    /** When set, selecting the literal "Other" option reveals a free-text
     *  input beneath the chips so the user can type their own answer. */
    otherValue?: string; onOtherChange?: (v: string) => void;
  }) => (
    <div className="space-y-2.5">
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
              <span className="text-[11px] font-extrabold leading-tight">{tr(opt, CHIP_LABEL_HI[opt] || opt)}</span>
              <div className={`w-4 h-4 shrink-0 ml-2 rounded-md border flex items-center justify-center ${isSelected ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>
      {onOtherChange && selected.includes('Other') && (
        <input
          type="text"
          value={otherValue || ''}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder={tr('Please specify...', 'कृपया बताएं...')}
          className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
        />
      )}
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

  const DDContinue = ({ label = tr('Continue', 'आगे बढ़ें') }: { label?: string }) => (
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
    <div id="yourcare-onboarding-root" className="w-full min-h-screen bg-[#F8FAFC] text-zinc-900 flex flex-col justify-between py-4 px-4 sm:px-8">

      {/* A brief, varied "nice progress" toast after every step forward. */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full bg-white border border-emerald-200 shadow-lg text-zinc-800 text-xs sm:text-sm font-bold pointer-events-none whitespace-nowrap"
          >
            <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">
              {celebration.percent}%
            </span>
            <span>{celebration.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
              title={tr('Admin Portal', 'एडमिन पोर्टल')}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </button>
          )}

          {/* Language Switch */}
          <div className="flex items-center gap-1 rounded-xl p-1 text-xs bg-white border border-zinc-200 shadow-xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${lang === 'en' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${lang === 'hi' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </header>

      {/* Progress Bar (During questionnaire) — hidden on step 25, the
          "Generating..." screen, which has its own circular progress and
          isn't one of the 24 counted questions (showing it there produced
          "Step 25 of 24" / 104%). */}
      {currentStep > 0 && currentStep < 25 && (
        <div className="w-full max-w-xl mx-auto mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 mb-1.5">
            <span>{tr('Step', 'चरण')} {currentStep} {tr('of', 'का')} {TOTAL_QUESTIONS_COUNT}</span>
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
                <span>{tr("India's #1 Reversal Platform", 'भारत का #1 रिवर्सल प्लेटफॉर्म')}</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                  {tr('Get', '')} <span className="text-emerald-600">{tr('Healthified', 'हेल्दी')}</span> {tr('with UrCare', 'UrCare के साथ')}
                </h1>
                <p className="text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
                  {tr('Join over 35 million users who transformed their metabolic health, reversed pre-diabetes, and achieved sustainable fat loss.', '3.5 करोड़ से अधिक लोगों से जुड़ें जिन्होंने अपना मेटाबॉलिक स्वास्थ्य सुधारा, प्री-डायबिटीज को उलटा और स्थायी वज़न घटाया।')}
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left pt-2">
                <div className={`p-4 rounded-2xl ${cardClass}`}>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-extrabold text-zinc-900">{tr('Instant Calorie Engine', 'तुरंत कैलोरी विश्लेषण')}</div>
                  <p className="text-xs text-zinc-500 mt-0.5">{tr('Automated meal tracking with clinical macro splits.', 'क्लीनिकल मैक्रो विभाजन के साथ स्वचालित भोजन ट्रैकिंग।')}</p>
                </div>

                <div className={`p-4 rounded-2xl ${cardClass}`}>
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-2 font-bold">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-extrabold text-zinc-900">{tr('Doctor Supervision', 'डॉक्टर की निगरानी')}</div>
                  <p className="text-xs text-zinc-500 mt-0.5">{tr('Continuous clinical biomarker and lab review.', 'निरंतर क्लीनिकल बायोमार्कर एवं लैब समीक्षा।')}</p>
                </div>
              </div>

              <div className="pt-4 flex flex-col items-center gap-3">
                <button
                  id="yourcare-start-onboarding-btn"
                  type="button"
                  onClick={nextStep}
                  className="w-full max-w-md py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-base transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{tr('Begin Personal Onboarding', 'व्यक्तिगत मूल्यांकन शुरू करें')}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <p className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{tr('Free to Start • Instant Calibration', 'निःशुल्क शुरुआत • तुरंत विश्लेषण')}</span>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('What is your biological sex?', 'आपका जैविक लिंग क्या है?')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('We calibrate your baseline BMR and hormonal balance based on this.', 'इससे हम आपकी बेसल मेटाबोलिक दर (BMR) और हार्मोनल संतुलन तय करते हैं।')}</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'male', title: tr('Male', 'पुरुष'), desc: tr('Higher baseline lean muscle ratio & BMR', 'अधिक मांसपेशी अनुपात और BMR') },
                  { id: 'female', title: tr('Female', 'महिला'), desc: tr('Hormonal and cyclical metabolic rhythm', 'हार्मोनल एवं चक्रीय मेटाबॉलिक लय') },
                  { id: 'other', title: tr('Other / Prefer not to say', 'अन्य / नहीं बताना चाहते'), desc: tr('Standardized balanced metabolic baseline', 'संतुलित मानक मेटाबॉलिक आधार') },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGender(g.id as GenderType)}
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

              {gender === 'other' && (
                <input
                  type="text"
                  placeholder={tr('Prefer to specify? (optional)', 'कुछ और बताना चाहें? (वैकल्पिक)')}
                  value={otherTexts.gender || ''}
                  onChange={(e) => setOtherTextTop('gender', e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
                />
              )}

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('What is your primary goal?', 'आपका मुख्य लक्ष्य क्या है?')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('UrCare tailors your daily calorie deficit and macro targets accordingly.', 'UrCare इसी के अनुसार आपकी दैनिक कैलोरी और मैक्रो लक्ष्य तय करता है।')}</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'lose_weight', title: tr('Lose Weight & Burn Fat', 'वज़न घटाएं और चर्बी कम करें'), desc: tr('Caloric deficit with high-protein satiety', 'उच्च प्रोटीन के साथ कैलोरी डेफिसिट') },
                  { id: 'build_muscle', title: tr('Build Lean Muscle & Tone', 'मांसपेशियां बनाएं व टोन करें'), desc: tr('Hypertrophy macro split with progressive reload', 'प्रगतिशील ट्रेनिंग के साथ मांसपेशी विकास') },
                  { id: 'maintain_weight', title: tr('Maintain Weight & Stay Fit', 'वज़न बनाए रखें और फिट रहें'), desc: tr('Iso-caloric metabolic balance and sustained energy', 'संतुलित कैलोरी और निरंतर ऊर्जा') },
                  { id: 'health_wellness', title: tr('Manage Blood Sugar & Vitality', 'ब्लड शुगर एवं ऊर्जा प्रबंधन'), desc: tr('Low glycemic index focus with insulin optimization', 'कम ग्लाइसेमिक इंडेक्स और इंसुलिन संतुलन') },
                  { id: 'other', title: tr('Other', 'अन्य'), desc: tr('Tell us in your own words', 'अपने शब्दों में बताएं') },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id as GoalType)}
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

              {(goal as string) === 'other' && (
                <input
                  type="text"
                  placeholder={tr('Describe your primary goal...', 'अपना लक्ष्य बताएं...')}
                  value={otherTexts.goal || ''}
                  onChange={(e) => setOtherTextTop('goal', e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
                />
              )}

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('Select your focus areas', 'अपने फोकस क्षेत्र चुनें')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('Choose the key health domains you want UrCare to focus on.', 'वे मुख्य स्वास्थ्य क्षेत्र चुनें जिन पर UrCare ध्यान केंद्रित करे।')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'belly', label: tr('Belly Fat Reduction', 'पेट की चर्बी कम करना'), icon: Flame },
                  { id: 'energy', label: tr('All-Day Energy & Stamina', 'दिनभर ऊर्जा और स्टैमिना'), icon: Zap },
                  { id: 'muscle', label: tr('Upper Body & Arms Toning', 'ऊपरी शरीर व बांहों की टोनिंग'), icon: Dumbbell },
                  { id: 'thighs', label: tr('Legs & Core Strength', 'पैर व कोर की ताकत'), icon: Activity },
                  { id: 'sleep', label: tr('Deep Sleep & Recovery', 'गहरी नींद व रिकवरी'), icon: Moon },
                  { id: 'stress', label: tr('Cortisol & Stress Balance', 'तनाव व कॉर्टिसोल संतुलन'), icon: Heart },
                  { id: 'other', label: tr('Other', 'अन्य'), icon: Sparkle },
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

              {selectedAccomplishments.includes('other') && (
                <input
                  type="text"
                  placeholder={tr('What else would you like to focus on?', 'और क्या फोकस करना चाहेंगे?')}
                  value={otherTexts.focusAreas || ''}
                  onChange={(e) => setOtherTextTop('focusAreas', e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
                />
              )}

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('How active are you?', 'आप कितने सक्रिय हैं?')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('This determines your daily non-exercise activity thermogenesis (NEAT).', 'यह आपकी दैनिक गैर-व्यायाम ऊर्जा खपत (NEAT) तय करता है।')}</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: '0-2', title: tr('Sedentary / Light (0-2 workouts/wk)', 'कम सक्रिय (हफ्ते में 0-2 वर्कआउट)'), desc: tr('Desk job, < 5,000 steps daily', 'डेस्क जॉब, प्रतिदिन 5,000 से कम कदम') },
                  { id: '3-5', title: tr('Moderately Active (3-5 workouts/wk)', 'मध्यम सक्रिय (हफ्ते में 3-5 वर्कआउट)'), desc: tr('Active routine, 7,000 - 10,000 steps daily', 'सक्रिय दिनचर्या, प्रतिदिन 7,000-10,000 कदम') },
                  { id: '6+', title: tr('Very Active (6+ workouts/wk)', 'अत्यधिक सक्रिय (हफ्ते में 6+ वर्कआउट)'), desc: tr('Intense training, athlete or high physical work', 'गहन ट्रेनिंग, एथलीट या भारी शारीरिक कार्य') },
                  { id: 'other', title: tr('Other', 'अन्य'), desc: tr('Describe your routine in your own words', 'अपनी दिनचर्या बताएं') },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      setWorkoutsPerWeek(w.id as any);
                      if (w.id !== 'other') setTimeout(nextStep, 180);
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

              {workoutsPerWeek === 'other' && (
                <>
                  <input
                    type="text"
                    placeholder={tr('Describe your activity level...', 'अपनी गतिविधि स्तर बताएं...')}
                    value={otherTexts.activityLevel || ''}
                    onChange={(e) => setOtherTextTop('activityLevel', e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={nextStep}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    <span>{tr('Continue', 'आगे बढ़ें')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('How old are you?', 'आपकी उम्र कितनी है?')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('Scroll the age wheel picker to select your exact age.', 'सटीक उम्र चुनने के लिए व्हील को स्क्रॉल करें।')}</p>
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
                  {tr('Age Wheel', 'उम्र व्हील')}
                </button>
                <button
                  type="button"
                  onClick={() => setAgePickerMode('dob')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    agePickerMode === 'dob' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tr('Date of Birth', 'जन्मतिथि')}
                </button>
              </div>

              {/* DIRECT AGE WHEEL PICKER */}
              {agePickerMode === 'direct_age' ? (
                <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                  <div className="text-center">
                    <span className="text-xs text-zinc-400 uppercase font-black tracking-wider">{tr('Selected Age', 'चयनित उम्र')}</span>
                    <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
                      <span className="text-4xl font-black text-emerald-600">{age}</span>
                      <span className="text-sm font-bold text-zinc-500">{tr('Years Old', 'वर्ष')}</span>
                    </div>
                  </div>

                  {/* Vertical Drum Wheel Picker */}
                  <WheelPicker
                    items={ageItems}
                    value={age}
                    onChange={(val) => setAge(Number(val))}
                    unit="yrs"
                    visibleCount={3}
                    itemHeight={40}
                    isDark={false}
                    className="py-1"
                  />

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-center text-emerald-800">
                    {age < 30 ? tr('🔥 High Metabolic Elasticity Zone', '🔥 उच्च मेटाबॉलिक लचीलापन क्षेत्र') : age < 50 ? tr('⚡ Optimized Nutrient Partitioning', '⚡ अनुकूलित पोषक तत्व विभाजन') : tr('🌿 Longevity & Metabolic Preservation Focus', '🌿 दीर्घायु एवं मेटाबॉलिक संरक्षण पर ध्यान')}
                  </div>
                </div>
              ) : (
                /* DOB TRIPLE DRUM WHEEL PICKERS */
                <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                  <div className="text-center">
                    <span className="text-xs text-zinc-400 uppercase font-black tracking-wider">{tr('Calculated Age', 'गणना की गई उम्र')}</span>
                    <div className="text-3xl font-black text-emerald-600">{finalAge} {tr('Years Old', 'वर्ष')}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Day */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 text-center mb-1">{tr('DAY', 'दिन')}</span>
                      <WheelPicker
                        items={dayItems}
                        value={birthDay}
                        onChange={(val) => setBirthDay(Number(val))}
                        visibleCount={3}
                        itemHeight={34}
                        isDark={false}
                      />
                    </div>
                    {/* Month */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 text-center mb-1">{tr('MONTH', 'महीना')}</span>
                      <WheelPicker
                        items={monthItems}
                        value={birthMonth}
                        onChange={(val) => setBirthMonth(Number(val))}
                        visibleCount={3}
                        itemHeight={34}
                        isDark={false}
                      />
                    </div>
                    {/* Year */}
                    <div>
                      <span className="block text-[10px] font-bold text-zinc-400 text-center mb-1">{tr('YEAR', 'साल')}</span>
                      <WheelPicker
                        items={yearItems}
                        value={birthYear}
                        onChange={(val) => setBirthYear(Number(val))}
                        visibleCount={3}
                        itemHeight={34}
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
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('What is your height?', 'आपकी ऊंचाई क्या है?')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('Scroll the interactive ruler dial or use wheel pickers.', 'इंटरैक्टिव रूलर या व्हील पिकर से चुनें।')}</p>
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
                  {tr('Centimeters (cm)', 'सेंटीमीटर (cm)')}
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit('ft')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    heightUnit === 'ft' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tr('Feet & Inches (ft/in)', 'फीट व इंच (ft/in)')}
                </button>
              </div>

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
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
                      {tr('Equivalent to', 'बराबर है')} <strong className="text-emerald-600 font-black">{heightFeet} ft {heightInches} in</strong>
                    </div>
                  </div>
                ) : (
                  /* FT & IN DUAL DRUM WHEELS */
                  <div className="space-y-4">
                    <div className="text-center pb-2">
                      <span className="text-xs text-zinc-400 uppercase font-black">{tr('Selected Stature', 'चयनित ऊंचाई')}</span>
                      <div className="text-3xl font-black text-emerald-600">
                        {heightFeet} ft {heightInches} in <span className="text-sm font-semibold text-zinc-400">({heightCm} cm)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-black text-zinc-400 text-center mb-1">{tr('FEET', 'फीट')}</span>
                        <WheelPicker
                          items={feetItems}
                          value={heightFeet}
                          onChange={(val) => updateHeightFromFtIn(Number(val), heightInches)}
                          visibleCount={3}
                          itemHeight={38}
                          isDark={false}
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-black text-zinc-400 text-center mb-1">{tr('INCHES', 'इंच')}</span>
                        <WheelPicker
                          items={inchItems}
                          value={heightInches}
                          onChange={(val) => updateHeightFromFtIn(heightFeet, Number(val))}
                          visibleCount={3}
                          itemHeight={38}
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
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('What is your current weight?', 'आपका वर्तमान वज़न कितना है?')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('Scroll the ruler to set your weight and see your live BMI index.', 'रूलर स्क्रॉल करके वज़न सेट करें और अपना BMI देखें।')}</p>
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
                  {tr('Kilograms (kg)', 'किलोग्राम (kg)')}
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit('lbs')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    weightUnit === 'lbs' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tr('Pounds (lbs)', 'पाउंड (lbs)')}
                </button>
              </div>

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
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
                    <span className="text-xs font-extrabold text-zinc-700">{tr('Calculated BMI Index', 'गणना किया गया BMI')}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-black text-emerald-600">{bmi}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {bmi < 18.5 ? tr('Underweight', 'कम वज़न') : bmi < 25 ? tr('Healthy Optimal', 'स्वस्थ वज़न') : bmi < 30 ? tr('Overweight', 'अधिक वज़न') : tr('Obese', 'मोटापा')}
                      </span>
                    </div>
                  </div>

                  {/* Visual BMI Bar */}
                  <div className="w-full h-2 rounded-full bg-zinc-200 flex overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '18.5%' }} title={tr('Underweight (< 18.5)', 'कम वज़न (< 18.5)')} />
                    <div className="h-full bg-emerald-500" style={{ width: '25%' }} title={tr('Normal (18.5 - 24.9)', 'सामान्य (18.5 - 24.9)')} />
                    <div className="h-full bg-amber-500" style={{ width: '25%' }} title={tr('Overweight (25.0 - 29.9)', 'अधिक वज़न (25.0 - 29.9)')} />
                    <div className="h-full bg-rose-500" style={{ width: '31.5%' }} title={tr('Obese (30.0+)', 'मोटापा (30.0+)')} />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('What is your target weight?', 'आपका लक्ष्य वज़न क्या है?')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('Select your desired goal weight and weekly target pace.', 'अपना लक्ष्य वज़न और साप्ताहिक गति चुनें।')}</p>
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
                  {tr('Kilograms (kg)', 'किलोग्राम (kg)')}
                </button>
                <button
                  type="button"
                  onClick={() => setTargetWeightUnit('lbs')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-xl transition-all ${
                    targetWeightUnit === 'lbs' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tr('Pounds (lbs)', 'पाउंड (lbs)')}
                </button>
              </div>

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
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
                    <span>{tr('Required Transformation', 'आवश्यक बदलाव')}</span>
                    <span className="text-emerald-600 font-black text-sm">
                      {isLosing ? `${weightDiff} kg (${tr('Fat Loss', 'चर्बी कम')})` : `+${weightDiff} kg (${tr('Muscle Gain', 'मांसपेशी वृद्धि')})`}
                    </span>
                  </div>

                  {/* Pace Selector */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'relaxed', label: tr('Relaxed', 'आरामदायक'), rate: '0.25 kg/wk' },
                      { id: 'steady', label: tr('Recommended', 'अनुशंसित'), rate: '0.5 kg/wk' },
                      { id: 'aggressive', label: tr('Aggressive', 'तेज़'), rate: '0.75 kg/wk' },
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
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('Dietary Preferences', 'आहार प्राथमिकता')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('We customize all meal recommendations and macros to match your lifestyle.', 'हम आपकी जीवनशैली के अनुसार सभी भोजन सुझाव और मैक्रो तैयार करते हैं।')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'Vegetarian', label: tr('Vegetarian', 'शाकाहारी') },
                  { value: 'Eggetarian', label: tr('Eggetarian', 'एग्गेटेरियन') },
                  { value: 'Non-Vegetarian', label: tr('Non-Vegetarian', 'मांसाहारी') },
                  { value: 'Vegan', label: tr('Vegan', 'वीगन') },
                  { value: 'Jain', label: tr('Jain', 'जैन') },
                  { value: 'Keto / Low-Carb', label: tr('Keto / Low-Carb', 'कीटो / लो-कार्ब') },
                  { value: 'Gluten-Free', label: tr('Gluten-Free', 'ग्लूटेन-फ्री') },
                  { value: 'Other', label: tr('Other', 'अन्य') },
                ].map((diet) => (
                  <button
                    key={diet.value}
                    type="button"
                    onClick={() => setDietaryPreference(diet.value)}
                    className={`p-4 rounded-2xl border font-bold text-center transition-all ${
                      dietaryPreference === diet.value ? itemActive : itemInactive
                    }`}
                  >
                    <span className="text-xs font-black">{diet.label}</span>
                  </button>
                ))}
              </div>

              {dietaryPreference === 'Other' && (
                <input
                  type="text"
                  placeholder={tr('Specify your dietary guidelines (e.g. Dairy-free, Halal)...', 'अपनी आहार जरूरतें बताएं (जैसे डेयरी-फ्री, हलाल)...')}
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
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
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
                <h2 className="text-2xl font-black text-zinc-950">{tr('Medical & Health Profile', 'चिकित्सा एवं स्वास्थ्य प्रोफ़ाइल')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('Our clinical algorithm adjusts micronutrient and glycemic limits for your health.', 'हमारा एल्गोरिथम आपके स्वास्थ्य अनुसार पोषण और शुगर सीमाएं तय करता है।')}</p>
              </div>

              {/* This exact label list is mirrored server-side (CONDITION_LABEL_TO_TAG
                  in server.ts) to match each user into the right condition-specific
                  sections of the reversal plan — keep the two in sync if this changes.
                  Only the DISPLAY text is translated below (via CONDITION_LABEL_HI);
                  the underlying English value stored/sent to the server never changes. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
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
                  // "Other" is intentionally NOT part of the mirrored
                  // server-side label list above — it never maps to a
                  // condition tag, it just captures free text below.
                  'Other',
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
                      <span className="text-xs font-extrabold">{tr(cond, CONDITION_LABEL_HI[cond] || cond)}</span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? 'border-white bg-white text-emerald-600' : 'border-zinc-300'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedConditions.includes('Other') && (
                <input
                  type="text"
                  placeholder={tr('Describe the other condition...', 'अन्य स्थिति के बारे में बताएं...')}
                  value={otherTexts.conditions || ''}
                  onChange={(e) => setOtherTextTop('conditions', e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs"
                />
              )}

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 11: MEDICINES, INSULIN & SUPPLEMENTS */}
          {currentStep === 11 && (
            <motion.div key="step-11" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Medicines & Supplements', 'दवाइयां व सप्लीमेंट्स')} subtitle={tr('Tell us what you are currently taking, so our clinical algorithm never conflicts with your prescriptions.', 'बताएं आप फिलहाल क्या ले रहे हैं, ताकि हमारी योजना आपकी दवाओं से न टकराए।')} />

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">{tr('Are you currently taking any medicines?', 'क्या आप फिलहाल कोई दवा ले रहे हैं?')}</span>
                  <DDYesNo value={dd.onMedicines} onChange={(v) => setDdField('onMedicines', v as YesNo)} />
                  {dd.onMedicines === 'yes' && (
                    <DDTextArea label={tr('List each medicine, dose, timing & since when', 'हर दवा, खुराक, समय व कब से ले रहे हैं बताएं')} value={dd.medicinesText} onChange={(v) => setDdField('medicinesText', v)} placeholder={tr('e.g. Metformin 500mg, twice daily, since 2022', 'जैसे Metformin 500mg, दिन में दो बार, 2022 से')} />
                  )}
                </div>

                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">{tr('Are you taking insulin?', 'क्या आप इंसुलिन ले रहे हैं?')}</span>
                  <DDYesNo value={dd.onInsulin} onChange={(v) => setDdField('onInsulin', v as YesNo)} />
                  {dd.onInsulin === 'yes' && (
                    <DDTextArea label={tr('Insulin type, units & timing (basal / mealtime)', 'इंसुलिन प्रकार, यूनिट व समय (बेसल / भोजन के समय)')} value={dd.insulinDetails} onChange={(v) => setDdField('insulinDetails', v)} placeholder={tr('e.g. Basal 12 units at night, rapid-acting 6 units before meals', 'जैसे रात में 12 यूनिट बेसल, भोजन से पहले 6 यूनिट')} />
                  )}
                </div>

                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">{tr('Any vitamins, supplements, herbal or Ayurvedic medicines?', 'कोई विटामिन, सप्लीमेंट, हर्बल या आयुर्वेदिक दवा?')}</span>
                  <DDYesNo value={dd.onSupplements} onChange={(v) => setDdField('onSupplements', v as YesNo)} />
                  {dd.onSupplements === 'yes' && (
                    <DDTextArea label={tr('Name, dose & frequency', 'नाम, खुराक व कितनी बार')} value={dd.supplementsText} onChange={(v) => setDdField('supplementsText', v)} placeholder={tr('e.g. Vitamin D3 60K weekly, Ashwagandha daily', 'जैसे Vitamin D3 60K हफ्ते में, Ashwagandha रोज़')} />
                  )}
                </div>
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 12: ALLERGIES */}
          {currentStep === 12 && (
            <motion.div key="step-12" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Allergies', 'एलर्जी')} subtitle={tr('This keeps your meal plan and any recommended medicines safe.', 'इससे आपका भोजन प्लान और सुझाई गई दवाएं सुरक्षित रहती हैं।')} />

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">{tr('Medicine allergies?', 'दवाओं से एलर्जी?')}</span>
                  <DDYesNo value={dd.medicineAllergy} onChange={(v) => setDdField('medicineAllergy', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }, { id: 'not_sure', label: tr('Not sure', 'पक्का नहीं') }]} />
                </div>
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">{tr('Food allergies?', 'भोजन से एलर्जी?')}</span>
                  <DDYesNo value={dd.foodAllergy} onChange={(v) => setDdField('foodAllergy', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }, { id: 'not_sure', label: tr('Not sure', 'पक्का नहीं') }]} />
                  {dd.foodAllergy === 'yes' && (
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-black text-zinc-800">{tr('Which food(s) are you allergic to?', 'आपको किन खाद्य पदार्थों से एलर्जी है?')}</span>
                      <DDChips
                        options={['Peanut', 'Tree Nuts', 'Dairy / Milk', 'Egg', 'Gluten / Wheat', 'Soy', 'Shellfish', 'Fish', 'Sesame', 'Other']}
                        selected={dd.foodAllergens}
                        onToggle={(v) => toggleDdItem('foodAllergens', v)}
                        otherValue={dd.otherTexts['foodAllergens'] || ''}
                        onOtherChange={(v) => setOtherText('foodAllergens', v)}
                      />
                    </div>
                  )}
                </div>
                <div className={`p-4 rounded-2xl ${cardClass} space-y-3`}>
                  <span className="text-xs font-black text-zinc-800">{tr('Environmental allergies?', 'पर्यावरणीय एलर्जी?')}</span>
                  <DDYesNo value={dd.envAllergy} onChange={(v) => setDdField('envAllergy', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }, { id: 'not_sure', label: tr('Not sure', 'पक्का नहीं') }]} />
                </div>
                {(dd.medicineAllergy === 'yes' || dd.foodAllergy === 'yes' || dd.envAllergy === 'yes') && (
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('What reaction have you experienced?', 'आपको क्या प्रतिक्रिया हुई?')}</span>
                    <DDChips options={['Rash', 'Swelling', 'Breathing difficulty', 'Stomach problems', 'Other']} selected={dd.allergyReactions} onToggle={(v) => toggleDdItem('allergyReactions', v)}  otherValue={dd.otherTexts['allergyReactions'] || ''} onOtherChange={(v) => setOtherText('allergyReactions', v)} />
                  </div>
                )}
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 13: BLOOD SUGAR, BP & VITALS */}
          {currentStep === 13 && (
            <motion.div key="step-13" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Blood Sugar, BP & Vitals', 'ब्लड शुगर, बीपी व अन्य जांच')} subtitle={tr('Recent readings help us calibrate your glycemic and cardiovascular limits precisely.', 'हाल की रीडिंग से हम आपकी शुगर व हृदय संबंधी सीमाएं सटीक रूप से तय करते हैं।')} />

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                <span className="text-xs font-black text-zinc-800">{tr('Do you monitor your blood sugar?', 'क्या आप अपनी ब्लड शुगर मॉनिटर करते हैं?')}</span>
                <DDYesNo value={dd.monitorsSugar} onChange={(v) => setDdField('monitorsSugar', v as YesNo)} />

                {dd.monitorsSugar === 'yes' && (
                  <div className="grid grid-cols-2 gap-3">
                    <DDInput label={tr('Avg. Fasting Sugar (mg/dL)', 'औसत फास्टिंग शुगर (mg/dL)')} value={dd.fastingSugar} onChange={(v) => setDdField('fastingSugar', v)} placeholder="e.g. 110" />
                    <DDInput label={tr('Avg. Post-Meal Sugar (mg/dL)', 'औसत भोजन-बाद शुगर (mg/dL)')} value={dd.postMealSugar} onChange={(v) => setDdField('postMealSugar', v)} placeholder="e.g. 160" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <DDInput label={tr('Latest HbA1c (%)', 'नवीनतम HbA1c (%)')} value={dd.hba1c} onChange={(v) => setDdField('hba1c', v)} placeholder="e.g. 6.2" />
                  <DDInput label={tr('Latest Blood Pressure', 'नवीनतम ब्लड प्रेशर')} value={dd.bloodPressure} onChange={(v) => setDdField('bloodPressure', v)} placeholder="e.g. 120/80" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DDInput label={tr('Resting Heart Rate (BPM)', 'आराम में हृदय गति (BPM)')} value={dd.restingHeartRate} onChange={(v) => setDdField('restingHeartRate', v)} placeholder="e.g. 74" />
                  <DDInput label={tr('Other labs (optional)', 'अन्य जांच (वैकल्पिक)')} value={dd.otherLabValues} onChange={(v) => setDdField('otherLabValues', v)} placeholder={tr('Creatinine, eGFR, uric acid...', 'क्रिएटिनिन, eGFR, यूरिक एसिड...')} />
                </div>
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 14: SLEEP PROFILE */}
          {currentStep === 14 && (
            <motion.div key="step-14" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Sleep Profile', 'नींद की जानकारी')} subtitle={tr('Sleep quality directly impacts your cortisol, hunger hormones and recovery.', 'नींद की गुणवत्ता आपके हार्मोन, भूख और रिकवरी पर सीधा असर डालती है।')} />

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                <div className="grid grid-cols-2 gap-3">
                  <DDInput label={tr('Usual sleep time', 'सामान्य सोने का समय')} value={dd.sleepTime} onChange={(v) => setDdField('sleepTime', v)} placeholder="e.g. 11:30 PM" />
                  <DDInput label={tr('Usual wake time', 'सामान्य उठने का समय')} value={dd.wakeTime} onChange={(v) => setDdField('wakeTime', v)} placeholder="e.g. 7:00 AM" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black text-zinc-800">{tr('How many hours do you sleep?', 'आप कितने घंटे सोते हैं?')}</span>
                  <DDChips options={['Less than 5', '5–6', '6–7', '7–8', '8–9', 'More than 9', 'Other']} selected={dd.sleepHours ? [dd.sleepHours] : []} onToggle={(v) => setDdField('sleepHours', v)}  otherValue={dd.otherTexts['sleepHours'] || ''} onOtherChange={(v) => setOtherText('sleepHours', v)} />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black text-zinc-800">{tr('How would you rate your sleep?', 'आप अपनी नींद को कैसे आंकेंगे?')}</span>
                  <DDChips options={['Good', 'Average', 'Poor', 'Very poor', 'Other']} selected={dd.sleepQuality ? [dd.sleepQuality] : []} onToggle={(v) => setDdField('sleepQuality', v)}  otherValue={dd.otherTexts['sleepQuality'] || ''} onOtherChange={(v) => setOtherText('sleepQuality', v)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Do you snore?', 'क्या आप खर्राटे लेते हैं?')}</span>
                    <DDYesNo value={dd.snoring} onChange={(v) => setDdField('snoring', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }]} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Diagnosed sleep apnea?', 'स्लीप एपनिया निदान हुआ है?')}</span>
                    <DDYesNo value={dd.sleepApnea} onChange={(v) => setDdField('sleepApnea', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }]} />
                  </div>
                </div>

                {/* Follow-up detail text — shown only once a "Yes" is actually
                    picked above, same reveal-on-Yes pattern used for allergies. */}
                {(dd.snoring === 'yes' || dd.sleepApnea === 'yes') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {dd.snoring === 'yes' && (
                      <DDInput
                        label={tr('Tell us more about your snoring', 'खर्राटों के बारे में और बताएं')}
                        value={dd.otherTexts['snoringDetail'] || ''}
                        onChange={(v) => setOtherText('snoringDetail', v)}
                        placeholder={tr('e.g. loud, every night, since 2 years', 'जैसे तेज़, हर रात, 2 साल से')}
                      />
                    )}
                    {dd.sleepApnea === 'yes' && (
                      <DDInput
                        label={tr('Tell us more about your sleep apnea', 'स्लीप एपनिया के बारे में और बताएं')}
                        value={dd.otherTexts['sleepApneaDetail'] || ''}
                        onChange={(v) => setOtherText('sleepApneaDetail', v)}
                        placeholder={tr('e.g. diagnosed in 2022, uses CPAP machine', 'जैसे 2022 में निदान, CPAP मशीन उपयोग करते हैं')}
                      />
                    )}
                  </div>
                )}
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 15: DAILY ROUTINE — a real timeline of when the user
              actually does things, not just isolated sleep/activity facts. */}
          {currentStep === 15 && (
            <motion.div key="step-15" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Your Daily Routine', 'आपकी दैनिक दिनचर्या')} subtitle={tr('When you wake, eat and move shapes your metabolism as much as what you eat.', 'आप कब उठते, खाते और चलते हैं — यह भी उतना ही मायने रखता है जितना आप क्या खाते हैं।')} />

              <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                <div className="grid grid-cols-2 gap-3">
                  <DDInput label={tr('What time do you wake up?', 'आप किस समय उठते हैं?')} value={dd.wakeUpTime} onChange={(v) => setDdField('wakeUpTime', v)} placeholder="e.g. 6:30 AM" />
                  <DDInput label={tr('What time do you exercise?', 'आप किस समय व्यायाम करते हैं?')} value={dd.exerciseTime} onChange={(v) => setDdField('exerciseTime', v)} placeholder={tr('e.g. 7:00 AM, or Not Applicable', 'जैसे 7:00 AM, या लागू नहीं')} />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black text-zinc-800">{tr('When do you usually eat?', 'आप आमतौर पर कब खाते हैं?')}</span>
                  <div className="grid grid-cols-3 gap-2">
                    <DDInput label={tr('Breakfast', 'नाश्ता')} value={dd.breakfastTime} onChange={(v) => setDdField('breakfastTime', v)} placeholder="8:00 AM" />
                    <DDInput label={tr('Lunch', 'दोपहर का भोजन')} value={dd.lunchTime} onChange={(v) => setDdField('lunchTime', v)} placeholder="1:00 PM" />
                    <DDInput label={tr('Dinner', 'रात का भोजन')} value={dd.dinnerTime} onChange={(v) => setDdField('dinnerTime', v)} placeholder="8:00 PM" />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black text-zinc-800">{tr('How long do you usually exercise?', 'आप आमतौर पर कितनी देर व्यायाम करते हैं?')}</span>
                  <DDChips
                    options={['Not Applicable', 'Less than 15 min', '15–30 min', '30–60 min', 'More than 60 min', 'Other']}
                    selected={dd.exerciseDuration ? [dd.exerciseDuration] : []}
                    onToggle={(v) => setDdField('exerciseDuration', v)}
                    otherValue={dd.otherTexts['exerciseDuration'] || ''}
                    onOtherChange={(v) => setOtherText('exerciseDuration', v)}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-black text-zinc-800">{tr('What does your work schedule look like?', 'आपकी काम की दिनचर्या कैसी है?')}</span>
                  <DDChips
                    options={['Regular day shift', 'Night shift', 'Rotating shift', 'Work from home', 'Not working / Student', 'Other']}
                    selected={dd.workSchedule ? [dd.workSchedule] : []}
                    onToggle={(v) => setDdField('workSchedule', v)}
                    otherValue={dd.otherTexts['workSchedule'] || ''}
                    onOtherChange={(v) => setOtherText('workSchedule', v)}
                  />
                </div>

                <DDTextArea
                  label={tr('Anything else about your daily routine?', 'आपकी दिनचर्या के बारे में कुछ और बताना चाहेंगे?')}
                  value={dd.dailyRoutineNotes}
                  onChange={(v) => setDdField('dailyRoutineNotes', v)}
                  placeholder={tr('e.g. commute time, nap habits, weekend routine differs a lot...', 'जैसे आने-जाने का समय, झपकी की आदतें, सप्ताहांत की दिनचर्या अलग है...')}
                />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 16: STRESS & EMOTIONAL WELLBEING */}
          {currentStep === 16 && (
            <motion.div key="step-16" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Stress & Emotional Wellbeing', 'तनाव व भावनात्मक स्वास्थ्य')} subtitle={tr('Chronic stress affects cortisol, sleep and blood sugar — help us understand yours.', 'लगातार तनाव आपके हार्मोन, नींद और शुगर को प्रभावित करता है — हमें बताएं आपकी स्थिति।')} />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('How would you rate your current stress?', 'आप अपने वर्तमान तनाव को कैसे आंकेंगे?')}</span>
                <DDChips options={['Low', 'Moderate', 'High', 'Overwhelming', 'Other']} selected={dd.stressLevel ? [dd.stressLevel] : []} onToggle={(v) => setDdField('stressLevel', v)}  otherValue={dd.otherTexts['stressLevel'] || ''} onOtherChange={(v) => setOtherText('stressLevel', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Main sources of stress', 'तनाव के मुख्य कारण')}</span>
                <DDChips options={['Work', 'Family', 'Financial', 'Relationship', 'Health', 'Studies', 'Sleep', 'Other']} selected={dd.stressSources} onToggle={(v) => toggleDdItem('stressSources', v)}  otherValue={dd.otherTexts['stressSources'] || ''} onOtherChange={(v) => setOtherText('stressSources', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Emotional symptoms you currently experience', 'आप फिलहाल किन भावनात्मक लक्षणों से गुजर रहे हैं')}</span>
                <DDChips options={['Constant worry', 'Racing thoughts', 'Difficulty relaxing', 'Sadness/low mood', 'Low motivation', 'None', 'Other']} selected={dd.emotionalSymptoms} onToggle={(v) => toggleDdItem('emotionalSymptoms', v)}  otherValue={dd.otherTexts['emotionalSymptoms'] || ''} onOtherChange={(v) => setOtherText('emotionalSymptoms', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('How do you usually manage stress?', 'आप आमतौर पर तनाव कैसे संभालते हैं?')}</span>
                <DDChips options={['Exercise', 'Meditation/Yoga', 'Talking to someone', 'Music', 'Sleep', 'Nothing currently', 'Other']} selected={dd.stressManagement} onToggle={(v) => toggleDdItem('stressManagement', v)}  otherValue={dd.otherTexts['stressManagement'] || ''} onOtherChange={(v) => setOtherText('stressManagement', v)} />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 17: GUT & DIGESTION */}
          {currentStep === 17 && (
            <motion.div key="step-17" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Gut & Digestion', 'पाचन तंत्र')} subtitle={tr('Digestive health affects nutrient absorption and our meal timing recommendations.', 'पाचन स्वास्थ्य पोषण अवशोषण और भोजन के समय को प्रभावित करता है।')} />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Bowel movement frequency', 'मल त्याग की आवृत्ति')}</span>
                <DDChips options={['Less than once/day', 'Once/day', '2 times/day', 'More than 2/day', 'Irregular', 'Other']} selected={dd.bowelFrequency ? [dd.bowelFrequency] : []} onToggle={(v) => setDdField('bowelFrequency', v)}  otherValue={dd.otherTexts['bowelFrequency'] || ''} onOtherChange={(v) => setOtherText('bowelFrequency', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Usual stool type', 'सामान्य मल प्रकार')}</span>
                <DDChips options={['Normal', 'Hard', 'Loose', 'Watery', 'Alternating', 'Other']} selected={dd.stoolType ? [dd.stoolType] : []} onToggle={(v) => setDdField('stoolType', v)}  otherValue={dd.otherTexts['stoolType'] || ''} onOtherChange={(v) => setOtherText('stoolType', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Digestive symptoms', 'पाचन संबंधी लक्षण')}</span>
                <DDChips options={['Constipation', 'Loose motions', 'Acidity/heartburn', 'Bloating/gas', 'Nausea', 'None', 'Other']} selected={dd.digestiveSymptoms} onToggle={(v) => toggleDdItem('digestiveSymptoms', v)}  otherValue={dd.otherTexts['digestiveSymptoms'] || ''} onOtherChange={(v) => setOtherText('digestiveSymptoms', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Diagnosed digestive conditions', 'निदान की गई पाचन समस्याएं')}</span>
                <DDChips options={['IBS', 'GERD', 'Gastritis', 'Ulcer', 'Lactose intolerance', 'None', 'Other']} selected={dd.digestiveConditions} onToggle={(v) => toggleDdItem('digestiveConditions', v)}  otherValue={dd.otherTexts['digestiveConditions'] || ''} onOtherChange={(v) => setOtherText('digestiveConditions', v)} />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 18: LIFESTYLE HABITS */}
          {currentStep === 18 && (
            <motion.div key="step-18" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Lifestyle Habits', 'जीवनशैली की आदतें')} subtitle={tr('Alcohol, tobacco, hydration and screen time all factor into your metabolic plan.', 'शराब, तंबाकू, पानी की मात्रा और स्क्रीन टाइम — सब आपकी योजना में शामिल होते हैं।')} />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Alcohol consumption', 'शराब का सेवन')}</span>
                <DDChips options={['Never', 'Occasionally', 'Weekly', 'Daily', 'Previously used, stopped', 'Other']} selected={dd.alcohol ? [dd.alcohol] : []} onToggle={(v) => setDdField('alcohol', v)}  otherValue={dd.otherTexts['alcohol'] || ''} onOtherChange={(v) => setOtherText('alcohol', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Smoking / tobacco use', 'धूम्रपान / तंबाकू का सेवन')}</span>
                <DDChips options={['Never', 'Occasionally', 'Daily', 'Previously used, stopped', 'Other']} selected={dd.tobacco ? [dd.tobacco] : []} onToggle={(v) => setDdField('tobacco', v)}  otherValue={dd.otherTexts['tobacco'] || ''} onOtherChange={(v) => setOtherText('tobacco', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Daily water intake', 'दैनिक पानी का सेवन')}</span>
                <DDChips options={['Less than 1 L', '1–2 L', '2–3 L', 'More than 3 L', 'Other']} selected={dd.waterIntake ? [dd.waterIntake] : []} onToggle={(v) => setDdField('waterIntake', v)}  otherValue={dd.otherTexts['waterIntake'] || ''} onOtherChange={(v) => setOtherText('waterIntake', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Tea / coffee per day', 'रोज़ाना चाय / कॉफी')}</span>
                <DDChips options={['None', '1 cup', '2 cups', '3+ cups', 'Other']} selected={dd.teaCoffee ? [dd.teaCoffee] : []} onToggle={(v) => setDdField('teaCoffee', v)}  otherValue={dd.otherTexts['teaCoffee'] || ''} onOtherChange={(v) => setOtherText('teaCoffee', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('How often do you eat fried food?', 'आप कितनी बार तला हुआ खाना खाते हैं?')}</span>
                <DDChips options={['Rarely', '1–2 times/week', '3–4 times/week', 'Daily', 'Other']} selected={dd.friedFoodFreq ? [dd.friedFoodFreq] : []} onToggle={(v) => setDdField('friedFoodFreq', v)}  otherValue={dd.otherTexts['friedFoodFreq'] || ''} onOtherChange={(v) => setOtherText('friedFoodFreq', v)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DDInput label={tr('Daily screen time (hrs)', 'दैनिक स्क्रीन समय (घंटे)')} value={dd.screenTimeHours} onChange={(v) => setDdField('screenTimeHours', v)} placeholder="e.g. 6" />
                <DDInput label={tr('Daily sitting hours', 'दैनिक बैठने के घंटे')} value={dd.sittingHours} onChange={(v) => setDdField('sittingHours', v)} placeholder="e.g. 8" />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 19: FAMILY HISTORY */}
          {currentStep === 19 && (
            <motion.div key="step-19" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Family History', 'पारिवारिक इतिहास')} subtitle={tr('Genetic predisposition helps us flag risks earlier and personalize prevention.', 'पारिवारिक जोखिम जानने से हम पहले ही सचेत होकर बचाव की योजना बना सकते हैं।')} />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Does anyone in your family have these conditions?', 'क्या आपके परिवार में किसी को ये स्थितियां हैं?')}</span>
                <DDChips
                  options={['Diabetes', 'High BP', 'Heart disease', 'Thyroid disease', 'PCOS/PCOD', 'High cholesterol', 'Obesity', 'Cancer', 'Kidney disease', 'Mental health condition', 'No known history', 'Other']}
                  selected={dd.familyHistory}
                  onToggle={(v) => toggleDdItem('familyHistory', v)}
                 otherValue={dd.otherTexts['familyHistory'] || ''} onOtherChange={(v) => setOtherText('familyHistory', v)} />
              </div>

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 20: GENDER-SPECIFIC HEALTH */}
          {currentStep === 20 && (
            <motion.div key="step-20" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              {gender === 'female' ? (
                <>
                  <DDHeader title={tr("Women's Health", 'महिला स्वास्थ्य')} subtitle={tr('Hormonal and reproductive health context for your personalized plan.', 'आपकी व्यक्तिगत योजना के लिए हार्मोनल व प्रजनन स्वास्थ्य जानकारी।')} />
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Menstrual status', 'मासिक धर्म की स्थिति')}</span>
                    <DDChips options={['Regular periods', 'Irregular periods', 'Menopause', 'Post-menopause', 'Other']} selected={dd.menstrualStatus ? [dd.menstrualStatus] : []} onToggle={(v) => setDdField('menstrualStatus', v)}  otherValue={dd.otherTexts['menstrualStatus'] || ''} onOtherChange={(v) => setOtherText('menstrualStatus', v)} />
                  </div>
                  {(dd.menstrualStatus === 'Regular periods' || dd.menstrualStatus === 'Irregular periods') && (
                    <DDInput label={tr('Average cycle length (days)', 'औसत चक्र लंबाई (दिन)')} value={dd.cycleLength} onChange={(v) => setDdField('cycleLength', v)} placeholder="e.g. 28" />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <span className="text-xs font-black text-zinc-800">{tr('Diagnosed with PCOS/PCOD?', 'PCOS/PCOD का निदान हुआ है?')}</span>
                      <DDYesNo value={dd.pcos} onChange={(v) => setDdField('pcos', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }, { id: 'not_sure', label: tr('Not sure', 'पक्का नहीं') }]} />
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-black text-zinc-800">{tr('Currently pregnant?', 'क्या आप गर्भवती हैं?')}</span>
                      <DDYesNo value={dd.pregnant} onChange={(v) => setDdField('pregnant', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }, { id: 'not_sure', label: tr('Not sure', 'पक्का नहीं') }]} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Menopause/perimenopause symptoms (if any)', 'मेनोपॉज़/पेरिमेनोपॉज़ के लक्षण (यदि हों)')}</span>
                    <DDChips options={['Hot flashes', 'Night sweats', 'Mood changes', 'Weight gain', 'None', 'Other']} selected={dd.menopauseSymptoms} onToggle={(v) => toggleDdItem('menopauseSymptoms', v)}  otherValue={dd.otherTexts['menopauseSymptoms'] || ''} onOtherChange={(v) => setOtherText('menopauseSymptoms', v)} />
                  </div>
                </>
              ) : (
                <>
                  <DDHeader title={tr("Men's Hormonal Health", 'पुरुष हार्मोनल स्वास्थ्य')} subtitle={tr('Energy, muscle mass and hormonal balance context for your personalized plan.', 'आपकी योजना के लिए ऊर्जा, मांसपेशी व हार्मोनल संतुलन जानकारी।')} />
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Energy throughout the day', 'दिनभर की ऊर्जा')}</span>
                    <DDChips options={['Very low', 'Low', 'Moderate', 'Good', 'Excellent', 'Other']} selected={dd.energyLevel ? [dd.energyLevel] : []} onToggle={(v) => setDdField('energyLevel', v)}  otherValue={dd.otherTexts['energyLevel'] || ''} onOtherChange={(v) => setOtherText('energyLevel', v)} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Libido / sexual drive', 'यौन इच्छा')}</span>
                    <DDChips options={['Very low', 'Low', 'Normal', 'High', 'Prefer not to answer', 'Other']} selected={dd.libido ? [dd.libido] : []} onToggle={(v) => setDdField('libido', v)}  otherValue={dd.otherTexts['libido'] || ''} onOtherChange={(v) => setOtherText('libido', v)} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Diagnosed with low testosterone or hormonal problem?', 'लो टेस्टोस्टेरोन या हार्मोनल समस्या का निदान हुआ है?')}</span>
                    <DDYesNo value={dd.lowTestosterone} onChange={(v) => setDdField('lowTestosterone', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }, { id: 'not_sure', label: tr('Not sure', 'पक्का नहीं') }]} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-zinc-800">{tr('Prostate / urination symptoms', 'प्रोस्टेट / पेशाब संबंधी लक्षण')}</span>
                    <DDChips options={['Frequent urination', 'Difficulty urinating', 'Enlarged prostate diagnosed', 'None', 'Other']} selected={dd.prostateSymptoms} onToggle={(v) => toggleDdItem('prostateSymptoms', v)}  otherValue={dd.otherTexts['prostateSymptoms'] || ''} onOtherChange={(v) => setOtherText('prostateSymptoms', v)} />
                  </div>
                </>
              )}

              <DDContinue />
            </motion.div>
          )}

          {/* STEP 21: SYMPTOMS, READINESS & PERSONALIZATION */}
          {currentStep === 21 && (
            <motion.div key="step-21" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-5">
              <DDHeader title={tr('Symptoms, Readiness & Notes', 'लक्षण, तैयारी व अन्य जानकारी')} subtitle={tr('A final check on how you feel day-to-day, and anything the doctor should know.', 'आप रोज़मर्रा में कैसा महसूस करते हैं और डॉक्टर को क्या पता होना चाहिए — अंतिम जानकारी।')} />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Any of these symptoms bothering you?', 'क्या आपको इनमें से कोई लक्षण परेशान कर रहा है?')}</span>
                <DDChips
                  options={['Tingling/numbness in hands or feet', 'Blurry vision', 'Swelling in feet/legs', 'Chest pain/breathlessness', 'Joint pain/stiffness', 'Headaches/brain fog', 'Skin dryness/dark patches', 'None', 'Other']}
                  selected={dd.organSymptoms}
                  onToggle={(v) => toggleDdItem('organSymptoms', v)}
                 otherValue={dd.otherTexts['organSymptoms'] || ''} onOtherChange={(v) => setOtherText('organSymptoms', v)} />
              </div>

              <DDInput label={tr('Biggest thing stopping you from improving your health', 'आपके स्वास्थ्य सुधार में सबसे बड़ी बाधा')} value={dd.biggestBarrier} onChange={(v) => setDdField('biggestBarrier', v)} placeholder={tr('e.g. Lack of time, no motivation...', 'जैसे समय की कमी, प्रेरणा न होना...')} />

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('What would help you the most?', 'आपकी सबसे ज़्यादा मदद क्या करेगी?')}</span>
                <DDChips options={['Simple meal plans', 'Quick home workouts', 'Daily accountability', 'Flexible timings', 'Health education', 'Stress management', 'Other']} selected={dd.helpNeeded} onToggle={(v) => toggleDdItem('helpNeeded', v)}  otherValue={dd.otherTexts['helpNeeded'] || ''} onOtherChange={(v) => setOtherText('helpNeeded', v)} />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-zinc-800">{tr('Are you currently seeing another doctor/specialist?', 'क्या आप फिलहाल किसी और डॉक्टर/विशेषज्ञ को दिखा रहे हैं?')}</span>
                <DDYesNo value={dd.seeingSpecialist} onChange={(v) => setDdField('seeingSpecialist', v as YesNo)} options={[{ id: 'yes', label: tr('Yes', 'हां') }, { id: 'no', label: tr('No', 'नहीं') }]} />
                {dd.seeingSpecialist === 'yes' && (
                  <DDInput label={tr('Specialist & condition being treated', 'विशेषज्ञ व इलाज की जा रही स्थिति')} value={dd.specialistDetails} onChange={(v) => setDdField('specialistDetails', v)} placeholder={tr('e.g. Endocrinologist, thyroid management', 'जैसे एंडोक्राइनोलॉजिस्ट, थायरॉइड प्रबंधन')} />
                )}
              </div>

              <DDTextArea label={tr('Anything specific you want the doctor/health team to know? (optional)', 'डॉक्टर/स्वास्थ्य टीम को कुछ खास बताना चाहें? (वैकल्पिक)')} value={dd.doctorNotes} onChange={(v) => setDdField('doctorNotes', v)} placeholder={tr('Food preferences, medicine concerns, work timings, budget, family situation...', 'भोजन पसंद, दवा संबंधी चिंता, काम का समय, बजट, पारिवारिक स्थिति...')} />

              <DDContinue label={tr('Continue to Profile', 'प्रोफ़ाइल की ओर बढ़ें')} />
            </motion.div>
          )}

          {/* STEP 22: USER CONTACT & PROFILE REVIEW */}
          {currentStep === 22 && (
            <motion.div
              key="step-22"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">{tr('Confirm Your Profile', 'अपनी प्रोफ़ाइल की पुष्टि करें')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('We will send your daily nutrition reports and physician sync alerts here.', 'हम आपकी दैनिक रिपोर्ट व डॉक्टर संबंधी सूचनाएं यहीं भेजेंगे।')}</p>
              </div>

              <div className={`p-6 rounded-3xl ${cardClass} space-y-4`}>
                {/* 1. Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black text-zinc-800">
                      {tr('Full Name', 'पूरा नाम')} <span className="text-rose-600 font-black">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {tr('Mandatory', 'अनिवार्य')}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (contactErrors.name) setContactErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder={tr('e.g. Rahul Sharma', 'जैसे राहुल शर्मा')}
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
                      {tr('Email Address', 'ईमेल पता')} <span className="text-rose-600 font-black">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {tr('Mandatory', 'अनिवार्य')}
                    </span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (contactErrors.email) setContactErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder={tr('e.g. rahul@gmail.com', 'जैसे rahul@gmail.com')}
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
                      {tr('Phone Number (WhatsApp Sync)', 'फ़ोन नंबर (WhatsApp सिंक)')} <span className="text-rose-600 font-black">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {tr('Mandatory', 'अनिवार्य')}
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
                    {tr('Referral / Promo Code (Optional)', 'रेफरल / प्रोमो कोड (वैकल्पिक)')}
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder={tr('e.g. HEALTHIFY50', 'जैसे HEALTHIFY50')}
                    className="w-full p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white text-zinc-900 text-xs font-medium focus:border-emerald-600 outline-none shadow-xs uppercase"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={validateAndProceedFromContact}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all active:scale-98"
              >
                <span>{tr('Continue', 'आगे बढ़ें')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 23: HABITS & MOTIVATION */}
          {currentStep === 23 && (
            <motion.div
              key="step-23"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-black text-zinc-950">{tr('Daily Preferences', 'दैनिक प्राथमिकताएं')}</h2>
                <p className="text-xs text-zinc-500 mt-1">{tr('Customize your calorie burn and tracking behavior.', 'अपनी कैलोरी बर्न व ट्रैकिंग सेटिंग्स अनुकूलित करें।')}</p>
              </div>

              <div className="space-y-3">
                <div className={`p-4 rounded-2xl ${cardClass} flex items-center justify-between`}>
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900">{tr('Exercise Burns Calories Back', 'वर्कआउट कैलोरी वापस जोड़ें')}</div>
                    <div className="text-[10px] text-zinc-500">{tr('Add workout calories to your daily food budget', 'वर्कआउट की कैलोरी को दैनिक भोजन बजट में जोड़ें')}</div>
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
                    <div className="text-xs font-extrabold text-zinc-900">{tr('Weekend Rollover Calories', 'वीकेंड रोलओवर कैलोरी')}</div>
                    <div className="text-[10px] text-zinc-500">{tr('Save unconsumed calories for weekend social meals', 'बची कैलोरी वीकेंड के भोजन के लिए बचाएं')}</div>
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
                    <div className="text-xs font-extrabold text-zinc-900">{tr('Smart Water & Meal Reminders', 'स्मार्ट पानी व भोजन रिमाइंडर')}</div>
                    <div className="text-[10px] text-zinc-500">{tr('Pushes timely hydration alerts throughout the day', 'दिनभर समय पर पानी पीने की सूचना')}</div>
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
                <span>{tr('Continue to Commitment', 'संकल्प की ओर बढ़ें')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 24: COMMITMENT HOLD BUTTON (HEALTHIFY SIGNATURE) */}
          {currentStep === 24 && (
            <motion.div
              key="step-24"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 text-center py-4"
            >
              <div className="space-y-2">
                <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                  <Award className="w-7 h-7" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950">{tr('Commit to Your 90-Day Plan', 'अपनी 90-दिन योजना के लिए संकल्प लें')}</h2>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {tr('Hold the button below for 2 seconds to seal your commitment and trigger clinical calibration.', 'नीचे बटन को 2 सेकंड दबाकर रखें ताकि आपका संकल्प पक्का हो और योजना तैयार होना शुरू हो जाए।')}
                </p>
              </div>

              {/* Summary Card */}
              <div className={`p-5 rounded-3xl ${cardClass} text-left space-y-2.5 max-w-md mx-auto`}>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">{tr('Current Weight:', 'वर्तमान वज़न:')}</span>
                  <span className="text-zinc-900 font-extrabold">{currentWeightKg} kg</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">{tr('Target Goal:', 'लक्ष्य वज़न:')}</span>
                  <span className="text-emerald-600 font-black">{targetWeightKg} kg ({pace})</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">{tr('Diet Type:', 'आहार प्रकार:')}</span>
                  <span className="text-zinc-900 font-extrabold">{dietaryPreference}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500">{tr('Clinical Focus:', 'मुख्य फोकस:')}</span>
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
                    <span>{isHolding ? tr(`Calibrating (${holdProgress}%)...`, `तैयार हो रहा है (${holdProgress}%)...`) : tr('Press & Hold to Commit', 'संकल्प के लिए दबाकर रखें')}</span>
                  </div>
                </button>
                <span className="block text-[11px] text-zinc-400 mt-2 font-semibold">
                  {tr('Hold down until the green bar fills 100%', 'हरी पट्टी के 100% भरने तक दबाए रखें')}
                </span>
              </div>
            </motion.div>
          )}

          {/* STEP 25: LIVE MULTI-PHASE CALIBRATION SCREEN */}
          {currentStep === 25 && (
            <motion.div
              key="step-25"
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
                    stroke="#008000"
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
                <h3 className="text-xl font-black text-zinc-950">{tr('Generating UrCare Metabolic Roadmap', 'UrCare मेटाबॉलिक योजना तैयार हो रही है')}</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium leading-relaxed">
                  {calcPhaseText}
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-2 text-left pt-2">
                {[
                  { label: tr('Metabolic BMR Index', 'मेटाबॉलिक BMR इंडेक्स'), done: calcProgress >= 30 },
                  { label: tr('Macro Split: Protein, Carbs & Fats', 'मैक्रो विभाजन: प्रोटीन, कार्ब्स व फैट'), done: calcProgress >= 60 },
                  { label: tr('Target Calorie Budget & Water Index', 'लक्ष्य कैलोरी बजट व पानी सूचकांक'), done: calcProgress >= 85 },
                  { label: tr('Physician Review Ready', 'डॉक्टर समीक्षा हेतु तैयार'), done: calcProgress >= 100 },
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
      {currentStep > 0 && currentStep < 25 && (
        <footer className="w-full max-w-xl mx-auto flex items-center justify-between pt-4 border-t border-zinc-200/80">
          <button
            type="button"
            onClick={prevStep}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{tr('Back', 'पीछे')}</span>
          </button>

          <span className="text-[11px] font-bold text-zinc-400">
            {tr('UrCare Precision Engine', 'UrCare प्रिसिजन इंजन')}
          </span>
        </footer>
      )}

      {/* FINAL POPUP MODAL: PLAN READY — a warm milestone checkpoint, not a
          sales pitch, with a single clear way forward. */}
      <AnimatePresence>
        {showPlanPopUp && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-zinc-200 shadow-2xl space-y-6 text-left relative overflow-hidden"
            >
              {/* Soft celebratory glow, matching the dashboard's brand backdrop */}
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-16 w-40 h-40 rounded-full bg-teal-100/50 blur-3xl pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

              <div className="relative text-center space-y-2 pt-2">
                <motion.div
                  initial={{ scale: 0.6, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.1 }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30"
                >
                  <CheckCircle2 className="w-7 h-7" />
                </motion.div>
                <h3 className="text-2xl font-black text-zinc-950">{tr('Your Plan is Ready!', 'आपकी योजना तैयार है!')}</h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  {tr(
                    "We've calibrated a personalized daily nutrition and lifestyle plan from everything you shared — your dashboard is set up and ready to go.",
                    'आपकी दी गई जानकारी से हमने आपका व्यक्तिगत दैनिक पोषण व जीवनशैली प्लान तैयार कर दिया है — आपका डैशबोर्ड अब तैयार है।'
                  )}
                </p>
              </div>

              {/* Launch Button */}
              <button
                id="yourcare-enter-dashboard-btn"
                type="button"
                onClick={() => handleFinishOnboarding()}
                className="relative w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <span>{tr('View My Plan', 'मेरी योजना देखें')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="relative text-[10px] text-center text-zinc-400 font-semibold">
                {tr('256-Bit Encrypted Healthcare Architecture', '256-बिट एन्क्रिप्टेड हेल्थकेयर सुरक्षा')}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

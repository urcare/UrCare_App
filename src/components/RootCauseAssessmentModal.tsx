import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Check, ChevronRight, ChevronLeft, ShieldCheck, Heart, AlertTriangle, 
  Stethoscope, Clock, Calendar, Activity, Pill, Moon, Sparkles, Scale,
  User, CheckCircle2, FileText, Upload, Printer, ArrowRight, Zap, Volume2, VolumeX,
  Target, Apple, Dumbbell, CheckSquare, Flame
} from 'lucide-react';
import { RootCauseAssessmentData, UserHealthProfile } from '../types';
import { playClickSound, playScrollTickSound, playSuccessChime, setSoundEnabled, getSoundEnabled } from '../utils/soundEffects';

interface RootCauseAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  onSaveAssessment: (data: RootCauseAssessmentData) => void;
}

// ---------------------------------------------------------------------------
// Small reusable form primitives shared across all 22 assessment modules.
// ---------------------------------------------------------------------------

const inputClass = 'w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="text-xs font-bold block mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>}
  </div>
);

const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input {...props} className={`${inputClass} ${className || ''}`} />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea {...props} className={`${inputClass} ${className || ''}`} />
);

const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select {...props} className={`${inputClass} ${className || ''}`}>
    {children}
  </select>
);

const YesNo: React.FC<{ value?: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[true, false].map((v) => (
      <button
        key={String(v)}
        type="button"
        onClick={() => onChange(v)}
        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
          value === v
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-500'
        }`}
      >
        {v ? 'Yes' : 'No'}
      </button>
    ))}
  </div>
);

// Multi-select from a fixed, common list of options (chip toggle).
const ChipToggle: React.FC<{ options: string[]; selected: string[]; onChange: (next: string[]) => void }> = ({ options, selected, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = selected.includes(opt);
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            active
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-emerald-400'
          }`}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

// Free-form tag list: type a value, press Enter or comma to add; click a chip's × to remove.
const TagsInput: React.FC<{ values: string[]; onChange: (next: string[]) => void; placeholder?: string }> = ({ values, onChange, placeholder }) => {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v, i) => (
          <span key={`${v}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="hover:text-rose-500 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        placeholder={placeholder || 'Type and press Enter to add...'}
        onChange={(e) => {
          if (e.target.value.endsWith(',')) {
            const v = e.target.value.slice(0, -1).trim();
            if (v) onChange([...values, v]);
            setDraft('');
          } else {
            setDraft(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        className={inputClass}
      />
    </div>
  );
};

export const RootCauseAssessmentModal: React.FC<RootCauseAssessmentModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveAssessment,
}) => {
  const [soundOn, setSoundOn] = useState(getSoundEnabled());
  const [activeSection, setActiveSection] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Form State initialized with profile or defaults
  const [formData, setFormData] = useState<RootCauseAssessmentData>(() => {
    if (profile.assessmentData) return profile.assessmentData;

    return {
      email: profile.email || 'singhkgajendra6276@gmail.com',
      whatsappNumber: profile.phone || '',
      preferredContactMethod: 'whatsapp',
      bestContactTime: 'evening',
      communicationLanguage: 'English / Hindi',
      backupContactName: '',
      backupContactRelationship: '',
      backupContactNumber: '',

      fullName: profile.name || '',
      age: profile.age || 29,
      gender: profile.gender || 'male',
      heightFeet: Math.floor((profile.heightCm || 172) / 30.48),
      heightInches: Math.round(((profile.heightCm || 172) % 30.48) / 2.54),
      currentWeightKg: profile.currentWeightKg || 74,
      highestWeightKg: 82,
      highestWeightWhen: '2023',
      waistCircumferenceInches: 34,
      cityStateCountry: 'India',
      occupation: 'Professional',
      workHoursPerDay: 8,
      workType: 'seated',

      mainHealthConcern: 'Diabetes Reversal & Metabolic Root Cause Restoration',
      bothersomeSymptoms: 'Post-meal fatigue, morning sugar fluctuation, occasional brain fog',
      goal90to120Days: 'Reduce HbA1c to normal range (<5.7%), eliminate insulin resistance, reduce visceral fat',
      overallHealthRating: 6,
      energyLevelRating: 6,
      qualityOfLifeRating: 7,
      successfulTreatmentVision: 'Complete freedom from medications, steady all-day energy, ideal biomarkers',

      diagnosedConditions: [
        {
          conditionName: 'Type 2 Diabetes / Pre-diabetes',
          diagnosedMonthYear: 'Jan 2022',
          currentStatus: 'uncontrolled',
          severityRating: 6,
          beganWhen: '2 years ago',
          currentTreatment: 'Diet & oral hypoglycemics',
        }
      ],
      hospitalisationHistory: 'None',
      emergencyEpisodeHistory: 'None',

      medicinesList: [
        {
          name: 'Metformin',
          dose: '500mg',
          timing: 'After dinner',
          frequencyPerDay: 'Once daily',
          sinceWhen: '1 year',
          reason: 'Blood sugar control'
        }
      ],
      vitaminsAndSupplements: 'Vitamin D3 (60k IU), Methylcobalamin B12',
      insulinDetails: {
        isUsingInsulin: false,
        basalInsulin: '',
        rapidBreakfastUnits: '',
        rapidLunchUnits: '',
        rapidDinnerUnits: '',
        totalDailyDose: '',
        recentDoseChanges: '',
        lowSugarEpisodes: 'None',
      },
      steroidsLast6Months: 'None',
      medicinesStoppedLast3Months: 'None',
      medicinesStoppedReason: '',
      frequentlyMissedMedicines: 'None',
      allergies: {
        medicineAllergies: 'None known',
        foodAllergies: 'None',
        environmentalAllergies: 'Seasonal pollen (mild)',
        adverseReactions: 'None',
      },

      bloodSugar: {
        monitorsSugar: true,
        monitoringMethod: 'glucometer',
        averageFasting7Days: '135 mg/dL',
        averagePostMeal7Days: '175 mg/dL',
        morningSpikes: true,
        postMealSpikes: true,
        lowSugarEpisodes: false,
        lowSugarDetails: 'None',
        latestHbA1c: '7.2%',
        latestHbA1cDate: 'Last month',
        hba1c3MonthsAgo: '7.5%',
        hba1c6MonthsAgo: '7.8%',
        highestHbA1cEver: '8.4%',
      },
      cardioVitals: {
        recentBp: '124/82 mmHg',
        usualBpRange: '120-130 / 80-85 mmHg',
        standingDizziness: false,
        restingPulse: '72 bpm',
        palpitations: false,
        currentWeight: `${profile.currentWeightKg || 74} kg`,
        weight3MonthsAgo: '75 kg',
        weight6MonthsAgo: '76 kg',
        spO2: '98%',
        ketone: 'Negative',
        creatinine: '0.9 mg/dL',
        egfr: '>90 mL/min',
        uricAcid: '5.6 mg/dL',
        otherTracked: 'Normal lipid profile',
      },

      sleep: {
        sleepTime: '11:30 PM',
        wakeUpTime: '06:30 AM',
        averageSleepHours: 7,
        sleepQuality: 'average',
        difficultyFallingAsleep: false,
        wakesDuringNight: true,
        wakeCount: '1 time',
        nightTimeUrinationCount: '1 time',
        wakesRefreshed: false,
        snores: 'Mild',
        gaspOrStopBreathing: 'No',
        sleepApnoeaDiagnosed: false,
        cpapUsed: false,
        daytimeSleepinessNapping: 'Occasional post-lunch slump',
        sleepMedicineOrAid: 'None',
        shiftWork: false,
        sleepDisturbances: 'Late screen time, work thoughts',
      },
      stressMental: {
        stressLevel: 'moderate',
        mainSourcesOfStress: 'Work responsibilities and health uncertainty',
        majorTraumaLast2Years: false,
        traumaExplanation: '',
        emotionalSymptoms: ['Difficulty Relaxing', 'Constant Worry'],
        mentalConditionDiagnosed: false,
        mentalHealthMedsOrTherapy: 'None',
        stressManagementMethods: 'Evening walks, music',
        emotionalWellbeingRating: 7,
      },

      gut: {
        bowelFrequency: 'Once daily (morning)',
        stoolType: 'normal',
        symptoms: ['Bloating or Gas', 'Heaviness After Meals'],
        symptomFrequency: '2-3 times a week',
        appetite: 'normal',
        diagnosedConditions: ['Mild Acidity / GERD'],
        antibioticUseLast6Months: false,
        regularAcidityMedicines: true,
        probioticsOrEnzymes: false,
        triggerFoods: 'Deep fried items, excessive spicy lentils',
      },

      labReports: {
        hasRecentTests: true,
        uploadedFileNames: ['HbA1c_Lipid_Panel_Report.pdf'],
        reportNotes: 'HbA1c 7.2%, HOMA-IR indicates moderate insulin resistance.',
      },

      previousTreatments: {
        treatmentsTried: ['Prescription Medicines', 'Diet Plan', 'Walking Programme'],
        whatImproved: 'Short term sugar stabilization',
        whatDidNotImprove: 'Root cause insulin sensitivity & visceral fat did not reverse',
        whyStopped: 'Lack of personalization and sustainable daily guidance',
        improvementRemained: 'partially',
      },

      diet: {
        dietType: profile.dietaryPreference || 'Vegetarian',
        regionalPreference: 'North / Central Indian home-cooked meals',
        mealsPerDay: 3,
        firstMealTime: '08:30 AM',
        lastMealTime: '08:30 PM',
        lateNightEating: false,
        breakfast: 'Poha / Oats / Besan Chilla with tea',
        lunch: '2 Rotis, Dal, Green Sabzi, Curd / Salad',
        dinner: 'Moong Dal Khichdi / Vegetable soup & Paneer salad',
        snacks: 'Roasted Makhana, walnuts, green tea',
        teaCoffeeCount: '2 cups/day',
        addsSugarOrHoney: false,
        friedFoodFrequency: 'Once a week',
        sweetsFrequency: 'Rarely',
        packagedFoodFrequency: '1-2 times a week',
        outsideFoodFrequency: 'Once on weekends',
        waterIntakeLiters: '2.5 - 3.0 Litres',
        foodDislikesOrRestrictions: 'No bitter gourd, low spice',
        cravedFoods: 'Warm savory snacks',
        alcoholTobaccoUse: 'None',
        previousDietHistory: 'Tried low-carb intermittent fasting previously',
        eatingDisorderHistory: false,
      },

      lifestyle: {
        regularExercise: true,
        exerciseType: 'Brisk walking & light yoga',
        frequencyDaysPerWeek: 4,
        durationMinutes: 35,
        timing: 'Morning 07:00 AM',
        noExerciseReason: '',
        sittingHoursPerDay: 7,
        screenTimeHoursPerDay: 6,
        nonExerciseMovement: 'Household chores and climbing office stairs',
        physicalLimitationsOrInjuries: 'Mild lower back stiffness on prolonged sitting',
      },

      familyHistory: {
        diabetes: 'Father (Diagnosed at age 52)',
        hypertension: 'Mother (Diagnosed at age 58)',
        heartDisease: 'None',
        thyroid: 'None',
        pcosHormonal: 'None',
        cholesterol: 'Paternal Grandfather',
        obesity: 'Moderate tendency in family',
        autoimmune: 'None',
        cancer: 'None',
        kidneyDisease: 'None',
        liverDisease: 'None',
        mentalHealth: 'None',
        otherConditions: 'None',
      },

      hormonalWomen: {
        menstrualStatus: 'Regular periods',
        cycleLengthDays: '28-30',
        periodDurationDays: '4-5',
        flow: 'Normal',
        menstrualCramps: 'Mild',
        pmsSymptoms: ['Mood changes', 'Bloating'],
        pcodPcosDiagnosis: 'None',
        thyroidDiagnosisAndMeds: 'None',
        currentlyPregnant: false,
        planningPregnancy: false,
        currentlyBreastfeeding: false,
        skinIssues: ['Occasional dryness'],
      },

      hormonalMen: {
        energyLevel: 'Moderate',
        libido: 'Normal',
        erectileDifficulty: 'No',
        morningErectionsRegular: true,
        muscleMassTrend: 'Stable',
        facialBodyHairGrowth: 'Normal',
        gynecomastia: 'No',
        moodChanges: 'Occasional stress-related fatigue',
        diagnosedLowTestosterone: 'Not tested',
        prostateIssues: 'None',
      },

      organHealth: {
        diabetesComplications: ['Tingling or mild numbness in toes after long days', 'Occasional excessive thirst'],
        cardiovascularSymptoms: [],
        liverSymptoms: ['Grade 1 Fatty Liver noted on ultrasound'],
        kidneySymptoms: [],
        thyroidSymptoms: [],
        jointBoneSymptoms: ['Occasional morning lower back stiffness'],
        neurologicalSymptoms: ['Occasional brain fog after heavy meals'],
        skinSymptoms: ['Mild skin tags on neck'],
        respiratorySymptoms: [],
        unusualSymptomsNotes: 'No other unusual complaints',
      },

      readiness: {
        mainBarriers: 'Busy work schedule and social outside food dining',
        helpfulFactors: [
          'Simple meal plans that fit my schedule',
          'Family-friendly recipes everyone can eat',
          'Daily accountability and motivation',
          'Clear step-by-step guidance',
          'Help managing stress and emotions'
        ],
        healthPriorityWillingness: 'Yes, fully committed',
        hoursPerWeekCommitment: '5 to 7 hours per week',
        motivatedForRootCause: true,
        canCommit90Days: true,
        familySupport: true,
      },

      startTimeline: 'within_3_days',
      reversalIntensity: 'advanced',
      reversalIntensityCustomNote: 'Structured approach with steady biomarker reduction and doctor supervision',

      dailyRoutine: {
        wakeUpTime: '06:30 AM',
        morningRoutine: 'Warm water with lemon, 25-min walk, fresh bath',
        breakfastTime: '08:30 AM',
        midMorningSnackTime: '11:00 AM (Green tea & almonds)',
        lunchTime: '01:30 PM',
        eveningSnackTeaTime: '05:30 PM (Herbal tea & roasted chana)',
        dinnerTime: '08:30 PM',
        sleepTime: '11:30 PM',
        workHours: '09:30 AM - 06:30 PM',
        dailySittingHoursAtWork: '6-7 hours',
        commuteTimeAndMode: '30 mins by car / metro',
        availableTimeForExercise: 'Morning 07:00 AM - 07:45 AM',
        mealPrepManager: 'Self & spouse home-cooked',
        weekendScheduleDifference: 'Slightly delayed breakfast (09:30 AM) and outdoor cycling',
      },

      exercisePlan: {
        preferredExerciseTypes: [
          'Walking or brisk walking (outdoor or treadmill)',
          'Yoga asanas and pranayama',
          'Functional training or HIIT'
        ],
        gymOrEquipmentAccess: 'Dumbbells and yoga mat at home, neighborhood walking track',
        bestTimeSlot: 'morning',
        limitationsExplanation: 'Avoid excessive heavy deadlifts due to previous lower back strain',
      },

      personalQueryRequest: 'I want to know if I can safely taper off Metformin once my fasting sugar drops below 100 mg/dL and how to prevent post-prandial spikes after festive meals.',

      additionalInfo: {
        pastSurgeriesOrIllnesses: 'Appendectomy in 2018 (fully healed)',
        ongoingSpecialistTreatments: 'Annual endocrinology checkup',
        geneticOrRareConditions: 'Strong familial predisposition to metabolic syndrome',
        occupationChallenges: 'Continuous screen time and sedentary meetings',
        livingSituation: 'Living with family in metropolitan city',
        whoManagesMeals: 'Home kitchen prepared fresh with low refined oil',
        treatmentRequirements: 'Personalized polyherbal support, continuous monitoring, structured guidance',
        questionsForDoctor: 'How rapidly can liver fat and insulin resistance reverse with this protocol?',
        patientExtraNotes: 'Ready to dedicate 100% effort to achieve total metabolic reversal.',
      },

      submittedAt: new Date().toISOString(),
    };
  });

  if (!isOpen) return null;

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playClickSound(700);
  };

  const handleNextSection = () => {
    playClickSound(650);
    if (activeSection < 22) {
      setActiveSection((prev) => prev + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handlePrevSection = () => {
    playClickSound(550);
    setActiveSection((prev) => Math.max(1, prev - 1));
  };

  const handleSectionClick = (sec: number) => {
    playClickSound(600);
    setActiveSection(sec);
  };

  const handleFinalSubmit = () => {
    playSuccessChime();
    setSubmitted(true);
    onSaveAssessment(formData);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const SECTIONS = [
    { num: 1, title: 'Patient Details', icon: User },
    { num: 2, title: 'Concerns & Goals', icon: Target },
    { num: 3, title: 'Medical Conditions', icon: Activity },
    { num: 4, title: 'Meds, Insulin & Allergies', icon: Pill },
    { num: 5, title: 'Health Readings', icon: Scale },
    { num: 6, title: 'Sleep & Stress', icon: Moon },
    { num: 7, title: 'Gut & Digestion', icon: Apple },
    { num: 8, title: 'Lab Test Reports', icon: Upload },
    { num: 9, title: 'Previous Treatments', icon: Clock },
    { num: 10, title: 'Diet & Eating Pattern', icon: Heart },
    { num: 11, title: 'Lifestyle & Activity', icon: Dumbbell },
    { num: 12, title: 'Family History', icon: UsersIcon },
    { num: 13, title: 'Hormonal (Women)', icon: Sparkles },
    { num: 14, title: 'Hormonal (Men)', icon: Zap },
    { num: 15, title: 'Organ Complications', icon: AlertTriangle },
    { num: 16, title: 'Readiness & Commitment', icon: CheckSquare },
    { num: 17, title: 'Start Timeline', icon: Calendar },
    { num: 18, title: 'Reversal Intensity', icon: Flame },
    { num: 19, title: 'Daily Routine', icon: Clock },
    { num: 20, title: 'Exercise Plan', icon: Dumbbell },
    { num: 21, title: 'Doctor Query', icon: Stethoscope },
    { num: 22, title: 'Additional Details', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="w-full max-w-5xl h-[92vh] bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                  UrCare Clinical Assessment
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">22 Root-Cause Modules</span>
              </div>
              <h2 className="text-base sm:text-lg font-black leading-tight">All-Condition Personalised Root-Cause Reversal Form</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              className="p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={soundOn ? 'Sound On' : 'Sound Off'}
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 opacity-50" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Capacity & Google Account Notice Banner */}
        <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">Strict Monthly Capacity Limit Active</span>
            <span className="opacity-75 hidden sm:inline">• Logged as {formData.email}</span>
          </div>
          <span className="text-[11px] font-mono font-bold bg-amber-200/60 dark:bg-amber-500/20 px-2 py-0.5 rounded shrink-0">
            Slot Reserved For Assessment
          </span>
        </div>

        {/* Main Body: Left Sidebar Section Nav + Right Active Form Container */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Quick Jump Sidebar */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-y-auto p-3 flex md:flex-col gap-1.5 scrollbar-thin">
            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-2 py-1 hidden md:block">
              Assessment Modules ({activeSection}/22)
            </div>
            {SECTIONS.map((sec) => {
              const Icon = sec.icon || Activity;
              const isActive = activeSection === sec.num;
              return (
                <button
                  key={sec.num}
                  type="button"
                  onClick={() => handleSectionClick(sec.num)}
                  className={`px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between gap-2 shrink-0 md:shrink ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] opacity-70 font-mono">{sec.num}.</span>
                    <span className="truncate">{sec.title}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 hidden md:block" />}
                </button>
              );
            })}
          </div>

          {/* Right Scrollable Section Form */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6" onScroll={() => playScrollTickSound(1100)}>
            
            {/* Section 1: Patient Details */}
            {activeSection === 1 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 1</span>
                  <h3 className="text-xl font-black">Patient Contact & Demographics</h3>
                  <p className="text-xs text-zinc-500">Provide accurate personal details for baseline medical calibration.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">Full Name *</label>
                    <input 
                      type="text" 
                      value={formData.fullName} 
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">WhatsApp Number *</label>
                    <input 
                      type="text" 
                      value={formData.whatsappNumber} 
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Age *</label>
                    <input 
                      type="number" 
                      value={formData.age} 
                      onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Gender *</label>
                    <select 
                      value={formData.gender} 
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Height (Feet & Inches) *</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Feet" 
                        value={formData.heightFeet} 
                        onChange={(e) => setFormData({ ...formData, heightFeet: Number(e.target.value) })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                      />
                      <input 
                        type="number" 
                        placeholder="Inches" 
                        value={formData.heightInches} 
                        onChange={(e) => setFormData({ ...formData, heightInches: Number(e.target.value) })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Current Weight (kg) *</label>
                    <input 
                      type="number" 
                      value={formData.currentWeightKg} 
                      onChange={(e) => setFormData({ ...formData, currentWeightKg: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Highest Weight Ever Reached (kg & when)</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Weight (kg)"
                        value={formData.highestWeightKg || ''} 
                        onChange={(e) => setFormData({ ...formData, highestWeightKg: Number(e.target.value) })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                      />
                      <input 
                        type="text" 
                        placeholder="Year (e.g. 2022)"
                        value={formData.highestWeightWhen || ''} 
                        onChange={(e) => setFormData({ ...formData, highestWeightWhen: e.target.value })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Waist Circumference (Inches)</label>
                    <input 
                      type="number" 
                      value={formData.waistCircumferenceInches || ''} 
                      onChange={(e) => setFormData({ ...formData, waistCircumferenceInches: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">City, State, Country *</label>
                    <input 
                      type="text" 
                      value={formData.cityStateCountry} 
                      onChange={(e) => setFormData({ ...formData, cityStateCountry: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Type of Work *</label>
                    <select 
                      value={formData.workType} 
                      onChange={(e) => setFormData({ ...formData, workType: e.target.value as any })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    >
                      <option value="seated">Seated Job</option>
                      <option value="physical">Physical Job</option>
                      <option value="standing">Standing Job</option>
                      <option value="mixed">Mixed Work</option>
                      <option value="shift">Shift Work</option>
                      <option value="retired">Retired</option>
                      <option value="not_working">Not Working Currently</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Main Health Concerns & Goals */}
            {activeSection === 2 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 2</span>
                  <h3 className="text-xl font-black">Main Health Concerns & 90-120 Days Goal</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">What is your main health concern today? *</label>
                    <textarea 
                      rows={2}
                      value={formData.mainHealthConcern} 
                      onChange={(e) => setFormData({ ...formData, mainHealthConcern: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">What symptoms bother you the most? *</label>
                    <textarea 
                      rows={2}
                      value={formData.bothersomeSymptoms} 
                      onChange={(e) => setFormData({ ...formData, bothersomeSymptoms: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Specific health goal in the next 90-120 days? *</label>
                    <textarea 
                      rows={2}
                      value={formData.goal90to120Days} 
                      onChange={(e) => setFormData({ ...formData, goal90to120Days: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                      <label className="text-xs font-bold block mb-2">Overall Health (0-10)</label>
                      <input 
                        type="range" min="0" max="10" 
                        value={formData.overallHealthRating} 
                        onChange={(e) => setFormData({ ...formData, overallHealthRating: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                      <span className="text-lg font-black text-emerald-600 font-mono mt-1 block">{formData.overallHealthRating} / 10</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                      <label className="text-xs font-bold block mb-2">Energy Level (0-10)</label>
                      <input 
                        type="range" min="0" max="10" 
                        value={formData.energyLevelRating} 
                        onChange={(e) => setFormData({ ...formData, energyLevelRating: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                      <span className="text-lg font-black text-emerald-600 font-mono mt-1 block">{formData.energyLevelRating} / 10</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                      <label className="text-xs font-bold block mb-2">Quality of Life (0-10)</label>
                      <input 
                        type="range" min="0" max="10" 
                        value={formData.qualityOfLifeRating} 
                        onChange={(e) => setFormData({ ...formData, qualityOfLifeRating: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                      <span className="text-lg font-black text-emerald-600 font-mono mt-1 block">{formData.qualityOfLifeRating} / 10</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Current & Previous Medical Conditions */}
            {activeSection === 3 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 3</span>
                  <h3 className="text-xl font-black">Diagnosed Medical Conditions</h3>
                  <p className="text-xs text-zinc-500">List every condition you have been diagnosed with, past or present.</p>
                </div>

                <div className="space-y-3">
                  {formData.diagnosedConditions.map((cond, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <TextInput
                          placeholder="Condition Name" value={cond.conditionName}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], conditionName: e.target.value };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        />
                        <TextInput
                          placeholder="Diagnosed Month & Year" value={cond.diagnosedMonthYear}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], diagnosedMonthYear: e.target.value };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        />
                        <SelectInput
                          value={cond.currentStatus}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], currentStatus: e.target.value as any };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        >
                          <option value="controlled">Controlled</option>
                          <option value="uncontrolled">Uncontrolled</option>
                          <option value="worsening">Worsening</option>
                        </SelectInput>
                        <TextInput
                          placeholder="Began When" value={cond.beganWhen}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], beganWhen: e.target.value };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        />
                        <TextInput
                          placeholder="Current Treatment" value={cond.currentTreatment}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], currentTreatment: e.target.value };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        />
                        <div>
                          <label className="text-[10px] font-bold block mb-1 opacity-70">Severity: {cond.severityRating} / 10</label>
                          <input
                            type="range" min="0" max="10" value={cond.severityRating}
                            onChange={(e) => {
                              const list = [...formData.diagnosedConditions];
                              list[idx] = { ...list[idx], severityRating: Number(e.target.value) };
                              setFormData({ ...formData, diagnosedConditions: list });
                            }}
                            className="w-full accent-emerald-500 mt-2"
                          />
                        </div>
                      </div>
                      {formData.diagnosedConditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, diagnosedConditions: formData.diagnosedConditions.filter((_, i) => i !== idx) })}
                          className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                        >
                          Remove Condition
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      diagnosedConditions: [...formData.diagnosedConditions, { conditionName: '', diagnosedMonthYear: '', currentStatus: 'uncontrolled', severityRating: 5, beganWhen: '', currentTreatment: '' }]
                    })}
                    className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    + Add Another Condition
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Hospitalisation History">
                    <TextArea rows={2} value={formData.hospitalisationHistory || ''} onChange={(e) => setFormData({ ...formData, hospitalisationHistory: e.target.value })} />
                  </Field>
                  <Field label="Emergency Episode History">
                    <TextArea rows={2} value={formData.emergencyEpisodeHistory || ''} onChange={(e) => setFormData({ ...formData, emergencyEpisodeHistory: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}

            {/* Section 4: Medicines, Insulin & Allergies */}
            {activeSection === 4 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 4</span>
                  <h3 className="text-xl font-black">Prescriptions, Insulin & Supplements</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <h4 className="text-xs font-black uppercase text-emerald-600">Current Prescription Medicines</h4>
                    {formData.medicinesList.map((med, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <input 
                          type="text" placeholder="Name" value={med.name} 
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].name = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                        />
                        <input 
                          type="text" placeholder="Dose" value={med.dose} 
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].dose = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                        />
                        <input 
                          type="text" placeholder="Timing" value={med.timing} 
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].timing = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                        />
                        <input 
                          type="text" placeholder="Reason" value={med.reason} 
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].reason = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        medicinesList: [...formData.medicinesList, { name: '', dose: '', timing: '', frequencyPerDay: '', sinceWhen: '', reason: '' }]
                      })}
                      className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                    >
                      + Add Another Medicine
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Vitamins & Supplements</label>
                    <input 
                      type="text" 
                      value={formData.vitaminsAndSupplements || ''} 
                      onChange={(e) => setFormData({ ...formData, vitaminsAndSupplements: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Known Allergies / Adverse Reactions</label>
                    <input 
                      type="text" 
                      value={formData.allergies?.medicineAllergies || ''} 
                      onChange={(e) => setFormData({ ...formData, allergies: { ...formData.allergies, medicineAllergies: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 5: Current Health Readings */}
            {activeSection === 5 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 5</span>
                  <h3 className="text-xl font-black">Blood Sugar & Cardiovascular Vitals</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">Latest HbA1c & Date</label>
                    <input 
                      type="text" 
                      value={formData.bloodSugar.latestHbA1c || ''} 
                      onChange={(e) => setFormData({ ...formData, bloodSugar: { ...formData.bloodSugar, latestHbA1c: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Average Fasting Blood Sugar (Last 7 Days)</label>
                    <input 
                      type="text" 
                      value={formData.bloodSugar.averageFasting7Days || ''} 
                      onChange={(e) => setFormData({ ...formData, bloodSugar: { ...formData.bloodSugar, averageFasting7Days: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Average Post-Meal Sugar</label>
                    <input 
                      type="text" 
                      value={formData.bloodSugar.averagePostMeal7Days || ''} 
                      onChange={(e) => setFormData({ ...formData, bloodSugar: { ...formData.bloodSugar, averagePostMeal7Days: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Blood Pressure Range</label>
                    <input 
                      type="text" 
                      value={formData.cardioVitals.usualBpRange || ''} 
                      onChange={(e) => setFormData({ ...formData, cardioVitals: { ...formData.cardioVitals, usualBpRange: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 6: Sleep, Stress & Mental Wellbeing */}
            {activeSection === 6 && (
              <div className="space-y-6 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 6</span>
                  <h3 className="text-xl font-black">Sleep, Stress & Mental Wellbeing</h3>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-emerald-600">Sleep</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Sleep Time"><TextInput value={formData.sleep.sleepTime} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepTime: e.target.value } })} /></Field>
                    <Field label="Wake Up Time"><TextInput value={formData.sleep.wakeUpTime} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, wakeUpTime: e.target.value } })} /></Field>
                    <Field label="Average Sleep Hours"><TextInput type="number" value={formData.sleep.averageSleepHours} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, averageSleepHours: Number(e.target.value) } })} /></Field>
                    <Field label="Sleep Quality">
                      <SelectInput value={formData.sleep.sleepQuality} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepQuality: e.target.value as any } })}>
                        <option value="good">Good</option>
                        <option value="average">Average</option>
                        <option value="poor">Poor</option>
                        <option value="very_poor">Very Poor</option>
                      </SelectInput>
                    </Field>
                    <Field label="Difficulty Falling Asleep?"><YesNo value={formData.sleep.difficultyFallingAsleep} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, difficultyFallingAsleep: v } })} /></Field>
                    <Field label="Wakes During Night?"><YesNo value={formData.sleep.wakesDuringNight} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, wakesDuringNight: v } })} /></Field>
                    <Field label="Wake Count (if any)"><TextInput value={formData.sleep.wakeCount || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, wakeCount: e.target.value } })} /></Field>
                    <Field label="Night-Time Urination Count"><TextInput value={formData.sleep.nightTimeUrinationCount || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, nightTimeUrinationCount: e.target.value } })} /></Field>
                    <Field label="Wakes Up Refreshed?"><YesNo value={formData.sleep.wakesRefreshed} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, wakesRefreshed: v } })} /></Field>
                    <Field label="Snores?"><TextInput value={formData.sleep.snores} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, snores: e.target.value } })} /></Field>
                    <Field label="Gasps / Stops Breathing While Asleep?"><TextInput value={formData.sleep.gaspOrStopBreathing} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, gaspOrStopBreathing: e.target.value } })} /></Field>
                    <Field label="Sleep Apnoea Diagnosed?"><YesNo value={formData.sleep.sleepApnoeaDiagnosed} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepApnoeaDiagnosed: v } })} /></Field>
                    <Field label="Uses CPAP?"><YesNo value={formData.sleep.cpapUsed} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, cpapUsed: v } })} /></Field>
                    <Field label="Daytime Sleepiness / Napping"><TextInput value={formData.sleep.daytimeSleepinessNapping || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, daytimeSleepinessNapping: e.target.value } })} /></Field>
                    <Field label="Sleep Medicine / Aid Used"><TextInput value={formData.sleep.sleepMedicineOrAid || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepMedicineOrAid: e.target.value } })} /></Field>
                    <Field label="Works Shift Hours?"><YesNo value={formData.sleep.shiftWork} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, shiftWork: v } })} /></Field>
                  </div>
                  <Field label="Other Sleep Disturbances"><TextArea rows={2} value={formData.sleep.sleepDisturbances || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepDisturbances: e.target.value } })} /></Field>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <h4 className="text-xs font-black uppercase text-emerald-600">Stress & Mental Wellbeing</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Stress Level">
                      <SelectInput value={formData.stressMental.stressLevel} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, stressLevel: e.target.value as any } })}>
                        <option value="low">Low</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High</option>
                        <option value="overwhelming">Overwhelming</option>
                      </SelectInput>
                    </Field>
                    <Field label="Main Sources of Stress"><TextInput value={formData.stressMental.mainSourcesOfStress || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, mainSourcesOfStress: e.target.value } })} /></Field>
                    <Field label="Major Trauma in Last 2 Years?"><YesNo value={formData.stressMental.majorTraumaLast2Years} onChange={(v) => setFormData({ ...formData, stressMental: { ...formData.stressMental, majorTraumaLast2Years: v } })} /></Field>
                    <Field label="Mental Condition Diagnosed?"><YesNo value={formData.stressMental.mentalConditionDiagnosed} onChange={(v) => setFormData({ ...formData, stressMental: { ...formData.stressMental, mentalConditionDiagnosed: v } })} /></Field>
                    <Field label="Mental Health Meds / Therapy"><TextInput value={formData.stressMental.mentalHealthMedsOrTherapy || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, mentalHealthMedsOrTherapy: e.target.value } })} /></Field>
                    <Field label="Stress Management Methods"><TextInput value={formData.stressMental.stressManagementMethods || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, stressManagementMethods: e.target.value } })} /></Field>
                  </div>
                  {formData.stressMental.majorTraumaLast2Years && (
                    <Field label="Trauma Explanation"><TextArea rows={2} value={formData.stressMental.traumaExplanation || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, traumaExplanation: e.target.value } })} /></Field>
                  )}
                  <Field label="Emotional Symptoms">
                    <ChipToggle
                      options={['Difficulty Relaxing', 'Constant Worry', 'Irritability', 'Low Mood / Sadness', 'Panic Episodes', 'Loss of Interest', 'Racing Thoughts', 'None']}
                      selected={formData.stressMental.emotionalSymptoms}
                      onChange={(next) => setFormData({ ...formData, stressMental: { ...formData.stressMental, emotionalSymptoms: next } })}
                    />
                  </Field>
                  <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                    <label className="text-xs font-bold block mb-2">Emotional Wellbeing (0-10)</label>
                    <input type="range" min="0" max="10" value={formData.stressMental.emotionalWellbeingRating} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, emotionalWellbeingRating: Number(e.target.value) } })} className="w-full accent-emerald-500" />
                    <span className="text-lg font-black text-emerald-600 font-mono mt-1 block">{formData.stressMental.emotionalWellbeingRating} / 10</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 7: Digestive & Gut Health */}
            {activeSection === 7 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 7</span>
                  <h3 className="text-xl font-black">Digestive & Gut Health</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Bowel Frequency"><TextInput value={formData.gut.bowelFrequency} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, bowelFrequency: e.target.value } })} /></Field>
                  <Field label="Stool Type">
                    <SelectInput value={formData.gut.stoolType} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, stoolType: e.target.value as any } })}>
                      <option value="normal">Normal</option>
                      <option value="hard">Hard</option>
                      <option value="loose">Loose</option>
                      <option value="watery">Watery</option>
                      <option value="alternating">Alternating</option>
                    </SelectInput>
                  </Field>
                  <Field label="Symptom Frequency"><TextInput value={formData.gut.symptomFrequency} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, symptomFrequency: e.target.value } })} /></Field>
                  <Field label="Appetite">
                    <SelectInput value={formData.gut.appetite} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, appetite: e.target.value as any } })}>
                      <option value="very_low">Very Low</option>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="uncontrolled">Uncontrolled</option>
                    </SelectInput>
                  </Field>
                  <Field label="Used Antibiotics in Last 6 Months?"><YesNo value={formData.gut.antibioticUseLast6Months} onChange={(v) => setFormData({ ...formData, gut: { ...formData.gut, antibioticUseLast6Months: v } })} /></Field>
                  <Field label="Takes Regular Acidity Medicines?"><YesNo value={formData.gut.regularAcidityMedicines} onChange={(v) => setFormData({ ...formData, gut: { ...formData.gut, regularAcidityMedicines: v } })} /></Field>
                  <Field label="Uses Probiotics / Digestive Enzymes?"><YesNo value={formData.gut.probioticsOrEnzymes} onChange={(v) => setFormData({ ...formData, gut: { ...formData.gut, probioticsOrEnzymes: v } })} /></Field>
                </div>

                <Field label="Digestive Symptoms">
                  <ChipToggle
                    options={['Bloating or Gas', 'Heaviness After Meals', 'Acid Reflux', 'Constipation', 'Diarrhoea', 'Nausea', 'Abdominal Pain', 'None']}
                    selected={formData.gut.symptoms}
                    onChange={(next) => setFormData({ ...formData, gut: { ...formData.gut, symptoms: next } })}
                  />
                </Field>
                <Field label="Diagnosed Gut Conditions">
                  <ChipToggle
                    options={['Mild Acidity / GERD', 'IBS', 'Fatty Liver', 'Gallstones', 'H. Pylori', 'Ulcers', 'None']}
                    selected={formData.gut.diagnosedConditions}
                    onChange={(next) => setFormData({ ...formData, gut: { ...formData.gut, diagnosedConditions: next } })}
                  />
                </Field>
                <Field label="Trigger Foods"><TextArea rows={2} value={formData.gut.triggerFoods || ''} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, triggerFoods: e.target.value } })} placeholder="List any acidity, bloating, or foods causing digestive disturbance..." /></Field>
              </div>
            )}

            {/* Section 8: Lab Test Reports */}
            {activeSection === 8 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 8</span>
                  <h3 className="text-xl font-black">Lab Test Reports</h3>
                  <p className="text-xs text-zinc-500">You can also upload the actual file from the "My Reports" tab — here just tell us what you have.</p>
                </div>
                <Field label="Have Recent Lab Tests?"><YesNo value={formData.labReports.hasRecentTests} onChange={(v) => setFormData({ ...formData, labReports: { ...formData.labReports, hasRecentTests: v } })} /></Field>
                <Field label="Report File Names / References" hint="Type a name and press Enter to add it to the list.">
                  <TagsInput values={formData.labReports.uploadedFileNames} onChange={(next) => setFormData({ ...formData, labReports: { ...formData.labReports, uploadedFileNames: next } })} placeholder="e.g. HbA1c_Lipid_Panel_Report.pdf" />
                </Field>
                <Field label="Report Notes / Key Findings"><TextArea rows={3} value={formData.labReports.reportNotes || ''} onChange={(e) => setFormData({ ...formData, labReports: { ...formData.labReports, reportNotes: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 9: Previous Treatments Tried */}
            {activeSection === 9 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 9</span>
                  <h3 className="text-xl font-black">Previous Treatments Tried</h3>
                </div>
                <Field label="Treatments Tried So Far">
                  <ChipToggle
                    options={['Prescription Medicines', 'Diet Plan', 'Walking Programme', 'Ayurveda / Herbal', 'Homeopathy', 'Yoga / Meditation', 'Bariatric Surgery', 'Other']}
                    selected={formData.previousTreatments.treatmentsTried}
                    onChange={(next) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, treatmentsTried: next } })}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="What Improved?"><TextArea rows={2} value={formData.previousTreatments.whatImproved || ''} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, whatImproved: e.target.value } })} /></Field>
                  <Field label="What Did Not Improve?"><TextArea rows={2} value={formData.previousTreatments.whatDidNotImprove || ''} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, whatDidNotImprove: e.target.value } })} /></Field>
                  <Field label="Why Did You Stop?"><TextArea rows={2} value={formData.previousTreatments.whyStopped || ''} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, whyStopped: e.target.value } })} /></Field>
                  <Field label="Did the Improvement Remain?">
                    <SelectInput value={formData.previousTreatments.improvementRemained} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, improvementRemained: e.target.value as any } })}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="partially">Partially</option>
                      <option value="not_applicable">Not Applicable</option>
                    </SelectInput>
                  </Field>
                </div>
              </div>
            )}

            {/* Section 10: Diet & Eating Pattern */}
            {activeSection === 10 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 10</span>
                  <h3 className="text-xl font-black">Diet & Eating Pattern</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Diet Type"><TextInput value={formData.diet.dietType} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, dietType: e.target.value } })} /></Field>
                  <Field label="Regional Preference"><TextInput value={formData.diet.regionalPreference || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, regionalPreference: e.target.value } })} /></Field>
                  <Field label="Meals Per Day"><TextInput type="number" value={formData.diet.mealsPerDay} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, mealsPerDay: Number(e.target.value) } })} /></Field>
                  <Field label="First Meal Time"><TextInput value={formData.diet.firstMealTime} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, firstMealTime: e.target.value } })} /></Field>
                  <Field label="Last Meal Time"><TextInput value={formData.diet.lastMealTime} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, lastMealTime: e.target.value } })} /></Field>
                  <Field label="Eats Late at Night?"><YesNo value={formData.diet.lateNightEating} onChange={(v) => setFormData({ ...formData, diet: { ...formData.diet, lateNightEating: v } })} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Typical Breakfast"><TextArea rows={2} value={formData.diet.breakfast} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, breakfast: e.target.value } })} /></Field>
                  <Field label="Typical Lunch"><TextArea rows={2} value={formData.diet.lunch} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, lunch: e.target.value } })} /></Field>
                  <Field label="Typical Dinner"><TextArea rows={2} value={formData.diet.dinner} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, dinner: e.target.value } })} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Snacks"><TextInput value={formData.diet.snacks || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, snacks: e.target.value } })} /></Field>
                  <Field label="Tea / Coffee Count"><TextInput value={formData.diet.teaCoffeeCount} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, teaCoffeeCount: e.target.value } })} /></Field>
                  <Field label="Adds Sugar or Honey?"><YesNo value={formData.diet.addsSugarOrHoney} onChange={(v) => setFormData({ ...formData, diet: { ...formData.diet, addsSugarOrHoney: v } })} /></Field>
                  <Field label="Fried Food Frequency"><TextInput value={formData.diet.friedFoodFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, friedFoodFrequency: e.target.value } })} /></Field>
                  <Field label="Sweets Frequency"><TextInput value={formData.diet.sweetsFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, sweetsFrequency: e.target.value } })} /></Field>
                  <Field label="Packaged Food Frequency"><TextInput value={formData.diet.packagedFoodFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, packagedFoodFrequency: e.target.value } })} /></Field>
                  <Field label="Outside Food Frequency"><TextInput value={formData.diet.outsideFoodFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, outsideFoodFrequency: e.target.value } })} /></Field>
                  <Field label="Water Intake (Litres/day)"><TextInput value={formData.diet.waterIntakeLiters} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, waterIntakeLiters: e.target.value } })} /></Field>
                  <Field label="Alcohol / Tobacco Use"><TextInput value={formData.diet.alcoholTobaccoUse || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, alcoholTobaccoUse: e.target.value } })} /></Field>
                  <Field label="Eating Disorder History?"><YesNo value={formData.diet.eatingDisorderHistory} onChange={(v) => setFormData({ ...formData, diet: { ...formData.diet, eatingDisorderHistory: v } })} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Food Dislikes / Restrictions"><TextArea rows={2} value={formData.diet.foodDislikesOrRestrictions || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, foodDislikesOrRestrictions: e.target.value } })} /></Field>
                  <Field label="Craved Foods"><TextArea rows={2} value={formData.diet.cravedFoods || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, cravedFoods: e.target.value } })} /></Field>
                  <Field label="Previous Diet History"><TextArea rows={2} value={formData.diet.previousDietHistory || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, previousDietHistory: e.target.value } })} /></Field>
                </div>
              </div>
            )}

            {/* Section 11: Lifestyle & Physical Activity */}
            {activeSection === 11 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 11</span>
                  <h3 className="text-xl font-black">Lifestyle & Physical Activity</h3>
                </div>
                <Field label="Do You Exercise Regularly?"><YesNo value={formData.lifestyle.regularExercise} onChange={(v) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, regularExercise: v } })} /></Field>
                {formData.lifestyle.regularExercise ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Exercise Type"><TextInput value={formData.lifestyle.exerciseType || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, exerciseType: e.target.value } })} /></Field>
                    <Field label="Timing"><TextInput value={formData.lifestyle.timing || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, timing: e.target.value } })} /></Field>
                    <Field label="Frequency (Days / Week)"><TextInput type="number" value={formData.lifestyle.frequencyDaysPerWeek || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, frequencyDaysPerWeek: Number(e.target.value) } })} /></Field>
                    <Field label="Duration (Minutes)"><TextInput type="number" value={formData.lifestyle.durationMinutes || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, durationMinutes: Number(e.target.value) } })} /></Field>
                  </div>
                ) : (
                  <Field label="Reason for Not Exercising"><TextInput value={formData.lifestyle.noExerciseReason || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, noExerciseReason: e.target.value } })} /></Field>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Sitting Hours Per Day"><TextInput type="number" value={formData.lifestyle.sittingHoursPerDay} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, sittingHoursPerDay: Number(e.target.value) } })} /></Field>
                  <Field label="Screen Time Hours Per Day"><TextInput type="number" value={formData.lifestyle.screenTimeHoursPerDay} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, screenTimeHoursPerDay: Number(e.target.value) } })} /></Field>
                </div>
                <Field label="Non-Exercise Movement (chores, stairs, walking)"><TextArea rows={2} value={formData.lifestyle.nonExerciseMovement || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, nonExerciseMovement: e.target.value } })} /></Field>
                <Field label="Physical Limitations / Injuries"><TextArea rows={2} value={formData.lifestyle.physicalLimitationsOrInjuries || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, physicalLimitationsOrInjuries: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 12: Family Health History */}
            {activeSection === 12 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 12</span>
                  <h3 className="text-xl font-black">Family Health History</h3>
                  <p className="text-xs text-zinc-500">Note which relative(s) had each condition, or leave as "None".</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    ['diabetes', 'Diabetes'], ['hypertension', 'Hypertension'], ['heartDisease', 'Heart Disease'],
                    ['thyroid', 'Thyroid'], ['pcosHormonal', 'PCOS / Hormonal'], ['cholesterol', 'High Cholesterol'],
                    ['obesity', 'Obesity'], ['autoimmune', 'Autoimmune Condition'], ['cancer', 'Cancer'],
                    ['kidneyDisease', 'Kidney Disease'], ['liverDisease', 'Liver Disease'], ['mentalHealth', 'Mental Health Condition'],
                  ] as [keyof RootCauseAssessmentData['familyHistory'], string][]).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <TextInput value={formData.familyHistory[key] || ''} onChange={(e) => setFormData({ ...formData, familyHistory: { ...formData.familyHistory, [key]: e.target.value } })} />
                    </Field>
                  ))}
                </div>
                <Field label="Other Family Conditions"><TextArea rows={2} value={formData.familyHistory.otherConditions || ''} onChange={(e) => setFormData({ ...formData, familyHistory: { ...formData.familyHistory, otherConditions: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 13: Hormonal Health (Women) */}
            {activeSection === 13 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 13</span>
                  <h3 className="text-xl font-black">Hormonal Health (Women)</h3>
                  <p className="text-xs text-zinc-500">Skip anything not applicable to you.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Menstrual Status"><TextInput value={formData.hormonalWomen?.menstrualStatus || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, menstrualStatus: e.target.value } })} /></Field>
                  <Field label="Cycle Length (Days)"><TextInput value={formData.hormonalWomen?.cycleLengthDays || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, cycleLengthDays: e.target.value } })} /></Field>
                  <Field label="Period Duration (Days)"><TextInput value={formData.hormonalWomen?.periodDurationDays || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, periodDurationDays: e.target.value } })} /></Field>
                  <Field label="Flow"><TextInput value={formData.hormonalWomen?.flow || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, flow: e.target.value } })} /></Field>
                  <Field label="Irregularity Pattern"><TextInput value={formData.hormonalWomen?.irregularityPattern || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, irregularityPattern: e.target.value } })} /></Field>
                  <Field label="Last Menstrual Period Date"><TextInput value={formData.hormonalWomen?.lastMenstrualPeriodDate || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, lastMenstrualPeriodDate: e.target.value } })} /></Field>
                  <Field label="Age Periods Started"><TextInput value={formData.hormonalWomen?.agePeriodsStarted || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, agePeriodsStarted: e.target.value } })} /></Field>
                  <Field label="Menstrual Cramps"><TextInput value={formData.hormonalWomen?.menstrualCramps || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, menstrualCramps: e.target.value } })} /></Field>
                  <Field label="PCOD / PCOS Diagnosis"><TextInput value={formData.hormonalWomen?.pcodPcosDiagnosis || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, pcodPcosDiagnosis: e.target.value } })} /></Field>
                  <Field label="Thyroid Diagnosis & Meds"><TextInput value={formData.hormonalWomen?.thyroidDiagnosisAndMeds || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, thyroidDiagnosisAndMeds: e.target.value } })} /></Field>
                  <Field label="Currently Pregnant?"><YesNo value={formData.hormonalWomen?.currentlyPregnant} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, currentlyPregnant: v } })} /></Field>
                  <Field label="Planning Pregnancy?"><YesNo value={formData.hormonalWomen?.planningPregnancy} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, planningPregnancy: v } })} /></Field>
                  <Field label="Currently Breastfeeding?"><YesNo value={formData.hormonalWomen?.currentlyBreastfeeding} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, currentlyBreastfeeding: v } })} /></Field>
                  <Field label="Gestational Diabetes History?"><YesNo value={formData.hormonalWomen?.gestationalDiabetesHistory} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, gestationalDiabetesHistory: v } })} /></Field>
                  <Field label="Breast Lumps?"><YesNo value={formData.hormonalWomen?.breastLumps} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, breastLumps: v } })} /></Field>
                  <Field label="HRT Type (if any)"><TextInput value={formData.hormonalWomen?.hrtType || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, hrtType: e.target.value } })} /></Field>
                  <Field label="Facial / Body Hair"><TextInput value={formData.hormonalWomen?.facialBodyHair || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, facialBodyHair: e.target.value } })} /></Field>
                  <Field label="Scalp Hair Loss Severity"><TextInput value={formData.hormonalWomen?.scalpHairLossSeverity || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, scalpHairLossSeverity: e.target.value } })} /></Field>
                </div>
                <Field label="Pregnancies & Children"><TextInput value={formData.hormonalWomen?.pregnanciesAndChildren || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, pregnanciesAndChildren: e.target.value } })} /></Field>
                <Field label="Miscarriages / Complications"><TextInput value={formData.hormonalWomen?.miscarriagesOrComplications || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, miscarriagesOrComplications: e.target.value } })} /></Field>
                <Field label="PMS Symptoms">
                  <ChipToggle options={['Mood changes', 'Bloating', 'Cramps', 'Fatigue', 'Food cravings', 'Headaches', 'None']} selected={formData.hormonalWomen?.pmsSymptoms || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, pmsSymptoms: next } })} />
                </Field>
                <Field label="Menopause Symptoms">
                  <ChipToggle options={['Hot flashes', 'Night sweats', 'Mood swings', 'Vaginal dryness', 'Sleep disturbance', 'Not Applicable']} selected={formData.hormonalWomen?.menopauseSymptoms || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, menopauseSymptoms: next } })} />
                </Field>
                <Field label="Diagnosed Hormonal Conditions">
                  <ChipToggle options={['PCOS/PCOD', 'Thyroid Disorder', 'Endometriosis', 'Fibroids', 'None']} selected={formData.hormonalWomen?.diagnosedHormonalConditions || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, diagnosedHormonalConditions: next } })} />
                </Field>
                <Field label="Skin Issues">
                  <ChipToggle options={['Acne', 'Dryness', 'Skin tags', 'Pigmentation', 'Oily skin', 'None']} selected={formData.hormonalWomen?.skinIssues || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, skinIssues: next } })} />
                </Field>
              </div>
            )}

            {/* Section 14: Hormonal Health (Men) */}
            {activeSection === 14 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 14</span>
                  <h3 className="text-xl font-black">Hormonal Health (Men)</h3>
                  <p className="text-xs text-zinc-500">Skip anything not applicable to you.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Energy Level"><TextInput value={formData.hormonalMen?.energyLevel || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, energyLevel: e.target.value } })} /></Field>
                  <Field label="Libido"><TextInput value={formData.hormonalMen?.libido || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, libido: e.target.value } })} /></Field>
                  <Field label="Erectile Difficulty"><TextInput value={formData.hormonalMen?.erectileDifficulty || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, erectileDifficulty: e.target.value } })} /></Field>
                  <Field label="Morning Erections Regular?"><YesNo value={formData.hormonalMen?.morningErectionsRegular} onChange={(v) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, morningErectionsRegular: v } })} /></Field>
                  <Field label="Muscle Mass Trend"><TextInput value={formData.hormonalMen?.muscleMassTrend || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, muscleMassTrend: e.target.value } })} /></Field>
                  <Field label="Facial / Body Hair Growth"><TextInput value={formData.hormonalMen?.facialBodyHairGrowth || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, facialBodyHairGrowth: e.target.value } })} /></Field>
                  <Field label="Gynecomastia (Breast Tissue)?"><TextInput value={formData.hormonalMen?.gynecomastia || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, gynecomastia: e.target.value } })} /></Field>
                  <Field label="Mood Changes"><TextInput value={formData.hormonalMen?.moodChanges || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, moodChanges: e.target.value } })} /></Field>
                  <Field label="Diagnosed Low Testosterone?"><TextInput value={formData.hormonalMen?.diagnosedLowTestosterone || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, diagnosedLowTestosterone: e.target.value } })} /></Field>
                  <Field label="Prostate Issues"><TextInput value={formData.hormonalMen?.prostateIssues || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, prostateIssues: e.target.value } })} /></Field>
                </div>
              </div>
            )}

            {/* Section 15: Organ Health & Complication Symptoms */}
            {activeSection === 15 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 15</span>
                  <h3 className="text-xl font-black">Organ Health & Complication Symptoms</h3>
                  <p className="text-xs text-zinc-500">Type a symptom and press Enter to add it under each category — leave empty if none.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {([
                    ['diabetesComplications', 'Diabetes Complications'], ['cardiovascularSymptoms', 'Cardiovascular Symptoms'],
                    ['liverSymptoms', 'Liver Symptoms'], ['kidneySymptoms', 'Kidney Symptoms'],
                    ['thyroidSymptoms', 'Thyroid Symptoms'], ['jointBoneSymptoms', 'Joint & Bone Symptoms'],
                    ['neurologicalSymptoms', 'Neurological Symptoms'], ['skinSymptoms', 'Skin Symptoms'],
                    ['respiratorySymptoms', 'Respiratory Symptoms'],
                  ] as [Exclude<keyof RootCauseAssessmentData['organHealth'], 'unusualSymptomsNotes'>, string][]).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <TagsInput values={formData.organHealth[key]} onChange={(next) => setFormData({ ...formData, organHealth: { ...formData.organHealth, [key]: next } })} />
                    </Field>
                  ))}
                </div>
                <Field label="Any Other Unusual Symptoms"><TextArea rows={2} value={formData.organHealth.unusualSymptomsNotes || ''} onChange={(e) => setFormData({ ...formData, organHealth: { ...formData.organHealth, unusualSymptomsNotes: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 16: Readiness & Commitment */}
            {activeSection === 16 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 16</span>
                  <h3 className="text-xl font-black">Readiness & Commitment</h3>
                </div>
                <Field label="Main Barriers to Getting Healthier"><TextArea rows={2} value={formData.readiness.mainBarriers || ''} onChange={(e) => setFormData({ ...formData, readiness: { ...formData.readiness, mainBarriers: e.target.value } })} /></Field>
                <Field label="What Would Help You Most?">
                  <ChipToggle
                    options={['Simple meal plans that fit my schedule', 'Family-friendly recipes everyone can eat', 'Daily accountability and motivation', 'Clear step-by-step guidance', 'Help managing stress and emotions']}
                    selected={formData.readiness.helpfulFactors}
                    onChange={(next) => setFormData({ ...formData, readiness: { ...formData.readiness, helpfulFactors: next } })}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Willingness to Prioritise Health"><TextInput value={formData.readiness.healthPriorityWillingness} onChange={(e) => setFormData({ ...formData, readiness: { ...formData.readiness, healthPriorityWillingness: e.target.value } })} /></Field>
                  <Field label="Hours Per Week You Can Commit"><TextInput value={formData.readiness.hoursPerWeekCommitment} onChange={(e) => setFormData({ ...formData, readiness: { ...formData.readiness, hoursPerWeekCommitment: e.target.value } })} /></Field>
                  <Field label="Motivated for Root-Cause Reversal?"><YesNo value={formData.readiness.motivatedForRootCause} onChange={(v) => setFormData({ ...formData, readiness: { ...formData.readiness, motivatedForRootCause: v } })} /></Field>
                  <Field label="Can Commit for 90 Days?"><YesNo value={formData.readiness.canCommit90Days} onChange={(v) => setFormData({ ...formData, readiness: { ...formData.readiness, canCommit90Days: v } })} /></Field>
                  <Field label="Family Support Available?"><YesNo value={formData.readiness.familySupport} onChange={(v) => setFormData({ ...formData, readiness: { ...formData.readiness, familySupport: v } })} /></Field>
                </div>
              </div>
            )}

            {/* Section 17: Start Timeline */}
            {activeSection === 17 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 17</span>
                  <h3 className="text-xl font-black">When Would You Like to Start?</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { id: 'within_3_days', title: 'Within 3 Days', desc: 'I want to begin as soon as possible.' },
                    { id: 'this_week', title: 'This Week', desc: 'I can start any day within the next 7 days.' },
                    { id: 'later_or_not_urgent', title: 'Later / Not Urgent', desc: 'I am exploring for now, no rush to start.' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => { playClickSound(650); setFormData({ ...formData, startTimeline: tier.id as any }); }}
                      className={`w-full p-4 rounded-2xl border text-left transition-all ${
                        formData.startTimeline === tier.id
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">{tier.title}</span>
                        {formData.startTimeline === tier.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </div>
                      <p className="text-xs opacity-75 mt-1">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 18: Reversal Intensity */}
            {activeSection === 18 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 18</span>
                  <h3 className="text-xl font-black">Reversal Treatment Intensity Selection</h3>
                  <p className="text-xs text-zinc-500">Choose the intensity protocol matching your condition severity and daily readiness.</p>
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'foundation', title: 'Foundation Intensity Reversal', desc: 'Suitable for early stage or mild cases, gradual approach, less restrictions, slower steady results.' },
                    { id: 'advanced', title: 'Advanced Intensity Reversal', desc: 'Suitable for moderate cases or long term conditions, structured approach, moderate restrictions, steady results.' },
                    { id: 'intensive', title: 'Intensive Reversal Treatment', desc: 'Suitable for severe or complicated cases, high HbA1c, multiple medications, strict protocol, faster results.' },
                    { id: 'physician_decide', title: 'Let the Physician Decide', desc: 'Our lead clinical team will evaluate your reports and prescribe the exact optimal protocol intensity.' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => {
                        playClickSound(650);
                        setFormData({ ...formData, reversalIntensity: tier.id as any });
                      }}
                      className={`w-full p-4 rounded-2xl border text-left transition-all ${
                        formData.reversalIntensity === tier.id 
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-sm' 
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">{tier.title}</span>
                        {formData.reversalIntensity === tier.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </div>
                      <p className="text-xs opacity-75 mt-1">{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 19: Daily Routine and Timings */}
            {activeSection === 19 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 19</span>
                  <h3 className="text-xl font-black">Daily Routine and Timings</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Wake Up Time"><TextInput value={formData.dailyRoutine.wakeUpTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, wakeUpTime: e.target.value } })} /></Field>
                  <Field label="Morning Routine"><TextInput value={formData.dailyRoutine.morningRoutine || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, morningRoutine: e.target.value } })} /></Field>
                  <Field label="Breakfast Time"><TextInput value={formData.dailyRoutine.breakfastTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, breakfastTime: e.target.value } })} /></Field>
                  <Field label="Mid-Morning Snack Time"><TextInput value={formData.dailyRoutine.midMorningSnackTime || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, midMorningSnackTime: e.target.value } })} /></Field>
                  <Field label="Lunch Time"><TextInput value={formData.dailyRoutine.lunchTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, lunchTime: e.target.value } })} /></Field>
                  <Field label="Evening Snack / Tea Time"><TextInput value={formData.dailyRoutine.eveningSnackTeaTime || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, eveningSnackTeaTime: e.target.value } })} /></Field>
                  <Field label="Dinner Time"><TextInput value={formData.dailyRoutine.dinnerTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, dinnerTime: e.target.value } })} /></Field>
                  <Field label="Sleep Time"><TextInput value={formData.dailyRoutine.sleepTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, sleepTime: e.target.value } })} /></Field>
                  <Field label="Work Hours"><TextInput value={formData.dailyRoutine.workHours || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, workHours: e.target.value } })} /></Field>
                  <Field label="Daily Sitting Hours at Work"><TextInput value={formData.dailyRoutine.dailySittingHoursAtWork || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, dailySittingHoursAtWork: e.target.value } })} /></Field>
                  <Field label="Commute Time & Mode"><TextInput value={formData.dailyRoutine.commuteTimeAndMode || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, commuteTimeAndMode: e.target.value } })} /></Field>
                  <Field label="Available Time for Exercise"><TextInput value={formData.dailyRoutine.availableTimeForExercise || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, availableTimeForExercise: e.target.value } })} /></Field>
                  <Field label="Who Manages Meal Prep"><TextInput value={formData.dailyRoutine.mealPrepManager || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, mealPrepManager: e.target.value } })} /></Field>
                </div>
                <Field label="Weekend Schedule Difference"><TextArea rows={2} value={formData.dailyRoutine.weekendScheduleDifference || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, weekendScheduleDifference: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 20: Exercise Preferences & Realistic Activity Plan */}
            {activeSection === 20 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 20</span>
                  <h3 className="text-xl font-black">Exercise Preferences & Realistic Activity Plan</h3>
                </div>
                <Field label="Preferred Exercise Types">
                  <ChipToggle
                    options={['Walking or brisk walking (outdoor or treadmill)', 'Yoga asanas and pranayama', 'Functional training or HIIT', 'Strength / Weight training', 'Swimming', 'Cycling', 'Dance / Zumba', 'Sports']}
                    selected={formData.exercisePlan.preferredExerciseTypes}
                    onChange={(next) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, preferredExerciseTypes: next } })}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Gym / Equipment Access"><TextInput value={formData.exercisePlan.gymOrEquipmentAccess || ''} onChange={(e) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, gymOrEquipmentAccess: e.target.value } })} /></Field>
                  <Field label="Best Time Slot">
                    <SelectInput value={formData.exercisePlan.bestTimeSlot || 'flexible'} onChange={(e) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, bestTimeSlot: e.target.value as any } })}>
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                      <option value="flexible">Flexible</option>
                    </SelectInput>
                  </Field>
                </div>
                <Field label="Limitations / Explanation"><TextArea rows={2} value={formData.exercisePlan.limitationsExplanation || ''} onChange={(e) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, limitationsExplanation: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 21: Personal Query / Personalisation Request */}
            {activeSection === 21 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 21</span>
                  <h3 className="text-xl font-black">Personal Query for the Doctor</h3>
                </div>
                <Field label="Personal Query & Reversal Customization Request">
                  <TextArea
                    rows={5}
                    value={formData.personalQueryRequest || ''}
                    onChange={(e) => setFormData({ ...formData, personalQueryRequest: e.target.value })}
                    placeholder="Write any specific query, dietary constraint, or medication question you want the physician to review..."
                  />
                </Field>
              </div>
            )}

            {/* Section 22: Additional Information */}
            {activeSection === 22 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Section 22</span>
                  <h3 className="text-xl font-black">Additional Information</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Past Surgeries or Illnesses"><TextArea rows={2} value={formData.additionalInfo.pastSurgeriesOrIllnesses || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, pastSurgeriesOrIllnesses: e.target.value } })} /></Field>
                  <Field label="Ongoing Specialist Treatments"><TextArea rows={2} value={formData.additionalInfo.ongoingSpecialistTreatments || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, ongoingSpecialistTreatments: e.target.value } })} /></Field>
                  <Field label="Genetic or Rare Conditions"><TextArea rows={2} value={formData.additionalInfo.geneticOrRareConditions || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, geneticOrRareConditions: e.target.value } })} /></Field>
                  <Field label="Occupation Challenges"><TextArea rows={2} value={formData.additionalInfo.occupationChallenges || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, occupationChallenges: e.target.value } })} /></Field>
                  <Field label="Living Situation"><TextInput value={formData.additionalInfo.livingSituation || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, livingSituation: e.target.value } })} /></Field>
                  <Field label="Who Manages Your Meals"><TextInput value={formData.additionalInfo.whoManagesMeals || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, whoManagesMeals: e.target.value } })} /></Field>
                </div>
                <Field label="Specific Treatment Requirements"><TextArea rows={2} value={formData.additionalInfo.treatmentRequirements || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, treatmentRequirements: e.target.value } })} /></Field>
                <Field label="Questions for the Doctor"><TextArea rows={2} value={formData.additionalInfo.questionsForDoctor || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, questionsForDoctor: e.target.value } })} /></Field>
                <Field label="Additional Information & Final Notes">
                  <TextArea
                    rows={4}
                    value={formData.additionalInfo.patientExtraNotes || ''}
                    onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, patientExtraNotes: e.target.value } })}
                    placeholder="Share any other surgery history, childhood health, living situation or preferences..."
                  />
                </Field>
              </div>
            )}

          </div>
        </div>

        {/* Bottom Navigation Controls */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/70">
          <button
            type="button"
            onClick={handlePrevSection}
            disabled={activeSection === 1}
            className={`px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeSection === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Module</span>
          </button>

          <div className="text-xs font-mono font-bold text-zinc-500">
            {activeSection} / 22 Modules Completed
          </div>

          <button
            type="button"
            onClick={handleNextSection}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <span>{activeSection === 22 ? 'Submit & Finalize Plan' : 'Next Module'}</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

      </div>
    </div>
  );
};

const UsersIcon = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

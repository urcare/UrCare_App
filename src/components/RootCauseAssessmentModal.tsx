import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Check, ChevronRight, ChevronLeft, ChevronDown, ShieldCheck, Heart, AlertTriangle,
  Stethoscope, Clock, Calendar, Activity, Pill, Moon, Sparkles, Scale,
  User, CheckCircle2, FileText, Upload, Printer, ArrowRight, Zap, Volume2, VolumeX,
  Target, Apple, Dumbbell, CheckSquare, Flame, Brain, Droplets, Utensils, MessageCircle,
} from 'lucide-react';
import { RootCauseAssessmentData, UserHealthProfile } from '../types';
import { playClickSound, playScrollTickSound, playSuccessChime, setSoundEnabled, getSoundEnabled } from '../utils/soundEffects';
import { useLanguage } from '../context/LanguageContext';

/** Hindi display labels for every ChipToggle/select option value used across
 *  the 22 modules — the English string stays the stored value (it's what
 *  ends up in formData and gets reviewed/submitted), only the on-screen
 *  label changes. Keys not present here simply render as-is. */
const OPTION_LABEL_HI: Record<string, string> = {
  // Yes/No + generic
  'Yes': 'हां', 'No': 'नहीं', 'None': 'कोई नहीं', 'Other': 'अन्य', 'Not Applicable': 'लागू नहीं', 'Partially': 'आंशिक रूप से',
  // Section 3: condition status
  'Controlled': 'नियंत्रित', 'Uncontrolled': 'अनियंत्रित', 'Worsening': 'बिगड़ रहा है',
  // Gender / work type (section 1)
  'Male': 'पुरुष', 'Female': 'महिला', 'Seated Job': 'बैठकर काम', 'Physical Job': 'शारीरिक काम',
  'Standing Job': 'खड़े होकर काम', 'Mixed Work': 'मिश्रित काम', 'Shift Work': 'शिफ्ट में काम',
  'Retired': 'सेवानिवृत्त', 'Not Working Currently': 'फिलहाल काम नहीं कर रहे',
  // Sleep quality (section 6)
  'Good': 'अच्छा', 'Average': 'औसत', 'Poor': 'खराब', 'Very Poor': 'बहुत खराब',
  // Stress level
  'Low': 'कम', 'Moderate': 'मध्यम', 'High': 'ज़्यादा', 'Overwhelming': 'असहनीय',
  'Difficulty Relaxing': 'आराम करने में कठिनाई', 'Constant Worry': 'लगातार चिंता', 'Irritability': 'चिड़चिड़ापन',
  'Low Mood / Sadness': 'उदासी', 'Panic Episodes': 'घबराहट के दौरे', 'Loss of Interest': 'रुचि में कमी', 'Racing Thoughts': 'बेचैन विचार',
  // Gut (section 7)
  'Normal': 'सामान्य', 'Hard': 'सख्त', 'Loose': 'ढीला', 'Watery': 'पानी जैसा', 'Alternating': 'बदलता रहता है',
  'Very Low': 'बहुत कम', 'Uncontrolled Appetite': 'अनियंत्रित भूख',
  'Bloating or Gas': 'गैस / पेट फूलना', 'Heaviness After Meals': 'भोजन के बाद भारीपन', 'Acid Reflux': 'एसिड रिफ्लक्स',
  'Constipation': 'कब्ज़', 'Diarrhoea': 'दस्त', 'Nausea': 'जी मिचलाना', 'Abdominal Pain': 'पेट दर्द',
  'Mild Acidity / GERD': 'हल्की एसिडिटी / GERD', 'IBS': 'IBS', 'Fatty Liver': 'फैटी लिवर', 'Gallstones': 'पित्त की पथरी',
  'H. Pylori': 'H. Pylori', 'Ulcers': 'अल्सर',
  // Previous treatments (section 9)
  'Prescription Medicines': 'डॉक्टरी दवाएं', 'Diet Plan': 'डाइट प्लान', 'Walking Programme': 'वॉकिंग प्रोग्राम',
  'Ayurveda / Herbal': 'आयुर्वेद / हर्बल', 'Homeopathy': 'होम्योपैथी', 'Yoga / Meditation': 'योग / ध्यान',
  'Bariatric Surgery': 'बेरिएट्रिक सर्जरी',
  // Family history (section 12)
  'Diabetes': 'डायबिटीज', 'Hypertension': 'उच्च रक्तचाप', 'Heart Disease': 'हृदय रोग', 'Thyroid': 'थायरॉइड',
  'PCOS / Hormonal': 'PCOS / हार्मोनल', 'High Cholesterol': 'उच्च कोलेस्ट्रॉल', 'Obesity': 'मोटापा',
  'Autoimmune Condition': 'ऑटोइम्यून स्थिति', 'Cancer': 'कैंसर', 'Kidney Disease': 'किडनी रोग',
  'Liver Disease': 'लिवर रोग', 'Mental Health Condition': 'मानसिक स्वास्थ्य समस्या',
  // Women's hormonal (section 13)
  'Mood changes': 'मूड बदलना', 'Bloating': 'पेट फूलना', 'Cramps': 'ऐंठन', 'Fatigue': 'थकान',
  'Food cravings': 'खाने की तलब', 'Headaches': 'सिरदर्द',
  'Hot flashes': 'हॉट फ्लैशेज़', 'Night sweats': 'रात में पसीना', 'Mood swings': 'मूड स्विंग', 'Vaginal dryness': 'योनि में रूखापन',
  'Sleep disturbance': 'नींद में खलल',
  'PCOS/PCOD': 'PCOS/PCOD', 'Thyroid Disorder': 'थायरॉइड विकार', 'Endometriosis': 'एंडोमेट्रियोसिस', 'Fibroids': 'फाइब्रॉएड्स',
  'Acne': 'मुंहासे', 'Dryness': 'रूखापन', 'Skin tags': 'स्किन टैग्स', 'Pigmentation': 'पिगमेंटेशन', 'Oily skin': 'तैलीय त्वचा',
  // Readiness (section 16)
  'Simple meal plans that fit my schedule': 'मेरे समय के अनुसार आसान भोजन योजना',
  'Family-friendly recipes everyone can eat': 'पूरे परिवार के लिए उपयुक्त व्यंजन',
  'Daily accountability and motivation': 'दैनिक जवाबदेही और प्रेरणा',
  'Clear step-by-step guidance': 'स्पष्ट चरण-दर-चरण मार्गदर्शन',
  'Help managing stress and emotions': 'तनाव व भावनाओं को संभालने में मदद',
  // Start timeline (section 17)
  'Within 3 Days': '3 दिनों के भीतर', 'This Week': 'इसी हफ्ते', 'Later / Not Urgent': 'बाद में / जल्दी नहीं',
  'I want to begin as soon as possible.': 'मैं जल्द से जल्द शुरू करना चाहता/चाहती हूं।',
  'I can start any day within the next 7 days.': 'मैं अगले 7 दिनों में कभी भी शुरू कर सकता/सकती हूं।',
  'I am exploring for now, no rush to start.': 'फिलहाल सिर्फ जानकारी ले रहा/रही हूं, जल्दी नहीं है।',
  // Reversal intensity (section 18)
  'Foundation Intensity Reversal': 'फाउंडेशन इंटेंसिटी रिवर्सल',
  'Advanced Intensity Reversal': 'एडवांस्ड इंटेंसिटी रिवर्सल',
  'Intensive Reversal Treatment': 'इंटेंसिव रिवर्सल ट्रीटमेंट',
  'Let the Physician Decide': 'डॉक्टर को तय करने दें',
  'Suitable for early stage or mild cases, gradual approach, less restrictions, slower steady results.': 'शुरुआती या हल्के मामलों के लिए उपयुक्त — धीमी व स्थिर प्रगति, कम पाबंदियां।',
  'Suitable for moderate cases or long term conditions, structured approach, moderate restrictions, steady results.': 'मध्यम या दीर्घकालिक स्थितियों के लिए उपयुक्त — संरचित तरीका, मध्यम पाबंदियां, स्थिर परिणाम।',
  'Suitable for severe or complicated cases, high HbA1c, multiple medications, strict protocol, faster results.': 'गंभीर मामलों के लिए उपयुक्त — सख्त प्रोटोकॉल, तेज़ परिणाम।',
  'Our lead clinical team will evaluate your reports and prescribe the exact optimal protocol intensity.': 'हमारी मुख्य क्लीनिकल टीम आपकी रिपोर्ट देखकर सटीक प्रोटोकॉल तय करेगी।',
  // Exercise plan (section 20)
  'Walking or brisk walking (outdoor or treadmill)': 'वॉकिंग या तेज़ चाल (बाहर या ट्रेडमिल)',
  'Yoga asanas and pranayama': 'योगासन व प्राणायाम', 'Functional training or HIIT': 'फंक्शनल ट्रेनिंग या HIIT',
  'Strength / Weight training': 'स्ट्रेंथ / वेट ट्रेनिंग', 'Swimming': 'तैराकी', 'Cycling': 'साइकिलिंग',
  'Dance / Zumba': 'डांस / ज़ुम्बा', 'Sports': 'खेल',
  'Morning': 'सुबह', 'Evening': 'शाम', 'Flexible': 'लचीला समय',
  // Organ health categories (section 15)
  'Diabetes Complications': 'डायबिटीज जटिलताएं', 'Cardiovascular Symptoms': 'हृदय संबंधी लक्षण',
  'Liver Symptoms': 'लिवर संबंधी लक्षण', 'Kidney Symptoms': 'किडनी संबंधी लक्षण',
  'Thyroid Symptoms': 'थायरॉइड संबंधी लक्षण', 'Joint & Bone Symptoms': 'जोड़ों व हड्डियों के लक्षण',
  'Neurological Symptoms': 'न्यूरोलॉजिकल लक्षण', 'Skin Symptoms': 'त्वचा संबंधी लक्षण',
  'Respiratory Symptoms': 'श्वसन संबंधी लक्षण',
};

/** Hindi labels for the 22 module titles (sidebar) — used both there and
 *  anywhere else a module needs to name itself. */
const SECTION_TITLE_HI: Record<string, string> = {
  'Patient Details': 'रोगी विवरण',
  'Concerns & Goals': 'चिंताएं व लक्ष्य',
  'Medical Conditions': 'चिकित्सीय स्थितियां',
  'Meds, Insulin & Allergies': 'दवाएं, इंसुलिन व एलर्जी',
  'Health Readings': 'स्वास्थ्य रीडिंग',
  'Sleep & Stress': 'नींद व तनाव',
  'Gut & Digestion': 'पाचन तंत्र',
  'Lab Test Reports': 'लैब टेस्ट रिपोर्ट',
  'Previous Treatments': 'पिछले उपचार',
  'Diet & Eating Pattern': 'आहार व खानपान',
  'Lifestyle & Activity': 'जीवनशैली व गतिविधि',
  'Family History': 'पारिवारिक इतिहास',
  'Hormonal (Women)': 'हार्मोनल (महिला)',
  'Hormonal (Men)': 'हार्मोनल (पुरुष)',
  'Organ Complications': 'अंग संबंधी जटिलताएं',
  'Readiness & Commitment': 'तैयारी व संकल्प',
  'Start Timeline': 'शुरुआत की समयसीमा',
  'Reversal Intensity': 'रिवर्सल तीव्रता',
  'Daily Routine': 'दैनिक दिनचर्या',
  'Exercise Plan': 'व्यायाम योजना',
  'Doctor Query': 'डॉक्टर से प्रश्न',
  'Additional Details': 'अतिरिक्त जानकारी',
};

interface RootCauseAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  onSaveAssessment: (data: RootCauseAssessmentData) => void;
}

// ---------------------------------------------------------------------------
// Small reusable form primitives shared across all 22 assessment modules.
// ---------------------------------------------------------------------------

const inputClass = 'w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold';

const Field: React.FC<{
  label: string;
  hint?: string;
  /** A small category icon shown in a circle next to the label — every
   *  module's fields get one (see the icon-assignment pass), matching the
   *  reference mockup's per-question icons instead of a bare label. */
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ label, hint, icon: Icon, children }) => (
  <div>
    <label className="text-xs font-bold flex items-center gap-2 mb-1">
      {Icon && (
        <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </span>
      )}
      <span>{label}</span>
    </label>
    {children}
    {hint && <p className={`text-[10px] text-zinc-500 mt-1 ${Icon ? 'ml-8' : ''}`}>{hint}</p>}
  </div>
);

const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input {...props} className={`${inputClass} ${className || ''}`} />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea {...props} className={`${inputClass} ${className || ''}`} />
);

// Section 15 maps one organ-system key to a Field each — a per-key icon
// (rather than one generic icon for all nine) so the organ actually being
// asked about is visually distinguishable at a glance.
const ORGAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  diabetesComplications: Activity,
  cardiovascularSymptoms: Heart,
  liverSymptoms: Flame,
  kidneySymptoms: Droplets,
  thyroidSymptoms: Zap,
  jointBoneSymptoms: Dumbbell,
  neurologicalSymptoms: Brain,
  skinSymptoms: Sparkles,
  respiratorySymptoms: AlertTriangle,
};

const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select {...props} className={`${inputClass} ${className || ''}`}>
    {children}
  </select>
);

const YesNo: React.FC<{ value?: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => {
  const { language } = useLanguage();
  return (
    <div className="flex gap-2">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
            value === v
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-zinc-100 border border-zinc-300 text-zinc-500'
          }`}
        >
          {v ? (language === 'hi' ? 'हां' : 'Yes') : (language === 'hi' ? 'नहीं' : 'No')}
        </button>
      ))}
    </div>
  );
};

// Multi-select from a fixed, common list of options (chip toggle). The
// English value is always what's stored in formData — only the on-screen
// label is translated, via OPTION_LABEL_HI.
const ChipToggle: React.FC<{ options: string[]; selected: string[]; onChange: (next: string[]) => void }> = ({ options, selected, onChange }) => {
  const { language } = useLanguage();
  return (
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
                : 'border-zinc-300 text-zinc-500 hover:border-emerald-400'
            }`}
          >
            {language === 'hi' ? (OPTION_LABEL_HI[opt] || opt) : opt}
          </button>
        );
      })}
    </div>
  );
};

// Free-form tag list: type a value, press Enter or comma to add; click a chip's × to remove.
const TagsInput: React.FC<{ values: string[]; onChange: (next: string[]) => void; placeholder?: string }> = ({ values, onChange, placeholder }) => {
  const { language } = useLanguage();
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
          <span key={`${v}-${i}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
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
        placeholder={placeholder || (language === 'hi' ? 'लिखें और जोड़ने के लिए Enter दबाएं...' : 'Type and press Enter to add...')}
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

// ---------------------------------------------------------------------------
// Pre-fills this 22-module form from the user's real onboarding answers
// (health deep-dive + conditions) instead of generic placeholder content —
// every field with no onboarding equivalent is left blank rather than
// invented, since this form is meant to be reviewed and completed, not
// presented as if it were already real data.
// ---------------------------------------------------------------------------

function mapSleepQuality(v?: string): 'good' | 'average' | 'poor' | 'very_poor' {
  switch (v) {
    case 'Good': return 'good';
    case 'Poor': return 'poor';
    case 'Very poor': return 'very_poor';
    default: return 'average';
  }
}
function mapStressLevel(v?: string): 'low' | 'moderate' | 'high' | 'overwhelming' {
  switch (v) {
    case 'Low': return 'low';
    case 'High': return 'high';
    case 'Overwhelming': return 'overwhelming';
    default: return 'moderate';
  }
}
function mapStoolType(v?: string): 'normal' | 'hard' | 'loose' | 'watery' | 'alternating' {
  switch (v) {
    case 'Hard': return 'hard';
    case 'Loose': return 'loose';
    case 'Watery': return 'watery';
    case 'Alternating': return 'alternating';
    default: return 'normal';
  }
}
function parseSleepHours(v?: string): number {
  const m = (v || '').match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 7;
}
function ratingFromEnergyLevel(v?: string): number {
  switch (v) {
    case 'Very low': return 2;
    case 'Low': return 4;
    case 'Good': return 7;
    case 'Excellent': return 9;
    default: return 5; // Moderate / unknown
  }
}
function buildFamilyHistory(list: string[]): RootCauseAssessmentData['familyHistory'] {
  const has = (s: string) => list.includes(s);
  return {
    diabetes: has('Diabetes') ? 'Yes' : '',
    hypertension: has('High BP') ? 'Yes' : '',
    heartDisease: has('Heart disease') ? 'Yes' : '',
    thyroid: has('Thyroid disease') ? 'Yes' : '',
    pcosHormonal: has('PCOS/PCOD') ? 'Yes' : '',
    cholesterol: has('High cholesterol') ? 'Yes' : '',
    obesity: has('Obesity') ? 'Yes' : '',
    autoimmune: '',
    cancer: has('Cancer') ? 'Yes' : '',
    kidneyDisease: has('Kidney disease') ? 'Yes' : '',
    liverDisease: '',
    mentalHealth: has('Mental health condition') ? 'Yes' : '',
    otherConditions: list.includes('Other') ? 'See notes' : '',
  };
}

function buildAssessmentFromProfile(profile: UserHealthProfile): RootCauseAssessmentData {
  const dd: any = profile.healthDeepDive || {};
  const conditions = (profile.medicalConditions || []).filter((c) => c && c !== 'None');
  const heightCm = profile.heightCm || 0;

  return {
    email: profile.email || '',
    whatsappNumber: profile.phone || '',
    preferredContactMethod: 'whatsapp',
    bestContactTime: '',
    communicationLanguage: '',
    backupContactName: '',
    backupContactRelationship: '',
    backupContactNumber: '',

    fullName: profile.name || '',
    age: profile.age || 0,
    gender: profile.gender || 'male',
    heightFeet: Math.floor(heightCm / 30.48),
    heightInches: Math.round((heightCm % 30.48) / 2.54),
    currentWeightKg: profile.currentWeightKg || 0,
    highestWeightKg: undefined,
    highestWeightWhen: '',
    waistCircumferenceInches: undefined,
    cityStateCountry: '',
    occupation: '',
    workHoursPerDay: 8,
    workType: 'seated',

    mainHealthConcern: conditions.filter((c) => c !== 'Other').join(', '),
    bothersomeSymptoms: (dd.organSymptoms || []).filter((s: string) => s !== 'None').join(', '),
    goal90to120Days: profile.goal ? profile.goal.replace(/_/g, ' ') : '',
    overallHealthRating: 5,
    energyLevelRating: ratingFromEnergyLevel(dd.energyLevel),
    qualityOfLifeRating: 5,
    successfulTreatmentVision: '',

    diagnosedConditions: conditions.filter((c) => c !== 'Other').map((c) => ({
      conditionName: c,
      diagnosedMonthYear: '',
      currentStatus: 'uncontrolled' as const,
      severityRating: 5,
      beganWhen: '',
      currentTreatment: '',
    })),
    hospitalisationHistory: '',
    emergencyEpisodeHistory: '',

    medicinesList: dd.onMedicines === 'yes' && dd.medicinesText
      ? [{ name: dd.medicinesText, dose: '', timing: '', frequencyPerDay: '', sinceWhen: '', reason: '' }]
      : [],
    vitaminsAndSupplements: dd.onSupplements === 'yes' ? (dd.supplementsText || '') : '',
    insulinDetails: {
      isUsingInsulin: dd.onInsulin === 'yes',
      basalInsulin: '',
      rapidBreakfastUnits: '',
      rapidLunchUnits: '',
      rapidDinnerUnits: '',
      totalDailyDose: dd.insulinDetails || '',
      recentDoseChanges: '',
      lowSugarEpisodes: '',
    },
    steroidsLast6Months: '',
    medicinesStoppedLast3Months: '',
    medicinesStoppedReason: '',
    frequentlyMissedMedicines: '',
    allergies: {
      medicineAllergies: dd.medicineAllergy === 'yes' ? 'Yes' : dd.medicineAllergy === 'not_sure' ? 'Not sure' : 'None known',
      foodAllergies: dd.foodAllergy === 'yes' ? ((dd.foodAllergens || []).join(', ') || 'Yes') : dd.foodAllergy === 'not_sure' ? 'Not sure' : 'None',
      environmentalAllergies: dd.envAllergy === 'yes' ? 'Yes' : dd.envAllergy === 'not_sure' ? 'Not sure' : 'None',
      adverseReactions: (dd.allergyReactions || []).join(', '),
    },

    bloodSugar: {
      monitorsSugar: dd.monitorsSugar === 'yes',
      monitoringMethod: undefined,
      averageFasting7Days: dd.fastingSugar || '',
      averagePostMeal7Days: dd.postMealSugar || '',
      morningSpikes: undefined,
      postMealSpikes: undefined,
      lowSugarEpisodes: false,
      lowSugarDetails: '',
      latestHbA1c: dd.hba1c || '',
      latestHbA1cDate: '',
      hba1c3MonthsAgo: '',
      hba1c6MonthsAgo: '',
      highestHbA1cEver: '',
    },
    cardioVitals: {
      recentBp: dd.bloodPressure || '',
      usualBpRange: '',
      standingDizziness: false,
      restingPulse: dd.restingHeartRate || '',
      palpitations: false,
      currentWeight: profile.currentWeightKg ? `${profile.currentWeightKg} kg` : '',
      weight3MonthsAgo: '',
      weight6MonthsAgo: '',
      spO2: '',
      ketone: '',
      creatinine: '',
      egfr: '',
      uricAcid: '',
      otherTracked: dd.otherLabValues || '',
    },

    sleep: {
      sleepTime: dd.sleepTime || '',
      wakeUpTime: dd.wakeTime || '',
      averageSleepHours: parseSleepHours(dd.sleepHours),
      sleepQuality: mapSleepQuality(dd.sleepQuality),
      difficultyFallingAsleep: false,
      wakesDuringNight: false,
      wakeCount: '',
      nightTimeUrinationCount: '',
      wakesRefreshed: false,
      snores: dd.snoring === 'yes' ? 'Yes' : dd.snoring === 'no' ? 'No' : '',
      gaspOrStopBreathing: '',
      sleepApnoeaDiagnosed: dd.sleepApnea === 'yes',
      cpapUsed: false,
      daytimeSleepinessNapping: '',
      sleepMedicineOrAid: '',
      shiftWork: false,
      sleepDisturbances: '',
    },
    stressMental: {
      stressLevel: mapStressLevel(dd.stressLevel),
      mainSourcesOfStress: (dd.stressSources || []).join(', '),
      majorTraumaLast2Years: false,
      traumaExplanation: '',
      emotionalSymptoms: dd.emotionalSymptoms || [],
      mentalConditionDiagnosed: false,
      mentalHealthMedsOrTherapy: '',
      stressManagementMethods: (dd.stressManagement || []).join(', '),
      emotionalWellbeingRating: 5,
    },

    gut: {
      bowelFrequency: dd.bowelFrequency || '',
      stoolType: mapStoolType(dd.stoolType),
      symptoms: dd.digestiveSymptoms || [],
      symptomFrequency: '',
      appetite: 'normal',
      diagnosedConditions: dd.digestiveConditions || [],
      antibioticUseLast6Months: false,
      regularAcidityMedicines: false,
      probioticsOrEnzymes: false,
      triggerFoods: '',
    },

    labReports: {
      hasRecentTests: false,
      uploadedFileNames: [],
      reportNotes: '',
    },

    previousTreatments: {
      treatmentsTried: [],
      whatImproved: '',
      whatDidNotImprove: '',
      whyStopped: '',
      improvementRemained: 'not_applicable',
    },

    diet: {
      dietType: profile.dietaryPreference || '',
      regionalPreference: '',
      mealsPerDay: 3,
      firstMealTime: '',
      lastMealTime: '',
      lateNightEating: false,
      breakfast: '',
      lunch: '',
      dinner: '',
      snacks: '',
      teaCoffeeCount: dd.teaCoffee || '',
      addsSugarOrHoney: false,
      friedFoodFrequency: dd.friedFoodFreq || '',
      sweetsFrequency: '',
      packagedFoodFrequency: '',
      outsideFoodFrequency: '',
      waterIntakeLiters: dd.waterIntake || '',
      foodDislikesOrRestrictions: '',
      cravedFoods: '',
      alcoholTobaccoUse: [dd.alcohol && `Alcohol: ${dd.alcohol}`, dd.tobacco && `Tobacco: ${dd.tobacco}`].filter(Boolean).join(', '),
      previousDietHistory: '',
      eatingDisorderHistory: false,
    },

    lifestyle: {
      regularExercise: profile.activityLevel === 'moderately_active' || profile.activityLevel === 'very_active',
      exerciseType: '',
      frequencyDaysPerWeek: undefined,
      durationMinutes: undefined,
      timing: '',
      noExerciseReason: '',
      sittingHoursPerDay: parseFloat(dd.sittingHours) || 0,
      screenTimeHoursPerDay: parseFloat(dd.screenTimeHours) || 0,
      nonExerciseMovement: '',
      physicalLimitationsOrInjuries: '',
    },

    familyHistory: buildFamilyHistory(dd.familyHistory || []),

    hormonalWomen: profile.gender === 'female' ? {
      menstrualStatus: dd.menstrualStatus || '',
      cycleLengthDays: dd.cycleLength || '',
      periodDurationDays: '',
      flow: '',
      menstrualCramps: '',
      pmsSymptoms: [],
      pcodPcosDiagnosis: dd.pcos === 'yes' ? 'Yes' : dd.pcos === 'not_sure' ? 'Not sure' : 'No',
      thyroidDiagnosisAndMeds: '',
      currentlyPregnant: dd.pregnant === 'yes',
      planningPregnancy: false,
      currentlyBreastfeeding: false,
      skinIssues: [],
      menopauseSymptoms: dd.menopauseSymptoms || [],
    } : undefined,

    hormonalMen: profile.gender === 'male' ? {
      energyLevel: dd.energyLevel || '',
      libido: dd.libido || '',
      erectileDifficulty: conditions.includes('Erectile Dysfunction') ? 'Yes' : '',
      morningErectionsRegular: undefined,
      muscleMassTrend: '',
      facialBodyHairGrowth: '',
      gynecomastia: '',
      moodChanges: '',
      diagnosedLowTestosterone: dd.lowTestosterone === 'yes' ? 'Yes' : dd.lowTestosterone === 'not_sure' ? 'Not tested' : 'No',
      prostateIssues: (dd.prostateSymptoms || []).join(', '),
    } : undefined,

    organHealth: {
      diabetesComplications: [],
      cardiovascularSymptoms: [],
      liverSymptoms: [],
      kidneySymptoms: [],
      thyroidSymptoms: [],
      jointBoneSymptoms: [],
      neurologicalSymptoms: [],
      skinSymptoms: [],
      respiratorySymptoms: [],
      unusualSymptomsNotes: (dd.organSymptoms || []).filter((s: string) => s !== 'None').join(', '),
    },

    readiness: {
      mainBarriers: dd.biggestBarrier || '',
      helpfulFactors: dd.helpNeeded || [],
      healthPriorityWillingness: '',
      hoursPerWeekCommitment: '',
      motivatedForRootCause: true,
      canCommit90Days: true,
      familySupport: true,
    },

    startTimeline: 'within_3_days',
    reversalIntensity: 'advanced',
    reversalIntensityCustomNote: '',

    dailyRoutine: {
      wakeUpTime: dd.wakeTime || '',
      morningRoutine: '',
      breakfastTime: '',
      midMorningSnackTime: '',
      lunchTime: '',
      eveningSnackTeaTime: '',
      dinnerTime: '',
      sleepTime: dd.sleepTime || '',
      workHours: '',
      dailySittingHoursAtWork: dd.sittingHours || '',
      commuteTimeAndMode: '',
      availableTimeForExercise: '',
      mealPrepManager: '',
      weekendScheduleDifference: '',
    },

    exercisePlan: {
      preferredExerciseTypes: [],
      gymOrEquipmentAccess: '',
      bestTimeSlot: 'morning',
      limitationsExplanation: '',
    },

    personalQueryRequest: '',

    additionalInfo: {
      pastSurgeriesOrIllnesses: (dd.pastMedicalHistory || []).join(', '),
      ongoingSpecialistTreatments: dd.seeingSpecialist === 'yes' ? (dd.specialistDetails || 'Yes') : '',
      geneticOrRareConditions: '',
      occupationChallenges: '',
      livingSituation: '',
      whoManagesMeals: '',
      treatmentRequirements: '',
      questionsForDoctor: '',
      patientExtraNotes: dd.doctorNotes || '',
    },

    submittedAt: new Date().toISOString(),
  };
}

export const RootCauseAssessmentModal: React.FC<RootCauseAssessmentModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveAssessment,
}) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [soundOn, setSoundOn] = useState(getSoundEnabled());
  const [activeSection, setActiveSection] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Form state — pre-filled from the user's real onboarding answers the
  // first time this opens, or their own previously-saved edits after that.
  const [formData, setFormData] = useState<RootCauseAssessmentData>(() => {
    if (profile.assessmentData) return profile.assessmentData;
    return buildAssessmentFromProfile(profile);
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
      <div className="w-full max-w-5xl h-[92vh] bg-white rounded-3xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden text-zinc-900">
        
        {/* Top Header Bar — wraps to two lines on a narrow phone instead of
            the badge/subtitle pair colliding with the icon and each other. */}
        <div className="p-3.5 sm:p-5 border-b border-zinc-200 flex items-start justify-between gap-2 bg-zinc-50/70">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-600/15 text-emerald-600 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                  {tr('UrCare Clinical Assessment', 'UrCare क्लीनिकल मूल्यांकन')}
                </span>
                <span className="text-[9px] sm:text-[10px] text-zinc-500 whitespace-nowrap">{tr('22 Root-Cause Modules', '22 रूट-कॉज़ मॉड्यूल')}</span>
              </div>
              <h2 className="text-sm sm:text-lg font-black leading-tight mt-1">{tr('All-Condition Personalised Root-Cause Reversal Form', 'व्यक्तिगत रूट-कॉज़ रिवर्सल फॉर्म (सभी स्थितियों के लिए)')}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              className="p-2 rounded-xl border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition-colors"
              title={soundOn ? tr('Sound On', 'ध्वनि चालू') : tr('Sound Off', 'ध्वनि बंद')}
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 opacity-50" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Capacity & Google Account Notice Banner — stacks on mobile instead
            of the second pill getting clipped off the right edge of the
            screen (it used to just overflow, with no visible scrollbar). */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold truncate">{tr('Strict Monthly Capacity Limit Active', 'सख्त मासिक क्षमता सीमा लागू')}</span>
            <span className="opacity-75 hidden sm:inline">• {tr('Logged as', 'लॉग इन')} {formData.email}</span>
          </div>
          <span className="text-[11px] font-bold bg-amber-200/60 px-2 py-0.5 rounded self-start sm:shrink-0">
            {tr('Slot Reserved For Assessment', 'मूल्यांकन के लिए स्लॉट सुरक्षित')}
          </span>
        </div>

        {/* Main Body: Left Sidebar Section Nav + Right Active Form Container */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Quick Jump Sidebar */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 bg-zinc-50/50 overflow-x-auto md:overflow-x-visible md:overflow-y-auto p-3 flex md:flex-col gap-1.5 scrollbar-thin">
            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-2 py-1 hidden md:block">
              {tr('Assessment Modules', 'मूल्यांकन मॉड्यूल')} ({activeSection}/22)
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
                      : 'text-zinc-600 hover:bg-zinc-200/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] opacity-70">{sec.num}.</span>
                    <span className="truncate">{tr(sec.title, SECTION_TITLE_HI[sec.title] || sec.title)}</span>
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
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 1', 'अनुभाग 1')}</span>
                  <h3 className="text-xl font-black">{tr('Patient Contact & Demographics', 'रोगी संपर्क व सामान्य जानकारी')}</h3>
                  <p className="text-xs text-zinc-500">{tr('Provide accurate personal details for baseline medical calibration.', 'सटीक चिकित्सीय आधार तय करने के लिए सही व्यक्तिगत जानकारी दें।')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Full Name *', 'पूरा नाम *')}</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('WhatsApp Number *', 'WhatsApp नंबर *')}</label>
                    <input
                      type="text"
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Age *', 'उम्र *')}</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Gender *', 'लिंग *')}</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    >
                      <option value="male">{tr('Male', 'पुरुष')}</option>
                      <option value="female">{tr('Female', 'महिला')}</option>
                      <option value="other">{tr('Other', 'अन्य')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Height (Feet & Inches) *', 'ऊंचाई (फीट व इंच) *')}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={tr('Feet', 'फीट')}
                        value={formData.heightFeet}
                        onChange={(e) => setFormData({ ...formData, heightFeet: Number(e.target.value) })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                      />
                      <input
                        type="number"
                        placeholder={tr('Inches', 'इंच')}
                        value={formData.heightInches}
                        onChange={(e) => setFormData({ ...formData, heightInches: Number(e.target.value) })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Current Weight (kg) *', 'वर्तमान वज़न (kg) *')}</label>
                    <input
                      type="number"
                      value={formData.currentWeightKg}
                      onChange={(e) => setFormData({ ...formData, currentWeightKg: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Highest Weight Ever Reached (kg & when)', 'अब तक का सबसे अधिक वज़न (kg व कब)')}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={tr('Weight (kg)', 'वज़न (kg)')}
                        value={formData.highestWeightKg || ''}
                        onChange={(e) => setFormData({ ...formData, highestWeightKg: Number(e.target.value) })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                      />
                      <input
                        type="text"
                        placeholder={tr('Year (e.g. 2022)', 'वर्ष (जैसे 2022)')}
                        value={formData.highestWeightWhen || ''}
                        onChange={(e) => setFormData({ ...formData, highestWeightWhen: e.target.value })}
                        className="w-1/2 p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Waist Circumference (Inches)', 'कमर की परिधि (इंच)')}</label>
                    <input
                      type="number"
                      value={formData.waistCircumferenceInches || ''}
                      onChange={(e) => setFormData({ ...formData, waistCircumferenceInches: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('City, State, Country *', 'शहर, राज्य, देश *')}</label>
                    <input
                      type="text"
                      value={formData.cityStateCountry}
                      onChange={(e) => setFormData({ ...formData, cityStateCountry: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Type of Work *', 'काम का प्रकार *')}</label>
                    <select
                      value={formData.workType}
                      onChange={(e) => setFormData({ ...formData, workType: e.target.value as any })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    >
                      <option value="seated">{tr('Seated Job', 'बैठकर काम')}</option>
                      <option value="physical">{tr('Physical Job', 'शारीरिक काम')}</option>
                      <option value="standing">{tr('Standing Job', 'खड़े होकर काम')}</option>
                      <option value="mixed">{tr('Mixed Work', 'मिश्रित काम')}</option>
                      <option value="shift">{tr('Shift Work', 'शिफ्ट में काम')}</option>
                      <option value="retired">{tr('Retired', 'सेवानिवृत्त')}</option>
                      <option value="not_working">{tr('Not Working Currently', 'फिलहाल काम नहीं कर रहे')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Main Health Concerns & Goals */}
            {activeSection === 2 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 2', 'अनुभाग 2')}</span>
                    <h3 className="text-lg sm:text-xl font-black leading-tight">{tr('Main Health Concerns & 90-120 Days Goal', 'मुख्य स्वास्थ्य चिंताएं व 90-120 दिन का लक्ष्य')}</h3>
                    <p className="text-xs text-zinc-500 mt-1">{tr('Help us understand your current health challenges and your goals, so we can personalise your plan better.', 'हमें अपनी वर्तमान स्वास्थ्य चुनौतियां व लक्ष्य बताएं, ताकि हम आपकी योजना को बेहतर तरीके से व्यक्तिगत बना सकें।')}</p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Heart className="w-3.5 h-3.5" />
                      </span>
                      <span>{tr('What is your main health concern today?', 'आज आपकी मुख्य स्वास्थ्य चिंता क्या है?')} <span className="text-rose-500">*</span></span>
                    </label>
                    <p className="text-[11px] text-zinc-400 ml-8 mb-1.5">{tr('You can select multiple or type your concern.', 'आप कई चुन सकते हैं या अपनी चिंता लिख सकते हैं।')}</p>
                    <div className="relative">
                      <textarea
                        rows={2}
                        value={formData.mainHealthConcern}
                        onChange={(e) => setFormData({ ...formData, mainHealthConcern: e.target.value })}
                        className="w-full p-3 pr-9 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold resize-none"
                      />
                      <ChevronDown className="w-4 h-4 text-zinc-400 absolute top-3 right-3 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      <span>{tr('What symptoms bother you the most?', 'कौन से लक्षण आपको सबसे ज़्यादा परेशान करते हैं?')} <span className="text-rose-500">*</span></span>
                    </label>
                    <p className="text-[11px] text-zinc-400 ml-8 mb-1.5">{tr('Be specific so we can understand better.', 'विशिष्ट रहें ताकि हम बेहतर समझ सकें।')}</p>
                    <textarea
                      rows={2}
                      value={formData.bothersomeSymptoms}
                      onChange={(e) => setFormData({ ...formData, bothersomeSymptoms: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Target className="w-3.5 h-3.5" />
                      </span>
                      <span>{tr('Specific health goal in the next 90-120 days?', 'अगले 90-120 दिनों का विशिष्ट स्वास्थ्य लक्ष्य?')} <span className="text-rose-500">*</span></span>
                    </label>
                    <p className="text-[11px] text-zinc-400 ml-8 mb-1.5">{tr('What would you like to achieve?', 'आप क्या हासिल करना चाहते हैं?')}</p>
                    <textarea
                      rows={2}
                      value={formData.goal90to120Days}
                      onChange={(e) => setFormData({ ...formData, goal90to120Days: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 text-center">
                      <label className="text-xs font-bold block mb-2">{tr('Overall Health (0-10)', 'समग्र स्वास्थ्य (0-10)')}</label>
                      <input
                        type="range" min="0" max="10"
                        value={formData.overallHealthRating}
                        onChange={(e) => setFormData({ ...formData, overallHealthRating: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                      <span className="text-lg font-black text-emerald-600 mt-1 block">{formData.overallHealthRating} / 10</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 text-center">
                      <label className="text-xs font-bold block mb-2">{tr('Energy Level (0-10)', 'ऊर्जा स्तर (0-10)')}</label>
                      <input
                        type="range" min="0" max="10"
                        value={formData.energyLevelRating}
                        onChange={(e) => setFormData({ ...formData, energyLevelRating: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                      <span className="text-lg font-black text-emerald-600 mt-1 block">{formData.energyLevelRating} / 10</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 text-center">
                      <label className="text-xs font-bold block mb-2">{tr('Quality of Life (0-10)', 'जीवन की गुणवत्ता (0-10)')}</label>
                      <input 
                        type="range" min="0" max="10" 
                        value={formData.qualityOfLifeRating} 
                        onChange={(e) => setFormData({ ...formData, qualityOfLifeRating: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                      <span className="text-lg font-black text-emerald-600 mt-1 block">{formData.qualityOfLifeRating} / 10</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Current & Previous Medical Conditions */}
            {activeSection === 3 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 3', 'अनुभाग 3')}</span>
                  <h3 className="text-xl font-black">{tr('Diagnosed Medical Conditions', 'निदान की गई चिकित्सीय स्थितियां')}</h3>
                  <p className="text-xs text-zinc-500">{tr('List every condition you have been diagnosed with, past or present.', 'वे सभी स्थितियां लिखें जिनका निदान हुआ है — पहले या अभी।')}</p>
                </div>

                <div className="space-y-3">
                  {formData.diagnosedConditions.map((cond, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <TextInput
                          placeholder={tr('Condition Name', 'स्थिति का नाम')} value={cond.conditionName}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], conditionName: e.target.value };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        />
                        <TextInput
                          placeholder={tr('Diagnosed Month & Year', 'निदान का महीना व वर्ष')} value={cond.diagnosedMonthYear}
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
                          <option value="controlled">{tr('Controlled', 'नियंत्रित')}</option>
                          <option value="uncontrolled">{tr('Uncontrolled', 'अनियंत्रित')}</option>
                          <option value="worsening">{tr('Worsening', 'बिगड़ रहा है')}</option>
                        </SelectInput>
                        <TextInput
                          placeholder={tr('Began When', 'कब शुरू हुई')} value={cond.beganWhen}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], beganWhen: e.target.value };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        />
                        <TextInput
                          placeholder={tr('Current Treatment', 'वर्तमान उपचार')} value={cond.currentTreatment}
                          onChange={(e) => {
                            const list = [...formData.diagnosedConditions];
                            list[idx] = { ...list[idx], currentTreatment: e.target.value };
                            setFormData({ ...formData, diagnosedConditions: list });
                          }}
                        />
                        <div>
                          <label className="text-[10px] font-bold block mb-1 opacity-70">{tr('Severity', 'गंभीरता')}: {cond.severityRating} / 10</label>
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
                          {tr('Remove Condition', 'स्थिति हटाएं')}
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
                    + {tr('Add Another Condition', 'एक और स्थिति जोड़ें')}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={CheckSquare} label={tr('Hospitalisation History', 'अस्पताल भर्ती का इतिहास')}>
                    <TextArea rows={2} value={formData.hospitalisationHistory || ''} onChange={(e) => setFormData({ ...formData, hospitalisationHistory: e.target.value })} />
                  </Field>
                  <Field icon={CheckSquare} label={tr('Emergency Episode History', 'आपातकालीन घटनाओं का इतिहास')}>
                    <TextArea rows={2} value={formData.emergencyEpisodeHistory || ''} onChange={(e) => setFormData({ ...formData, emergencyEpisodeHistory: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}

            {/* Section 4: Medicines, Insulin & Allergies */}
            {activeSection === 4 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 4', 'अनुभाग 4')}</span>
                  <h3 className="text-xl font-black">{tr('Prescriptions, Insulin & Supplements', 'दवाएं, इंसुलिन व सप्लीमेंट्स')}</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                    <h4 className="text-xs font-black uppercase text-emerald-600">{tr('Current Prescription Medicines', 'वर्तमान डॉक्टरी दवाएं')}</h4>
                    {formData.medicinesList.map((med, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <input
                          type="text" placeholder={tr('Name', 'नाम')} value={med.name}
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].name = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 bg-white font-bold"
                        />
                        <input
                          type="text" placeholder={tr('Dose', 'खुराक')} value={med.dose}
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].dose = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 bg-white font-bold"
                        />
                        <input
                          type="text" placeholder={tr('Timing', 'समय')} value={med.timing}
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].timing = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 bg-white font-bold"
                        />
                        <input
                          type="text" placeholder={tr('Reason', 'कारण')} value={med.reason}
                          onChange={(e) => {
                            const list = [...formData.medicinesList];
                            list[idx].reason = e.target.value;
                            setFormData({ ...formData, medicinesList: list });
                          }}
                          className="p-2.5 rounded-lg border border-zinc-300 bg-white font-bold"
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
                      + {tr('Add Another Medicine', 'एक और दवा जोड़ें')}
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Vitamins & Supplements', 'विटामिन व सप्लीमेंट्स')}</label>
                    <input
                      type="text"
                      value={formData.vitaminsAndSupplements || ''}
                      onChange={(e) => setFormData({ ...formData, vitaminsAndSupplements: e.target.value })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Known Allergies / Adverse Reactions', 'ज्ञात एलर्जी / प्रतिकूल प्रतिक्रियाएं')}</label>
                    <input 
                      type="text" 
                      value={formData.allergies?.medicineAllergies || ''} 
                      onChange={(e) => setFormData({ ...formData, allergies: { ...formData.allergies, medicineAllergies: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 5: Current Health Readings */}
            {activeSection === 5 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 5', 'अनुभाग 5')}</span>
                  <h3 className="text-xl font-black">{tr('Blood Sugar & Cardiovascular Vitals', 'ब्लड शुगर व हृदय संबंधी जांच')}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Latest HbA1c & Date', 'नवीनतम HbA1c व तारीख')}</label>
                    <input
                      type="text"
                      value={formData.bloodSugar.latestHbA1c || ''}
                      onChange={(e) => setFormData({ ...formData, bloodSugar: { ...formData.bloodSugar, latestHbA1c: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Average Fasting Blood Sugar (Last 7 Days)', 'औसत फास्टिंग शुगर (पिछले 7 दिन)')}</label>
                    <input
                      type="text"
                      value={formData.bloodSugar.averageFasting7Days || ''}
                      onChange={(e) => setFormData({ ...formData, bloodSugar: { ...formData.bloodSugar, averageFasting7Days: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Average Post-Meal Sugar', 'औसत भोजन-बाद शुगर')}</label>
                    <input
                      type="text"
                      value={formData.bloodSugar.averagePostMeal7Days || ''}
                      onChange={(e) => setFormData({ ...formData, bloodSugar: { ...formData.bloodSugar, averagePostMeal7Days: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">{tr('Blood Pressure Range', 'ब्लड प्रेशर रेंज')}</label>
                    <input 
                      type="text" 
                      value={formData.cardioVitals.usualBpRange || ''} 
                      onChange={(e) => setFormData({ ...formData, cardioVitals: { ...formData.cardioVitals, usualBpRange: e.target.value } })}
                      className="w-full p-3 rounded-xl border border-zinc-300 bg-zinc-50 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 6: Sleep, Stress & Mental Wellbeing */}
            {activeSection === 6 && (
              <div className="space-y-6 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 6', 'अनुभाग 6')}</span>
                  <h3 className="text-xl font-black">{tr('Sleep, Stress & Mental Wellbeing', 'नींद, तनाव व मानसिक स्वास्थ्य')}</h3>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-emerald-600">{tr('Sleep', 'नींद')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field icon={Moon} label={tr('Sleep Time', 'सोने का समय')}><TextInput value={formData.sleep.sleepTime} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepTime: e.target.value } })} /></Field>
                    <Field icon={Moon} label={tr('Wake Up Time', 'उठने का समय')}><TextInput value={formData.sleep.wakeUpTime} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, wakeUpTime: e.target.value } })} /></Field>
                    <Field icon={Moon} label={tr('Average Sleep Hours', 'औसत नींद के घंटे')}><TextInput type="number" value={formData.sleep.averageSleepHours} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, averageSleepHours: Number(e.target.value) } })} /></Field>
                    <Field icon={Moon} label={tr('Sleep Quality', 'नींद की गुणवत्ता')}>
                      <SelectInput value={formData.sleep.sleepQuality} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepQuality: e.target.value as any } })}>
                        <option value="good">{tr('Good', 'अच्छी')}</option>
                        <option value="average">{tr('Average', 'औसत')}</option>
                        <option value="poor">{tr('Poor', 'खराब')}</option>
                        <option value="very_poor">{tr('Very Poor', 'बहुत खराब')}</option>
                      </SelectInput>
                    </Field>
                    <Field icon={Moon} label={tr('Difficulty Falling Asleep?', 'सोने में कठिनाई?')}><YesNo value={formData.sleep.difficultyFallingAsleep} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, difficultyFallingAsleep: v } })} /></Field>
                    <Field icon={Moon} label={tr('Wakes During Night?', 'रात में नींद खुलती है?')}><YesNo value={formData.sleep.wakesDuringNight} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, wakesDuringNight: v } })} /></Field>
                    <Field icon={Moon} label={tr('Wake Count (if any)', 'कितनी बार नींद खुलती है')}><TextInput value={formData.sleep.wakeCount || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, wakeCount: e.target.value } })} /></Field>
                    <Field icon={CheckSquare} label={tr('Night-Time Urination Count', 'रात में पेशाब जाने की संख्या')}><TextInput value={formData.sleep.nightTimeUrinationCount || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, nightTimeUrinationCount: e.target.value } })} /></Field>
                    <Field icon={Moon} label={tr('Wakes Up Refreshed?', 'उठने पर तरोताज़ा महसूस होता है?')}><YesNo value={formData.sleep.wakesRefreshed} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, wakesRefreshed: v } })} /></Field>
                    <Field icon={Moon} label={tr('Snores?', 'खर्राटे आते हैं?')}><TextInput value={formData.sleep.snores} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, snores: e.target.value } })} /></Field>
                    <Field icon={Moon} label={tr('Gasps / Stops Breathing While Asleep?', 'नींद में सांस रुकना/हांफना?')}><TextInput value={formData.sleep.gaspOrStopBreathing} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, gaspOrStopBreathing: e.target.value } })} /></Field>
                    <Field icon={Moon} label={tr('Sleep Apnoea Diagnosed?', 'स्लीप एपनिया का निदान हुआ है?')}><YesNo value={formData.sleep.sleepApnoeaDiagnosed} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepApnoeaDiagnosed: v } })} /></Field>
                    <Field icon={Moon} label={tr('Uses CPAP?', 'CPAP का उपयोग करते हैं?')}><YesNo value={formData.sleep.cpapUsed} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, cpapUsed: v } })} /></Field>
                    <Field icon={Moon} label={tr('Daytime Sleepiness / Napping', 'दिन में नींद आना / झपकी')}><TextInput value={formData.sleep.daytimeSleepinessNapping || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, daytimeSleepinessNapping: e.target.value } })} /></Field>
                    <Field icon={Moon} label={tr('Sleep Medicine / Aid Used', 'नींद की दवा/सहायता')}><TextInput value={formData.sleep.sleepMedicineOrAid || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepMedicineOrAid: e.target.value } })} /></Field>
                    <Field icon={CheckSquare} label={tr('Works Shift Hours?', 'शिफ्ट में काम करते हैं?')}><YesNo value={formData.sleep.shiftWork} onChange={(v) => setFormData({ ...formData, sleep: { ...formData.sleep, shiftWork: v } })} /></Field>
                  </div>
                  <Field icon={Moon} label={tr('Other Sleep Disturbances', 'नींद संबंधी अन्य समस्याएं')}><TextArea rows={2} value={formData.sleep.sleepDisturbances || ''} onChange={(e) => setFormData({ ...formData, sleep: { ...formData.sleep, sleepDisturbances: e.target.value } })} /></Field>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-200">
                  <h4 className="text-xs font-black uppercase text-emerald-600">{tr('Stress & Mental Wellbeing', 'तनाव व मानसिक स्वास्थ्य')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field icon={Brain} label={tr('Stress Level', 'तनाव स्तर')}>
                      <SelectInput value={formData.stressMental.stressLevel} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, stressLevel: e.target.value as any } })}>
                        <option value="low">{tr('Low', 'कम')}</option>
                        <option value="moderate">{tr('Moderate', 'मध्यम')}</option>
                        <option value="high">{tr('High', 'ज़्यादा')}</option>
                        <option value="overwhelming">{tr('Overwhelming', 'असहनीय')}</option>
                      </SelectInput>
                    </Field>
                    <Field icon={Brain} label={tr('Main Sources of Stress', 'तनाव के मुख्य कारण')}><TextInput value={formData.stressMental.mainSourcesOfStress || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, mainSourcesOfStress: e.target.value } })} /></Field>
                    <Field icon={Brain} label={tr('Major Trauma in Last 2 Years?', 'पिछले 2 वर्षों में कोई बड़ा आघात?')}><YesNo value={formData.stressMental.majorTraumaLast2Years} onChange={(v) => setFormData({ ...formData, stressMental: { ...formData.stressMental, majorTraumaLast2Years: v } })} /></Field>
                    <Field icon={Brain} label={tr('Mental Condition Diagnosed?', 'मानसिक स्थिति का निदान हुआ है?')}><YesNo value={formData.stressMental.mentalConditionDiagnosed} onChange={(v) => setFormData({ ...formData, stressMental: { ...formData.stressMental, mentalConditionDiagnosed: v } })} /></Field>
                    <Field icon={Brain} label={tr('Mental Health Meds / Therapy', 'मानसिक स्वास्थ्य दवा / थेरेपी')}><TextInput value={formData.stressMental.mentalHealthMedsOrTherapy || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, mentalHealthMedsOrTherapy: e.target.value } })} /></Field>
                    <Field icon={Brain} label={tr('Stress Management Methods', 'तनाव प्रबंधन के तरीके')}><TextInput value={formData.stressMental.stressManagementMethods || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, stressManagementMethods: e.target.value } })} /></Field>
                  </div>
                  {formData.stressMental.majorTraumaLast2Years && (
                    <Field icon={Brain} label={tr('Trauma Explanation', 'आघात का विवरण')}><TextArea rows={2} value={formData.stressMental.traumaExplanation || ''} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, traumaExplanation: e.target.value } })} /></Field>
                  )}
                  <Field icon={Brain} label={tr('Emotional Symptoms', 'भावनात्मक लक्षण')}>
                    <ChipToggle
                      options={['Difficulty Relaxing', 'Constant Worry', 'Irritability', 'Low Mood / Sadness', 'Panic Episodes', 'Loss of Interest', 'Racing Thoughts', 'None']}
                      selected={formData.stressMental.emotionalSymptoms}
                      onChange={(next) => setFormData({ ...formData, stressMental: { ...formData.stressMental, emotionalSymptoms: next } })}
                    />
                  </Field>
                  <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 text-center">
                    <label className="text-xs font-bold block mb-2">{tr('Emotional Wellbeing (0-10)', 'भावनात्मक स्वास्थ्य (0-10)')}</label>
                    <input type="range" min="0" max="10" value={formData.stressMental.emotionalWellbeingRating} onChange={(e) => setFormData({ ...formData, stressMental: { ...formData.stressMental, emotionalWellbeingRating: Number(e.target.value) } })} className="w-full accent-emerald-500" />
                    <span className="text-lg font-black text-emerald-600 mt-1 block">{formData.stressMental.emotionalWellbeingRating} / 10</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 7: Digestive & Gut Health */}
            {activeSection === 7 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 7', 'अनुभाग 7')}</span>
                  <h3 className="text-xl font-black">{tr('Digestive & Gut Health', 'पाचन तंत्र का स्वास्थ्य')}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Apple} label={tr('Bowel Frequency', 'मल त्याग की आवृत्ति')}><TextInput value={formData.gut.bowelFrequency} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, bowelFrequency: e.target.value } })} /></Field>
                  <Field icon={Apple} label={tr('Stool Type', 'मल का प्रकार')}>
                    <SelectInput value={formData.gut.stoolType} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, stoolType: e.target.value as any } })}>
                      <option value="normal">{tr('Normal', 'सामान्य')}</option>
                      <option value="hard">{tr('Hard', 'सख्त')}</option>
                      <option value="loose">{tr('Loose', 'ढीला')}</option>
                      <option value="watery">{tr('Watery', 'पानी जैसा')}</option>
                      <option value="alternating">{tr('Alternating', 'बदलता रहता है')}</option>
                    </SelectInput>
                  </Field>
                  <Field icon={Clock} label={tr('Symptom Frequency', 'लक्षणों की आवृत्ति')}><TextInput value={formData.gut.symptomFrequency} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, symptomFrequency: e.target.value } })} /></Field>
                  <Field icon={Apple} label={tr('Appetite', 'भूख')}>
                    <SelectInput value={formData.gut.appetite} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, appetite: e.target.value as any } })}>
                      <option value="very_low">{tr('Very Low', 'बहुत कम')}</option>
                      <option value="low">{tr('Low', 'कम')}</option>
                      <option value="normal">{tr('Normal', 'सामान्य')}</option>
                      <option value="high">{tr('High', 'ज़्यादा')}</option>
                      <option value="uncontrolled">{tr('Uncontrolled', 'अनियंत्रित')}</option>
                    </SelectInput>
                  </Field>
                  <Field icon={Pill} label={tr('Used Antibiotics in Last 6 Months?', 'पिछले 6 महीनों में एंटीबायोटिक ली?')}><YesNo value={formData.gut.antibioticUseLast6Months} onChange={(v) => setFormData({ ...formData, gut: { ...formData.gut, antibioticUseLast6Months: v } })} /></Field>
                  <Field icon={Pill} label={tr('Takes Regular Acidity Medicines?', 'नियमित एसिडिटी की दवा लेते हैं?')}><YesNo value={formData.gut.regularAcidityMedicines} onChange={(v) => setFormData({ ...formData, gut: { ...formData.gut, regularAcidityMedicines: v } })} /></Field>
                  <Field icon={Apple} label={tr('Uses Probiotics / Digestive Enzymes?', 'प्रोबायोटिक्स / पाचन एंजाइम लेते हैं?')}><YesNo value={formData.gut.probioticsOrEnzymes} onChange={(v) => setFormData({ ...formData, gut: { ...formData.gut, probioticsOrEnzymes: v } })} /></Field>
                </div>

                <Field icon={Apple} label={tr('Digestive Symptoms', 'पाचन संबंधी लक्षण')}>
                  <ChipToggle
                    options={['Bloating or Gas', 'Heaviness After Meals', 'Acid Reflux', 'Constipation', 'Diarrhoea', 'Nausea', 'Abdominal Pain', 'None']}
                    selected={formData.gut.symptoms}
                    onChange={(next) => setFormData({ ...formData, gut: { ...formData.gut, symptoms: next } })}
                  />
                </Field>
                <Field icon={Apple} label={tr('Diagnosed Gut Conditions', 'निदान की गई पाचन समस्याएं')}>
                  <ChipToggle
                    options={['Mild Acidity / GERD', 'IBS', 'Fatty Liver', 'Gallstones', 'H. Pylori', 'Ulcers', 'None']}
                    selected={formData.gut.diagnosedConditions}
                    onChange={(next) => setFormData({ ...formData, gut: { ...formData.gut, diagnosedConditions: next } })}
                  />
                </Field>
                <Field icon={Utensils} label={tr('Trigger Foods', 'ट्रिगर करने वाले खाद्य पदार्थ')}><TextArea rows={2} value={formData.gut.triggerFoods || ''} onChange={(e) => setFormData({ ...formData, gut: { ...formData.gut, triggerFoods: e.target.value } })} placeholder={tr('List any acidity, bloating, or foods causing digestive disturbance...', 'एसिडिटी, गैस या पाचन बिगाड़ने वाले खाद्य पदार्थ लिखें...')} /></Field>
              </div>
            )}

            {/* Section 8: Lab Test Reports */}
            {activeSection === 8 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 8', 'अनुभाग 8')}</span>
                  <h3 className="text-xl font-black">{tr('Lab Test Reports', 'लैब टेस्ट रिपोर्ट')}</h3>
                  <p className="text-xs text-zinc-500">{tr('You can also upload the actual file from the "My Reports" tab — here just tell us what you have.', 'असली फाइल "मेरी रिपोर्ट्स" टैब से अपलोड करें — यहां बस बताएं आपके पास क्या है।')}</p>
                </div>
                <Field icon={FileText} label={tr('Have Recent Lab Tests?', 'हाल में कोई लैब टेस्ट कराया है?')}><YesNo value={formData.labReports.hasRecentTests} onChange={(v) => setFormData({ ...formData, labReports: { ...formData.labReports, hasRecentTests: v } })} /></Field>
                <Field icon={FileText} label={tr('Report File Names / References', 'रिपोर्ट फाइल नाम / संदर्भ')} hint={tr('Type a name and press Enter to add it to the list.', 'नाम लिखें और सूची में जोड़ने के लिए Enter दबाएं।')}>
                  <TagsInput values={formData.labReports.uploadedFileNames} onChange={(next) => setFormData({ ...formData, labReports: { ...formData.labReports, uploadedFileNames: next } })} placeholder={tr('e.g. HbA1c_Lipid_Panel_Report.pdf', 'जैसे HbA1c_Lipid_Panel_Report.pdf')} />
                </Field>
                <Field icon={FileText} label={tr('Report Notes / Key Findings', 'रिपोर्ट नोट्स / मुख्य निष्कर्ष')}><TextArea rows={3} value={formData.labReports.reportNotes || ''} onChange={(e) => setFormData({ ...formData, labReports: { ...formData.labReports, reportNotes: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 9: Previous Treatments Tried */}
            {activeSection === 9 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 9', 'अनुभाग 9')}</span>
                  <h3 className="text-xl font-black">{tr('Previous Treatments Tried', 'पहले आजमाए गए उपचार')}</h3>
                </div>
                <Field icon={CheckSquare} label={tr('Treatments Tried So Far', 'अब तक आजमाए गए उपचार')}>
                  <ChipToggle
                    options={['Prescription Medicines', 'Diet Plan', 'Walking Programme', 'Ayurveda / Herbal', 'Homeopathy', 'Yoga / Meditation', 'Bariatric Surgery', 'Other']}
                    selected={formData.previousTreatments.treatmentsTried}
                    onChange={(next) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, treatmentsTried: next } })}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Stethoscope} label={tr('What Improved?', 'क्या सुधार हुआ?')}><TextArea rows={2} value={formData.previousTreatments.whatImproved || ''} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, whatImproved: e.target.value } })} /></Field>
                  <Field icon={Stethoscope} label={tr('What Did Not Improve?', 'क्या सुधार नहीं हुआ?')}><TextArea rows={2} value={formData.previousTreatments.whatDidNotImprove || ''} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, whatDidNotImprove: e.target.value } })} /></Field>
                  <Field icon={Stethoscope} label={tr('Why Did You Stop?', 'आपने क्यों छोड़ा?')}><TextArea rows={2} value={formData.previousTreatments.whyStopped || ''} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, whyStopped: e.target.value } })} /></Field>
                  <Field icon={Stethoscope} label={tr('Did the Improvement Remain?', 'क्या सुधार बना रहा?')}>
                    <SelectInput value={formData.previousTreatments.improvementRemained} onChange={(e) => setFormData({ ...formData, previousTreatments: { ...formData.previousTreatments, improvementRemained: e.target.value as any } })}>
                      <option value="yes">{tr('Yes', 'हां')}</option>
                      <option value="no">{tr('No', 'नहीं')}</option>
                      <option value="partially">{tr('Partially', 'आंशिक रूप से')}</option>
                      <option value="not_applicable">{tr('Not Applicable', 'लागू नहीं')}</option>
                    </SelectInput>
                  </Field>
                </div>
              </div>
            )}

            {/* Section 10: Diet & Eating Pattern */}
            {activeSection === 10 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 10', 'अनुभाग 10')}</span>
                  <h3 className="text-xl font-black">{tr('Diet & Eating Pattern', 'आहार व खानपान')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Utensils} label={tr('Diet Type', 'आहार प्रकार')}><TextInput value={formData.diet.dietType} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, dietType: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Regional Preference', 'क्षेत्रीय पसंद')}><TextInput value={formData.diet.regionalPreference || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, regionalPreference: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Meals Per Day', 'दिन में कितनी बार भोजन')}><TextInput type="number" value={formData.diet.mealsPerDay} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, mealsPerDay: Number(e.target.value) } })} /></Field>
                  <Field icon={Utensils} label={tr('First Meal Time', 'पहले भोजन का समय')}><TextInput value={formData.diet.firstMealTime} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, firstMealTime: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Last Meal Time', 'आखिरी भोजन का समय')}><TextInput value={formData.diet.lastMealTime} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, lastMealTime: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Eats Late at Night?', 'देर रात खाते हैं?')}><YesNo value={formData.diet.lateNightEating} onChange={(v) => setFormData({ ...formData, diet: { ...formData.diet, lateNightEating: v } })} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field icon={Utensils} label={tr('Typical Breakfast', 'सामान्य नाश्ता')}><TextArea rows={2} value={formData.diet.breakfast} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, breakfast: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Typical Lunch', 'सामान्य दोपहर का भोजन')}><TextArea rows={2} value={formData.diet.lunch} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, lunch: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Typical Dinner', 'सामान्य रात का भोजन')}><TextArea rows={2} value={formData.diet.dinner} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, dinner: e.target.value } })} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Utensils} label={tr('Snacks', 'नाश्ता/स्नैक्स')}><TextInput value={formData.diet.snacks || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, snacks: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Tea / Coffee Count', 'चाय / कॉफी की मात्रा')}><TextInput value={formData.diet.teaCoffeeCount} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, teaCoffeeCount: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Adds Sugar or Honey?', 'चीनी या शहद मिलाते हैं?')}><YesNo value={formData.diet.addsSugarOrHoney} onChange={(v) => setFormData({ ...formData, diet: { ...formData.diet, addsSugarOrHoney: v } })} /></Field>
                  <Field icon={Utensils} label={tr('Fried Food Frequency', 'तले हुए भोजन की आवृत्ति')}><TextInput value={formData.diet.friedFoodFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, friedFoodFrequency: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Sweets Frequency', 'मिठाई की आवृत्ति')}><TextInput value={formData.diet.sweetsFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, sweetsFrequency: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Packaged Food Frequency', 'पैकेज्ड भोजन की आवृत्ति')}><TextInput value={formData.diet.packagedFoodFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, packagedFoodFrequency: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Outside Food Frequency', 'बाहर के खाने की आवृत्ति')}><TextInput value={formData.diet.outsideFoodFrequency} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, outsideFoodFrequency: e.target.value } })} /></Field>
                  <Field icon={Droplets} label={tr('Water Intake (Litres/day)', 'पानी की मात्रा (लीटर/दिन)')}><TextInput value={formData.diet.waterIntakeLiters} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, waterIntakeLiters: e.target.value } })} /></Field>
                  <Field icon={AlertTriangle} label={tr('Alcohol / Tobacco Use', 'शराब / तंबाकू का सेवन')}><TextInput value={formData.diet.alcoholTobaccoUse || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, alcoholTobaccoUse: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Eating Disorder History?', 'खाने संबंधी विकार का इतिहास?')}><YesNo value={formData.diet.eatingDisorderHistory} onChange={(v) => setFormData({ ...formData, diet: { ...formData.diet, eatingDisorderHistory: v } })} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Utensils} label={tr('Food Dislikes / Restrictions', 'नापसंद / परहेज वाले खाद्य पदार्थ')}><TextArea rows={2} value={formData.diet.foodDislikesOrRestrictions || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, foodDislikesOrRestrictions: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Craved Foods', 'तलब वाले खाद्य पदार्थ')}><TextArea rows={2} value={formData.diet.cravedFoods || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, cravedFoods: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Previous Diet History', 'पिछले आहार का इतिहास')}><TextArea rows={2} value={formData.diet.previousDietHistory || ''} onChange={(e) => setFormData({ ...formData, diet: { ...formData.diet, previousDietHistory: e.target.value } })} /></Field>
                </div>
              </div>
            )}

            {/* Section 11: Lifestyle & Physical Activity */}
            {activeSection === 11 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 11', 'अनुभाग 11')}</span>
                  <h3 className="text-xl font-black">{tr('Lifestyle & Physical Activity', 'जीवनशैली व शारीरिक गतिविधि')}</h3>
                </div>
                <Field icon={Dumbbell} label={tr('Do You Exercise Regularly?', 'क्या आप नियमित व्यायाम करते हैं?')}><YesNo value={formData.lifestyle.regularExercise} onChange={(v) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, regularExercise: v } })} /></Field>
                {formData.lifestyle.regularExercise ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field icon={Dumbbell} label={tr('Exercise Type', 'व्यायाम का प्रकार')}><TextInput value={formData.lifestyle.exerciseType || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, exerciseType: e.target.value } })} /></Field>
                    <Field icon={Clock} label={tr('Timing', 'समय')}><TextInput value={formData.lifestyle.timing || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, timing: e.target.value } })} /></Field>
                    <Field icon={Clock} label={tr('Frequency (Days / Week)', 'आवृत्ति (दिन/सप्ताह)')}><TextInput type="number" value={formData.lifestyle.frequencyDaysPerWeek || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, frequencyDaysPerWeek: Number(e.target.value) } })} /></Field>
                    <Field icon={Clock} label={tr('Duration (Minutes)', 'अवधि (मिनट)')}><TextInput type="number" value={formData.lifestyle.durationMinutes || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, durationMinutes: Number(e.target.value) } })} /></Field>
                  </div>
                ) : (
                  <Field icon={CheckSquare} label={tr('Reason for Not Exercising', 'व्यायाम न करने का कारण')}><TextInput value={formData.lifestyle.noExerciseReason || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, noExerciseReason: e.target.value } })} /></Field>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Dumbbell} label={tr('Sitting Hours Per Day', 'दिन में बैठने के घंटे')}><TextInput type="number" value={formData.lifestyle.sittingHoursPerDay} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, sittingHoursPerDay: Number(e.target.value) } })} /></Field>
                  <Field icon={Dumbbell} label={tr('Screen Time Hours Per Day', 'दिन में स्क्रीन समय (घंटे)')}><TextInput type="number" value={formData.lifestyle.screenTimeHoursPerDay} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, screenTimeHoursPerDay: Number(e.target.value) } })} /></Field>
                </div>
                <Field icon={Dumbbell} label={tr('Non-Exercise Movement (chores, stairs, walking)', 'व्यायाम के अलावा गतिविधि (घर का काम, सीढ़ियां, चलना)')}><TextArea rows={2} value={formData.lifestyle.nonExerciseMovement || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, nonExerciseMovement: e.target.value } })} /></Field>
                <Field icon={CheckSquare} label={tr('Physical Limitations / Injuries', 'शारीरिक सीमाएं / चोटें')}><TextArea rows={2} value={formData.lifestyle.physicalLimitationsOrInjuries || ''} onChange={(e) => setFormData({ ...formData, lifestyle: { ...formData.lifestyle, physicalLimitationsOrInjuries: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 12: Family Health History */}
            {activeSection === 12 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 12', 'अनुभाग 12')}</span>
                  <h3 className="text-xl font-black">{tr('Family Health History', 'पारिवारिक स्वास्थ्य इतिहास')}</h3>
                  <p className="text-xs text-zinc-500">{tr('Note which relative(s) had each condition, or leave as "None".', 'लिखें किस रिश्तेदार को कौन सी स्थिति थी, या "कोई नहीं" छोड़ें।')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    ['diabetes', 'Diabetes'], ['hypertension', 'Hypertension'], ['heartDisease', 'Heart Disease'],
                    ['thyroid', 'Thyroid'], ['pcosHormonal', 'PCOS / Hormonal'], ['cholesterol', 'High Cholesterol'],
                    ['obesity', 'Obesity'], ['autoimmune', 'Autoimmune Condition'], ['cancer', 'Cancer'],
                    ['kidneyDisease', 'Kidney Disease'], ['liverDisease', 'Liver Disease'], ['mentalHealth', 'Mental Health Condition'],
                  ] as [keyof RootCauseAssessmentData['familyHistory'], string][]).map(([key, label]) => (
                    <Field key={key} icon={UsersIcon} label={tr(label, OPTION_LABEL_HI[label] || label)}>
                      <TextInput value={formData.familyHistory[key] || ''} onChange={(e) => setFormData({ ...formData, familyHistory: { ...formData.familyHistory, [key]: e.target.value } })} />
                    </Field>
                  ))}
                </div>
                <Field icon={UsersIcon} label={tr('Other Family Conditions', 'अन्य पारिवारिक स्थितियां')}><TextArea rows={2} value={formData.familyHistory.otherConditions || ''} onChange={(e) => setFormData({ ...formData, familyHistory: { ...formData.familyHistory, otherConditions: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 13: Hormonal Health (Women) */}
            {activeSection === 13 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 13', 'अनुभाग 13')}</span>
                  <h3 className="text-xl font-black">{tr('Hormonal Health (Women)', 'हार्मोनल स्वास्थ्य (महिला)')}</h3>
                  <p className="text-xs text-zinc-500">{tr('Skip anything not applicable to you.', 'जो लागू न हो उसे छोड़ दें।')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Sparkles} label={tr('Menstrual Status', 'मासिक धर्म की स्थिति')}><TextInput value={formData.hormonalWomen?.menstrualStatus || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, menstrualStatus: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Cycle Length (Days)', 'चक्र की लंबाई (दिन)')}><TextInput value={formData.hormonalWomen?.cycleLengthDays || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, cycleLengthDays: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Period Duration (Days)', 'मासिक धर्म की अवधि (दिन)')}><TextInput value={formData.hormonalWomen?.periodDurationDays || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, periodDurationDays: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Flow', 'प्रवाह')}><TextInput value={formData.hormonalWomen?.flow || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, flow: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Irregularity Pattern', 'अनियमितता का पैटर्न')}><TextInput value={formData.hormonalWomen?.irregularityPattern || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, irregularityPattern: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Last Menstrual Period Date', 'पिछले मासिक धर्म की तारीख')}><TextInput value={formData.hormonalWomen?.lastMenstrualPeriodDate || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, lastMenstrualPeriodDate: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Age Periods Started', 'मासिक धर्म शुरू होने की उम्र')}><TextInput value={formData.hormonalWomen?.agePeriodsStarted || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, agePeriodsStarted: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Menstrual Cramps', 'मासिक धर्म में ऐंठन')}><TextInput value={formData.hormonalWomen?.menstrualCramps || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, menstrualCramps: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('PCOD / PCOS Diagnosis', 'PCOD / PCOS निदान')}><TextInput value={formData.hormonalWomen?.pcodPcosDiagnosis || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, pcodPcosDiagnosis: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Thyroid Diagnosis & Meds', 'थायरॉइड निदान व दवाएं')}><TextInput value={formData.hormonalWomen?.thyroidDiagnosisAndMeds || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, thyroidDiagnosisAndMeds: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Currently Pregnant?', 'क्या आप गर्भवती हैं?')}><YesNo value={formData.hormonalWomen?.currentlyPregnant} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, currentlyPregnant: v } })} /></Field>
                  <Field icon={Sparkles} label={tr('Planning Pregnancy?', 'गर्भधारण की योजना बना रही हैं?')}><YesNo value={formData.hormonalWomen?.planningPregnancy} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, planningPregnancy: v } })} /></Field>
                  <Field icon={Sparkles} label={tr('Currently Breastfeeding?', 'क्या आप स्तनपान करा रही हैं?')}><YesNo value={formData.hormonalWomen?.currentlyBreastfeeding} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, currentlyBreastfeeding: v } })} /></Field>
                  <Field icon={Sparkles} label={tr('Gestational Diabetes History?', 'गर्भावस्था डायबिटीज का इतिहास?')}><YesNo value={formData.hormonalWomen?.gestationalDiabetesHistory} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, gestationalDiabetesHistory: v } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Breast Lumps?', 'स्तन में गांठ?')}><YesNo value={formData.hormonalWomen?.breastLumps} onChange={(v) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, breastLumps: v } })} /></Field>
                  <Field icon={Sparkles} label={tr('HRT Type (if any)', 'HRT प्रकार (यदि हो)')}><TextInput value={formData.hormonalWomen?.hrtType || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, hrtType: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Facial / Body Hair', 'चेहरे / शरीर के बाल')}><TextInput value={formData.hormonalWomen?.facialBodyHair || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, facialBodyHair: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Scalp Hair Loss Severity', 'सिर के बाल झड़ने की गंभीरता')}><TextInput value={formData.hormonalWomen?.scalpHairLossSeverity || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, scalpHairLossSeverity: e.target.value } })} /></Field>
                </div>
                <Field icon={Sparkles} label={tr('Pregnancies & Children', 'गर्भधारण व बच्चे')}><TextInput value={formData.hormonalWomen?.pregnanciesAndChildren || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, pregnanciesAndChildren: e.target.value } })} /></Field>
                <Field icon={Sparkles} label={tr('Miscarriages / Complications', 'गर्भपात / जटिलताएं')}><TextInput value={formData.hormonalWomen?.miscarriagesOrComplications || ''} onChange={(e) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, miscarriagesOrComplications: e.target.value } })} /></Field>
                <Field icon={Sparkles} label={tr('PMS Symptoms', 'PMS के लक्षण')}>
                  <ChipToggle options={['Mood changes', 'Bloating', 'Cramps', 'Fatigue', 'Food cravings', 'Headaches', 'None']} selected={formData.hormonalWomen?.pmsSymptoms || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, pmsSymptoms: next } })} />
                </Field>
                <Field icon={Sparkles} label={tr('Menopause Symptoms', 'मेनोपॉज़ के लक्षण')}>
                  <ChipToggle options={['Hot flashes', 'Night sweats', 'Mood swings', 'Vaginal dryness', 'Sleep disturbance', 'Not Applicable']} selected={formData.hormonalWomen?.menopauseSymptoms || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, menopauseSymptoms: next } })} />
                </Field>
                <Field icon={Sparkles} label={tr('Diagnosed Hormonal Conditions', 'निदान की गई हार्मोनल स्थितियां')}>
                  <ChipToggle options={['PCOS/PCOD', 'Thyroid Disorder', 'Endometriosis', 'Fibroids', 'None']} selected={formData.hormonalWomen?.diagnosedHormonalConditions || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, diagnosedHormonalConditions: next } })} />
                </Field>
                <Field icon={Sparkles} label={tr('Skin Issues', 'त्वचा संबंधी समस्याएं')}>
                  <ChipToggle options={['Acne', 'Dryness', 'Skin tags', 'Pigmentation', 'Oily skin', 'None']} selected={formData.hormonalWomen?.skinIssues || []} onChange={(next) => setFormData({ ...formData, hormonalWomen: { ...formData.hormonalWomen, skinIssues: next } })} />
                </Field>
              </div>
            )}

            {/* Section 14: Hormonal Health (Men) */}
            {activeSection === 14 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 14', 'अनुभाग 14')}</span>
                  <h3 className="text-xl font-black">{tr('Hormonal Health (Men)', 'हार्मोनल स्वास्थ्य (पुरुष)')}</h3>
                  <p className="text-xs text-zinc-500">{tr('Skip anything not applicable to you.', 'जो लागू न हो उसे छोड़ दें।')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Zap} label={tr('Energy Level', 'ऊर्जा स्तर')}><TextInput value={formData.hormonalMen?.energyLevel || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, energyLevel: e.target.value } })} /></Field>
                  <Field icon={Zap} label={tr('Libido', 'यौन इच्छा')}><TextInput value={formData.hormonalMen?.libido || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, libido: e.target.value } })} /></Field>
                  <Field icon={Zap} label={tr('Erectile Difficulty', 'इरेक्टाइल कठिनाई')}><TextInput value={formData.hormonalMen?.erectileDifficulty || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, erectileDifficulty: e.target.value } })} /></Field>
                  <Field icon={Zap} label={tr('Morning Erections Regular?', 'सुबह इरेक्शन नियमित होता है?')}><YesNo value={formData.hormonalMen?.morningErectionsRegular} onChange={(v) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, morningErectionsRegular: v } })} /></Field>
                  <Field icon={Zap} label={tr('Muscle Mass Trend', 'मांसपेशियों का रुझान')}><TextInput value={formData.hormonalMen?.muscleMassTrend || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, muscleMassTrend: e.target.value } })} /></Field>
                  <Field icon={Sparkles} label={tr('Facial / Body Hair Growth', 'चेहरे / शरीर के बालों की वृद्धि')}><TextInput value={formData.hormonalMen?.facialBodyHairGrowth || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, facialBodyHairGrowth: e.target.value } })} /></Field>
                  <Field icon={Zap} label={tr('Gynecomastia (Breast Tissue)?', 'गायनेकोमास्टिया (स्तन ऊतक)?')}><TextInput value={formData.hormonalMen?.gynecomastia || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, gynecomastia: e.target.value } })} /></Field>
                  <Field icon={Brain} label={tr('Mood Changes', 'मूड में बदलाव')}><TextInput value={formData.hormonalMen?.moodChanges || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, moodChanges: e.target.value } })} /></Field>
                  <Field icon={Zap} label={tr('Diagnosed Low Testosterone?', 'लो टेस्टोस्टेरोन का निदान हुआ है?')}><TextInput value={formData.hormonalMen?.diagnosedLowTestosterone || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, diagnosedLowTestosterone: e.target.value } })} /></Field>
                  <Field icon={Zap} label={tr('Prostate Issues', 'प्रोस्टेट संबंधी समस्याएं')}><TextInput value={formData.hormonalMen?.prostateIssues || ''} onChange={(e) => setFormData({ ...formData, hormonalMen: { ...formData.hormonalMen, prostateIssues: e.target.value } })} /></Field>
                </div>
              </div>
            )}

            {/* Section 15: Organ Health & Complication Symptoms */}
            {activeSection === 15 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 15', 'अनुभाग 15')}</span>
                  <h3 className="text-xl font-black">{tr('Organ Health & Complication Symptoms', 'अंग स्वास्थ्य व जटिलता के लक्षण')}</h3>
                  <p className="text-xs text-zinc-500">{tr('Type a symptom and press Enter to add it under each category — leave empty if none.', 'हर श्रेणी में लक्षण लिखें और Enter दबाएं — कुछ न हो तो खाली छोड़ें।')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {([
                    ['diabetesComplications', 'Diabetes Complications'], ['cardiovascularSymptoms', 'Cardiovascular Symptoms'],
                    ['liverSymptoms', 'Liver Symptoms'], ['kidneySymptoms', 'Kidney Symptoms'],
                    ['thyroidSymptoms', 'Thyroid Symptoms'], ['jointBoneSymptoms', 'Joint & Bone Symptoms'],
                    ['neurologicalSymptoms', 'Neurological Symptoms'], ['skinSymptoms', 'Skin Symptoms'],
                    ['respiratorySymptoms', 'Respiratory Symptoms'],
                  ] as [Exclude<keyof RootCauseAssessmentData['organHealth'], 'unusualSymptomsNotes'>, string][]).map(([key, label]) => (
                    <Field key={key} icon={ORGAN_ICONS[key]} label={tr(label, OPTION_LABEL_HI[label] || label)}>
                      <TagsInput values={formData.organHealth[key]} onChange={(next) => setFormData({ ...formData, organHealth: { ...formData.organHealth, [key]: next } })} />
                    </Field>
                  ))}
                </div>
                <Field icon={CheckSquare} label={tr('Any Other Unusual Symptoms', 'कोई अन्य असामान्य लक्षण')}><TextArea rows={2} value={formData.organHealth.unusualSymptomsNotes || ''} onChange={(e) => setFormData({ ...formData, organHealth: { ...formData.organHealth, unusualSymptomsNotes: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 16: Readiness & Commitment */}
            {activeSection === 16 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 16', 'अनुभाग 16')}</span>
                  <h3 className="text-xl font-black">{tr('Readiness & Commitment', 'तैयारी व संकल्प')}</h3>
                </div>
                <Field icon={Target} label={tr('Main Barriers to Getting Healthier', 'स्वस्थ होने में मुख्य बाधाएं')}><TextArea rows={2} value={formData.readiness.mainBarriers || ''} onChange={(e) => setFormData({ ...formData, readiness: { ...formData.readiness, mainBarriers: e.target.value } })} /></Field>
                <Field icon={CheckSquare} label={tr('What Would Help You Most?', 'आपकी सबसे ज़्यादा मदद क्या करेगी?')}>
                  <ChipToggle
                    options={['Simple meal plans that fit my schedule', 'Family-friendly recipes everyone can eat', 'Daily accountability and motivation', 'Clear step-by-step guidance', 'Help managing stress and emotions']}
                    selected={formData.readiness.helpfulFactors}
                    onChange={(next) => setFormData({ ...formData, readiness: { ...formData.readiness, helpfulFactors: next } })}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={CheckSquare} label={tr('Willingness to Prioritise Health', 'स्वास्थ्य को प्राथमिकता देने की इच्छा')}><TextInput value={formData.readiness.healthPriorityWillingness} onChange={(e) => setFormData({ ...formData, readiness: { ...formData.readiness, healthPriorityWillingness: e.target.value } })} /></Field>
                  <Field icon={Target} label={tr('Hours Per Week You Can Commit', 'हफ्ते में कितने घंटे दे सकते हैं')}><TextInput value={formData.readiness.hoursPerWeekCommitment} onChange={(e) => setFormData({ ...formData, readiness: { ...formData.readiness, hoursPerWeekCommitment: e.target.value } })} /></Field>
                  <Field icon={Target} label={tr('Motivated for Root-Cause Reversal?', 'रूट-कॉज़ रिवर्सल के लिए प्रेरित हैं?')}><YesNo value={formData.readiness.motivatedForRootCause} onChange={(v) => setFormData({ ...formData, readiness: { ...formData.readiness, motivatedForRootCause: v } })} /></Field>
                  <Field icon={Target} label={tr('Can Commit for 90 Days?', '90 दिनों के लिए संकल्पित हैं?')}><YesNo value={formData.readiness.canCommit90Days} onChange={(v) => setFormData({ ...formData, readiness: { ...formData.readiness, canCommit90Days: v } })} /></Field>
                  <Field icon={Target} label={tr('Family Support Available?', 'पारिवारिक सहयोग उपलब्ध है?')}><YesNo value={formData.readiness.familySupport} onChange={(v) => setFormData({ ...formData, readiness: { ...formData.readiness, familySupport: v } })} /></Field>
                </div>
              </div>
            )}

            {/* Section 17: Start Timeline */}
            {activeSection === 17 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 17', 'अनुभाग 17')}</span>
                  <h3 className="text-xl font-black">{tr('When Would You Like to Start?', 'आप कब शुरू करना चाहेंगे?')}</h3>
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
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                          : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">{tr(tier.title, OPTION_LABEL_HI[tier.title] || tier.title)}</span>
                        {formData.startTimeline === tier.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </div>
                      <p className="text-xs opacity-75 mt-1">{tr(tier.desc, OPTION_LABEL_HI[tier.desc] || tier.desc)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 18: Reversal Intensity */}
            {activeSection === 18 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 18', 'अनुभाग 18')}</span>
                  <h3 className="text-xl font-black">{tr('Reversal Treatment Intensity Selection', 'रिवर्सल उपचार तीव्रता चयन')}</h3>
                  <p className="text-xs text-zinc-500">{tr('Choose the intensity protocol matching your condition severity and daily readiness.', 'अपनी स्थिति की गंभीरता व दैनिक तैयारी के अनुसार तीव्रता चुनें।')}</p>
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
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                          : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm">{tr(tier.title, OPTION_LABEL_HI[tier.title] || tier.title)}</span>
                        {formData.reversalIntensity === tier.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </div>
                      <p className="text-xs opacity-75 mt-1">{tr(tier.desc, OPTION_LABEL_HI[tier.desc] || tier.desc)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 19: Daily Routine and Timings */}
            {activeSection === 19 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 19', 'अनुभाग 19')}</span>
                  <h3 className="text-xl font-black">{tr('Daily Routine and Timings', 'दैनिक दिनचर्या व समय')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Moon} label={tr('Wake Up Time', 'उठने का समय')}><TextInput value={formData.dailyRoutine.wakeUpTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, wakeUpTime: e.target.value } })} /></Field>
                  <Field icon={Clock} label={tr('Morning Routine', 'सुबह की दिनचर्या')}><TextInput value={formData.dailyRoutine.morningRoutine || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, morningRoutine: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Breakfast Time', 'नाश्ते का समय')}><TextInput value={formData.dailyRoutine.breakfastTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, breakfastTime: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Mid-Morning Snack Time', 'सुबह के नाश्ते के बाद का स्नैक समय')}><TextInput value={formData.dailyRoutine.midMorningSnackTime || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, midMorningSnackTime: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Lunch Time', 'दोपहर के भोजन का समय')}><TextInput value={formData.dailyRoutine.lunchTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, lunchTime: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Evening Snack / Tea Time', 'शाम के नाश्ते / चाय का समय')}><TextInput value={formData.dailyRoutine.eveningSnackTeaTime || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, eveningSnackTeaTime: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Dinner Time', 'रात के भोजन का समय')}><TextInput value={formData.dailyRoutine.dinnerTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, dinnerTime: e.target.value } })} /></Field>
                  <Field icon={Moon} label={tr('Sleep Time', 'सोने का समय')}><TextInput value={formData.dailyRoutine.sleepTime} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, sleepTime: e.target.value } })} /></Field>
                  <Field icon={Clock} label={tr('Work Hours', 'काम के घंटे')}><TextInput value={formData.dailyRoutine.workHours || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, workHours: e.target.value } })} /></Field>
                  <Field icon={Dumbbell} label={tr('Daily Sitting Hours at Work', 'काम पर बैठने के दैनिक घंटे')}><TextInput value={formData.dailyRoutine.dailySittingHoursAtWork || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, dailySittingHoursAtWork: e.target.value } })} /></Field>
                  <Field icon={Clock} label={tr('Commute Time & Mode', 'आने-जाने का समय व साधन')}><TextInput value={formData.dailyRoutine.commuteTimeAndMode || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, commuteTimeAndMode: e.target.value } })} /></Field>
                  <Field icon={Dumbbell} label={tr('Available Time for Exercise', 'व्यायाम के लिए उपलब्ध समय')}><TextInput value={formData.dailyRoutine.availableTimeForExercise || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, availableTimeForExercise: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Who Manages Meal Prep', 'भोजन कौन बनाता है')}><TextInput value={formData.dailyRoutine.mealPrepManager || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, mealPrepManager: e.target.value } })} /></Field>
                </div>
                <Field icon={Clock} label={tr('Weekend Schedule Difference', 'सप्ताहांत का अलग शेड्यूल')}><TextArea rows={2} value={formData.dailyRoutine.weekendScheduleDifference || ''} onChange={(e) => setFormData({ ...formData, dailyRoutine: { ...formData.dailyRoutine, weekendScheduleDifference: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 20: Exercise Preferences & Realistic Activity Plan */}
            {activeSection === 20 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 20', 'अनुभाग 20')}</span>
                  <h3 className="text-xl font-black">{tr('Exercise Preferences & Realistic Activity Plan', 'व्यायाम पसंद व यथार्थवादी गतिविधि योजना')}</h3>
                </div>
                <Field icon={Dumbbell} label={tr('Preferred Exercise Types', 'पसंदीदा व्यायाम प्रकार')}>
                  <ChipToggle
                    options={['Walking or brisk walking (outdoor or treadmill)', 'Yoga asanas and pranayama', 'Functional training or HIIT', 'Strength / Weight training', 'Swimming', 'Cycling', 'Dance / Zumba', 'Sports']}
                    selected={formData.exercisePlan.preferredExerciseTypes}
                    onChange={(next) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, preferredExerciseTypes: next } })}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Dumbbell} label={tr('Gym / Equipment Access', 'जिम / उपकरण उपलब्धता')}><TextInput value={formData.exercisePlan.gymOrEquipmentAccess || ''} onChange={(e) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, gymOrEquipmentAccess: e.target.value } })} /></Field>
                  <Field icon={CheckSquare} label={tr('Best Time Slot', 'सबसे अच्छा समय')}>
                    <SelectInput value={formData.exercisePlan.bestTimeSlot || 'flexible'} onChange={(e) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, bestTimeSlot: e.target.value as any } })}>
                      <option value="morning">{tr('Morning', 'सुबह')}</option>
                      <option value="evening">{tr('Evening', 'शाम')}</option>
                      <option value="flexible">{tr('Flexible', 'लचीला समय')}</option>
                    </SelectInput>
                  </Field>
                </div>
                <Field icon={CheckSquare} label={tr('Limitations / Explanation', 'सीमाएं / स्पष्टीकरण')}><TextArea rows={2} value={formData.exercisePlan.limitationsExplanation || ''} onChange={(e) => setFormData({ ...formData, exercisePlan: { ...formData.exercisePlan, limitationsExplanation: e.target.value } })} /></Field>
              </div>
            )}

            {/* Section 21: Personal Query / Personalisation Request */}
            {activeSection === 21 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 21', 'अनुभाग 21')}</span>
                  <h3 className="text-xl font-black">{tr('Personal Query for the Doctor', 'डॉक्टर के लिए व्यक्तिगत प्रश्न')}</h3>
                </div>
                <Field icon={MessageCircle} label={tr('Personal Query & Reversal Customization Request', 'व्यक्तिगत प्रश्न व रिवर्सल अनुकूलन अनुरोध')}>
                  <TextArea
                    rows={5}
                    value={formData.personalQueryRequest || ''}
                    onChange={(e) => setFormData({ ...formData, personalQueryRequest: e.target.value })}
                    placeholder={tr('Write any specific query, dietary constraint, or medication question you want the physician to review...', 'कोई विशेष प्रश्न, आहार संबंधी बाध्यता या दवा संबंधी सवाल लिखें जो डॉक्टर को देखना चाहिए...')}
                  />
                </Field>
              </div>
            )}

            {/* Section 22: Additional Information */}
            {activeSection === 22 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tr('Section 22', 'अनुभाग 22')}</span>
                  <h3 className="text-xl font-black">{tr('Additional Information', 'अतिरिक्त जानकारी')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field icon={Stethoscope} label={tr('Past Surgeries or Illnesses', 'पिछली सर्जरी या बीमारियां')}><TextArea rows={2} value={formData.additionalInfo.pastSurgeriesOrIllnesses || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, pastSurgeriesOrIllnesses: e.target.value } })} /></Field>
                  <Field icon={Stethoscope} label={tr('Ongoing Specialist Treatments', 'चल रहे विशेषज्ञ उपचार')}><TextArea rows={2} value={formData.additionalInfo.ongoingSpecialistTreatments || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, ongoingSpecialistTreatments: e.target.value } })} /></Field>
                  <Field icon={Stethoscope} label={tr('Genetic or Rare Conditions', 'आनुवंशिक या दुर्लभ स्थितियां')}><TextArea rows={2} value={formData.additionalInfo.geneticOrRareConditions || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, geneticOrRareConditions: e.target.value } })} /></Field>
                  <Field icon={User} label={tr('Occupation Challenges', 'कार्य संबंधी चुनौतियां')}><TextArea rows={2} value={formData.additionalInfo.occupationChallenges || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, occupationChallenges: e.target.value } })} /></Field>
                  <Field icon={User} label={tr('Living Situation', 'रहने की स्थिति')}><TextInput value={formData.additionalInfo.livingSituation || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, livingSituation: e.target.value } })} /></Field>
                  <Field icon={Utensils} label={tr('Who Manages Your Meals', 'भोजन कौन प्रबंधित करता है')}><TextInput value={formData.additionalInfo.whoManagesMeals || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, whoManagesMeals: e.target.value } })} /></Field>
                </div>
                <Field icon={Stethoscope} label={tr('Specific Treatment Requirements', 'विशेष उपचार आवश्यकताएं')}><TextArea rows={2} value={formData.additionalInfo.treatmentRequirements || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, treatmentRequirements: e.target.value } })} /></Field>
                <Field icon={MessageCircle} label={tr('Questions for the Doctor', 'डॉक्टर के लिए प्रश्न')}><TextArea rows={2} value={formData.additionalInfo.questionsForDoctor || ''} onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, questionsForDoctor: e.target.value } })} /></Field>
                <Field icon={FileText} label={tr('Additional Information & Final Notes', 'अतिरिक्त जानकारी व अंतिम टिप्पणी')}>
                  <TextArea
                    rows={4}
                    value={formData.additionalInfo.patientExtraNotes || ''}
                    onChange={(e) => setFormData({ ...formData, additionalInfo: { ...formData.additionalInfo, patientExtraNotes: e.target.value } })}
                    placeholder={tr('Share any other surgery history, childhood health, living situation or preferences...', 'कोई अन्य सर्जरी इतिहास, बचपन का स्वास्थ्य, रहने की स्थिति या पसंद बताएं...')}
                  />
                </Field>
              </div>
            )}

          </div>
        </div>

        {/* Bottom Navigation Controls — the module counter + progress dots
            sit in their own centered row above Prev/Next on a narrow phone
            (three items never fit comfortably in one row there), and
            inline between them from sm: up. */}
        <div className="p-3 sm:p-5 border-t border-zinc-200 bg-zinc-50/70 space-y-2 sm:space-y-0">
          <div className="flex sm:hidden flex-col items-center gap-1.5">
            <div className="text-[11px] font-bold text-zinc-500">
              {activeSection} / 22 {tr('Modules Completed', 'मॉड्यूल पूर्ण')}
            </div>
            <div className="flex flex-wrap justify-center gap-1 max-w-[85%]">
              {SECTIONS.map((sec) => (
                <span key={sec.num} className={`w-1.5 h-1.5 rounded-full shrink-0 ${sec.num <= activeSection ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevSection}
              disabled={activeSection === 1}
              className={`px-3 sm:px-4 py-2.5 rounded-xl border border-zinc-300 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                activeSection === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-zinc-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>{tr('Previous Module', 'पिछला मॉड्यूल')}</span>
            </button>

            <div className="hidden sm:flex flex-col items-center gap-1">
              <div className="text-xs font-bold text-zinc-500 whitespace-nowrap">
                {activeSection} / 22 {tr('Modules Completed', 'मॉड्यूल पूर्ण')}
              </div>
              <div className="flex gap-1">
                {SECTIONS.map((sec) => (
                  <span key={sec.num} className={`w-1.5 h-1.5 rounded-full ${sec.num <= activeSection ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextSection}
              className="px-4 sm:px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <span>{activeSection === 22 ? tr('Submit & Finalize Plan', 'सबमिट करें व योजना अंतिम करें') : tr('Next Module', 'अगला मॉड्यूल')}</span>
              <ChevronRight className="w-4 h-4 stroke-[3] shrink-0" />
            </button>
          </div>
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

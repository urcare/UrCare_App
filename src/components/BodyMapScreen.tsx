import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, Sparkles, Brain, Heart, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { Logo } from './Logo';
import { useLanguage, AppLanguage } from '../context/LanguageContext';

interface BodyMapScreenProps {
  profile: UserHealthProfile;
  onNext: () => void;
}

type Status = 'good' | 'attention' | 'high';
/** "Organs" (default) shows the 6 internal-organ cards; "Systems" shows the
 *  broader body-surface regions — same underlying data either way, just a
 *  different grouping. The real 3D body model will replace this card grid
 *  later; for now this keeps the same interaction (tap a card for details)
 *  without shipping the placeholder body mesh. */
type ViewMode = 'organs' | 'systems';

interface RegionStatus {
  status: Status;
  concern: string;
  factors: string[];
  nextSteps: string[];
  wellnessScore: number;
}

const REGION_LABELS: Record<string, string> = {
  head: 'Head',
  eyes: 'Eyes',
  neck: 'Neck',
  shoulders: 'Shoulders',
  chest: 'Chest',
  arms: 'Arms',
  stomach: 'Stomach & Abdomen',
  hips: 'Hips',
  lowerBack: 'Lower Back',
  knees: 'Knees',
  legs: 'Legs',
  ankles: 'Ankles',
  feet: 'Feet',
};

const REGION_LABELS_HI: Record<string, string> = {
  head: 'सिर',
  eyes: 'आंखें',
  neck: 'गर्दन',
  shoulders: 'कंधे',
  chest: 'छाती',
  arms: 'बांहें',
  stomach: 'पेट व उदर',
  hips: 'कूल्हे',
  lowerBack: 'पीठ का निचला हिस्सा',
  knees: 'घुटने',
  legs: 'पैर',
  ankles: 'टखने',
  feet: 'पैर के तलवे',
};

const REGION_IDS = Object.keys(REGION_LABELS);

function regionLabel(id: string, language: AppLanguage): string {
  return language === 'hi' ? (REGION_LABELS_HI[id] || REGION_LABELS[id]) : REGION_LABELS[id];
}

type OrganId = 'brain' | 'lungs' | 'heart' | 'stomach' | 'liver' | 'intestines';
const ORGAN_IDS: OrganId[] = ['brain', 'lungs', 'heart', 'stomach', 'liver', 'intestines'];

const ORGAN_LABELS: Record<OrganId, string> = {
  brain: 'Brain',
  lungs: 'Lungs',
  heart: 'Heart',
  stomach: 'Stomach',
  liver: 'Liver',
  intestines: 'Intestines',
};
const ORGAN_LABELS_HI: Record<OrganId, string> = {
  brain: 'दिमाग',
  lungs: 'फेफड़े',
  heart: 'हृदय',
  stomach: 'पेट',
  liver: 'लिवर',
  intestines: 'आंतें',
};
function organLabel(id: OrganId, language: AppLanguage): string {
  return language === 'hi' ? ORGAN_LABELS_HI[id] : ORGAN_LABELS[id];
}

// Simple, clean single-stroke glyphs in lucide's own visual language (24x24,
// currentColor, rounded strokes) for the organs lucide doesn't ship an icon
// for — Brain and Heart below reuse the real lucide icons instead.
const LungsGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3v7" />
    <path d="M12 10c-1 -2 -2.5 -2.6 -2.5 -4.6" />
    <path d="M9.2 9.2c-2.6 0 -4.7 2.4 -4.7 5.6v2.7c0 1.7 1.2 2.5 2.3 2.5c1.4 0 2.2 -1 2.2 -2.6v-4.6c0 -1.4 .6 -2.3 1.3 -3.1" />
    <path d="M14.8 9.2c2.6 0 4.7 2.4 4.7 5.6v2.7c0 1.7 -1.2 2.5 -2.3 2.5c-1.4 0 -2.2 -1 -2.2 -2.6v-4.6c0 -1.4 -.6 -2.3 -1.3 -3.1" />
  </svg>
);
const LiverGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 11c0 -3.5 3 -6 7.5 -6c4.8 0 8.5 2.3 8.5 6.5c0 4.3 -3.4 7.5 -8.5 7.5c-4.3 0 -7.5 -3 -7.5 -8Z" />
  </svg>
);
const StomachGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 3.5c-1.8 0 -3 1.4 -3 3.2c0 2.6 1.8 3.6 1.8 6.3c0 3.8 2.7 6.5 6 6.5c2.8 0 5.2 -1.9 5.2 -5c0 -2.6 -1.7 -3.4 -3.4 -3.4c-0.9 0 -1.7 .8 -2.7 .8c-2.5 0 -1.9 -3.7 -1.9 -5.4c0 -1.7 -0.8 -3 -2 -3Z" />
  </svg>
);
const IntestinesGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 6.5c0 -1.8 1.6 -3 3.5 -3s3.5 1.2 3.5 3s-1.6 3 -3.5 3h8c1.9 0 3.5 1.2 3.5 3s-1.6 3 -3.5 3h-8c-1.9 0 -3.5 1.2 -3.5 3s1.6 3 3.5 3" />
  </svg>
);

const ORGAN_ICONS: Record<OrganId, React.FC<{ className?: string }>> = {
  brain: Brain,
  lungs: LungsGlyph,
  heart: Heart,
  stomach: StomachGlyph,
  liver: LiverGlyph,
  intestines: IntestinesGlyph,
};

// Systems (body-region) cards don't have a per-region glyph, so they use a
// status icon instead — it doubles as an at-a-glance "is this fine or not"
// signal, which a plain colored dot wouldn't give you.
const STATUS_ICON: Record<Status, React.FC<{ className?: string }>> = {
  good: CheckCircle2,
  attention: AlertCircle,
  high: AlertTriangle,
};

const STATUS_COLOR: Record<Status, string> = { good: '#008000', attention: '#f97316', high: '#ef4444' };
const STATUS_LABEL: Record<Status, string> = { good: 'Healthy', attention: 'Needs Attention', high: 'High Attention' };
const STATUS_LABEL_HI: Record<Status, string> = { good: 'स्वस्थ', attention: 'ध्यान देने की ज़रूरत', high: 'अधिक ध्यान देने की ज़रूरत' };
const RANK: Record<Status, number> = { good: 0, attention: 1, high: 2 };

// Hindi display text for the raw onboarding symptom/condition strings that
// get shown verbatim as "contributing factors" below — the English value is
// what's actually stored in profile data and matched against (via
// conditions.has(...) / s.includes(...)), so only the displayed factor text
// is translated, never the underlying match.
const FACTOR_LABEL_HI: Record<string, string> = {
  'Diabetes / Pre-Diabetes': 'डायबिटीज / प्री-डायबिटीज',
  'Neuropathy (Nerve Pain/Tingling)': 'न्यूरोपैथी (नस दर्द/झनझनाहट)',
  'High Blood Pressure': 'उच्च रक्तचाप',
  'Heart Disease': 'हृदय रोग',
  'Erectile Dysfunction': 'इरेक्टाइल डिसफंक्शन',
  'High Cholesterol / Fatty Liver': 'उच्च कोलेस्ट्रॉल / फैटी लिवर',
  'Digestive / IBS': 'पाचन संबंधी समस्या / IBS',
  'PCOS / PCOD': 'PCOS / PCOD',
  'Kidney Disease': 'किडनी रोग',
  'Joint Pain / Arthritis': 'जोड़ों का दर्द / गठिया',
  'Uric Acid / Gout': 'यूरिक एसिड / गठिया रोग',
  'Thyroid (Hypo/Hyper)': 'थायरॉइड (हाइपो/हाइपर)',
  'Chronic Fatigue': 'लगातार थकान',
  'Sleep Apnea / Sleep Issues': 'स्लीप एपनिया / नींद की समस्या',
  'Diabetic Retinopathy': 'डायबिटिक रेटिनोपैथी',
  'Obesity': 'मोटापा',
};

/** Reads the user's real onboarding answers and produces a wellness
 *  indicator for every tracked body region — defaulting to "good" and only
 *  escalating where an actual condition or symptom points to it. Nothing
 *  here is a diagnosis, and unmatched regions are never invented as a
 *  concern just to fill space. */
function computeRegionStatuses(profile: UserHealthProfile, language: AppLanguage): Record<string, RegionStatus> {
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const factorLabel = (f: string) => tr(f, FACTOR_LABEL_HI[f] || f);
  const conditions = new Set(profile.medicalConditions || []);
  const dd: any = profile.healthDeepDive || {};
  const organSymptoms: string[] = dd.organSymptoms || [];
  const digestiveSymptoms: string[] = dd.digestiveSymptoms || [];

  const ids = ['head', 'eyes', 'neck', 'shoulders', 'chest', 'arms', 'stomach', 'hips', 'knees', 'legs', 'feet', 'lowerBack', 'ankles', 'lungs', 'heart', 'liver', 'intestines'];
  const out: Record<string, RegionStatus> = {};
  ids.forEach((id) => {
    out[id] = {
      status: 'good',
      concern: tr('No specific concerns flagged from your onboarding answers', 'आपके onboarding जवाबों के अनुसार कोई विशेष चिंता नहीं मिली'),
      factors: [],
      nextSteps: [tr('Keep up your current habits', 'अपनी मौजूदा आदतें जारी रखें')],
      wellnessScore: 88,
    };
  });

  const flag = (id: string, status: Status, concern: string, factor: string, steps: string[], score: number) => {
    const cur = out[id];
    const translatedFactor = factorLabel(factor);
    if (RANK[status] >= RANK[cur.status]) {
      out[id] = { status, concern, factors: [...new Set([...(cur.status === 'good' ? [] : cur.factors), translatedFactor])], nextSteps: steps, wellnessScore: score };
    } else {
      out[id] = { ...cur, factors: [...new Set([...cur.factors, translatedFactor])] };
    }
  };

  if (conditions.has('Diabetes / Pre-Diabetes')) {
    flag('feet', 'attention', tr('Reduced circulation & sensation risk', 'रक्त संचार व संवेदना में कमी का जोखिम'), 'Diabetes / Pre-Diabetes', [tr('Check your feet daily', 'रोज़ अपने पैर जांचें'), tr('Wear comfortable, well-fitted footwear', 'आरामदायक व सही नाप के जूते पहनें'), tr('Keep blood sugar in your target range', 'ब्लड शुगर को लक्ष्य सीमा में रखें')], 58);
  }
  if (conditions.has('Neuropathy (Nerve Pain/Tingling)')) {
    flag('feet', 'high', tr('Nerve sensitivity (tingling or numbness)', 'नस संवेदनशीलता (झनझनाहट या सुन्नपन)'), 'Neuropathy (Nerve Pain/Tingling)', [tr('Check your feet daily for cuts or sores', 'रोज़ पैरों में कट या घाव जांचें'), tr('Include B-vitamin rich foods', 'विटामिन-B युक्त भोजन शामिल करें'), tr('Gentle daily circulation exercises', 'रोज़ हल्के रक्त संचार व्यायाम करें')], 45);
    flag('arms', 'attention', tr('Nerve sensitivity in hands', 'हाथों में नस संवेदनशीलता'), 'Neuropathy (Nerve Pain/Tingling)', [tr('Hand & wrist stretches', 'हाथ व कलाई की स्ट्रेचिंग'), tr('Include B-vitamin rich foods', 'विटामिन-B युक्त भोजन शामिल करें')], 55);
  }
  if (conditions.has('High Blood Pressure')) {
    flag('chest', 'high', tr('Cardiovascular load', 'हृदय पर दबाव'), 'High Blood Pressure', [tr('Reduce sodium intake', 'नमक का सेवन कम करें'), tr('Daily light movement', 'रोज़ हल्की गतिविधि करें'), tr('Track your blood pressure regularly', 'नियमित रूप से बीपी जांचें')], 48);
    flag('heart', 'high', tr('Cardiovascular load', 'हृदय पर दबाव'), 'High Blood Pressure', [tr('Reduce sodium intake', 'नमक का सेवन कम करें'), tr('Daily light movement', 'रोज़ हल्की गतिविधि करें'), tr('Track your blood pressure regularly', 'नियमित रूप से बीपी जांचें')], 48);
  }
  if (conditions.has('Heart Disease')) {
    flag('chest', 'high', tr('Cardiovascular strain', 'हृदय पर तनाव'), 'Heart Disease', [tr('Follow your cardiologist\'s guidance', 'अपने हृदय रोग विशेषज्ञ की सलाह मानें'), tr('Low-sodium, heart-friendly meals', 'कम नमक वाला हृदय-अनुकूल भोजन'), tr('Gentle, doctor-approved activity', 'डॉक्टर द्वारा स्वीकृत हल्की गतिविधि')], 42);
    flag('heart', 'high', tr('Cardiovascular strain', 'हृदय पर तनाव'), 'Heart Disease', [tr('Follow your cardiologist\'s guidance', 'अपने हृदय रोग विशेषज्ञ की सलाह मानें'), tr('Low-sodium, heart-friendly meals', 'कम नमक वाला हृदय-अनुकूल भोजन'), tr('Gentle, doctor-approved activity', 'डॉक्टर द्वारा स्वीकृत हल्की गतिविधि')], 42);
  }
  if (conditions.has('Erectile Dysfunction')) {
    flag('chest', 'attention', tr('Vascular health signal', 'रक्त वाहिका स्वास्थ्य संकेत'), 'Erectile Dysfunction', [tr('Heart-healthy diet', 'हृदय-अनुकूल आहार'), tr('Regular movement to support circulation', 'रक्त संचार हेतु नियमित गतिविधि')], 60);
    flag('heart', 'attention', tr('Vascular health signal', 'रक्त वाहिका स्वास्थ्य संकेत'), 'Erectile Dysfunction', [tr('Heart-healthy diet', 'हृदय-अनुकूल आहार'), tr('Regular movement to support circulation', 'रक्त संचार हेतु नियमित गतिविधि')], 60);
  }
  if (conditions.has('High Cholesterol / Fatty Liver')) flag('liver', 'attention', tr('Liver & lipid load', 'लिवर व लिपिड भार'), 'High Cholesterol / Fatty Liver', [tr('Reduce fried & processed foods', 'तला व प्रोसेस्ड भोजन कम करें'), tr('Add more fiber-rich vegetables', 'फाइबर युक्त सब्ज़ियां बढ़ाएं')], 60);
  if (conditions.has('Digestive / IBS')) flag('intestines', 'attention', tr('Digestive sensitivity', 'पाचन संवेदनशीलता'), 'Digestive / IBS', [tr('Smaller, more regular meals', 'छोटे व नियमित भोजन'), tr('Identify and avoid trigger foods', 'ट्रिगर खाद्य पदार्थों की पहचान कर बचें')], 62);
  if (conditions.has('PCOS / PCOD')) flag('stomach', 'attention', tr('Hormonal-metabolic link', 'हार्मोनल-मेटाबॉलिक संबंध'), 'PCOS / PCOD', [tr('Low-GI, anti-inflammatory meals', 'कम GI वाला सूजन-रोधी भोजन'), tr('Consistent daily movement', 'रोज़ नियमित गतिविधि')], 62);
  if (conditions.has('Kidney Disease')) flag('lowerBack', 'high', tr('Kidney function support needed', 'किडनी कार्यक्षमता को सहयोग चाहिए'), 'Kidney Disease', [tr('Controlled protein & sodium intake', 'नियंत्रित प्रोटीन व नमक सेवन'), tr('Stay well hydrated', 'पर्याप्त पानी पिएं'), tr('Keep up with regular check-ups', 'नियमित जांच कराते रहें')], 42);
  if (conditions.has('Joint Pain / Arthritis')) flag('knees', 'attention', tr('Joint discomfort', 'जोड़ों में असुविधा'), 'Joint Pain / Arthritis', [tr('Low-impact movement', 'कम प्रभाव वाली गतिविधि'), tr('Anti-inflammatory foods', 'सूजन-रोधी भोजन'), tr('Maintain a healthy weight', 'स्वस्थ वज़न बनाए रखें')], 55);
  if (conditions.has('Uric Acid / Gout')) flag('knees', 'attention', tr('Joint discomfort (uric acid related)', 'जोड़ों में असुविधा (यूरिक एसिड संबंधी)'), 'Uric Acid / Gout', [tr('Low-purine diet', 'कम प्यूरीन वाला आहार'), tr('Stay well hydrated', 'पर्याप्त पानी पिएं')], 55);
  if (conditions.has('Thyroid (Hypo/Hyper)')) flag('neck', 'attention', tr('Thyroid balance', 'थायरॉइड संतुलन'), 'Thyroid (Hypo/Hyper)', [tr('Consistent sleep schedule', 'नियमित नींद का समय'), tr('Iodine-mindful diet', 'आयोडीन के प्रति सजग आहार')], 60);
  if (conditions.has('Chronic Fatigue')) flag('head', 'attention', tr('Low energy levels', 'कम ऊर्जा स्तर'), 'Chronic Fatigue', [tr('Consistent sleep & wake time', 'नियमित सोने व उठने का समय'), tr('Steady, balanced meals through the day', 'दिनभर संतुलित भोजन')], 58);
  if (conditions.has('Sleep Apnea / Sleep Issues')) flag('head', 'attention', tr('Disrupted rest', 'बाधित नींद'), 'Sleep Apnea / Sleep Issues', [tr('Consistent sleep schedule', 'नियमित नींद का समय'), tr('Reduce late-day caffeine', 'देर दिन कैफीन कम करें')], 58);
  if (conditions.has('Diabetic Retinopathy')) flag('eyes', 'high', tr('Eye health monitoring needed', 'आंखों के स्वास्थ्य की निगरानी ज़रूरी'), 'Diabetic Retinopathy', [tr('Regular eye check-ups', 'नियमित आंखों की जांच'), tr('Keep blood sugar in range', 'ब्लड शुगर सीमा में रखें')], 50);
  if (conditions.has('Obesity')) flag('hips', 'attention', tr('Weight-related joint load', 'वज़न संबंधी जोड़ों का भार'), 'Obesity', [tr('Gradual, sustainable calorie deficit', 'धीमी, स्थायी कैलोरी कमी'), tr('Low-impact daily movement', 'कम प्रभाव वाली दैनिक गतिविधि')], 58);

  organSymptoms.forEach((s) => {
    if (s.includes('Tingling')) { flag('feet', 'attention', tr('Nerve sensitivity', 'नस संवेदनशीलता'), s, [tr('Check your feet daily', 'रोज़ अपने पैर जांचें')], 55); flag('arms', 'attention', tr('Nerve sensitivity', 'नस संवेदनशीलता'), s, [tr('Hand & wrist stretches', 'हाथ व कलाई की स्ट्रेचिंग')], 58); }
    if (s.includes('Blurry vision')) flag('eyes', 'attention', tr('Vision changes reported', 'दृष्टि में बदलाव दर्ज'), s, [tr('Regular eye check-ups', 'नियमित आंखों की जांच')], 55);
    if (s.includes('Swelling')) flag('feet', 'attention', tr('Fluid retention', 'शरीर में सूजन/तरल जमाव'), s, [tr('Elevate legs when resting', 'आराम के समय पैर ऊंचे रखें'), tr('Reduce sodium intake', 'नमक का सेवन कम करें')], 55);
    if (s.includes('Chest pain')) { flag('chest', 'high', tr('Reported chest discomfort', 'सीने में असुविधा दर्ज'), s, [tr('Discuss with your doctor soon', 'जल्द डॉक्टर से चर्चा करें'), tr('Avoid strenuous exertion until reviewed', 'जांच होने तक कठिन परिश्रम से बचें')], 40); flag('heart', 'high', tr('Reported chest discomfort', 'सीने में असुविधा दर्ज'), s, [tr('Discuss with your doctor soon', 'जल्द डॉक्टर से चर्चा करें'), tr('Avoid strenuous exertion until reviewed', 'जांच होने तक कठिन परिश्रम से बचें')], 40); }
    if (s.includes('Joint pain')) flag('knees', 'attention', tr('Joint discomfort', 'जोड़ों में असुविधा'), s, [tr('Low-impact movement', 'कम प्रभाव वाली गतिविधि')], 55);
    if (s.includes('Headaches')) flag('head', 'attention', tr('Frequent headaches / brain fog', 'बार-बार सिरदर्द / दिमागी थकान'), s, [tr('Consistent sleep schedule', 'नियमित नींद का समय'), tr('Stay well hydrated', 'पर्याप्त पानी पिएं')], 58);
  });
  digestiveSymptoms.forEach((s) => { if (s && s !== 'None') flag('intestines', 'attention', tr('Digestive discomfort', 'पाचन संबंधी असुविधा'), s, [tr('Smaller, more regular meals', 'छोटे व नियमित भोजन')], 62); });

  return out;
}

interface SelectedRegion extends RegionStatus {
  id: string;
  label: string;
}

/** One tappable card in the organs/systems grid — icon in a status-tinted
 *  circle, label, and a small status pill. Shared by both view modes so
 *  they read as one consistent system. */
function RegionCard({
  label,
  status,
  Icon,
  onClick,
  language,
}: {
  label: string;
  status: Status;
  Icon: React.FC<{ className?: string }>;
  onClick: () => void;
  language: AppLanguage;
}) {
  const color = STATUS_COLOR[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-3.5 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-97 ${
        status === 'high' ? 'border-red-200' : status === 'attention' ? 'border-orange-200' : 'border-zinc-200'
      }`}
    >
      {status === 'high' && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
      )}
      <span
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: `${color}1a`, color }}
      >
        <Icon className="w-6 h-6" />
      </span>
      <span className="text-xs font-black text-zinc-800 leading-tight text-center">{label}</span>
      <span
        className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
        style={{ background: `${color}1a`, color }}
      >
        {language === 'hi' ? STATUS_LABEL_HI[status] : STATUS_LABEL[status]}
      </span>
    </button>
  );
}

export const BodyMapScreen: React.FC<BodyMapScreenProps> = ({ profile, onNext }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const [selected, setSelected] = useState<SelectedRegion | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('organs');

  const statuses = useMemo(() => computeRegionStatuses(profile, language), [profile, language]);
  const overallScore = useMemo(() => {
    const scores = (Object.values(statuses) as RegionStatus[]).map((s) => s.wellnessScore);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [statuses]);

  const handleSelectOrgan = useCallback((id: OrganId) => {
    setSelected({ id, label: organLabel(id, language), ...statuses[id] });
  }, [statuses, language]);

  const handleSelectSystem = useCallback((id: string) => {
    setSelected({ id, label: regionLabel(id, language), ...statuses[id] });
  }, [statuses, language]);

  const closeSheet = useCallback(() => setSelected(null), []);

  return (
    <div id="body-map-screen" className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="w-full max-w-xl mx-auto flex items-center justify-center pt-6 pb-1 px-4">
        <Logo size="md" />
      </header>

      <div className="flex-1 flex flex-col items-center px-4 text-center min-h-0">
        <h1 className="text-xl sm:text-2xl font-black text-zinc-950 mt-3">{tr('Your Body Health Map', 'आपका बॉडी हेल्थ मैप')}</h1>
        <p className="text-xs text-zinc-500 max-w-sm mt-1.5">
          {tr("Based on your onboarding, we've identified areas that may need attention.", 'आपके onboarding के आधार पर, हमने उन क्षेत्रों की पहचान की है जिन पर ध्यान देने की ज़रूरत हो सकती है।')}
        </p>

        {/* Overall wellness score + legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap justify-center">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-lg font-black text-zinc-950">{overallScore}<span className="text-xs font-bold text-zinc-400">/100</span></span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{tr('Overall Wellness', 'समग्र स्वास्थ्य')}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.good }} />{tr(STATUS_LABEL.good, STATUS_LABEL_HI.good)}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.attention }} />{tr(STATUS_LABEL.attention, STATUS_LABEL_HI.attention)}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: STATUS_COLOR.high }} />{tr(STATUS_LABEL.high, STATUS_LABEL_HI.high)}</span>
          </div>
        </div>

        {/* Organs / Systems toggle */}
        <div className="flex items-center gap-1 mt-3.5 p-1 rounded-2xl bg-zinc-100 border border-zinc-200">
          {(['organs', 'systems'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                viewMode === mode ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {mode === 'organs' ? tr('Organs', 'अंग') : tr('Systems', 'सिस्टम')}
            </button>
          ))}
        </div>

        {/* Card grid — stands in for the 3D body model for now; tapping a
            card opens the same detail sheet the real body view will use. */}
        <div className="w-full max-w-lg mt-4">
          {viewMode === 'organs' ? (
            <div className="grid grid-cols-3 gap-3">
              {ORGAN_IDS.map((id) => (
                <RegionCard
                  key={id}
                  label={organLabel(id, language)}
                  status={statuses[id]?.status || 'good'}
                  Icon={ORGAN_ICONS[id]}
                  onClick={() => handleSelectOrgan(id)}
                  language={language}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {REGION_IDS.map((id) => (
                <RegionCard
                  key={id}
                  label={regionLabel(id, language)}
                  status={statuses[id]?.status || 'good'}
                  Icon={STATUS_ICON[statuses[id]?.status || 'good']}
                  onClick={() => handleSelectSystem(id)}
                  language={language}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-zinc-400 mt-3">
          {tr('Tap a card for details on that area.', 'विवरण हेतु किसी कार्ड पर टैप करें।')}
        </p>
      </div>

      {/* Detail sheet — glassmorphism card, real onboarding-derived data */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={closeSheet}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-xl mx-auto rounded-t-3xl border-t border-white/60 shadow-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)' }}
            >
              <div className="max-h-[75vh] overflow-y-auto p-6 pb-8">
                <div className="w-10 h-1 rounded-full bg-zinc-300 mx-auto mb-4" />

                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{tr('Body Area', 'शरीर का क्षेत्र')}</span>
                  <button type="button" onClick={closeSheet} className="p-1.5 rounded-full hover:bg-black/5 cursor-pointer">
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
                <h3 className="text-xl font-black text-zinc-950 mb-2">{selected.label}</h3>
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full mb-4"
                  style={{ background: `${STATUS_COLOR[selected.status]}1a`, color: STATUS_COLOR[selected.status] }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[selected.status] }} />
                  {tr(STATUS_LABEL[selected.status], STATUS_LABEL_HI[selected.status])}
                </span>

                <div className="space-y-3.5 text-left">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400 mb-1">{tr('Possible Concern', 'संभावित चिंता')}</p>
                    <p className="text-sm font-bold text-zinc-800">{selected.concern}</p>
                  </div>

                  {selected.factors.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400 mb-1.5">{tr('Possible Contributing Factors', 'संभावित योगदान कारक')}</p>
                      <ul className="space-y-1">
                        {selected.factors.map((f) => (
                          <li key={f} className="text-xs font-semibold text-zinc-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[selected.status] }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400 mb-1.5">{tr('Recommended Next Steps', 'सुझाए गए अगले कदम')}</p>
                    <ul className="space-y-1">
                      {selected.nextSteps.map((s) => (
                        <li key={s} className="text-xs font-semibold text-zinc-700 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/70 border border-zinc-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-600">{tr('Wellness Score', 'स्वास्थ्य स्कोर')}</span>
                    <span className="text-base font-black text-zinc-950">{selected.wellnessScore}<span className="text-xs font-bold text-zinc-400">/100</span></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onNext}
                  className="w-full mt-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer"
                >
                  <span>{tr('View My Reversal Plan', 'मेरी रिवर्सल योजना देखें')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-[10px] text-zinc-400 text-center mt-3">
                  {tr('This is a wellness indicator, not a diagnosis — always confirm with your doctor.', 'यह एक स्वास्थ्य संकेतक है, निदान नहीं — हमेशा अपने डॉक्टर से पुष्टि करें।')}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="w-full max-w-xl mx-auto px-4 pb-6 pt-3">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 mb-3">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{tr('Most of these are reversible with the right daily plan', 'सही दैनिक योजना से इनमें से ज़्यादातर स्थितियां उलटी जा सकती हैं')}</span>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
        >
          <span>{tr('View My Reversal Plan', 'मेरी रिवर्सल योजना देखें')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

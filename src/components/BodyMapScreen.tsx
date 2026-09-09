import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, RotateCw, Plus, Minus, Sparkles, Loader2, Brain, Heart } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { Logo } from './Logo';
import { useLanguage, AppLanguage } from '../context/LanguageContext';

// The body meshes are dense (~60k verts / 300k+ tris each). drei's Html
// `occlude` prop raycasts every marker against the mesh on every frame —
// with a plain brute-force raycast that's 19 markers × hundreds of
// thousands of triangles, per frame, which is what made the rotation feel
// laggy. A bounds tree turns each of those raycasts into an O(log n) tree
// walk instead, so occlusion stays essentially free no matter how dense
// the mesh is.
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

interface BodyMapScreenProps {
  profile: UserHealthProfile;
  onNext: () => void;
}

type Status = 'good' | 'attention' | 'high';
type Gender = 'male' | 'female';
/** "Organs" (new default) shows the 6 internal-organ markers below with the
 *  sidebar quick-select list; "Systems" shows the original full body-surface
 *  region markers exactly as before — same data, same interaction, just one
 *  tab over instead of the only mode. */
type ViewMode = 'organs' | 'systems';

interface RegionStatus {
  status: Status;
  concern: string;
  factors: string[];
  nextSteps: string[];
  wellnessScore: number;
}

const MODEL_URL: Record<Gender, string> = {
  male: '/models/male.glb',
  female: '/models/female.glb',
};
useGLTF.preload(MODEL_URL.male);
useGLTF.preload(MODEL_URL.female);

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

function regionLabel(id: string, language: AppLanguage): string {
  return language === 'hi' ? (REGION_LABELS_HI[id] || REGION_LABELS[id]) : REGION_LABELS[id];
}

// Exact points on the surface of each real 3D body model (public/models/*.glb),
// found once by raycasting against the mesh — see scripts/generate-body-hotspots.mjs.
// Both models are already centered at the origin, so these read the same way
// regardless of screen size: [x, y, z] in the model's own local units.
const BODY_HOTSPOTS: Record<Gender, Record<string, [number, number, number][]>> = {
  male: {
    head: [[-0.0006, 0.8866, 0.2191]],
    eyes: [[-0.001, 0.8172, 0.1957]],
    neck: [[-0.0046, 0.7125, 0.1833]],
    shoulders: [[0.2851, 0.5721, 0.0381], [-0.2793, 0.5729, 0.0638]],
    chest: [[0.0039, 0.4612, 0.168]],
    arms: [[0.3494, 0.2363, 0.0296], [-0.3442, 0.2366, 0.0833]],
    stomach: [[0.0016, 0.1553, 0.1669]],
    hips: [[-0.0075, -0.1984, -0.001]],
    lowerBack: [[-0.0008, 0.1196, -0.1225]],
    knees: [[0.2075, -0.4109, -0.0103], [-0.2285, -0.4104, 0.0116]],
    legs: [[0.2286, -0.627, -0.0072], [-0.2654, -0.6267, 0.0142]],
    ankles: [[0.2023, -0.891, -0.021], [-0.2391, -0.8914, -0.014]],
    feet: [[0.2635, -0.9343, 0.1691], [-0.2618, -0.9331, 0.1599]],
  },
  female: {
    head: [[-0.0006, 0.8936, 0.1658]],
    eyes: [[-0.0015, 0.8196, 0.1814]],
    neck: [[-0.0028, 0.7127, 0.1659]],
    shoulders: [[0.2472, 0.571, 0.0495], [-0.2427, 0.5716, 0.0807]],
    chest: [[0.0028, 0.4665, 0.1508]],
    arms: [[0.2925, 0.2357, 0.0272], [-0.2787, 0.2377, 0.0675]],
    stomach: [[-0.0004, 0.1588, 0.1278]],
    hips: [[0.0111, -0.1959, 0.0542]],
    lowerBack: [[0.0006, 0.1182, -0.0986]],
    knees: [[0.1903, -0.4127, 0.0455], [-0.1859, -0.4113, 0.0373]],
    legs: [[0.1857, -0.6275, 0.0088], [-0.2037, -0.6275, 0.0289]],
    ankles: [[0.1365, -0.8925, -0.0326], [-0.1633, -0.8901, -0.0217]],
    feet: [[0.1683, -0.933, 0.0665], [-0.1781, -0.9334, 0.0746]],
  },
};

// Internal-organ landmarks — same raycasting technique as BODY_HOTSPOTS
// above (see scripts/generate-body-hotspots.mjs), aimed at the skin surface
// directly over where each organ sits. Powers the "Organs" view; the
// original body-surface regions above remain exactly as they were and
// power the "Systems" view — nothing about that data or interaction changed.
type OrganId = 'brain' | 'lungs' | 'heart' | 'stomach' | 'liver' | 'intestines';
const ORGAN_IDS: OrganId[] = ['brain', 'lungs', 'heart', 'stomach', 'liver', 'intestines'];

const ORGAN_HOTSPOTS: Record<Gender, Record<OrganId, [number, number, number][]>> = {
  male: {
    brain: [[-0.0012, 0.8626, 0.2055]],
    lungs: [[0.0538, 0.4615, 0.1744], [-0.0546, 0.4623, 0.1901]],
    heart: [[-0.0318, 0.3995, 0.1893]],
    stomach: [[0.0188, 0.1656, 0.1638]],
    liver: [[0.0572, 0.1962, 0.169]],
    intestines: [[-0.0017, 0.0008, 0.1823]],
  },
  female: {
    brain: [[-0.0008, 0.8641, 0.1774]],
    lungs: [[0.0445, 0.4646, 0.1734], [-0.0449, 0.4646, 0.1858]],
    heart: [[-0.0269, 0.4012, 0.2007]],
    stomach: [[0.0116, 0.1676, 0.1293]],
    liver: [[0.0477, 0.1968, 0.1355]],
    intestines: [[0.0001, -0.0011, 0.1452]],
  },
};

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

// ---------- 3D camera rig ----------
// A hand-rolled orbit: azimuth (spin around the body), polar (tilt up/down),
// radius (zoom) and y (look-at height). `current` is what's actually drawn
// each frame; `target` is where drag/buttons/marker-focus want it to go.
// During an active drag both are set together for instant 1:1 tracking —
// everything else (preset buttons, focusing on a marker) only moves the
// target and lets the per-frame lerp below ease the camera there.
interface OrbitState { azimuth: number; polar: number; radius: number; y: number; }

const DEFAULT_ORBIT: OrbitState = { azimuth: 0, polar: 1.5, radius: 2.55, y: 0 };
const MIN_RADIUS = 1.0;
const MAX_RADIUS = 3.4;
const MIN_POLAR = 0.85;
const MAX_POLAR = 2.25;

function shortestAngleDiff(from: number, to: number) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

function OrbitRig({ current, target }: { current: React.MutableRefObject<OrbitState>; target: React.MutableRefObject<OrbitState> }) {
  useFrame((state, delta) => {
    const c = current.current;
    const t = target.current;
    const f = 1 - Math.pow(0.0025, Math.min(delta, 0.1));
    c.azimuth += shortestAngleDiff(c.azimuth, t.azimuth) * f;
    c.polar += (t.polar - c.polar) * f;
    c.radius += (t.radius - c.radius) * f;
    c.y += (t.y - c.y) * f;

    const x = c.radius * Math.sin(c.polar) * Math.sin(c.azimuth);
    const y = c.radius * Math.cos(c.polar);
    const z = c.radius * Math.sin(c.polar) * Math.cos(c.azimuth);
    state.camera.position.set(x, c.y + y, z);
    state.camera.lookAt(0, c.y, 0);
  });
  return null;
}

const BodyMesh = React.forwardRef<THREE.Mesh, { gender: Gender }>(({ gender }, ref) => {
  const { nodes } = useGLTF(MODEL_URL[gender]) as any;
  const geometry: THREE.BufferGeometry = nodes.body.geometry;

  // Build the bounds-tree once per geometry (useGLTF caches the geometry
  // by URL, so this only runs again if the gender/model actually changes).
  useMemo(() => {
    if (!(geometry as any).boundsTree) geometry.computeBoundsTree();
  }, [geometry]);

  return (
    <mesh ref={ref} geometry={geometry}>
      <meshStandardMaterial color="#d8ac8d" roughness={0.55} metalness={0.02} />
    </mesh>
  );
});

function Marker({
  id,
  position,
  status,
  label,
  Icon,
  onSelect,
  occluder,
}: {
  id: string;
  position: [number, number, number];
  status: Status;
  /** Body-region markers (Systems view) resolve their own label from `id`;
   *  organ markers (Organs view) pass one in since ORGAN_LABELS isn't keyed
   *  the same way regionLabel() is. */
  label?: string;
  /** Organ markers only — draws the organ's own glyph inside the dot
   *  instead of a plain circle, and enables the larger "pain" styling. */
  Icon?: React.FC<{ className?: string }>;
  onSelect: (id: string) => void;
  occluder: React.MutableRefObject<THREE.Mesh | null>;
}) {
  const { language } = useLanguage();
  const resolvedLabel = label ?? regionLabel(id, language);
  const color = STATUS_COLOR[status];
  const isHigh = status === 'high';
  const size = Icon ? 34 : 26;
  const haloSize = size + (Icon ? 10 : 0);

  return (
    <Html position={position} center distanceFactor={2.6} zIndexRange={[10, 0]} occlude={[occluder]} style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
        title={resolvedLabel}
        style={{ width: size, height: size, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0 }}
      >
        {/* The blinking/fading halo — reserved for "high attention" (pain)
            markers so it reads as a distinct alert, not decoration on
            everything; good/attention markers stay calm and static. */}
        {isHigh && (
          <span
            style={{
              position: 'absolute', width: haloSize + 10, height: haloSize + 10, borderRadius: '9999px', background: color,
              animation: 'urcare-marker-blink 1.6s ease-in-out infinite',
            }}
          />
        )}
        {!isHigh && (
          <span style={{ position: 'absolute', width: haloSize, height: haloSize, borderRadius: '9999px', background: color, opacity: 0.16 }} />
        )}
        <span
          style={{
            position: 'relative', width: size, height: size, borderRadius: '9999px',
            background: Icon ? `radial-gradient(circle at 35% 30%, ${color}, ${color}dd)` : color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: `0 0 0 2px rgba(255,255,255,0.95), 0 2px 8px ${color}66`,
          }}
        >
          {Icon && <Icon className="w-4.5 h-4.5" />}
        </span>
      </button>
    </Html>
  );
}

const ORGAN_ICONS: Record<OrganId, React.FC<{ className?: string }>> = {
  brain: Brain,
  lungs: LungsGlyph,
  heart: Heart,
  stomach: StomachGlyph,
  liver: LiverGlyph,
  intestines: IntestinesGlyph,
};

function Scene({
  gender,
  viewMode,
  statuses,
  current,
  target,
  onSelectRegion,
  language,
}: {
  gender: Gender;
  viewMode: ViewMode;
  statuses: Record<string, RegionStatus>;
  current: React.MutableRefObject<OrbitState>;
  target: React.MutableRefObject<OrbitState>;
  onSelectRegion: (id: string) => void;
  language: AppLanguage;
}) {
  const hotspots = BODY_HOTSPOTS[gender];
  const organHotspots = ORGAN_HOTSPOTS[gender];
  const bodyRef = useRef<THREE.Mesh | null>(null);
  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight position={[2, 3.2, 3]} intensity={1.15} />
      <directionalLight position={[-2.2, 1.2, -1.8]} intensity={0.35} color="#bcd6ff" />
      <hemisphereLight args={['#ffffff', '#e7ecf3', 0.45]} />

      <OrbitRig current={current} target={target} />

      <BodyMesh gender={gender} ref={bodyRef} />

      {viewMode === 'systems' &&
        Object.entries(hotspots).map(([id, points]) =>
          points.map((p, i) => (
            <Marker
              key={`${id}-${i}`}
              id={id}
              position={p}
              status={statuses[id]?.status || 'good'}
              onSelect={onSelectRegion}
              occluder={bodyRef}
            />
          ))
        )}

      {viewMode === 'organs' &&
        ORGAN_IDS.map((id) =>
          organHotspots[id].map((p, i) => (
            <Marker
              key={`organ-${id}-${i}`}
              id={id}
              position={p}
              status={statuses[id]?.status || 'good'}
              label={organLabel(id, language)}
              Icon={ORGAN_ICONS[id]}
              onSelect={onSelectRegion}
              occluder={bodyRef}
            />
          ))
        )}

      {/* frames=1: the body never deforms and only the camera orbits, so the
          shadow only needs to be baked once instead of re-rendered every frame. */}
      <ContactShadows position={[0, -0.98, 0]} opacity={0.38} scale={3.2} blur={2.6} far={1.1} frames={1} />
    </>
  );
}

function LoadingOverlay() {
  const { language } = useLanguage();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F8FAFC]/70 backdrop-blur-sm z-20 pointer-events-none">
      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      <span className="text-xs font-bold text-zinc-400">{language === 'hi' ? 'आपका 3D बॉडी मॉडल तैयार हो रहा है…' : 'Preparing your 3D body model…'}</span>
    </div>
  );
}

export const BodyMapScreen: React.FC<BodyMapScreenProps> = ({ profile, onNext }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const gender: Gender = profile.gender === 'female' ? 'female' : 'male';
  const [selected, setSelected] = useState<SelectedRegion | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('organs');

  const statuses = useMemo(() => computeRegionStatuses(profile, language), [profile, language]);
  const overallScore = useMemo(() => {
    const scores = (Object.values(statuses) as RegionStatus[]).map((s) => s.wellnessScore);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [statuses]);

  const current = useRef<OrbitState>({ ...DEFAULT_ORBIT });
  const target = useRef<OrbitState>({ ...DEFAULT_ORBIT });

  const dragRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  }, []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      dragRef.current = { x: e.clientX, y: e.clientY, pointerId: dragRef.current.pointerId };
      const next: OrbitState = {
        azimuth: target.current.azimuth - dx * 0.009,
        polar: Math.min(MAX_POLAR, Math.max(MIN_POLAR, target.current.polar - dy * 0.007)),
        radius: target.current.radius,
        y: target.current.y,
      };
      target.current = next;
      current.current = next;
    };
    const handleUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  // React attaches onWheel as a passive listener, so e.preventDefault() inside
  // it is a silent no-op (and logs a console warning on every scroll) — a
  // native listener with { passive: false } is the only way to actually stop
  // the page from scrolling while the user zooms the model.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current = {
        ...target.current,
        radius: Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, target.current.radius + e.deltaY * 0.0016)),
      };
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchRef.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const delta = dist - pinchRef.current.dist;
      pinchRef.current = { dist };
      target.current = {
        ...target.current,
        radius: Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, target.current.radius - delta * 0.006)),
      };
    }
  }, []);

  const handleTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  const zoomBy = useCallback((delta: number) => {
    target.current = { ...target.current, radius: Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, target.current.radius + delta)) };
  }, []);

  const handleSelectRegion = useCallback((id: string) => {
    const isOrgan = viewMode === 'organs';
    const points = isOrgan ? ORGAN_HOTSPOTS[gender][id as OrganId] : BODY_HOTSPOTS[gender][id];
    const p = points?.[0];
    if (p) {
      target.current = {
        azimuth: Math.atan2(p[0], p[2]),
        polar: DEFAULT_ORBIT.polar,
        radius: isOrgan ? 0.95 : 1.2,
        y: p[1],
      };
    }
    const info = statuses[id];
    const label = isOrgan ? organLabel(id as OrganId, language) : regionLabel(id, language);
    window.setTimeout(() => setSelected({ id, label, ...info }), 280);
  }, [gender, statuses, language, viewMode]);

  const closeSheet = useCallback(() => {
    setSelected(null);
    target.current = { ...target.current, radius: DEFAULT_ORBIT.radius, y: 0 };
  }, []);

  return (
    <div id="body-map-screen" className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <style>{`
        @keyframes urcare-marker-blink {
          0%   { transform: scale(0.75); opacity: 0.55; }
          45%  { transform: scale(1.5);  opacity: 0.12; }
          55%  { transform: scale(1.5);  opacity: 0.12; }
          100% { transform: scale(0.75); opacity: 0.55; }
        }
      `}</style>

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

        {/* Body viewer row — an organ quick-select sidebar sits to the left
            in Organs mode (same tap-a-marker interaction as clicking it
            directly on the body, just faster to reach); the 3D body itself
            is deliberately borderless/full-bleed (no card or rounded box)
            so it stays the focus instead of looking boxed-in. */}
        <div className="w-full max-w-lg mt-3 flex items-stretch gap-2">
          {viewMode === 'organs' && (
            <div className="flex flex-col gap-1.5 shrink-0 justify-center">
              {ORGAN_IDS.map((id) => {
                const Icon = ORGAN_ICONS[id];
                const status = statuses[id]?.status || 'good';
                const color = STATUS_COLOR[status];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectRegion(id)}
                    title={organLabel(id, language)}
                    className="w-12 flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-white transition-colors cursor-pointer group"
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border ${status === 'high' ? 'animate-pulse' : ''}`}
                      style={{ background: `${color}1a`, borderColor: `${color}55`, color }}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    <span className="text-[9px] font-bold text-zinc-500 group-hover:text-zinc-800 leading-none truncate w-full text-center">
                      {organLabel(id, language)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            ref={containerRef}
            className="relative flex-1 min-w-0 h-[54vh] min-h-[380px] max-h-[600px] select-none touch-none overflow-visible cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Canvas
              camera={{ fov: 32, position: [0, 0, DEFAULT_ORBIT.radius] }}
              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
              dpr={[1, 1.75]}
              onCreated={() => setModelReady(true)}
            >
              <Suspense fallback={null}>
                <Scene gender={gender} viewMode={viewMode} statuses={statuses} current={current} target={target} onSelectRegion={handleSelectRegion} language={language} />
              </Suspense>
            </Canvas>

            {!modelReady && <LoadingOverlay />}

            {/* Zoom controls */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
              <button
                type="button"
                onClick={() => zoomBy(-0.3)}
                className="w-8 h-8 rounded-xl bg-white/90 backdrop-blur border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600 hover:text-emerald-600 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(0.3)}
                className="w-8 h-8 rounded-xl bg-white/90 backdrop-blur border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600 hover:text-emerald-600 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-2.5">
          <RotateCw className="w-3.5 h-3.5 shrink-0" />
          {viewMode === 'organs'
            ? tr('Drag to rotate — pinch or scroll to zoom — tap an organ (on the body or the list) for details.', 'घुमाने के लिए खींचें — ज़ूम हेतु पिंच या स्क्रॉल करें — विवरण हेतु किसी अंग पर टैप करें।')
            : tr('Drag to rotate the body — pinch or scroll to zoom — tap a glowing marker for details.', 'शरीर को घुमाने के लिए खींचें — ज़ूम करने के लिए पिंच या स्क्रॉल करें — विवरण हेतु चमकते मार्कर पर टैप करें।')}
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

import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, RotateCw, Plus, Minus, Sparkles } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { Logo } from './Logo';

interface BodyMapScreenProps {
  profile: UserHealthProfile;
  onNext: () => void;
}

type ViewName = 'front' | 'side' | 'back';
type Status = 'good' | 'attention' | 'high';

interface RegionDef {
  id: string;
  label: string;
  view: ViewName;
  top: string;
  left: string;
  mirror?: boolean;
}

interface RegionStatus {
  status: Status;
  concern: string;
  factors: string[];
  nextSteps: string[];
  wellnessScore: number;
}

const VIEW_ORDER: ViewName[] = ['front', 'side', 'back'];

const IMAGES: Record<'male' | 'female', Record<ViewName, string>> = {
  male: { front: '/body-male-front.png', side: '/body-male-side.png', back: '/body-male-back.png' },
  female: { front: '/body-female-front.png', side: '/body-female-side.png', back: '/body-female-back.png' },
};

// Every marker position is calibrated against the actual cropped reference
// photos (public/body-*.png) — a fixed, curated set of regions per angle so
// the screen stays readable instead of turning into a wall of dots.
const REGIONS: RegionDef[] = [
  { id: 'head', label: 'Head', view: 'front', top: '7%', left: '50%' },
  { id: 'eyes', label: 'Eyes', view: 'front', top: '10.5%', left: '50%' },
  { id: 'neck', label: 'Neck', view: 'front', top: '15%', left: '50%' },
  { id: 'shoulders', label: 'Shoulders', view: 'front', top: '19%', left: '31%', mirror: true },
  { id: 'chest', label: 'Chest', view: 'front', top: '27%', left: '50%' },
  { id: 'arms', label: 'Arms', view: 'front', top: '37%', left: '13%', mirror: true },
  { id: 'stomach', label: 'Stomach & Abdomen', view: 'front', top: '41%', left: '50%' },
  { id: 'hips', label: 'Hips', view: 'front', top: '48%', left: '50%' },
  { id: 'knees', label: 'Knees', view: 'front', top: '68%', left: '39%', mirror: true },
  { id: 'legs', label: 'Legs', view: 'front', top: '80%', left: '38%', mirror: true },
  { id: 'feet', label: 'Feet', view: 'front', top: '96%', left: '40%', mirror: true },

  { id: 'head', label: 'Head', view: 'side', top: '7%', left: '55%' },
  { id: 'neck', label: 'Neck', view: 'side', top: '15%', left: '52%' },
  { id: 'chest', label: 'Chest', view: 'side', top: '27%', left: '58%' },
  { id: 'stomach', label: 'Stomach & Abdomen', view: 'side', top: '41%', left: '52%' },
  { id: 'hips', label: 'Hips', view: 'side', top: '48%', left: '48%' },
  { id: 'knees', label: 'Knees', view: 'side', top: '68%', left: '48%' },
  { id: 'legs', label: 'Legs', view: 'side', top: '80%', left: '48%' },

  { id: 'head', label: 'Head', view: 'back', top: '7%', left: '50%' },
  { id: 'neck', label: 'Neck', view: 'back', top: '15%', left: '50%' },
  { id: 'shoulders', label: 'Shoulders', view: 'back', top: '19%', left: '31%', mirror: true },
  { id: 'lowerBack', label: 'Lower Back', view: 'back', top: '38%', left: '50%' },
  { id: 'hips', label: 'Hips', view: 'back', top: '48%', left: '50%' },
  { id: 'knees', label: 'Knees', view: 'back', top: '68%', left: '39%', mirror: true },
  { id: 'ankles', label: 'Ankles', view: 'back', top: '91%', left: '40%', mirror: true },
  { id: 'feet', label: 'Feet', view: 'back', top: '96%', left: '40%', mirror: true },
];

const STATUS_COLOR: Record<Status, string> = { good: '#22c55e', attention: '#f97316', high: '#ef4444' };
const STATUS_LABEL: Record<Status, string> = { good: 'Healthy', attention: 'Needs Attention', high: 'High Attention' };
const RANK: Record<Status, number> = { good: 0, attention: 1, high: 2 };

/** Reads the user's real onboarding answers and produces a wellness
 *  indicator for every tracked body region — defaulting to "good" and only
 *  escalating where an actual condition or symptom points to it. Nothing
 *  here is a diagnosis, and unmatched regions are never invented as a
 *  concern just to fill space. */
function computeRegionStatuses(profile: UserHealthProfile): Record<string, RegionStatus> {
  const conditions = new Set(profile.medicalConditions || []);
  const dd: any = profile.healthDeepDive || {};
  const organSymptoms: string[] = dd.organSymptoms || [];
  const digestiveSymptoms: string[] = dd.digestiveSymptoms || [];

  const ids = ['head', 'eyes', 'neck', 'shoulders', 'chest', 'arms', 'stomach', 'hips', 'knees', 'legs', 'feet', 'lowerBack', 'ankles'];
  const out: Record<string, RegionStatus> = {};
  ids.forEach((id) => {
    out[id] = { status: 'good', concern: 'No specific concerns flagged from your onboarding answers', factors: [], nextSteps: ['Keep up your current habits'], wellnessScore: 88 };
  });

  const flag = (id: string, status: Status, concern: string, factor: string, steps: string[], score: number) => {
    const cur = out[id];
    if (RANK[status] >= RANK[cur.status]) {
      out[id] = { status, concern, factors: [...new Set([...(cur.status === 'good' ? [] : cur.factors), factor])], nextSteps: steps, wellnessScore: score };
    } else {
      out[id] = { ...cur, factors: [...new Set([...cur.factors, factor])] };
    }
  };

  if (conditions.has('Diabetes / Pre-Diabetes')) {
    flag('feet', 'attention', 'Reduced circulation & sensation risk', 'Diabetes / Pre-Diabetes', ['Check your feet daily', 'Wear comfortable, well-fitted footwear', 'Keep blood sugar in your target range'], 58);
  }
  if (conditions.has('Neuropathy (Nerve Pain/Tingling)')) {
    flag('feet', 'high', 'Nerve sensitivity (tingling or numbness)', 'Neuropathy (Nerve Pain/Tingling)', ['Check your feet daily for cuts or sores', 'Include B-vitamin rich foods', 'Gentle daily circulation exercises'], 45);
    flag('arms', 'attention', 'Nerve sensitivity in hands', 'Neuropathy (Nerve Pain/Tingling)', ['Hand & wrist stretches', 'Include B-vitamin rich foods'], 55);
  }
  if (conditions.has('High Blood Pressure')) flag('chest', 'high', 'Cardiovascular load', 'High Blood Pressure', ['Reduce sodium intake', 'Daily light movement', 'Track your blood pressure regularly'], 48);
  if (conditions.has('Heart Disease')) flag('chest', 'high', 'Cardiovascular strain', 'Heart Disease', ['Follow your cardiologist\'s guidance', 'Low-sodium, heart-friendly meals', 'Gentle, doctor-approved activity'], 42);
  if (conditions.has('Erectile Dysfunction')) flag('chest', 'attention', 'Vascular health signal', 'Erectile Dysfunction', ['Heart-healthy diet', 'Regular movement to support circulation'], 60);
  if (conditions.has('High Cholesterol / Fatty Liver')) flag('stomach', 'attention', 'Liver & lipid load', 'High Cholesterol / Fatty Liver', ['Reduce fried & processed foods', 'Add more fiber-rich vegetables'], 60);
  if (conditions.has('Digestive / IBS')) flag('stomach', 'attention', 'Digestive sensitivity', 'Digestive / IBS', ['Smaller, more regular meals', 'Identify and avoid trigger foods'], 62);
  if (conditions.has('PCOS / PCOD')) flag('stomach', 'attention', 'Hormonal-metabolic link', 'PCOS / PCOD', ['Low-GI, anti-inflammatory meals', 'Consistent daily movement'], 62);
  if (conditions.has('Kidney Disease')) flag('lowerBack', 'high', 'Kidney function support needed', 'Kidney Disease', ['Controlled protein & sodium intake', 'Stay well hydrated', 'Keep up with regular check-ups'], 42);
  if (conditions.has('Joint Pain / Arthritis')) flag('knees', 'attention', 'Joint discomfort', 'Joint Pain / Arthritis', ['Low-impact movement', 'Anti-inflammatory foods', 'Maintain a healthy weight'], 55);
  if (conditions.has('Uric Acid / Gout')) flag('knees', 'attention', 'Joint discomfort (uric acid related)', 'Uric Acid / Gout', ['Low-purine diet', 'Stay well hydrated'], 55);
  if (conditions.has('Thyroid (Hypo/Hyper)')) flag('neck', 'attention', 'Thyroid balance', 'Thyroid (Hypo/Hyper)', ['Consistent sleep schedule', 'Iodine-mindful diet'], 60);
  if (conditions.has('Chronic Fatigue')) flag('head', 'attention', 'Low energy levels', 'Chronic Fatigue', ['Consistent sleep & wake time', 'Steady, balanced meals through the day'], 58);
  if (conditions.has('Sleep Apnea / Sleep Issues')) flag('head', 'attention', 'Disrupted rest', 'Sleep Apnea / Sleep Issues', ['Consistent sleep schedule', 'Reduce late-day caffeine'], 58);
  if (conditions.has('Diabetic Retinopathy')) flag('eyes', 'high', 'Eye health monitoring needed', 'Diabetic Retinopathy', ['Regular eye check-ups', 'Keep blood sugar in range'], 50);
  if (conditions.has('Obesity')) flag('hips', 'attention', 'Weight-related joint load', 'Obesity', ['Gradual, sustainable calorie deficit', 'Low-impact daily movement'], 58);

  organSymptoms.forEach((s) => {
    if (s.includes('Tingling')) { flag('feet', 'attention', 'Nerve sensitivity', s, ['Check your feet daily'], 55); flag('arms', 'attention', 'Nerve sensitivity', s, ['Hand & wrist stretches'], 58); }
    if (s.includes('Blurry vision')) flag('eyes', 'attention', 'Vision changes reported', s, ['Regular eye check-ups'], 55);
    if (s.includes('Swelling')) flag('feet', 'attention', 'Fluid retention', s, ['Elevate legs when resting', 'Reduce sodium intake'], 55);
    if (s.includes('Chest pain')) flag('chest', 'high', 'Reported chest discomfort', s, ['Discuss with your doctor soon', 'Avoid strenuous exertion until reviewed'], 40);
    if (s.includes('Joint pain')) flag('knees', 'attention', 'Joint discomfort', s, ['Low-impact movement'], 55);
    if (s.includes('Headaches')) flag('head', 'attention', 'Frequent headaches / brain fog', s, ['Consistent sleep schedule', 'Stay well hydrated'], 58);
  });
  digestiveSymptoms.forEach((s) => { if (s && s !== 'None') flag('stomach', 'attention', 'Digestive discomfort', s, ['Smaller, more regular meals'], 62); });

  return out;
}

interface SelectedRegion extends RegionStatus {
  id: string;
  label: string;
}

export const BodyMapScreen: React.FC<BodyMapScreenProps> = ({ profile, onNext }) => {
  const gender: 'male' | 'female' = profile.gender === 'female' ? 'female' : 'male';
  const [view, setView] = useState<ViewName>('front');
  const [zoom, setZoom] = useState(1);
  const [focusOrigin, setFocusOrigin] = useState('50% 50%');
  const [selected, setSelected] = useState<SelectedRegion | null>(null);

  const statuses = useMemo(() => computeRegionStatuses(profile), [profile]);
  const overallScore = useMemo(() => {
    const scores = (Object.values(statuses) as RegionStatus[]).map((s) => s.wellnessScore);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [statuses]);

  const visibleRegions = REGIONS.filter((r) => r.view === view);

  // Drag left/right cycles Front → Side → Back (and back), simulating
  // turning the body — dragging a marker itself is ignored (see the
  // marker button's own stopPropagation).
  const dragState = useRef<{ startX: number } | null>(null);
  const handlePointerDown = (e: React.PointerEvent) => { dragState.current = { startX: e.clientX }; };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta = e.clientX - dragState.current.startX;
    dragState.current = null;
    if (Math.abs(delta) < 40) return;
    const idx = VIEW_ORDER.indexOf(view);
    const nextIdx = delta < 0
      ? (idx + 1) % VIEW_ORDER.length
      : (idx - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
    setView(VIEW_ORDER[nextIdx]);
    setZoom(1);
    setFocusOrigin('50% 50%');
  };

  const handleMarkerClick = (region: RegionDef, e: React.MouseEvent) => {
    e.stopPropagation();
    setFocusOrigin(`${region.left} ${region.top}`);
    setZoom(1.5);
    const info = statuses[region.id];
    window.setTimeout(() => setSelected({ id: region.id, label: region.label, ...info }), 300);
  };

  const closeSheet = () => {
    setSelected(null);
    setZoom(1);
    setFocusOrigin('50% 50%');
  };

  return (
    <div id="body-map-screen" className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="w-full max-w-xl mx-auto flex items-center justify-center pt-6 pb-1 px-4">
        <Logo size="md" />
      </header>

      <div className="flex-1 flex flex-col items-center px-4 text-center min-h-0">
        <h1 className="text-xl sm:text-2xl font-black text-zinc-950 mt-3">Your Body Health Map</h1>
        <p className="text-xs text-zinc-500 max-w-sm mt-1.5">
          Based on your onboarding, we've identified areas that may need attention.
        </p>

        {/* Overall wellness score + legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap justify-center">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-lg font-black text-zinc-950">{overallScore}<span className="text-xs font-bold text-zinc-400">/100</span></span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Overall Wellness</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.good }} />Healthy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.attention }} />Needs Attention</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.high }} />High Attention</span>
          </div>
        </div>

        {/* View buttons */}
        <div className="flex items-center gap-1.5 mt-4 p-1 rounded-2xl bg-zinc-100 border border-zinc-200">
          {VIEW_ORDER.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); setZoom(1); setFocusOrigin('50% 50%'); }}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                view === v ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* The body viewer */}
        <div className="relative w-full max-w-xs sm:max-w-sm flex-1 min-h-[380px] mt-3 select-none">
          <div
            className="relative w-full h-full rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200 border border-zinc-200 shadow-inner cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            style={{ touchAction: 'pan-y' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <motion.img
                  src={IMAGES[gender][view]}
                  alt={`${gender} body — ${view} view`}
                  className="w-full h-full object-cover object-top pointer-events-none"
                  animate={{ scale: zoom }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{ transformOrigin: focusOrigin }}
                  draggable={false}
                />

                {visibleRegions.map((region) => {
                  const info = statuses[region.id];
                  const color = STATUS_COLOR[info.status];
                  const positions = region.mirror
                    ? [region.left, `${100 - parseFloat(region.left)}%`]
                    : [region.left];
                  return positions.map((left, i) => (
                    <button
                      key={`${region.id}-${region.view}-${i}`}
                      type="button"
                      onClick={(e) => handleMarkerClick(region, e)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ top: region.top, left }}
                      title={region.label}
                    >
                      <motion.span
                        className="absolute inset-0 rounded-full"
                        style={{ background: color, width: 22, height: 22, left: -11, top: -11 }}
                        animate={{ opacity: [0.35, 0.05, 0.35], scale: [0.8, 1.6, 0.8] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span className="relative block w-2.5 h-2.5 rounded-full shadow-md ring-2 ring-white" style={{ background: color }} />
                    </button>
                  ));
                })}
              </motion.div>
            </AnimatePresence>

            {/* Zoom controls */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.2, z + 0.3))}
                className="w-8 h-8 rounded-xl bg-white/90 backdrop-blur border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600 hover:text-emerald-600 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, z - 0.3))}
                className="w-8 h-8 rounded-xl bg-white/90 backdrop-blur border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600 hover:text-emerald-600 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-2.5">
          <RotateCw className="w-3.5 h-3.5 shrink-0" />
          Drag to turn the body — tap a glowing marker for details.
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
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Body Area</span>
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
                  {STATUS_LABEL[selected.status]}
                </span>

                <div className="space-y-3.5 text-left">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400 mb-1">Possible Concern</p>
                    <p className="text-sm font-bold text-zinc-800">{selected.concern}</p>
                  </div>

                  {selected.factors.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400 mb-1.5">Possible Contributing Factors</p>
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
                    <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400 mb-1.5">Recommended Next Steps</p>
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
                    <span className="text-xs font-bold text-zinc-600">Wellness Score</span>
                    <span className="text-base font-black text-zinc-950">{selected.wellnessScore}<span className="text-xs font-bold text-zinc-400">/100</span></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onNext}
                  className="w-full mt-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer"
                >
                  <span>View Personalized Plan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-[10px] text-zinc-400 text-center mt-3">
                  This is a wellness indicator, not a diagnosis — always confirm with your doctor.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="w-full max-w-xl mx-auto px-4 pb-6 pt-3">
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
        >
          <span>View Personalized Plan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

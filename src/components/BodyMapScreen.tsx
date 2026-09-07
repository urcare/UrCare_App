import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, RotateCw, Plus, Minus, Sparkles, Loader2 } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { Logo } from './Logo';

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

type ViewName = 'front' | 'side' | 'back';
type Status = 'good' | 'attention' | 'high';
type Gender = 'male' | 'female';

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
  label,
  position,
  status,
  onSelect,
  occluder,
}: {
  id: string;
  label: string;
  position: [number, number, number];
  status: Status;
  onSelect: (id: string) => void;
  occluder: React.MutableRefObject<THREE.Mesh | null>;
}) {
  const color = STATUS_COLOR[status];
  return (
    <Html position={position} center distanceFactor={2.6} zIndexRange={[10, 0]} occlude={[occluder]} style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
        title={label}
        style={{ width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0 }}
      >
        <span
          style={{
            position: 'absolute', width: 26, height: 26, borderRadius: '9999px', background: color, opacity: 0.3,
            animation: 'urcare-marker-pulse 1.8s ease-in-out infinite',
          }}
        />
        <span style={{ position: 'relative', width: 11, height: 11, borderRadius: '9999px', background: color, boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.35)' }} />
      </button>
    </Html>
  );
}

function Scene({
  gender,
  statuses,
  current,
  target,
  onSelectRegion,
}: {
  gender: Gender;
  statuses: Record<string, RegionStatus>;
  current: React.MutableRefObject<OrbitState>;
  target: React.MutableRefObject<OrbitState>;
  onSelectRegion: (id: string) => void;
}) {
  const hotspots = BODY_HOTSPOTS[gender];
  const bodyRef = useRef<THREE.Mesh | null>(null);
  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight position={[2, 3.2, 3]} intensity={1.15} />
      <directionalLight position={[-2.2, 1.2, -1.8]} intensity={0.35} color="#bcd6ff" />
      <hemisphereLight args={['#ffffff', '#e7ecf3', 0.45]} />

      <OrbitRig current={current} target={target} />

      <BodyMesh gender={gender} ref={bodyRef} />

      {Object.entries(hotspots).map(([id, points]) =>
        points.map((p, i) => (
          <Marker
            key={`${id}-${i}`}
            id={id}
            label={REGION_LABELS[id]}
            position={p}
            status={statuses[id]?.status || 'good'}
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
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F8FAFC]/70 backdrop-blur-sm z-20 pointer-events-none">
      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      <span className="text-xs font-bold text-zinc-400">Preparing your 3D body model…</span>
    </div>
  );
}

export const BodyMapScreen: React.FC<BodyMapScreenProps> = ({ profile, onNext }) => {
  const gender: Gender = profile.gender === 'female' ? 'female' : 'male';
  const [preset, setPreset] = useState<ViewName>('front');
  const [selected, setSelected] = useState<SelectedRegion | null>(null);
  const [modelReady, setModelReady] = useState(false);

  const statuses = useMemo(() => computeRegionStatuses(profile), [profile]);
  const overallScore = useMemo(() => {
    const scores = (Object.values(statuses) as RegionStatus[]).map((s) => s.wellnessScore);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [statuses]);

  const current = useRef<OrbitState>({ ...DEFAULT_ORBIT });
  const target = useRef<OrbitState>({ ...DEFAULT_ORBIT });

  const dragRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const applyPreset = useCallback((v: ViewName) => {
    setPreset(v);
    setSelected(null);
    const azimuth = v === 'front' ? 0 : v === 'side' ? Math.PI / 2 : Math.PI;
    target.current = { azimuth, polar: DEFAULT_ORBIT.polar, radius: DEFAULT_ORBIT.radius, y: 0 };
  }, []);

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
    const points = BODY_HOTSPOTS[gender][id];
    const p = points?.[0];
    if (p) {
      target.current = {
        azimuth: Math.atan2(p[0], p[2]),
        polar: DEFAULT_ORBIT.polar,
        radius: 1.2,
        y: p[1],
      };
    }
    const info = statuses[id];
    window.setTimeout(() => setSelected({ id, label: REGION_LABELS[id], ...info }), 280);
  }, [gender, statuses]);

  const closeSheet = useCallback(() => {
    setSelected(null);
    target.current = { ...target.current, radius: DEFAULT_ORBIT.radius, y: 0 };
  }, []);

  return (
    <div id="body-map-screen" className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <style>{`@keyframes urcare-marker-pulse { 0%,100% { transform: scale(0.85); opacity: 0.35; } 50% { transform: scale(1.6); opacity: 0.05; } }`}</style>

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
          {(['front', 'side', 'back'] as ViewName[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => applyPreset(v)}
              className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer ${
                preset === v ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* The 3D body viewer */}
        <div
          ref={containerRef}
          className="relative w-full max-w-md h-[50vh] min-h-[380px] max-h-[560px] mt-3 select-none touch-none rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200/60 cursor-grab active:cursor-grabbing"
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
              <Scene gender={gender} statuses={statuses} current={current} target={target} onSelectRegion={handleSelectRegion} />
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

        <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-2.5">
          <RotateCw className="w-3.5 h-3.5 shrink-0" />
          Drag to rotate the body — pinch or scroll to zoom — tap a glowing marker for details.
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

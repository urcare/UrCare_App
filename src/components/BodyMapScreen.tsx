import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, RotateCw } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { Logo } from './Logo';

interface BodyMapScreenProps {
  profile: UserHealthProfile;
  onNext: () => void;
}

type ZoneId = 'head' | 'neck' | 'chest' | 'liver' | 'digestion' | 'kidneys' | 'hands' | 'joints' | 'feet';

interface ZoneInfo {
  id: ZoneId;
  label: string;
  score: number;
  reasons: string[];
  position: [number, number, number];
  mirrored: boolean;
}

const ZONE_META: Record<ZoneId, { label: string; position: [number, number, number]; mirrored: boolean }> = {
  head: { label: 'Head & Focus', position: [0, 4.75, 0.55], mirrored: false },
  neck: { label: 'Thyroid', position: [0, 4.05, 0.5], mirrored: false },
  chest: { label: 'Heart', position: [-0.25, 3.1, 0.8], mirrored: false },
  liver: { label: 'Liver', position: [0.55, 2.35, 0.75], mirrored: false },
  digestion: { label: 'Digestion', position: [0, 1.85, 0.8], mirrored: false },
  kidneys: { label: 'Kidneys', position: [0, 2.15, -0.85], mirrored: false },
  hands: { label: 'Hands', position: [1.55, 1.3, 0], mirrored: true },
  joints: { label: 'Joints', position: [0.45, -0.55, 0.25], mirrored: true },
  feet: { label: 'Feet', position: [0.45, -1.85, 0.2], mirrored: true },
};

/** Reads the user's own onboarding answers (conditions + deep-dive symptoms)
 *  and turns them into a handful of body zones worth flagging, each keeping
 *  a note of exactly which answers put it there. */
function computeHotspots(profile: UserHealthProfile): ZoneInfo[] {
  const conditions = new Set(profile.medicalConditions || []);
  const dd: any = profile.healthDeepDive || {};
  const organSymptoms: string[] = dd.organSymptoms || [];
  const digestiveSymptoms: string[] = dd.digestiveSymptoms || [];

  const scores: Partial<Record<ZoneId, number>> = {};
  const reasons: Partial<Record<ZoneId, string[]>> = {};
  const bump = (zone: ZoneId, amount: number, reason: string) => {
    scores[zone] = Math.min(95, (scores[zone] || 32) + amount);
    const list = reasons[zone] || (reasons[zone] = []);
    if (!list.includes(reason)) list.push(reason);
  };

  if (conditions.has('Diabetes / Pre-Diabetes')) { bump('feet', 22, 'Diabetes / Pre-Diabetes'); bump('kidneys', 12, 'Diabetes / Pre-Diabetes'); }
  if (conditions.has('High Blood Pressure')) bump('chest', 22, 'High Blood Pressure');
  if (conditions.has('Heart Disease')) bump('chest', 25, 'Heart Disease');
  if (conditions.has('Erectile Dysfunction')) bump('chest', 15, 'Erectile Dysfunction');
  if (conditions.has('High Cholesterol / Fatty Liver')) bump('liver', 25, 'High Cholesterol / Fatty Liver');
  if (conditions.has('Thyroid (Hypo/Hyper)')) bump('neck', 25, 'Thyroid (Hypo/Hyper)');
  if (conditions.has('Kidney Disease')) bump('kidneys', 25, 'Kidney Disease');
  if (conditions.has('Joint Pain / Arthritis')) bump('joints', 25, 'Joint Pain / Arthritis');
  if (conditions.has('Uric Acid / Gout')) bump('joints', 20, 'Uric Acid / Gout');
  if (conditions.has('Neuropathy (Nerve Pain/Tingling)')) { bump('hands', 22, 'Neuropathy (Nerve Pain/Tingling)'); bump('feet', 22, 'Neuropathy (Nerve Pain/Tingling)'); }
  if (conditions.has('Digestive / IBS')) bump('digestion', 22, 'Digestive / IBS');
  if (conditions.has('Chronic Fatigue')) bump('head', 20, 'Chronic Fatigue');
  if (conditions.has('Sleep Apnea / Sleep Issues')) bump('head', 15, 'Sleep Apnea / Sleep Issues');
  if (conditions.has('Diabetic Retinopathy')) bump('head', 18, 'Diabetic Retinopathy');
  if (conditions.has('PCOS / PCOD')) bump('digestion', 12, 'PCOS / PCOD');

  organSymptoms.forEach((s) => {
    if (s.includes('Tingling')) { bump('hands', 18, s); bump('feet', 18, s); }
    if (s.includes('Blurry vision')) bump('head', 18, s);
    if (s.includes('Swelling')) bump('feet', 18, s);
    if (s.includes('Chest pain')) bump('chest', 20, s);
    if (s.includes('Joint pain')) bump('joints', 18, s);
    if (s.includes('Headaches')) bump('head', 15, s);
  });
  digestiveSymptoms.forEach((s) => { if (s && s !== 'None') bump('digestion', 12, s); });

  return (Object.keys(scores) as ZoneId[])
    .map((id) => ({ id, score: scores[id]!, reasons: reasons[id] || [], ...ZONE_META[id] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function colorForScore(score: number): number {
  return score >= 70 ? 0xf43f5e : score >= 45 ? 0xf97316 : 0xeab308;
}

/** A real, rotatable 3D body — plain primitive shapes (no external model
 *  file needed), lit and shaded properly, with glowing markers over the
 *  zones the user's own onboarding answers point to. Drag to spin it,
 *  tap a marker for details. Shown as its own screen right after
 *  onboarding, before the celebration/plan-ready screen. */
export const BodyMapScreen: React.FC<BodyMapScreenProps> = ({ profile, onNext }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const hotspots = useMemo(() => computeHotspots(profile), [profile]);
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 10.5);
    camera.lookAt(0, 2.2, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting — needed for the shaded material to actually read as 3D.
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(3, 6, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9fc8ff, 0.3);
    fillLight.position.set(-4, 1, -3);
    scene.add(fillLight);

    // The body — a low-poly humanoid built from primitives.
    const bodyGroup = new THREE.Group();
    scene.add(bodyGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe7edf5, roughness: 0.65, metalness: 0.05 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 24), skinMat);
    head.position.set(0, 4.6, 0);
    bodyGroup.add(head);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 16), skinMat);
    neck.position.set(0, 4.0, 0);
    bodyGroup.add(neck);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 1.9, 6, 16), skinMat);
    torso.position.set(0, 2.7, 0);
    bodyGroup.add(torso);

    const armGeom = new THREE.CapsuleGeometry(0.26, 2.0, 6, 12);
    const armL = new THREE.Mesh(armGeom, skinMat);
    armL.position.set(-1.15, 2.75, 0);
    armL.rotation.z = 0.12;
    bodyGroup.add(armL);
    const armR = new THREE.Mesh(armGeom, skinMat);
    armR.position.set(1.15, 2.75, 0);
    armR.rotation.z = -0.12;
    bodyGroup.add(armR);

    const legGeom = new THREE.CapsuleGeometry(0.34, 2.3, 6, 12);
    const legL = new THREE.Mesh(legGeom, skinMat);
    legL.position.set(-0.45, 0.3, 0);
    bodyGroup.add(legL);
    const legR = new THREE.Mesh(legGeom, skinMat);
    legR.position.set(0.45, 0.3, 0);
    bodyGroup.add(legR);

    // Ground shadow-catcher-ish subtle disc, purely decorative.
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.08 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, -2.05, 0);
    bodyGroup.add(base);

    // Hotspot markers — glowing spheres pinned to whichever zones the
    // user's own answers flagged. Mirrored zones (hands/joints/feet) get
    // one marker on each side.
    const markerGeom = new THREE.SphereGeometry(0.16, 16, 16);
    const markers: THREE.Mesh[] = [];

    hotspotsRef.current.forEach((zone) => {
      const positions: [number, number, number][] = zone.mirrored
        ? [zone.position, [-zone.position[0], zone.position[1], zone.position[2]]]
        : [zone.position];
      positions.forEach((pos) => {
        const color = colorForScore(zone.score);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4 });
        const marker = new THREE.Mesh(markerGeom, mat);
        marker.position.set(pos[0], pos[1], pos[2]);
        marker.userData.zoneId = zone.id;
        bodyGroup.add(marker);
        markers.push(marker);
      });
    });

    // Interaction: drag anywhere to rotate, tap a marker (no drag) for details.
    let isDragging = false;
    let startX = 0;
    let startRotY = 0;
    let dragDistance = 0;
    let autoRotate = true;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      autoRotate = false;
      dragDistance = 0;
      startX = e.clientX;
      startRotY = bodyGroup.rotation.y;
      if (resumeTimer) clearTimeout(resumeTimer);
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      dragDistance = Math.max(dragDistance, Math.abs(delta));
      bodyGroup.rotation.y = startRotY + delta * 0.012;
    };
    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      if (dragDistance < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(markers, false);
        if (hits.length > 0) {
          const zoneId = hits[0].object.userData.zoneId as ZoneId;
          const zone = hotspotsRef.current.find((z) => z.id === zoneId) || null;
          setSelectedZone(zone);
        }
      }
      resumeTimer = setTimeout(() => { autoRotate = true; }, 2200);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      const c = containerRef.current;
      if (!c) return;
      const w = c.clientWidth || width;
      const h = c.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    let t = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      t += 0.016;
      if (autoRotate) bodyGroup.rotation.y += 0.004;

      markers.forEach((m, i) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5 + 0.4 * Math.sin(t * 2.4 + i);
        m.scale.setScalar(1 + 0.15 * Math.sin(t * 2.4 + i));
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resumeTimer) clearTimeout(resumeTimer);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      container.innerHTML = '';
      renderer.dispose();
    };
  }, [profile]);

  return (
    <div id="body-map-screen" className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="w-full max-w-xl mx-auto flex items-center justify-center pt-6 pb-1 px-4">
        <Logo size="md" />
      </header>

      <div className="flex-1 flex flex-col items-center px-4 text-center min-h-0">
        <h1 className="text-xl sm:text-2xl font-black text-zinc-950 mt-3">Your Personalized Body Map</h1>
        <p className="text-xs text-zinc-500 max-w-sm mt-1.5 flex items-center gap-1.5 justify-center">
          <RotateCw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          {hotspots.length > 0
            ? 'Drag to rotate the model — tap a glowing area for details.'
            : "Drag to rotate. No specific areas flagged — your plan will focus on overall wellness."}
        </p>

        <div ref={containerRef} className="w-full max-w-md flex-1 min-h-[340px] sm:min-h-[400px] mt-1" />
      </div>

      {/* Detail sheet for a tapped zone */}
      <AnimatePresence>
        {selectedZone && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setSelectedZone(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 pb-8 shadow-2xl max-w-xl mx-auto border-t border-zinc-200"
            >
              <div className="w-10 h-1 rounded-full bg-zinc-200 mx-auto mb-4" />
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-zinc-950">{selectedZone.label}</h3>
                <button type="button" onClick={() => setSelectedZone(null)} className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
              <div className="text-sm font-black text-rose-500 mb-3">{selectedZone.score}% focus area</div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Flagged based on</p>
              <ul className="space-y-1.5 mb-1">
                {selectedZone.reasons.map((r) => (
                  <li key={r} className="text-xs font-semibold text-zinc-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-400 mt-3">Not a diagnosis — just where your reversal plan starts.</p>
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
          <span>Next</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

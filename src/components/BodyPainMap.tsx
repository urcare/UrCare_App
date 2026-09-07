import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { UserHealthProfile } from '../types';

interface BodyPainMapProps {
  profile: UserHealthProfile;
}

type ZoneId = 'head' | 'neck' | 'chest' | 'liver' | 'digestion' | 'kidneys' | 'hands' | 'joints' | 'feet';

/** Fixed screen position of each zone, calibrated against the simple body
 *  silhouette drawn below — not real anatomy, just consistent placement. */
const ZONE_LAYOUT: Record<ZoneId, { label: string; top: string; left: string; side: 'left' | 'right' }> = {
  head: { label: 'Head & Focus', top: '7%', left: '50%', side: 'right' },
  neck: { label: 'Thyroid', top: '17%', left: '50%', side: 'left' },
  chest: { label: 'Heart', top: '29%', left: '50%', side: 'right' },
  liver: { label: 'Liver', top: '37%', left: '38%', side: 'left' },
  digestion: { label: 'Digestion', top: '40%', left: '62%', side: 'right' },
  kidneys: { label: 'Kidneys', top: '43%', left: '50%', side: 'left' },
  hands: { label: 'Hands', top: '54%', left: '15%', side: 'left' },
  joints: { label: 'Joints', top: '73%', left: '50%', side: 'right' },
  feet: { label: 'Feet', top: '97%', left: '50%', side: 'left' },
};

/** Reads the user's own onboarding answers (conditions + deep-dive symptoms)
 *  and turns them into a handful of body zones worth flagging — never more
 *  than five, so the diagram stays readable instead of turning into clutter. */
function computeHotspots(profile: UserHealthProfile) {
  const conditions = new Set(profile.medicalConditions || []);
  const dd = (profile.healthDeepDive as any) || {};
  const organSymptoms: string[] = dd.organSymptoms || [];
  const digestiveSymptoms: string[] = dd.digestiveSymptoms || [];

  const scores: Partial<Record<ZoneId, number>> = {};
  const bump = (zone: ZoneId, amount = 22) => { scores[zone] = Math.min(95, (scores[zone] || 32) + amount); };

  if (conditions.has('Diabetes / Pre-Diabetes')) { bump('feet'); bump('kidneys', 12); }
  if (conditions.has('High Blood Pressure') || conditions.has('Heart Disease') || conditions.has('Erectile Dysfunction')) bump('chest');
  if (conditions.has('High Cholesterol / Fatty Liver')) bump('liver');
  if (conditions.has('Thyroid (Hypo/Hyper)')) bump('neck');
  if (conditions.has('Kidney Disease')) bump('kidneys');
  if (conditions.has('Joint Pain / Arthritis') || conditions.has('Uric Acid / Gout')) bump('joints');
  if (conditions.has('Neuropathy (Nerve Pain/Tingling)')) { bump('hands'); bump('feet'); }
  if (conditions.has('Digestive / IBS')) bump('digestion');
  if (conditions.has('Chronic Fatigue') || conditions.has('Sleep Apnea / Sleep Issues')) bump('head');
  if (conditions.has('Diabetic Retinopathy') || conditions.has('PCOS / PCOD')) bump('head', 12);

  organSymptoms.forEach((s) => {
    if (s.includes('Tingling')) { bump('hands'); bump('feet'); }
    if (s.includes('Blurry vision')) bump('head');
    if (s.includes('Swelling')) bump('feet');
    if (s.includes('Chest pain')) bump('chest');
    if (s.includes('Joint pain')) bump('joints');
    if (s.includes('Headaches')) bump('head');
  });

  digestiveSymptoms.forEach((s) => { if (s && s !== 'None') bump('digestion'); });

  const entries = (Object.keys(scores) as ZoneId[])
    .map((id) => ({ id, score: scores[id]!, ...ZONE_LAYOUT[id] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return entries;
}

/** A simple, elegant humanoid silhouette (plain shapes, not a photo-real
 *  illustration) with the user's own flagged areas glowing and pulsing on
 *  top of it — built entirely from what they answered in onboarding. */
export const BodyPainMap: React.FC<BodyPainMapProps> = ({ profile }) => {
  const hotspots = useMemo(() => computeHotspots(profile), [profile]);

  if (hotspots.length === 0) return null;

  return (
    <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-zinc-950 to-zinc-900 text-white space-y-5 text-left overflow-hidden relative">
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <h3 className="text-base sm:text-lg font-black tracking-tight">Your Personalized Body Map</h3>
        <p className="text-xs text-zinc-400 mt-0.5">Based on what you told us during setup — this is what your reversal plan focuses on first.</p>
      </div>

      <div className="relative mx-auto" style={{ width: 'min(220px, 55vw)', aspectRatio: '3 / 6' }}>
        {/* The silhouette itself */}
        <div className="absolute inset-0">
          {/* Head */}
          <div className="absolute rounded-full bg-white/10 border border-white/15" style={{ top: '0%', left: '50%', width: '22%', height: '11%', transform: 'translateX(-50%)' }} />
          {/* Neck */}
          <div className="absolute bg-white/10" style={{ top: '10%', left: '50%', width: '10%', height: '4%', transform: 'translateX(-50%)' }} />
          {/* Torso */}
          <div className="absolute rounded-3xl bg-white/10 border border-white/15" style={{ top: '13%', left: '50%', width: '46%', height: '35%', transform: 'translateX(-50%)' }} />
          {/* Left arm */}
          <div className="absolute rounded-full bg-white/10 border border-white/15" style={{ top: '15%', left: '17%', width: '11%', height: '38%', transform: 'translateX(-50%) rotate(4deg)' }} />
          {/* Right arm */}
          <div className="absolute rounded-full bg-white/10 border border-white/15" style={{ top: '15%', left: '83%', width: '11%', height: '38%', transform: 'translateX(-50%) rotate(-4deg)' }} />
          {/* Left leg */}
          <div className="absolute rounded-full bg-white/10 border border-white/15" style={{ top: '47%', left: '38%', width: '14%', height: '50%', transform: 'translateX(-50%)' }} />
          {/* Right leg */}
          <div className="absolute rounded-full bg-white/10 border border-white/15" style={{ top: '47%', left: '62%', width: '14%', height: '50%', transform: 'translateX(-50%)' }} />
        </div>

        {/* Flagged zones — pulsing glow + a connecting line out to the label */}
        {hotspots.map((zone, i) => {
          const intensity = zone.score >= 70 ? 'high' : zone.score >= 45 ? 'moderate' : 'mild';
          const color = intensity === 'high' ? '#f43f5e' : intensity === 'moderate' ? '#f97316' : '#eab308';
          const labelOffset = zone.side === 'left' ? { right: 'calc(100% + 8px)' } : { left: 'calc(100% + 8px)' };
          return (
            <div key={zone.id} className="absolute" style={{ top: zone.top, left: zone.left, transform: 'translate(-50%, -50%)' }}>
              <motion.div
                className="absolute rounded-full"
                style={{ width: 26, height: 26, left: -13, top: -13, backgroundColor: color, opacity: 0.35 }}
                animate={{ scale: [0.9, 1.4, 0.9], opacity: [0.35, 0.1, 0.35] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
              />
              <div className="relative w-2.5 h-2.5 rounded-full shadow-md" style={{ backgroundColor: color }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap flex flex-col"
                style={{ ...labelOffset, alignItems: zone.side === 'left' ? 'flex-end' : 'flex-start' }}
              >
                <span className="text-[10px] font-black uppercase tracking-wide text-white">{zone.label}</span>
                <span className="text-[10px] font-bold" style={{ color }}>{zone.score}% focus</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="relative text-[11px] text-zinc-500 text-center leading-relaxed">
        These are the areas your daily plan targets most — not a diagnosis, just where your reversal plan starts.
      </p>
    </div>
  );
};

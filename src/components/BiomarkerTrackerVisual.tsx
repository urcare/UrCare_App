import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Pencil, Check, X, ScanLine, TrendingUp } from 'lucide-react';
import { UserHealthProfile, MedicalReportAnalysis } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useBiomarkerVitals, VitalStatus, VITAL_STATUS_LABEL } from '../hooks/useBiomarkerVitals';
import { RadialGauge } from './RadialGauge';

// ---------------------------------------------------------------------------
// BIOMARKER TRACKER (Tracker module presentation) — a deliberately different,
// chart-first, colorful look from the Profile page's flat card list (see
// BiomarkerTracker.tsx): a multi-color distribution donut up top, then every
// vital as its own radial gauge with a gradient-filled ring instead of a
// left-accent row + linear meter. Both surfaces share the exact same
// useBiomarkerVitals data/edit hook, so this is a different presentation of
// the same live, automatic data — never a second, divergent copy of it.
// ---------------------------------------------------------------------------

/** Vivid two-stop gradient per status — reused by every ring/pill/badge on
 *  this screen so the whole card reads as one consistent color language. */
const STATUS_GRADIENT: Record<VitalStatus, [string, string]> = {
  good: ['#34d399', '#059669'],
  attention: ['#fbbf24', '#d97706'],
  high: ['#fb7185', '#e11d48'],
  unknown: ['#d4d4d8', '#a1a1aa'],
};
const STATUS_CARD_BG: Record<VitalStatus, string> = {
  good: 'from-emerald-50 via-teal-50/60 to-white border-emerald-200/80',
  attention: 'from-amber-50 via-orange-50/50 to-white border-amber-200/80',
  high: 'from-rose-50 via-red-50/50 to-white border-rose-200/80',
  unknown: 'from-zinc-50 via-zinc-50/60 to-white border-zinc-200',
};
/** Zone-position fill (not the metric's exact value — each has its own
 *  scale/units) so the ring reads by "which zone" the same honest way the
 *  Profile page's linear meter does. */
const STATUS_PCT: Record<VitalStatus, number> = { good: 30, attention: 62, high: 92, unknown: 0 };

/** A multi-color donut summarizing all tracked vitals at a glance — how
 *  many are Normal/Needs Attention/High/Not Tracked, as one proportional
 *  ring instead of a plain count list. */
function DistributionDonut({ counts, total, tr }: { counts: Record<VitalStatus, number>; total: number; tr: (en: string, hi: string) => string }) {
  const size = 108;
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const order: VitalStatus[] = ['good', 'attention', 'high', 'unknown'];
  let cumulative = 0;
  const trackedCount = total - counts.unknown;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-zinc-900/[0.05]" strokeWidth={strokeWidth} />
        {order.map((status) => {
          const count = counts[status];
          if (count === 0) return null;
          const [from, to] = STATUS_GRADIENT[status];
          const dash = (count / total) * c;
          const gapDash = Math.max(0, dash - 2.5);
          const dashOffset = -cumulative;
          cumulative += dash;
          const gradId = `donut-${status}`;
          return (
            <React.Fragment key={status}>
              <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={from} />
                  <stop offset="100%" stopColor={to} />
                </linearGradient>
              </defs>
              <motion.circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${gapDash} ${c - gapDash}`}
                initial={{ strokeDashoffset: 0, opacity: 0 }}
                animate={{ strokeDashoffset: dashOffset, opacity: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
              />
            </React.Fragment>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-zinc-950 leading-none">{trackedCount}<span className="text-zinc-400">/{total}</span></span>
        <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400 mt-0.5">{tr('Tracked', 'ट्रैक')}</span>
      </div>
    </div>
  );
}

interface BiomarkerTrackerVisualProps {
  profile: UserHealthProfile;
  reports: MedicalReportAnalysis[];
  onUpdateProfile: (updated: UserHealthProfile) => void;
  className?: string;
}

export const BiomarkerTrackerVisual: React.FC<BiomarkerTrackerVisualProps> = ({ profile, reports, onUpdateProfile, className }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const {
    vitals, editingVital, editValue, setEditValue, isSavingVital,
    startEditVital, cancelEdit, handleSaveVital,
  } = useBiomarkerVitals(profile, reports, onUpdateProfile, tr);

  const counts = useMemo(() => {
    const out: Record<VitalStatus, number> = { good: 0, attention: 0, high: 0, unknown: 0 };
    vitals.forEach((v) => { out[v.status] += 1; });
    return out;
  }, [vitals]);

  return (
    <div className={className ?? 'p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-white via-fuchsia-50/20 to-sky-50/30 border border-zinc-200 shadow-sm space-y-5 overflow-hidden relative'}>

      {/* Decorative colorful glow blobs — purely visual, keeps this card
          reading as distinctly its own thing vs. the Profile page's flat
          white card. */}
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-fuchsia-300/25 to-transparent blur-2xl pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-gradient-to-tr from-sky-300/25 to-transparent blur-2xl pointer-events-none" aria-hidden="true" />

      {/* HEADER — gradient badge + distribution donut, replacing the plain
          icon + dot-legend header used on the Profile page. */}
      <div className="relative flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <motion.span
            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30"
            initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-zinc-950 tracking-tight">
              {tr('Biomarker Tracker', 'बायोमार्कर ट्रैकर')}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-semibold">
              {tr('Auto-tracked from your profile & lab reports', 'आपकी प्रोफाइल व लैब रिपोर्ट से ऑटो-ट्रैक')}
            </p>
          </div>
        </div>
        <DistributionDonut counts={counts} total={vitals.length} tr={tr} />
      </div>

      {/* Colorful legend strip — vivid gradient pills instead of plain dots. */}
      <div className="relative flex flex-wrap items-center gap-1.5">
        {(['good', 'attention', 'high', 'unknown'] as VitalStatus[]).map((status) => (
          <span
            key={status}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${STATUS_GRADIENT[status][0]}, ${STATUS_GRADIENT[status][1]})` }}
          >
            {counts[status]} {tr(...VITAL_STATUS_LABEL[status])}
          </span>
        ))}
      </div>

      {/* GAUGE GRID — every vital as its own radial gauge card, instead of
          the Profile page's left-accent rows. */}
      <motion.div
        className="relative grid grid-cols-2 sm:grid-cols-3 gap-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      >
        {vitals.map((v, idx) => {
          const VitalIcon = v.icon;
          const isEditing = editingVital === v.key;
          const isEditable = !!v.ddKey;
          const pct = STATUS_PCT[v.status];
          const [from] = STATUS_GRADIENT[v.status];

          return (
            <motion.div
              key={v.key}
              variants={{ hidden: { opacity: 0, y: 14, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
              whileHover={{ y: -3, boxShadow: '0 14px 28px -14px rgba(0,0,0,0.22)' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`relative p-3.5 rounded-2xl border bg-gradient-to-b ${STATUS_CARD_BG[v.status]} flex flex-col items-center text-center gap-2 overflow-hidden`}
            >
              {v.status === 'high' && (
                <motion.span
                  className="absolute inset-0 rounded-2xl ring-2 ring-rose-400/60 pointer-events-none"
                  animate={{ opacity: [0.6, 0.15, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              <div className="flex items-center gap-1.5 w-full">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${STATUS_GRADIENT[v.status][0]}, ${STATUS_GRADIENT[v.status][1]})` }}
                >
                  <VitalIcon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[10.5px] font-black text-zinc-800 truncate flex-1 text-left leading-tight">{v.label}</span>
              </div>

              {!isEditing ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <RadialGauge pct={pct} colorFrom={STATUS_GRADIENT[v.status][0]} colorTo={STATUS_GRADIENT[v.status][1]} gradId={`gauge-${v.key}-${idx}`} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
                      <span
                        className={`font-black text-center break-words ${v.value ? 'text-zinc-900' : 'text-zinc-400'} ${
                          (v.value?.length ?? 0) > 10 ? 'text-[9px] leading-[1.15]' : 'text-[13px] leading-tight'
                        }`}
                      >
                        {v.value || '—'}
                      </span>
                    </div>
                  </div>

                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wide text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${STATUS_GRADIENT[v.status][0]}, ${STATUS_GRADIENT[v.status][1]})` }}
                  >
                    {tr(...VITAL_STATUS_LABEL[v.status])}
                  </span>

                  <p className="text-[8.5px] text-zinc-400 font-medium leading-snug">{v.hint}</p>

                  {v.source === 'report' && (
                    <div className="flex items-center gap-1 text-[8px] font-bold text-violet-600 truncate w-full justify-center">
                      <ScanLine className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{tr('From report', 'रिपोर्ट से')}</span>
                    </div>
                  )}

                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => startEditVital(v.key, v.rawValue)}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide cursor-pointer mt-0.5"
                      style={{ color: from }}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>{v.source === 'report' ? tr('Confirm/Edit', 'पुष्टि/संपादन') : v.value ? tr('Edit', 'संपादित') : tr('Add', 'जोड़ें')}</span>
                    </button>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="w-full space-y-1.5 py-1"
                >
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVital(v.ddKey, v.label); if (e.key === 'Escape') cancelEdit(); }}
                    placeholder={v.placeholder}
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800 text-center focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      disabled={isSavingVital}
                      onClick={() => handleSaveVital(v.ddKey, v.label)}
                      className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white cursor-pointer disabled:opacity-50 shadow-sm"
                      title={tr('Save', 'सहेजें')}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 rounded-lg bg-zinc-200 text-zinc-500 cursor-pointer"
                      title={tr('Cancel', 'रद्द करें')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <p className="relative text-[10px] text-zinc-400 leading-relaxed flex items-start gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-fuchsia-400 shrink-0 mt-px" />
        {tr('Auto-filled from your Root Cause Assessment or latest lab report where available — tap any gauge to confirm or edit it yourself. Saved changes update everywhere this number is used.', 'जहां उपलब्ध हो वहां आपके रूट कॉज़ असेसमेंट या नवीनतम लैब रिपोर्ट से भरा गया — किसी भी गेज को पुष्टि या संपादित करने के लिए टैप करें। सहेजे गए बदलाव हर जगह अपडेट होंगे जहां यह नंबर उपयोग होता है।')}
      </p>
    </div>
  );
};

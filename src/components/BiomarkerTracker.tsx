import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HeartPulse, Pencil, Check, X, ScanLine } from 'lucide-react';
import { UserHealthProfile, MedicalReportAnalysis } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useBiomarkerVitals, VitalStatus, VITAL_STATUS_COLOR, VITAL_STATUS_LABEL } from '../hooks/useBiomarkerVitals';

// ---------------------------------------------------------------------------
// BIOMARKER TRACKER (Profile page presentation) — the original card-list
// look: a flat grid of left-accent-bordered rows with a small 3-band meter.
// The Tracker module deliberately uses a different, more colorful,
// gauge-based presentation instead (see BiomarkerTrackerVisual.tsx) — both
// are powered by the same useBiomarkerVitals data/edit hook, so neither is
// a second, divergent copy of the underlying logic.
// ---------------------------------------------------------------------------

/** Small three-band good/attention/high meter with an animated marker —
 *  positioned by status rather than the metric's exact value (each vital
 *  has its own scale/units, so one shared meter reads by "which zone"
 *  rather than claiming false precision). Hidden entirely when there's
 *  nothing to show a position for. */
function VitalStatusMeter({ status }: { status: VitalStatus }) {
  if (status === 'unknown') return null;
  const pct = status === 'good' ? 16 : status === 'attention' ? 50 : 84;
  return (
    <div className="relative h-1.5 rounded-full overflow-hidden flex">
      <div className="h-full bg-emerald-400" style={{ width: '33.33%' }} />
      <div className="h-full bg-amber-300" style={{ width: '33.33%' }} />
      <div className="h-full bg-rose-400" style={{ width: '33.34%' }} />
      <motion.div
        className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-zinc-950 ring-2 ring-white shadow"
        style={{ y: '-50%' }}
        initial={{ left: '0%', opacity: 0 }}
        animate={{ left: `${pct}%`, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
      />
    </div>
  );
}

interface BiomarkerTrackerProps {
  profile: UserHealthProfile;
  reports: MedicalReportAnalysis[];
  onUpdateProfile: (updated: UserHealthProfile) => void;
  /** Shown as the card's own title — lets the Tracker module and the
   *  Profile page each caption it in their own voice without duplicating
   *  the rest of the component. Defaults to the original Profile-page copy. */
  title?: string;
  /** Wrapper classes — override to drop the card chrome when embedding
   *  inside another card that already has its own border/shadow. */
  className?: string;
}

/** The automatic biomarker tracker: every value below either comes
 *  straight from the user's own Root Cause Assessment answers or is
 *  auto-matched from their most recently uploaded lab report — nothing is
 *  entered by hand unless the user explicitly edits a card. Editing writes
 *  straight back into profile.healthDeepDive, so it's instantly the value
 *  every other module (onboarding, the assessment, reports) sees too. */
export const BiomarkerTracker: React.FC<BiomarkerTrackerProps> = ({ profile, reports, onUpdateProfile, title, className }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const {
    vitals, editingVital, editValue, setEditValue, isSavingVital,
    startEditVital, cancelEdit, handleSaveVital,
  } = useBiomarkerVitals(profile, reports, onUpdateProfile, tr);

  return (
    <div className={className ?? 'p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200 shadow-xs space-y-4'}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <motion.span
            className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <HeartPulse className="w-4.5 h-4.5" />
          </motion.span>
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
            {title ?? tr('Biomarker Tracker', 'बायोमार्कर ट्रैकर')}
          </h3>
        </div>
        <div className="flex items-center gap-2.5 text-[9px] font-bold text-zinc-400 shrink-0">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: VITAL_STATUS_COLOR.good }} />{tr(...VITAL_STATUS_LABEL.good)}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: VITAL_STATUS_COLOR.attention }} />{tr(...VITAL_STATUS_LABEL.attention)}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: VITAL_STATUS_COLOR.high }} />{tr(...VITAL_STATUS_LABEL.high)}</span>
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {vitals.map((v) => {
          const color = VITAL_STATUS_COLOR[v.status];
          const VitalIcon = v.icon;
          const isEditing = editingVital === v.key;
          const isEditable = !!v.ddKey;
          const isHigh = v.status === 'high';
          return (
            <motion.div
              key={v.key}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -2, boxShadow: '0 6px 16px -8px rgba(0,0,0,0.18)' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="p-3 rounded-2xl space-y-2 border-l-[3px]"
              style={{ background: `${color}0c`, borderColor: `${color}55`, borderLeftColor: color }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <motion.span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${color}1a`, color }}
                    animate={isHigh ? { scale: [1, 1.1, 1] } : {}}
                    transition={isHigh ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
                  >
                    <VitalIcon className="w-4 h-4" />
                  </motion.span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-800 truncate">{v.label}</div>
                    <div className="text-[9px] text-zinc-400 font-medium truncate">{v.hint}</div>
                  </div>
                </div>

                {!isEditing && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${v.status}-${v.value}`}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.25 }}
                      className="text-right shrink-0"
                    >
                      <div className={`text-xs sm:text-sm font-black ${v.value ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        {v.value || tr('Not tracked', 'ट्रैक नहीं')}
                      </div>
                      <span
                        className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide"
                        style={{ background: `${color}1a`, color }}
                      >
                        {tr(...VITAL_STATUS_LABEL[v.status])}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {!isEditing && <VitalStatusMeter status={v.status} />}

              {/* Source tag — tells the user where this number came from,
                  and lets them tell a report-sourced value apart from
                  one they (or onboarding) confirmed themselves. */}
              {!isEditing && v.source === 'report' && (
                <div className="flex items-center gap-1 text-[9px] font-bold text-violet-600">
                  <ScanLine className="w-3 h-3 shrink-0" />
                  <span className="truncate">{tr('From report:', 'रिपोर्ट से:')} {v.sourceReportName}</span>
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {isEditable && !isEditing && (
                  <motion.button
                    key="view"
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => startEditVital(v.key, v.rawValue)}
                    className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    <span>{v.source === 'report' ? tr('Confirm or edit', 'पुष्टि करें या संपादित करें') : v.value ? tr('Edit', 'संपादित करें') : tr('Add manually', 'खुद जोड़ें')}</span>
                  </motion.button>
                )}

                {isEditable && isEditing && (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5 overflow-hidden"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVital(v.ddKey, v.label); if (e.key === 'Escape') cancelEdit(); }}
                      placeholder={v.placeholder}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-800 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={isSavingVital}
                      onClick={() => handleSaveVital(v.ddKey, v.label)}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer disabled:opacity-50"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      <p className="text-[10px] text-zinc-400 leading-relaxed">
        {tr('Auto-filled from your Root Cause Assessment or latest lab report where available — tap any card to confirm or edit it yourself. Saved changes update everywhere this number is used.', 'जहां उपलब्ध हो वहां आपके रूट कॉज़ असेसमेंट या नवीनतम लैब रिपोर्ट से भरा गया — किसी भी कार्ड को पुष्टि या संपादित करने के लिए टैप करें। सहेजे गए बदलाव हर जगह अपडेट होंगे जहां यह नंबर उपयोग होता है।')}
      </p>
    </div>
  );
};

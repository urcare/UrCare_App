import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lottie as DotLottieReact } from './Lottie';
import { X, ChevronRight, ChevronDown, Search, Wrench, Target, CalendarCheck, ShieldCheck, ClipboardList, Sparkles } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { computeHealthOverview } from './HealthOverviewCard';
import { ROOT_CAUSES, GENERAL_ROOT_CAUSE, THREE_MONTHS, RootCauseInfo } from './rootCauseLibrary';

interface RootCausesCardProps {
  profile: UserHealthProfile;
  tr: (en: string, hi: string) => string;
  onOpenAssessment: () => void;
  onOpenPlan: () => void;
}

const appear = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.45, delay: Math.min(i, 6) * 0.07, ease: 'easeOut' as const },
});

/** Home → "Your Root Causes": what is behind the person's conditions, how
 *  the UrCare reversal treatment works on each, their own triggers from the
 *  assessment, the 3-month journey and a nudge to the assessment. */
export const RootCausesCard: React.FC<RootCausesCardProps> = ({ profile, tr, onOpenAssessment, onOpenPlan }) => {
  const [open, setOpen] = useState(false);
  const conditions = useMemo(() => (profile.medicalConditions || []).filter((c) => ROOT_CAUSES[c]), [profile.medicalConditions]);
  const items: RootCauseInfo[] = conditions.length ? conditions.map((c) => ROOT_CAUSES[c]) : [GENERAL_ROOT_CAUSE];
  const triggers = useMemo(() => computeHealthOverview(profile)?.factors.slice(0, 6) || [], [profile]);
  const hasAssessment = !!profile.assessmentData;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }}
        whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
        className="home-rootcause relative w-full overflow-hidden rounded-[1.75rem] bg-brand-gradient text-white text-left p-5 sm:p-6 shadow-depth cursor-pointer"
      >
        <span className="rc-orb rc-orb-a" aria-hidden="true" />
        <span className="rc-orb rc-orb-b" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-black uppercase tracking-wider"><Search className="w-3 h-3" />{tr('Your Root Causes', 'आपकी बीमारी की जड़')}</span>
            <h2 className="mt-2 font-display text-xl sm:text-2xl font-black leading-tight">{tr('Why is this happening to you?', 'आपको ये सब क्यों हो रहा है?')}</h2>
            <p className="mt-1 text-xs sm:text-sm text-white/85">{tr('See the real causes behind your conditions — and how UrCare reverses them.', 'अपनी बीमारियों की असली वजह देखें — और UrCare इन्हें कैसे ठीक करता है।')}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {items.slice(0, 4).map((it, i) => (
                <motion.span key={it.name[0]} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 + i * 0.08 }}
                  className="px-2.5 py-1 rounded-full bg-white/90 text-emerald-900 text-[11px] font-black">{it.emoji} {tr(...it.name)}</motion.span>
              ))}
              {items.length > 4 && <span className="px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-black">+{items.length - 4}</span>}
            </div>
          </div>
          <div className="hidden xs:block w-24 h-24 sm:w-28 sm:h-28 shrink-0">
            <DotLottieReact src="/lottie/exercise/meditate-chakra.lottie" autoplay loop style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
        <span className="relative mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-emerald-800 text-xs font-black shadow">
          {tr('Open my root causes', 'मेरी बीमारी की जड़ खोलें')}<ChevronRight className="w-4 h-4" />
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-2xl max-h-[95vh] bg-[#f6fbf7] rounded-t-[1.75rem] sm:rounded-[1.75rem] shadow-2xl overflow-y-auto text-left"
            >
              {/* Header */}
              <div className="relative bg-brand-gradient text-white px-5 pt-6 pb-7 overflow-hidden">
                <span className="rc-orb rc-orb-a" aria-hidden="true" />
                <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer" aria-label={tr('Close', 'बंद करें')}><X className="w-4 h-4" /></button>
                <motion.div {...appear(0)} className="relative">
                  <div className="text-[11px] font-black uppercase tracking-wider text-white/80">{tr('Your Root Causes', 'आपकी बीमारी की जड़')}</div>
                  <h2 className="mt-1 font-display text-2xl sm:text-3xl font-black leading-tight pr-10">{tr('Treat the cause, not just the numbers', 'सिर्फ़ नंबर नहीं, बीमारी की जड़ का इलाज')}</h2>
                  <p className="mt-2 text-sm text-white/85 max-w-lg">{tr('Most lifestyle diseases grow from the same few roots. Fix the roots, and the body starts healing itself.', 'ज़्यादातर लाइफ़स्टाइल बीमारियां कुछ ही जड़ों से बढ़ती हैं। जड़ ठीक करें, और शरीर खुद ठीक होने लगता है।')}</p>
                </motion.div>
                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  {items.map((it, i) => (
                    <motion.span key={it.name[0]} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.25 + i * 0.08, type: 'spring', stiffness: 260, damping: 18 }}
                      className="px-3 py-1.5 rounded-full bg-white text-emerald-900 text-xs font-black shadow-sm">{it.emoji} {tr(...it.name)}</motion.span>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-5">
                {/* Per condition */}
                {items.map((it, i) => <ConditionBlock key={it.name[0]} info={it} index={i} startOpen={i === 0} tr={tr} />)}

                {/* Personal triggers */}
                <motion.section {...appear(1)} className="rounded-2xl bg-white border border-amber-100 p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-black text-zinc-900"><Target className="w-4 h-4 text-amber-600" />{tr('Your own triggers', 'आपके अपने ट्रिगर')}</h3>
                  {triggers.length ? (
                    <>
                      <p className="mt-1 text-[11px] text-zinc-500">{tr('From your Root Cause Assessment — these push your health down the most:', 'आपके रूट कॉज़ असेसमेंट से — ये आपकी सेहत को सबसे ज़्यादा नुकसान पहुंचा रहे हैं:')}</p>
                      <ul className="mt-3 space-y-2">
                        {triggers.map((f, j) => (
                          <motion.li key={f.label[0]} {...appear(j)} className="flex items-center gap-3">
                            <span className="flex-1 text-[13px] font-bold text-zinc-800">{tr(...f.label)}</span>
                            <span className="w-24 h-2 rounded-full bg-zinc-100 overflow-hidden">
                              <motion.span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, f.points * 6.5)}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.1 * j }} />
                            </span>
                          </motion.li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-600">{tr('Complete your Root Cause Assessment to see exactly what is driving your health — sugar, weight, BP, sleep, stress, food and activity.', 'अपना रूट कॉज़ असेसमेंट पूरा करें और देखें कि आपकी सेहत को असल में क्या बिगाड़ रहा है — शुगर, वज़न, BP, नींद, तनाव, खाना और सक्रियता।')}</p>
                  )}
                </motion.section>

                {/* 3 months */}
                <motion.section {...appear(2)} className="rounded-2xl bg-white border border-emerald-100 p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-black text-zinc-900"><CalendarCheck className="w-4 h-4 text-emerald-600" />{tr('Your 3-month reversal journey', 'आपका 3 महीने का रिवर्सल सफ़र')}</h3>
                  <ol className="mt-4 relative">
                    <span className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-emerald-100" aria-hidden="true" />
                    {THREE_MONTHS.map((m, j) => (
                      <motion.li key={m.title[0]} {...appear(j + 1)} className="relative flex gap-3 pb-4 last:pb-0">
                        <span className="relative z-10 w-8 h-8 shrink-0 rounded-full bg-brand-gradient text-white text-xs font-black flex items-center justify-center shadow">{j + 1}</span>
                        <div className="pt-0.5">
                          <div className="text-[13px] font-black text-emerald-800">{tr(...m.title)}</div>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-600">{tr(...m.text)}</p>
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                </motion.section>

                {/* The promise */}
                <motion.section {...appear(3)} className="relative overflow-hidden rounded-[1.5rem] bg-brand-gradient text-white p-5 text-center shadow-lg">
                  <span className="rc-orb rc-orb-b" aria-hidden="true" />
                  <div className="relative mx-auto w-28 h-28 -mt-2">
                    <DotLottieReact src="/lottie/buddy-cheer.lottie" autoplay loop style={{ width: '100%', height: '100%' }} />
                  </div>
                  <h3 className="relative font-display text-xl sm:text-2xl font-black leading-snug">{tr('Follow your UrCare Reversal Treatment', 'अपना UrCare रिवर्सल ट्रीटमेंट फ़ॉलो करें')}</h3>
                  <p className="relative mt-2 text-sm text-white/90 leading-relaxed max-w-md mx-auto">
                    {tr('With complete trust and consistency for 3 months — one day at a time — and see the results in your own reports.', 'पूरे भरोसे और लगातार 3 महीने तक — एक-एक दिन करके — और नतीजे अपनी ही रिपोर्ट में देखें।')}
                  </p>
                  <div className="relative mt-3 flex flex-wrap justify-center gap-1.5 text-[11px] font-black">
                    {[[tr('Trust', 'भरोसा'), '🤝'], [tr('Consistency', 'निरंतरता'), '📅'], [tr('3 months', '3 महीने'), '🏆']].map(([t, e]) => (
                      <span key={t} className="px-3 py-1 rounded-full bg-white/15 border border-white/25">{e} {t}</span>
                    ))}
                  </div>
                  <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => { setOpen(false); onOpenAssessment(); }} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-emerald-800 text-sm font-black shadow cursor-pointer active:scale-[0.98] transition">
                      <ClipboardList className="w-4 h-4" />{hasAssessment ? tr('Update my assessment', 'मेरा असेसमेंट अपडेट करें') : tr('Start my assessment', 'मेरा असेसमेंट शुरू करें')}
                    </button>
                    <button type="button" onClick={() => { setOpen(false); onOpenPlan(); }} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/15 border border-white/30 text-white text-sm font-black cursor-pointer active:scale-[0.98] transition">
                      <Sparkles className="w-4 h-4" />{tr("Open today's plan", 'आज का प्लान खोलें')}
                    </button>
                  </div>
                </motion.section>

                <p className="flex items-start gap-1.5 text-[10px] text-zinc-400 leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {tr('General health education under doctor guidance. Results differ from person to person. Never stop or change your medicines without your doctor.', 'डॉक्टर के मार्गदर्शन में सामान्य स्वास्थ्य जानकारी। नतीजे हर व्यक्ति में अलग होते हैं। डॉक्टर से पूछे बिना दवा बंद या न बदलें।')}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const ConditionBlock: React.FC<{ info: RootCauseInfo; index: number; startOpen: boolean; tr: (en: string, hi: string) => string }> = ({ info, index, startOpen, tr }) => {
  const [open, setOpen] = useState(startOpen);
  return (
    <motion.section {...appear(index)} className="rounded-2xl bg-white border border-emerald-100 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left cursor-pointer">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl shrink-0">{info.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-black text-zinc-900">{tr(...info.name)}</span>
          <span className="block text-[11px] font-semibold text-zinc-500">{tr(`${info.causes.length} root causes · how UrCare reverses it`, `${info.causes.length} जड़ें · UrCare इसे कैसे ठीक करता है`)}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-rose-50/70 border border-rose-100 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-700"><Search className="w-3.5 h-3.5" />{tr('Why it happens', 'ये क्यों होता है')}</div>
                <ul className="mt-2 space-y-1.5">
                  {info.causes.map((c, j) => (
                    <motion.li key={j} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * j }} className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />{tr(...c)}
                    </motion.li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700"><Wrench className="w-3.5 h-3.5" />{tr('How UrCare reverses it', 'UrCare इसे कैसे ठीक करता है')}</div>
                <ul className="mt-2 space-y-1.5">
                  {info.fixes.map((c, j) => (
                    <motion.li key={j} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * j + 0.1 }} className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-700">
                      <span className="mt-0.5 text-emerald-600 font-black shrink-0">✓</span>{tr(...c)}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

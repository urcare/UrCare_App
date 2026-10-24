import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, PenLine, Plus, Trash2, Copy, Loader2, CheckCircle2, Lock, FileText, Activity, Pill, Utensils, Moon } from 'lucide-react';
import { createOwnPlan, getAiPlanStatus, UploadedPlan } from '../utils/supabase';

type Row = { time: string; title: string; body: string };

interface CreatePlanPageProps {
  isOpen: boolean;
  onClose: () => void;
  tr: (en: string, hi: string) => string;
  language: string;
  dependentId?: string | null;
  /** True when the person already has their own plan (it gets replaced). */
  hasOwnPlan: boolean;
  /** Today's UrCare plan, to start a manual plan from. */
  starterSections: { timeLabel?: string | null; title: string; body?: string }[];
  onCreated: (plan: UploadedPlan) => void;
}

// "6:30 AM" <-> "06:30" for the time inputs.
function toInputTime(label?: string | null): string {
  const m = String(label || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3]?.toUpperCase() === 'PM') h += 12;
  if (!m[3] && Number(m[1]) >= 12) h = Number(m[1]);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
function toLabel(value: string): string {
  const m = value.match(/^(\d{2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const EMPTY_ROWS: Row[] = [
  { time: '06:30', title: '', body: '' },
  { time: '08:30', title: '', body: '' },
  { time: '13:00', title: '', body: '' },
];

const AI_STEPS: [string, string][] = [
  ['Reading your profile and conditions…', 'आपकी प्रोफ़ाइल और बीमारियां पढ़ रहे हैं…'],
  ['Checking your lab reports, sugar and BP…', 'आपकी लैब रिपोर्ट, शुगर और BP देख रहे हैं…'],
  ['Planning your meals…', 'आपका खाना प्लान कर रहे हैं…'],
  ['Adding exercise, sleep and habits…', 'एक्सरसाइज़, नींद और आदतें जोड़ रहे हैं…'],
  ['Almost ready…', 'लगभग तैयार…'],
];

/** Plan → "+": build your own daily plan, by hand or once with UrCare AI. */
export const CreatePlanPage: React.FC<CreatePlanPageProps> = ({ isOpen, onClose, tr, language, dependentId, hasOwnPlan, starterSections, onCreated }) => {
  const [tab, setTab] = useState<'ai' | 'manual'>('ai');
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [wishes, setWishes] = useState('');
  const [rows, setRows] = useState<Row[]>(EMPTY_ROWS);
  const [working, setWorking] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    getAiPlanStatus().then(({ used, available }) => {
      setAiUsed(used);
      setAiAvailable(available);
      if (used) setTab('manual');
    });
  }, [isOpen]);

  useEffect(() => {
    if (!working || tab !== 'ai') return;
    setAiStep(0);
    const id = setInterval(() => setAiStep((n) => Math.min(n + 1, AI_STEPS.length - 1)), 3500);
    return () => clearInterval(id);
  }, [working, tab]);

  const createWithAi = async () => {
    setWorking(true); setError('');
    const { customPlan, error: err, used } = await createOwnPlan({ mode: 'ai', wishes: wishes.trim() || undefined, language }, dependentId);
    setWorking(false);
    if (used) setAiUsed(true);
    if (err || !customPlan) { setError(err || tr('Could not create your plan.', 'प्लान नहीं बन सका।')); return; }
    setAiUsed(true);
    onCreated(customPlan);
  };

  const saveManual = async () => {
    const sections = rows.filter((r) => r.title.trim()).map((r) => ({ timeLabel: toLabel(r.time), title: r.title.trim(), body: r.body.trim() }));
    if (!sections.length) { setError(tr('Add at least one step with a title.', 'कम से कम एक स्टेप का नाम लिखें।')); return; }
    setWorking(true); setError('');
    const { customPlan, error: err } = await createOwnPlan({ mode: 'manual', sections }, dependentId);
    setWorking(false);
    if (err || !customPlan) { setError(err || tr('Could not save your plan.', 'प्लान सेव नहीं हुआ।')); return; }
    onCreated(customPlan);
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const copyUrCare = () => {
    const list = starterSections.filter((s) => s.title).slice(0, 40).map((s) => ({ time: toInputTime(s.timeLabel), title: s.title, body: s.body || '' }));
    if (list.length) setRows(list);
  };

  const USES: { icon: React.ComponentType<{ className?: string }>; label: [string, string] }[] = [
    { icon: FileText, label: ['Lab reports', 'लैब रिपोर्ट'] },
    { icon: Activity, label: ['Sugar & BP', 'शुगर व BP'] },
    { icon: Pill, label: ['Conditions & medicines', 'बीमारियां व दवाएं'] },
    { icon: Utensils, label: ['Diet & routine', 'खाना व दिनचर्या'] },
    { icon: Moon, label: ['Sleep & stress', 'नींद व तनाव'] },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !working && onClose()}>
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl max-h-[94vh] bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] shadow-2xl flex flex-col overflow-hidden text-left"
          >
            {/* Header */}
            <div className="bg-brand-gradient text-white px-5 pt-5 pb-4 shrink-0 relative">
              <button type="button" onClick={onClose} disabled={working} className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer disabled:opacity-40" aria-label={tr('Close', 'बंद करें')}>
                <X className="w-4 h-4" />
              </button>
              <div className="text-[11px] font-black uppercase tracking-wider text-white/80">{tr('My own plan', 'मेरा अपना प्लान')}</div>
              <h2 className="mt-1 font-display text-2xl font-black leading-tight pr-10">{tr('Create your daily plan', 'अपना डेली प्लान बनाएं')}</h2>
              <p className="mt-1 text-xs text-white/85">{tr('Let UrCare AI build it from your data, or write it yourself.', 'UrCare AI से अपने डेटा के हिसाब से बनवाएं, या खुद लिखें।')}</p>
              <div className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/15">
                {(['ai', 'manual'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => !working && setTab(k)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition ${tab === k ? 'bg-white text-emerald-800 shadow' : 'text-white/90'}`}>
                    {k === 'ai' ? <Sparkles className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />}
                    {k === 'ai' ? tr('With UrCare AI', 'UrCare AI से') : tr('Write it myself', 'खुद लिखूं')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {hasOwnPlan && (
                <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {tr('This will replace your current "My plan".', 'यह आपके अभी के "मेरा प्लान" की जगह ले लेगा।')}
                </p>
              )}

              {tab === 'ai' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="text-sm font-black text-zinc-900">{tr('A complete day, made only for you', 'पूरा दिन, सिर्फ़ आपके लिए')}</div>
                    <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{tr('UrCare AI reads everything in your app and plans your whole day — meals with options, movement, exercise, habits and sleep.', 'UrCare AI आपके ऐप का सारा डेटा पढ़कर पूरा दिन प्लान करता है — खाने के विकल्प, चलना, एक्सरसाइज़, आदतें और नींद।')}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {USES.map(({ icon: Icon, label }) => (
                        <span key={label[0]} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-emerald-100 text-[11px] font-bold text-emerald-800"><Icon className="w-3 h-3" />{tr(...label)}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-700 mb-1.5">{tr('Anything you want in your plan? (optional)', 'प्लान में कुछ ख़ास चाहिए? (ज़रूरी नहीं)')}</label>
                    <textarea rows={3} value={wishes} onChange={(e) => setWishes(e.target.value)} disabled={working || !!aiUsed}
                      placeholder={tr('e.g. I wake at 6 AM, office 10 to 6, vegetarian, I like walking and yoga', 'जैसे: 6 बजे उठता हूं, ऑफिस 10 से 6, शाकाहारी, चलना और योग पसंद है')}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-emerald-600 resize-none disabled:bg-zinc-50" />
                  </div>

                  {working ? (
                    <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-5 flex flex-col items-center text-center gap-3">
                      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                      <AnimatePresence mode="wait">
                        <motion.p key={aiStep} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-sm font-bold text-zinc-700">{tr(...AI_STEPS[aiStep])}</motion.p>
                      </AnimatePresence>
                      <p className="text-[11px] text-zinc-400">{tr('This takes about 20–40 seconds.', 'इसमें लगभग 20–40 सेकंड लगते हैं।')}</p>
                    </div>
                  ) : aiUsed ? (
                    <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 flex gap-3">
                      <Lock className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-600 leading-relaxed">{tr('You have already used your free AI plan. You can edit it from "My plan" in the Plan tab, or write a new plan yourself.', 'आप अपना फ्री AI प्लान इस्तेमाल कर चुके हैं। प्लान टैब में "मेरा प्लान" से उसे बदल सकते हैं, या नया प्लान खुद लिख सकते हैं।')}</p>
                    </div>
                  ) : (
                    <button type="button" onClick={createWithAi} disabled={!aiAvailable || aiUsed === null}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-gradient text-white text-sm font-black shadow-lg shadow-emerald-700/25 cursor-pointer active:scale-[0.98] transition disabled:opacity-50">
                      <Sparkles className="w-4 h-4" />{tr('Create my plan with AI', 'AI से मेरा प्लान बनाएं')}
                      <span className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px]">{tr('1 free use', '1 बार फ्री')}</span>
                    </button>
                  )}
                  {!aiAvailable && !aiUsed && <p className="text-[11px] text-rose-600">{tr('AI is not available right now. You can write your plan yourself.', 'AI अभी उपलब्ध नहीं है। आप प्लान खुद लिख सकते हैं।')}</p>}
                  <p className="text-[10px] text-zinc-400 leading-relaxed">{tr('AI suggestions are general wellness guidance, not a prescription. Never change your medicines without your doctor.', 'AI सुझाव सामान्य सलाह हैं, दवा का पर्चा नहीं। डॉक्टर से पूछे बिना दवा न बदलें।')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button type="button" onClick={copyUrCare} disabled={working || !starterSections.length}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-emerald-300 text-emerald-700 text-xs font-black cursor-pointer hover:bg-emerald-50 disabled:opacity-40">
                    <Copy className="w-3.5 h-3.5" />{tr("Start from today's UrCare plan", 'आज के UrCare प्लान से शुरू करें')}
                  </button>
                  {rows.map((r, i) => (
                    <div key={i} className="rounded-2xl border border-zinc-200 p-3 space-y-2 bg-white shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
                        <input type="time" value={r.time} onChange={(e) => setRow(i, { time: e.target.value })} className="w-28 px-2.5 py-2 rounded-lg border border-zinc-300 text-xs font-bold focus:outline-none focus:border-emerald-600" />
                        <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} placeholder={tr('Step name, e.g. Breakfast', 'स्टेप का नाम, जैसे नाश्ता')} className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-zinc-300 text-sm font-bold focus:outline-none focus:border-emerald-600" />
                        <button type="button" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} disabled={rows.length <= 1} className="w-8 h-8 shrink-0 rounded-lg text-zinc-400 hover:text-rose-500 flex items-center justify-center cursor-pointer disabled:opacity-30" aria-label={tr('Remove step', 'स्टेप हटाएं')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea rows={2} value={r.body} onChange={(e) => setRow(i, { body: e.target.value })} placeholder={tr('Details — what to eat or do (optional)', 'विवरण — क्या खाना या करना है (ज़रूरी नहीं)')} className="w-full px-2.5 py-2 rounded-lg border border-zinc-300 text-xs focus:outline-none focus:border-emerald-600 resize-y" />
                    </div>
                  ))}
                  <button type="button" onClick={() => setRows((prev) => [...prev, { time: '', title: '', body: '' }])} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer">
                    <Plus className="w-4 h-4" />{tr('Add a step', 'स्टेप जोड़ें')}
                  </button>
                </div>
              )}

              {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
            </div>

            {tab === 'manual' && (
              <div className="p-4 border-t border-zinc-100 shrink-0">
                <button type="button" onClick={saveManual} disabled={working}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-gradient text-white text-sm font-black cursor-pointer active:scale-[0.98] transition disabled:opacity-60">
                  {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{tr('Save my plan', 'मेरा प्लान सेव करें')}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

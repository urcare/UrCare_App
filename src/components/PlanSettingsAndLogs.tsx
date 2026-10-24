import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, SlidersHorizontal, CalendarCheck, Utensils, Dumbbell, Loader2, Check } from 'lucide-react';
import { getCachedAccountState, saveAccountState, PlanSettings, DEFAULT_PLAN_SETTINGS } from '../utils/accountState';
import { getDailyPlan, activePlanSections, getTaskCompletion } from '../utils/supabase';
import { categoryFor } from './RecommendationsView';
import { toDateKey } from './DailyCalendar';

export const PLAN_SETTINGS_EVENT = 'urcare:plan-settings-changed';
export const getPlanSettings = (): PlanSettings => ({ ...DEFAULT_PLAN_SETTINGS, ...(getCachedAccountState().planSettings || {}) });

const Sheet: React.FC<{ open: boolean; onClose: () => void; icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }> = ({ open, onClose, icon, title, subtitle, children }) =>
  createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }} className="w-full sm:max-w-md max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden text-left">
              <div className="notif-header flex items-center justify-between px-5 pt-5 pb-4 text-white shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center">{icon}</span>
                  <div>
                    <h2 className="text-lg font-black leading-tight">{title}</h2>
                    <p className="text-[11px] font-semibold text-white/80">{subtitle}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto p-5 space-y-5">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300'}`}>
    {on && <Check className="w-3 h-3" />}{children}
  </button>
);

export const PlanSettingsSheet: React.FC<{ open: boolean; onClose: () => void; tr: (en: string, hi: string) => string }> = ({ open, onClose, tr }) => {
  const [s, setS] = useState<PlanSettings>(getPlanSettings);
  useEffect(() => { if (open) setS(getPlanSettings()); }, [open]);
  const save = () => {
    saveAccountState({ planSettings: s }, { immediate: true });
    window.dispatchEvent(new Event(PLAN_SETTINGS_EVENT));
    onClose();
  };
  const intensities: [PlanSettings['intensity'], string, string, string][] = [
    ['light', '🌿', 'Light', 'हल्का'], ['moderate', '🏃', 'Moderate', 'मध्यम'], ['intense', '🔥', 'Intense', 'तेज़'],
  ];
  const diets: [PlanSettings['diet'], string, string][] = [
    ['any', 'Any', 'कोई भी'], ['vegetarian', 'Vegetarian', 'शाकाहारी'], ['eggetarian', 'Eggetarian', 'अंडा-शाकाहारी'],
    ['vegan', 'Vegan', 'वीगन'], ['jain', 'Jain', 'जैन'], ['non-vegetarian', 'Non-veg', 'मांसाहारी'],
  ];
  const exercises: [string, string, string][] = [
    ['walking', '🚶 Walking', '🚶 पैदल चलना'], ['yoga', '🧘 Yoga', '🧘 योग'], ['strength', '💪 Strength', '💪 स्ट्रेंथ'], ['cardio', '❤️ Cardio', '❤️ कार्डियो'],
    ['cycling', '🚴 Cycling', '🚴 साइकिलिंग'], ['home', '🏠 Home workout', '🏠 घर पर वर्कआउट'], ['dance', '💃 Dance', '💃 डांस'], ['swimming', '🏊 Swimming', '🏊 तैराकी'],
  ];
  return (
    <Sheet open={open} onClose={onClose} icon={<SlidersHorizontal className="w-5 h-5" />} title={tr('Plan settings', 'प्लान सेटिंग्स')} subtitle={tr('Make the plan fit your day', 'प्लान को अपने दिन के हिसाब से बनाएं')}>
      <div>
        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">{tr('Workout intensity', 'वर्कआउट की तीव्रता')}</div>
        <div className="grid grid-cols-3 gap-2">
          {intensities.map(([k, e, en, hi]) => (
            <button key={k} type="button" onClick={() => setS({ ...s, intensity: k })} className={`p-3 rounded-2xl border text-center cursor-pointer ${s.intensity === k ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
              <div className="text-2xl">{e}</div>
              <div className={`mt-1 text-xs font-black ${s.intensity === k ? 'text-emerald-700' : 'text-zinc-700'}`}>{tr(en, hi)}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">{tr('Diet preference', 'खाने की पसंद')}</div>
        <div className="flex flex-wrap gap-2">{diets.map(([k, en, hi]) => <Chip key={k} on={s.diet === k} onClick={() => setS({ ...s, diet: k })}>{tr(en, hi)}</Chip>)}</div>
      </div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">{tr('Exercises you like', 'पसंदीदा एक्सरसाइज़')}</div>
        <div className="flex flex-wrap gap-2">
          {exercises.map(([k, en, hi]) => <Chip key={k} on={s.exercises.includes(k)} onClick={() => setS({ ...s, exercises: s.exercises.includes(k) ? s.exercises.filter((x) => x !== k) : [...s.exercises, k] })}>{tr(en, hi)}</Chip>)}
        </div>
      </div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">{tr('Show in my plan', 'प्लान में दिखाएं')}</div>
        <div className="grid grid-cols-2 gap-2">
          {([['full', 'Full-day plan', 'पूरे दिन का प्लान'], ['meals-exercise', 'Meals & exercise only', 'सिर्फ़ खाना व एक्सरसाइज़']] as const).map(([k, en, hi]) => (
            <button key={k} type="button" onClick={() => setS({ ...s, view: k })} className={`p-3 rounded-2xl border text-xs font-black cursor-pointer ${s.view === k ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 text-zinc-700'}`}>{tr(en, hi)}</button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 leading-snug">{tr('AI alternatives (the → on meals and exercises) follow these settings. Your doctor-guided plan itself does not change.', 'AI विकल्प (खाने व एक्सरसाइज़ पर →) इन सेटिंग्स के हिसाब से आते हैं। डॉक्टर-गाइडेड प्लान खुद नहीं बदलता।')}</p>
      <button type="button" onClick={save} className="w-full py-3.5 rounded-2xl bg-brand-gradient text-white text-sm font-black shadow-lg shadow-emerald-600/25 cursor-pointer">{tr('Save settings', 'सेटिंग्स सेव करें')}</button>
    </Sheet>
  );
};

interface DayLog { dateKey: string; label: string; total: number; done: number; meals: [number, number]; exercise: [number, number] }

export const DailyLogsSheet: React.FC<{ open: boolean; onClose: () => void; userId: string; tr: (en: string, hi: string) => string; language: string }> = ({ open, onClose, userId, tr, language }) => {
  const [logs, setLogs] = useState<DayLog[] | null>(null);
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLogs(null);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); return d; });
    Promise.all(days.map(async (d) => {
      const key = toDateKey(d);
      const [plan, done] = await Promise.all([getDailyPlan(key), getTaskCompletion(userId, key)]);
      const steps = activePlanSections(plan, userId).filter((s: any) => !!s.timeLabel);
      const count = (pred: (s: any) => boolean): [number, number] => { const list = steps.filter(pred); return [list.filter((s: any) => done[s.id]).length, list.length]; };
      return {
        dateKey: key,
        label: d.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        total: steps.length,
        done: steps.filter((s: any) => done[s.id]).length,
        meals: count((s) => categoryFor(s.title) === 'meal'),
        exercise: count((s) => categoryFor(s.title) === 'exercise'),
      };
    })).then((list) => { if (!cancelled) setLogs(list); });
    return () => { cancelled = true; };
  }, [open, userId, language]);

  return (
    <Sheet open={open} onClose={onClose} icon={<CalendarCheck className="w-5 h-5" />} title={tr('Daily health log', 'रोज़ का हेल्थ लॉग')} subtitle={tr('Your last 7 days', 'पिछले 7 दिन')}>
      {!logs ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>
      ) : (
        <ul className="space-y-2">
          {logs.map((l, i) => {
            const pct = l.total ? Math.round((l.done / l.total) * 100) : 0;
            const tone = pct >= 90 ? 'from-emerald-500 to-teal-500' : pct >= 50 ? 'from-emerald-500 to-teal-500' : pct > 0 ? 'from-amber-400 to-orange-500' : 'from-zinc-200 to-zinc-300';
            return (
              <motion.li key={l.dateKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="p-3 rounded-2xl border border-zinc-200 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-zinc-900">{i === 0 ? tr('Today', 'आज') : l.label}</span>
                  <span className="text-sm font-black text-zinc-700">{pct}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${pct}%` }} /></div>
                <div className="mt-2 flex items-center gap-3 text-[11px] font-bold text-zinc-500">
                  <span className="inline-flex items-center gap-1"><Utensils className="w-3.5 h-3.5 text-amber-500" />{tr(`Meals ${l.meals[0]}/${l.meals[1]}`, `भोजन ${l.meals[0]}/${l.meals[1]}`)}</span>
                  <span className="inline-flex items-center gap-1"><Dumbbell className="w-3.5 h-3.5 text-orange-500" />{tr(`Exercise ${l.exercise[0]}/${l.exercise[1]}`, `एक्सरसाइज़ ${l.exercise[0]}/${l.exercise[1]}`)}</span>
                  <span className="ml-auto">{tr(`${l.done}/${l.total} steps`, `${l.done}/${l.total} कदम`)}</span>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Droplets, Gauge, Scale, Activity, FlaskConical, HeartPulse, ChevronDown, Share2, Printer,
  CalendarCheck, GlassWater, Sparkles, FileUp, Check, ArrowDownRight, ArrowUpRight, Minus,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, MedicalReportAnalysis, FamilyMember } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { getFamilyMembers, getPatientTracker, savePatientTracker, getActiveDates, getDailyLog } from '../utils/supabase';
import { FamilyViewSwitcher } from './FamilyViewSwitcher';

interface TrackerModuleProps {
  profile: UserHealthProfile;
  account: UserAccount;
  reports: MedicalReportAnalysis[];
  onUpdateProfile: (updated: UserHealthProfile) => void;
  /** Opens My Reports so a new lab report can update the tracker. */
  onOpenReports?: () => void;
}

// ---- The 90-day journey ----

type CheckpointKey = 'baseline' | 'day7' | 'day14' | 'day30' | 'day60' | 'day90';
const CHECKPOINTS: { key: CheckpointKey; day: number; label: [string, string] }[] = [
  { key: 'baseline', day: 0, label: ['Start', 'शुरुआत'] },
  { key: 'day7', day: 7, label: ['Day 7', 'दिन 7'] },
  { key: 'day14', day: 14, label: ['Day 14', 'दिन 14'] },
  { key: 'day30', day: 30, label: ['Day 30', 'दिन 30'] },
  { key: 'day60', day: 60, label: ['Day 60', 'दिन 60'] },
  { key: 'day90', day: 90, label: ['Day 90', 'दिन 90'] },
];

// ---- Saved shape (same as before, so existing trackers keep their data) ----

interface CheckpointEntry { date: string; values: Record<string, string> }
interface NotesEntry { wins: string; barriers: string; actionsCompleted: string; careTeamFollowUp: string }
interface TrackerState {
  patient: { patientName: string; startDate: string; careLead: string; rootCauses: string; treatmentFocus: string };
  checkpoints: Record<CheckpointKey, CheckpointEntry>;
  notes: Record<CheckpointKey, NotesEntry>;
}

function defaultState(patientName: string): TrackerState {
  const checkpoints = {} as Record<CheckpointKey, CheckpointEntry>;
  const notes = {} as Record<CheckpointKey, NotesEntry>;
  CHECKPOINTS.forEach((c) => {
    checkpoints[c.key] = { date: '', values: {} };
    notes[c.key] = { wins: '', barriers: '', actionsCompleted: '', careTeamFollowUp: '' };
  });
  return { patient: { patientName, startDate: '', careLead: '', rootCauses: '', treatmentFocus: '' }, checkpoints, notes };
}

function mergeState(partial: any, patientName: string): TrackerState {
  const base = defaultState(patientName);
  if (!partial) return base;
  try {
    const checkpoints = { ...base.checkpoints };
    const notes = { ...base.notes };
    CHECKPOINTS.forEach(({ key }) => {
      const cp = partial.checkpoints?.[key];
      if (cp) checkpoints[key] = { date: cp.date || '', values: { ...(cp.values || {}) } };
      const n = partial.notes?.[key];
      if (n) notes[key] = { ...base.notes[key], ...n };
    });
    return { patient: { ...base.patient, ...(partial.patient || {}) }, checkpoints, notes };
  } catch {
    return base;
  }
}

const legacyStorageKey = (id: string) => `urcare_tracker_v1_${id}`;

// ---- Where the numbers come from automatically ----

const num = (v?: string | number | null): number | null => {
  if (v == null || v === '') return null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

/** Value of the first matching test in the given reports (in that order). */
function fromReports(reports: MedicalReportAnalysis[], keywords: string[]): { value: string; at: string } | null {
  for (const r of reports) {
    for (const b of r.biomarkers || []) {
      const name = (b.name || '').toLowerCase();
      if (keywords.some((k) => name.includes(k)) && num(b.value) !== null) return { value: String(num(b.value)), at: r.uploadedAt };
    }
  }
  return null;
}

type Goal = 'lower' | 'higher';
interface KeyMarker {
  id: string;
  /** Second value for blood pressure (diastolic). */
  id2?: string;
  label: [string, string];
  unit: string;
  goal: Goal;
  icon: React.ComponentType<{ className?: string }>;
  normal: [string, string];
  keywords: string[];
  ddKey?: string;
}

const KEY_MARKERS: KeyMarker[] = [
  { id: 'fastingGlucose', label: ['Fasting sugar', 'फास्टिंग शुगर'], unit: 'mg/dL', goal: 'lower', icon: Droplets, normal: ['Normal 70–99', 'सामान्य 70–99'], keywords: ['fasting glucose', 'fasting blood sugar', 'fasting plasma glucose', 'fpg', 'fbs'], ddKey: 'fastingSugar' },
  { id: 'postMealGlucose', label: ['After-meal sugar', 'खाने के बाद शुगर'], unit: 'mg/dL', goal: 'lower', icon: Droplets, normal: ['Normal below 140', 'सामान्य 140 से कम'], keywords: ['post prandial', 'postprandial', 'pp glucose', 'post meal', 'ppbs'], ddKey: 'postMealSugar' },
  { id: 'hba1c', label: ['HbA1c', 'HbA1c'], unit: '%', goal: 'lower', icon: Gauge, normal: ['Normal below 5.7', 'सामान्य 5.7 से कम'], keywords: ['hba1c', 'glycated', 'a1c'], ddKey: 'hba1c' },
  { id: 'weight', label: ['Weight', 'वज़न'], unit: 'kg', goal: 'lower', icon: Scale, normal: ['From your profile', 'आपकी प्रोफ़ाइल से'], keywords: [] },
  { id: 'bpSystolic', id2: 'bpDiastolic', label: ['Blood pressure', 'ब्लड प्रेशर'], unit: 'mmHg', goal: 'lower', icon: Activity, normal: ['Normal below 120/80', 'सामान्य 120/80 से कम'], keywords: [], ddKey: 'bloodPressure' },
  { id: 'totalCholesterol', label: ['Cholesterol', 'कोलेस्ट्रॉल'], unit: 'mg/dL', goal: 'lower', icon: FlaskConical, normal: ['Normal below 200', 'सामान्य 200 से कम'], keywords: ['total cholesterol', 'cholesterol, total', 'cholesterol'], ddKey: 'totalCholesterol' },
];

/** Less-used measurements, kept under "More measurements". */
const MORE_MARKERS: { id: string; label: [string, string]; unit: string; goal: Goal; keywords: string[] }[] = [
  { id: 'ldl', label: ['LDL cholesterol', 'LDL कोलेस्ट्रॉल'], unit: 'mg/dL', goal: 'lower', keywords: ['ldl'] },
  { id: 'hdl', label: ['HDL cholesterol', 'HDL कोलेस्ट्रॉल'], unit: 'mg/dL', goal: 'higher', keywords: ['hdl'] },
  { id: 'triglycerides', label: ['Triglycerides', 'ट्राइग्लिसराइड'], unit: 'mg/dL', goal: 'lower', keywords: ['triglyceride'] },
  { id: 'vitaminD', label: ['Vitamin D', 'विटामिन D'], unit: 'ng/mL', goal: 'higher', keywords: ['vitamin d', '25-oh', '25 oh'] },
  { id: 'waist', label: ['Waist', 'कमर'], unit: 'in', goal: 'lower', keywords: [] },
  { id: 'restingHr', label: ['Resting heart rate', 'आराम में धड़कन'], unit: 'bpm', goal: 'lower', keywords: ['heart rate', 'pulse'] },
  { id: 'dailySteps', label: ['Daily steps', 'रोज़ के कदम'], unit: 'steps', goal: 'higher', keywords: [] },
  { id: 'sleepDuration', label: ['Sleep', 'नींद'], unit: 'hours', goal: 'higher', keywords: [] },
];

/** "How do you feel" check-in, saved on the 1–10 scale the tracker always used. */
const FEELINGS: { id: string; label: [string, string]; goal: Goal }[] = [
  { id: 'energy', label: ['Energy', 'ऊर्जा'], goal: 'higher' },
  { id: 'sleepQuality', label: ['Sleep', 'नींद'], goal: 'higher' },
  { id: 'cravings', label: ['Cravings', 'मीठे की इच्छा'], goal: 'lower' },
  { id: 'stressLevel', label: ['Stress', 'तनाव'], goal: 'lower' },
];
// 5 faces, best on the right, mapped onto 1–10.
const FACES = ['😣', '😕', '😐', '🙂', '😄'];
const faceToValue = (i: number, goal: Goal) => String(goal === 'higher' ? (i + 1) * 2 : (5 - i) * 2);
const valueToFace = (v: string | undefined, goal: Goal) => {
  const n = num(v);
  if (n === null) return -1;
  const step = Math.min(5, Math.max(1, Math.round(n / 2)));
  return goal === 'higher' ? step - 1 : 5 - step;
};

const DAY_MS = 86400000;
const dateOnly = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

/** Simple 90-day tracker. Fills itself from onboarding answers, lab reports,
 *  the profile weight and the daily plan; the person only adds what the app
 *  can't know (how they feel, a home BP/sugar reading). Saved per person in
 *  patient_trackers, same shape as before. */
export const TrackerModule: React.FC<TrackerModuleProps> = ({ profile, account, reports, onOpenReports }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const L = (pair: [string, string]) => tr(pair[0], pair[1]);

  const userId = profile.id || account.uid || 'guest';
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [activeDependentId, setActiveDependentId] = useState<string | null>(null);
  useEffect(() => { getFamilyMembers().then(setFamilyMembers); }, []);
  const activeMember = activeDependentId ? familyMembers.find((m) => m.id === activeDependentId) : null;
  const trackerId = activeMember?.dependentUserId || userId;
  const isSelf = !activeMember;
  const personName = activeMember?.name || profile.name || account.displayName || '';

  const [state, setState] = useState<TrackerState>(() => defaultState(personName));
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<[string, string]>(['', '']);
  const [showMore, setShowMore] = useState(false);
  const [shared, setShared] = useState(false);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [waterMl, setWaterMl] = useState(0);

  // Reports for this person, oldest first / newest first.
  const personReports = useMemo(() => {
    const mine = isSelf ? reports : reports.filter((r: any) => r.userId === trackerId || r.dependentUserId === trackerId);
    return [...mine].sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
  }, [reports, isSelf, trackerId]);
  const newestFirst = useMemo(() => [...personReports].reverse(), [personReports]);

  // Load saved tracker.
  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    getPatientTracker(trackerId).then((db) => {
      if (cancelled) return;
      let legacy: any = null;
      if (!db) { try { const raw = localStorage.getItem(legacyStorageKey(trackerId)); if (raw) legacy = JSON.parse(raw); } catch {} }
      setState(mergeState(db || legacy, personName));
      setIsLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackerId]);

  // Save shortly after each change.
  useEffect(() => {
    if (!isLoaded) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      savePatientTracker(trackerId, state).then(({ error }) => setSaveStatus(error ? 'error' : 'saved'));
    }, 600);
    return () => clearTimeout(t);
  }, [state, isLoaded, trackerId]);

  // Plan days done + today's water, kept live.
  const loadHabits = useCallback(() => {
    getActiveDates(trackerId).then(setActiveDays).catch(() => {});
    getDailyLog(trackerId, dateOnly(new Date())).then((log) => setWaterMl(log?.waterMl || 0)).catch(() => {});
  }, [trackerId]);
  useEffect(() => {
    loadHabits();
    window.addEventListener('urcare:refresh', loadHabits);
    window.addEventListener('urcare:daily-log-changed', loadHabits);
    return () => { window.removeEventListener('urcare:refresh', loadHabits); window.removeEventListener('urcare:daily-log-changed', loadHabits); };
  }, [loadHabits]);

  // ---- Journey position ----
  const startDate = state.patient.startDate || (isSelf && profile.createdAt ? dateOnly(profile.createdAt) : '') || (personReports[0] ? dateOnly(personReports[0].uploadedAt) : dateOnly(new Date()));
  const dayNumber = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / DAY_MS) + 1);
  const currentIdx = CHECKPOINTS.reduce((acc, c, i) => (dayNumber - 1 >= c.day ? i : acc), 0);
  const current = CHECKPOINTS[currentIdx];
  const next = CHECKPOINTS[currentIdx + 1];
  const journeyPct = Math.min(100, Math.round((Math.min(dayNumber, 90) / 90) * 100));

  // ---- Automatic start / now values ----
  const dd: any = isSelf ? profile.healthDeepDive || {} : {};
  const autoStart = (m: { id: string; keywords: string[]; ddKey?: string }, second = false): string => {
    if (m.id === 'weight') return isSelf && profile.currentWeightKg ? String(profile.currentWeightKg) : '';
    if (m.id === 'bpSystolic') { const bp = String(dd.bloodPressure || '').match(/(\d+)\s*\/\s*(\d+)/); return bp ? bp[second ? 2 : 1] : ''; }
    if (m.ddKey && num(dd[m.ddKey]) !== null) return String(num(dd[m.ddKey]));
    return m.keywords.length ? fromReports(personReports, m.keywords)?.value || '' : '';
  };
  const autoNow = (m: { id: string; keywords: string[]; ddKey?: string }, second = false): string => {
    if (m.id === 'weight') return isSelf && profile.currentWeightKg ? String(profile.currentWeightKg) : '';
    if (m.keywords.length) { const hit = fromReports(newestFirst, m.keywords); if (hit) return hit.value; }
    return autoStart(m, second);
  };

  // Freeze the starting values (and start date) the first time we have them,
  // so later reports and weight changes show up as progress.
  useEffect(() => {
    if (!isLoaded) return;
    setState((prev) => {
      const base = { ...prev.checkpoints.baseline.values };
      let changed = false;
      const fill = (id: string, v: string) => { if (v && (base[id] === '' || base[id] == null)) { base[id] = v; changed = true; } };
      KEY_MARKERS.forEach((m) => { fill(m.id, autoStart(m)); if (m.id2) fill(m.id2, autoStart(m, true)); });
      MORE_MARKERS.forEach((m) => fill(m.id, autoStart(m)));
      const needsDate = !prev.patient.startDate;
      if (!changed && !needsDate) return prev;
      return {
        ...prev,
        patient: needsDate ? { ...prev.patient, startDate, patientName: prev.patient.patientName || personName } : prev.patient,
        checkpoints: { ...prev.checkpoints, baseline: { date: prev.checkpoints.baseline.date || startDate, values: base } },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, trackerId, personReports.length, profile.currentWeightKg]);

  const stored = (cp: CheckpointKey, id: string) => state.checkpoints[cp]?.values?.[id] ?? '';
  /** Latest reading the person typed in any checkpoint up to now. */
  const latestTyped = (id: string) => {
    for (let i = currentIdx; i >= 1; i--) { const v = stored(CHECKPOINTS[i].key, id); if (v !== '') return v; }
    return '';
  };
  const startVal = (m: any, second = false) => stored('baseline', second ? m.id2 : m.id) || autoStart(m, second);
  const nowVal = (m: any, second = false) => latestTyped(second ? m.id2 : m.id) || autoNow(m, second);

  const setValue = (cp: CheckpointKey, id: string, value: string) => {
    setState((prev) => ({
      ...prev,
      checkpoints: {
        ...prev.checkpoints,
        [cp]: { date: prev.checkpoints[cp].date || dateOnly(new Date()), values: { ...prev.checkpoints[cp].values, [id]: value } },
      },
    }));
  };

  // Typing a new reading saves it at today's checkpoint (start values at Start).
  const saveEdit = (m: { id: string; id2?: string }) => {
    const cp: CheckpointKey = currentIdx === 0 ? 'day7' : current.key;
    if (num(draft[0]) !== null) setValue(cp, m.id, String(num(draft[0])));
    if (m.id2 && num(draft[1]) !== null) setValue(cp, m.id2, String(num(draft[1])));
    setEditing(null);
  };

  // ---- Change vs start ----
  const change = (start: string, now: string, goal: Goal) => {
    const s = num(start); const n = num(now);
    if (s === null || n === null) return null;
    const diff = Math.round((n - s) * 10) / 10;
    if (diff === 0) return { tone: 'same' as const, diff };
    const better = goal === 'lower' ? diff < 0 : diff > 0;
    return { tone: better ? ('good' as const) : ('bad' as const), diff };
  };

  const score = useMemo(() => {
    let comparable = 0; let good = 0;
    [...KEY_MARKERS, ...MORE_MARKERS].forEach((m: any) => {
      const c = change(startVal(m), nowVal(m), m.goal);
      if (!c) return;
      comparable++;
      if (c.tone !== 'bad') good++;
    });
    return { comparable, good, pct: comparable ? Math.round((good / comparable) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, personReports, profile.currentWeightKg, currentIdx]);

  const daysSinceStart = Math.min(dayNumber, 90);
  const planDays = [...activeDays].filter((d) => d >= startDate).length;

  // Today's check-in lives in the current checkpoint (Start = baseline).
  const feelCp: CheckpointKey = current.key;
  const noteCp: CheckpointKey = current.key;

  const summary = () => {
    const lines = [`UrCare 90-day tracker — ${personName || ''}`.trim(), `${tr('Day', 'दिन')} ${dayNumber} · ${L(current.label)}`, ''];
    KEY_MARKERS.forEach((m) => {
      const s = m.id2 ? `${startVal(m)}/${startVal(m, true)}` : startVal(m);
      const n = m.id2 ? `${nowVal(m)}/${nowVal(m, true)}` : nowVal(m);
      if (num(s) === null && num(n) === null) return;
      lines.push(`${L(m.label)}: ${s || '—'} → ${n || '—'} ${m.unit}`);
    });
    lines.push('', `${tr('Plan followed', 'प्लान पूरा किया')}: ${planDays}/${daysSinceStart} ${tr('days', 'दिन')}`);
    const note = state.notes[noteCp]?.careTeamFollowUp;
    if (note) lines.push('', `${tr('Note', 'नोट')}: ${note}`);
    return lines.join('\n');
  };
  const shareSummary = async () => {
    const text = summary();
    try {
      if (navigator.share) await navigator.share({ title: 'UrCare tracker', text });
      else { await navigator.clipboard.writeText(text); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch {}
  };

  const fmt = (v: string) => (v === '' ? '—' : v);

  return (
    <div id="urcare-tracker-module" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-24">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 space-y-5 text-left">
        <FamilyViewSwitcher members={familyMembers} activeDependentId={activeDependentId} onChange={setActiveDependentId} tr={tr} />

        {/* HERO — where you are in the 90 days */}
        <section className="relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#065f46 0%,#008000 55%,#22c55e 100%)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-black"><HeartPulse className="w-3.5 h-3.5" />{tr('My 90-day progress', 'मेरी 90 दिन की प्रगति')}</span>
            <span className="text-[10px] font-bold text-white/75">
              {!isLoaded ? tr('Loading…', 'लोड हो रहा है…') : saveStatus === 'saving' ? tr('Saving…', 'सेव हो रहा है…') : saveStatus === 'error' ? tr('Not saved — check internet', 'सेव नहीं हुआ — इंटरनेट देखें') : tr('Auto-saved', 'अपने आप सेव')}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <Ring pct={journeyPct} label={`${Math.min(dayNumber, 90)}`} sub={tr('of 90', '/ 90')} />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black leading-tight">{tr(`Day ${dayNumber}`, `दिन ${dayNumber}`)}</h1>
              <p className="text-sm text-white/85">
                {next
                  ? tr(`Next check-in: ${next.label[0]} in ${Math.max(0, next.day - (dayNumber - 1))} days`, `अगला चेक-इन: ${next.label[1]}, ${Math.max(0, next.day - (dayNumber - 1))} दिन में`)
                  : tr('90 days done — great work!', '90 दिन पूरे — बहुत बढ़िया!')}
              </p>
              {score.comparable > 0 && (
                <p className="mt-1 text-xs font-bold text-white/90">{tr(`${score.good} of ${score.comparable} readings better or steady`, `${score.comparable} में से ${score.good} रीडिंग बेहतर या स्थिर`)}</p>
              )}
            </div>
          </div>

          {/* Journey dots */}
          <div className="mt-5 relative">
            <div className="absolute left-3 right-3 top-3 h-1 rounded-full bg-white/25" />
            <div className="absolute left-3 top-3 h-1 rounded-full bg-white" style={{ width: `calc((100% - 1.5rem) * ${currentIdx / (CHECKPOINTS.length - 1)})` }} />
            <ol className="relative flex justify-between">
              {CHECKPOINTS.map((c, i) => (
                <li key={c.key} className="flex flex-col items-center gap-1 w-12">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${i < currentIdx ? 'bg-white text-emerald-700 border-white' : i === currentIdx ? 'bg-amber-300 text-emerald-900 border-white ring-4 ring-white/30' : 'bg-emerald-900/30 text-white/80 border-white/40'}`}>
                    {i < currentIdx ? <Check className="w-3.5 h-3.5" /> : c.day || '•'}
                  </span>
                  <span className={`text-[9px] font-bold whitespace-nowrap ${i === currentIdx ? 'text-white' : 'text-white/70'}`}>{L(c.label)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* KEY READINGS */}
        <section className="space-y-2.5">
          <div className="flex items-end justify-between px-0.5">
            <div>
              <h2 className="text-base font-black text-zinc-900">{tr('Your readings', 'आपकी रीडिंग')}</h2>
              <p className="text-[11px] text-zinc-500">{tr('Filled in from your reports and profile. Tap a card to add a new reading.', 'आपकी रिपोर्ट और प्रोफ़ाइल से अपने आप भरी। नई रीडिंग जोड़ने के लिए कार्ड दबाएं।')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {KEY_MARKERS.map((m) => {
              const s = startVal(m); const n = nowVal(m);
              const s2 = m.id2 ? startVal(m, true) : ''; const n2 = m.id2 ? nowVal(m, true) : '';
              const c = change(s, n, m.goal);
              const Icon = m.icon;
              const isEditing = editing === m.id;
              const has = num(s) !== null || num(n) !== null;
              return (
                <div key={m.id} className={`rounded-2xl bg-white border p-3 shadow-sm transition ${isEditing ? 'border-emerald-500 col-span-2' : 'border-zinc-200'}`}>
                  <button type="button" onClick={() => { setEditing(isEditing ? null : m.id); setDraft([n || '', n2 || '']); }} className="w-full text-left cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
                      <span className="text-[12px] font-black text-zinc-800 leading-tight">{L(m.label)}</span>
                    </div>
                    {has ? (
                      <>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-2xl font-black text-zinc-950 tabular-nums">{m.id2 ? `${fmt(n)}/${fmt(n2)}` : fmt(n)}</span>
                          <span className="text-[10px] font-bold text-zinc-400">{m.unit}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500">{tr('Start', 'शुरुआत')}: {m.id2 ? `${fmt(s)}/${fmt(s2)}` : fmt(s)}</div>
                        <ChangeTag c={c} unit={m.unit} tr={tr} />
                      </>
                    ) : (
                      <div className="mt-2 text-[11px] font-bold text-emerald-700">+ {tr('Add reading', 'रीडिंग जोड़ें')}</div>
                    )}
                    <div className="mt-1 text-[9px] text-zinc-400">{L(m.normal)}</div>
                  </button>
                  {isEditing && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input autoFocus type="number" inputMode="decimal" value={draft[0]} onChange={(e) => setDraft([e.target.value, draft[1]])} placeholder={m.id2 ? '120' : tr('New value', 'नई वैल्यू')} className="w-24 px-3 py-2 rounded-xl border border-zinc-300 font-bold focus:outline-none focus:border-emerald-600" />
                      {m.id2 && <><span className="font-black text-zinc-400">/</span><input type="number" inputMode="decimal" value={draft[1]} onChange={(e) => setDraft([draft[0], e.target.value])} placeholder="80" className="w-24 px-3 py-2 rounded-xl border border-zinc-300 font-bold focus:outline-none focus:border-emerald-600" /></>}
                      <span className="text-xs text-zinc-400">{m.unit}</span>
                      <button type="button" onClick={() => saveEdit(m)} className="ml-auto px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-black cursor-pointer">{tr('Save', 'सेव')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {onOpenReports && (
            <button type="button" onClick={onOpenReports} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black cursor-pointer">
              <FileUp className="w-4 h-4" />{tr('Upload a new lab report — readings update automatically', 'नई लैब रिपोर्ट अपलोड करें — रीडिंग अपने आप अपडेट होंगी')}
            </button>
          )}
        </section>

        {/* HABITS — automatic */}
        <section className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-white border border-zinc-200 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-[12px] font-black text-zinc-800"><CalendarCheck className="w-4 h-4 text-emerald-600" />{tr('Plan followed', 'प्लान पूरा किया')}</div>
            <div className="mt-2 text-2xl font-black tabular-nums">{planDays}<span className="text-sm text-zinc-400">/{daysSinceStart}</span></div>
            <div className="text-[10px] text-zinc-500">{tr('days since you started', 'दिन, शुरुआत से')}</div>
            <Bar pct={daysSinceStart ? (planDays / daysSinceStart) * 100 : 0} />
          </div>
          <div className="rounded-2xl bg-white border border-zinc-200 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-[12px] font-black text-zinc-800"><GlassWater className="w-4 h-4 text-sky-500" />{tr('Water today', 'आज पानी')}</div>
            <div className="mt-2 text-2xl font-black tabular-nums">{(waterMl / 1000).toFixed(1)}<span className="text-sm text-zinc-400"> / 3 L</span></div>
            <div className="text-[10px] text-zinc-500">{tr('from your daily log', 'आपके डेली लॉग से')}</div>
            <Bar pct={(waterMl / 3000) * 100} color="#0ea5e9" />
          </div>
        </section>

        {/* HOW DO YOU FEEL */}
        <section className="rounded-2xl bg-white border border-zinc-200 p-4 shadow-sm space-y-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-black text-zinc-900"><Sparkles className="w-4 h-4 text-amber-500" />{tr('How do you feel?', 'आप कैसा महसूस कर रहे हैं?')}</h2>
            <p className="text-[11px] text-zinc-500">{tr(`One tap each — saved for ${current.label[0]}.`, `हर एक पर एक टैप — ${current.label[1]} के लिए सेव।`)}</p>
          </div>
          {FEELINGS.map((f) => {
            const picked = valueToFace(stored(feelCp, f.id), f.goal);
            const startFace = valueToFace(stored('baseline', f.id), f.goal);
            return (
              <div key={f.id} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-black text-zinc-700">{L(f.label)}</span>
                <div className="flex-1 flex justify-between gap-1">
                  {FACES.map((face, i) => (
                    <button key={i} type="button" aria-label={`${L(f.label)} ${i + 1}/5`} onClick={() => setValue(feelCp, f.id, faceToValue(i, f.goal))}
                      className={`flex-1 h-10 rounded-xl text-xl cursor-pointer transition ${picked === i ? 'bg-emerald-100 ring-2 ring-emerald-500 scale-105' : 'bg-zinc-50 grayscale-60 opacity-70 hover:opacity-100'}`}>
                      {face}
                    </button>
                  ))}
                </div>
                {feelCp !== 'baseline' && startFace >= 0 && picked >= 0 && (
                  <span className={`w-6 text-center text-xs font-black ${picked > startFace ? 'text-emerald-600' : picked < startFace ? 'text-rose-500' : 'text-zinc-400'}`}>{picked > startFace ? '↑' : picked < startFace ? '↓' : '='}</span>
                )}
              </div>
            );
          })}
        </section>

        {/* MORE MEASUREMENTS */}
        <section className="rounded-2xl bg-white border border-zinc-200 shadow-sm">
          <button type="button" onClick={() => setShowMore(!showMore)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="text-sm font-black text-zinc-800">{tr('More measurements', 'और माप')}</span>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          </button>
          {showMore && (
            <div className="px-4 pb-4 divide-y divide-zinc-100">
              {MORE_MARKERS.map((m) => {
                const s = startVal(m); const n = nowVal(m);
                const cp: CheckpointKey = currentIdx === 0 ? 'baseline' : current.key;
                return (
                  <div key={m.id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-zinc-800">{L(m.label)}</div>
                      <div className="text-[10px] text-zinc-400">{tr('Start', 'शुरुआत')}: {fmt(s)} {m.unit}</div>
                      <ChangeTag c={change(s, n, m.goal)} unit={m.unit} tr={tr} small />
                    </div>
                    <input type="number" inputMode="decimal" value={stored(cp, m.id)} placeholder={n || m.unit} onChange={(e) => setValue(cp, m.id, e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-zinc-300 text-sm font-bold focus:outline-none focus:border-emerald-600" />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* NOTE + SHARE */}
        <section className="rounded-2xl bg-white border border-zinc-200 p-4 shadow-sm space-y-3">
          <label className="block text-sm font-black text-zinc-800">{tr('Note for your doctor', 'डॉक्टर के लिए नोट')}</label>
          <textarea rows={2} value={state.notes[noteCp]?.careTeamFollowUp || ''}
            onChange={(e) => setState((prev) => ({ ...prev, notes: { ...prev.notes, [noteCp]: { ...prev.notes[noteCp], careTeamFollowUp: e.target.value } } }))}
            placeholder={tr('Any problem, question or good change…', 'कोई परेशानी, सवाल या अच्छा बदलाव…')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-emerald-600 resize-y" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={shareSummary} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 text-white text-sm font-black cursor-pointer">
              {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}{shared ? tr('Copied', 'कॉपी हुआ') : tr('Share', 'शेयर')}
            </button>
            <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-emerald-600 text-emerald-700 text-sm font-black cursor-pointer">
              <Printer className="w-4 h-4" />{tr('Print / PDF', 'प्रिंट / PDF')}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

const Ring: React.FC<{ pct: number; label: string; sub: string }> = ({ pct, label, sub }) => {
  const size = 92; const stroke = 9; const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-2xl font-black">{label}</span>
        <span className="text-[10px] font-bold text-white/80">{sub}</span>
      </div>
    </div>
  );
};

const Bar: React.FC<{ pct: number; color?: string }> = ({ pct, color = '#008000' }) => (
  <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: 'width .5s ease' }} />
  </div>
);

const ChangeTag: React.FC<{ c: { tone: 'good' | 'bad' | 'same'; diff: number } | null; unit: string; tr: (en: string, hi: string) => string; small?: boolean }> = ({ c, unit, tr, small }) => {
  if (!c) return <div className={`${small ? 'mt-0.5' : 'mt-1.5'} text-[10px] text-zinc-400`}>{tr('Add a new reading to see change', 'बदलाव देखने के लिए नई रीडिंग जोड़ें')}</div>;
  const Icon = c.tone === 'same' ? Minus : c.diff < 0 ? ArrowDownRight : ArrowUpRight;
  const cls = c.tone === 'good' ? 'bg-emerald-50 text-emerald-700' : c.tone === 'bad' ? 'bg-rose-50 text-rose-600' : 'bg-zinc-100 text-zinc-500';
  const word = c.tone === 'good' ? tr('better', 'बेहतर') : c.tone === 'bad' ? tr('worse', 'खराब') : tr('same as start', 'शुरुआत जैसा');
  return (
    <span className={`${small ? 'mt-0.5' : 'mt-1.5'} inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${cls}`}>
      <Icon className="w-3 h-3" />{c.tone !== 'same' && `${Math.abs(c.diff)} ${unit} `}{word}
    </span>
  );
};

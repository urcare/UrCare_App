import React, { useEffect, useMemo, useState } from 'react';
import {
  HeartPulse, Printer, Download, Copy, Check, ClipboardList, LayoutGrid,
  ListChecks, StickyNote, FileDown,
} from 'lucide-react';
import { UserHealthProfile, UserAccount, MedicalReportAnalysis } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface TrackerModuleProps {
  profile: UserHealthProfile;
  account: UserAccount;
  reports: MedicalReportAnalysis[];
  onUpdateProfile: (updated: UserHealthProfile) => void;
}

// ---- Static shape of the tracker: checkpoints + the 29 measured markers ----

type CheckpointKey = 'baseline' | 'day7' | 'day14' | 'day30' | 'day60' | 'day90';

const CHECKPOINTS: { key: CheckpointKey; label: string }[] = [
  { key: 'baseline', label: 'Baseline' },
  { key: 'day7', label: 'Day 7' },
  { key: 'day14', label: 'Day 14' },
  { key: 'day30', label: 'Day 30' },
  { key: 'day60', label: 'Day 60' },
  { key: 'day90', label: 'Day 90' },
];

type MarkerGoal = 'higher' | 'lower';
type MarkerCategoryKey = 'vitals' | 'biomarkers' | 'dailyFunction' | 'symptoms' | 'lifestyle';

interface MarkerDef {
  id: string;
  label: string;
  unit: string;
  goal: MarkerGoal;
}

const MARKER_CATEGORIES: { key: MarkerCategoryKey; label: string; markers: MarkerDef[] }[] = [
  {
    key: 'vitals',
    label: 'Vitals',
    markers: [
      { id: 'weight', label: 'Weight', unit: 'lb', goal: 'lower' },
      { id: 'waist', label: 'Waist circumference', unit: 'in', goal: 'lower' },
      { id: 'bpSystolic', label: 'Blood pressure systolic', unit: 'mmHg', goal: 'lower' },
      { id: 'bpDiastolic', label: 'Blood pressure diastolic', unit: 'mmHg', goal: 'lower' },
      { id: 'restingHr', label: 'Resting heart rate', unit: 'bpm', goal: 'lower' },
    ],
  },
  {
    key: 'biomarkers',
    label: 'Biomarkers',
    markers: [
      { id: 'hba1c', label: 'HbA1c', unit: '%', goal: 'lower' },
      { id: 'fastingGlucose', label: 'Fasting glucose', unit: 'mg/dL', goal: 'lower' },
      { id: 'postMealGlucose', label: 'Post-meal glucose', unit: 'mg/dL', goal: 'lower' },
      { id: 'ldl', label: 'LDL cholesterol', unit: 'mg/dL', goal: 'lower' },
      { id: 'hdl', label: 'HDL cholesterol', unit: 'mg/dL', goal: 'higher' },
      { id: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', goal: 'lower' },
      { id: 'vitaminD', label: 'Vitamin D', unit: 'ng/mL', goal: 'higher' },
    ],
  },
  {
    key: 'dailyFunction',
    label: 'Daily Function',
    markers: [
      { id: 'energy', label: 'Energy', unit: '1-10', goal: 'higher' },
      { id: 'sleepQuality', label: 'Sleep quality', unit: '1-10', goal: 'higher' },
      { id: 'sleepDuration', label: 'Sleep duration', unit: 'hours', goal: 'higher' },
      { id: 'mobility', label: 'Mobility / exercise tolerance', unit: '1-10', goal: 'higher' },
      { id: 'mentalClarity', label: 'Mental clarity / focus', unit: '1-10', goal: 'higher' },
      { id: 'digestionComfort', label: 'Digestion comfort', unit: '1-10', goal: 'higher' },
    ],
  },
  {
    key: 'symptoms',
    label: 'Symptoms',
    markers: [
      { id: 'painLevel', label: 'Pain level', unit: '1-10', goal: 'lower' },
      { id: 'bloating', label: 'Bloating', unit: '1-10', goal: 'lower' },
      { id: 'fatigue', label: 'Fatigue', unit: '1-10', goal: 'lower' },
      { id: 'cravings', label: 'Cravings', unit: '1-10', goal: 'lower' },
      { id: 'headacheFrequency', label: 'Headache frequency', unit: 'days/week', goal: 'lower' },
      { id: 'jointStiffness', label: 'Joint stiffness', unit: '1-10', goal: 'lower' },
    ],
  },
  {
    key: 'lifestyle',
    label: 'Lifestyle',
    markers: [
      { id: 'dailySteps', label: 'Daily steps', unit: 'count', goal: 'higher' },
      { id: 'waterIntake', label: 'Water intake', unit: 'L', goal: 'higher' },
      { id: 'mealsOnPlan', label: 'Meals on plan', unit: '%', goal: 'higher' },
      { id: 'medicationAdherence', label: 'Medication adherence', unit: '%', goal: 'higher' },
      { id: 'stressLevel', label: 'Stress level', unit: '1-10', goal: 'lower' },
    ],
  },
];

const ALL_MARKERS: MarkerDef[] = MARKER_CATEGORIES.flatMap((c) => c.markers);
const TOTAL_MARKERS = ALL_MARKERS.length;

// ---- Persisted shape ----

interface PatientInfo {
  patientName: string;
  startDate: string;
  careLead: string;
  rootCauses: string;
  treatmentFocus: string;
}

interface CheckpointEntry {
  date: string;
  values: Record<string, string>;
}

interface NotesEntry {
  wins: string;
  barriers: string;
  actionsCompleted: string;
  careTeamFollowUp: string;
}

interface TrackerState {
  patient: PatientInfo;
  checkpoints: Record<CheckpointKey, CheckpointEntry>;
  notes: Record<CheckpointKey, NotesEntry>;
}

function emptyCheckpointEntry(): CheckpointEntry {
  return { date: '', values: {} };
}

function emptyNotesEntry(): NotesEntry {
  return { wins: '', barriers: '', actionsCompleted: '', careTeamFollowUp: '' };
}

function defaultState(patientName: string): TrackerState {
  const checkpoints = {} as Record<CheckpointKey, CheckpointEntry>;
  const notes = {} as Record<CheckpointKey, NotesEntry>;
  CHECKPOINTS.forEach((c) => {
    checkpoints[c.key] = emptyCheckpointEntry();
    notes[c.key] = emptyNotesEntry();
  });
  return {
    patient: { patientName, startDate: '', careLead: '', rootCauses: '', treatmentFocus: '' },
    checkpoints,
    notes,
  };
}

function loadState(storageKey: string, patientName: string): TrackerState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultState(patientName);
    const parsed = JSON.parse(raw);
    const base = defaultState(patientName);
    return {
      patient: { ...base.patient, ...(parsed.patient || {}) },
      checkpoints: { ...base.checkpoints, ...(parsed.checkpoints || {}) },
      notes: { ...base.notes, ...(parsed.notes || {}) },
    };
  } catch {
    return defaultState(patientName);
  }
}

// ---- Marker status vs baseline ----

type StatusTone = 'neutral' | 'good' | 'bad';
interface MarkerStatus { pillLabel: string; tone: StatusTone; note: string }

function markerStatus(marker: MarkerDef, isBaselineCheckpoint: boolean, baselineVal: string, currentVal: string): MarkerStatus {
  if (isBaselineCheckpoint) {
    return { pillLabel: 'Baseline', tone: 'neutral', note: 'Starting value for comparison.' };
  }
  if (currentVal === '' || currentVal == null) {
    return { pillLabel: 'Pending', tone: 'neutral', note: 'Add baseline and current values.' };
  }
  if (baselineVal === '' || baselineVal == null) {
    return { pillLabel: 'Pending', tone: 'neutral', note: 'Add a baseline value to compare against.' };
  }
  const b = Number(baselineVal);
  const c = Number(currentVal);
  if (Number.isNaN(b) || Number.isNaN(c)) {
    return { pillLabel: 'Pending', tone: 'neutral', note: 'Add baseline and current values.' };
  }
  if (c === b) return { pillLabel: 'Stable', tone: 'neutral', note: `Unchanged from baseline (${b}).` };
  const improved = marker.goal === 'higher' ? c > b : c < b;
  if (improved) return { pillLabel: 'Improved', tone: 'good', note: `Improved from baseline (${b} → ${c}).` };
  return { pillLabel: 'Declined', tone: 'bad', note: `Moved away from baseline (${b} → ${c}).` };
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600',
  good: 'bg-emerald-100 text-emerald-700',
  bad: 'bg-rose-100 text-rose-700',
};

function checkpointHasAnyData(cp: CheckpointEntry): boolean {
  return !!cp.date || Object.values(cp.values).some((v) => v !== '' && v != null);
}

function getLatestCheckpointWithData(checkpoints: Record<CheckpointKey, CheckpointEntry>): CheckpointKey | null {
  for (let i = CHECKPOINTS.length - 1; i >= 1; i--) {
    const key = CHECKPOINTS[i].key;
    if (checkpointHasAnyData(checkpoints[key])) return key;
  }
  return null;
}

function computeScore(checkpoints: Record<CheckpointKey, CheckpointEntry>, latestKey: CheckpointKey | null) {
  if (!latestKey) return { score: 0, comparable: 0, good: 0 };
  const baseline = checkpoints.baseline.values;
  const current = checkpoints[latestKey].values;
  let comparable = 0;
  let good = 0;
  ALL_MARKERS.forEach((m) => {
    const b = baseline[m.id];
    const c = current[m.id];
    if (b === '' || b == null || c === '' || c == null) return;
    const bn = Number(b);
    const cn = Number(c);
    if (Number.isNaN(bn) || Number.isNaN(cn)) return;
    comparable++;
    const isGood = m.goal === 'higher' ? cn >= bn : cn <= bn;
    if (isGood) good++;
  });
  return { score: comparable > 0 ? Math.round((good / comparable) * 100) : 0, comparable, good };
}

function countMeasuredMarkers(checkpoints: Record<CheckpointKey, CheckpointEntry>): number {
  let count = 0;
  ALL_MARKERS.forEach((m) => {
    const hasAny = CHECKPOINTS.some((c) => {
      const v = checkpoints[c.key].values[m.id];
      return v !== '' && v != null;
    });
    if (hasAny) count++;
  });
  return count;
}

// ---- Small presentational pieces ----

const SectionEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{children}</p>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xl font-black text-zinc-950 leading-tight">{children}</h2>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm ${className}`}>{children}</div>
);

const PillButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-black transition-colors cursor-pointer whitespace-nowrap ${
      active ? 'bg-emerald-700 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
    }`}
  >
    {children}
  </button>
);

function ScoreRing({ pct }: { pct: number }) {
  const size = 128;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#059669"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="fill-zinc-950 font-black"
        style={{ fontSize: 22 }}
      >
        {pct}%
      </text>
    </svg>
  );
}

/** Full manual "7-90 Day Improvement Tracker" — patient details, checkpoint
 *  biomarker/vitals/symptom entry at Baseline/Day 7/14/30/60/90, an
 *  improvement score comparing each checkpoint back to Baseline, care notes
 *  per checkpoint, and Print/PDF + JSON export. Everything is entered by
 *  hand and saved to this device only (see "Saved locally"), independent of
 *  the app's own automatic tracking elsewhere. */
export const TrackerModule: React.FC<TrackerModuleProps> = ({ profile, account }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const userId = profile.id || account.uid || 'guest';
  const storageKey = `urcare_tracker_v1_${userId}`;
  const defaultPatientName = profile.name || account.displayName || '';

  const [state, setState] = useState<TrackerState>(() => loadState(storageKey, defaultPatientName));
  const [activeTab, setActiveTab] = useState<'overview' | 'tracker' | 'notes' | 'export'>('overview');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<CheckpointKey>('baseline');
  const [selectedCategory, setSelectedCategory] = useState<'all' | MarkerCategoryKey>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }, [state, storageKey]);

  const updatePatient = (field: keyof PatientInfo, value: string) => {
    setState((prev) => ({ ...prev, patient: { ...prev.patient, [field]: value } }));
  };

  const updateCheckpointDate = (key: CheckpointKey, date: string) => {
    setState((prev) => ({
      ...prev,
      checkpoints: { ...prev.checkpoints, [key]: { ...prev.checkpoints[key], date } },
    }));
  };

  const updateMarkerValue = (key: CheckpointKey, markerId: string, value: string) => {
    setState((prev) => ({
      ...prev,
      checkpoints: {
        ...prev.checkpoints,
        [key]: { ...prev.checkpoints[key], values: { ...prev.checkpoints[key].values, [markerId]: value } },
      },
    }));
  };

  const updateNotes = (key: CheckpointKey, field: keyof NotesEntry, value: string) => {
    setState((prev) => ({
      ...prev,
      notes: { ...prev.notes, [key]: { ...prev.notes[key], [field]: value } },
    }));
  };

  const latestCheckpointKey = useMemo(() => getLatestCheckpointWithData(state.checkpoints), [state.checkpoints]);
  const latestCheckpointLabel = latestCheckpointKey ? CHECKPOINTS.find((c) => c.key === latestCheckpointKey)!.label : null;
  const latestCheckpointDate = latestCheckpointKey ? state.checkpoints[latestCheckpointKey].date : '';

  const { score, comparable, good } = useMemo(() => computeScore(state.checkpoints, latestCheckpointKey), [state.checkpoints, latestCheckpointKey]);
  const measuredCount = useMemo(() => countMeasuredMarkers(state.checkpoints), [state.checkpoints]);

  const categoriesToShow = selectedCategory === 'all'
    ? MARKER_CATEGORIES
    : MARKER_CATEGORIES.filter((c) => c.key === selectedCategory);

  const isBaselineSelected = selectedCheckpoint === 'baseline';
  const baselineValues = state.checkpoints.baseline.values;
  const currentValues = state.checkpoints[selectedCheckpoint].values;

  const handlePrint = () => window.print();

  const buildExportSummary = () => {
    const lines: string[] = [];
    lines.push('URCARE ROOT CAUSE REVERSAL TREATMENT');
    lines.push('7-90 Day Improvement Tracker');
    lines.push('');
    lines.push(`Patient: ${state.patient.patientName || '—'}`);
    lines.push(`Start date: ${state.patient.startDate || '—'}`);
    lines.push(`Care lead: ${state.patient.careLead || '—'}`);
    lines.push(`Primary root causes: ${state.patient.rootCauses || '—'}`);
    lines.push(`Treatment focus: ${state.patient.treatmentFocus || '—'}`);
    lines.push('');
    lines.push(`Improvement score: ${score}/100 (${good} of ${comparable} comparable markers improved or stable)`);
    lines.push(`Measured markers: ${measuredCount}/${TOTAL_MARKERS}`);
    lines.push('');
    CHECKPOINTS.forEach((c) => {
      const cp = state.checkpoints[c.key];
      if (!checkpointHasAnyData(cp)) return;
      lines.push(`--- ${c.label}${cp.date ? ` (${cp.date})` : ''} ---`);
      MARKER_CATEGORIES.forEach((cat) => {
        cat.markers.forEach((m) => {
          const v = cp.values[m.id];
          if (v === '' || v == null) return;
          lines.push(`${m.label}: ${v} ${m.unit}`);
        });
      });
      const n = state.notes[c.key];
      if (n.wins) lines.push(`Wins: ${n.wins}`);
      if (n.barriers) lines.push(`Symptoms/barriers: ${n.barriers}`);
      if (n.actionsCompleted) lines.push(`Root cause actions completed: ${n.actionsCompleted}`);
      if (n.careTeamFollowUp) lines.push(`Care team follow-up: ${n.careTeamFollowUp}`);
      lines.push('');
    });
    return lines.join('\n');
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.patient.patientName || 'urcare-tracker').replace(/\s+/g, '_')}_tracker.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildExportSummary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const TABS: { key: typeof activeTab; label: string; Icon: typeof LayoutGrid }[] = [
    { key: 'overview', label: tr('Overview', 'अवलोकन'), Icon: LayoutGrid },
    { key: 'tracker', label: tr('Tracker', 'ट्रैकर'), Icon: ListChecks },
    { key: 'notes', label: tr('Notes', 'नोट्स'), Icon: StickyNote },
    { key: 'export', label: tr('Export', 'एक्सपोर्ट'), Icon: FileDown },
  ];

  return (
    <div id="urcare-tracker-module" className="min-h-screen bg-[#F8FAFC] text-zinc-900 pb-16">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-5 text-left">

        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <HeartPulse className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <SectionEyebrow>{tr('UrCare Root Cause Reversal Treatment', 'यूआरकेयर रूट कॉज़ रिवर्सल ट्रीटमेंट')}</SectionEyebrow>
              <h1 className="text-2xl font-black text-zinc-950 leading-tight">{tr('7-90 Day Improvement Tracker', '7-90 दिन सुधार ट्रैकर')}</h1>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-600 text-emerald-700 text-sm font-black cursor-pointer hover:bg-emerald-50 transition-colors"
        >
          <Printer className="w-4 h-4" />
          {tr('Print/PDF', 'प्रिंट/पीडीएफ')}
        </button>

        {/* PATIENT DETAILS */}
        <Card className="space-y-4">
          <div>
            <SectionEyebrow>{tr('Patient Progress Record', 'रोगी प्रगति रिकॉर्ड')}</SectionEyebrow>
            <SectionTitle>{tr('Patient and treatment details', 'रोगी व उपचार विवरण')}</SectionTitle>
          </div>

          <div className="text-center py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-black">
            {tr('Saved locally', 'स्थानीय रूप से सहेजा गया')}
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Patient name', 'रोगी का नाम')}</label>
              <input
                type="text"
                value={state.patient.patientName}
                onChange={(e) => updatePatient('patientName', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Start date', 'शुरुआत तिथि')}</label>
              <input
                type="date"
                value={state.patient.startDate}
                onChange={(e) => updatePatient('startDate', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Care lead', 'देखभाल प्रमुख')}</label>
              <input
                type="text"
                value={state.patient.careLead}
                onChange={(e) => updatePatient('careLead', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Primary root causes', 'मुख्य मूल कारण')}</label>
              <input
                type="text"
                value={state.patient.rootCauses}
                onChange={(e) => updatePatient('rootCauses', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-bold focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Treatment focus', 'उपचार केंद्र')}</label>
              <input
                type="text"
                placeholder={tr('Nutrition reset, movement plan, gut repair, medication...', 'पोषण रीसेट, मूवमेंट प्लान, गट रिपेयर, दवा...')}
                value={state.patient.treatmentFocus}
                onChange={(e) => updatePatient('treatmentFocus', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-bold placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </Card>

        {/* TAB BAR */}
        <div className="grid grid-cols-4 gap-1.5 bg-emerald-50/70 p-1.5 rounded-2xl">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black cursor-pointer transition-colors ${
                activeTab === t.key ? 'bg-emerald-700 text-white shadow-sm' : 'text-emerald-700 hover:bg-white/60'
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <SectionEyebrow>{tr('Improvement Score', 'सुधार स्कोर')}</SectionEyebrow>
              <div className="text-4xl font-black text-zinc-950">
                {score}<span className="text-lg text-zinc-400">/100</span>
              </div>
              <p className="text-sm text-zinc-500 font-medium">
                {tr(
                  `${good} of ${comparable} comparable markers are improved or stable.`,
                  `${comparable} में से ${good} तुलनीय मार्कर बेहतर या स्थिर हैं।`
                )}
              </p>
              <div className="pt-1">
                <ScoreRing pct={score} />
              </div>
            </Card>

            <Card className="space-y-1.5">
              <SectionEyebrow>{tr('Latest Checkpoint', 'नवीनतम चेकपॉइंट')}</SectionEyebrow>
              <div className="text-2xl font-black text-zinc-950">{latestCheckpointLabel || tr('No checkpoints yet', 'अभी कोई चेकपॉइंट नहीं')}</div>
              <p className="text-sm text-zinc-500 font-medium">
                {latestCheckpointDate || tr('No checkpoint date yet', 'अभी कोई चेकपॉइंट तिथि नहीं')}
              </p>
            </Card>

            <Card className="space-y-1.5">
              <SectionEyebrow>{tr('Measured Markers', 'मापे गए मार्कर')}</SectionEyebrow>
              <div className="text-2xl font-black text-zinc-950">{measuredCount}/{TOTAL_MARKERS}</div>
              <p className="text-sm text-zinc-500 font-medium">
                {tr('Clinical, energy, symptom, and lifestyle signals.', 'क्लिनिकल, ऊर्जा, लक्षण, और जीवनशैली संकेत।')}
              </p>
            </Card>
          </div>
        )}

        {/* TRACKER TAB */}
        {activeTab === 'tracker' && (
          <div className="space-y-4">
            <div>
              <SectionEyebrow>{tr('Checkpoint Entry', 'चेकपॉइंट एंट्री')}</SectionEyebrow>
              <SectionTitle>{tr('Record biomarkers and daily function', 'बायोमार्कर व दैनिक कार्य दर्ज करें')}</SectionTitle>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Checkpoint date', 'चेकपॉइंट तिथि')}</label>
              <input
                type="date"
                value={state.checkpoints[selectedCheckpoint].date}
                onChange={(e) => updateCheckpointDate(selectedCheckpoint, e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-bold focus:outline-none focus:border-emerald-600 bg-white"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {CHECKPOINTS.map((c) => (
                <PillButton key={c.key} active={selectedCheckpoint === c.key} onClick={() => setSelectedCheckpoint(c.key)}>
                  {c.label}
                </PillButton>
              ))}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <PillButton active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>
                {tr('All', 'सभी')}
              </PillButton>
              {MARKER_CATEGORIES.map((c) => (
                <PillButton key={c.key} active={selectedCategory === c.key} onClick={() => setSelectedCategory(c.key)}>
                  {tr(c.label, c.label)}
                </PillButton>
              ))}
            </div>

            {categoriesToShow.map((cat) => (
              <Card key={cat.key} className="space-y-4">
                <h3 className="text-lg font-black text-zinc-950">{cat.label}</h3>
                <div className="divide-y divide-zinc-100">
                  {cat.markers.map((m) => {
                    const status = markerStatus(m, isBaselineSelected, baselineValues[m.id] ?? '', currentValues[m.id] ?? '');
                    return (
                      <div key={m.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                        <div>
                          <div className="text-base font-black text-zinc-950">{m.label}</div>
                          <div className="text-xs text-zinc-400 font-medium">{m.unit} - {tr('goal', 'लक्ष्य')}: {m.goal === 'higher' ? tr('higher', 'अधिक') : tr('lower', 'कम')}</div>
                        </div>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={currentValues[m.id] ?? ''}
                          onChange={(e) => updateMarkerValue(selectedCheckpoint, m.id, e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-bold focus:outline-none focus:border-emerald-600"
                        />
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${TONE_CLASSES[status.tone]}`}>{status.pillLabel}</span>
                          <span className="text-xs text-zinc-500 font-medium">{status.note}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div>
              <SectionEyebrow>{tr('Care Notes', 'देखभाल नोट्स')}</SectionEyebrow>
              <SectionTitle>{tr('Root cause actions and patient-reported changes', 'मूल कारण कार्य व रोगी-रिपोर्टेड बदलाव')}</SectionTitle>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {CHECKPOINTS.map((c) => (
                <PillButton key={c.key} active={selectedCheckpoint === c.key} onClick={() => setSelectedCheckpoint(c.key)}>
                  {c.label}
                </PillButton>
              ))}
            </div>

            <Card className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Wins and visible improvements', 'जीत व दिखाई देने वाले सुधार')}</label>
                <textarea
                  rows={3}
                  placeholder={tr('More stamina, fewer cravings, improved glucose, better sleep', 'अधिक सहनशक्ति, कम क्रेविंग, बेहतर ग्लूकोज़, बेहतर नींद')}
                  value={state.notes[selectedCheckpoint].wins}
                  onChange={(e) => updateNotes(selectedCheckpoint, 'wins', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-medium placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Symptoms or barriers', 'लक्षण या बाधाएं')}</label>
                <textarea
                  rows={3}
                  placeholder={tr('Fatigue, pain flare, digestion issues, missed meals, travel', 'थकान, दर्द भड़कना, पाचन समस्याएं, छूटे भोजन, यात्रा')}
                  value={state.notes[selectedCheckpoint].barriers}
                  onChange={(e) => updateNotes(selectedCheckpoint, 'barriers', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-medium placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Root cause actions completed', 'पूर्ण किए गए मूल कारण कार्य')}</label>
                <textarea
                  rows={3}
                  placeholder={tr('Meal plan followed, labs reviewed, sleep routine, movement target', 'भोजन योजना पालन की, लैब्स की समीक्षा, नींद रूटीन, मूवमेंट लक्ष्य')}
                  value={state.notes[selectedCheckpoint].actionsCompleted}
                  onChange={(e) => updateNotes(selectedCheckpoint, 'actionsCompleted', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-medium placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-500 mb-1.5">{tr('Care team follow-up', 'देखभाल टीम फॉलो-अप')}</label>
                <textarea
                  rows={3}
                  placeholder={tr('Next appointment, referrals, questions for the doctor', 'अगली अपॉइंटमेंट, रेफरल, डॉक्टर के लिए प्रश्न')}
                  value={state.notes[selectedCheckpoint].careTeamFollowUp}
                  onChange={(e) => updateNotes(selectedCheckpoint, 'careTeamFollowUp', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-zinc-950 font-medium placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600 resize-y"
                />
              </div>
            </Card>
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div>
              <SectionEyebrow>{tr('Export', 'एक्सपोर्ट')}</SectionEyebrow>
              <SectionTitle>{tr('Share or save this progress record', 'यह प्रगति रिकॉर्ड साझा करें या सहेजें')}</SectionTitle>
            </div>

            <Card className="space-y-3">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-black cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                {tr('Print / Save as PDF', 'प्रिंट / पीडीएफ के रूप में सहेजें')}
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-emerald-600 text-emerald-700 text-sm font-black cursor-pointer hover:bg-emerald-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {tr('Download as JSON', 'JSON के रूप में डाउनलोड करें')}
              </button>
              <button
                type="button"
                onClick={handleCopySummary}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-zinc-300 text-zinc-700 text-sm font-black cursor-pointer hover:bg-zinc-50 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? tr('Copied!', 'कॉपी हो गया!') : tr('Copy Summary', 'सारांश कॉपी करें')}
              </button>
            </Card>

            <Card className="space-y-2">
              <SectionEyebrow>{tr('Recorded Checkpoints', 'दर्ज चेकपॉइंट')}</SectionEyebrow>
              {CHECKPOINTS.filter((c) => checkpointHasAnyData(state.checkpoints[c.key])).length === 0 ? (
                <p className="text-sm text-zinc-400 font-medium">{tr('No checkpoints recorded yet.', 'अभी कोई चेकपॉइंट दर्ज नहीं।')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {CHECKPOINTS.filter((c) => checkpointHasAnyData(state.checkpoints[c.key])).map((c) => (
                    <li key={c.key} className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                      <ClipboardList className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {c.label}{state.checkpoints[c.key].date ? ` — ${state.checkpoints[c.key].date}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

      </main>
    </div>
  );
};

import { useMemo, useState, ComponentType } from 'react';
import { HeartPulse, Activity, Gauge, Zap, Wind, FlaskConical, Droplets } from 'lucide-react';
import { UserHealthProfile, MedicalReportAnalysis } from '../types';
import { logActivity } from '../utils/supabase';

// ---------------------------------------------------------------------------
// BIOMARKER TRACKER — DATA LAYER. Reads the user's own onboarding numbers
// (healthDeepDive) and falls back to their uploaded lab reports, classified
// against standard clinical reference ranges. Fully automatic: nothing here
// is invented — a metric the user never entered comes back as "Not Tracked"
// (grey) rather than a guessed value. Extracted out of the original
// BiomarkerTracker card so its data + edit logic can power two completely
// different presentations — the Profile page's card list, and the Tracker
// module's colorful gauge grid — off one shared source of truth instead of
// two copies that could drift apart.
// ---------------------------------------------------------------------------
export type VitalStatus = 'good' | 'attention' | 'high' | 'unknown';

export const VITAL_STATUS_COLOR: Record<VitalStatus, string> = {
  good: '#008000', attention: '#f59e0b', high: '#ef4444', unknown: '#a1a1aa',
};
export const VITAL_STATUS_LABEL: Record<VitalStatus, [string, string]> = {
  good: ['Normal', 'सामान्य'],
  attention: ['Needs Attention', 'ध्यान चाहिए'],
  high: ['High', 'अधिक'],
  unknown: ['Not Tracked', 'ट्रैक नहीं'],
};

function parseNum(v?: string): number | null {
  if (!v) return null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function fastingSugarStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 70) return 'attention';
  if (n <= 99) return 'good';
  if (n <= 125) return 'attention';
  return 'high';
}
function postMealSugarStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 140) return 'good';
  if (n < 200) return 'attention';
  return 'high';
}
function hba1cStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 5.7) return 'good';
  if (n < 6.5) return 'attention';
  return 'high';
}
function bpStatus(v?: string): VitalStatus {
  if (!v) return 'unknown';
  const m = String(v).match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return 'unknown';
  const sys = parseInt(m[1], 10);
  const dia = parseInt(m[2], 10);
  if (sys < 120 && dia < 80) return 'good';
  if (sys < 140 && dia < 90) return 'attention';
  return 'high';
}
function heartRateStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n >= 60 && n <= 100) return 'good';
  if (n >= 50 && n <= 110) return 'attention';
  return 'high';
}
function cholesterolStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n < 200) return 'good';
  if (n < 240) return 'attention';
  return 'high';
}
function spo2Status(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n >= 95) return 'good';
  if (n >= 90) return 'attention';
  return 'high';
}
function creatinineStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n <= 1.3) return 'good';
  if (n <= 2.0) return 'attention';
  return 'high';
}
function uricAcidStatus(v?: string): VitalStatus {
  const n = parseNum(v);
  if (n === null) return 'unknown';
  if (n <= 7.2) return 'good';
  if (n <= 9) return 'attention';
  return 'high';
}

/** Maps a Biomarker's own 'normal'|'low'|'high'|'critical' status (as read
 *  straight off the uploaded report) onto our color notation — trusts the
 *  report's own call rather than re-parsing its value against a generic
 *  range, since the report already knows the right reference range for
 *  that specific test. */
function biomarkerToVitalStatus(status: string): VitalStatus {
  if (status === 'critical') return 'high';
  if (status === 'high' || status === 'low') return 'attention';
  if (status === 'normal') return 'good';
  return 'unknown';
}

/** Finds the first biomarker matching any of `keywords` (case-insensitive
 *  substring) across the user's reports, most recently uploaded first —
 *  so a newer report's reading always wins over an older one. */
function findBiomarker(reports: MedicalReportAnalysis[], keywords: string[]): { value: string; status: VitalStatus; reportName: string } | null {
  const sorted = [...reports].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  for (const report of sorted) {
    for (const b of report.biomarkers || []) {
      const name = (b.name || '').toLowerCase();
      if (keywords.some((k) => name.includes(k))) {
        return { value: b.value, status: biomarkerToVitalStatus(b.status), reportName: report.reportName };
      }
    }
  }
  return null;
}

export interface VitalItem {
  key: string;
  ddKey: string;
  icon: ComponentType<{ className?: string }>;
  placeholder: string;
  label: string;
  hint: string;
  rawValue: string;
  value: string | null;
  status: VitalStatus;
  source: 'onboarding' | 'report' | 'unknown';
  sourceReportName?: string;
}

/** The shared data + edit logic behind every "Biomarker Tracker" surface in
 *  the app. Editing a vital writes straight back into
 *  profile.healthDeepDive — the same field onboarding and the Root Cause
 *  Assessment both read — so a value fixed in either presentation is
 *  instantly the value every module sees, never a separate copy. */
export function useBiomarkerVitals(
  profile: UserHealthProfile,
  reports: MedicalReportAnalysis[],
  onUpdateProfile: (updated: UserHealthProfile) => void,
  tr: (en: string, hi: string) => string,
) {
  const userId = profile.id || '';
  const dd: any = profile.healthDeepDive || {};
  const hasThyroidCondition = (profile.medicalConditions || []).includes('Thyroid (Hypo/Hyper)');
  const [editingVital, setEditingVital] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingVital, setIsSavingVital] = useState(false);

  const vitals: VitalItem[] = useMemo(() => {
    // ddKey → { value, status, source, unit } — a report only fills in what
    // onboarding left blank; a value the user typed always wins.
    const resolve = (
      ddKey: string,
      unit: string,
      statusFn: (v?: string) => VitalStatus,
      keywords: string[],
    ) => {
      const ddRaw = dd[ddKey];
      if (ddRaw) {
        return { rawValue: String(ddRaw), value: `${ddRaw}${unit}`, status: statusFn(String(ddRaw)), source: 'onboarding' as const, sourceReportName: undefined as string | undefined };
      }
      const match = findBiomarker(reports, keywords);
      if (match) {
        return { rawValue: match.value.replace(/[^\d.\-/]/g, ''), value: match.value, status: match.status, source: 'report' as const, sourceReportName: match.reportName };
      }
      return { rawValue: '', value: null as string | null, status: 'unknown' as VitalStatus, source: 'unknown' as const, sourceReportName: undefined as string | undefined };
    };

    return [
      {
        key: 'fastingSugar', ddKey: 'fastingSugar', icon: Droplets, placeholder: 'e.g. 95',
        label: tr('Fasting Blood Sugar', 'फास्टिंग ब्लड शुगर'),
        hint: tr('Normal: 70–99 mg/dL', 'सामान्य: 70–99 mg/dL'),
        ...resolve('fastingSugar', ' mg/dL', fastingSugarStatus, ['fasting glucose', 'fasting blood sugar', 'fasting plasma glucose', 'fpg']),
      },
      {
        key: 'postMealSugar', ddKey: 'postMealSugar', icon: Droplets, placeholder: 'e.g. 130',
        label: tr('Post-Meal Blood Sugar', 'भोजन-बाद ब्लड शुगर'),
        hint: tr('Normal: below 140 mg/dL', 'सामान्य: 140 mg/dL से कम'),
        ...resolve('postMealSugar', ' mg/dL', postMealSugarStatus, ['post prandial', 'postprandial', 'pp glucose', 'post meal glucose', 'ppbs']),
      },
      {
        key: 'hba1c', ddKey: 'hba1c', icon: Gauge, placeholder: 'e.g. 5.6',
        label: tr('HbA1c', 'HbA1c'),
        hint: tr('Normal: below 5.7%', 'सामान्य: 5.7% से कम'),
        ...resolve('hba1c', '%', hba1cStatus, ['hba1c', 'glycated hemoglobin', 'a1c']),
      },
      {
        key: 'bloodPressure', ddKey: 'bloodPressure', icon: Activity, placeholder: 'e.g. 120/80',
        label: tr('Blood Pressure', 'ब्लड प्रेशर'),
        hint: tr('Normal: below 120/80 mmHg', 'सामान्य: 120/80 mmHg से कम'),
        ...resolve('bloodPressure', ' mmHg', bpStatus, ['blood pressure', ' bp ', 'bp:']),
      },
      {
        key: 'restingHeartRate', ddKey: 'restingHeartRate', icon: HeartPulse, placeholder: 'e.g. 72',
        label: tr('Resting Heart Rate', 'आराम में हृदय गति'),
        hint: tr('Normal: 60–100 bpm', 'सामान्य: 60–100 bpm'),
        ...resolve('restingHeartRate', ' bpm', heartRateStatus, ['heart rate', 'pulse rate', 'pulse']),
      },
      {
        key: 'totalCholesterol', ddKey: 'totalCholesterol', icon: FlaskConical, placeholder: 'e.g. 180',
        label: tr('Total Cholesterol', 'कुल कोलेस्ट्रॉल'),
        hint: tr('Normal: below 200 mg/dL', 'सामान्य: 200 mg/dL से कम'),
        ...resolve('totalCholesterol', ' mg/dL', cholesterolStatus, ['total cholesterol', 'cholesterol']),
      },
      {
        key: 'spo2', ddKey: 'spo2', icon: Wind, placeholder: 'e.g. 98',
        label: tr('Oxygen Saturation (SpO2)', 'ऑक्सीजन सैचुरेशन (SpO2)'),
        hint: tr('Normal: 95% and above', 'सामान्य: 95% व अधिक'),
        ...resolve('spo2', '%', spo2Status, ['spo2', 'oxygen saturation', 'sp02']),
      },
      {
        key: 'creatinine', ddKey: 'creatinine', icon: FlaskConical, placeholder: 'e.g. 0.9',
        label: tr('Creatinine (Kidney)', 'क्रिएटिनिन (किडनी)'),
        hint: tr('Normal: 0.6–1.3 mg/dL', 'सामान्य: 0.6–1.3 mg/dL'),
        ...resolve('creatinine', ' mg/dL', creatinineStatus, ['creatinine']),
      },
      {
        key: 'uricAcid', ddKey: 'uricAcid', icon: FlaskConical, placeholder: 'e.g. 5.5',
        label: tr('Uric Acid', 'यूरिक एसिड'),
        hint: tr('Normal: below 7.2 mg/dL', 'सामान्य: 7.2 mg/dL से कम'),
        ...resolve('uricAcid', ' mg/dL', uricAcidStatus, ['uric acid']),
      },
      {
        key: 'thyroid', ddKey: '', icon: Zap, placeholder: '',
        label: tr('Thyroid Status', 'थायरॉइड स्थिति'),
        hint: tr('Based on your reported conditions', 'आपकी दर्ज स्थितियों पर आधारित'),
        rawValue: '',
        value: hasThyroidCondition ? tr('Condition Reported', 'स्थिति दर्ज') : tr('No Concerns Flagged', 'कोई चिंता नहीं मिली'),
        status: hasThyroidCondition ? 'attention' as VitalStatus : 'good' as VitalStatus,
        source: 'onboarding' as const,
        sourceReportName: undefined as string | undefined,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tr` closes over `language`, and dd/reports are the real dependencies
  }, [dd, reports, hasThyroidCondition]);

  const startEditVital = (key: string, rawValue: string) => {
    setEditValue(rawValue);
    setEditingVital(key);
  };

  const cancelEdit = () => setEditingVital(null);

  // Writes straight into profile.healthDeepDive — see the module doc above.
  const handleSaveVital = (ddKey: string, label: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingVital(null); return; }
    setIsSavingVital(true);
    onUpdateProfile({
      ...profile,
      healthDeepDive: { ...dd, [ddKey]: trimmed },
    });
    if (userId) logActivity(userId, 'updated', 'profile', tr(`Updated ${label}`, `${label} अपडेट किया`)).catch(() => {});
    setIsSavingVital(false);
    setEditingVital(null);
  };

  return { vitals, editingVital, editValue, setEditValue, isSavingVital, startEditVital, cancelEdit, handleSaveVital };
}

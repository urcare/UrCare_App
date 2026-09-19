import React, { useEffect, useState } from 'react';
import { FileText, Stethoscope, Utensils, ClipboardList, File as FileIcon, Download, ShieldCheck } from 'lucide-react';
import { AdminUserFile, UserPersonalizedPlan } from '../types';
import { getMyAdminFiles, getMyPersonalizedPlan } from '../utils/supabase';

interface MyCareFilesPanelProps {
  userId: string;
  tr: (en: string, hi: string) => string;
}

const FILE_TYPE_META: Record<AdminUserFile['fileType'], { label: [string, string]; Icon: typeof FileText }> = {
  diagnosis: { label: ['Diagnosis', 'निदान'], Icon: Stethoscope },
  reports: { label: ['Report', 'रिपोर्ट'], Icon: FileText },
  treatment_plan: { label: ['Treatment Plan', 'उपचार योजना'], Icon: ClipboardList },
  diet_plan: { label: ['Diet Plan', 'आहार योजना'], Icon: Utensils },
  other: { label: ['Document', 'दस्तावेज़'], Icon: FileIcon },
};

const PLAN_FIELDS: { key: keyof UserPersonalizedPlan; label: [string, string] }[] = [
  { key: 'diagnosis', label: ['Diagnosis', 'निदान'] },
  { key: 'treatmentPlan', label: ['Treatment / Recovery Plan', 'उपचार / रिकवरी योजना'] },
  { key: 'foodPlan', label: ['Food Plan', 'भोजन योजना'] },
  { key: 'dailyRoutine', label: ['Daily Routine', 'दैनिक दिनचर्या'] },
  { key: 'shoppingList', label: ['Shopping List', 'खरीदारी सूची'] },
  { key: 'otherInstructions', label: ['Other Instructions', 'अन्य निर्देश'] },
];

/** A user's own admin-assigned documents (diagnosis, reports, treatment/
 *  diet plans) and hand-written personalized care plan — both entered by an
 *  admin (see AdminDashboard's Patients tab) and visible ONLY to this one
 *  user (enforced by RLS on admin_user_files / user_personalized_plans, not
 *  just by not showing a link to it). Renders nothing at all if the admin
 *  hasn't assigned anything yet — never an empty placeholder card. */
export const MyCareFilesPanel: React.FC<MyCareFilesPanelProps> = ({ userId, tr }) => {
  const [files, setFiles] = useState<AdminUserFile[]>([]);
  const [plan, setPlan] = useState<UserPersonalizedPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([getMyAdminFiles(userId), getMyPersonalizedPlan(userId)]).then(([f, p]) => {
      if (cancelled) return;
      setFiles(f);
      setPlan(p);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (!loaded) return null;

  const planFieldsWithContent = plan ? PLAN_FIELDS.filter((f) => (plan[f.key] as string)?.trim()) : [];
  const hasPlan = planFieldsWithContent.length > 0;
  const hasFiles = files.length > 0;
  if (!hasPlan && !hasFiles) return null;

  const cardClass = 'bg-white border border-zinc-200 shadow-sm';

  return (
    <div className="space-y-4">
      {hasPlan && (
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950">{tr('Your Personalized Plan', 'आपकी व्यक्तिगत योजना')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{tr('Written for you by your care team.', 'आपके केयर टीम द्वारा आपके लिए लिखी गई।')}</p>
            </div>
          </div>
          <div className="space-y-3">
            {planFieldsWithContent.map((f) => (
              <div key={f.key} className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{tr(f.label[0], f.label[1])}</span>
                <p className="text-sm text-zinc-800 font-medium mt-1 whitespace-pre-wrap">{plan![f.key] as string}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasFiles && (
        <div className={`p-5 sm:p-6 rounded-3xl ${cardClass} space-y-4`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950">{tr('Files From Your Care Team', 'आपके केयर टीम की फाइलें')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{tr('Only visible to you.', 'सिर्फ आपको दिखाई देता है।')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {files.map((f) => {
              const meta = FILE_TYPE_META[f.fileType] || FILE_TYPE_META.other;
              return (
                <a
                  key={f.id}
                  href={f.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-emerald-600 flex items-center justify-center shrink-0">
                    <meta.Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-zinc-900 truncate">{f.title}</div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <span>{tr(meta.label[0], meta.label[1])}</span>
                      <span>·</span>
                      <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-zinc-400 shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

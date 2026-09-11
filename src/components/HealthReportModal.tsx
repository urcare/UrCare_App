import React, { useMemo, useState } from 'react';
import { X, HeartPulse, Check, Plus, ChevronDown, FileText } from 'lucide-react';
import { MedicalReportAnalysis } from '../types';
import { ReportUploader } from './ReportUploader';
import { ReportPhotoViewer } from './ReportPhotoViewer';
import { playClickSound, playSuccessChime } from '../utils/soundEffects';
import { useLanguage } from '../context/LanguageContext';

interface HealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The most recently uploaded/active report — folded into `reports` below
   *  (deduped by id) so it always shows in the timeline even if the caller
   *  hasn't re-fetched the full list yet. */
  reportAnalysis?: MedicalReportAnalysis;
  /** Every report this user has ever submitted — the real history behind
   *  the timeline below, not just the one active report. */
  reports?: MedicalReportAnalysis[];
  onUpdateReport: (analysis: MedicalReportAnalysis, addedConditions?: string[]) => void;
  onDeleteReport?: (reportId?: string, reportName?: string) => void;
  onRequestDoctorReview?: (reason?: string) => void;
  onSaveReportText?: (reportId: string, reportName: string | undefined, newText: string) => Promise<void>;
  userAccount?: { uid?: string; displayName?: string; email?: string } | null;
}

/** Full "12 Sep 2026 · 10:53 PM" — day, month, year AND time together, so a
 *  report's timeline entry is never ambiguous about when it was uploaded. */
function formatFullDateTime(iso: string, language: string): string {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(language === 'hi' ? 'hi-IN' : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString(language === 'hi' ? 'hi-IN' : undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

export const HealthReportModal: React.FC<HealthReportModalProps> = ({
  isOpen,
  onClose,
  reportAnalysis,
  reports = [],
  onUpdateReport,
  onDeleteReport,
  onRequestDoctorReview,
  onSaveReportText,
  userAccount,
}) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  // Merge the "currently active" report into the full history (deduped by
  // id) and sort newest-first — this IS the real, complete submission log,
  // not a separate view of it.
  const allReports = useMemo(() => {
    const merged = [...reports];
    if (reportAnalysis && !merged.find((r) => r.id === reportAnalysis.id)) merged.unshift(reportAnalysis);
    return merged.slice().sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
  }, [reports, reportAnalysis]);

  const [isUploadingNew, setIsUploadingNew] = useState(allReports.length === 0);
  const [expandedId, setExpandedId] = useState<string | null>(allReports[0]?.id || null);

  if (!isOpen) return null;

  const handleDone = () => {
    playSuccessChime();
    onClose();
  };

  const toggleExpanded = (id: string | undefined) => {
    if (!id) return;
    playClickSound(600);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Same real server-enforced cap as the full Reports tab (see
  // /api/analyze-report) — surfaced here too so this modal never lets
  // someone start an upload that's just going to be rejected.
  const reportLimitReached = allReports.length >= 2;

  return (
    <div id="health-report-modal-backdrop" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="health-report-modal" className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">

        {/* Header with Title and Close Action */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">{tr('Diagnostic Health Reports', 'डायग्नोस्टिक स्वास्थ्य रिपोर्ट्स')}</h3>
              <p className="text-xs text-zinc-400">{tr('Uploaded medical reports & clinical lab documents', 'अपलोड की गई मेडिकल रिपोर्ट्स व क्लिनिकल लैब दस्तावेज़')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isUploadingNew ? (
          <div className="space-y-4">
            {allReports.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  playClickSound(600);
                  setIsUploadingNew(false);
                }}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 mb-2 cursor-pointer"
              >
                ← {tr('Back to report history', 'रिपोर्ट इतिहास पर वापस जाएं')}
              </button>
            )}
            <ReportUploader
              standalone
              userAccount={userAccount}
              onDone={handleDone}
              onReportAnalyzed={(data, addedConditions) => {
                onUpdateReport(data, addedConditions);
                setExpandedId(data.id || null);
                setIsUploadingNew(false);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {!reportLimitReached && (
              <button
                type="button"
                onClick={() => { playClickSound(600); setIsUploadingNew(true); }}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{tr('Upload a New Report', 'नई रिपोर्ट अपलोड करें')}</span>
              </button>
            )}
            {reportLimitReached && (
              <p className="text-[11px] text-zinc-500 text-center">
                {tr('Maximum 2 reports on file — delete one below to upload a new one.', 'अधिकतम 2 रिपोर्ट्स दर्ज हैं — नई अपलोड करने के लिए नीचे से एक हटाएं।')}
              </p>
            )}

            {/* Report Timeline — every report this user has ever submitted,
                newest first, collapsed to just its name + full date & time
                until tapped — mirrors My Timeline's commit-graph styling
                (connecting line, one dot per entry) so report history reads
                the same way everywhere in the app. */}
            {allReports.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
                <FileText className="w-7 h-7 text-zinc-600 mx-auto" />
                <p className="text-sm font-bold text-zinc-300">{tr('No Reports Uploaded Yet', 'अभी तक कोई रिपोर्ट अपलोड नहीं की गई')}</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {tr('Upload a photo or document with fasting sugar, HbA1c, or lipid panel to receive personalized guidance.', 'व्यक्तिगत मार्गदर्शन पाने हेतु फास्टिंग शुगर, HbA1c, या लिपिड पैनल के साथ फोटो या दस्तावेज़ अपलोड करें।')}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-0.5 pb-1">
                  {tr('Report History', 'रिपोर्ट इतिहास')} ({allReports.length})
                </h4>
                <div className="relative">
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-zinc-800" aria-hidden="true" />
                  <div className="space-y-2">
                    {allReports.map((report) => {
                      const open = expandedId === report.id;
                      return (
                        <div key={report.id} className="relative pl-6">
                          <span className="absolute left-0 top-3 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-zinc-950" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => toggleExpanded(report.id)}
                            className="w-full text-left p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 transition-colors cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{report.reportName}</p>
                              {report.uploadedAt && (
                                <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">{formatFullDateTime(report.uploadedAt, language)}</p>
                              )}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>

                          {open && (
                            <div className="mt-2">
                              <ReportPhotoViewer
                                report={report}
                                onReupload={() => { playClickSound(600); setIsUploadingNew(true); }}
                                onRequestDoctorReview={onRequestDoctorReview ? () => onRequestDoctorReview('Review my uploaded lab report and calibrate medications') : undefined}
                                onDelete={onDeleteReport ? () => onDeleteReport(report.id, report.reportName) : undefined}
                                onSaveReportText={onSaveReportText && report.id ? (text) => onSaveReportText(report.id!, report.reportName, text) : undefined}
                                userName={userAccount?.displayName || tr('Member Patient', 'सदस्य रोगी')}
                                theme="dark"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Done Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDone}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{tr('Done • Return to Dashboard', 'पूर्ण • डैशबोर्ड पर वापस जाएं')}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, RefreshCw, Stethoscope, Calendar, User, Hash,
  ZoomIn, Check, Trash2, X, Edit3, Loader2, ClipboardCheck,
} from 'lucide-react';
import { MedicalReportAnalysis } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface ReportPhotoViewerProps {
  report: MedicalReportAnalysis;
  onReupload: () => void;
  onRequestDoctorReview?: () => void;
  onDelete?: () => void;
  /** Persists an edited "extracted report data" text back to this report's
   *  real record. Omit to render that section read-only. */
  onSaveReportText?: (newText: string) => Promise<void>;
  userName?: string;
  theme?: 'light' | 'dark';
}

/** The real extracted content, as text — biomarkers first (structured data
 *  from the AI's analysis), falling back to the summary. Never invented:
 *  if neither exists, there's simply nothing to show. */
function extractedTextFor(report: MedicalReportAnalysis): string {
  if (report.biomarkers && report.biomarkers.length > 0) {
    return report.biomarkers
      .map((b) => `${b.name}: ${b.value}${b.referenceRange ? ` (Ref: ${b.referenceRange})` : ''}`)
      .join('\n');
  }
  return report.summary || '';
}

export const ReportPhotoViewer: React.FC<ReportPhotoViewerProps> = ({
  report,
  onReupload,
  onRequestDoctorReview,
  onDelete,
  onSaveReportText,
  userName,
  theme = 'light',
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState(() => report.reportText || extractedTextFor(report));
  const [isSavingText, setIsSavingText] = useState(false);
  const isDark = theme === 'dark';
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const resolvedUserName = userName || tr('Member Patient', 'सदस्य रोगी');

  const handleSaveText = async () => {
    if (!onSaveReportText) return;
    setIsSavingText(true);
    try {
      await onSaveReportText(editedText);
      setIsEditingText(false);
    } finally {
      setIsSavingText(false);
    }
  };

  const handleDeleteClick = () => {
    if (!onDelete) return;
    if (window.confirm(tr(`Delete "${report.reportName || 'this report'}"? This cannot be undone.`, `"${report.reportName || 'इस रिपोर्ट'}" को हटाएं? यह पूर्ववत नहीं किया जा सकता।`))) {
      onDelete();
    }
  };

  const formattedDate = report.uploadedAt
    ? new Date(report.uploadedAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : tr('Recent', 'हाल ही में');

  return (
    <div className={`w-full rounded-3xl overflow-hidden border transition-all ${
      isDark 
        ? 'bg-zinc-950 border-zinc-800 text-white shadow-xl' 
        : 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
    }`}>
      
      {/* Top Header Bar */}
      <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b ${
        isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/70'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base sm:text-lg font-black tracking-tight">{report.reportName || tr('Diagnostic Lab Report', 'डायग्नोस्टिक लैब रिपोर्ट')}</h4>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                {tr('Uploaded', 'अपलोड की गई')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-400" />
                {tr('Diagnostic Date:', 'निदान तिथि:')} {formattedDate}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Hash className="w-3 h-3 text-zinc-400" />
                ID: {report.id || 'rep_active'}
              </span>
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReupload}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200'
            }`}
            title={tr('Re-upload or change report', 'रिपोर्ट फिर से अपलोड करें या बदलें')}
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span>{tr('Re-upload / Edit', 'फिर से अपलोड / संपादित करें')}</span>
          </button>

          {onRequestDoctorReview && (
            <button
              type="button"
              onClick={onRequestDoctorReview}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{tr('Doctor Review', 'डॉक्टर समीक्षा')}</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isDark
                  ? 'bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/40'
                  : 'bg-zinc-100 hover:bg-rose-50 text-zinc-500 hover:text-rose-600 border border-zinc-200 hover:border-rose-200'
              }`}
              title={tr('Delete this report', 'यह रिपोर्ट हटाएं')}
              aria-label={tr('Delete this report', 'यह रिपोर्ट हटाएं')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content: The Photo with Text Written On It */}
      <div className="p-4 sm:p-6 space-y-4">
        
        {/* The Photo Container */}
        <div className="relative rounded-2xl overflow-hidden border border-zinc-200/80 bg-zinc-900 shadow-md group">
          
          {report.imageUrl ? (
            /* User Uploaded Photo */
            <div className="relative flex flex-col items-center justify-center min-h-[260px] max-h-[440px] bg-black/90 overflow-hidden">
              <img
                src={report.imageUrl}
                alt="Diagnostic Lab Report Photo"
                className="w-full h-full object-contain cursor-zoom-in"
                onClick={() => setIsLightboxOpen(true)}
              />

              {/* Text Written / Overlaid on the Photo */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{report.reportName}</span>
                  <span className="text-[10px] text-zinc-300 font-mono">({formattedDate})</span>
                </div>

                <div className="px-3 py-1 rounded-xl bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                  {tr('VERIFIED LAB RECORD', 'सत्यापित लैब रिकॉर्ड')}
                </div>
              </div>

              {/* Bottom text banner on photo */}
              <div className="absolute bottom-3 left-3 right-3 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-white text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-zinc-300">
                  <User className="w-3 h-3 text-emerald-400" />
                  <span>{tr('Patient:', 'रोगी:')} <strong>{report.userName || resolvedUserName}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white flex items-center gap-1 pointer-events-auto cursor-pointer"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>{tr('Zoom Photo', 'फोटो ज़ूम करें')}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Document Photo Sheet (when text or document was submitted) */
            <div className="relative p-6 sm:p-8 bg-gradient-to-b from-white to-zinc-50 text-zinc-900 border border-zinc-200 select-text">
              
              {/* Document Letterhead */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-emerald-600 gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-lg tracking-tight text-zinc-950">Ur</span>
                    <span className="font-black text-lg tracking-tight text-emerald-600">Care</span>
                    <span className="text-xs font-bold text-zinc-500 uppercase ml-2 pl-2 border-l border-zinc-300">{tr('Clinical Pathology & Diagnostics', 'क्लिनिकल पैथोलॉजी व डायग्नोस्टिक्स')}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{tr('Accredited Clinical Lab • Digital Diagnostic Record Sheet', 'मान्यता प्राप्त क्लिनिकल लैब • डिजिटल डायग्नोस्टिक रिकॉर्ड शीट')}</p>
                </div>

                <div className="text-right text-xs">
                  <div className="font-mono text-[11px] text-zinc-600">{tr('Date:', 'तिथि:')} <strong>{formattedDate}</strong></div>
                  <div className="font-mono text-[10px] text-zinc-400">{tr('Ref ID:', 'संदर्भ ID:')} {report.id || 'REP-87612'}</div>
                </div>
              </div>

              {/* Patient Meta Block */}
              <div className="my-4 p-3 rounded-xl bg-zinc-100/80 border border-zinc-200 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">{tr('Patient Name', 'रोगी का नाम')}</span>
                  <span className="font-black text-zinc-900">{report.userName || resolvedUserName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">{tr('Test Category', 'जांच श्रेणी')}</span>
                  <span className="font-bold text-emerald-800">{report.reportName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">{tr('Submission Status', 'सबमिशन स्थिति')}</span>
                  <span className="font-bold text-zinc-800">{tr('Recorded & On File', 'दर्ज व फाइल में सुरक्षित')}</span>
                </div>
              </div>

              {/* Official Stamp on the Document */}
              <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full border-2 border-emerald-600 border-dashed flex items-center justify-center text-emerald-700 text-[9px] font-black uppercase text-center rotate-[-6deg]">
                    {tr('VERIFIED', 'सत्यापित')}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    <span className="font-bold text-zinc-800 block">Dr. Alok Sharma, MD</span>
                    {tr('Consulting Diabetologist & Clinical Nutritionist', 'परामर्शदाता डायबिटोलॉजिस्ट व क्लिनिकल न्यूट्रिशनिस्ट')}
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                  {tr('Official Record Filed', 'आधिकारिक रिकॉर्ड दर्ज')}
                </span>
              </div>

            </div>
          )}

        </div>

        {/* Extracted Report Data — the real values the AI read off this
            report, shown as text (not just baked into the photo above), and
            editable: if the OCR/AI got something wrong, the user can fix it
            here instead of having no way to correct it. Shown for every
            report, photo-based or text-based, instead of only text-based
            ones having this section before. */}
        <div className="rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {tr('Extracted Report Data', 'निकाला गया रिपोर्ट डेटा')}
            </span>
            {onSaveReportText && !isEditingText && (
              <button
                type="button"
                onClick={() => { setEditedText(report.reportText || extractedTextFor(report)); setIsEditingText(true); }}
                className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:border-emerald-300 text-[11px] font-bold text-zinc-600 hover:text-emerald-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                {tr('Edit', 'संपादित करें')}
              </button>
            )}
          </div>

          <div className="p-4">
            {isEditingText ? (
              <div className="space-y-2.5">
                <textarea
                  autoFocus
                  rows={7}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-zinc-300 bg-white font-mono text-xs text-zinc-800 leading-relaxed focus:border-emerald-500 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingText(false)}
                    disabled={isSavingText}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-600 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {tr('Cancel', 'रद्द करें')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveText}
                    disabled={isSavingText}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isSavingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {tr('Save', 'सहेजें')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs text-zinc-700 whitespace-pre-line leading-relaxed">
                {editedText || tr('No extracted data available for this report.', 'इस रिपोर्ट के लिए कोई डेटा उपलब्ध नहीं है।')}
              </p>
            )}
          </div>
        </div>

        {/* Daily Plan Impact — a real, honest, point-wise breakdown of what
            THIS report did to the user's Daily Plan focus (see
            /api/analyze-report's deterministic condition-tag derivation).
            Computed once at upload time and never recomputed differently
            later, so this always tells the true story of what happened —
            older reports uploaded before this existed simply have nothing
            to show here, rather than a guessed answer. */}
        {report.recommendedConditions && report.recommendedConditions.length > 0 ? (
          <div className="rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5" />
                {tr('Daily Plan Impact', 'डेली प्लान पर प्रभाव')}
              </span>
            </div>
            <div className="p-4 space-y-3.5 text-xs">
              <div>
                <p className="font-black text-zinc-700 mb-1.5">{tr('1. Recommended by this report:', '1. इस रिपोर्ट के अनुसार अनुशंसित:')}</p>
                <ul className="space-y-1">
                  {report.recommendedConditions.map((c) => (
                    <li key={c} className="flex items-center gap-1.5 text-zinc-700">
                      <span className="w-1 h-1 rounded-full bg-zinc-400 shrink-0" />{c}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-black text-emerald-700 mb-1.5">{tr('2. Added to your Daily Plan:', '2. आपकी डेली प्लान में जोड़ा गया:')}</p>
                {report.addedConditions && report.addedConditions.length > 0 ? (
                  <ul className="space-y-1">
                    {report.addedConditions.map((c) => (
                      <li key={c} className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3 h-3 shrink-0" />{c}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-400">{tr('Nothing new — already covered below.', 'कुछ नया नहीं — पहले से नीचे शामिल है।')}</p>
                )}
              </div>

              <div>
                <p className="font-black text-zinc-500 mb-1.5">{tr('3. Already on your profile:', '3. आपकी प्रोफ़ाइल में पहले से:')}</p>
                {(() => {
                  const alreadyOnFile = (report.preExistingConditions || []).filter((c) => report.recommendedConditions!.includes(c));
                  return alreadyOnFile.length > 0 ? (
                    <ul className="space-y-1">
                      {alreadyOnFile.map((c) => (
                        <li key={c} className="flex items-center gap-1.5 text-zinc-600">
                          <span className="w-1 h-1 rounded-full bg-zinc-300 shrink-0" />{c}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-400">{tr('None yet.', 'अभी तक कोई नहीं।')}</p>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : report.recommendedConditions ? (
          <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 flex items-center gap-2">
            <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
            {tr('No specific Daily Plan condition was flagged by this report — everything checked out normal.', 'इस रिपोर्ट से कोई विशेष डेली प्लान स्थिति चिह्नित नहीं हुई — सब कुछ सामान्य पाया गया।')}
          </div>
        ) : null}

        {/* Doctor Consultation Notes (if doctor in admin has issued remarks) */}
        {report.adminNotes && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 text-xs text-zinc-900">
            <span className="font-extrabold text-amber-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-amber-700" />
              {tr('Doctor Consultation Remarks', 'डॉक्टर परामर्श टिप्पणी')}
            </span>
            <p className="text-zinc-800 font-medium leading-relaxed">{report.adminNotes}</p>
          </div>
        )}

      </div>

      {/* Full-screen photo lightbox — clicking the photo (or "Zoom Photo")
          now actually opens it full-screen instead of a small in-place
          1.25x scale within the card's own constrained height. */}
      {report.imageUrl && isLightboxOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            title={tr('Close', 'बंद करें')}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={report.imageUrl}
            alt="Diagnostic Lab Report Photo"
            className="max-w-full max-h-full object-contain cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

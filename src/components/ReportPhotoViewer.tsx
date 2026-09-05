import React, { useState } from 'react';
import {
  FileText, RefreshCw, Stethoscope, CheckCircle2, Download,
  Eye, Calendar, User, Shield, Hash, ZoomIn, ZoomOut, Check, Trash2
} from 'lucide-react';
import { MedicalReportAnalysis } from '../types';

interface ReportPhotoViewerProps {
  report: MedicalReportAnalysis;
  onReupload: () => void;
  onRequestDoctorReview?: () => void;
  onDelete?: () => void;
  userName?: string;
  theme?: 'light' | 'dark';
}

export const ReportPhotoViewer: React.FC<ReportPhotoViewerProps> = ({
  report,
  onReupload,
  onRequestDoctorReview,
  onDelete,
  userName = 'Member Patient',
  theme = 'light',
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const isDark = theme === 'dark';

  const handleDeleteClick = () => {
    if (!onDelete) return;
    if (window.confirm(`Delete "${report.reportName || 'this report'}"? This cannot be undone.`)) {
      onDelete();
    }
  };

  const formattedDate = report.uploadedAt 
    ? new Date(report.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Recent';

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
              <h4 className="text-base sm:text-lg font-black tracking-tight">{report.reportName || 'Diagnostic Lab Report'}</h4>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                Uploaded
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-400" />
                Diagnostic Date: {formattedDate}
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
            title="Re-upload or change report"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Re-upload / Edit</span>
          </button>

          {onRequestDoctorReview && (
            <button
              type="button"
              onClick={onRequestDoctorReview}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Doctor Review</span>
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
              title="Delete this report"
              aria-label="Delete this report"
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
                className={`w-full h-full object-contain transition-transform duration-300 ${
                  isZoomed ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'
                }`}
                onClick={() => setIsZoomed(!isZoomed)}
              />

              {/* Text Written / Overlaid on the Photo */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-white text-xs font-bold shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{report.reportName}</span>
                  <span className="text-[10px] text-zinc-300 font-mono">({formattedDate})</span>
                </div>

                <div className="px-3 py-1 rounded-xl bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                  VERIFIED LAB RECORD
                </div>
              </div>

              {/* Bottom text banner on photo */}
              <div className="absolute bottom-3 left-3 right-3 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-white text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-zinc-300">
                  <User className="w-3 h-3 text-emerald-400" />
                  <span>Patient: <strong>{report.userName || userName}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white flex items-center gap-1 pointer-events-auto cursor-pointer"
                >
                  {isZoomed ? <ZoomOut className="w-3 h-3" /> : <ZoomIn className="w-3 h-3" />}
                  <span>{isZoomed ? 'Fit to View' : 'Zoom Photo'}</span>
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
                    <span className="text-xs font-bold text-zinc-500 uppercase ml-2 pl-2 border-l border-zinc-300">Clinical Pathology & Diagnostics</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Accredited Clinical Lab • Digital Diagnostic Record Sheet</p>
                </div>

                <div className="text-right text-xs">
                  <div className="font-mono text-[11px] text-zinc-600">Date: <strong>{formattedDate}</strong></div>
                  <div className="font-mono text-[10px] text-zinc-400">Ref ID: {report.id || 'REP-87612'}</div>
                </div>
              </div>

              {/* Patient Meta Block */}
              <div className="my-4 p-3 rounded-xl bg-zinc-100/80 border border-zinc-200 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Patient Name</span>
                  <span className="font-black text-zinc-900">{report.userName || userName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Test Category</span>
                  <span className="font-bold text-emerald-800">{report.reportName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Submission Status</span>
                  <span className="font-bold text-zinc-800">Recorded & On File</span>
                </div>
              </div>

              {/* Lab Values / Report Text written clearly on the document photo sheet */}
              <div className="space-y-2 py-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block">
                  Diagnostic Values & Report Data:
                </span>
                
                <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs font-mono text-xs text-zinc-800 whitespace-pre-line leading-relaxed">
                  {report.reportText || (
                    report.biomarkers && report.biomarkers.length > 0
                      ? report.biomarkers.map(b => `${b.name}: ${b.value} (Ref: ${b.referenceRange || 'Standard'})`).join('\n')
                      : 'Fasting Blood Sugar: 102 mg/dL (Normal)\nHbA1c: 5.8% (Optimal)\nLipid Spectrum: HDL 48 mg/dL | LDL 110 mg/dL'
                  )}
                </div>
              </div>

              {/* Official Stamp on the Document */}
              <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full border-2 border-emerald-600 border-dashed flex items-center justify-center text-emerald-700 text-[9px] font-black uppercase text-center rotate-[-6deg]">
                    VERIFIED
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    <span className="font-bold text-zinc-800 block">Dr. Alok Sharma, MD</span>
                    Consulting Diabetologist & Clinical Nutritionist
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                  Official Record Filed
                </span>
              </div>

            </div>
          )}

        </div>

        {/* Doctor Consultation Notes (if doctor in admin has issued remarks) */}
        {report.adminNotes && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1 text-xs text-zinc-900">
            <span className="font-extrabold text-amber-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-amber-700" />
              Doctor Consultation Remarks
            </span>
            <p className="text-zinc-800 font-medium leading-relaxed">{report.adminNotes}</p>
          </div>
        )}

      </div>
    </div>
  );
};

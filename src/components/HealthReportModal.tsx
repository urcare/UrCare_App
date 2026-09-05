import React, { useState } from 'react';
import { X, HeartPulse, Check } from 'lucide-react';
import { MedicalReportAnalysis } from '../types';
import { ReportUploader } from './ReportUploader';
import { ReportPhotoViewer } from './ReportPhotoViewer';
import { playClickSound, playSuccessChime } from '../utils/soundEffects';

interface HealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportAnalysis?: MedicalReportAnalysis;
  onUpdateReport: (analysis: MedicalReportAnalysis) => void;
  userAccount?: { uid?: string; displayName?: string; email?: string } | null;
}

export const HealthReportModal: React.FC<HealthReportModalProps> = ({
  isOpen,
  onClose,
  reportAnalysis,
  onUpdateReport,
  userAccount,
}) => {
  const [isUploadingNew, setIsUploadingNew] = useState(!reportAnalysis);

  if (!isOpen) return null;

  const handleDone = () => {
    playSuccessChime();
    onClose();
  };

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
              <h3 className="text-base sm:text-lg font-bold text-white">Diagnostic Health Reports</h3>
              <p className="text-xs text-zinc-400">Uploaded medical reports & clinical lab documents</p>
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

        {!isUploadingNew && reportAnalysis ? (
          <div className="space-y-4">
            <ReportPhotoViewer
              report={reportAnalysis}
              onReupload={() => {
                playClickSound(600);
                setIsUploadingNew(true);
              }}
              userName={userAccount?.displayName || 'Member Patient'}
              theme="dark"
            />

            {/* Done Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDone}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Done • Return to Dashboard</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {reportAnalysis && (
              <button
                type="button"
                onClick={() => {
                  playClickSound(600);
                  setIsUploadingNew(false);
                }}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 mb-2 cursor-pointer"
              >
                ← Back to active report
              </button>
            )}
            <ReportUploader
              standalone
              userAccount={userAccount}
              onDone={handleDone}
              onReportAnalyzed={(data) => {
                onUpdateReport(data);
                setIsUploadingNew(false);
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
};

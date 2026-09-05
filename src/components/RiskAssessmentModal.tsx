import React from 'react';
import { X, ShieldAlert, Stethoscope } from 'lucide-react';
import { UserHealthProfile } from '../types';
import { RiskAssessmentCard } from './RiskAssessmentCard';

interface RiskAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  onOpenDoctorConsult?: (reason?: string) => void;
}

export const RiskAssessmentModal: React.FC<RiskAssessmentModalProps> = ({
  isOpen,
  onClose,
  profile,
  onOpenDoctorConsult,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-3xl bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600/15 text-rose-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                Clinical Risk Diagnosis
              </span>
              <h2 className="text-base sm:text-lg font-black text-zinc-950">Metabolic Threat & Visceral Fat Projection</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <RiskAssessmentCard 
            profile={profile} 
            onTakeAction={() => {
              onClose();
              if (onOpenDoctorConsult) {
                onOpenDoctorConsult('Comprehensive metabolic risk reversal consultation.');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

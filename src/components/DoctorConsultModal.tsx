import React, { useEffect, useState } from 'react';
import {
  X, Phone, PhoneCall, ShieldCheck, Stethoscope,
  Clock, CheckCircle2, AlertTriangle, Building2, RefreshCw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { UserHealthProfile, DoctorContact } from '../types';
import { getDoctors } from '../utils/supabase';

interface DoctorConsultModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserHealthProfile;
  reason?: string | any;
}

export const DoctorConsultModal: React.FC<DoctorConsultModalProps> = ({
  isOpen,
  onClose,
  profile,
  reason = 'Biomarker interpretation, clinical condition guidance & personalized medical prescription.',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [doctors, setDoctors] = useState<DoctorContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getDoctors().then((list) => {
      setDoctors(list);
      setLoading(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const validReasonText = typeof reason === 'string' && reason.trim().length > 0
    ? reason.trim()
    : 'Biomarker interpretation, clinical condition guidance & personalized medical prescription.';

  const handleCallDoctor = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber.replace(/[^0-9+]/g, '')}`;
  };

  const cardBg = isDark ? 'bg-zinc-950 border border-zinc-800 text-white' : 'bg-white border border-zinc-200 text-zinc-950 shadow-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl ${cardBg} space-y-6 text-left relative max-h-[90vh] overflow-y-auto`}>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              Direct Clinical Phone Consultation
            </span>
          </div>
          <h3 className="text-xl font-black text-zinc-950 dark:text-white">Physician Telephony Support</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Directly connect with a board-certified medical doctor via direct telephone call.
          </p>
        </div>

        {/* Trigger Reason / Clinical Note */}
        {validReasonText && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Clinical Consultation Advisory</span>
            </div>
            <p className="text-[11px] text-amber-900 dark:text-amber-200/90 leading-relaxed font-medium">
              {validReasonText}
            </p>
          </div>
        )}

        {/* Doctor Information Card(s) */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500 dark:text-zinc-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading available doctors...</span>
          </div>
        ) : doctors.length === 0 ? (
          <div className={`p-5 rounded-2xl border text-center space-y-2 ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-zinc-50/80 border-zinc-200'}`}>
            <Stethoscope className="w-6 h-6 mx-auto text-zinc-400" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No doctors available right now</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Our clinical team is being onboarded. Please check back shortly, or reach out to support for urgent concerns.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map((doc, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-zinc-50/80 border-zinc-200 shadow-sm'} space-y-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm shrink-0 border border-emerald-200 dark:border-emerald-500/30">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-zinc-950 dark:text-white leading-tight">{doc.name}</h4>
                      <span className="text-[12px] text-emerald-700 dark:text-emerald-400 font-bold block mt-0.5">{doc.qualification}</span>
                      {doc.registrationNumber && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono font-medium">Reg. No: {doc.registrationNumber}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 uppercase whitespace-nowrap shadow-xs">
                    Verified MD
                  </span>
                </div>

                <div className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  {doc.hospitalAffiliation && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                      <span className="font-semibold">{doc.hospitalAffiliation}</span>
                    </div>
                  )}
                  {doc.availability && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                      <span>{doc.availability}</span>
                    </div>
                  )}
                  {doc.phone && (
                    <div className="flex items-center gap-2 font-mono text-emerald-700 dark:text-emerald-400 font-black text-xs">
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>Direct Hotline: {doc.phone}</span>
                    </div>
                  )}
                </div>

                {doc.phone && (
                  <a
                    href={`tel:${doc.phone.replace(/[^0-9+]/g, '')}`}
                    onClick={() => handleCallDoctor(doc.phone)}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all text-center block cursor-pointer"
                  >
                    <PhoneCall className="w-4 h-4 stroke-[2.5]" />
                    <span>Initiate Direct Phone Call ({doc.phone})</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Notice */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Compliant with Telemedicine Practice Guidelines (Board of Governors, NMC)</span>
        </div>

      </div>
    </div>
  );
};

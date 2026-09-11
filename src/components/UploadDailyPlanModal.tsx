import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle, RefreshCw, CalendarClock, Sparkles } from 'lucide-react';
import { uploadCustomDailyPlan, CustomDailyPlanResult } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';
import { playClickSound, playSuccessChime } from '../utils/soundEffects';

interface UploadDailyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once a plan has been successfully extracted & saved, so the
   *  parent can re-fetch today's plan and show the new one immediately. */
  onUploaded: () => void;
}

/** Lets a user upload a photo of a daily routine they already have
 *  (e.g. from their own doctor, or their own handwritten schedule) — the AI
 *  extracts it into the app's own time-ordered plan format, and it replaces
 *  the built-in reversal plan for the next 35 days. PDF isn't offered here:
 *  the vision model behind this reads images only. */
export const UploadDailyPlanModal: React.FC<UploadDailyPlanModalProps> = ({ isOpen, onClose, onUploaded }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomDailyPlanResult | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setSelectedFile(null);
    setFileBase64(null);
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setSelectedFile(file);
    setError(null);
    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFileBase64(reader.result as string);
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setIsReadingFile(false);
      setError(tr('Could not read this file. Please try again.', 'फ़ाइल पढ़ी नहीं जा सकी। कृपया दोबारा कोशिश करें।'));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!fileBase64 || !selectedFile) {
      setError(tr('Please choose a photo of your daily plan first.', 'कृपया पहले अपने डेली प्लान की फोटो चुनें।'));
      return;
    }
    playClickSound(700);
    setIsAnalyzing(true);
    setError(null);
    const data = await uploadCustomDailyPlan(fileBase64, selectedFile.type || 'image/jpeg');
    setIsAnalyzing(false);
    if (!data.isValidPlan) {
      setError(data.rejectionReason || tr('Could not extract a plan from this. Please try a clearer photo.', 'इससे कोई प्लान नहीं निकाला जा सका। कृपया साफ़ फोटो आज़माएं।'));
      return;
    }
    setResult(data);
    playSuccessChime();
  };

  const handleDone = () => {
    onUploaded();
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{tr('Upload Your Own Daily Plan', 'अपना डेली प्लान अपलोड करें')}</h3>
              <p className="text-[11px] text-zinc-400">{tr('Replaces your plan for 35 days', '35 दिनों के लिए आपका प्लान बदलता है')}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          /* SUCCESS VIEW — extracted plan preview */
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {tr(
                  'Your plan has been extracted and is now active. It will be shown as your Daily Plan for the next 35 days.',
                  'आपका प्लान निकाल लिया गया है और अब सक्रिय है। यह अगले 35 दिनों तक आपके डेली प्लान के रूप में दिखेगा।'
                )}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(result.sections || []).map((s) => (
                <div key={s.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-2.5">
                  {s.timeLabel && (
                    <span className="text-[10px] font-black text-emerald-400 shrink-0 pt-0.5 whitespace-nowrap">{s.timeLabel}</span>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">{s.title}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDone}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{tr('View My Plan', 'मेरा प्लान देखें')}</span>
            </button>
          </div>
        ) : (
          /* UPLOAD FORM */
          <div className="space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              {tr(
                'Already have a daily routine from your own doctor or nutritionist, or your own handwritten schedule? Upload a photo of it here — UrCare will read it and use it as your Daily Plan for the next 35 days.',
                'क्या आपके पास पहले से अपने डॉक्टर या न्यूट्रिशनिस्ट का दिया हुआ डेली रूटीन है, या अपना हाथ से लिखा शेड्यूल है? यहां उसकी फोटो अपलोड करें — UrCare इसे पढ़कर अगले 35 दिनों तक आपके डेली प्लान के रूप में उपयोग करेगा।'
              )}
            </p>

            <div
              onClick={() => document.getElementById('daily-plan-file-input')?.click()}
              className="p-6 border-2 border-dashed border-zinc-700 hover:border-emerald-500 bg-zinc-900/60 hover:bg-zinc-900 rounded-3xl text-center cursor-pointer transition-all space-y-3"
            >
              <input id="daily-plan-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-white">
                  {selectedFile ? selectedFile.name : tr('Click to Upload a Photo', 'फोटो अपलोड करने हेतु क्लिक करें')}
                </p>
                <p className="text-xs text-zinc-400">
                  {tr('Your own daily routine, in any format', 'आपका अपना डेली रूटीन, किसी भी फॉर्मेट में')}
                </p>
              </div>
              {selectedFile && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
                  isReadingFile ? 'text-amber-400 bg-amber-950/40 border-amber-500/40' : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40'
                }`}>
                  {isReadingFile && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{isReadingFile ? tr('Reading file…', 'फाइल पढ़ी जा रही है…') : tr('Ready to analyze', 'विश्लेषण हेतु तैयार')}</span>
                </span>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || isReadingFile || !selectedFile}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{tr('Extracting your plan...', 'आपका प्लान निकाला जा रहा है...')}</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>{tr('Extract & Use This Plan', 'निकालें व यह प्लान उपयोग करें')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

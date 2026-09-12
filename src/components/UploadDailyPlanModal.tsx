import React, { useState } from 'react';
import { X, Upload, FileText, Check, AlertCircle, RefreshCw, CalendarClock, Sparkles, Files } from 'lucide-react';
import { uploadCustomDailyPlan, saveMergedDailyPlan, CustomDailyPlanResult, DailyPlanSectionInput } from '../utils/supabase';
import { renderPdfPagesToImages, getPdfPageCount } from '../utils/pdfToImages';
import { useLanguage } from '../context/LanguageContext';
import { playClickSound, playSuccessChime } from '../utils/soundEffects';

interface UploadDailyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once a plan has been successfully extracted & saved, so the
   *  parent can re-fetch today's plan and show the new one immediately. */
  onUploaded: () => void;
}

/** What step of a multi-page PDF upload is currently running — shown as
 *  live "page X of Y" progress instead of one opaque spinner, since a long
 *  PDF (this modal has been tested against 60+ page doctor printouts) can
 *  take a while to walk through. Not shown at all for a plain photo
 *  upload, which is still a single fast call. */
interface PdfProgress {
  phase: 'rendering' | 'extracting' | 'saving';
  page?: number;
  totalPages?: number;
}

/** Lets a user upload a daily routine they already have (e.g. from their own
 *  doctor, or their own handwritten schedule) as a photo OR a PDF — the AI
 *  extracts it into the app's own time-ordered plan format, and it replaces
 *  the built-in reversal plan for the next 35 days.
 *
 *  The vision model behind this (see /api/analyze-daily-plan) only ever
 *  reads a single image per call, never raw PDF bytes — so a PDF is
 *  rendered to one image per page entirely in the browser (pdfToImages.ts),
 *  each page is read by its own AI call, and every page's extracted steps
 *  are merged and saved together at the end. This is what lets even a long,
 *  multi-page PDF (a real doctor's printout can easily run 40-60+ pages
 *  once cover pages, disclaimers and diet guides are counted) work here,
 *  instead of being rejected outright the way a photo-only flow would. */
export const UploadDailyPlanModal: React.FC<UploadDailyPlanModalProps> = ({ isOpen, onClose, onUploaded }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomDailyPlanResult | null>(null);
  const [pdfSummary, setPdfSummary] = useState<{ pagesRead: number; totalPages: number; truncated: boolean } | null>(null);

  if (!isOpen) return null;

  const isPdf = selectedFile?.type === 'application/pdf';

  const reset = () => {
    setSelectedFile(null);
    setFileBase64(null);
    setPdfPageCount(null);
    setError(null);
    setResult(null);
    setPdfProgress(null);
    setPdfSummary(null);
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
    setResult(null);
    setPdfSummary(null);
    setPdfPageCount(null);

    if (file.type === 'application/pdf') {
      // No FileReader/base64 needed here — pdf.js renders each page to its
      // own image only once the user hits Analyze. Just grab the page count
      // up front so the picker can say "62-page PDF" right away.
      setFileBase64(null);
      setIsReadingFile(true);
      getPdfPageCount(file)
        .then((count) => setPdfPageCount(count))
        .catch(() => setError(tr('Could not open this PDF. Please try a different file.', 'यह PDF नहीं खोली जा सकी। कृपया दूसरी फ़ाइल आज़माएं।')))
        .finally(() => setIsReadingFile(false));
      return;
    }

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

  const handleAnalyzePdf = async (file: File) => {
    setPdfProgress({ phase: 'rendering', page: 0, totalPages: pdfPageCount || 0 });
    const { images, totalPages, truncated } = await renderPdfPagesToImages(file, (pageDone, totalToRender) => {
      setPdfProgress({ phase: 'rendering', page: pageDone, totalPages: totalToRender });
    });

    const allSections: DailyPlanSectionInput[] = [];
    for (let i = 0; i < images.length; i++) {
      setPdfProgress({ phase: 'extracting', page: i + 1, totalPages: images.length });
      const pageResult = await uploadCustomDailyPlan(images[i], 'image/jpeg', false);
      if (pageResult.isValidPlan && pageResult.sections && pageResult.sections.length > 0) {
        allSections.push(...pageResult.sections.map((s) => ({ timeLabel: s.timeLabel, title: s.title, body: s.body })));
      }
      // A small pacing gap between sequential vision calls — a courteous
      // buffer against the free-tier per-minute output-token ceiling (see
      // callGroqForJson in server.ts), not a guarantee against every
      // possible rate limit on a very large document.
      if (i < images.length - 1) await new Promise((r) => setTimeout(r, 350));
    }

    if (allSections.length === 0) {
      setError(tr(
        'Could not find a daily schedule on any page of this PDF. Please try a clearer file, or upload a photo instead.',
        'इस PDF के किसी भी पेज पर डेली शेड्यूल नहीं मिला। कृपया साफ़ फ़ाइल आज़माएं, या फोटो अपलोड करें।'
      ));
      return;
    }

    setPdfProgress({ phase: 'saving' });
    const saved = await saveMergedDailyPlan(allSections);
    if (!saved.isValidPlan) {
      setError(saved.rejectionReason || tr('Could not save this plan right now.', 'यह प्लान अभी सहेजा नहीं जा सका।'));
      return;
    }
    setPdfSummary({ pagesRead: images.length, totalPages, truncated });
    setResult(saved);
    playSuccessChime();
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError(tr('Please choose a photo or PDF of your daily plan first.', 'कृपया पहले अपने डेली प्लान की फोटो या PDF चुनें।'));
      return;
    }
    playClickSound(700);
    setIsAnalyzing(true);
    setError(null);

    try {
      if (isPdf) {
        await handleAnalyzePdf(selectedFile);
      } else {
        if (!fileBase64) {
          setError(tr('Please wait for the file to finish loading.', 'कृपया फ़ाइल लोड होने तक प्रतीक्षा करें।'));
          return;
        }
        const data = await uploadCustomDailyPlan(fileBase64, selectedFile.type || 'image/jpeg');
        if (!data.isValidPlan) {
          const base = data.rejectionReason || tr('Could not extract a plan from this. Please try a clearer photo.', 'इससे कोई प्लान नहीं निकाला जा सका। कृपया साफ़ फोटो आज़माएं।');
          setError(data.debugReason ? `${base} (${data.debugReason})` : base);
          return;
        }
        setResult(data);
        playSuccessChime();
      }
    } catch (err: any) {
      setError(err?.message || tr('Could not read this file. Please try again.', 'यह फ़ाइल पढ़ी नहीं जा सकी। कृपया दोबारा कोशिश करें।'));
    } finally {
      setIsAnalyzing(false);
      setPdfProgress(null);
    }
  };

  const handleDone = () => {
    onUploaded();
    handleClose();
  };

  const analyzeButtonLabel = (() => {
    if (!isAnalyzing) return tr('Extract & Use This Plan', 'निकालें व यह प्लान उपयोग करें');
    if (pdfProgress?.phase === 'rendering') return tr(`Reading page ${pdfProgress.page || 0} of ${pdfProgress.totalPages || '…'}…`, `पेज ${pdfProgress.page || 0} / ${pdfProgress.totalPages || '…'} पढ़ा जा रहा है…`);
    if (pdfProgress?.phase === 'extracting') return tr(`Analyzing page ${pdfProgress.page || 0} of ${pdfProgress.totalPages || '…'}…`, `पेज ${pdfProgress.page || 0} / ${pdfProgress.totalPages || '…'} का विश्लेषण हो रहा है…`);
    if (pdfProgress?.phase === 'saving') return tr('Saving your plan…', 'आपका प्लान सहेजा जा रहा है…');
    return tr('Extracting your plan...', 'आपका प्लान निकाला जा रहा है...');
  })();

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

            {pdfSummary && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2">
                <Files className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {pdfSummary.truncated
                    ? tr(
                        `Scanned the first ${pdfSummary.pagesRead} of ${pdfSummary.totalPages} pages and found ${result.sections?.length || 0} steps.`,
                        `${pdfSummary.totalPages} में से पहले ${pdfSummary.pagesRead} पेज स्कैन किए और ${result.sections?.length || 0} चरण मिले।`
                      )
                    : tr(
                        `Scanned all ${pdfSummary.totalPages} page${pdfSummary.totalPages === 1 ? '' : 's'} of your PDF and found ${result.sections?.length || 0} steps.`,
                        `आपके PDF के सभी ${pdfSummary.totalPages} पेज स्कैन किए और ${result.sections?.length || 0} चरण मिले।`
                      )}
                </span>
              </div>
            )}

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
                'Already have a daily routine from your own doctor or nutritionist, or your own handwritten schedule? Upload a photo or PDF here — even a long, multi-page PDF — and UrCare will read it and use it as your Daily Plan for the next 35 days.',
                'क्या आपके पास पहले से अपने डॉक्टर या न्यूट्रिशनिस्ट का दिया हुआ डेली रूटीन है, या अपना हाथ से लिखा शेड्यूल है? यहां फोटो या PDF अपलोड करें — लंबी, कई-पेज वाली PDF भी — UrCare इसे पढ़कर अगले 35 दिनों तक आपके डेली प्लान के रूप में उपयोग करेगा।'
              )}
            </p>

            <div
              onClick={() => document.getElementById('daily-plan-file-input')?.click()}
              className="p-6 border-2 border-dashed border-zinc-700 hover:border-emerald-500 bg-zinc-900/60 hover:bg-zinc-900 rounded-3xl text-center cursor-pointer transition-all space-y-3"
            >
              <input id="daily-plan-file-input" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                {isPdf ? <Files className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-white">
                  {selectedFile ? selectedFile.name : tr('Click to Upload a Photo or PDF', 'फोटो या PDF अपलोड करने हेतु क्लिक करें')}
                </p>
                <p className="text-xs text-zinc-400">
                  {isPdf && pdfPageCount
                    ? tr(`${pdfPageCount}-page PDF — long PDFs are fully supported`, `${pdfPageCount}-पेज PDF — लंबी PDF भी पूरी तरह समर्थित है`)
                    : tr('Your own daily routine, in any format', 'आपका अपना डेली रूटीन, किसी भी फॉर्मेट में')}
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

            {isPdf && (
              <p className="text-[10px] text-zinc-500 leading-relaxed flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  {tr(
                    'A long PDF is read one page at a time, so this can take a little while — you\'ll see live progress below once you tap Extract.',
                    'लंबी PDF को एक-एक पेज करके पढ़ा जाता है, इसलिए इसमें थोड़ा समय लग सकता है — Extract दबाने पर नीचे लाइव प्रगति दिखेगी।'
                  )}
                </span>
              </p>
            )}

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
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>{analyzeButtonLabel}</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>{analyzeButtonLabel}</span>
                </>
              )}
            </button>

            {/* Live page-by-page progress bar for a multi-page PDF. */}
            {isAnalyzing && isPdf && pdfProgress && pdfProgress.totalPages ? (
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, ((pdfProgress.page || 0) / pdfProgress.totalPages) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

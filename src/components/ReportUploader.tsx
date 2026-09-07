import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle2, Sparkles, RefreshCw, Type, AlertCircle, 
  Cpu, Activity, ShieldCheck, HeartPulse, Stethoscope, ArrowRight, Check, Zap, Eye
} from 'lucide-react';
import { MedicalReportAnalysis, Biomarker } from '../types';
import { ReportPhotoViewer } from './ReportPhotoViewer';
import { Language, translations } from '../utils/translations';
import { playClickSound, playSuccessChime } from '../utils/soundEffects';
import { authedFetch } from '../utils/supabase';

interface ReportUploaderProps {
  onReportAnalyzed: (analysis: MedicalReportAnalysis) => void;
  currentAnalysis?: MedicalReportAnalysis;
  onSkip?: () => void;
  onDone?: () => void;
  standalone?: boolean;
  lang?: Language;
  userAccount?: { uid?: string; displayName?: string; email?: string } | null;
}

export const ReportUploader: React.FC<ReportUploaderProps> = ({
  onReportAnalyzed,
  currentAnalysis,
  onSkip,
  onDone,
  standalone = false,
  lang = 'en',
  userAccount,
}) => {
  const t = translations[lang] || translations.en;
  
  // 2 Modes: 'upload' | 'text' (Edit)
  const [inputMode, setInputMode] = useState<'upload' | 'text'>('upload');
  
  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // image preview only (shown in the viewer)
  const [fileBase64, setFileBase64] = useState<string | null>(null); // any accepted file (image or PDF) sent to the AI
  const [isReadingFile, setIsReadingFile] = useState(false);
  
  // Text input state
  const [reportText, setReportText] = useState<string>('');
  
  // Simulation & Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStageIndex, setScanStageIndex] = useState(0);
  const [extractedPreviewItems, setExtractedPreviewItems] = useState<{ label: string; val: string; status: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MedicalReportAnalysis | null>(currentAnalysis || null);

  const scanStages = [
    { title: 'Optical Scanning & Parsing Document Structure', icon: FileText },
    { title: 'Extracting Glycemic Biomarkers & HbA1c Levels', icon: Activity },
    { title: 'Analyzing Lipid Profile & Cardiovascular Risk Factors', icon: HeartPulse },
    { title: 'Evaluating Micronutrients, Thyroid & Renal Markers', icon: Cpu },
    { title: 'Calibrating UrCare Precision Caloric & Protein Split', icon: ShieldCheck },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      setFileBase64(null);
      setPreviewUrl(null);

      // Read the file (image OR PDF) into base64 — Claude can read PDF text/tables
      // directly, so the report no longer needs to be retyped by hand.
      setIsReadingFile(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setFileBase64(dataUrl);
        if (file.type.startsWith('image/')) {
          setPreviewUrl(dataUrl);
        }
        setIsReadingFile(false);
      };
      reader.onerror = () => {
        setIsReadingFile(false);
        setError(lang === 'hi' ? 'फ़ाइल पढ़ी नहीं जा सकी। कृपया दोबारा कोशिश करें।' : 'Could not read this file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoadSample = (sampleType: 'diabetic' | 'lipid' | 'thyroid') => {
    playClickSound(600);
    setInputMode('text');
    if (sampleType === 'diabetic') {
      setReportText('Fasting Blood Sugar: 128 mg/dL (High)\nPost-Prandial Glucose: 192 mg/dL (Elevated)\nHbA1c: 7.2% (Diabetic Range)\nInsulin Fasting: 16.4 uIU/mL\nKidney Serum Creatinine: 0.9 mg/dL (Normal)');
    } else if (sampleType === 'lipid') {
      setReportText('Total Cholesterol: 242 mg/dL (High)\nTriglycerides: 215 mg/dL (Borderline High)\nHDL (Good Cholesterol): 38 mg/dL (Low)\nLDL (Bad Cholesterol): 161 mg/dL (High)\nLiver SGPT/ALT: 34 U/L (Normal)');
    } else {
      setReportText('TSH (Thyroid Stimulating Hormone): 5.8 uIU/mL (Subclinical High)\nFree T4: 1.1 ng/dL (Normal)\nVitamin D3: 16.2 ng/mL (Deficient)\nVitamin B12: 185 pg/mL (Low)\nHemoglobin: 13.8 g/dL (Normal)');
    }
    setError(null);
  };

  const handleAnalyze = async () => {
    if (inputMode === 'upload' && !selectedFile) {
      setError(lang === 'hi' ? 'कृपया अपनी रिपोर्ट (PDF या फोटो) चुनें।' : 'Please select a lab report PDF or photo.');
      return;
    }
    if (inputMode === 'text' && !reportText.trim()) {
      setError(lang === 'hi' ? 'कृपया अपनी रिपोर्ट के पैरामीटर्स या टेक्स्ट यहाँ लिखें।' : 'Please enter or paste your lab report text.');
      return;
    }
    if (inputMode === 'upload' && selectedFile && isReadingFile) {
      setError(lang === 'hi' ? 'फ़ाइल अभी तैयार हो रही है, एक पल रुकें।' : 'Still preparing your file — please wait a moment and try again.');
      return;
    }
    // Claude reads PDF pages directly (text, tables, scanned images), so a PDF upload
    // no longer needs the values retyped by hand — just needs the file to have loaded.
    if (inputMode === 'upload' && selectedFile && !fileBase64) {
      setError(lang === 'hi'
        ? 'फ़ाइल पढ़ी नहीं जा सकी। कृपया दोबारा अपलोड करें।'
        : "We couldn't read that file. Please try uploading it again.");
      return;
    }

    playClickSound(750);
    setIsAnalyzing(true);
    setError(null);
    setScanProgress(25);

    const progressTimer1 = setTimeout(() => setScanProgress(70), 180);
    const progressTimer2 = setTimeout(() => setScanProgress(95), 320);

    const reportName = inputMode === 'upload'
      ? (selectedFile?.name || 'Diagnostic Lab Report')
      : 'Diagnostic Lab Record';

    try {
      const res = await authedFetch('/api/analyze-report', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: fileBase64 || undefined,
          mimeType: selectedFile?.type,
          reportText: reportText.trim() || undefined,
          reportType: reportName,
        }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setError(lang === 'hi' ? 'कृपया दोबारा साइन इन करें।' : 'Please sign in again.');
        setScanProgress(0);
        setIsAnalyzing(false);
        return;
      }

      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);

      if (data.isValidReport === false) {
        // Not an actual medical report — reject it instead of filing fake biomarkers.
        setError(data.rejectionReason || (lang === 'hi'
          ? 'यह एक वास्तविक मेडिकल/लैब रिपोर्ट नहीं लगती। कृपया असली लैब रिपोर्ट अपलोड करें।'
          : 'This does not look like a real medical/lab report. Please upload an actual lab report.'));
        setScanProgress(0);
        setIsAnalyzing(false);
        return;
      }

      if (data.analysisFailed || data.isValidReport == null) {
        setError(data.rejectionReason || (lang === 'hi' ? 'अभी जांच नहीं हो सकी, दोबारा कोशिश करें।' : 'Could not analyze this right now. Please try again.'));
        setScanProgress(0);
        setIsAnalyzing(false);
        return;
      }

      const finalReport: MedicalReportAnalysis = {
        // The server already saved this report to Supabase under this id — reuse it,
        // never mint a new one client-side.
        id: data.id,
        userId: userAccount?.uid || 'usr_current',
        userName: userAccount?.displayName || 'Active Member',
        reportName: data.reportName || reportName,
        uploadedAt: data.uploadedAt || new Date().toISOString(),
        imageUrl: previewUrl || undefined,
        reportText: reportText.trim() || undefined,
        summary: data.summary || 'Diagnostic report document uploaded and filed in clinical records.',
        biomarkers: (data.biomarkers as Biomarker[]) || [],
        identifiedRisks: data.identifiedRisks || [],
        dietaryRecommendations: data.dietaryRecommendations || [],
        macroAdjustments: data.macroAdjustments || {
          keyNutrientsToBoost: [],
          foodsToAvoid: [],
        },
      };

      setScanProgress(100);
      setAnalysisResult(finalReport);
      onReportAnalyzed(finalReport);
      playSuccessChime();
      setIsAnalyzing(false);
    } catch (err) {
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      console.error(err);
      setError(lang === 'hi' ? 'स्कैन सर्विस से संपर्क नहीं हो सका। कृपया दोबारा कोशिश करें।' : 'Could not reach the scanning service. Please check your connection and try again.');
      setScanProgress(0);
      setIsAnalyzing(false);
    }
  };

  const handleDoneClick = () => {
    playSuccessChime();
    if (analysisResult) {
      onReportAnalyzed(analysisResult);
    }
    if (onDone) {
      onDone();
    }
  };

  return (
    <div id="report-uploader-card" className="w-full space-y-4 text-left">
      
      {/* 2 Tabs: Upload File | Edit */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl">
        <button
          type="button"
          onClick={() => { setInputMode('upload'); setError(null); }}
          className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            inputMode === 'upload'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload File</span>
        </button>

        <button
          type="button"
          onClick={() => { setInputMode('text'); setError(null); }}
          className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            inputMode === 'text'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Edit</span>
        </button>
      </div>

      {/* NON-AI CLEAN UPLOAD ANIMATION */}
      {isAnalyzing && (
        <div className="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <Upload className="w-7 h-7 animate-pulse text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">Uploading Medical Report...</h4>
            <p className="text-xs text-zinc-400">Attaching document securely to your health records</p>
          </div>

          <div className="space-y-1.5 max-w-xs mx-auto pt-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">Uploading</span>
              <span className="font-mono font-bold text-emerald-400">{scanProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-150"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* RESULT READY VIEW WITH PHOTO & TEXT (NO AI) */}
      {!isAnalyzing && analysisResult ? (
        <div className="space-y-4 animate-in fade-in">
          <ReportPhotoViewer
            report={analysisResult}
            onReupload={() => setAnalysisResult(null)}
            userName={userAccount?.displayName || 'Member Patient'}
            theme="dark"
          />

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <button
              type="button"
              id="report-done-apply-btn"
              onClick={handleDoneClick}
              className="flex-1 w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Done • Apply & View Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setAnalysisResult(null)}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Upload Another
            </button>
          </div>
        </div>
      ) : null}

      {/* INPUT FORMS (Shown when not analyzing and no active result) */}
      {!isAnalyzing && !analysisResult && (
        <div className="space-y-4">
          
          {/* OPTION 1: UPLOAD LAB PDF / PHOTO */}
          {inputMode === 'upload' && (
            <div
              onClick={() => document.getElementById('report-file-input')?.click()}
              className="p-6 sm:p-8 border-2 border-dashed border-zinc-700 hover:border-emerald-500 bg-zinc-900/60 hover:bg-zinc-900 rounded-3xl text-center cursor-pointer transition-all space-y-3"
            >
              <input
                id="report-file-input"
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-white">
                  {selectedFile ? selectedFile.name : 'Click to Upload PDF or Report Photo'}
                </p>
                <p className="text-xs text-zinc-400">
                  Supports PDF lab reports, doctor prescriptions, or blood test photos
                </p>
              </div>
              {selectedFile && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
                  isReadingFile
                    ? 'text-amber-400 bg-amber-950/40 border-amber-500/40'
                    : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40'
                }`}>
                  {isReadingFile && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>
                    {isReadingFile
                      ? 'Reading file…'
                      : `Ready to upload: ${(selectedFile.size / 1024).toFixed(0)} KB`}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* OPTION 2: EDIT / WRITE / PASTE TEXT */}
          {inputMode === 'text' && (
            <div className="space-y-3 p-4 rounded-3xl bg-zinc-900/90 border border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Edit or Enter Lab Report Data</span>
                </label>
              </div>
              <textarea
                rows={5}
                placeholder="Type or paste your lab results here (e.g. Fasting Blood Sugar: 115 mg/dL, HbA1c: 6.4%, Total Cholesterol: 215 mg/dL, Vitamin D3: 20 ng/mL, Thyroid: Normal)..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 focus:border-emerald-500 text-white text-xs outline-none transition-colors"
              />
              
              {/* Presets */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-bold text-zinc-400 uppercase">Quick sample presets:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('diabetic')}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold flex items-center gap-1 border border-zinc-700 cursor-pointer"
                  >
                    <span>🩸 Diabetic HbA1c (7.2%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('lipid')}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold flex items-center gap-1 border border-zinc-700 cursor-pointer"
                  >
                    <span>🫀 High Cholesterol (242 mg/dL)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('thyroid')}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold flex items-center gap-1 border border-zinc-700 cursor-pointer"
                  >
                    <span>⚡ Thyroid & Vit D3 Test</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/50 p-3 rounded-2xl border border-rose-500/40 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {/* Upload Action Button */}
          <button
            type="button"
            id="upload-report-btn"
            onClick={handleAnalyze}
            disabled={inputMode === 'upload' && isReadingFile}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/25"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Upload</span>
          </button>

          {/* Skip option if inside modal */}
          {onSkip && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={onSkip}
                className="w-full py-2.5 rounded-xl text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
};


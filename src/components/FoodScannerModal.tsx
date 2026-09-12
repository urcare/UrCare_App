import React, { useState, useRef, useEffect } from 'react';
import {
  X, Camera, Sparkles, Utensils, RefreshCw, Check, Plus,
  AlertCircle, Image as ImageIcon, Lock, Crown, ArrowRight, Upload
} from 'lucide-react';
import { MealItem, UserHealthProfile } from '../types';
import { authedFetch } from '../utils/supabase';
import { useLanguage } from '../context/LanguageContext';

const MEAL_CATEGORY_LABEL_HI: Record<string, string> = {
  breakfast: 'नाश्ता',
  lunch: 'दोपहर का भोजन',
  dinner: 'रात का भोजन',
  snack: 'नाश्ता (स्नैक)',
};

interface FoodScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMeal: (meal: MealItem) => void;
  defaultCategory?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  isPro?: boolean;
  onOpenProUpgrade?: () => void;
  /** User's onboarding health profile — used to personalize the AI suitability verdict */
  profile?: UserHealthProfile;
}

const SAMPLE_MEALS = [
  'Grilled salmon fillet with quinoa & roasted asparagus',
  '3 scrambled eggs with 1 whole wheat toast and avocado',
  'Chicken breast (180g) with basmati rice and mixed green salad',
  'Greek yogurt (200g) with blueberries, chia seeds, and honey',
  'Paneer tikka wrap with whole wheat roti and mint chutney',
  'Protein whey smoothie with banana, oats, and almond milk',
];

export const FoodScannerModal: React.FC<FoodScannerModalProps> = ({
  isOpen,
  onClose,
  onAddMeal,
  defaultCategory = 'lunch',
  isPro = false,
  onOpenProUpgrade,
  profile,
}) => {
  const [category, setCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(defaultCategory);
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  // Live camera capture (real-time, not just a file picker)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = () => {
    setIsCameraOpen(false);
    setCameraStream(null); // the cleanup effect below stops the actual tracks
  };

  // Release the camera whenever the stream changes (a new one starts, or camera
  // closes) AND on unmount — a single source of truth instead of two.
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  // Attach the stream to the <video> element once it's actually mounted and
  // React has committed the DOM — a setTimeout(fn, 0) guess was the previous
  // (unreliable) approach and is exactly what caused the black screen: if
  // play() silently rejected, nothing ever surfaced an error either.
  useEffect(() => {
    const video = videoRef.current;
    if (!isCameraOpen || !cameraStream || !video) return;
    video.srcObject = cameraStream;
    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch((err) => {
        console.error('Camera preview failed to play:', err);
        setCameraError(tr('Could not start the camera preview. Please try again.', 'कैमरा प्रीव्यू शुरू नहीं हो सका। कृपया पुनः प्रयास करें।'));
      });
    }
  }, [isCameraOpen, cameraStream]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err) {
      console.error('Camera access failed:', err);
      setCameraError(tr('Could not access the camera. Please allow camera permission, or upload a photo instead.', 'कैमरा एक्सेस नहीं हो सका। कृपया कैमरा अनुमति दें, या इसके बजाय फोटो अपलोड करें।'));
    }
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setSelectedImage(dataUrl);
    setError(null);
    stopCamera();
  };

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeFood = async () => {
    if (!description.trim() && !selectedImage) {
      setError(tr('Please type your meal description or upload a food photo.', 'कृपया अपने भोजन का विवरण लिखें या भोजन की फोटो अपलोड करें।'));
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const res = await authedFetch('/api/analyze-food', {
        method: 'POST',
        body: JSON.stringify({
          description: description || 'Healthy food meal',
          imageBase64: selectedImage,
          mealCategory: category,
          profile: profile
            ? {
                goal: profile.goal,
                gender: profile.gender,
                age: profile.age,
                dietaryPreference: profile.dietaryPreference,
                medicalConditions: profile.medicalConditions,
                calculatedPlan: profile.calculatedPlan,
              }
            : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setError(tr('Your session expired. Please sign out and sign in again.', 'आपका सत्र समाप्त हो गया। कृपया साइन आउट कर फिर साइन इन करें।'));
        setScannedResult(null);
        return;
      }

      if (!res.ok) {
        setError(data.rejectionReason || data.error || tr(`The scanner couldn't process this (error ${res.status}). Please try again.`, `स्कैनर इसे प्रोसेस नहीं कर सका (त्रुटि ${res.status})। कृपया पुनः प्रयास करें।`));
        setScannedResult(null);
        return;
      }

      if (data.isFood === false) {
        // Scanned/uploaded item is not food — reject clearly instead of showing fake nutrition.
        setError(data.rejectionReason || tr('That does not look like food. Please scan or upload a photo of an actual meal.', 'यह भोजन जैसा नहीं लगता। कृपया किसी वास्तविक भोजन का स्कैन या फोटो अपलोड करें।'));
        setScannedResult(null);
        return;
      }

      if (data.analysisFailed || data.isFood == null) {
        const base = data.rejectionReason || tr('Could not analyze this right now. Please check your connection and try again.', 'अभी इसका विश्लेषण नहीं हो सका। कृपया अपना कनेक्शन जांचें व पुनः प्रयास करें।');
        // debugReason is the real underlying error (e.g. from Groq) — this
        // generic message alone gave no way to tell a rate limit apart from
        // a real outage without server log access, so it's appended here.
        setError(data.debugReason ? `${base} (${data.debugReason})` : base);
        setScannedResult(null);
        return;
      }

      setScannedResult(data);
    } catch (err) {
      console.error(err);
      setError(tr('Could not reach the food scanner. Please check your connection and try scanning again.', 'फूड स्कैनर तक नहीं पहुंच सके। कृपया अपना कनेक्शन जांचें व दोबारा स्कैन करें।'));
      setScannedResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmAndAdd = () => {
    if (!scannedResult) return;

    const newMeal: MealItem = {
      id: 'meal_' + Date.now(),
      name: scannedResult.name,
      calories: Number(scannedResult.calories) || 350,
      protein: Number(scannedResult.protein) || 25,
      carbs: Number(scannedResult.carbs) || 40,
      fats: Number(scannedResult.fats) || 10,
      fiber: Number(scannedResult.fiber) || 4,
      servingSize: scannedResult.servingSize || '1 portion',
      category,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: selectedImage || undefined,
    };

    onAddMeal(newMeal);
    setScannedResult(null);
    setDescription('');
    setSelectedImage(null);
    onClose();
  };

  // IF USER IS NOT PRO: Display Pro Paywall Barrier
  if (!isPro) {
    return (
      <div id="food-scanner-pro-lock-backdrop" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 text-white shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-emerald-500/20 to-green-400/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-emerald-400" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-2">
              <Crown className="w-3.5 h-3.5" />
              <span>{tr('UrCare Pro Feature', 'UrCare प्रो फीचर')}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              {tr('Smart Food Camera is a Pro Feature', 'स्मार्ट फूड कैमरा एक प्रो फीचर है')}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              {tr('Unlock instant meal photo scanning, precision nutritional calculation, doctor prescriptions, and clinical protocols.', 'तुरंत भोजन फोटो स्कैनिंग, सटीक पोषण गणना, डॉक्टर पर्चे व क्लिनिकल प्रोटोकॉल अनलॉक करें।')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{tr('Real-time photo nutrient breakdown', 'रीयल-टाइम फोटो पोषक विश्लेषण')}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{tr('Automatic portion size & macro detection', 'स्वचालित पोर्शन साइज़ व मैक्रो पहचान')}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{tr('Clinical doctor guidance on lab reports', 'लैब रिपोर्ट्स पर क्लिनिकल डॉक्टर मार्गदर्शन')}</span>
            </div>
          </div>

          <button
            id="unlock-food-scanner-btn"
            type="button"
            onClick={() => {
              onClose();
              if (onOpenProUpgrade) onOpenProUpgrade();
            }}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
          >
            <span>{tr('Upgrade to Pro to Unlock Food Scanner', 'फूड स्कैनर अनलॉक करने हेतु प्रो में अपग्रेड करें')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // FULL-SCREEN LIVE CAMERA — Google Lens style viewfinder, takes over the
  // whole screen while active instead of a small boxed-in preview.
  if (isCameraOpen) {
    return (
      <div id="food-scanner-camera-view" className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Gradient scrims so the top/bottom controls stay legible over any photo */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={stopCamera}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
            title={tr('Close camera', 'कैमरा बंद करें')}
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-white text-xs font-bold bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-full">
            {tr('Point at your food', 'अपने भोजन की ओर इंगित करें')}
          </span>
          <div className="w-10 h-10" />
        </div>

        {/* Viewfinder — corner-bracket scan frame, centered */}
        <div className="flex-1 flex items-center justify-center relative z-10 pointer-events-none px-8">
          <div className="relative w-full max-w-xs aspect-square">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-white rounded-tl-3xl" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-white rounded-tr-3xl" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-white rounded-bl-3xl" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-white rounded-br-3xl" />
          </div>
        </div>

        {cameraError && (
          <div className="relative z-10 mx-5 mb-3 p-3 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Bottom shutter bar */}
        <div className="relative z-10 flex items-center justify-center pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            onClick={handleCapturePhoto}
            className="w-[72px] h-[72px] rounded-full bg-white/95 ring-4 ring-white/30 active:scale-90 transition-transform flex items-center justify-center shadow-2xl cursor-pointer"
            title={tr('Capture photo', 'फोटो लें')}
          >
            <div className="w-[58px] h-[58px] rounded-full border-2 border-black/10" />
          </button>
        </div>
      </div>
    );
  }

  // PRO USERS: Full AI Vision & Camera Interface
  return (
    <div id="food-scanner-modal-backdrop" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="food-scanner-modal" className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-white">{tr('Scan Food & Macros', 'भोजन व मैक्रो स्कैन करें')}</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500 text-black">PRO</span>
              </div>
              <p className="text-[11px] text-zinc-400">{tr('Photo scan or describe meal', 'फोटो स्कैन करें या भोजन बताएं')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400">{tr('Select Meal Slot:', 'भोजन का समय चुनें:')}</label>
          <div className="grid grid-cols-4 gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`py-1.5 capitalize rounded-lg font-semibold transition-all ${
                  category === cat ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tr(cat, MEAL_CATEGORY_LABEL_HI[cat])}
              </button>
            ))}
          </div>
        </div>

        {!scannedResult ? (
          <div className="space-y-4">
            {/* Upload or live snap photo */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-2">{tr('Snap or Upload Food Photo:', 'भोजन की फोटो लें या अपलोड करें:')}</label>

              {selectedImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-zinc-900">
                  <img src={selectedImage} alt="Food to scan" className="w-full h-44 object-cover" />
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {cameraError && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer bg-zinc-900/40 transition-colors"
                    >
                      <Camera className="w-8 h-8 text-emerald-400 mb-2" />
                      <span className="text-xs font-bold text-white">{tr('Take Photo', 'फोटो लें')}</span>
                      <span className="text-[10px] text-zinc-500 mt-1 text-center">{tr('Live camera, real-time', 'लाइव कैमरा, रीयल-टाइम')}</span>
                    </button>

                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer bg-zinc-900/40 transition-colors">
                      <Upload className="w-8 h-8 text-emerald-400 mb-2" />
                      <span className="text-xs font-bold text-white">{tr('Upload Photo', 'फोटो अपलोड करें')}</span>
                      <span className="text-[10px] text-zinc-500 mt-1 text-center">{tr('From gallery / files', 'गैलरी / फाइलों से')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center">{tr('Optical camera automatically calculates macros', 'ऑप्टिकल कैमरा स्वचालित रूप से मैक्रो गणना करता है')}</p>
                </div>
              )}
            </div>

            {/* Or Text Description */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">{tr('Or Describe Your Meal:', 'या अपना भोजन बताएं:')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr('e.g. 2 rotis with paneer bhurji and 1 cup dal...', 'जैसे 2 रोटी पनीर भुर्जी के साथ और 1 कटोरी दाल...')}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            {/* Quick Sample Prompts */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400">{tr('Quick Test Meals:', 'त्वरित परीक्षण भोजन:')}</span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {SAMPLE_MEALS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDescription(sample)}
                    className="text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg border border-zinc-800 text-left transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Scan Action Button */}
            <button
              id="analyze-food-btn"
              type="button"
              onClick={handleAnalyzeFood}
              disabled={isScanning}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{tr('Analyzing food & calculating macros...', 'भोजन का विश्लेषण व मैक्रो गणना हो रही है...')}</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>{tr('Scan & Calculate Nutritional Macros', 'स्कैन करें व पोषण मैक्रो गणना करें')}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Scanned Result View */
          <div className="space-y-4">
            {/* AI Suitability Verdict — personalized to this user's health profile */}
            {scannedResult.suitability && (() => {
              const verdictStyles: Record<string, { label: string; classes: string; icon: string }> = {
                good: { label: tr('Good For You', 'आपके लिए अच्छा'), classes: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', icon: '✅' },
                moderate: { label: tr('Okay In Moderation', 'सीमित मात्रा में ठीक है'), classes: 'bg-amber-500/15 border-amber-500/40 text-amber-300', icon: '⚠️' },
                avoid: { label: tr('Better To Avoid', 'बचना बेहतर है'), classes: 'bg-rose-500/15 border-rose-500/40 text-rose-300', icon: '⛔' },
              };
              const style = verdictStyles[scannedResult.suitability] || verdictStyles.moderate;
              return (
                <div className={`p-3.5 rounded-2xl border ${style.classes} space-y-1`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{style.icon}</span>
                    <span className="text-xs font-black uppercase tracking-wider">{style.label}</span>
                  </div>
                  {scannedResult.suitabilityReason && (
                    <p className="text-[11px] leading-relaxed opacity-90">{scannedResult.suitabilityReason}</p>
                  )}
                </div>
              );
            })()}

            <div className="p-4 rounded-2xl bg-zinc-900 border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{scannedResult.name}</h4>
                  <p className="text-[11px] text-zinc-400">{scannedResult.servingSize || tr('1 standard portion', '1 मानक हिस्सा')}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-emerald-400">{scannedResult.calories} kcal</div>
                  <div className="text-[10px] text-zinc-400">{tr('Calculated', 'गणना की गई')}</div>
                </div>
              </div>

              {/* Macro Bar Grid */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-800 text-center">
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">{tr('Protein', 'प्रोटीन')}</div>
                  <div className="text-sm font-bold text-white">{scannedResult.protein}g</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">{tr('Carbs', 'कार्ब्स')}</div>
                  <div className="text-sm font-bold text-white">{scannedResult.carbs}g</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">{tr('Fats', 'फैट्स')}</div>
                  <div className="text-sm font-bold text-white">{scannedResult.fats}g</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">{tr('Fiber', 'फाइबर')}</div>
                  <div className="text-sm font-bold text-white">{scannedResult.fiber || 3}g</div>
                </div>
              </div>

              {scannedResult.healthNote && (
                <p className="text-[11px] text-emerald-300/90 italic bg-emerald-950/20 p-2 rounded-lg">
                  {tr('Clinical Note:', 'क्लिनिकल टिप्पणी:')} {scannedResult.healthNote}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScannedResult(null)}
                className="w-1/3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                {tr('Scan Another', 'दूसरा स्कैन करें')}
              </button>
              <button
                id="log-meal-confirm-btn"
                type="button"
                onClick={handleConfirmAndAdd}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                <span>{tr('Log to', 'दर्ज करें')} {tr(category.toUpperCase(), (MEAL_CATEGORY_LABEL_HI[category] || category).toUpperCase())}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

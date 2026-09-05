import React, { useState, useRef, useEffect } from 'react';
import {
  X, Camera, Sparkles, Utensils, RefreshCw, Check, Plus,
  AlertCircle, Image as ImageIcon, Lock, Crown, ArrowRight, Upload, Aperture
} from 'lucide-react';
import { MealItem, UserHealthProfile } from '../types';
import { authedFetch } from '../utils/supabase';

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

  // Live camera capture (real-time, not just a file picker)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  };

  // Always release the camera when the modal closes/unmounts.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      // The <video> element only mounts once isCameraOpen is true, so attach the stream next tick.
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch (err) {
      console.error('Camera access failed:', err);
      setCameraError('Could not access the camera. Please allow camera permission, or upload a photo instead.');
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
      setError('Please type your meal description or upload a food photo.');
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

      if (!res.ok) throw new Error('Failed to analyze food');
      const data = await res.json();

      if (data.isFood === false) {
        // Scanned/uploaded item is not food — reject clearly instead of showing fake nutrition.
        setError(data.rejectionReason || 'That does not look like food. Please scan or upload a photo of an actual meal.');
        setScannedResult(null);
        return;
      }

      if (data.analysisFailed || data.isFood == null) {
        setError(data.rejectionReason || 'Could not analyze this right now. Please check your connection and try again.');
        setScannedResult(null);
        return;
      }

      setScannedResult(data);
    } catch (err) {
      console.error(err);
      setError('Could not reach the AI scanner. Please check your connection and try scanning again.');
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
              <span>UrCare Pro Feature</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Smart Food Camera is a Pro Feature
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              Unlock instant meal photo scanning, precision nutritional calculation, doctor prescriptions, and clinical protocols.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-time photo nutrient breakdown</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Automatic portion size & macro detection</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Clinical doctor guidance on lab reports</span>
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
            <span>Upgrade to Pro to Unlock Food Scanner</span>
            <ArrowRight className="w-4 h-4" />
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
                <h3 className="text-base font-bold text-white">Scan Food & Macros</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500 text-black">PRO</span>
              </div>
              <p className="text-[11px] text-zinc-400">Photo scan or describe meal</p>
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
          <label className="text-xs font-semibold text-zinc-400">Select Meal Slot:</label>
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
                {cat}
              </button>
            ))}
          </div>
        </div>

        {!scannedResult ? (
          <div className="space-y-4">
            {/* Upload or live snap photo */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-2">Snap or Upload Food Photo:</label>

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
              ) : isCameraOpen ? (
                /* Live real-time camera preview */
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-black">
                  <video ref={videoRef} playsInline muted className="w-full h-56 object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
                    title="Close camera"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="w-14 h-14 rounded-full bg-white ring-4 ring-emerald-500/60 hover:ring-emerald-400 flex items-center justify-center shadow-lg cursor-pointer active:scale-95 transition-all"
                      title="Capture photo"
                    >
                      <Aperture className="w-6 h-6 text-emerald-600" />
                    </button>
                  </div>
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
                      <span className="text-xs font-bold text-white">Take Photo</span>
                      <span className="text-[10px] text-zinc-500 mt-1 text-center">Live camera, real-time</span>
                    </button>

                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer bg-zinc-900/40 transition-colors">
                      <Upload className="w-8 h-8 text-emerald-400 mb-2" />
                      <span className="text-xs font-bold text-white">Upload Photo</span>
                      <span className="text-[10px] text-zinc-500 mt-1 text-center">From gallery / files</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center">Optical camera automatically calculates macros</p>
                </div>
              )}
            </div>

            {/* Or Text Description */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Or Describe Your Meal:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 2 rotis with paneer bhurji and 1 cup dal..."
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            {/* Quick Sample Prompts */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400">Quick Test Meals:</span>
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
                  <span>Analyzing food & calculating macros...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Scan & Calculate Nutritional Macros</span>
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
                good: { label: 'Good For You', classes: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', icon: '✅' },
                moderate: { label: 'Okay In Moderation', classes: 'bg-amber-500/15 border-amber-500/40 text-amber-300', icon: '⚠️' },
                avoid: { label: 'Better To Avoid', classes: 'bg-rose-500/15 border-rose-500/40 text-rose-300', icon: '⛔' },
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
                  <p className="text-[11px] text-zinc-400">{scannedResult.servingSize || '1 standard portion'}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-emerald-400">{scannedResult.calories} kcal</div>
                  <div className="text-[10px] text-zinc-400">Calculated</div>
                </div>
              </div>

              {/* Macro Bar Grid */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-800 text-center">
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">Protein</div>
                  <div className="text-sm font-bold text-white">{scannedResult.protein}g</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">Carbs</div>
                  <div className="text-sm font-bold text-white">{scannedResult.carbs}g</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">Fats</div>
                  <div className="text-sm font-bold text-white">{scannedResult.fats}g</div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950">
                  <div className="text-[10px] text-zinc-400">Fiber</div>
                  <div className="text-sm font-bold text-white">{scannedResult.fiber || 3}g</div>
                </div>
              </div>

              {scannedResult.healthNote && (
                <p className="text-[11px] text-emerald-300/90 italic bg-emerald-950/20 p-2 rounded-lg">
                  Clinical Note: {scannedResult.healthNote}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScannedResult(null)}
                className="w-1/3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                Scan Another
              </button>
              <button
                id="log-meal-confirm-btn"
                type="button"
                onClick={handleConfirmAndAdd}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Log to {category.toUpperCase()}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

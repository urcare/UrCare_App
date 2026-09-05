import React, { useState, useEffect } from 'react';
import { 
  Plus, Droplets, Trash2, 
  Activity, Zap, Check, Stethoscope, 
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, 
  Phone, PhoneCall, Pill, Dumbbell, Utensils, 
  MessageSquare, Heart, Info, ArrowUpRight
} from 'lucide-react';
import { 
  UserHealthProfile, MealItem, BurnActivity, 
  UserAccount, Prescription, MedicationLogItem, FeedbackSubmission 
} from '../types';
import { useTheme } from '../context/ThemeContext';
import { saveTodayLogToSupabase, VERIFIED_CLINICAL_DOCTORS } from '../utils/supabase';
import { DoctorConsultModal } from './DoctorConsultModal';
import { ClinicalFeedbackModal } from './ClinicalFeedbackModal';
import { SlideToComplete } from './SlideToComplete';

interface DailyTrackerProps {
  profile: UserHealthProfile;
  account: UserAccount;
  meals: MealItem[];
  waterMl: number;
  burnActivities: BurnActivity[];
  medications?: MedicationLogItem[];
  prescriptions?: Prescription[];
  onAddMeal: (meal: MealItem) => void;
  onDeleteMeal: (id: string) => void;
  onToggleMealCompleted: (id: string, completed: boolean) => void;
  onAddWater: (amountMl: number) => void;
  onResetWater: () => void;
  onAddBurnActivity: (activity: BurnActivity) => void;
  onDeleteBurnActivity?: (id: string) => void;
  onToggleActivityCompleted: (id: string, completed: boolean) => void;
  onOpenConsultDoctor?: (reason?: string) => void;
  onOpenFeedbackModal?: () => void;
}

export const DailyTracker: React.FC<DailyTrackerProps> = ({
  profile,
  account,
  meals,
  waterMl,
  burnActivities,
  medications: initialMedications,
  prescriptions = [],
  onAddMeal,
  onDeleteMeal,
  onToggleMealCompleted,
  onAddWater,
  onResetWater,
  onAddBurnActivity,
  onDeleteBurnActivity,
  onToggleActivityCompleted,
  onOpenConsultDoctor,
  onOpenFeedbackModal,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Format today's clinical date strictly for TODAY
  const today = new Date();
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const todayIsoDate = today.toISOString().split('T')[0];

  // Medications state for today
  const [medications, setMedications] = useState<MedicationLogItem[]>(() => {
    const defaultMeds: MedicationLogItem[] = [
      {
        id: 'med_1',
        name: 'Omega-3 Fish Oil (EPA 500mg / DHA 250mg)',
        dosage: '1 Capsule',
        frequency: 'Once Daily',
        timing: 'morning',
        taken: true,
        takenAt: '08:30 AM',
        prescribedBy: 'Clinical Protocol',
        notes: 'Take with breakfast to maximize bio-absorption.',
        aiSuggested: true,
      },
      {
        id: 'med_2',
        name: 'Vitamin D3 (Cholecalciferol 2000 IU)',
        dosage: '1 Softgel',
        frequency: 'Daily with meal',
        timing: 'morning',
        taken: false,
        prescribedBy: 'Dr. Ananya Sharma, MD',
        notes: 'Prescribed to correct sub-optimal Vitamin D biomarker levels.',
      },
      {
        id: 'med_3',
        name: 'Magnesium Glycinate (Chelated)',
        dosage: '200 mg',
        frequency: 'Nightly',
        timing: 'night',
        taken: false,
        prescribedBy: 'Clinical Protocol',
        notes: 'Supports neuromuscular recovery and deep sleep architecture.',
        aiSuggested: true,
      },
    ];
    return initialMedications && initialMedications.length > 0 ? initialMedications : defaultMeds;
  });

  // Modals & States
  const [isManualMealModalOpen, setIsManualMealModalOpen] = useState(false);
  const [manualCategory, setManualCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFats, setMealFats] = useState('');
  const [mealServing, setMealServing] = useState('1 plate');

  // Workout Modal
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [activityCalories, setActivityCalories] = useState('220');
  const [activityDuration, setActivityDuration] = useState('30');
  const [activityType, setActivityType] = useState<'gym' | 'walk' | 'run' | 'cycling' | 'yoga' | 'sports'>('walk');

  // Medication Modal
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('1 Tablet');
  const [medTiming, setMedTiming] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [medNotes, setMedNotes] = useState('');

  // Doctor Direct Call Modal
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [doctorConsultReason, setDoctorConsultReason] = useState<string>('');

  // 3 to 6 day feedback modal
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Target metrics calculation
  const targetCalories = profile.calculatedPlan?.targetCalories || 1850;
  const targetProtein = profile.calculatedPlan?.proteinGrams || 130;
  const targetCarbs = profile.calculatedPlan?.carbsGrams || 180;
  const targetFats = profile.calculatedPlan?.fatsGrams || 50;
  const targetWaterMl = (profile.calculatedPlan?.waterLiters || 3.0) * 1000;

  // Real-time totals for TODAY (Based on completed meals & activities)
  const completedMeals = meals.filter(m => m.completed);
  const consumedCalories = completedMeals.reduce((acc, m) => acc + (m.calories || 0), 0);
  const consumedProtein = completedMeals.reduce((acc, m) => acc + (m.protein || 0), 0);
  const consumedCarbs = completedMeals.reduce((acc, m) => acc + (m.carbs || 0), 0);
  const consumedFats = completedMeals.reduce((acc, m) => acc + (m.fats || 0), 0);

  const completedActivities = burnActivities.filter(a => a.completed);
  const burnedCalories = completedActivities.reduce((acc, a) => acc + (a.caloriesBurned || 0), 0);
  const remainingCalories = Math.max(0, targetCalories - consumedCalories + burnedCalories);

  // Save changes to Supabase sync on changes
  useEffect(() => {
    saveTodayLogToSupabase(profile.id || account.uid || 'usr_active', {
      date: todayIsoDate,
      meals,
      waterMl,
      burnedActivities: burnActivities,
      medications,
    });
  }, [meals, waterMl, burnActivities, medications, profile.id, account.uid, todayIsoDate]);

  // Handle toggling medication status
  const handleToggleMedication = (id: string) => {
    setMedications((prev) =>
      prev.map((med) => {
        if (med.id === id) {
          const newStatus = !med.taken;
          return {
            ...med,
            taken: newStatus,
            takenAt: newStatus ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          };
        }
        return med;
      })
    );
  };

  const handleAddCustomMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;

    const newMed: MedicationLogItem = {
      id: 'med_' + Date.now(),
      name: medName.trim(),
      dosage: medDosage.trim() || 'As directed',
      frequency: 'Daily',
      timing: medTiming,
      taken: false,
      prescribedBy: 'Patient Logged',
      notes: medNotes.trim() || undefined,
    };

    setMedications((prev) => [newMed, ...prev]);
    setMedName('');
    setMedDosage('1 Tablet');
    setMedNotes('');
    setIsMedModalOpen(false);
  };

  const handleDeleteMedication = (id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  // Trigger Doctor Phone Call Modal
  const triggerDoctorConsultation = (reason: string) => {
    setDoctorConsultReason(reason);
    setIsDoctorModalOpen(true);
    if (onOpenConsultDoctor) onOpenConsultDoctor(reason);
  };

  // Group meals by category
  const mealCategories: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealsByCategory = mealCategories.reduce((acc, cat) => {
    acc[cat] = meals.filter((m) => m.category === cat);
    return acc;
  }, {} as Record<string, MealItem[]>);

  const cardBg = isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-sm';
  const subCardBg = isDark ? 'bg-zinc-900/60 border border-zinc-800/80' : 'bg-zinc-50 border border-zinc-200';

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      
      {/* 1. TODAY'S HEADER BANNER (Strictly Today's Log) */}
      <div className={`p-6 rounded-3xl ${cardBg} transition-all`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Clinical Protocol
              </span>
              <span className="text-xs font-mono font-bold opacity-60">
                {todayFormatted}
              </span>
            </div>

            <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Today's Metabolic Log
            </h2>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Slide to complete each scheduled meal and workout. Remaining calories update automatically in real-time.
            </p>
          </div>

          {/* Quick Doctor Phone Hotline Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => triggerDoctorConsultation('Consult assigned doctor regarding today’s metabolic targets or medication queries.')}
              className="px-4 py-2.5 rounded-xl border border-emerald-500/40 hover:border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all"
            >
              <PhoneCall className="w-4 h-4 stroke-[2.5]" />
              <span>Call Doctor</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Submit 3-6 Day Adherence Feedback"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Feedback Checkpoint</span>
            </button>
          </div>

        </div>

        {/* 2. CALORIC & MACRO SUMMARY CARDS (Dynamic Real-time Values) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-zinc-800/40">
          
          <div className={`p-4 rounded-2xl ${subCardBg} space-y-1`}>
            <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Remaining Cal</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-500 font-mono">
              {remainingCalories} <span className="text-xs opacity-60">kcal</span>
            </div>
            <div className="text-[11px] opacity-60 font-medium">Target: {targetCalories} kcal</div>
          </div>

          <div className={`p-4 rounded-2xl ${subCardBg} space-y-1`}>
            <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Consumed</span>
            <div className={`text-xl sm:text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              {consumedCalories} <span className="text-xs opacity-60">kcal</span>
            </div>
            <div className="text-[11px] opacity-60 font-medium">Burned: -{burnedCalories} kcal</div>
          </div>

          <div className={`p-4 rounded-2xl ${subCardBg} space-y-1`}>
            <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Protein (P)</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-teal-500">
              {consumedProtein} <span className="text-xs opacity-60">/ {targetProtein}g</span>
            </div>
            <div className="text-[11px] opacity-60 font-medium">Goal: {Math.round((consumedProtein / targetProtein) * 100)}%</div>
          </div>

          <div className={`p-4 rounded-2xl ${subCardBg} space-y-1`}>
            <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Carbs & Fats</span>
            <div className="text-sm font-black font-mono pt-1">
              <span className="text-amber-500">C: {consumedCarbs}/{targetCarbs}g</span> • <span className="text-rose-500">F: {consumedFats}/{targetFats}g</span>
            </div>
            <div className="text-[11px] opacity-60 font-medium">Hydration: {waterMl} / {targetWaterMl} ml</div>
          </div>

        </div>
      </div>

      {/* 3. MODULE 1: TODAY'S MEALS WITH 3D SLIDE-TO-COMPLETE MECHANISM */}
      <section className={`p-6 rounded-3xl ${cardBg} space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-black">1. Today's Meals</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Automatic precision nutrition plan. Slide left-to-right when you finish a meal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setManualCategory('lunch');
                setIsManualMealModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Log Custom Food</span>
            </button>
          </div>
        </div>

        {/* Meal Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mealCategories.map((cat) => {
            const catMeals = mealsByCategory[cat] || [];
            const catCalories = catMeals.reduce((sum, m) => sum + m.calories, 0);

            return (
              <div 
                key={cat} 
                className={`p-4 rounded-2xl border ${subCardBg} space-y-3.5`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-500">
                      {cat}
                    </span>
                    <span className="text-xs font-mono font-bold opacity-60">
                      ({catCalories} kcal planned)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setManualCategory(cat);
                      setIsManualMealModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10 text-xs font-bold transition-all"
                    title={`Add item to ${cat}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {catMeals.length > 0 ? (
                  <div className="space-y-3">
                    {catMeals.map((item) => (
                      <div 
                        key={item.id} 
                        className={`p-4 rounded-2xl border ${
                          item.completed 
                            ? 'border-emerald-500/40 bg-emerald-500/5' 
                            : isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
                        } space-y-3 transition-all`}
                      >
                        <div className="flex items-start justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-extrabold ${item.completed ? 'line-through opacity-70' : isDark ? 'text-white' : 'text-zinc-900'}`}>
                                {item.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] opacity-75 font-mono">
                              <span className="font-bold text-emerald-500">{item.calories} kcal</span>
                              <span>• P: {item.protein}g</span>
                              <span>• C: {item.carbs}g</span>
                              <span>• F: {item.fats}g</span>
                            </div>
                            {item.servingSize && (
                              <span className="text-[10px] opacity-50 block">{item.servingSize} • {item.timestamp}</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onDeleteMeal(item.id)}
                            className="p-1 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Delete meal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 3D Slide to Complete Mechanism */}
                        <SlideToComplete
                          id={`meal-${item.id}`}
                          isCompleted={!!item.completed}
                          onComplete={() => onToggleMealCompleted(item.id, true)}
                          onUndo={() => onToggleMealCompleted(item.id, false)}
                          label="Slide to mark eaten"
                          completedLabel="Meal Eaten & Logged"
                          compact={true}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-5 text-center opacity-45 text-xs">
                    No {cat} scheduled. Tap + to add custom food.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. MODULE 2: TODAY'S EXERCISE WITH 3D SLIDE-TO-COMPLETE MECHANISM */}
      <section className={`p-6 rounded-3xl ${cardBg} space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600/10 text-teal-600 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-black">2. Today's Exercise & Physical Activity</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Automatic metabolic burn protocol. Slide left-to-right to mark workout complete.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Exercise</span>
            </button>
          </div>
        </div>

        {/* Exercise Items List with 3D Slider */}
        {burnActivities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {burnActivities.map((act) => (
              <div 
                key={act.id} 
                className={`p-4 rounded-2xl border ${
                  act.completed
                    ? 'border-teal-600/40 bg-teal-600/5'
                    : isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'
                } space-y-3 transition-all`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-600 flex items-center justify-center font-bold shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${act.completed ? 'line-through opacity-70' : isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {act.name}
                      </h4>
                      <div className="text-[11px] opacity-75 font-mono mt-0.5">
                        {act.durationMinutes} mins • <span className="text-teal-600 font-bold">-{act.caloriesBurned} kcal</span>
                      </div>
                    </div>
                  </div>

                  {onDeleteBurnActivity && (
                    <button
                      type="button"
                      onClick={() => onDeleteBurnActivity(act.id)}
                      className="p-1 text-zinc-500 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 3D Slide to Complete Workout */}
                <SlideToComplete
                  id={`act-${act.id}`}
                  isCompleted={!!act.completed}
                  onComplete={() => onToggleActivityCompleted(act.id, true)}
                  onUndo={() => onToggleActivityCompleted(act.id, false)}
                  label="Slide to complete workout"
                  completedLabel="Workout Completed & Burned"
                  compact={true}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center opacity-50 text-xs">
            No physical activity logged for today yet. Tap Log Exercise to add.
          </div>
        )}
      </section>

      {/* 5. MODULE 3: TODAY'S MEDICATIONS & CLINICAL SUPPLEMENTS */}
      <section className={`p-6 rounded-3xl ${cardBg} space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-black">3. Today's Medications & Supplements</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Prescribed medical dosages, vitamin pacing, and adherence tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMedModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Medication</span>
            </button>
          </div>
        </div>

        {/* Medications List */}
        <div className="space-y-3">
          {medications.map((med) => (
            <div 
              key={med.id} 
              className={`p-4 rounded-2xl border transition-all ${
                med.taken 
                  ? 'border-emerald-500/40 bg-emerald-500/5' 
                  : isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50'
              } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleMedication(med.id)}
                  className={`w-6 h-6 rounded-lg border-2 mt-0.5 flex items-center justify-center transition-all ${
                    med.taken 
                      ? 'bg-emerald-500 border-emerald-500 text-black' 
                      : 'border-zinc-500 hover:border-emerald-500'
                  }`}
                >
                  {med.taken && <Check className="w-4 h-4 stroke-[3]" />}
                </button>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-black ${med.taken ? 'line-through opacity-70' : isDark ? 'text-white' : 'text-zinc-900'}`}>
                      {med.name}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
                      {med.timing}
                    </span>
                  </div>

                  <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Dosage: <span className="font-semibold text-emerald-500">{med.dosage}</span> • {med.frequency}
                  </p>

                  {med.notes && (
                    <p className="text-[11px] opacity-60 italic">
                      {med.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/40">
                <span className="text-[11px] font-mono opacity-60">
                  {med.taken ? `Taken at ${med.takenAt || 'Today'}` : 'Status: Pending'}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteMedication(med.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Doctor Consultation Info Strip */}
        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-300'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <div className="flex items-center gap-2.5 text-xs opacity-80">
            <Info className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Need customized medical prescriptions or condition-specific drug dosing?</span>
          </div>
          <button
            type="button"
            onClick={() => triggerDoctorConsultation('Prescription and drug-nutrient interaction verification.')}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all shadow-sm"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Consult Doctor by Phone</span>
          </button>
        </div>
      </section>

      {/* 6. VERIFIED PHYSICIAN CARD (Initiates Direct Phone Call) */}
      <section className={`p-6 rounded-3xl ${cardBg} space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black">Registered Clinical Physician Direct Hotline</h3>
              <p className="text-xs opacity-60">Board-certified medical oversight for clinical queries and prescriptions.</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">
            Available Now
          </span>
        </div>

        <div className={`p-4 rounded-2xl border ${subCardBg} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold">{VERIFIED_CLINICAL_DOCTORS[0].name}</h4>
            <p className="text-xs text-emerald-500 font-semibold">{VERIFIED_CLINICAL_DOCTORS[0].qualification}</p>
            <p className="text-[11px] opacity-60">Reg. No: {VERIFIED_CLINICAL_DOCTORS[0].registrationNumber} • {VERIFIED_CLINICAL_DOCTORS[0].hospitalAffiliation}</p>
          </div>

          <a
            href={VERIFIED_CLINICAL_DOCTORS[0].directDialNumber}
            className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0"
          >
            <PhoneCall className="w-4 h-4 stroke-[2.5]" />
            <span>Call Doctor ({VERIFIED_CLINICAL_DOCTORS[0].phone})</span>
          </a>
        </div>
      </section>

      {/* MODAL 1: MANUAL MEAL LOGGING */}
      {isManualMealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl ${cardBg} space-y-4 text-left`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
              <h3 className="text-base font-black">Log Today's Meal ({manualCategory})</h3>
              <button
                type="button"
                onClick={() => setIsManualMealModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100 font-bold"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!mealName.trim()) return;
                onAddMeal({
                  id: 'meal_' + Date.now(),
                  name: mealName.trim(),
                  calories: Number(mealCalories) || 350,
                  protein: Number(mealProtein) || 20,
                  carbs: Number(mealCarbs) || 40,
                  fats: Number(mealFats) || 10,
                  servingSize: mealServing,
                  category: manualCategory,
                  completed: true, // Manual log defaults to eaten
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });
                setMealName('');
                setMealCalories('');
                setMealProtein('');
                setMealCarbs('');
                setMealFats('');
                setIsManualMealModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold opacity-80 mb-1">Meal / Food Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grilled Chicken Salad, Dal Tadka with Roti"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Calories (kcal)</label>
                  <input
                    type="number"
                    placeholder="350"
                    value={mealCalories}
                    onChange={(e) => setMealCalories(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    placeholder="25"
                    value={mealProtein}
                    onChange={(e) => setMealProtein(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    placeholder="35"
                    value={mealCarbs}
                    onChange={(e) => setMealCarbs(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Fats (g)</label>
                  <input
                    type="number"
                    placeholder="10"
                    value={mealFats}
                    onChange={(e) => setMealFats(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all"
              >
                Add to Today's {manualCategory}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL EXERCISE LOGGING */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl ${cardBg} space-y-4 text-left`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
              <h3 className="text-base font-black">Log Today's Workout Activity</h3>
              <button
                type="button"
                onClick={() => setIsActivityModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100 font-bold"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!activityName.trim()) return;
                onAddBurnActivity({
                  id: 'act_' + Date.now(),
                  name: activityName.trim(),
                  caloriesBurned: Number(activityCalories) || 200,
                  durationMinutes: Number(activityDuration) || 30,
                  type: activityType,
                  completed: true, // Manual log defaults to completed
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });
                setActivityName('');
                setIsActivityModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold opacity-80 mb-1">Exercise / Sport Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5km Brisk Walk, Dumbbell Upper Body"
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Calories Burned (kcal)</label>
                  <input
                    type="number"
                    value={activityCalories}
                    onChange={(e) => setActivityCalories(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={activityDuration}
                    onChange={(e) => setActivityDuration(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-black font-black text-xs uppercase tracking-wider transition-all"
              >
                Log Today's Workout
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD MEDICATION */}
      {isMedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl ${cardBg} space-y-4 text-left`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
              <h3 className="text-base font-black">Add Medication / Supplement</h3>
              <button
                type="button"
                onClick={() => setIsMedModalOpen(false)}
                className="text-xs opacity-60 hover:opacity-100 font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddCustomMedication} className="space-y-3">
              <div>
                <label className="block text-xs font-bold opacity-80 mb-1">Medication / Supplement Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin 500mg, Multivitamin"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    placeholder="1 Tablet / 500mg"
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold opacity-80 mb-1">Timing</label>
                  <select
                    value={medTiming}
                    onChange={(e) => setMedTiming(e.target.value as any)}
                    className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                    }`}
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="night">Night / Bedtime</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold opacity-80 mb-1">Clinical Instructions / Notes</label>
                <input
                  type="text"
                  value={medNotes}
                  onChange={(e) => setMedNotes(e.target.value)}
                  placeholder="Take post-meal with water"
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-950'
                  }`}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-black text-xs uppercase tracking-wider transition-all"
              >
                Save to Today's Protocol
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DOCTOR DIRECT CALL MODAL */}
      {isDoctorModalOpen && (
        <DoctorConsultModal
          isOpen={isDoctorModalOpen}
          onClose={() => setIsDoctorModalOpen(false)}
          profile={profile}
          reason={doctorConsultReason}
        />
      )}

      {/* 3 TO 6 DAY FEEDBACK MODAL */}
      {isFeedbackModalOpen && (
        <ClinicalFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          userId={profile.id || account.uid || 'usr_active'}
          userName={profile.name || account.displayName || 'Valued Patient'}
          dayCycleNumber={4}
        />
      )}

    </div>
  );
};

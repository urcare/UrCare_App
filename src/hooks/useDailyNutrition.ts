import { useCallback, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { UserHealthProfile } from '../types';
import { getDailyLog, addWaterIntake, resetWaterIntake, addQuickMacroLog, resetQuickMacroLog, addQuickCalorieLog, resetQuickCalorieLog, logActivity } from '../utils/supabase';
import { toDateKey } from '../components/DailyCalendar';

/** Today's real logged water/macros/calories, plus every handler needed to
 *  edit them — extracted out of AccountPage so the same live tracking (not
 *  a second, parallel copy of it) can also power the standalone Tracker
 *  module. Both consumers share one source of truth: the same daily_logs
 *  row, refetched via the same `urcare:daily-log-changed` event any part
 *  of the app (the food scanner, a quick "+10g protein" tap, etc.) fires. */
export function useDailyNutrition(profile: UserHealthProfile, onUpdateProfile: (updated: UserHealthProfile) => void) {
  const userId = profile.id || '';
  const todayKey = toDateKey(new Date());

  const [waterMl, setWaterMl] = useState(0);
  const [consumedMacros, setConsumedMacros] = useState({ protein: 0, carbs: 0, fats: 0 });
  const [consumedCalories, setConsumedCalories] = useState(0);
  const [isSavingWater, setIsSavingWater] = useState(false);
  const [isSavingMacro, setIsSavingMacro] = useState(false);
  const [isSavingCalories, setIsSavingCalories] = useState(false);

  const refreshDailyLog = useCallback(() => {
    if (!userId) return;
    getDailyLog(userId, todayKey).then((log) => {
      setWaterMl(log?.waterMl || 0);
      const meals = log?.meals || [];
      setConsumedMacros({
        protein: meals.reduce((sum, m) => sum + (m.protein || 0), 0),
        carbs: meals.reduce((sum, m) => sum + (m.carbs || 0), 0),
        fats: meals.reduce((sum, m) => sum + (m.fats || 0), 0),
      });
      setConsumedCalories(meals.reduce((sum, m) => sum + (m.calories || 0), 0));
    });
  }, [userId, todayKey]);

  useEffect(() => {
    refreshDailyLog();
  }, [refreshDailyLog]);

  // Scanning a meal, or logging water/macros from elsewhere (e.g. Home),
  // fires this — keeps every consumer in sync without needing its own polling.
  useEffect(() => {
    window.addEventListener('urcare:daily-log-changed', refreshDailyLog);
    return () => window.removeEventListener('urcare:daily-log-changed', refreshDailyLog);
  }, [refreshDailyLog]);

  const { calculatedPlan } = profile;
  const waterTargetMl = profile.preferences?.customWaterTargetMl ?? (calculatedPlan?.waterLiters || 3.2) * 1000;
  const calorieTarget = profile.preferences?.customCalorieTarget ?? (calculatedPlan?.targetCalories || 1850);
  const macroTargets: Record<'protein' | 'carbs' | 'fats', number> = {
    protein: profile.preferences?.customMacroTargets?.protein ?? (calculatedPlan?.proteinGrams || 130),
    carbs: profile.preferences?.customMacroTargets?.carbs ?? (calculatedPlan?.carbsGrams || 180),
    fats: profile.preferences?.customMacroTargets?.fats ?? (calculatedPlan?.fatsGrams || 50),
  };

  // Real water intake, capped at the real target — never invents an
  // "over target" number the way the macros deliberately allow (protein/
  // carbs/fat going over is useful info; hydration is a simpler
  // "did you hit it" goal), and celebrates the moment it's actually hit.
  const handleAddWater = async (deltaMl: number) => {
    if (!userId) return;
    const remaining = Math.max(0, waterTargetMl - waterMl);
    if (remaining <= 0) return;
    const cappedDelta = Math.min(deltaMl, remaining);
    const willReachTarget = waterMl + cappedDelta >= waterTargetMl;

    setIsSavingWater(true);
    setWaterMl((prev) => Math.min(waterTargetMl, prev + cappedDelta));
    try {
      const confirmed = await addWaterIntake(userId, todayKey, cappedDelta);
      setWaterMl(Math.min(waterTargetMl, confirmed));
      if (willReachTarget) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#0ea5e9', '#2dd4bf', '#ffffff'] });
      }
    } finally {
      setIsSavingWater(false);
    }
  };

  const handleResetWater = async () => {
    if (!userId) return;
    setIsSavingWater(true);
    setWaterMl(0);
    try {
      await resetWaterIntake(userId, todayKey);
    } finally {
      setIsSavingWater(false);
    }
  };

  const handleEditWaterTarget = (newTargetMl: number) => {
    onUpdateProfile({
      ...profile,
      preferences: { ...(profile.preferences as any || {}), customWaterTargetMl: newTargetMl },
    });
    if (userId) logActivity(userId, 'updated', 'target', `Changed water target to ${(newTargetMl / 1000).toFixed(1)}L`).catch(() => {});
  };

  // Real macro intake, capped at the real target — same "won't go past,
  // celebrates the moment it's actually hit" treatment as water above.
  const handleAddMacro = async (macro: 'protein' | 'carbs' | 'fats', grams: number) => {
    if (!userId) return;
    const target = macroTargets[macro];
    const current = consumedMacros[macro];
    const remaining = Math.max(0, target - current);
    if (remaining <= 0) return;
    const cappedGrams = Math.min(grams, remaining);
    const willReachTarget = current + cappedGrams >= target;

    setIsSavingMacro(true);
    setConsumedMacros((prev) => ({ ...prev, [macro]: Math.min(target, prev[macro] + cappedGrams) }));
    try {
      await addQuickMacroLog(userId, todayKey, macro, cappedGrams);
      refreshDailyLog();
      if (willReachTarget) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#ffffff'] });
      }
    } finally {
      setIsSavingMacro(false);
    }
  };

  // Clears only the manually-logged amount (never a real scanned meal — see
  // resetQuickMacroLog) — no optimistic zeroing, since a real scanned meal's
  // contribution to this macro should stay visible until refreshDailyLog
  // confirms the real post-reset total.
  const handleResetMacro = async (macro: 'protein' | 'carbs' | 'fats') => {
    if (!userId) return;
    setIsSavingMacro(true);
    try {
      await resetQuickMacroLog(userId, todayKey, macro);
      refreshDailyLog();
    } finally {
      setIsSavingMacro(false);
    }
  };

  // A macro's target is the profile's own calculated plan value, unless the
  // user has overridden it here (persisted to profile.preferences — see
  // customMacroTargets in types.ts).
  const handleEditMacroTarget = (macro: 'protein' | 'carbs' | 'fats', newTargetG: number) => {
    onUpdateProfile({
      ...profile,
      preferences: {
        ...(profile.preferences as any || {}),
        customMacroTargets: { ...(profile.preferences?.customMacroTargets || {}), [macro]: newTargetG },
      },
    });
    if (userId) logActivity(userId, 'updated', 'target', `Changed ${macro} target to ${newTargetG}g`).catch(() => {});
  };

  const handleAddCalories = async (kcal: number) => {
    if (!userId) return;
    const remaining = Math.max(0, calorieTarget - consumedCalories);
    if (remaining <= 0) return;
    const cappedKcal = Math.min(kcal, remaining);
    const willReachTarget = consumedCalories + cappedKcal >= calorieTarget;

    setIsSavingCalories(true);
    setConsumedCalories((prev) => Math.min(calorieTarget, prev + cappedKcal));
    try {
      await addQuickCalorieLog(userId, todayKey, cappedKcal);
      refreshDailyLog();
      if (willReachTarget) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#f59e0b', '#ffffff'] });
      }
    } finally {
      setIsSavingCalories(false);
    }
  };

  const handleResetCalories = async () => {
    if (!userId) return;
    setIsSavingCalories(true);
    try {
      await resetQuickCalorieLog(userId, todayKey);
      refreshDailyLog();
    } finally {
      setIsSavingCalories(false);
    }
  };

  const handleEditCalorieTarget = (newTarget: number) => {
    onUpdateProfile({
      ...profile,
      preferences: { ...(profile.preferences as any || {}), customCalorieTarget: newTarget },
    });
    if (userId) logActivity(userId, 'updated', 'target', `Changed calorie target to ${newTarget} kcal`).catch(() => {});
  };

  return {
    waterMl, consumedMacros, consumedCalories,
    isSavingWater, isSavingMacro, isSavingCalories,
    waterTargetMl, calorieTarget, macroTargets,
    handleAddWater, handleResetWater, handleEditWaterTarget,
    handleAddMacro, handleResetMacro, handleEditMacroTarget,
    handleAddCalories, handleResetCalories, handleEditCalorieTarget,
  };
}

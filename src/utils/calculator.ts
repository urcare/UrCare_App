import { CalculatedPlan, GenderType, ActivityLevel, GoalPace, GoalType, MedicalReportAnalysis } from '../types';

export function calculateNutritionPlan(
  gender: GenderType,
  age: number,
  heightCm: number,
  currentWeightKg: number,
  targetWeightKg: number,
  goal: GoalType,
  activity: ActivityLevel,
  pace: GoalPace,
  reportAnalysis?: MedicalReportAnalysis
): CalculatedPlan {
  // 1. Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor equation
  let bmr: number;
  if (gender === 'male') {
    bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age + 5;
  } else if (gender === 'female') {
    bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age - 161;
  } else {
    bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age - 78;
  }

  // 2. Activity Multiplier for Total Daily Energy Expenditure (TDEE)
  const activityMultipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    athlete: 1.9,
  };
  const tdee = Math.round(bmr * (activityMultipliers[activity] || 1.375));

  // 3. Weekly Weight Change Rate & Calorie Adjustment
  let weeklyChangeKg = 0.5;
  let dailyCalorieDelta = 0;

  if (goal === 'lose_weight') {
    const paceDeficitMap: Record<GoalPace, { kgPerWeek: number; deficit: number }> = {
      slow: { kgPerWeek: 0.25, deficit: 250 },
      steady: { kgPerWeek: 0.5, deficit: 500 },
      moderate: { kgPerWeek: 0.75, deficit: 750 },
      fast: { kgPerWeek: 1.0, deficit: 900 },
    };
    const selected = paceDeficitMap[pace] || paceDeficitMap.steady;
    weeklyChangeKg = -selected.kgPerWeek;
    dailyCalorieDelta = -selected.deficit;
  } else if (goal === 'build_muscle') {
    const paceSurplusMap: Record<GoalPace, { kgPerWeek: number; surplus: number }> = {
      slow: { kgPerWeek: 0.15, surplus: 200 },
      steady: { kgPerWeek: 0.25, surplus: 350 },
      moderate: { kgPerWeek: 0.35, surplus: 450 },
      fast: { kgPerWeek: 0.5, surplus: 600 },
    };
    const selected = paceSurplusMap[pace] || paceSurplusMap.steady;
    weeklyChangeKg = selected.kgPerWeek;
    dailyCalorieDelta = selected.surplus;
  } else if (goal === 'reverse_condition' || goal === 'improve_health') {
    // Gentle mild deficit or maintenance focused on nutrient density
    weeklyChangeKg = -0.3;
    dailyCalorieDelta = -300;
  } else {
    // maintain & tone
    weeklyChangeKg = 0;
    dailyCalorieDelta = 0;
  }

  let targetCalories = Math.max(1200, Math.round(tdee + dailyCalorieDelta));

  // 4. Macro Calculation (Protein, Fats, Carbs)
  let proteinMultiplier = 1.8; // default 1.8g/kg
  if (goal === 'build_muscle') proteinMultiplier = 2.2;
  if (goal === 'lose_weight') proteinMultiplier = 2.0; // preserve lean mass
  if (activity === 'athlete') proteinMultiplier = 2.4;

  // If medical report has specific protein adjustment
  if (reportAnalysis?.macroAdjustments?.proteinMultiplier) {
    proteinMultiplier = reportAnalysis.macroAdjustments.proteinMultiplier;
  }

  let proteinGrams = Math.round(currentWeightKg * proteinMultiplier);
  const proteinCalories = proteinGrams * 4;

  // Fats: 25% - 30% of total calories
  let fatPercentage = 0.25;
  if (reportAnalysis?.identifiedRisks?.some(r => r.toLowerCase().includes('cholesterol') || r.toLowerCase().includes('lipid'))) {
    fatPercentage = 0.22; // lower fat if lipid risk
  }
  const fatCalories = targetCalories * fatPercentage;
  let fatsGrams = Math.round(fatCalories / 9);

  // Carbs: Remaining calories
  let remainingCalories = targetCalories - proteinCalories - fatCalories;
  if (remainingCalories < 400) {
    remainingCalories = 400;
  }
  let carbsGrams = Math.round(remainingCalories / 4);

  // 5. Hydration calculation (35ml per kg bodyweight + activity bonus)
  const baseWater = (currentWeightKg * 35) / 1000;
  const activityWaterBonus = activity === 'athlete' ? 1.0 : activity === 'very_active' ? 0.75 : 0.5;
  const waterLiters = Number((baseWater + activityWaterBonus).toFixed(1));

  // 6. Target Date Prediction
  const weightDifference = Math.abs(currentWeightKg - targetWeightKg);
  let weeksNeeded = 1;
  if (Math.abs(weeklyChangeKg) > 0.05) {
    weeksNeeded = Math.ceil(weightDifference / Math.abs(weeklyChangeKg));
  } else {
    weeksNeeded = 12; // 12 weeks maintenance & habit phase
  }

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + weeksNeeded * 7);
  const targetDate = futureDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // 7. Dynamic Health Score (out of 100) & BMI
  let healthScore = 88;
  const calculatedBmi = Number((currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
  if (calculatedBmi >= 18.5 && calculatedBmi <= 24.9) healthScore += 6;
  if (reportAnalysis) healthScore += 5; // bonus for proactive report scanning

  return {
    bmr: Math.round(bmr),
    tdee,
    targetCalories,
    proteinGrams,
    carbsGrams,
    fatsGrams,
    waterLiters,
    targetDate,
    weeklyChangeKg,
    healthScore: Math.min(99, healthScore),
    calorieDeficitOrSurplus: dailyCalorieDelta,
    bmi: calculatedBmi,
  };
}

export type GoalType = 'lose_weight' | 'build_muscle' | 'maintain_tone' | 'improve_health' | 'reverse_condition';

export type GenderType = 'male' | 'female' | 'other';

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'athlete';

export type GoalPace = 'slow' | 'steady' | 'moderate' | 'fast';

export interface UserPreferences {
  enableNotifications: boolean;
  colorBurnsBack: boolean;
  rolloverCalories: boolean;
  workoutDaysPerWeek: '0-2' | '3-5' | '6+';
  heardFrom: string;
  triedOtherApps: boolean;
  worksWithTrainerOrDietitian: boolean;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  accomplishments: string[];
  referralCode?: string;
  customDietNote?: string;
  autoPayEnabled?: boolean;
}

export interface RootCauseAssessmentData {
  // Contact info
  email: string;
  whatsappNumber: string;
  preferredContactMethod: 'whatsapp' | 'call' | 'email';
  bestContactTime: string;
  communicationLanguage: string;
  backupContactName?: string;
  backupContactRelationship?: string;
  backupContactNumber?: string;

  // 1. Patient Details
  fullName: string;
  age: number;
  gender: GenderType;
  heightFeet: number;
  heightInches: number;
  currentWeightKg: number;
  highestWeightKg?: number;
  highestWeightWhen?: string;
  waistCircumferenceInches?: number;
  cityStateCountry: string;
  occupation: string;
  workHoursPerDay: number;
  workType: 'seated' | 'physical' | 'standing' | 'mixed' | 'shift' | 'retired' | 'not_working';

  // 2. Main Health Concerns & Goals
  mainHealthConcern: string;
  bothersomeSymptoms: string;
  goal90to120Days: string;
  overallHealthRating: number; // 0 - 10
  energyLevelRating: number; // 0 - 10
  qualityOfLifeRating: number; // 0 - 10
  successfulTreatmentVision: string;

  // 3. Current and Previous Medical Conditions
  diagnosedConditions: {
    conditionName: string;
    diagnosedMonthYear: string;
    currentStatus: 'controlled' | 'uncontrolled' | 'worsening';
    severityRating: number; // 0 - 10
    beganWhen: string;
    currentTreatment: string;
  }[];
  hospitalisationHistory?: string;
  emergencyEpisodeHistory?: string;

  // 4. Medicines, Insulin, Supplements, Allergies
  medicinesList: {
    name: string;
    dose: string;
    timing: string;
    frequencyPerDay: string;
    sinceWhen: string;
    reason: string;
  }[];
  vitaminsAndSupplements?: string;
  insulinDetails?: {
    isUsingInsulin: boolean;
    basalInsulin?: string;
    rapidBreakfastUnits?: string;
    rapidLunchUnits?: string;
    rapidDinnerUnits?: string;
    totalDailyDose?: string;
    recentDoseChanges?: string;
    lowSugarEpisodes?: string;
  };
  steroidsLast6Months?: string;
  medicinesStoppedLast3Months?: string;
  medicinesStoppedReason?: string;
  frequentlyMissedMedicines?: string;
  allergies?: {
    medicineAllergies?: string;
    foodAllergies?: string;
    environmentalAllergies?: string;
    adverseReactions?: string;
  };

  // 5. Current Health Readings
  bloodSugar: {
    monitorsSugar: boolean;
    monitoringMethod?: 'glucometer' | 'cgm' | 'lab';
    averageFasting7Days?: string;
    averagePostMeal7Days?: string;
    morningSpikes?: boolean;
    postMealSpikes?: boolean;
    lowSugarEpisodes?: boolean;
    lowSugarDetails?: string;
    latestHbA1c?: string;
    latestHbA1cDate?: string;
    hba1c3MonthsAgo?: string;
    hba1c6MonthsAgo?: string;
    highestHbA1cEver?: string;
  };
  cardioVitals: {
    recentBp?: string;
    usualBpRange?: string;
    standingDizziness?: boolean;
    restingPulse?: string;
    palpitations?: boolean;
    currentWeight?: string;
    weight3MonthsAgo?: string;
    weight6MonthsAgo?: string;
    spO2?: string;
    ketone?: string;
    creatinine?: string;
    egfr?: string;
    uricAcid?: string;
    otherTracked?: string;
  };

  // 6. Sleep, Stress & Mental Wellbeing
  sleep: {
    sleepTime: string;
    wakeUpTime: string;
    averageSleepHours: number;
    sleepQuality: 'good' | 'average' | 'poor' | 'very_poor';
    difficultyFallingAsleep: boolean;
    wakesDuringNight: boolean;
    wakeCount?: string;
    nightTimeUrinationCount?: string;
    wakesRefreshed: boolean;
    snores: string;
    gaspOrStopBreathing: string;
    sleepApnoeaDiagnosed: boolean;
    cpapUsed: boolean;
    daytimeSleepinessNapping?: string;
    sleepMedicineOrAid?: string;
    shiftWork: boolean;
    sleepDisturbances?: string;
  };
  stressMental: {
    stressLevel: 'low' | 'moderate' | 'high' | 'overwhelming';
    mainSourcesOfStress?: string;
    majorTraumaLast2Years: boolean;
    traumaExplanation?: string;
    emotionalSymptoms: string[];
    mentalConditionDiagnosed: boolean;
    mentalHealthMedsOrTherapy?: string;
    stressManagementMethods?: string;
    emotionalWellbeingRating: number; // 0 - 10
  };

  // 7. Digestive & Gut Health
  gut: {
    bowelFrequency: string;
    stoolType: 'normal' | 'hard' | 'loose' | 'watery' | 'alternating';
    symptoms: string[];
    symptomFrequency: string;
    appetite: 'very_low' | 'low' | 'normal' | 'high' | 'uncontrolled';
    diagnosedConditions: string[];
    antibioticUseLast6Months: boolean;
    regularAcidityMedicines: boolean;
    probioticsOrEnzymes: boolean;
    triggerFoods?: string;
  };

  // 8. Lab Test Reports
  labReports: {
    hasRecentTests: boolean;
    uploadedFileNames: string[];
    reportNotes?: string;
  };

  // 9. Previous Treatments Tried
  previousTreatments: {
    treatmentsTried: string[];
    whatImproved?: string;
    whatDidNotImprove?: string;
    whyStopped?: string;
    improvementRemained: 'yes' | 'no' | 'partially' | 'not_applicable';
  };

  // 10. Diet & Eating Pattern
  diet: {
    dietType: string;
    regionalPreference?: string;
    mealsPerDay: number;
    firstMealTime: string;
    lastMealTime: string;
    lateNightEating: boolean;
    breakfast: string;
    lunch: string;
    dinner: string;
    snacks?: string;
    teaCoffeeCount: string;
    addsSugarOrHoney: boolean;
    friedFoodFrequency: string;
    sweetsFrequency: string;
    packagedFoodFrequency: string;
    outsideFoodFrequency: string;
    waterIntakeLiters: string;
    foodDislikesOrRestrictions?: string;
    cravedFoods?: string;
    alcoholTobaccoUse?: string;
    previousDietHistory?: string;
    eatingDisorderHistory: boolean;
  };

  // 11. Lifestyle & Physical Activity
  lifestyle: {
    regularExercise: boolean;
    exerciseType?: string;
    frequencyDaysPerWeek?: number;
    durationMinutes?: number;
    timing?: string;
    noExerciseReason?: string;
    sittingHoursPerDay: number;
    screenTimeHoursPerDay: number;
    nonExerciseMovement?: string;
    physicalLimitationsOrInjuries?: string;
  };

  // 12. Family Health History
  familyHistory: {
    diabetes?: string;
    hypertension?: string;
    heartDisease?: string;
    thyroid?: string;
    pcosHormonal?: string;
    cholesterol?: string;
    obesity?: string;
    autoimmune?: string;
    cancer?: string;
    kidneyDisease?: string;
    liverDisease?: string;
    mentalHealth?: string;
    otherConditions?: string;
  };

  // 13. Hormonal Health for Women
  hormonalWomen?: {
    menstrualStatus?: string;
    cycleLengthDays?: string;
    periodDurationDays?: string;
    flow?: string;
    irregularityPattern?: string;
    lastMenstrualPeriodDate?: string;
    agePeriodsStarted?: string;
    menstrualCramps?: string;
    pmsSymptoms?: string[];
    pcodPcosDiagnosis?: string;
    thyroidDiagnosisAndMeds?: string;
    currentlyPregnant?: boolean;
    planningPregnancy?: boolean;
    currentlyBreastfeeding?: boolean;
    pregnanciesAndChildren?: string;
    miscarriagesOrComplications?: string;
    gestationalDiabetesHistory?: boolean;
    menopauseSymptoms?: string[];
    hrtType?: string;
    breastLumps?: boolean;
    diagnosedHormonalConditions?: string[];
    facialBodyHair?: string;
    scalpHairLossSeverity?: string;
    skinIssues?: string[];
  };

  // 14. Hormonal Health for Men
  hormonalMen?: {
    energyLevel?: string;
    libido?: string;
    erectileDifficulty?: string;
    morningErectionsRegular?: boolean;
    muscleMassTrend?: string;
    facialBodyHairGrowth?: string;
    gynecomastia?: string;
    moodChanges?: string;
    diagnosedLowTestosterone?: string;
    prostateIssues?: string;
  };

  // 15. Organ Health & Complication Symptoms
  organHealth: {
    diabetesComplications: string[];
    cardiovascularSymptoms: string[];
    liverSymptoms: string[];
    kidneySymptoms: string[];
    thyroidSymptoms: string[];
    jointBoneSymptoms: string[];
    neurologicalSymptoms: string[];
    skinSymptoms: string[];
    respiratorySymptoms: string[];
    unusualSymptomsNotes?: string;
  };

  // 16. Readiness & Commitment
  readiness: {
    mainBarriers?: string;
    helpfulFactors: string[];
    healthPriorityWillingness: string;
    hoursPerWeekCommitment: string;
    motivatedForRootCause: boolean;
    canCommit90Days: boolean;
    familySupport: boolean;
  };

  // 17. Start Timeline
  startTimeline: 'within_3_days' | 'this_week' | 'later_or_not_urgent';

  // 18. Reversal Intensity
  reversalIntensity: 'foundation' | 'advanced' | 'intensive' | 'physician_decide' | 'other';
  reversalIntensityCustomNote?: string;

  // 19. Daily Routine and Timings
  dailyRoutine: {
    wakeUpTime: string;
    morningRoutine?: string;
    breakfastTime: string;
    midMorningSnackTime?: string;
    lunchTime: string;
    eveningSnackTeaTime?: string;
    dinnerTime: string;
    sleepTime: string;
    workHours?: string;
    dailySittingHoursAtWork?: string;
    commuteTimeAndMode?: string;
    availableTimeForExercise?: string;
    mealPrepManager?: string;
    weekendScheduleDifference?: string;
  };

  // 20. Exercise Preferences & Realistic Activity Plan
  exercisePlan: {
    preferredExerciseTypes: string[];
    gymOrEquipmentAccess?: string;
    bestTimeSlot?: 'morning' | 'evening' | 'flexible';
    limitationsExplanation?: string;
  };

  // 21. Personal Query / Personalisation Request
  personalQueryRequest?: string;

  // 22. Additional Information
  additionalInfo: {
    pastSurgeriesOrIllnesses?: string;
    ongoingSpecialistTreatments?: string;
    geneticOrRareConditions?: string;
    occupationChallenges?: string;
    livingSituation?: string;
    whoManagesMeals?: string;
    treatmentRequirements?: string;
    questionsForDoctor?: string;
    patientExtraNotes?: string;
  };

  submittedAt: string;
}

export interface UserHealthProfile {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  gender: GenderType;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  goal: GoalType;
  activityLevel: ActivityLevel;
  pace: GoalPace;
  obstacles: string[];
  dietaryPreference: string;
  medicalConditions: string[];
  reportAnalysis?: MedicalReportAnalysis;
  calculatedPlan: CalculatedPlan;
  prescriptions?: Prescription[];
  preferences?: UserPreferences;
  assessmentData?: RootCauseAssessmentData;
  /** Extended onboarding deep-dive answers (medicines, allergies, sleep, stress, gut, family history, etc.) */
  healthDeepDive?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Biomarker {
  name: string;
  value: string;
  status: 'normal' | 'low' | 'high' | 'critical';
  referenceRange: string;
  impactOnDiet: string;
}

export interface MedicalReportAnalysis {
  id?: string;
  userId?: string;
  userName?: string;
  reportName: string;
  uploadedAt: string;
  imageUrl?: string;
  documentUrl?: string;
  reportText?: string;
  fileType?: string;
  fileSize?: string;
  notes?: string;
  summary: string;
  biomarkers: Biomarker[];
  identifiedRisks: string[];
  dietaryRecommendations: string[];
  macroAdjustments: {
    proteinMultiplier?: number;
    carbAdjustment?: string;
    fatAdjustment?: string;
    keyNutrientsToBoost: string[];
    foodsToAvoid: string[];
  };
  adminReviewed?: boolean;
  adminNotes?: string;
  doctorNotes?: string;
}

export interface CalculatedPlan {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  waterLiters: number;
  targetDate: string;
  weeklyChangeKg: number;
  healthScore: number;
  calorieDeficitOrSurplus: number;
  bmi?: number;
}

export interface MealItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  servingSize?: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: string;
  imageUrl?: string;
  confidence?: number;
  aiSuggested?: boolean;
  completed?: boolean;
}

export interface BurnActivity {
  id: string;
  name: string;
  caloriesBurned: number;
  durationMinutes: number;
  timestamp: string;
  type: 'walk' | 'run' | 'gym' | 'cycling' | 'yoga' | 'sports' | 'custom';
  aiSuggested?: boolean;
  completed?: boolean;
}

export interface MedicationLogItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timing: 'morning' | 'afternoon' | 'evening' | 'night';
  taken: boolean;
  takenAt?: string;
  prescribedBy?: string;
  notes?: string;
  aiSuggested?: boolean;
}

export interface DailyLog {
  date: string;
  meals: MealItem[];
  waterMl: number;
  burnedActivities: BurnActivity[];
  medications: MedicationLogItem[];
  notes?: string;
}

export interface FeedbackSubmission {
  id: string;
  userId: string;
  userName: string;
  dayCycleNumber: number; // e.g. Day 3 or Day 6
  energyRating: number; // 1 to 5
  digestionRating: number; // 1 to 5
  adherencePercentage: number; // e.g. 85
  satietyLevel: 'low' | 'optimal' | 'excessive';
  improvementSuggestions: string;
  createdAt: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  authProvider: 'email' | 'google';
  supabaseSynced: boolean;
  role?: 'user' | 'admin';
  isPro?: boolean;
  proPlanType?: 'monthly' | 'yearly';
  proExpiry?: string;
  hasPurchasedProducts?: boolean;
  lastSyncedAt?: string;
}

// Product & Store Types
export interface Product {
  id: string;
  name: string;
  category: 'protein' | 'vitamins' | 'superfoods' | 'accessories' | 'snacks';
  price: number;
  discountPrice: number;
  rating: number;
  reviewsCount: number;
  image: string;
  description: string;
  benefits: string[];
  nutritionInfo?: {
    servingSize: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  inStock: boolean;
  featured?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'qr_upi' | 'razorpay' | 'autopay' | 'trial_checkout' | 'card_netbanking';
  paymentStatus: 'paid' | 'pending' | 'verified';
  orderStatus: 'confirmed' | 'processing' | 'shipped' | 'delivered';
  transactionId?: string;
  receiptImageUrl?: string;
  receiptUploadedAt?: string;
  createdAt: string;
  estimatedDelivery: string;
}

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  userId: string;
  userName: string;
  reportId?: string;
  doctorName: string;
  doctorPhone?: string;
  date: string;
  diagnosis: string;
  medicines: PrescriptionMedicine[];
  recommendedSupplements: string[];
  dietaryAdjustments: string[];
  notes: string;
}

export interface DoctorContact {
  name: string;
  qualification: string;
  specialization: string;
  registrationNumber: string;
  phone: string;
  directDialNumber: string;
  availability: string;
  hospitalAffiliation: string;
}

export interface AdminStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  totalBuyers: number;
  nonBuyers: number;
  totalReviews: number;
  totalRevenue: number;
  totalOrders: number;
  pendingReportsCount: number;
}

export interface UserReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  productId?: string;
  productName?: string;
  verified: boolean;
}

export interface DayRecommendation {
  date: string;
  dayLabel: 'today';
  formattedDate: string;
  targetCalories: number;
  whatToEat: { title: string; desc: string }[];
  whatToAvoid: { title: string; desc: string }[];
  healthRisks: { risk: string; severity: 'low' | 'medium' | 'high'; note: string }[];
  preventions: { action: string; tip: string; timing: string }[];
}

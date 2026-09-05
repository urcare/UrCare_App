import { GenderType, GoalType } from '../types';

export type Language = 'en' | 'hi';

export interface TranslationDictionary {
  appName: string;
  appSubtitle: string;
  next: string;
  back: string;
  continue: string;
  skip: string;
  getStarted: string;
  languageSelect: string;

  // Onboarding Hero
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroSubtitle: string;
  heroStartBtn: string;
  heroStat: string;
  stepOf: string;
  of: string;

  // Onboarding screens
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeFeature1Title: string;
  welcomeFeature1Desc: string;
  welcomeFeature2Title: string;
  welcomeFeature2Desc: string;
  welcomeFeature3Title: string;
  welcomeFeature3Desc: string;

  genderTitle: string;
  genderSubtitle: string;
  genderMale: string;
  genderFemale: string;
  genderOther: string;
  genders: Record<GenderType, { title: string; desc: string }>;

  workoutTitle: string;
  workoutSubtitle: string;
  workouts: Array<{ id: string; title: string; desc: string }>;
  workoutsTitle: string;
  workoutsSubtitle: string;
  workoutOptions: Array<{ id: string; title: string; desc: string }>;

  heardTitle: string;
  heardSubtitle: string;
  heardOptions: Array<{ id: string; title: string }>;

  triedAppsTitle: string;
  triedAppsSubtitle: string;

  trajectoryTitle: string;
  trajectorySubtitle: string;

  hwTitle: string;
  hwSubtitle: string;
  height: string;
  weight: string;
  bmiLabel: string;

  birthTitle: string;
  birthSubtitle: string;

  trainerTitle: string;
  trainerSubtitle: string;

  goalTitle: string;
  goalSubtitle: string;
  goals: {
    lose_weight: { title: string; desc: string };
    build_muscle: { title: string; desc: string };
    maintain_tone: { title: string; desc: string };
    improve_health: { title: string; desc: string };
    reverse_condition: { title: string; desc: string };
  };

  dietTitle: string;
  dietSubtitle: string;
  diets: Array<{ id: string; title: string; desc: string }>;
  dietOptions: Array<{ id: string; title: string; desc: string }>;

  accomplishTitle: string;
  accomplishSubtitle: string;
  accomplishOptions: Array<{ id: string; title: string; desc: string }>;

  potentialTitle: string;
  potentialSubtitle: string;

  speedTitle: string;
  speedSubtitle: string;

  habitsTitle: string;
  habitsSubtitle: string;
  habitsOptions: Array<{ id: string; title: string; desc: string }>;

  medicalTitle: string;
  medicalSubtitle: string;
  medicalOptions: Array<{ id: string; title: string; desc: string }>;

  prefTitle: string;
  prefSubtitle: string;
  prefsTitle: string;
  prefsSubtitle: string;
  notifLabel: string;
  burnsLabel: string;
  burnsDesc: string;
  colorBurnsLabel: string;
  colorBurnsDesc: string;
  rolloverLabel: string;
  rolloverDesc: string;

  socialTitle: string;
  ratingText: string;

  thankYouTitle: string;
  thankYouSubtitle: string;
  referralLabel: string;

  commitTitle: string;
  commitSubtitle: string;
  commitHoldBtn: string;
  committedSuccess: string;

  calculatingTitle: string;
  calculatingSettingUp: string;
  calculatingDone: string;

  planReadyTitle: string;
  trial3Title: string;
  trialSubtitle: string;
  autoPayNote: string;
  continueFreeBtn: string;

  // Report Uploader
  optionalBadge: string;
  reportStepTitle: string;
  reportStepSubtitle: string;
  trySampleTitle: string;
  sampleLipid: string;
  sampleSugar: string;
  uploadBoxTitle: string;
  uploadBoxSubtitle: string;
  skipReportBtn: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    appName: 'UrCare',
    appSubtitle: 'Clinical Nutrition & Metabolic Protocol',
    next: 'Continue',
    back: 'Back',
    continue: 'Continue',
    skip: 'Skip for now',
    getStarted: 'Begin Assessment',
    languageSelect: 'Select Language',

    heroBadge: 'Clinical Metabolic System',
    heroTitle1: 'Calorie Tracking',
    heroTitle2: 'Simplified with Care',
    heroSubtitle: 'Personalized calories, macros, and biomarker tracking designed for sustainable metabolic results.',
    heroStartBtn: 'Start Free Assessment →',
    heroStat: 'Takes under 2 minutes • 100% Free',
    stepOf: 'Step',
    of: 'of',

    welcomeTitle: 'Precision Metabolic Health & Clinical Nutrition',
    welcomeSubtitle: 'Scientific caloric calibration, biomarker correlation, and clinical nutritionist guidance.',
    welcomeFeature1Title: 'Clinical Dietary Calibration',
    welcomeFeature1Desc: 'Evidence-based caloric and macronutrient targets calibrated to your metabolic rate.',
    welcomeFeature2Title: 'Biomarker & Lab Correlation',
    welcomeFeature2Desc: 'Integrate blood lipid panels and vitamin levels to refine nutritional strategy.',
    welcomeFeature3Title: 'Board-Certified Care Access',
    welcomeFeature3Desc: 'Consult qualified clinical dietitians and physicians for custom medical protocols.',

    genderTitle: 'Select Biological Sex',
    genderSubtitle: 'Biological sex determines basal metabolic rate (BMR) and hormonal thermogenesis.',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Non-Binary / Other',
    genders: {
      male: {
        title: 'Male',
        desc: 'Biological sex determines basal metabolic rate (BMR) and hormonal thermogenesis.',
      },
      female: {
        title: 'Female',
        desc: 'Calibrated for female metabolic pace, body composition, and endocrine requirements.',
      },
      other: {
        title: 'Non-Binary / Other',
        desc: 'Standardized balanced metabolic baseline calculation.',
      },
    },

    workoutTitle: 'Weekly Physical Activity Level',
    workoutSubtitle: 'Physical activity alters total daily energy expenditure (TDEE).',
    workouts: [
      { id: '0-2', title: '0 - 2 Workouts / Week', desc: 'Mostly sedentary or light recreational movement' },
      { id: '3-5', title: '3 - 5 Workouts / Week', desc: 'Moderate physical training or regular gym sessions' },
      { id: '6+', title: '6+ Workouts / Week', desc: 'Intense athletic training or physical occupation' },
    ],
    workoutsTitle: 'Weekly Physical Activity Level',
    workoutsSubtitle: 'Physical activity alters total daily energy expenditure (TDEE).',
    workoutOptions: [
      { id: 'sedentary', title: 'Sedentary (Desk Job)', desc: 'Minimal daily physical exertion or structured exercise' },
      { id: 'light', title: 'Light Activity (1-2 days/week)', desc: 'Occasional recreational walks, yoga, or light cardio' },
      { id: 'moderate', title: 'Moderate Training (3-4 days/week)', desc: 'Regular resistance training, running, or functional gym sessions' },
      { id: 'active', title: 'High Volume Athletic Training (5-7 days/week)', desc: 'Intensive endurance, weightlifting, or sports conditioning' },
    ],

    heardTitle: 'How did you discover UrCare?',
    heardSubtitle: 'Help us understand how you found our metabolic platform.',
    heardOptions: [
      { id: 'instagram', title: 'Instagram / Social Media' },
      { id: 'youtube', title: 'YouTube' },
      { id: 'friend', title: 'Friend or Family Member' },
      { id: 'doctor', title: 'Physician / Nutritionist' },
      { id: 'search', title: 'Google / Web Search' },
      { id: 'appstore', title: 'App Store / Play Store' },
    ],

    triedAppsTitle: 'Have you tracked nutrition previously?',
    triedAppsSubtitle: 'We streamline metabolic tracking with clinical clarity and automated logging.',

    trajectoryTitle: 'Evidence-Based Trajectory & Compliance',
    trajectorySubtitle: 'Users maintaining consistent tracking reach target biometric markers 3.4x faster.',

    hwTitle: 'Biometric Measurements',
    hwSubtitle: 'Enter your accurate height and body mass for basal metabolic calculations.',
    height: 'Height',
    weight: 'Current Body Mass',
    bmiLabel: 'Current Body Mass Index (BMI)',

    birthTitle: 'Date of Birth',
    birthSubtitle: 'Age is a critical determinant in endocrine metabolism and resting energy expenditure.',

    trainerTitle: 'Are you working with a healthcare practitioner?',
    trainerSubtitle: 'We can synchronize protocols with your existing dietitian, trainer, or physician.',

    goalTitle: 'Primary Health Objective',
    goalSubtitle: 'Select your primary metabolic or body composition target.',
    goals: {
      lose_weight: { title: 'Fat Loss & Weight Reduction', desc: 'Caloric deficit preserving lean mass and metabolic rate' },
      build_muscle: { title: 'Hypertrophy & Lean Mass Gain', desc: 'Optimized high-protein surplus with progressive resistance' },
      maintain_tone: { title: 'Metabolic Maintenance & Recomposition', desc: 'Isocaloric intake for sustained energy and body toning' },
      improve_health: { title: 'Cardiometabolic & Longevity Optimization', desc: 'Micronutrient density, glycemic balance, and vitality' },
      reverse_condition: { title: 'Clinical Management & Glycemic Control', desc: 'Targeted protocols for HbA1c, lipid panel, and blood pressure' },
    },

    dietTitle: 'Dietary Preference & Lifestyle',
    dietSubtitle: 'Our engine formulates meal splits based on your preferred dietary pattern.',
    diets: [
      { id: 'Vegetarian', title: 'Vegetarian', desc: 'Lacto-ovo vegetarian with lentils, paneer, and whole grains' },
      { id: 'Vegan', title: 'Vegan / Plant-Based', desc: 'Strictly plant-derived nutrition with micronutrient fortification' },
      { id: 'Non-Veg / Balanced', title: 'Omnivore / Balanced Non-Vegetarian', desc: 'Lean poultry, fish, eggs, dairy, and wholesome grains' },
      { id: 'Keto', title: 'Ketogenic / Low-Carb High-Fat', desc: 'Carbohydrate restriction with healthy lipid sources' },
      { id: 'Intermittent Fasting', title: 'Time-Restricted Feeding (16:8)', desc: 'Optimized feeding window with metabolic fasting periods' },
      { id: 'Jain', title: 'Jain Vegetarian', desc: 'Pure vegetarian diet excluding underground root vegetables' },
      { id: 'Diabetic Friendly', title: 'Low Glycemic Index (Diabetic)', desc: 'Complex carbohydrates designed for steady blood sugar' },
      { id: 'Other', title: 'Custom / Flexible', desc: 'Customizable nutrient split according to preference' },
    ],
    dietOptions: [
      { id: 'Vegetarian', title: 'Vegetarian', desc: 'Lacto-ovo vegetarian with lentils, paneer, and whole grains' },
      { id: 'Vegan', title: 'Vegan / Plant-Based', desc: 'Strictly plant-derived nutrition with micronutrient fortification' },
      { id: 'Non-Veg / Balanced', title: 'Omnivore / Balanced Non-Vegetarian', desc: 'Lean poultry, fish, eggs, dairy, and wholesome grains' },
      { id: 'Keto', title: 'Ketogenic / Low-Carb High-Fat', desc: 'Carbohydrate restriction with healthy lipid sources' },
      { id: 'Intermittent Fasting', title: 'Time-Restricted Feeding (16:8)', desc: 'Optimized feeding window with metabolic fasting periods' },
      { id: 'Jain', title: 'Jain Vegetarian', desc: 'Pure vegetarian diet excluding underground root vegetables' },
      { id: 'Diabetic Friendly', title: 'Low Glycemic Index (Diabetic)', desc: 'Complex carbohydrates designed for steady blood sugar' },
      { id: 'Other', title: 'Custom / Flexible', desc: 'Customizable nutrient split according to preference' },
    ],

    accomplishTitle: 'Target Clinical Outcomes',
    accomplishSubtitle: 'Select the primary physiological improvements you want to achieve.',
    accomplishOptions: [
      { id: 'energy', title: 'Sustained Cellular Energy', desc: 'Eliminate postprandial fatigue and afternoon energy crashes' },
      { id: 'belly', title: 'Visceral Fat Reduction', desc: 'Target abdominal adipose tissue and reduce waist circumference' },
      { id: 'strength', title: 'Musculoskeletal Strength', desc: 'Improve bone density, core power, and functional stamina' },
      { id: 'sleep', title: 'Sleep Quality & Recovery', desc: 'Optimize circadian rhythm and nocturnal muscular repair' },
      { id: 'gut', title: 'Gastrointestinal & Microbiome Health', desc: 'Support digestion, nutrient assimilation, and gut flora' },
      { id: 'immunity', title: 'Immune & Cellular Resilience', desc: 'Fortify systemic defense and lower chronic inflammation' },
    ],

    potentialTitle: 'You Have High Metabolic Transformation Potential',
    potentialSubtitle: 'Based on your age, body composition, and goals, your physiological response pace is in the top 15th percentile.',

    speedTitle: 'Pace of Target Progress',
    speedSubtitle: 'Select a sustainable rate of caloric modification.',

    habitsTitle: 'Nutritional Habits & Behavioral Tendencies',
    habitsSubtitle: 'Identifying daily patterns enables us to create sustainable adherence.',
    habitsOptions: [
      { id: 'late_night', title: 'Late Night Snacking', desc: 'Tendency to consume calories post dinner' },
      { id: 'stress_eating', title: 'Stress & Emotional Eating', desc: 'Reaching for high-glycemic foods during work pressure' },
      { id: 'skip_breakfast', title: 'Frequent Breakfast Skipping', desc: 'Extended morning fasts leading to evening overconsumption' },
      { id: 'low_water', title: 'Suboptimal Hydration', desc: 'Drinking less than 2 liters of fluid daily' },
      { id: 'sweet_cravings', title: 'Sugar & Refined Carb Cravings', desc: 'Desire for sweets after major meals' },
      { id: 'none', title: 'Consistent Structured Meals', desc: 'Regular meal timings without unplanned snacking' },
    ],

    medicalTitle: 'Medical Diagnoses & Metabolic History',
    medicalSubtitle: 'Crucial for clinical safety and macronutrient ratio adjustment.',
    medicalOptions: [
      { id: 'none', title: 'No Known Clinical Conditions', desc: 'Healthy metabolic baseline with no active prescription' },
      { id: 'diabetes', title: 'Type 2 Diabetes / Prediabetes', desc: 'Elevated fasting glucose or HbA1c requiring carbohydrate control' },
      { id: 'hypertension', title: 'Hypertension (High Blood Pressure)', desc: 'Requires sodium modulation and potassium optimization' },
      { id: 'thyroid', title: 'Thyroid Dysfunction (Hypo / Hyper)', desc: 'Altered basal metabolic rate requiring trace mineral support' },
      { id: 'pcos', title: 'PCOS / PCOD (Hormonal Balance)', desc: 'Insulin resistance and androgenic management protocols' },
      { id: 'fatty_liver', title: 'Non-Alcoholic Fatty Liver (NAFLD)', desc: 'Requires liver detoxification and fructose restriction' },
      { id: 'high_cholesterol', title: 'Dyslipidemia / High Cholesterol', desc: 'Modulation of saturated fats and soluble fiber enrichment' },
    ],

    prefTitle: 'Tracker Configuration',
    prefSubtitle: 'Customize how your daily caloric budget is computed.',
    prefsTitle: 'Notification & Calorie Preferences',
    prefsSubtitle: 'Customize your daily reminders and calorie calculation logic.',
    notifLabel: 'Daily Reminders & Notifications',
    burnsLabel: 'Credit Active Exercise Burn to Calorie Budget',
    burnsDesc: 'Automatically adds workout energy expenditure to your total daily allowance.',
    colorBurnsLabel: 'Credit Active Exercise Burn to Calorie Budget',
    colorBurnsDesc: 'Automatically adds workout energy expenditure to your total daily allowance.',
    rolloverLabel: 'Calorie Rollover',
    rolloverDesc: 'Roll unused daily calories into consecutive days for flexible intake.',

    socialTitle: 'Trusted by over 100,000 Verified Members',
    ratingText: '4.9 Clinical Rating based on published patient outcomes',

    thankYouTitle: 'Assessment Successfully Completed',
    thankYouSubtitle: 'Your personalized metabolic blueprint has been formulated.',
    referralLabel: 'Physician / Partner Referral Code (Optional)',

    commitTitle: 'Clinical Commitment & Protocol Adherence',
    commitSubtitle: 'Consistency is the cornerstone of metabolic transformation. Confirm your commitment.',
    commitHoldBtn: 'Press and Hold to Confirm Protocol',
    committedSuccess: 'Commitment Verified. Generating your clinical blueprint...',

    calculatingTitle: 'Formulating Metabolic Protocol',
    calculatingSettingUp: 'Calibrating basal metabolic rate, macro partitions, and micronutrient ratios...',
    calculatingDone: 'Protocol Generated Successfully.',

    planReadyTitle: 'Your Clinical Nutrition Plan is Ready',
    trial3Title: 'Start 3-Day Complimentary Trial',
    trialSubtitle: 'Full access to AI Dietary Scanner, Multi-Day Macro Planner, and Clinical Nutritionist Consultations.',
    autoPayNote: 'Secure authorization. Cancel anytime with 1-click. Zero charges today.',
    continueFreeBtn: 'Continue with Standard Access',

    // Report Uploader
    optionalBadge: 'Clinical Integration (Optional)',
    reportStepTitle: 'Upload Medical / Blood Lab Report',
    reportStepSubtitle: 'Sync your lipid panel, HbA1c, Vitamin D3/B12, or Thyroid test to calibrate personalized clinical targets.',
    trySampleTitle: 'Or Test with Sample Clinical Reports:',
    sampleLipid: 'Sample High Lipid Panel (Cholesterol 245 mg/dL)',
    sampleSugar: 'Sample Diabetic HbA1c Report (7.8%)',
    uploadBoxTitle: 'Upload Blood Test PDF / Image',
    uploadBoxSubtitle: 'Tap to select or drag & drop (JPG, PNG, PDF up to 10MB)',
    skipReportBtn: 'Skip & Continue Assessment →',
  },
  hi: {
    appName: 'UrCare',
    appSubtitle: 'क्लीनिकल पोषण एवं मेटाबोलिक प्रोटोकॉल',
    next: 'आगे बढ़ें',
    back: 'पीछे',
    continue: 'जारी रखें',
    skip: 'छोड़ें',
    getStarted: 'मूल्यांकन शुरू करें',
    languageSelect: 'भाषा चुनें',

    heroBadge: 'क्लीनिकल मेटाबोलिक सिस्टम',
    heroTitle1: 'कैलोरी ट्रैकिंग',
    heroTitle2: 'सरल एवं सटीक',
    heroSubtitle: 'व्यक्तिगत कैलोरी, मैक्रोज़ और लैब रिपोर्ट आधारित पोषण योजना।',
    heroStartBtn: 'निःशुल्क मूल्यांकन शुरू करें →',
    heroStat: 'सिर्फ 2 मिनट • 100% निःशुल्क',
    stepOf: 'चरण',
    of: 'का',

    welcomeTitle: 'सटीक मेटाबोलिक स्वास्थ्य एवं क्लीनिकल पोषण',
    welcomeSubtitle: 'वैज्ञानिक कैलोरी संतुलन, बायोमार्कर मिलान और योग्य आहार विशेषज्ञों का मार्गदर्शन।',
    welcomeFeature1Title: 'क्लीनिकल आहार योजना',
    welcomeFeature1Desc: 'आपकी मेटाबोलिक दर के अनुसार सटीक कैलोरी और प्रोटीन लक्ष्य।',
    welcomeFeature2Title: 'लैब रिपोर्ट एवं बायोमार्कर मिलान',
    welcomeFeature2Desc: 'ब्लड टेस्ट और विटामिन स्तर के आधार पर विशेष पोषण सुझाव।',
    welcomeFeature3Title: 'विशेषज्ञ डॉक्टर परामर्श',
    welcomeFeature3Desc: 'कस्टम स्वास्थ्य योजनाओं के लिए प्रमाणित न्यूट्रिशनिस्ट और डॉक्टरों से जुड़ें।',

    genderTitle: 'जैविक लिंग का चयन करें',
    genderSubtitle: 'सटीक बेसल मेटाबोलिक दर (BMR) की गणना के लिए आवश्यक।',
    genderMale: 'पुरुष',
    genderFemale: 'महिला',
    genderOther: 'अन्य',
    genders: {
      male: {
        title: 'पुरुष (Male)',
        desc: 'पुरुषों की मेटाबोलिक दर (BMR) और कैलोरी खपत के अनुसार सटीक गणना।',
      },
      female: {
        title: 'महिला (Female)',
        desc: 'महिलाओं के मेटाबोलिक संतुलन और पोषण आवश्यकताओं के अनुकूल।',
      },
      other: {
        title: 'अन्य (Other)',
        desc: 'संतुलित मेटाबोलिक आधार रेखा के अनुसार गणना।',
      },
    },

    workoutTitle: 'साप्ताहिक शारीरिक गतिविधि',
    workoutSubtitle: 'दैनिक गतिविधि से कुल ऊर्जा व्यय (TDEE) निर्धारित होता है।',
    workouts: [
      { id: '0-2', title: 'हफ्ते में 0 - 2 दिन', desc: 'कम गतिविधि या कभी-कभार हल्की सैर' },
      { id: '3-5', title: 'हफ्ते में 3 - 5 दिन', desc: 'नियमित जिम, रनिंग या मध्यम व्यायाम' },
      { id: '6+', title: 'हफ्ते में 6+ दिन', desc: 'सक्रिय एथलेटिक वर्कआउट या भारी मेहनत' },
    ],
    workoutsTitle: 'साप्ताहिक शारीरिक गतिविधि',
    workoutsSubtitle: 'दैनिक गतिविधि से कुल ऊर्जा व्यय (TDEE) निर्धारित होता है।',
    workoutOptions: [
      { id: 'sedentary', title: 'डेस्क जॉब / कम गतिविधि', desc: 'दिन भर बैठे रहना या न्यूनतम व्यायाम' },
      { id: 'light', title: 'हल्की गतिविधि (हफ्ते में 1-2 दिन)', desc: 'हल्की सैर या योग सत्र' },
      { id: 'moderate', title: 'मध्यम व्यायाम (हफ्ते में 3-4 दिन)', desc: 'नियमित जिम, रनिंग या स्ट्रेंथ ट्रेनिंग' },
      { id: 'active', title: 'सक्रिय एथलेटिक ट्रेनिंग (5-7 दिन)', desc: 'गहन वर्कआउट अथवा भारी शारीरिक श्रम' },
    ],

    heardTitle: 'आपने UrCare के बारे में कहाँ सुना?',
    heardSubtitle: 'हमें बताएं कि आप हमारे प्लेटफॉर्म तक कैसे पहुंचे।',
    heardOptions: [
      { id: 'instagram', title: 'इंस्टाग्राम / सोशल मीडिया' },
      { id: 'youtube', title: 'यूट्यूब' },
      { id: 'friend', title: 'मित्र अथवा परिवार' },
      { id: 'doctor', title: 'डॉक्टर अथवा आहार विशेषज्ञ' },
      { id: 'search', title: 'गूगल / वेब सर्च' },
      { id: 'appstore', title: 'ऐप स्टोर / प्ले स्टोर' },
    ],

    triedAppsTitle: 'क्या आपने पहले कभी कैलोरी ट्रैकिंग ऐप का उपयोग किया है?',
    triedAppsSubtitle: 'हम क्लीनिकल स्पष्टता के साथ दैनिक ट्रैकिंग को बेहद आसान बनाते हैं।',

    trajectoryTitle: 'प्रमाणित परिणाम एवं निरंतरता',
    trajectorySubtitle: 'लगातार ट्रैकिंग करने वाले सदस्य 3.4 गुना तेज़ी से अपने स्वास्थ्य लक्ष्य प्राप्त करते हैं।',

    hwTitle: 'शारीरिक माप दर्ज करें',
    hwSubtitle: 'सटीक गणना के लिए अपनी सही ऊंचाई और वजन दर्ज करें।',
    height: 'ऊंचाई',
    weight: 'वर्तमान वजन',
    bmiLabel: 'बॉडी मास इंडेक्स (BMI)',

    birthTitle: 'जन्मतिथि',
    birthSubtitle: 'आयु ऊर्जा खपत और मेटाबोलिज्म का एक महत्वपूर्ण कारक है।',

    trainerTitle: 'क्या आप किसी ट्रेनर या डॉक्टर से परामर्श ले रहे हैं?',
    trainerSubtitle: 'हम आपके वर्तमान मार्गदर्शन के साथ इस प्लान को जोड़ सकते हैं।',

    goalTitle: 'मुख्य स्वास्थ्य लक्ष्य',
    goalSubtitle: 'अपना प्राथमिक स्वास्थ्य अथवा वजन लक्ष्य चुनें।',
    goals: {
      lose_weight: { title: 'फैट बर्न एवं वजन घटाना', desc: 'मांसपेशियों को सुरक्षित रखते हुए स्वस्थ कैलोरी डेफिसिट' },
      build_muscle: { title: 'लीन मसल्स एवं ताकत बढ़ाना', desc: 'उच्च प्रोटीन के साथ मांसपेशियों का विकास' },
      maintain_tone: { title: 'वजन बनाए रखना एवं फिटनेस', desc: 'समान कैलोरी के साथ शरीर को टोंड और फिट रखना' },
      improve_health: { title: 'स्वास्थ्य एवं दीर्घायु अनुकूलन', desc: 'माइक्रोन्यूट्रिएंट्स और ऊर्जा स्तर में निरंतर सुधार' },
      reverse_condition: { title: 'डायबिटीज व थायरॉइड नियंत्रण', desc: 'रक्त शर्करा और लिपिड प्रोफाइल सुधार हेतु विशेष डाइट' },
    },

    dietTitle: 'आहार प्राथमिकता',
    dietSubtitle: 'आपकी पसंद के अनुसार सटीक मील प्लान तैयार किया जाएगा।',
    diets: [
      { id: 'Vegetarian', title: 'शाकाहारी (Vegetarian)', desc: 'दाल, पनीर, दूध, अनाज और मौसमी सब्जियां' },
      { id: 'Vegan', title: 'वीगन (Vegan)', desc: '100% वनस्पति आधारित आहार' },
      { id: 'Non-Veg / Balanced', title: 'संतुलित / मांसाहारी', desc: 'चिकन, अंडे, मछली, दाल और संतुलित अनाज' },
      { id: 'Keto', title: 'कीटो / लो-कार्ब', desc: 'कम कार्बोहाइड्रेट और स्वस्थ वसा' },
      { id: 'Intermittent Fasting', title: 'इंटरमिटेंट फास्टिंग (16:8)', desc: 'निश्चित समय सीमा में भोजन' },
      { id: 'Jain', title: 'जैन शाकाहारी', desc: 'कंदमूल रहित शुद्ध शाकाहारी भोजन' },
      { id: 'Diabetic Friendly', title: 'डायबिटिक फ्रेंडली', desc: 'कम ग्लाइसेमिक इंडेक्स वाला पौष्टिक भोजन' },
      { id: 'Other', title: 'कस्टम डाइट', desc: 'अपनी आवश्यकतानुसार अनुकूलित आहार' },
    ],
    dietOptions: [
      { id: 'Vegetarian', title: 'शाकाहारी (Vegetarian)', desc: 'दाल, पनीर, दूध, अनाज और मौसमी सब्जियां' },
      { id: 'Vegan', title: 'वीगन (Vegan)', desc: '100% वनस्पति आधारित आहार' },
      { id: 'Non-Veg / Balanced', title: 'संतुलित / मांसाहारी', desc: 'चिकन, अंडे, मछली, दाल और संतुलित अनाज' },
      { id: 'Keto', title: 'कीटो / लो-कार्ब', desc: 'कम कार्बोहाइड्रेट और स्वस्थ वसा' },
      { id: 'Intermittent Fasting', title: 'इंटरमिटेंट फास्टिंग (16:8)', desc: 'निश्चित समय सीमा में भोजन' },
      { id: 'Jain', title: 'जैन शाकाहारी', desc: 'कंदमूल रहित शुद्ध शाकाहारी भोजन' },
      { id: 'Diabetic Friendly', title: 'डायबिटिक फ्रेंडली', desc: 'कम ग्लाइसेमिक इंडेक्स वाला पौष्टिक भोजन' },
      { id: 'Other', title: 'कस्टम डाइट', desc: 'अपनी आवश्यकतानुसार अनुकूलित आहार' },
    ],

    accomplishTitle: 'अपेक्षित स्वास्थ्य परिणाम',
    accomplishSubtitle: 'वे मुख्य लाभ चुनें जो आप प्राप्त करना चाहते हैं।',
    accomplishOptions: [
      { id: 'energy', title: 'निरंतर शारीरिक ऊर्जा', desc: 'दिन भर ताजगी और थकान मुक्त महसूस करें' },
      { id: 'belly', title: 'पेट की चर्बी कम करना', desc: 'कमर और पेट को पतला और सुडौल बनाएं' },
      { id: 'strength', title: 'शारीरिक ताकत एवं स्टैमिना', desc: 'हड्डियों और मांसपेशियों को मजबूती दें' },
      { id: 'sleep', title: 'गहरी नींद और रिकवरी', desc: 'नींद की गुणवत्ता और तनाव में सुधार' },
      { id: 'gut', title: 'पाचन तंत्र एवं आंत स्वास्थ्य', desc: 'बेहतर पाचन और गैस/एसिडिटी से राहत' },
      { id: 'immunity', title: 'रोग प्रतिरोधक क्षमता', desc: 'शरीर की आंतरिक सुरक्षा को मजबूत बनाएं' },
    ],

    potentialTitle: 'आप में स्वास्थ्य सुधार की अपार क्षमता है',
    potentialSubtitle: 'आपकी आयु और लक्ष्यों के अनुसार आपकी मेटाबोलिक गति शीर्ष 15% में है।',

    speedTitle: 'लक्ष्य प्राप्ति की गति',
    speedSubtitle: 'कैलोरी परिवर्तन की आरामदायक गति चुनें।',

    habitsTitle: 'दैनिक खान-पान की आदतें',
    habitsSubtitle: 'आपकी आदतों को जानकर हम अधिक प्रभावी योजना बना सकते हैं।',
    habitsOptions: [
      { id: 'late_night', title: 'देर रात स्नैकिंग', desc: 'रात के भोजन के बाद खाने की आदत' },
      { id: 'stress_eating', title: 'तनाव में अधिक खाना', desc: 'काम के दबाव में मीठा या तला-भुना खाना' },
      { id: 'skip_breakfast', title: 'नाश्ता छोड़ना', desc: 'सुबह का नाश्ता न करने से शाम को अधिक भूख लगना' },
      { id: 'low_water', title: 'कम पानी पीना', desc: 'दिन भर में 2 लीटर से कम पानी का सेवन' },
      { id: 'sweet_cravings', title: 'मीठे की इच्छा', desc: 'खाने के तुरंत बाद मीठा खाने की तलब' },
      { id: 'none', title: 'नियमित और संतुलित भोजन', desc: 'समय पर भोजन और संतुलित दिनचर्या' },
    ],

    medicalTitle: 'स्वास्थ्य स्थिति एवं मेडिकल इतिहास',
    medicalSubtitle: 'सुरक्षित और सटीक पोषण योजना के लिए अनिवार्य।',
    medicalOptions: [
      { id: 'none', title: 'कोई ज्ञात चिकित्सीय स्थिति नहीं', desc: 'स्वस्थ मेटाबोलिक स्थिति' },
      { id: 'diabetes', title: 'टाइप 2 डायबिटीज / प्रीडायबिटीज', desc: 'रक्त शर्करा और कार्ब्स का विशेष नियंत्रण' },
      { id: 'hypertension', title: 'उच्च रक्तचाप (High BP)', desc: 'सोडियम और पोटेशियम का संतुलन' },
      { id: 'thyroid', title: 'थायरॉइड विकार', desc: 'मेटाबोलिज्म और विशेष मिनरल्स का सहयोग' },
      { id: 'pcos', title: 'PCOS / PCOD', desc: 'हार्मोनल संतुलन और इंसुलिन प्रबंधन' },
      { id: 'fatty_liver', title: 'फैटी लिवर (NAFLD)', desc: 'लिवर स्वास्थ्य और शुगर नियंत्रण' },
      { id: 'high_cholesterol', title: 'उच्च कोलेस्ट्रॉल / लिपिड', desc: 'स्वस्थ वसा और फाइबर युक्त डाइट' },
    ],

    prefTitle: 'ट्रैकर सेटिंग्स',
    prefSubtitle: 'अपनी दैनिक कैलोरी गणना को अनुकूलित करें।',
    prefsTitle: 'नोटिफिकेशन एवं कैलोरी सेटिंग्स',
    prefsSubtitle: 'अपनी दैनिक सूचनाएं और कैलोरी बजट गणना अनुकूलित करें।',
    notifLabel: 'दैनिक रिमाइंडर एवं सूचनाएं',
    burnsLabel: 'वर्कआउट की कैलोरी को दैनिक बजट में जोड़ें',
    burnsDesc: 'एक्सरसाइज से बर्न हुई कैलोरी को खाने के बजट में शामिल करता है।',
    colorBurnsLabel: 'वर्कआउट की कैलोरी को दैनिक बजट में जोड़ें',
    colorBurnsDesc: 'एक्सरसाइज से बर्न हुई कैलोरी को खाने के बजट में शामिल करता है।',
    rolloverLabel: 'कैलोरी रोलओवर',
    rolloverDesc: 'बची हुई कैलोरी को अगले दिन के भोजन में उपयोग करने की सुविधा।',

    socialTitle: '1,00,000+ संतुष्ट सदस्यों का विश्वास',
    ratingText: '4.9 क्लीनिकल रेटिंग प्रमाणित परिणामों के आधार पर',

    thankYouTitle: 'मूल्यांकन पूर्ण हुआ',
    thankYouSubtitle: 'आपकी व्यक्तिगत क्लीनिकल पोषण योजना तैयार कर दी गई है।',
    referralLabel: 'डॉक्टर अथवा पार्टनर रेफरल कोड (वैकल्पिक)',

    commitTitle: 'स्वास्थ्य संकल्प एवं निष्ठा',
    commitSubtitle: 'निरंतरता ही स्थायी स्वास्थ्य की कुंजी है। अपने संकल्प की पुष्टि करें।',
    commitHoldBtn: 'संकल्प की पुष्टि के लिए दबाकर रखें',
    committedSuccess: 'संकल्प सत्यापित हुआ। आपकी योजना तैयार हो रही है...',

    calculatingTitle: 'क्लीनिकल पोषण योजना तैयार हो रही है',
    calculatingSettingUp: 'BMR, मैक्रोन्यूट्रिएंट्स और माइक्रोन्यूट्रिएंट्स का सटीक संतुलन किया जा रहा है...',
    calculatingDone: 'योजना सफलतापूर्वक तैयार हो गई है।',

    planReadyTitle: 'आपकी क्लीनिकल पोषण योजना तैयार है',
    trial3Title: '3-दिन का निःशुल्क ट्रायल शुरू करें',
    trialSubtitle: 'AI फूड स्कैनर, बहु-दिवसीय मील प्लानर और डॉक्टर कंसल्टेशन की पूरी सुविधा।',
    autoPayNote: 'सुरक्षित प्रमाणीकरण। 1 क्लिक में कभी भी रद्द करें। आज ₹0 शुल्क।',
    continueFreeBtn: 'मानक प्लान के साथ जारी रखें',

    // Report Uploader
    optionalBadge: 'क्लीनिकल एकीकरण (वैकल्पिक)',
    reportStepTitle: 'मेडिकल / ब्लड टेस्ट रिपोर्ट अपलोड करें',
    reportStepSubtitle: 'लिपिड प्रोफाइल, HbA1c, विटामिन D3/B12 अथवा थायरॉइड टेस्ट के आधार पर व्यक्तिगत पोषण लक्ष्य सेट करें।',
    trySampleTitle: 'अथवा सैंपल मेडिकल रिपोर्ट के साथ टेस्ट करें:',
    sampleLipid: 'हाई लिपिड / कोलेस्ट्रॉल सैंपल रिपोर्ट (245 mg/dL)',
    sampleSugar: 'डायबिटिक HbA1c सैंपल रिपोर्ट (7.8%)',
    uploadBoxTitle: 'ब्लड टेस्ट PDF / फोटो चुनें',
    uploadBoxSubtitle: 'फाइल चुनने के लिए क्लिक करें या ड्रैग करें (JPG, PNG, PDF 10MB तक)',
    skipReportBtn: 'छोड़ें और आगे बढ़ें →',
  },
};

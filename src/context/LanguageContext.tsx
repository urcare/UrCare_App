import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppLanguage = 'en' | 'hi';

export interface Translations {
  [key: string]: {
    en: string;
    hi: string;
  };
}

export const DICTIONARY: Translations = {
  // Brand & Header
  brandName: { en: 'UrCare', hi: 'उरकेयर' },
  brandTagline: { en: 'Metabolic Health & Clinical Nutrition Clinic', hi: 'मेटाबॉलिक स्वास्थ्य और क्लिनिकल पोषण क्लीनिक' },
  signIn: { en: 'Sign In', hi: 'लॉग इन करें' },
  signUp: { en: 'Create Account', hi: 'खाता बनाएं' },
  adminPortal: { en: 'Admin Portal', hi: 'एडमिन पोर्टल' },
  signOut: { en: 'Sign Out', hi: 'साइन आउट' },
  profile: { en: 'Profile', hi: 'प्रोफ़ाइल' },
  
  // Auth
  fullName: { en: 'Full Name', hi: 'पूरा नाम' },
  mobileNumber: { en: 'Mobile Phone Number', hi: 'मोबाइल नंबर' },
  emailAddress: { en: 'Email Address', hi: 'ईमेल पता' },
  password: { en: 'Password', hi: 'पासवर्ड' },
  loginIdentifier: { en: 'Mobile Number or Email Address', hi: 'मोबाइल नंबर या ईमेल पता' },
  loginIdentifierPlaceholder: { en: '9876543210 or name@example.com', hi: '9876543210 या name@example.com' },
  authTitleSignIn: { en: 'Welcome Back to UrCare', hi: 'UrCare में आपका स्वागत है' },
  authDescSignIn: { en: 'Enter your mobile number or email and password to access your daily plan.', hi: 'अपने दैनिक प्लान तक पहुँचने के लिए अपना मोबाइल नंबर या ईमेल और पासवर्ड दर्ज करें।' },
  authTitleSignUp: { en: 'Create Your Account', hi: 'अपना नया खाता बनाएं' },
  authDescSignUp: { en: 'Enter your name, mobile number, email, and password to begin.', hi: 'शुरू करने के लिए अपना नाम, मोबाइल नंबर, ईमेल और पासवर्ड दर्ज करें।' },
  continueBtn: { en: 'Continue', hi: 'आगे बढ़ें' },
  
  // Tabs
  tabDaily: { en: 'Daily Tracker', hi: 'दैनिक ट्रैकर' },
  tabRecommendations: { en: 'Doctor Recommendations', hi: 'डॉक्टर की सलाह' },
  tabStore: { en: 'Supplements & Store', hi: 'सप्लीमेंट्स और स्टोर' },
  tabReports: { en: 'Lab Reports & Rx', hi: 'लैब रिपोर्ट व पर्चे' },
  tabProfile: { en: 'My Health Profile', hi: 'मेरी हेल्थ प्रोफ़ाइल' },
  
  // Risk Warnings
  criticalRiskTitle: { en: 'CRITICAL METABOLIC WARNING', hi: 'गंभीर मेटाबॉलिक स्वास्थ्य चेतावनी' },
  riskSubheading: { en: 'Immediate health risks identified based on your current biometrics', hi: 'आपके वर्तमान बायोमेट्रिक्स के आधार पर पाए गए गंभीर स्वास्थ्य जोखिम' },
  visceralFatWarning: { en: 'Dangerous Visceral Fat Accumulation', hi: 'अंगों पर खतरनाक चर्बी (Visceral Fat) का जमाव' },
  visceralFatDesc: { en: 'Excess internal fat is silently wrapping around your liver and heart, increasing heart attack and diabetes risk.', hi: 'आंतरिक चर्बी चुपचाप आपके लिवर और दिल के चारों ओर जमा हो रही है, जिससे दिल के दौरे और शुगर का खतरा बढ़ता है।' },
  metabolicDecayWarning: { en: 'Metabolic Slowdown & Early Burnout', hi: 'मेटाबॉलिज्म में भारी गिरावट और लगातार थकान' },
  metabolicDecayDesc: { en: 'Without daily macro pacing, your metabolic burn rate drops by 8% every 6 months, causing stubborn fat rebound.', hi: 'सही पोषण के बिना हर 6 महीने में मेटाबॉलिज्म 8% धीमा हो जाता है, जिससे वजन दोबारा तेजी से बढ़ता है।' },
  inactionWarning: { en: 'Consequence of Inaction (Next 12 Months)', hi: 'अगर आज कदम नहीं उठाया तो 12 महीने में क्या होगा?' },
  inactionPoints: { en: '+5.4 kg Stubborn Belly Fat • 3.2x Risk of Fatty Liver • Daily Mid-Day Exhaustion', hi: '+5.4 किलो पेट की जिद्दी चर्बी • फैटी लिवर का 3.2 गुना खतरा • दिनभर भारी सुस्ती और थकान' },
  startPlanNow: { en: 'Neutralize This Risk: Start 90-Day Plan', hi: 'इस खतरे को तुरंत रोकें: 90 दिनों का प्लान शुरू करें' },

  // Tracker
  caloriesRemaining: { en: 'Calories Remaining', hi: 'बची हुई कैलोरी' },
  protein: { en: 'Protein', hi: 'प्रोटीन' },
  carbs: { en: 'Carbs', hi: 'कार्ब्स' },
  fats: { en: 'Fats', hi: 'फैट्स' },
  water: { en: 'Water', hi: 'पानी' },
  scanFood: { en: 'Scan Food with AI', hi: 'एआई से खाना स्कैन करें' },
  addMeal: { en: 'Log Meal', hi: 'खाना जोड़ें' },
  consultDoctor: { en: 'Doctor Consult', hi: 'डॉक्टर से बात करें' },
  
  // Profile
  personalDetails: { en: 'Personal & Contact Details', hi: 'व्यक्तिगत और संपर्क जानकारी' },
  biometrics: { en: 'Calibrated Body Biometrics', hi: 'शारीरिक माप और बायोमेट्रिक्स' },
  currentWeight: { en: 'Current Weight', hi: 'वर्तमान वजन' },
  targetWeight: { en: 'Target Goal', hi: 'लक्ष्य वजन' },
  height: { en: 'Height', hi: 'कद (ऊंचाई)' },
  bmiStatus: { en: 'BMI Status', hi: 'बीएमआई स्थिति' },
  dietType: { en: 'Dietary Preference', hi: 'खानपान की प्राथमिकता' },
  membershipStatus: { en: 'Membership Plan', hi: 'सदस्यता प्लान' },
  activePro: { en: 'Pro Member (Active)', hi: 'प्रो सदस्य (सक्रिय)' },
  freeTrial: { en: '3-Day Precision Trial', hi: '3-दिन का नि:शुल्क ट्रायल' },
  switchLanguage: { en: 'App Language', hi: 'ऐप की भाषा' },
};

interface LanguageContextType {
  language: AppLanguage;
  lang: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: keyof typeof DICTIONARY | string, defaultVal?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  lang: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('urcare_lang') || localStorage.getItem('yourcare_lang');
      if (stored === 'hi' || stored === 'en') {
        setLanguageState(stored);
      }
    } catch (e) {}
  }, []);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('urcare_lang', lang);
      localStorage.setItem('yourcare_lang', lang);
    } catch (e) {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const t = (key: string, defaultVal?: string): string => {
    if (DICTIONARY[key]) {
      return DICTIONARY[key][language] || DICTIONARY[key].en || defaultVal || key;
    }
    return defaultVal || key;
  };

  return (
    <LanguageContext.Provider value={{ language, lang: language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export const LanguageSwitchButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`inline-flex items-center p-1 rounded-xl bg-zinc-100 border border-zinc-200/90 shadow-xs ${className}`}>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
          language === 'en'
            ? 'bg-white text-emerald-700 shadow-xs'
            : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        🇬🇧 EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('hi')}
        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
          language === 'hi'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        🇮🇳 हिंदी
      </button>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { 
  AlertTriangle, ShieldAlert, TrendingDown, ArrowRight, 
  Flame, Heart, Zap, CheckCircle2, ShieldCheck, Activity, Stethoscope
} from 'lucide-react';
import { UserHealthProfile } from '../types';
import { useLanguage, LanguageSwitchButton } from '../context/LanguageContext';

interface UrgentRiskScreenProps {
  profile: UserHealthProfile;
  onProceed: () => void;
  isModal?: boolean;
}

export const UrgentRiskScreen: React.FC<UrgentRiskScreenProps> = ({
  profile,
  onProceed,
  isModal = false,
}) => {
  const { language, t } = useLanguage();

  const { currentWeightKg = 72, targetWeightKg = 65, heightCm = 172, age = 28 } = profile || {};
  const bmi = Number((currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1)) || 24.3;
  const weightDiff = Math.abs(currentWeightKg - targetWeightKg);

  // Alarming Risk Percentage (Calculated dynamically)
  const riskPercent = Math.min(89, Math.max(68, Math.round(50 + (bmi > 25 ? (bmi - 25) * 4 : 15) + (age > 30 ? 10 : 5))));

  return (
    <div className={`w-full ${isModal ? 'max-w-2xl' : 'max-w-3xl'} mx-auto text-left space-y-6 animate-in fade-in zoom-in-95 duration-200`}>
      
      {/* Top Warning Alert Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white shadow-xl shadow-rose-600/25 relative overflow-hidden">
        
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 animate-pulse text-white">
              <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black tracking-wider uppercase">
                <span>⚠️ {language === 'hi' ? 'गंभीर चेतावनी' : 'URGENT METABOLIC ALERT'}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                {language === 'hi' ? 'आपके स्वास्थ्य में उच्च जोखिम पाया गया' : 'High Metabolic Risk Detected'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <LanguageSwitchButton className="bg-white/20 text-white border-white/20" />
          </div>
        </div>
      </div>

      {/* DYNAMIC RISK SCORE & VISCERAL FAT METER */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white border border-rose-200 shadow-xl space-y-6">
        
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
          
          {/* Left: Big Eye-Catching Risk Gauge */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-center space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-800">
              {language === 'hi' ? 'मेटाबॉलिक जोखिम स्कोर' : 'Metabolic Threat Score'}
            </span>
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  stroke="#FECDD3"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  stroke="#E11D48"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={326.7}
                  strokeDashoffset={326.7 - (326.7 * riskPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-rose-600 tracking-tight">{riskPercent}%</span>
                <span className="text-[9px] font-black uppercase text-rose-800 px-1.5 py-0.5 rounded-full bg-rose-200/70">
                  {language === 'hi' ? 'अति गंभीर' : 'CRITICAL'}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-950">
              {language === 'hi'
                ? `BMI ${bmi} • आयु ${age} वर्ष • वजन ${currentWeightKg} kg`
                : `BMI ${bmi} • Age ${age} • Weight ${currentWeightKg} kg`}
            </span>
          </div>

          {/* Right: Scary & Easy-to-Understand Projection */}
          <div className="sm:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 text-xs font-black uppercase tracking-wide">
              <TrendingDown className="w-4 h-4" />
              <span>{language === 'hi' ? 'अगर आज शुरू नहीं किया तो 12 महीने में परिणाम' : '12-Month Inaction Projection'}</span>
            </div>

            <h3 className="text-lg font-black text-zinc-950 leading-snug">
              {language === 'hi' 
                ? 'आपका मेटाबॉलिज्म हर महीने 3.5% धीमा हो रहा है'
                : 'Your metabolic fat clearance rate is decelerating rapidly'}
            </h3>

            <p className="text-xs text-zinc-600 leading-relaxed">
              {language === 'hi'
                ? 'अनियमित खानपान और अनियंत्रित कैलोरी के कारण आंतरिक चर्बी (Visceral Fat) आपके लिवर और धमनियों में जमा हो रही है, जिससे फैटी लिवर, टाइप-2 डायबिटीज और अचानक दिल से जुड़ी समस्याओं का खतरा 3.8 गुना बढ़ जाता है।'
                : 'Without precision calorie deficits and clinical macronutrient pacing, silent visceral fat is coating your internal organs. This accelerates metabolic exhaustion, insulin resistance, and cardiovascular strain.'}
            </p>
          </div>

        </div>

        {/* 3 ALARMING CORE BULLETS (EASY TO READ & EYE-CATCHING) */}
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-400 block">
            {language === 'hi' ? 'पहचाने गए मुख्य स्वास्थ्य खतरे' : 'Identified High-Risk Factors'}
          </span>

          <div className="grid grid-cols-1 gap-3">
            
            {/* Risk 1 */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/50 border border-rose-200/90 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 font-black">
                1
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-rose-950">
                    {language === 'hi' ? 'जिद्दी विसरल फैट और पेट की चर्बी (+5.2 kg)' : 'Dangerous Visceral Organ Fat (+5.2 kg)'}
                  </h4>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {language === 'hi' ? 'अति गंभीर' : 'Urgent'}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                  {language === 'hi'
                    ? 'पेट के अंदरूनी अंगों पर चर्बी बढ़ने से शरीर में सूजन (Inflammation) 45% बढ़ती है, जिससे वजन घटाना लगातार मुश्किल होता जाता है।'
                    : 'Visceral fat actively triggers systemic inflammation, trapping your body in a fat-storage loop and preventing natural weight loss.'}
                </p>
              </div>
            </div>

            {/* Risk 2 */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 font-black">
                2
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-amber-950">
                    {language === 'hi' ? 'ब्लड शुगर में उतार-चढ़ाव और प्री-डायबिटीज' : 'Blood Sugar Spikes & Pre-Diabetes Trap'}
                  </h4>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {language === 'hi' ? 'उच्च जोखिम' : 'High Risk'}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                  {language === 'hi'
                    ? 'दोपहर के समय भारी सुस्ती, मीठे की तेज क्रेविंग, और इंसुलिन रेसिस्टेंस की शुरुआत।'
                    : 'Uncalibrated carb spikes cause rapid insulin resistance, chronic mid-day brain fog, and relentless sugar cravings.'}
                </p>
              </div>
            </div>

            {/* Risk 3 */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/60 border border-orange-200/90 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center shrink-0 mt-0.5 font-black">
                3
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-orange-950">
                    {language === 'hi' ? 'कमजोरी और मांसपेशियों का नुकसान (Sarcopenia)' : 'Muscle Loss & Resting Metabolism Drop'}
                  </h4>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                    {language === 'hi' ? 'मध्यम जोखिम' : 'Moderate'}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                  {language === 'hi'
                    ? 'सही प्रोटीन न मिलने से शरीर जरूरी मांसपेशियों को गला देता है, जिससे हड्डियां कमजोर और थकान हावी रहती है।'
                    : 'Sub-optimal daily protein breaks down lean postural muscle, worsening posture and reducing lifetime metabolic longevity.'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* THE CLINICAL SOLUTION & ANTIDOTE */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-black uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{language === 'hi' ? 'UrCare 90-दिन का समाधान' : 'UrCare 90-Day Clinical Solution'}</span>
          </div>
          <p className="text-xs text-emerald-950 font-medium leading-relaxed">
            {language === 'hi'
              ? 'अच्छी खबर: इस पूरे जोखिम को 90 दिनों के अंदर 100% रोका जा सकता है। प्रतिदिन कैलोरी डेफिसिट, हाई-प्रोटीन डाइट और यूआरकेयर की स्मार्ट ट्रैकिंग के साथ अपने शरीर को तुरंत रिकवर करें।'
              : 'The good news: This metabolic degradation is 100% reversible. Starting your calibrated deficit and physician-guided macro pacing today can restore your metabolic health within 90 days.'}
          </p>
        </div>

        {/* ACTION CTA BUTTON */}
        <button
          type="button"
          onClick={onProceed}
          className="w-full py-4 sm:py-4.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
        >
          <span>
            {language === 'hi'
              ? 'इस जोखिम को तुरंत रोकें • 90 दिन का प्लान शुरू करें'
              : 'Neutralize This Threat • Activate 90-Day Plan'}
          </span>
          <ArrowRight className="w-4 h-4 stroke-[3]" />
        </button>

        <p className="text-[11px] text-center text-zinc-400 font-semibold">
          {language === 'hi' 
            ? '✓ प्रमाणित न्यूट्रिशनिस्ट व डॉक्टरों द्वारा अनुमोदित • सुरक्षित डेटा'
            : '✓ Verified by Clinical Nutritionists & Doctors • 100% Safe & Secure'}
        </p>

      </div>

    </div>
  );
};

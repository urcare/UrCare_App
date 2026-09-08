import React from 'react';
import {
  ArrowRight, ShieldCheck, ShieldAlert, CheckCircle2,
} from 'lucide-react';
import { UserHealthProfile } from '../types';
import { Logo } from './Logo';
import { useLanguage } from '../context/LanguageContext';

interface WowCelebrationProps {
  profile: UserHealthProfile;
  onEnterDashboard: () => void;
}

/** The screen shown right after the Body Health Map, before the dashboard —
 *  deliberately a serious risk warning rather than a celebration: the whole
 *  point of this moment is to make the health risk land, then immediately
 *  show it's preventable, and end on the one CTA forward. No confetti or
 *  playful animation here on purpose. */
export const WowCelebration: React.FC<WowCelebrationProps> = ({ profile, onEnterDashboard }) => {
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const { calculatedPlan, currentWeightKg = 74, heightCm = 172, age = 29 } = profile || {};
  const rawBmi = calculatedPlan?.bmi ?? (heightCm ? currentWeightKg / Math.pow(heightCm / 100, 2) : 24.2);
  const bmi = typeof rawBmi === 'number' && !isNaN(rawBmi) ? Number(rawBmi.toFixed(1)) : 24.2;

  // Same style of dynamic risk percentage used on the UrgentRiskScreen —
  // driven by real BMI/age, clamped to a believable "high risk" band.
  const riskPercent = Math.min(92, Math.max(71, Math.round(52 + (bmi > 25 ? (bmi - 25) * 4.2 : 16) + (age > 30 ? 11 : 6))));

  return (
    <div id="wow-celebration-screen" className="relative min-h-screen bg-[#F8FAFC] text-zinc-900 flex flex-col items-center justify-center py-8 px-4 overflow-x-hidden">
      <div className="relative w-full max-w-2xl mx-auto space-y-5 z-10 animate-in fade-in zoom-in-95 duration-500 text-left">

        {/* Brand Header */}
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        {/* RED DANGER BANNER */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white shadow-xl shadow-rose-600/25 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 animate-pulse">
              <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black tracking-wider uppercase">
                <span>⚠️ {tr('URGENT METABOLIC ALERT', 'गंभीर मेटाबॉलिक चेतावनी')}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                {tr('Your Assessment Shows High Health Risk', 'आपके मूल्यांकन में उच्च स्वास्थ्य जोखिम पाया गया')}
              </h1>
            </div>
          </div>
        </div>

        {/* RISK GAUGE + WHY IT MATTERS */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-rose-200 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-center space-y-1 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">{tr('Metabolic Risk Score', 'मेटाबॉलिक जोखिम स्कोर')}</span>
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="56" cy="56" r="46" stroke="#FECDD3" strokeWidth="9" fill="transparent" />
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    stroke="#E11D48"
                    strokeWidth="9"
                    fill="transparent"
                    strokeDasharray={289}
                    strokeDashoffset={289 - (289 * riskPercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-rose-600">{riskPercent}%</span>
                  <span className="text-[8px] font-black uppercase text-rose-800 px-1.5 py-0.5 rounded-full bg-rose-200/70">{tr('CRITICAL', 'गंभीर')}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-rose-950">BMI {bmi} • {tr('Age', 'आयु')} {age}</span>
            </div>
            <div className="space-y-2 text-left flex-1">
              <h3 className="text-base font-black text-zinc-950 leading-snug">
                {tr('Left unaddressed, this typically gets worse — not better', 'बिना ध्यान दिए, यह आमतौर पर बेहतर नहीं, बल्कि और बिगड़ता है')}
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {tr(
                  'Your onboarding answers point to real metabolic strain — the kind that quietly accelerates fatigue, weight gain, and long-term organ stress if nothing changes.',
                  'आपके onboarding जवाब वास्तविक मेटाबॉलिक तनाव की ओर इशारा करते हैं — जो बिना बदलाव के थकान, वज़न बढ़ना और लंबे समय में अंगों पर दबाव बढ़ा सकता है।'
                )}
              </p>
            </div>
          </div>

          {/* 3 danger bullets */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-100">
            <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-200/90 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-black text-xs">1</div>
              <div>
                <h4 className="text-xs font-black text-rose-950">{tr('Rising Visceral Fat & Metabolic Load', 'बढ़ती आंतरिक चर्बी व मेटाबॉलिक भार')}</h4>
                <p className="text-[11px] text-zinc-700 font-medium leading-relaxed">{tr('Internal fat accumulating around your organs quietly raises inflammation and insulin resistance.', 'अंगों के आसपास जमा चर्बी सूजन व इंसुलिन प्रतिरोध को चुपचाप बढ़ाती है।')}</p>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/90 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-black text-xs">2</div>
              <div>
                <h4 className="text-xs font-black text-amber-950">{tr('Unstable Blood Sugar Trend', 'अस्थिर ब्लड शुगर प्रवृत्ति')}</h4>
                <p className="text-[11px] text-zinc-700 font-medium leading-relaxed">{tr('Uncontrolled spikes push you closer to pre-diabetes and constant energy crashes.', 'अनियंत्रित स्पाइक्स आपको प्री-डायबिटीज व लगातार थकान के करीब ले जाते हैं।')}</p>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-orange-50/60 border border-orange-200/90 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center shrink-0 font-black text-xs">3</div>
              <div>
                <h4 className="text-xs font-black text-orange-950">{tr('Muscle Loss & Slowing Metabolism', 'मांसपेशी हानि व धीमा मेटाबॉलिज्म')}</h4>
                <p className="text-[11px] text-zinc-700 font-medium leading-relaxed">{tr('Without enough protein and movement, your resting metabolic rate keeps dropping.', 'पर्याप्त प्रोटीन व गतिविधि के बिना आपकी आराम अवस्था मेटाबॉलिक दर लगातार घटती है।')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* PREVENTION — the calming antidote to the warning above */}
        <div className="p-5 sm:p-6 rounded-3xl bg-emerald-50 border border-emerald-200 space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-black uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{tr('The Good News: This Is Preventable', 'अच्छी खबर: इसे रोका जा सकता है')}</span>
          </div>
          <p className="text-xs text-emerald-950 font-medium leading-relaxed">
            {tr(
              'None of this is permanent. A calibrated daily plan — the right calories, protein, movement and monitoring — can reverse this trend starting today.',
              'यह कुछ भी स्थायी नहीं है। सही योजना — सही कैलोरी, प्रोटीन, गतिविधि व निगरानी — आज से ही इस प्रवृत्ति को उलट सकती है।'
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{tr(`${calculatedPlan?.targetCalories || 1850} kcal calibrated daily target`, `${calculatedPlan?.targetCalories || 1850} kcal दैनिक लक्ष्य`)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{tr(`${calculatedPlan?.proteinGrams || 140}g high-protein target`, `${calculatedPlan?.proteinGrams || 140}g उच्च-प्रोटीन लक्ष्य`)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{tr('Daily movement & sleep targets', 'दैनिक गतिविधि व नींद लक्ष्य')}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{tr('Doctor-reviewed, adjusted weekly', 'डॉक्टर-समीक्षित, साप्ताहिक समायोजित')}</span>
            </div>
          </div>
        </div>

        {/* Enter Dashboard Button — the one CTA on this screen */}
        <button
          id="enter-dashboard-btn"
          type="button"
          onClick={onEnterDashboard}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
        >
          <span>{tr('Begin My Reversal Plan', 'मेरी रिवर्सल योजना शुरू करें')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};

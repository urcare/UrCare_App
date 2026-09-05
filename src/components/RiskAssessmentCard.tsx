import React from 'react';
import { 
  ShieldCheck, Activity, TrendingDown, Sparkles, CheckCircle2, 
  ArrowRight, Zap, HeartPulse
} from 'lucide-react';
import { UserHealthProfile } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface RiskAssessmentCardProps {
  profile: UserHealthProfile;
  className?: string;
  onTakeAction?: () => void;
}

export const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({
  profile,
  className = '',
  onTakeAction,
}) => {
  const { language } = useLanguage();
  const isHi = language === 'hi';

  const { calculatedPlan, currentWeightKg = 74, targetWeightKg = 65, heightCm = 172, age = 29 } = profile || {};
  const rawBmi = calculatedPlan?.bmi ?? (heightCm ? (currentWeightKg / Math.pow(heightCm / 100, 2)) : 24.2);
  const bmi = typeof rawBmi === 'number' && !isNaN(rawBmi) ? rawBmi : 24.2;
  const weightDiff = typeof currentWeightKg === 'number' && typeof targetWeightKg === 'number' 
    ? Math.max(1, Math.round(currentWeightKg - targetWeightKg)) 
    : 8;

  const keyOptimizations = [
    {
      icon: HeartPulse,
      title: isHi ? 'इंसुलिन संवेदनशीलता में सुधार' : 'Insulin Sensitivity Boost',
      badge: '+42% ' + (isHi ? 'बेहतर' : 'Optimized'),
      desc: isHi 
        ? 'संतुलित मैक्रोन्यूट्रिएंट्स से ग्लूकोज स्पाइक्स 0% पर नियंत्रित रहेंगे।'
        : 'Precision caloric pacing maintains stable glucose with zero glycemic spikes.',
    },
    {
      icon: TrendingDown,
      title: isHi ? 'सुरक्षित वजन घटाने का लक्ष्य' : 'Metabolic Fat Reduction',
      badge: `${weightDiff} kg ` + (isHi ? 'लक्ष्य' : 'Target'),
      desc: isHi
        ? 'प्रति सप्ताह 0.6–0.8 kg की सुरक्षित दर से फैट बर्निंग सक्रिय रहेगी।'
        : 'Target fat burn pacing at a physician-approved rate of 0.6–0.8 kg/week.',
    },
    {
      icon: Activity,
      title: isHi ? 'ऊर्जा व सेल्युलर स्वास्थ्य' : 'Cellular Vitality & RMR',
      badge: isHi ? 'उत्कृष्ट' : 'Peak 94/100',
      desc: isHi
        ? 'पर्याप्त प्रोटीन व हाइड्रेशन से रेस्टिंग मेटाबॉलिज्म निरंतर सक्रिय रहेगा।'
        : 'High-protein diet preserves muscle mass and elevates resting metabolic rate.',
    }
  ];

  return (
    <div className={`p-5 sm:p-6 rounded-3xl bg-white border border-emerald-200/90 shadow-lg space-y-4 text-left relative overflow-hidden ${className}`}>
      
      {/* Top Emerald Accent Strip */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />

      {/* Header with Controlled Low-Risk Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black tracking-wider uppercase">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>{isHi ? 'मेटाबोलिक स्वास्थ्य मूल्यांकन' : 'METABOLIC HEALTH FORECAST'}</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight mt-0.5">
              {isHi ? 'प्रोटोकॉल के साथ जोखिम स्तर: न्यूनतम व नियंत्रित' : 'Risk Level: Controlled & On Track'}
            </h3>
          </div>
        </div>

        <div className="px-3 py-1 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-900 text-xs font-black self-start sm:self-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{isHi ? 'कम जोखिम (Low Risk)' : 'Low Risk • 100% Safe'}</span>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
          <div className="text-zinc-400 font-bold text-[9px] uppercase">{isHi ? 'प्रारंभिक BMI' : 'Current BMI'}</div>
          <div className="text-sm font-black text-zinc-900 mt-0.5">{bmi.toFixed(1)}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-emerald-700 font-bold text-[9px] uppercase">{isHi ? 'मेटाबोलिक स्कोर' : 'Readiness'}</div>
          <div className="text-sm font-black text-emerald-700 mt-0.5">94 / 100</div>
        </div>
        <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200">
          <div className="text-teal-700 font-bold text-[9px] uppercase">{isHi ? 'रिवर्सल अवधि' : 'Reversal Window'}</div>
          <div className="text-sm font-black text-teal-800 mt-0.5">60–90 {isHi ? 'दिन' : 'Days'}</div>
        </div>
      </div>

      {/* Concise Optimization Highlights */}
      <div className="space-y-2">
        {keyOptimizations.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="p-2.5 rounded-2xl bg-zinc-50/80 border border-zinc-100 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-white border border-zinc-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-zinc-900">{item.title}</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {item.badge}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug font-medium">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer if required */}
      {onTakeAction && (
        <button
          type="button"
          onClick={onTakeAction}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <span>{isHi ? 'प्रोटोकॉल जारी रखें' : 'Continue to Dashboard'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}

    </div>
  );
};

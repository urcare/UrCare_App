import React, { useState } from 'react';
import { 
  X, Check, MessageSquare, Star, Sparkles, ShieldCheck, 
  Send, Calendar, AlertCircle, RefreshCw, CheckCircle2, TrendingUp
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { FeedbackSubmission } from '../types';
import { submitClinicalFeedback } from '../utils/supabase';

interface ClinicalFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  dayCycleNumber?: number;
  onFeedbackSubmitted?: (feedback: FeedbackSubmission) => void;
}

export const ClinicalFeedbackModal: React.FC<ClinicalFeedbackModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  dayCycleNumber = 4,
  onFeedbackSubmitted,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);

  const [energyRating, setEnergyRating] = useState<number>(4);
  const [digestionRating, setDigestionRating] = useState<number>(4);
  const [adherencePercentage, setAdherencePercentage] = useState<number>(85);
  const [satietyLevel, setSatietyLevel] = useState<'low' | 'optimal' | 'excessive'>('optimal');
  const [suggestions, setSuggestions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const feedback: FeedbackSubmission = {
      id: 'fb_' + Date.now(),
      userId: userId || 'usr_active',
      userName: userName || tr('Valued Patient', 'सम्मानित रोगी'),
      dayCycleNumber,
      energyRating,
      digestionRating,
      adherencePercentage,
      satietyLevel,
      improvementSuggestions: suggestions.trim() || tr('No specific improvements requested. Protocol running smoothly.', 'कोई विशेष सुधार अनुरोधित नहीं। प्रोटोकॉल सुचारू रूप से चल रहा है।'),
      createdAt: new Date().toISOString(),
    };

    await submitClinicalFeedback(feedback);
    setIsSubmitting(false);
    setIsSubmitted(true);
    if (onFeedbackSubmitted) onFeedbackSubmitted(feedback);
  };

  const cardBg = isDark ? 'bg-zinc-950 border border-zinc-800 text-white' : 'bg-white border border-zinc-200 text-zinc-950 shadow-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl ${cardBg} space-y-6 text-left relative max-h-[90vh] overflow-y-auto`}>
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
              {tr('3 to 6 Day Clinical Adherence Check-In', '3 से 6 दिन का क्लिनिकल पालन चेक-इन')}
            </span>
          </div>
          <h3 className="text-xl font-black">
            {isSubmitted ? tr('Feedback Logged', 'फीडबैक दर्ज हुआ') : tr(`Day ${dayCycleNumber} Progress & Platform Input`, `दिन ${dayCycleNumber} प्रगति व प्लेटफ़ॉर्म इनपुट`)}
          </h3>
          <p className="text-xs opacity-65 mt-1">
            {isSubmitted
              ? tr('Thank you for your clinical feedback. Data has been synchronized with Supabase for nutritional algorithm refinement.', 'आपके क्लिनिकल फीडबैक के लिए धन्यवाद। डेटा को पोषण एल्गोरिदम सुधार हेतु Supabase के साथ सिंक कर दिया गया है।')
              : tr('Every 3 to 6 days, this evaluation measures dietary adaptation, metabolic tolerance, and requested enhancements.', 'हर 3 से 6 दिन में, यह मूल्यांकन आहार अनुकूलन, मेटाबॉलिक सहनशीलता व अनुरोधित सुधारों को मापता है।')}
          </p>
        </div>

        {isSubmitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-extrabold">{tr('Assessment Synchronized', 'मूल्यांकन सिंक हो गया')}</h4>
              <p className="text-xs opacity-70 max-w-sm mx-auto">
                {tr('Next scheduled clinical feedback checkpoint will open in 3 to 6 days. Your dietary recommendations will adapt dynamically.', 'अगला निर्धारित क्लिनिकल फीडबैक चेकपॉइंट 3 से 6 दिनों में खुलेगा। आपकी आहार सिफारिशें गतिशील रूप से अनुकूलित होंगी।')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all"
            >
              {tr('Return to Dashboard', 'डैशबोर्ड पर वापस जाएं')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Metric 1: Energy & Vitality */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold opacity-80">{tr('Overall Daytime Energy & Focus', 'समग्र दिनभर की ऊर्जा व फोकस')}</label>
                <span className="font-mono text-emerald-500 font-bold">{energyRating} / 5</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setEnergyRating(score)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      energyRating === score
                        ? 'bg-emerald-500 text-black border-emerald-500 shadow-md shadow-emerald-500/20 font-black'
                        : isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700' : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric 2: Digestion & GI Comfort */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold opacity-80">{tr('Digestion & GI Tolerance', 'पाचन व GI सहनशीलता')}</label>
                <span className="font-mono text-emerald-500 font-bold">{digestionRating} / 5</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setDigestionRating(score)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      digestionRating === score
                        ? 'bg-emerald-500 text-black border-emerald-500 shadow-md shadow-emerald-500/20 font-black'
                        : isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700' : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric 3: Satiety & Caloric Satisfaction */}
            <div className="space-y-2">
              <label className="block text-xs font-bold opacity-80">{tr('Meal Satiety & Hunger Management', 'भोजन तृप्ति व भूख प्रबंधन')}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'low', label: tr('Hungry Often', 'अक्सर भूख लगती है') },
                  { id: 'optimal', label: tr('Well Balanced', 'अच्छी तरह संतुलित') },
                  { id: 'excessive', label: tr('Too Full', 'बहुत भरा हुआ') },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSatietyLevel(item.id as any)}
                    className={`py-2 px-2 text-[11px] font-bold rounded-xl border text-center transition-all ${
                      satietyLevel === item.id
                        ? 'bg-emerald-500 text-black border-emerald-500 font-black'
                        : isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric 4: Adherence Percentage Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold opacity-80">{tr('Protocol Adherence Rate (Past 3-6 Days)', 'प्रोटोकॉल पालन दर (पिछले 3-6 दिन)')}</label>
                <span className="font-mono text-emerald-500 font-bold">{adherencePercentage}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                step="5"
                value={adherencePercentage}
                onChange={(e) => setAdherencePercentage(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Metric 5: Open Improvement Suggestions */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold opacity-80">
                {tr('User Feedback & Improvement Suggestions', 'उपयोगकर्ता फीडबैक व सुधार सुझाव')}
              </label>
              <textarea
                rows={3}
                placeholder={tr('Suggest new meal ideas, request specific food items, or mention app UI adjustments...', 'नए भोजन विचार सुझाएं, विशेष खाद्य पदार्थों का अनुरोध करें, या ऐप UI समायोजन बताएं...')}
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                className={`w-full p-3 rounded-xl border text-xs font-medium outline-none resize-none ${
                  isDark ? 'bg-zinc-900 border-zinc-800 text-white focus:border-emerald-500' : 'bg-zinc-50 border-zinc-300 text-zinc-950 focus:border-emerald-600'
                }`}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{tr('Submitting to Clinical Registry...', 'क्लिनिकल रजिस्ट्री में सबमिट हो रहा है...')}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{tr(`Submit Day ${dayCycleNumber} Clinical Feedback`, `दिन ${dayCycleNumber} क्लिनिकल फीडबैक सबमिट करें`)}</span>
                </>
              )}
            </button>

          </form>
        )}

      </div>
    </div>
  );
};

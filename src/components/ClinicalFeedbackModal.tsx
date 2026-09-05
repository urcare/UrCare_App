import React, { useState } from 'react';
import { 
  X, Check, MessageSquare, Star, Sparkles, ShieldCheck, 
  Send, Calendar, AlertCircle, RefreshCw, CheckCircle2, TrendingUp
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
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
      userName: userName || 'Valued Patient',
      dayCycleNumber,
      energyRating,
      digestionRating,
      adherencePercentage,
      satietyLevel,
      improvementSuggestions: suggestions.trim() || 'No specific improvements requested. Protocol running smoothly.',
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
              3 to 6 Day Clinical Adherence Check-In
            </span>
          </div>
          <h3 className="text-xl font-black">
            {isSubmitted ? 'Feedback Logged' : `Day ${dayCycleNumber} Progress & Platform Input`}
          </h3>
          <p className="text-xs opacity-65 mt-1">
            {isSubmitted 
              ? 'Thank you for your clinical feedback. Data has been synchronized with Supabase for nutritional algorithm refinement.' 
              : 'Every 3 to 6 days, this evaluation measures dietary adaptation, metabolic tolerance, and requested enhancements.'}
          </p>
        </div>

        {isSubmitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-extrabold">Assessment Synchronized</h4>
              <p className="text-xs opacity-70 max-w-sm mx-auto">
                Next scheduled clinical feedback checkpoint will open in 3 to 6 days. Your dietary recommendations will adapt dynamically.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Metric 1: Energy & Vitality */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold opacity-80">Overall Daytime Energy & Focus</label>
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
                <label className="font-bold opacity-80">Digestion & GI Tolerance</label>
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
              <label className="block text-xs font-bold opacity-80">Meal Satiety & Hunger Management</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'low', label: 'Hungry Often' },
                  { id: 'optimal', label: 'Well Balanced' },
                  { id: 'excessive', label: 'Too Full' },
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
                <label className="font-bold opacity-80">Protocol Adherence Rate (Past 3-6 Days)</label>
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
                User Feedback & Improvement Suggestions
              </label>
              <textarea
                rows={3}
                placeholder="Suggest new meal ideas, request specific food items, or mention app UI adjustments..."
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
                  <span>Submitting to Clinical Registry...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Day {dayCycleNumber} Clinical Feedback</span>
                </>
              )}
            </button>

          </form>
        )}

      </div>
    </div>
  );
};

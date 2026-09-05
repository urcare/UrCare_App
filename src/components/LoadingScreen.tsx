import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Zap } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Logo } from './Logo';

interface LoadingScreenProps {
  onLoaded?: () => void;
  durationMs?: number;
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onLoaded,
  durationMs = 1200,
  message = 'Initializing Clinical Metabolic Intelligence...',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onLoaded) setTimeout(onLoaded, 200);
          return 100;
        }
        return prev + Math.floor(Math.random() * 20) + 12;
      });
    }, durationMs / 6);

    return () => clearInterval(interval);
  }, [durationMs, onLoaded]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${isDark ? 'bg-black text-white' : 'bg-white text-zinc-950'} transition-colors duration-300 select-none`}>
      <div className="max-w-xs w-full px-6 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Brand Icon & Name */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
            <Activity className="w-8 h-8 text-black stroke-[2.5]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black border-2 border-emerald-500 flex items-center justify-center">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            UrCare
          </h1>
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mt-1">
            Clinical Nutrition & Metabolic Protocol
          </p>
        </div>

        {/* Progress Bar & Status */}
        <div className="w-full space-y-2">
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out shadow-sm shadow-emerald-500/50"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
            <span>{message}</span>
            <span>{Math.min(100, progress)}%</span>
          </div>
        </div>

        {/* Security & Clinical Badge */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 pt-2 border-t border-zinc-800/40">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Evidence-Based Endocrinology & Dietetics</span>
        </div>

      </div>
    </div>
  );
};

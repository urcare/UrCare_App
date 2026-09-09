import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { BrandMark } from './Logo';

interface LoadingScreenProps {
  onLoaded?: () => void;
  durationMs?: number;
  message?: string;
}

/** A traveling pulse that sweeps left-to-right across a stylized ECG/heartbeat
 *  line, looping continuously — the same "heartbeat under the logo" beat the
 *  splash mockup calls for. Pure SVG + Framer Motion, no image asset needed. */
const HeartbeatLine: React.FC = () => {
  const path = 'M0,20 L34,20 L42,6 L50,34 L58,12 L64,20 L100,20';
  return (
    <svg viewBox="0 0 100 40" className="w-40 h-10" fill="none" preserveAspectRatio="none">
      {/* Faint static trace underneath, so the line reads even between pulses */}
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600/20" />
      {/* The bright traveling pulse itself */}
      <motion.path
        d={path}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-500"
        pathLength={1}
        initial={{ pathLength: 0.22, pathOffset: 0 }}
        animate={{ pathOffset: 1 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  );
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onLoaded,
  durationMs = 1800,
  message,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { language } = useLanguage();
  const tr = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const displayMessage = message || tr('Initializing Clinical Metabolic Intelligence...', 'क्लिनिकल मेटाबॉलिक इंटेलिजेंस शुरू हो रहा है...');
  const [progress, setProgress] = useState(15);
  const [imgFailed, setImgFailed] = useState(false);

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
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${isDark ? 'bg-black text-white' : 'bg-white text-zinc-950'} transition-colors duration-300 select-none overflow-hidden`}>

      {/* Soft ambient glow behind the mark, matching the mockup's gentle
          green wash rather than a hard-edged card. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative max-w-xs w-full px-6 flex flex-col items-center text-center space-y-7">

        {/* 1. Logo — fades and scales in first */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {imgFailed ? (
            <BrandMark className="w-20 h-20 text-emerald-600" />
          ) : (
            <img
              src="/UrCare.png"
              alt="UrCare"
              width={112}
              height={112}
              decoding="async"
              onError={() => setImgFailed(true)}
              className="w-20 h-20 object-contain"
            />
          )}
        </motion.div>

        {/* Brand name + tagline — arrives just after the logo settles */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
        >
          <h1 className="text-3xl font-black tracking-tight">
            <span className={isDark ? 'text-white' : 'text-zinc-950'}>Ur</span>
            <span className="text-emerald-500">Care</span>
          </h1>
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mt-1.5">
            {tr('Clinical Nutrition & Metabolic Protocol', 'क्लिनिकल पोषण व मेटाबॉलिक प्रोटोकॉल')}
          </p>
        </motion.div>

        {/* 2. Heartbeat — the beat under the logo, looping */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-emerald-500"
        >
          <HeartbeatLine />
        </motion.div>

        {/* Progress Bar & Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="w-full space-y-2"
        >
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out shadow-sm shadow-emerald-500/50"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
            <span>{displayMessage}</span>
            <span>{Math.min(100, progress)}%</span>
          </div>
        </motion.div>

        {/* Security & Clinical Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.95 }}
          className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 pt-2 border-t border-zinc-800/40 w-full justify-center"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>{tr('Evidence-Based Endocrinology & Dietetics', 'साक्ष्य-आधारित एंडोक्राइनोलॉजी व आहार विज्ञान')}</span>
        </motion.div>

      </div>
    </div>
  );
};

import React from 'react';
import { useTheme } from '../context/ThemeContext';

// UrCare brand mark: a heart outline with an embedded circuit trace (AI/digital health)
// and a medical cross — matches the app's favicon and every in-app logo placement.
export const BrandMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className}>
    <path
      d="M24 41C24 41 6 29.5 6 15.5C6 8.6 11.2 4 17 4C20.3 4 22.7 5.9 24 8.6C25.3 5.9 27.7 4 31 4C36.8 4 42 8.6 42 15.5C42 29.5 24 41 24 41Z"
      stroke="currentColor"
      strokeWidth="3.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path
      d="M13 26H15.5L18.5 29.5H21.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="21.8" cy="29.5" r="1.9" fill="currentColor" />
    <circle cx="18.5" cy="23.2" r="1.9" fill="currentColor" />
    <path d="M13 26L15.5 23.2H18.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M33 15H37V19H33V23H29V19H25V15H29V11H33V15Z"
      fill="currentColor"
    />
  </svg>
);

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const iconSizes = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  const titleSizes = {
    sm: 'text-sm tracking-tight',
    md: 'text-lg tracking-tight',
    lg: 'text-2xl tracking-tighter',
    xl: 'text-3xl tracking-tighter',
  };

  const subSizes = {
    sm: 'text-[9px] tracking-wider',
    md: 'text-[10px] tracking-widest',
    lg: 'text-xs tracking-widest',
    xl: 'text-xs tracking-widest',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon: real UrCare logo artwork, always on a white plate */}
      <div className={`relative ${iconSizes[size]} shrink-0 rounded-2xl flex items-center justify-center transition-all duration-300 group`}>
        <div className="relative w-full h-full rounded-2xl bg-white border border-emerald-100 flex items-center justify-center shadow-md shadow-emerald-900/5 overflow-hidden">
          <img src="/UrCare.png" alt="UrCare" className="w-4/5 h-4/5 object-contain" />
        </div>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col text-left">
        <div className={`font-black flex items-center tracking-tight ${titleSizes[size]}`}>
          <span className={isDark ? 'text-white' : 'text-zinc-950'}>Ur</span>
          <span className="text-emerald-500">Care</span>
        </div>
        {showSubtitle && (
          <span className={`font-black uppercase tracking-wider text-emerald-600/90 ${subSizes[size]}`}>
            METABOLIC HEALTH & CLINIC
          </span>
        )}
      </div>
    </div>
  );
};

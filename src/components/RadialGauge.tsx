import React from 'react';
import { motion } from 'motion/react';

interface RadialGaugeProps {
  /** 0-100, clamped. Represents "how far filled" the ring should read —
   *  callers decide what that means (a real percentage, or a zone
   *  position), never invented here. */
  pct: number;
  colorFrom: string;
  colorTo: string;
  size?: number;
  strokeWidth?: number;
  /** Must be unique per instance on the page — becomes the SVG
   *  <linearGradient> id, and two gauges sharing one would silently share
   *  the same gradient definition. */
  gradId: string;
  delay?: number;
}

/** One small, reusable "crafted chart" — a gradient-stroked circular
 *  progress ring, animated on mount. Used across the Tracker module
 *  (plan progress, BMI, macros) and the Tracker's own Biomarker gauges, so
 *  every radial chart on this screen shares one real implementation. */
export const RadialGauge: React.FC<RadialGaugeProps> = ({ pct, colorFrom, colorTo, size = 88, strokeWidth = 9, gradId, delay = 0.1 }) => {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-zinc-900/[0.06]" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={clamped > 0 ? `url(#${gradId})` : 'transparent'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut', delay }}
      />
    </svg>
  );
};

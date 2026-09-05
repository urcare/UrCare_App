import React, { useRef, useEffect, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { playScrollTickSound, playClickSound } from '../utils/soundEffects';

interface RulerWheelPickerProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  majorStep?: number;
  mediumStep?: number;
  itemWidth?: number;
  isDark?: boolean;
  className?: string;
  decimals?: number;
}

export const RulerWheelPicker: React.FC<RulerWheelPickerProps> = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  unit,
  majorStep = 5,
  mediumStep = 1,
  itemWidth = 14,
  isDark = true,
  className = '',
  decimals = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickIndexRef = useRef<number | null>(null);

  // Generate all tick values
  const totalSteps = Math.round((max - min) / step);
  const values: number[] = [];
  for (let i = 0; i <= totalSteps; i++) {
    const val = Number((min + i * step).toFixed(decimals));
    values.push(val);
  }

  const selectedIndex = Math.max(
    0,
    values.findIndex((v) => Math.abs(v - value) < step / 2)
  );

  const scrollToValue = useCallback((val: number, smooth = true) => {
    if (!containerRef.current) return;
    const index = Math.max(0, values.findIndex((v) => Math.abs(v - val) < step / 2));
    if (index === -1) return;
    const targetScroll = index * itemWidth;
    containerRef.current.scrollTo({
      left: targetScroll,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [itemWidth, step, values]);

  // Sync scroll on initial render or external value change
  useEffect(() => {
    if (!isScrollingRef.current) {
      scrollToValue(value, false);
      lastTickIndexRef.current = selectedIndex;
    }
  }, [value, scrollToValue, selectedIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;

    // Live tick: sound fires the instant the ruler glides past each notch, mid-scroll.
    const liveIndex = Math.max(
      0,
      Math.min(values.length - 1, Math.round(containerRef.current.scrollLeft / itemWidth))
    );
    if (lastTickIndexRef.current !== liveIndex) {
      lastTickIndexRef.current = liveIndex;
      playScrollTickSound(900);
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollLeft = containerRef.current.scrollLeft;
      const index = Math.round(scrollLeft / itemWidth);
      const clampedIndex = Math.max(0, Math.min(values.length - 1, index));
      const targetVal = values[clampedIndex];

      scrollToValue(targetVal, true);

      if (targetVal !== undefined && Math.abs(targetVal - value) >= step / 2) {
        onChange(targetVal);
      }
      isScrollingRef.current = false;
    }, 70);
  };

  const handleQuickStep = (direction: 'prev' | 'next') => {
    playClickSound(620);
    const nextVal = direction === 'prev' 
      ? Math.max(min, Number((value - (majorStep || step)).toFixed(decimals)))
      : Math.min(max, Number((value + (majorStep || step)).toFixed(decimals)));
    onChange(nextVal);
    scrollToValue(nextVal, true);
  };

  return (
    <div className={`w-full flex flex-col items-center select-none ${className}`}>
      {/* Top Value Display & Controls */}
      <div className="flex items-center justify-between w-full px-2 mb-3">
        <button
          type="button"
          onClick={() => handleQuickStep('prev')}
          disabled={value <= min}
          className={`p-2 rounded-xl transition-all ${
            value <= min 
              ? 'opacity-20 cursor-not-allowed' 
              : isDark 
                ? 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40' 
                : 'bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-emerald-600 hover:border-emerald-500/40'
          }`}
          aria-label="Decrease"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className={`text-4xl font-black tracking-tight tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              {value.toFixed(decimals)}
            </span>
            <span className="text-sm font-extrabold text-emerald-500 uppercase tracking-wider">
              {unit}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleQuickStep('next')}
          disabled={value >= max}
          className={`p-2 rounded-xl transition-all ${
            value >= max 
              ? 'opacity-20 cursor-not-allowed' 
              : isDark 
                ? 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40' 
                : 'bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-emerald-600 hover:border-emerald-500/40'
          }`}
          aria-label="Increase"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Ruler Dial Container */}
      <div className={`relative w-full h-24 rounded-2xl overflow-hidden border ${
        isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
      }`}>
        {/* Left & Right Fade Shadows */}
        <div className={`absolute top-0 bottom-0 left-0 w-16 pointer-events-none z-20 ${
          isDark 
            ? 'bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent' 
            : 'bg-gradient-to-r from-zinc-50 via-zinc-50/80 to-transparent'
        }`} />
        <div className={`absolute top-0 bottom-0 right-0 w-16 pointer-events-none z-20 ${
          isDark 
            ? 'bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent' 
            : 'bg-gradient-to-l from-zinc-50 via-zinc-50/80 to-transparent'
        }`} />

        {/* Center Indicator Needle */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 z-30 pointer-events-none flex flex-col items-center">
          <div className="w-3 h-2 bg-emerald-500 rounded-b-md shadow-md shadow-emerald-500/50" />
          <div className="w-0.5 flex-1 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
        </div>

        {/* Horizontal Scrolling Ruler */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-x-auto overflow-y-hidden no-scrollbar flex items-end pb-3 cursor-grab active:cursor-grabbing"
          style={{
            scrollSnapType: 'x mandatory',
          }}
        >
          {/* Half width left padding */}
          <div className="shrink-0" style={{ width: 'calc(50% - 1px)' }} />

          {/* Ticks */}
          {values.map((v, i) => {
            const isMajor = Math.round(v * 10) % Math.round(majorStep * 10) === 0;
            const isMedium = !isMajor && mediumStep && Math.round(v * 10) % Math.round(mediumStep * 10) === 0;
            const isSelected = i === selectedIndex;

            return (
              <div
                key={v}
                onClick={() => {
                  onChange(v);
                  scrollToValue(v, true);
                }}
                className="shrink-0 flex flex-col items-center justify-end relative h-full group"
                style={{
                  width: `${itemWidth}px`,
                  scrollSnapAlign: 'center',
                }}
              >
                {/* Major Tick Label */}
                {isMajor && (
                  <span className={`text-[10px] font-black absolute top-2 select-none tracking-tight ${
                    isSelected 
                      ? 'text-emerald-500 scale-110' 
                      : isDark ? 'text-zinc-500' : 'text-zinc-400'
                  }`}>
                    {v}
                  </span>
                )}

                {/* Tick Bar */}
                <div
                  className={`w-0.5 rounded-full transition-all duration-150 ${
                    isSelected
                      ? 'bg-emerald-500 h-10 w-1'
                      : isMajor
                        ? isDark ? 'bg-zinc-400 h-8' : 'bg-zinc-600 h-8'
                        : isMedium
                          ? isDark ? 'bg-zinc-600 h-5' : 'bg-zinc-400 h-5'
                          : isDark ? 'bg-zinc-800 h-3' : 'bg-zinc-300 h-3'
                  }`}
                />
              </div>
            );
          })}

          {/* Half width right padding */}
          <div className="shrink-0" style={{ width: 'calc(50% - 1px)' }} />
        </div>
      </div>
    </div>
  );
};

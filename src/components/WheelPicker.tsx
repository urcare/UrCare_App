import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { playScrollTickSound, playClickSound } from '../utils/soundEffects';

interface WheelPickerProps {
  items: { label: string; value: number | string; sublabel?: string }[];
  value: number | string;
  onChange: (value: any) => void;
  itemHeight?: number;
  visibleCount?: number;
  unit?: string;
  className?: string;
  isDark?: boolean;
}

export const WheelPicker: React.FC<WheelPickerProps> = ({
  items,
  value,
  onChange,
  itemHeight = 48,
  visibleCount = 5,
  unit,
  className = '',
  isDark = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickIndexRef = useRef<number | null>(null);

  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => String(item.value) === String(value))
  );

  // Scroll to selected position
  const scrollToSelected = useCallback((index: number, smooth = true) => {
    if (!containerRef.current) return;
    const targetScroll = index * itemHeight;
    containerRef.current.scrollTo({
      top: targetScroll,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [itemHeight]);

  // Initial and value change sync
  useEffect(() => {
    if (!isScrollingRef.current) {
      scrollToSelected(selectedIndex, false);
      lastTickIndexRef.current = selectedIndex;
    }
  }, [selectedIndex, scrollToSelected]);

  // Handle scroll events with snap
  const handleScroll = () => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;

    // Live tick: play a sound the instant the wheel glides past each notch,
    // right as it's happening — not just once when the scroll settles.
    const liveIndex = Math.max(
      0,
      Math.min(items.length - 1, Math.round(containerRef.current.scrollTop / itemHeight))
    );
    if (lastTickIndexRef.current !== liveIndex) {
      lastTickIndexRef.current = liveIndex;
      playScrollTickSound();
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));

      // Snap to target
      scrollToSelected(clampedIndex, true);

      if (items[clampedIndex] && String(items[clampedIndex].value) !== String(value)) {
        onChange(items[clampedIndex].value);
      }
      isScrollingRef.current = false;
    }, 80);
  };

  const handleStep = (direction: 'up' | 'down') => {
    playClickSound(650);
    const newIndex = direction === 'up' 
      ? Math.max(0, selectedIndex - 1)
      : Math.min(items.length - 1, selectedIndex + 1);
    
    if (items[newIndex]) {
      onChange(items[newIndex].value);
      scrollToSelected(newIndex, true);
    }
  };

  const totalHeight = itemHeight * visibleCount;
  const paddingHeight = Math.floor(visibleCount / 2) * itemHeight;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Step Up Button */}
      <button
        type="button"
        onClick={() => handleStep('up')}
        disabled={selectedIndex <= 0}
        className={`p-1.5 rounded-full mb-1 transition-all ${
          selectedIndex <= 0 
            ? 'opacity-20 cursor-not-allowed' 
            : isDark 
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400' 
              : 'hover:bg-zinc-200 text-zinc-600 hover:text-emerald-600'
        }`}
        aria-label="Previous value"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* Wheel Container */}
      <div 
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ height: `${totalHeight}px` }}
      >
        {/* Top and Bottom Fading Gradients */}
        <div 
          className={`absolute top-0 left-0 right-0 pointer-events-none z-10 ${
            isDark 
              ? 'bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent' 
              : 'bg-gradient-to-b from-white via-white/80 to-transparent'
          }`}
          style={{ height: `${paddingHeight}px` }}
        />
        <div 
          className={`absolute bottom-0 left-0 right-0 pointer-events-none z-10 ${
            isDark 
              ? 'bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent' 
              : 'bg-gradient-to-t from-white via-white/80 to-transparent'
          }`}
          style={{ height: `${paddingHeight}px` }}
        />

        {/* Center Active Highlight Lens */}
        <div
          className={`absolute left-2 right-2 rounded-xl pointer-events-none z-0 border transition-all ${
            isDark 
              ? 'bg-emerald-500/10 border-emerald-500/40 shadow-inner' 
              : 'bg-emerald-50 border-emerald-500/50 shadow-sm'
          }`}
          style={{
            top: `${paddingHeight}px`,
            height: `${itemHeight}px`,
          }}
        />

        {/* Scrollable list */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar scroll-smooth"
          style={{
            scrollSnapType: 'y mandatory',
          }}
        >
          {/* Top spacer */}
          <div style={{ height: `${paddingHeight}px` }} />

          {/* Items */}
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;
            const distance = Math.abs(index - selectedIndex);
            
            // Optical drum perspective transforms
            const opacity = isSelected ? 1 : Math.max(0.2, 1 - distance * 0.3);
            const scale = isSelected ? 1.08 : Math.max(0.85, 1 - distance * 0.08);

            return (
              <div
                key={String(item.value)}
                onClick={() => {
                  onChange(item.value);
                  scrollToSelected(index, true);
                }}
                style={{
                  height: `${itemHeight}px`,
                  scrollSnapAlign: 'center',
                  opacity,
                  transform: `scale(${scale})`,
                }}
                className={`flex items-center justify-center cursor-pointer transition-all duration-150 font-bold ${
                  isSelected
                    ? isDark 
                      ? 'text-emerald-400 font-black text-2xl drop-shadow' 
                      : 'text-emerald-700 font-black text-2xl drop-shadow-sm'
                    : isDark 
                      ? 'text-zinc-500 hover:text-zinc-300 text-lg' 
                      : 'text-zinc-400 hover:text-zinc-600 text-lg'
                }`}
              >
                <span className="tabular-nums tracking-tight">{item.label}</span>
                {unit && isSelected && (
                  <span className={`text-xs ml-1.5 font-bold uppercase tracking-wider ${isDark ? 'text-emerald-400/80' : 'text-emerald-700/80'}`}>
                    {unit}
                  </span>
                )}
                {item.sublabel && (
                  <span className="text-[10px] ml-1.5 opacity-60 font-normal">
                    {item.sublabel}
                  </span>
                )}
              </div>
            );
          })}

          {/* Bottom spacer */}
          <div style={{ height: `${paddingHeight}px` }} />
        </div>
      </div>

      {/* Step Down Button */}
      <button
        type="button"
        onClick={() => handleStep('down')}
        disabled={selectedIndex >= items.length - 1}
        className={`p-1.5 rounded-full mt-1 transition-all ${
          selectedIndex >= items.length - 1 
            ? 'opacity-20 cursor-not-allowed' 
            : isDark 
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400' 
              : 'hover:bg-zinc-200 text-zinc-600 hover:text-emerald-600'
        }`}
        aria-label="Next value"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
};

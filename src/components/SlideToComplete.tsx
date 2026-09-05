import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SlideToCompleteProps {
  id: string;
  isCompleted: boolean;
  onComplete: () => void;
  onUndo?: () => void;
  label?: string;
  completedLabel?: string;
  compact?: boolean;
}

export const SlideToComplete: React.FC<SlideToCompleteProps> = ({
  id,
  isCompleted,
  onComplete,
  onUndo,
  label = 'Slide to complete',
  completedLabel = 'Completed',
  compact = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(240);
  const [isDragging, setIsDragging] = useState(false);

  const x = useMotionValue(0);
  const handleSize = compact ? 36 : 42;
  const maxDrag = Math.max(0, containerWidth - handleSize - 8);

  // Background track fill width
  const progressWidth = useTransform(x, [0, maxDrag], [handleSize + 8, containerWidth]);
  const textOpacity = useTransform(x, [0, maxDrag * 0.6], [1, 0]);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth || (compact ? 200 : 240));
    }
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [compact]);

  useEffect(() => {
    if (isCompleted) {
      x.set(maxDrag);
    } else {
      x.set(0);
    }
  }, [isCompleted, maxDrag, x]);

  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false);
    if (info.offset.x > maxDrag * 0.65 || info.velocity.x > 300) {
      // Snapped to complete
      animate(x, maxDrag, { type: 'spring', stiffness: 400, damping: 30 });
      if (!isCompleted) {
        onComplete();
      }
    } else {
      // Reset back to start
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
      if (isCompleted && onUndo) {
        onUndo();
      }
    }
  };

  if (isCompleted) {
    return (
      <div 
        id={`completed-badge-${id}`}
        className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-all duration-300 ${
          isDark 
            ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300' 
            : 'bg-emerald-50 border border-emerald-300 text-emerald-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500 text-black flex items-center justify-center shadow-md">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-xs font-black tracking-wide uppercase">{completedLabel}</span>
        </div>

        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="text-[11px] font-bold opacity-75 hover:opacity-100 underline cursor-pointer"
          >
            Undo
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id={`slider-container-${id}`}
      className={`relative w-full overflow-hidden select-none touch-none rounded-2xl border transition-shadow ${
        compact ? 'h-11' : 'h-12'
      } ${
        isDark 
          ? 'bg-zinc-900/90 border-zinc-800 shadow-inner' 
          : 'bg-zinc-100 border-zinc-300 shadow-inner'
      }`}
    >
      {/* 3D Track Glow Fill */}
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/30 to-emerald-500/60 rounded-2xl"
        style={{ width: progressWidth }}
      />

      {/* Background Prompt Label */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none pl-8 pr-4"
        style={{ opacity: textOpacity }}
      >
        <span className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
          isDark ? 'text-zinc-400' : 'text-zinc-600'
        }`}>
          <span>{label}</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-60 animate-pulse" />
        </span>
      </motion.div>

      {/* 3D Draggable Knob / Handle */}
      <motion.div
        id={`slider-handle-${id}`}
        drag="x"
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`absolute top-1 left-1 rounded-xl cursor-grab active:cursor-grabbing flex items-center justify-center transition-all ${
          compact ? 'w-9 h-9' : 'w-10 h-10'
        } ${
          isDragging ? 'scale-105 shadow-xl ring-2 ring-emerald-400' : 'hover:scale-102'
        } bg-gradient-to-b from-emerald-400 to-emerald-600 text-black shadow-lg shadow-emerald-500/30`}
      >
        <div className="flex items-center justify-center">
          <ChevronRight className="w-5 h-5 stroke-[2.5] text-black drop-shadow-sm" />
        </div>
      </motion.div>
    </div>
  );
};

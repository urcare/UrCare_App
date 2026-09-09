import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Check, type LucideIcon } from 'lucide-react';

export interface TickerItem {
  id: string;
  icon: LucideIcon;
  title: string;
  /** Real value only, e.g. "112 mg/dL". Empty state me CTA copy. */
  value: string;
  state: 'ok' | 'empty';
  onClick?: () => void;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const Row: React.FC<{ item: TickerItem }> = ({ item }) => {
  const Icon = item.icon;
  const ok = item.state === 'ok';
  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={!item.onClick}
      className={[
        'group/row w-full flex items-center gap-3 px-3.5 py-2.5 mb-2 text-left',
        'rounded-2xl border backdrop-blur-sm transition-all duration-300',
        'cursor-pointer disabled:cursor-default',
        ok
          ? 'bg-gradient-to-r from-emerald-50/90 to-emerald-50/40 border-emerald-100'
          : 'bg-white/90 border-zinc-100',
        'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_16px_-10px_rgba(16,24,40,0.12)]',
        'enabled:hover:-translate-y-0.5 enabled:hover:border-emerald-200',
        'enabled:hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_14px_26px_-14px_rgba(5,150,105,0.35)]',
      ].join(' ')}
    >
      <div
        className={[
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors',
          ok
            ? 'bg-white text-emerald-600 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]'
            : 'bg-zinc-50 text-zinc-400 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)]',
        ].join(' ')}
      >
        <Icon className="w-4 h-4" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-black tracking-tight text-zinc-900 truncate">
          {item.title}
        </div>
        <div
          className={`text-[11px] font-semibold truncate ${
            ok ? 'text-emerald-700/70' : 'text-zinc-400'
          }`}
        >
          {item.value}
        </div>
      </div>

      {ok ? (
        <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-[0_6px_14px_-4px_rgba(16,185,129,0.6)]">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </span>
      ) : (
        <span className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 transition-transform group-hover/row:translate-x-0.5">
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
};

/** Calm, slow, infinitely scrolling health checklist with soft faded edges.
 *  Hover/focus par ruk jaata hai; reduced-motion me static list. */
export const CompletionTicker: React.FC<{
  items: TickerItem[];
  /** Visible height. Default 260px — enough for ~3 rows at a glance, so
   *  this stays a compact glanceable strip rather than dominating Home. */
  height?: number | string;
  /** Seconds per full loop of one copy. */
  speed?: number;
}> = ({ items, height = 260, speed = 1.8 }) => {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);

  const animName = useMemo(() => `ticker-${Math.random().toString(36).slice(2, 8)}`, []);
  const doubled = useMemo(() => [...items, ...items], [items]);
  // ~8-14s for a full cycle regardless of list length, per the calm/slow brief.
  const duration = Math.min(14, Math.max(8, items.length * speed));

  if (!items.length) return null;

  if (reduced || items.length < 3) {
    return (
      <div className="flex flex-col">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes ${animName} {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
      `}</style>
      <div
        className="relative overflow-hidden"
        style={{
          height,
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div
          className="flex flex-col"
          style={{
            animation: `${animName} ${duration}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
            willChange: 'transform',
          }}
        >
          {doubled.map((item, i) => (
            <Row key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};

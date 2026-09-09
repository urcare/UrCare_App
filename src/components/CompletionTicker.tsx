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

/** A flat list row, not its own bordered/shadowed card — six-plus of those
 *  stacked (each with a gradient fill, a border, and its own shadow) was
 *  what made this read as "crowded" rather than a calm glance. One thin
 *  divider between rows and a plain colored icon circle is all the visual
 *  weight a row needs; the ticker's own outer card supplies the one
 *  boundary the whole list needs. */
const Row: React.FC<{ item: TickerItem }> = ({ item }) => {
  const Icon = item.icon;
  const ok = item.state === 'ok';
  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={!item.onClick}
      className="group/row w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-zinc-100 last:border-b-0 transition-colors cursor-pointer enabled:hover:bg-zinc-50 disabled:cursor-default"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
        <Icon className="w-4 h-4" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-zinc-900 truncate">{item.title}</div>
        <div className={`text-[11px] font-medium truncate ${ok ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {item.value}
        </div>
      </div>

      {ok ? (
        <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={3} />
      ) : (
        <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0 transition-transform group-hover/row:translate-x-0.5" />
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
      <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
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

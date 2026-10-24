import React, { lazy, Suspense } from 'react';

/** A component that loads its code only when it is first shown (smaller,
 *  faster app start). `fallback` shows while it loads. Every component made
 *  this way is also fetched quietly in the background a few seconds after
 *  the app opens, so opening it later feels instant. */
export function lazyComponent<T extends React.ComponentType<any>>(
  load: () => Promise<Record<string, any>>,
  name: string,
  fallback: React.ReactNode = null,
): T {
  const Lazy = lazy(() => load().then((m) => ({ default: m[name] as T })));
  queued.push(load);
  const Wrapped = (props: any) => (
    <Suspense fallback={fallback}>
      <Lazy {...props} />
    </Suspense>
  );
  return Wrapped as unknown as T;
}

const queued: (() => Promise<unknown>)[] = [];
let started = false;
/** Fetch all lazy parts in the background once the app is idle. */
export function prefetchLazyParts(delayMs = 4000) {
  if (started) return;
  started = true;
  const run = () => {
    let i = 0;
    const next = () => {
      const load = queued[i++];
      if (!load) return;
      load().catch(() => {}).finally(() => window.setTimeout(next, 150));
    };
    next();
  };
  window.setTimeout(() => {
    const ric = (window as any).requestIdleCallback as ((cb: () => void) => void) | undefined;
    if (ric) ric(run); else run();
  }, delayMs);
}

/** Small centred spinner for pages that load on demand. */
export const PageLoader: React.FC = () => (
  <div className="w-full flex items-center justify-center py-24">
    <span className="w-8 h-8 rounded-full border-[3px] border-emerald-200 border-t-emerald-600 animate-spin" />
  </div>
);
